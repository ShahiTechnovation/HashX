import http from "http";
import { createPublicClient, createTestClient, createWalletClient, http as httpTransport, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { createSiweMessage } from "viem/siwe";
import { createApp } from "../../src/app";
import { computeAddressAnalytics } from "../../../shared/protocol";
import { LOCAL_RPC_URL } from "./dbUrl";
import { KEYS } from "./accounts";

export const seller = privateKeyToAccount(KEYS.seller);
export const buyer = privateKeyToAccount(KEYS.buyer);
export const attacker = privateKeyToAccount(KEYS.attacker);
export const subject = privateKeyToAccount(KEYS.subject);
export const LOCAL_CHAIN_ID = 31337;
export const ORIGIN = "http://localhost:3000";

export const pub = createPublicClient({ chain: hardhat, transport: httpTransport(LOCAL_RPC_URL) });
export const testClient = createTestClient({ chain: hardhat, mode: "hardhat", transport: httpTransport(LOCAL_RPC_URL) });
export function walletFor(account: PrivateKeyAccount) {
  return createWalletClient({ account, chain: hardhat, transport: httpTransport(LOCAL_RPC_URL) });
}

export async function startApp() {
  const server = http.createServer(createApp());
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as any).port;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

export type Api = ReturnType<typeof apiClient>;

export function apiClient(baseUrl: string, token?: string) {
  async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = text;
    }
    return { status: res.status, body: json, headers: res.headers };
  }
  return {
    get: (p: string, h?: Record<string, string>) => call("GET", p, undefined, h),
    post: (p: string, b?: unknown, h?: Record<string, string>) => call("POST", p, b ?? {}, h),
    del: (p: string) => call("DELETE", p),
  };
}

export async function siweMessage(baseUrl: string, account: PrivateKeyAccount, overrides: Partial<Parameters<typeof createSiweMessage>[0]> = {}) {
  const nonce = (await apiClient(baseUrl).get("/auth/nonce")).body.nonce as string;
  return createSiweMessage({
    address: account.address,
    chainId: LOCAL_CHAIN_ID,
    domain: "localhost:3000",
    nonce,
    uri: ORIGIN,
    version: "1",
    statement: "Sign in to HashX",
    issuedAt: new Date(),
    expirationTime: new Date(Date.now() + 10 * 60_000),
    ...overrides,
  });
}

export async function login(baseUrl: string, account: PrivateKeyAccount): Promise<string> {
  const message = await siweMessage(baseUrl, account);
  const signature = await account.signMessage({ message });
  const res = await apiClient(baseUrl).post("/auth/verify", { message, signature });
  if (res.status !== 200) throw new Error(`login failed: ${JSON.stringify(res.body)}`);
  return res.body.token;
}

/** Signs typed data returned by the API (JSON form, bigints as strings) with a local account. */
export async function signTypedJson(account: PrivateKeyAccount, td: any): Promise<Hex> {
  return account.signTypedData({ domain: td.domain, types: td.types, primaryType: td.primaryType, message: td.message });
}

/** Creates on-chain activity for `subject` and returns the block range covering it. */
export async function createSubjectActivity(): Promise<{ start: number; end: number }> {
  const w = walletFor(subject);
  const start = Number(await pub.getBlockNumber({ cacheTime: 0 })) + 1;
  const h1 = await w.sendTransaction({ to: seller.address, value: 1_000n });
  await pub.waitForTransactionReceipt({ hash: h1 });
  const h2 = await walletFor(buyer).sendTransaction({ to: subject.address, value: 2_500n });
  await pub.waitForTransactionReceipt({ hash: h2 });
  const h3 = await w.sendTransaction({ to: attacker.address, value: 7n });
  await pub.waitForTransactionReceipt({ hash: h3 });
  const end = Number(await pub.getBlockNumber({ cacheTime: 0 }));
  await testClient.mine({ blocks: 3 }); // satisfy DELIVERY_MIN_CONFIRMATIONS
  return { start, end };
}

/** What an honest seller agent computes: the same deterministic algorithm the verifier uses. */
export async function computeArtifact(address: string, start: number, end: number) {
  const blocks = [];
  for (let b = start; b <= end; b++) {
    const blk = await pub.getBlock({ blockNumber: BigInt(b), includeTransactions: true });
    blocks.push({ number: blk.number!, transactions: blk.transactions.map((t) => ({ hash: t.hash, from: t.from, to: t.to ?? null, value: t.value })) });
  }
  return computeAddressAnalytics({ chainId: LOCAL_CHAIN_ID, address, startBlock: start, endBlock: end, blocks, maxSamples: 10 }).artifact;
}

export function invoicePayload(overrides: Record<string, any> = {}, range = { start: 1, end: 2 }) {
  return {
    client_request_id: `req-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    buyer_wallet: buyer.address,
    buyer_ref: "Buyer treasury agent / PO-7731",
    service: {
      type: "evm_address_analytics_v1",
      delivery_chain_id: LOCAL_CHAIN_ID,
      parameters: { address: subject.address, start_block: String(range.start), end_block: String(range.end) },
      acceptance_policy: "exact_recompute_v1",
    },
    payment: { rail: "sepolia-usdc", settlement_chain_id: LOCAL_CHAIN_ID, amount_raw: "2500000", payee: seller.address },
    ...overrides,
  };
}

export const TOKEN_ABI = [
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
