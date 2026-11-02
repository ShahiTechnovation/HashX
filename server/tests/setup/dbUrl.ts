import dotenv from "dotenv";

dotenv.config();

/** Test database URL: TEST_DATABASE_URL, or the developer's DB_* credentials pointed at `hashx_test`. */
export function testDatabaseUrl(dbName = "hashx_test"): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const user = encodeURIComponent(process.env.DB_USER || "postgres");
  const pass = process.env.DB_PASSWORD ? `:${encodeURIComponent(process.env.DB_PASSWORD)}` : "";
  const host = process.env.DB_HOST || "127.0.0.1";
  const port = process.env.DB_PORT || "5432";
  return `postgresql://${user}${pass}@${host}:${port}/${dbName}`;
}

export function adminDatabaseUrl(): string {
  const u = new URL(testDatabaseUrl());
  u.pathname = "/postgres";
  return u.toString();
}

export const LOCAL_RPC_PORT = 8546;
export const LOCAL_RPC_URL = `http://127.0.0.1:${LOCAL_RPC_PORT}`;
