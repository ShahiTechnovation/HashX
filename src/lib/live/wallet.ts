/**
 * EIP-1193 wallet helpers. All signing and broadcasting happens in the user's own
 * wallet; HashX never receives or stores private keys.
 */
import { createPublicClient, createWalletClient, custom, http, type Hex } from "viem";
import { createSiweMessage } from "viem/siwe";
import { findNetwork, getNetwork, walletAddChainParams } from "@shared/networks";
import type { TransferInstructions, TypedDataJson } from "./types";

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown>; on?: (...a: any[]) => void; removeListener?: (...a: any[]) => void };

export function getEthereum(): Eip1193 | null {
  if (typeof window === "undefined") return null;
  return ((window as any).ethereum as Eip1193) ?? null;
}

function requireEthereum(): Eip1193 {
  const eth = getEthereum();
  if (!eth) throw new Error("No EIP-1193 wallet detected. Install MetaMask or another browser wallet.");
  return eth;
}

export async function currentChainId(): Promise<number> {
  return parseInt((await requireEthereum().request({ method: "eth_chainId" })) as string, 16);
}

/** Switches (or adds then switches) the wallet to a supported chain. Unknown chains are rejected. */
export async function switchWalletChain(chainId: number): Promise<void> {
  const net = getNetwork(chainId);
  const eth = requireEthereum();
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: `0x${chainId.toString(16)}` }] });
  } catch (err: any) {
    if (err?.code === 4902 || /Unrecognized chain/i.test(err?.message ?? "")) {
      await eth.request({ method: "wallet_addEthereumChain", params: [walletAddChainParams(net)] });
      return;
    }
    throw err;
  }
}

export async function ensureChain(chainId: number) {
  if ((await currentChainId()) !== chainId) await switchWalletChain(chainId);
  if ((await currentChainId()) !== chainId) throw new Error(`Wallet is not on ${findNetwork(chainId)?.name ?? chainId}`);
}

function walletClient(account: Hex) {
  return createWalletClient({ account, transport: custom(requireEthereum()) });
}

/** Signs typed data received from the API (JSON form; numeric strings are accepted by viem). */
export async function signTypedDataJson(account: Hex, td: TypedDataJson): Promise<Hex> {
  const chainId = Number(td.domain.chainId);
  await ensureChain(chainId);
  const { EIP712Domain: _ignored, ...types } = td.types as Record<string, Array<{ name: string; type: string }>>;
  return walletClient(account).signTypedData({
    account,
    domain: { ...td.domain, chainId },
    types,
    primaryType: td.primaryType,
    message: td.message as Record<string, unknown>,
  } as any);
}

export async function signSiwe(account: Hex, nonce: string, chainId: number): Promise<{ message: string; signature: Hex }> {
  const message = createSiweMessage({
    address: account,
    chainId,
    domain: window.location.host,
    uri: window.location.origin,
    nonce,
    version: "1",
    statement: "Sign in to HashX. This proves wallet ownership; it does not authorize any payment.",
    issuedAt: new Date(),
    expirationTime: new Date(Date.now() + 10 * 60_000),
  });
  const signature = (await requireEthereum().request({ method: "personal_sign", params: [message, account] })) as Hex;
  return { message, signature };
}

/** Broadcasts the exact ERC-20 transfer authorized in Stage 2 from the payer's wallet. */
export async function sendAuthorizedTransfer(account: Hex, ins: TransferInstructions): Promise<Hex> {
  await ensureChain(ins.chainId);
  return walletClient(account).sendTransaction({
    account,
    chain: null,
    to: ins.to,
    data: ins.data,
    value: BigInt(ins.value),
  } as any);
}

/** Read-only client for a supported chain using its public RPC (browser-side seller tooling). */
export function publicClientFor(chainId: number) {
  return createPublicClient({ transport: http(getNetwork(chainId).publicRpcUrl, { timeout: 15_000 }) });
}

const PENDING_TX_KEY = (attemptId: string) => `hashx:pending-tx:${attemptId}`;

/** Persists a broadcast tx hash locally before reporting it, so a refresh never loses it. */
export function rememberPendingTx(attemptId: string, txHash: Hex) {
  try {
    localStorage.setItem(PENDING_TX_KEY(attemptId), txHash);
  } catch {
    /* storage unavailable */
  }
}

export function recallPendingTx(attemptId: string): Hex | null {
  try {
    return (localStorage.getItem(PENDING_TX_KEY(attemptId)) as Hex | null) ?? null;
  } catch {
    return null;
  }
}

export function forgetPendingTx(attemptId: string) {
  try {
    localStorage.removeItem(PENDING_TX_KEY(attemptId));
  } catch {
    /* storage unavailable */
  }
}
