/**
 * HashX backend entry point.
 * Startup order: validate configuration → verify database migrations → start HTTP →
 * attempt HSP connection (fail-closed) → start durable settlement reconciler.
 */
import { config } from "./config.js";
import { pool } from "./db/client.js";
import { pendingMigrations } from "./db/migrate.js";
import { createApp } from "./app.js";
import { log } from "./lib/core.js";
import { hspAdapter } from "./settlement/registry.js";
import { startReconciler, stopReconciler } from "./services/payments.js";

async function main() {
  const cfg = config(); // throws ConfigError on invalid production configuration
  const pending = await pendingMigrations(pool);
  if (pending.length) {
    throw new Error(`Database has pending migrations (${pending.join(", ")}). Run \`pnpm --prefix server db:migrate\` first.`);
  }
  const app = createApp();
  const server = app.listen(cfg.port, cfg.host, () => {
    log("INFO", "server_started", { host: cfg.host, port: cfg.port, env: cfg.nodeEnv, chains: Array.from(cfg.chains.keys()) });
  });

  hspAdapter()
    .connect()
    .then((s) => log("INFO", "hsp_status", { connection: s.connection, settlementAvailable: s.settlementAvailable }))
    .catch(() => undefined);
  startReconciler();

  const shutdown = (signal: string) => {
    log("INFO", "shutdown", { signal });
    stopReconciler();
    server.close(async () => {
      await hspAdapter().close();
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(JSON.stringify({ level: "ERROR", msg: "startup_failed", error: err.message }));
  process.exit(1);
});
