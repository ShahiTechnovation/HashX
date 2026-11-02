/**
 * HashX — centralized, typed network configuration.
 *
 * Shared by the Next.js frontend and the persistent backend. This module is
 * intentionally dependency-free so both runtimes resolve identical values.
 *
 * Rules enforced here:
 *  - Unknown chain IDs are rejected (never silently treated as HashKey 133).
 *  - Ethereum Sepolia, HashKey Testnet 133, and HashKey Mainnet 177 are configured independently.
 *  - HashKey Mainnet payment execution is disabled by default.
 *  - Sepolia USDC is Circle's official *test* token: it has no monetary value.
 */

export type Address = `0x${string}`;

/** Settlement rails are distinct protocol adapters, not interchangeable labels. */
export type SettlementRail = "sepolia-usdc" | "hashkey-hsp";

export const SETTLEMENT_RAILS: readonly SettlementRail[] = ["sepolia-usdc", "hashkey-hsp"] as const;

export interface TokenConfig {
  address: Address;
  symbol: string;
  /** Human label; test tokens always say so explicitly. */
  displayName: string;
  decimals: number;
  isTestToken: boolean;
  /** Where the address was sourced from (for auditability). */
  source: string;
}

export interface NetworkConfig {
  chainId: number;
  key: "sepolia" | "hashkey-testnet" | "hashkey-mainnet" | "local-dev";
  name: string;
  shortName: string;
  isTestnet: boolean;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  /** Public RPC used only as a frontend/wallet default. Backends should configure their own. */
  publicRpcUrl: string;
  explorerUrl: string | null;
  /** Settlement token for the direct ERC-20 rail on this chain, if any. */
  settlementToken: TokenConfig | null;
  /** Rails that may settle on this chain. */
  rails: readonly SettlementRail[];
  /** Whether payment execution is permitted without additional explicit operator enablement. */
  paymentExecutionEnabledByDefault: boolean;
  /** Whether service-delivery facts may be verified against this chain. */
  deliveryVerificationSupported: boolean;
}

/** Circle official test USDC on Ethereum Sepolia (https://developers.circle.com/stablecoins/usdc-contract-addresses). */
export const SEPOLIA_USDC_ADDRESS: Address = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
export const SEPOLIA_CHAIN_ID = 11155111;
export const HASHKEY_TESTNET_CHAIN_ID = 133;
export const HASHKEY_MAINNET_CHAIN_ID = 177;
/** Local Hardhat/Anvil chain. Only enabled by explicit backend configuration for deterministic tests. */
export const LOCAL_DEV_CHAIN_ID = 31337;

export const SEPOLIA: NetworkConfig = {
  chainId: SEPOLIA_CHAIN_ID,
  key: "sepolia",
  name: "Ethereum Sepolia Testnet",
  shortName: "Sepolia Testnet",
  isTestnet: true,
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  publicRpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
  explorerUrl: "https://sepolia.etherscan.io",
  settlementToken: {
    address: SEPOLIA_USDC_ADDRESS,
    symbol: "USDC",
    displayName: "Test USDC (Sepolia)",
    decimals: 6,
    isTestToken: true,
    source: "Circle USDC contract addresses directory — Ethereum Sepolia testnet",
  },
  rails: ["sepolia-usdc"],
  paymentExecutionEnabledByDefault: true,
  deliveryVerificationSupported: true,
};

export const HASHKEY_TESTNET: NetworkConfig = {
  chainId: HASHKEY_TESTNET_CHAIN_ID,
  key: "hashkey-testnet",
  name: "HashKey Chain Testnet",
  shortName: "HashKey Testnet",
  isTestnet: true,
  nativeCurrency: { name: "HashKey EcoPoints", symbol: "HSK", decimals: 18 },
  publicRpcUrl: "https://testnet.hsk.xyz",
  explorerUrl: "https://testnet-explorer.hsk.xyz",
  settlementToken: null,
  rails: ["hashkey-hsp"],
  paymentExecutionEnabledByDefault: false,
  deliveryVerificationSupported: true,
};

export const HASHKEY_MAINNET: NetworkConfig = {
  chainId: HASHKEY_MAINNET_CHAIN_ID,
  key: "hashkey-mainnet",
  name: "HashKey Chain Mainnet",
  shortName: "HashKey Mainnet",
  isTestnet: false,
  nativeCurrency: { name: "HashKey Platform Token", symbol: "HSK", decimals: 18 },
  publicRpcUrl: "https://mainnet.hsk.xyz",
  explorerUrl: "https://hashkey.blockscout.com",
  settlementToken: null,
  rails: ["hashkey-hsp"],
  // Mainnet financial execution must never be enabled by default.
  paymentExecutionEnabledByDefault: false,
  deliveryVerificationSupported: true,
};

