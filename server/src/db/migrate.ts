/**
 * Versioned, checksummed PostgreSQL migrations.
 *
 *  - Files in server/migrations named NNN_description.sql are applied in order.
 *  - Each migration runs in its own transaction under a cluster-wide advisory lock,
 *    so concurrent deploys cannot double-apply.
 *  - Applied migrations are recorded with a SHA-256 checksum; editing an applied
 *    migration aborts the run instead of silently diverging.
 *
 * Usage: pnpm --prefix server db:migrate   (or `node dist/server/src/db/migrate.js`)
 */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { Pool, type PoolConfig } from "pg";
import { poolConfigFromEnv } from "./client.js";

const ADVISORY_LOCK_KEY = 0x48415348; // "HASH"

export interface MigrationFile {
  version: number;
  name: string;
  sql: string;
  checksum: string;
}

export function resolveMigrationsDir(): string {
  if (process.env.MIGRATIONS_DIR) return path.resolve(process.env.MIGRATIONS_DIR);
  // Walk up from this module (src/db or dist/server/src/db) and cwd to find server/migrations.
  const starts = [__dirname, process.cwd()];
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 6; i++) {
      for (const candidate of [path.join(dir, "migrations"), path.join(dir, "server", "migrations")]) {
        if (fs.existsSync(path.join(candidate, "001_baseline.sql"))) return candidate;
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error("Could not locate migrations directory (set MIGRATIONS_DIR)");
}

export function loadMigrations(dir = resolveMigrationsDir()): MigrationFile[] {
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d{3}_[a-z0-9_]+\.sql$/.test(f))
    .sort();
  const seen = new Set<number>();
  return files.map((file) => {
    const version = Number(file.slice(0, 3));
    if (seen.has(version)) throw new Error(`Duplicate migration version ${version}`);
    seen.add(version);
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    return {
      version,
      name: file.replace(/\.sql$/, ""),
      sql,
      checksum: createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex"),
    };
  });
}

export async function runMigrations(
  poolOrConfig: Pool | PoolConfig = poolConfigFromEnv(),
  log: (msg: string) => void = (m) => console.info(m)
): Promise<{ applied: string[]; alreadyApplied: string[] }> {
  const ownPool = !(poolOrConfig instanceof Pool);
  const pool = poolOrConfig instanceof Pool ? poolOrConfig : new Pool(poolOrConfig);
  const client = await pool.connect();
  const applied: string[] = [];
  const alreadyApplied: string[] = [];
  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    const existing = await client.query<{ version: number; checksum: string; name: string }>(
      "SELECT version, checksum, name FROM schema_migrations ORDER BY version"
    );
    const byVersion = new Map(existing.rows.map((r) => [r.version, r]));

    for (const m of loadMigrations()) {
      const prior = byVersion.get(m.version);
      if (prior) {
        if (prior.checksum !== m.checksum) {
          throw new Error(
            `Migration ${m.name} was modified after being applied (checksum mismatch). Create a new migration instead.`
          );
        }
        alreadyApplied.push(m.name);
        continue;
      }
      log(`[migrate] applying ${m.name}`);
      await client.query("BEGIN");
      try {
        await client.query(m.sql);
        await client.query("INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)", [
          m.version,
          m.name,
          m.checksum,
        ]);
        await client.query("COMMIT");
        applied.push(m.name);
      } catch (err) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${m.name} failed: ${(err as Error).message}`);
      }
    }
    return { applied, alreadyApplied };
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]).catch(() => undefined);
    client.release();
    if (ownPool) await pool.end();
  }
}

export async function pendingMigrations(pool: Pool): Promise<string[]> {
  const files = loadMigrations();
  try {
    const res = await pool.query<{ version: number }>("SELECT version FROM schema_migrations");
    const done = new Set(res.rows.map((r) => r.version));
    return files.filter((f) => !done.has(f.version)).map((f) => f.name);
  } catch {
    return files.map((f) => f.name);
  }
}

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  runMigrations()
    .then(({ applied, alreadyApplied }) => {
      console.info(`[migrate] done. applied=${applied.length} alreadyApplied=${alreadyApplied.length}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(`[migrate] FAILED: ${err.message}`);
      process.exit(1);
    });
}
