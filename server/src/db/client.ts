import { Pool, PoolClient, type PoolConfig } from "pg";
import dotenv from "dotenv";

dotenv.config();

/**
 * Connection settings come from DATABASE_URL (preferred) or discrete DB_* variables.
 * There is intentionally no default password: a missing credential fails loudly.
 */
export function poolConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PoolConfig {
  const base: PoolConfig = { max: 20, idleTimeoutMillis: 30000, connectionTimeoutMillis: 5000 };
  if (env.DATABASE_URL) return { ...base, connectionString: env.DATABASE_URL };
  if (env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL must be set in production");
  }
  return {
    ...base,
    host: env.DB_HOST || "127.0.0.1",
    port: parseInt(env.DB_PORT || "5432", 10),
    user: env.DB_USER || "postgres",
    password: env.DB_PASSWORD,
    database: env.DB_NAME || "hashx_v1",
  };
}

export const pool = new Pool(poolConfigFromEnv());

pool.on("error", (err) => {
  console.error(JSON.stringify({ level: "ERROR", msg: "postgres_pool_error", error: err.message }));
});

export type Queryable = Pick<PoolClient, "query">;

export async function query<T = any>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number }> {
  const res = await pool.query(text, params as any[]);
  return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
}

/**
 * Runs `fn` inside a single database transaction. Callers must not perform
 * external network I/O (RPC, HSP) inside `fn`: transactions stay short and local.
 */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
