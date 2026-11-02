/**
 * Independent blockchain readers.
 *
 * Every reader validates the RPC's eth_chainId before its data may be used, and
 * every call is bounded by a timeout. Any failure surfaces as a ChainReadError so
 * callers can fail closed (PENDING / non-payable) instead of trusting seller claims.
 */
import { createPublicClient, http, type Block, type PublicClient, type Transaction, type TransactionReceipt } from "viem";
import { config } from "../config.js";
import { rpcLabel } from "../lib/core.js";

type Hex = `0x${string}`;

export class ChainReadError extends Error {
  constructor(
    readonly code: "RPC_UNCONFIGURED" | "RPC_UNAVAILABLE" | "RPC_CHAIN_MISMATCH" | "RPC_TIMEOUT",
    message: string
  ) {
    super(message);
    this.name = "ChainReadError";
  }
}

export interface ChainReader {
  readonly chainId: number;
  /** Non-reversible label safe for persistence and API responses. */
  readonly label: string;
  assertChainId(): Promise<void>;
  getBlockNumber(): Promise<bigint>;
  getFinalizedBlockNumber(): Promise<bigint | null>;
  getBlockWithTransactions(blockNumber: bigint): Promise<Block<bigint, true>>;
  getBlockHash(blockNumber: bigint): Promise<Hex | null>;
  getTransactionReceipt(hash: Hex): Promise<TransactionReceipt | null>;
  getTransaction(hash: Hex): Promise<Transaction | null>;
  getCode(address: Hex): Promise<Hex | undefined>;
  readContract(args: { address: Hex; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] }): Promise<unknown>;
}

function isNotFound(err: unknown): boolean {
  const name = (err as { name?: string })?.name ?? "";
  return name === "TransactionReceiptNotFoundError" || name === "TransactionNotFoundError" || name === "BlockNotFoundError";
}

export class ViemChainReader implements ChainReader {
  readonly label: string;
  private client: PublicClient;
  private verifiedChain = false;

  constructor(
    readonly chainId: number,
    rpcUrl: string,
    timeoutMs: number
  ) {
    this.label = rpcLabel(chainId, rpcUrl);
    this.client = createPublicClient({ transport: http(rpcUrl, { timeout: timeoutMs, retryCount: 1 }) });
  }

  private async call<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ChainReadError) throw err;
      const name = (err as { name?: string })?.name ?? "";
      if (name === "TimeoutError") throw new ChainReadError("RPC_TIMEOUT", `RPC timeout on chain ${this.chainId}`);
      throw new ChainReadError("RPC_UNAVAILABLE", `RPC error on chain ${this.chainId}: ${(err as Error).message?.split("\n")[0]}`);
    }
  }

  async assertChainId(): Promise<void> {
    if (this.verifiedChain) return;
    const remote = await this.call(() => this.client.getChainId());
    if (remote !== this.chainId) {
      throw new ChainReadError("RPC_CHAIN_MISMATCH", `RPC reports chain ${remote}, expected ${this.chainId}`);
    }
    this.verifiedChain = true;
  }

  async getBlockNumber() {
    await this.assertChainId();
    return this.call(() => this.client.getBlockNumber({ cacheTime: 0 }));
  }

  async getFinalizedBlockNumber() {
    await this.assertChainId();
    try {
      const b = await this.client.getBlock({ blockTag: "finalized" });
      return b.number ?? null;
    } catch {
      return null; // chain/RPC does not support the finalized tag
    }
  }

  async getBlockWithTransactions(blockNumber: bigint) {
    await this.assertChainId();
    return this.call(() => this.client.getBlock({ blockNumber, includeTransactions: true }));
  }

  async getBlockHash(blockNumber: bigint) {
    await this.assertChainId();
    try {
      const b = await this.client.getBlock({ blockNumber });
      return b.hash ?? null;
    } catch (err) {
      if (isNotFound(err)) return null;
      return this.call(() => Promise.reject(err));
    }
  }

  async getTransactionReceipt(hash: Hex) {
    await this.assertChainId();
    try {
      return await this.client.getTransactionReceipt({ hash });
    } catch (err) {
      if (isNotFound(err)) return null;
      return this.call(() => Promise.reject(err));
    }
  }

  async getTransaction(hash: Hex) {
    await this.assertChainId();
    try {
      return await this.client.getTransaction({ hash });
    } catch (err) {
      if (isNotFound(err)) return null;
      return this.call(() => Promise.reject(err));
    }
  }

  async getCode(address: Hex) {
    await this.assertChainId();
    return this.call(() => this.client.getCode({ address }));
  }

  async readContract(args: { address: Hex; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] }) {
    await this.assertChainId();
    return this.call(() => this.client.readContract(args as never));
  }
}

const overrides = new Map<number, ChainReader>();
const cache = new Map<number, ChainReader>();

/** Returns the reader for a chain, or throws RPC_UNCONFIGURED. Never substitutes another chain. */
export function getChainReader(chainId: number): ChainReader {
  const o = overrides.get(chainId);
  if (o) return o;
  const cached = cache.get(chainId);
  if (cached) return cached;
  const chainCfg = config().chains.get(chainId);
  if (!chainCfg || !chainCfg.rpcUrl) {
    throw new ChainReadError("RPC_UNCONFIGURED", `No RPC configured for chain ${chainId}`);
  }
  const reader = new ViemChainReader(chainId, chainCfg.rpcUrl, config().delivery.rpcTimeoutMs);
  cache.set(chainId, reader);
  return reader;
}

/** Test hook. */
export function setChainReader(chainId: number, reader: ChainReader | null) {
  if (reader) overrides.set(chainId, reader);
  else overrides.delete(chainId);
  cache.delete(chainId);
}

export function resetChainReaders() {
  overrides.clear();
  cache.clear();
}

export async function withDeadline<T>(ms: number, fn: () => Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ChainReadError("RPC_TIMEOUT", `Verification exceeded ${ms}ms budget`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
