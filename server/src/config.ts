import dotenv from "dotenv";
import { getAddress, isAddress } from "viem";
import {
  HASHKEY_MAINNET_CHAIN_ID,
  HASHKEY_TESTNET_CHAIN_ID,
  LOCAL_DEV_CHAIN_ID,
  SEPOLIA,
  SEPOLIA_CHAIN_ID,
  type Address,
  type TokenConfig,
} from "../../shared/networks.js";

dotenv.config();

/** Environment being parsed by the current loadConfig() call. */
let ENV: NodeJS.ProcessEnv = process.env;

export class ConfigError extends Error {
  readonly code = "CONFIG_INVALID";
}

function bool(name: string, fallback = false): boolean {
  const v = ENV[name];
  if (v === undefined || v === "") return fallback;
  return v === "true" || v === "1";
}

function int(name: string, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const raw = ENV[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ConfigError(`${name} must be an integer in [${min}, ${max}], got "${raw}"`);
  }
  return n;
}

function list(name: string, fallback: string[]): string[] {
  const raw = ENV[name];
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function optionalAddress(name: string): Address | null {
  const raw = ENV[name];
  if (!raw) return null;
  if (!isAddress(raw)) throw new ConfigError(`${name} is not a valid address`);
  const addr = getAddress(raw);
  return addr === "0x0000000000000000000000000000000000000000" ? null : addr;
}

export type FinalityPolicy = { kind: "confirmations"; confirmations: number } | { kind: "finalized" };

function parseFinality(name: string, fallback: FinalityPolicy): FinalityPolicy {
  const raw = ENV[name];
  if (!raw) return fallback;
  if (raw === "finalized") return { kind: "finalized" };
  const m = /^confirmations:(\d+)$/.exec(raw);
  if (!m) throw new ConfigError(`${name} must be "finalized" or "confirmations:<n>"`);
  const n = Number(m[1]);
  if (n < 1 || n > 1000) throw new ConfigError(`${name} confirmations must be within 1..1000`);
  return { kind: "confirmations", confirmations: n };
}

export function describeFinality(p: FinalityPolicy): string {
  return p.kind === "finalized" ? "finalized-block-tag" : `confirmations>=${p.confirmations}`;
}

export interface ChainRuntimeConfig {
  chainId: number;
  rpcUrl: string | null;
  /** Settlement token configured for the direct ERC-20 rail on this chain. */
  settlementToken: TokenConfig | null;
  paymentExecutionEnabled: boolean;
  finality: FinalityPolicy;
  /** Evidence registry address explicitly configured for this chain (not proof of deployment). */
  evidenceRegistry: Address | null;
}

export interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  host: string;
  trustProxy: string | number | boolean;
  allowedOrigins: string[];
  siweDomains: string[];
  sessionTtlSeconds: number;
  nonceTtlSeconds: number;
  databaseUrl: string | null;
  chains: Map<number, ChainRuntimeConfig>;
  delivery: {
    maxBlockRange: number;
    minConfirmations: number;
    rpcTimeoutMs: number;
    totalTimeoutMs: number;
    maxSampleTransactions: number;
    verificationTtlSeconds: number;
  };
  payments: {
    authorizationTtlSeconds: number;
    dropTimeoutSeconds: number;
    reconcileIntervalMs: number;
    reconcilerEnabled: boolean;
  };
  hsp: {
    endpoint: string | null;
    merchantName: string;
    appKey: string | null;
    appSecret: string | null;
    allowlistConfirmed: boolean;
    egressIpDeclared: string | null;
  };
  rateLimit: { windowMs: number; maxAuth: number; maxWrite: number };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  ENV = env;
  const nodeEnv = env.NODE_ENV || "development";
  const isProduction = nodeEnv === "production";

  const chains = new Map<number, ChainRuntimeConfig>();

  chains.set(SEPOLIA_CHAIN_ID, {
    chainId: SEPOLIA_CHAIN_ID,
    rpcUrl: env.SEPOLIA_RPC_URL || null,
    settlementToken: SEPOLIA.settlementToken,
    paymentExecutionEnabled: bool("SEPOLIA_PAYMENTS_ENABLED", true),
    finality: parseFinality("SEPOLIA_FINALITY_POLICY", { kind: "confirmations", confirmations: 12 }),
    evidenceRegistry: optionalAddress("EVIDENCE_REGISTRY_ADDRESS_SEPOLIA"),
  });

  chains.set(HASHKEY_TESTNET_CHAIN_ID, {
    chainId: HASHKEY_TESTNET_CHAIN_ID,
    rpcUrl: env.HSK_TESTNET_RPC || null,
    settlementToken: null,
    paymentExecutionEnabled: false,
    finality: { kind: "finalized" },
    evidenceRegistry: optionalAddress("EVIDENCE_REGISTRY_ADDRESS_TESTNET"),
  });

  chains.set(HASHKEY_MAINNET_CHAIN_ID, {
    chainId: HASHKEY_MAINNET_CHAIN_ID,
    rpcUrl: env.HSK_MAINNET_RPC || null,
    settlementToken: null,
    // Mainnet payments are hard-disabled in this release; there is no flag to enable them.
    paymentExecutionEnabled: false,
    finality: { kind: "finalized" },
    evidenceRegistry: optionalAddress("EVIDENCE_REGISTRY_ADDRESS_MAINNET"),
  });

  if (bool("HASHX_ENABLE_LOCAL_CHAIN")) {
    if (isProduction) throw new ConfigError("HASHX_ENABLE_LOCAL_CHAIN must not be set in production");
    const token = optionalAddress("LOCAL_SETTLEMENT_TOKEN_ADDRESS");
    chains.set(LOCAL_DEV_CHAIN_ID, {
      chainId: LOCAL_DEV_CHAIN_ID,
      rpcUrl: env.LOCAL_RPC_URL || "http://127.0.0.1:8545",
      settlementToken: token
        ? {
            address: token,
            symbol: "USDC",
            displayName: "Local test USDC (no value)",
            decimals: 6,
            isTestToken: true,
            source: "LOCAL_SETTLEMENT_TOKEN_ADDRESS (local test deployment)",
          }
        : null,
      paymentExecutionEnabled: Boolean(token),
      finality: parseFinality("LOCAL_FINALITY_POLICY", { kind: "confirmations", confirmations: 2 }),
      evidenceRegistry: optionalAddress("EVIDENCE_REGISTRY_ADDRESS_LOCAL"),
    });
  }

  const allowedOrigins = list("ALLOWED_ORIGINS", isProduction ? [] : ["http://localhost:3000", "http://127.0.0.1:3000"]);
  const siweDomains = list(
    "SIWE_ALLOWED_DOMAINS",
    allowedOrigins.map((o) => {
      try {
        return new URL(o).host;
      } catch {
        return o;
      }
    })
  );

  const trustProxyRaw = env.TRUST_PROXY;
  let trustProxy: string | number | boolean = false;
  if (trustProxyRaw) trustProxy = /^\d+$/.test(trustProxyRaw) ? Number(trustProxyRaw) : trustProxyRaw;

  const cfg: AppConfig = {
    nodeEnv,
    isProduction,
    port: int("PORT", 8080, 1, 65535),
    host: env.HOST || "127.0.0.1",
    trustProxy,
    allowedOrigins,
    siweDomains,
    sessionTtlSeconds: int("SESSION_TTL_SECONDS", 3600, 60, 86400),
    nonceTtlSeconds: int("SIWE_NONCE_TTL_SECONDS", 300, 30, 3600),
    databaseUrl: env.DATABASE_URL || null,
    chains,
    delivery: {
      maxBlockRange: int("DELIVERY_MAX_BLOCK_RANGE", 50, 1, 500),
      minConfirmations: int("DELIVERY_MIN_CONFIRMATIONS", 6, 0, 1000),
      rpcTimeoutMs: int("RPC_TIMEOUT_MS", 8000, 500, 60000),
      totalTimeoutMs: int("DELIVERY_VERIFICATION_TIMEOUT_MS", 45000, 1000, 300000),
      maxSampleTransactions: int("DELIVERY_MAX_SAMPLE_TRANSACTIONS", 10, 0, 100),
      verificationTtlSeconds: int("VERIFICATION_TTL_SECONDS", 86400, 60, 30 * 86400),
    },
    payments: {
      authorizationTtlSeconds: int("PAYMENT_AUTHORIZATION_TTL_SECONDS", 900, 60, 86400),
      dropTimeoutSeconds: int("PAYMENT_DROP_TIMEOUT_SECONDS", 1800, 60, 86400),
      reconcileIntervalMs: int("RECONCILE_INTERVAL_MS", 15000, 1000, 600000),
      reconcilerEnabled: bool("RECONCILER_ENABLED", nodeEnv !== "test"),
    },
    hsp: {
      endpoint: env.HSP_MCP_STREAMABLE_HTTP_ENDPOINT || null,
      merchantName: env.HSP_MERCHANT_NAME || "HashX",
      appKey: env.HSP_APP_KEY || null,
      appSecret: env.HSP_APP_SECRET || null,
      allowlistConfirmed: bool("HSP_ALLOWLIST_CONFIRMED"),
      egressIpDeclared: env.HSP_DECLARED_EGRESS_IP || null,
    },
    rateLimit: {
      windowMs: int("RATE_LIMIT_WINDOW_MS", 60000, 1000, 3600000),
      maxAuth: int("RATE_LIMIT_MAX_AUTH", 30, 1, 100000),
      maxWrite: int("RATE_LIMIT_MAX_WRITE", 120, 1, 100000),
    },
  };

  validateConfig(cfg);
  return cfg;
}

function validateConfig(cfg: AppConfig) {
  if (cfg.isProduction) {
    const problems: string[] = [];
    if (!cfg.databaseUrl) problems.push("DATABASE_URL is required in production");
    if (cfg.allowedOrigins.length === 0) problems.push("ALLOWED_ORIGINS is required in production");
    if (cfg.siweDomains.length === 0) problems.push("SIWE_ALLOWED_DOMAINS is required in production");
    if (cfg.allowedOrigins.some((o) => !o.startsWith("https://"))) {
      problems.push("ALLOWED_ORIGINS must use https:// in production");
    }
    if (problems.length) throw new ConfigError(problems.join("; "));
  }
}

let current: AppConfig | null = null;

export function config(): AppConfig {
  if (!current) current = loadConfig();
  return current;
}

/** Test hook: replace the active configuration. */
export function setConfig(cfg: AppConfig) {
  current = cfg;
}