export const LOCAL_DEV: NetworkConfig = {
  chainId: LOCAL_DEV_CHAIN_ID,
  key: "local-dev",
  name: "Local Development EVM (Hardhat/Anvil)",
  shortName: "Local EVM",
  isTestnet: true,
  nativeCurrency: { name: "Local Ether", symbol: "ETH", decimals: 18 },
  publicRpcUrl: "http://127.0.0.1:8545",
  explorerUrl: null,
  // The token address is deployment-specific and injected by backend configuration.
  settlementToken: null,
  rails: ["sepolia-usdc"],
  paymentExecutionEnabledByDefault: false,
  deliveryVerificationSupported: true,
};

/** Networks exposed to end users. LOCAL_DEV is deliberately excluded. */
export const PUBLIC_NETWORKS: readonly NetworkConfig[] = [SEPOLIA, HASHKEY_TESTNET, HASHKEY_MAINNET];

const ALL_NETWORKS: readonly NetworkConfig[] = [...PUBLIC_NETWORKS, LOCAL_DEV];

export class UnsupportedChainError extends Error {
  readonly code = "UNSUPPORTED_CHAIN";
  constructor(readonly chainId: unknown) {
    super(`Unsupported chain ID: ${String(chainId)}`);
    this.name = "UnsupportedChainError";
  }
}

export function findNetwork(chainId: number | bigint | string | null | undefined): NetworkConfig | undefined {
  if (chainId === null || chainId === undefined || chainId === "") return undefined;
  const n = Number(chainId);
  if (!Number.isSafeInteger(n)) return undefined;
  return ALL_NETWORKS.find((net) => net.chainId === n);
}

/** Resolve a network or throw. Never falls back to a default chain. */
export function getNetwork(chainId: number | bigint | string): NetworkConfig {
  const net = findNetwork(chainId);
  if (!net) throw new UnsupportedChainError(chainId);
  return net;
}

export function isPublicNetwork(chainId: number): boolean {
  return PUBLIC_NETWORKS.some((n) => n.chainId === chainId);
}

/** Chains on which a rail can settle (local dev is included only for the backend when explicitly enabled). */
export function railSupportsChain(rail: SettlementRail, chainId: number): boolean {
  const net = findNetwork(chainId);
  return Boolean(net && net.rails.includes(rail));
}

export function explorerTxUrl(chainId: number, txHash: string): string | null {
  const net = findNetwork(chainId);
  return net?.explorerUrl ? `${net.explorerUrl}/tx/${txHash}` : null;
}

export function explorerAddressUrl(chainId: number, address: string): string | null {
  const net = findNetwork(chainId);
  return net?.explorerUrl ? `${net.explorerUrl}/address/${address}` : null;
}

/** Parameters for EIP-3085 `wallet_addEthereumChain`. */
export function walletAddChainParams(net: NetworkConfig) {
  return {
    chainId: `0x${net.chainId.toString(16)}`,
    chainName: net.name,
    nativeCurrency: net.nativeCurrency,
    rpcUrls: [net.publicRpcUrl],
    blockExplorerUrls: net.explorerUrl ? [net.explorerUrl] : undefined,
  };
}

export function railLabel(rail: SettlementRail): string {
  return rail === "sepolia-usdc" ? "Direct Test USDC transfer (Sepolia Testnet)" : "HashKey Settlement Protocol (HSP)";
}

/** Formats raw integer token units as a decimal string without floating point. */
export function formatTokenAmount(raw: string | bigint, decimals: number): string {
  const value = typeof raw === "bigint" ? raw : BigInt(raw);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const fracStr = decimals > 0 ? frac.toString().padStart(decimals, "0").replace(/0+$/, "") : "";
  return `${negative ? "-" : ""}${whole.toString()}${fracStr ? `.${fracStr}` : ""}`;
}

/** Parses a decimal string into raw integer token units. Rejects excess precision instead of rounding. */
export function parseTokenAmount(input: string, decimals: number): bigint {
  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error(`Invalid token amount: "${input}"`);
  const [whole, frac = ""] = trimmed.split(".");
  if (frac.length > decimals) throw new Error(`Amount "${input}" exceeds ${decimals} decimal places`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
}
