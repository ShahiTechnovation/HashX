import { describe, expect, it } from "vitest";
import { Pool } from "pg";
import { loadMigrations, pendingMigrations, runMigrations } from "../../src/db/migrate";
import { pool, query } from "../../src/db/client";

describe("versioned migrations", () => {
  it("applied every migration to the fresh test database with recorded checksums", async () => {
    const files = loadMigrations();
    expect(files.map((f) => f.name)).toEqual(["001_baseline", "002_auth_and_settlement_v2"]);
    const rows = (await query("SELECT version, checksum FROM schema_migrations ORDER BY version")).rows;
    expect(rows.map((r) => r.version)).toEqual(files.map((f) => f.version));
    expect(rows.map((r) => r.checksum)).toEqual(files.map((f) => f.checksum));
    expect(await pendingMigrations(pool)).toEqual([]);
  });

  it("is idempotent: re-running applies nothing", async () => {
    const res = await runMigrations(new Pool({ connectionString: process.env.DATABASE_URL }), () => undefined);
    expect(res.applied).toEqual([]);
    expect(res.alreadyApplied).toHaveLength(2);
  });

  it("refuses to run if an applied migration was edited", async () => {
    await query("UPDATE schema_migrations SET checksum = $1 WHERE version = 2", ["0".repeat(64)]);
    try {
      await expect(runMigrations({ connectionString: process.env.DATABASE_URL }, () => undefined)).rejects.toThrow(/checksum mismatch/);
    } finally {
      await query("UPDATE schema_migrations SET checksum = $1 WHERE version = 2", [loadMigrations()[1].checksum]);
    }
  });

  it("creates the security-critical constraints", async () => {
    const idx = (await query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")).rows.map((r) => r.indexname);
    for (const name of [
      "uq_payment_attempts_live_invoice",
      "uq_payment_attempts_chain_tx",
      "uq_payment_attempts_auth_nonce",
      "uq_invoices_v2_client_request",
      "uq_deliveries_manifest_digest",
      "uq_receipts_live_invoice",
    ]) {
      expect(idx, name).toContain(name);
    }
    const tables = (await query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).rows.map((r) => r.tablename);
    expect(tables).toEqual(expect.arrayContaining(["auth_nonces", "auth_sessions", "agent_credentials", "settlement_transfers"]));
  });
});
