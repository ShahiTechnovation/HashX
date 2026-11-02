/**
 * Per-worker environment. Runs before any test module imports application code, so the
 * DB pool and configuration bind to the isolated test database and local EVM.
 */
import { inject } from "vitest";
import { LOCAL_RPC_URL } from "./dbUrl";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = inject("testDatabaseUrl");
process.env.HASHX_ENABLE_LOCAL_CHAIN = "true";
process.env.LOCAL_RPC_URL = LOCAL_RPC_URL;
process.env.LOCAL_SETTLEMENT_TOKEN_ADDRESS = inject("localToken");
process.env.LOCAL_FINALITY_POLICY = "confirmations:3";
process.env.DELIVERY_MIN_CONFIRMATIONS = "2";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";
process.env.SIWE_ALLOWED_DOMAINS = "localhost:3000";
process.env.RECONCILER_ENABLED = "false";
process.env.RATE_LIMIT_MAX_AUTH = "100000";
process.env.RATE_LIMIT_MAX_WRITE = "100000";
// Deterministic HSP state: never inherit developer credentials into tests.
process.env.HSP_MCP_STREAMABLE_HTTP_ENDPOINT = "";
process.env.HSP_APP_KEY = "";
process.env.HSP_APP_SECRET = "";
process.env.HSP_ALLOWLIST_CONFIRMED = "false";
// Sepolia RPC is only used by the opt-in read-only smoke test (SEPOLIA_RPC_URL_TEST).
process.env.SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL_TEST || "";
// Never inherit developer registry settings; registry tests configure their own.
process.env.EVIDENCE_REGISTRY_ADDRESS_TESTNET = "";
process.env.EVIDENCE_REGISTRY_ADDRESS_MAINNET = "";
process.env.EVIDENCE_REGISTRY_ADDRESS_SEPOLIA = "";
process.env.HSK_TESTNET_RPC = "";
process.env.HSK_MAINNET_RPC = "";
