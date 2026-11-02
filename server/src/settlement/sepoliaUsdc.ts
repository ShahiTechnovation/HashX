/**
 * SepoliaUSDCSettlementAdapter — direct ERC-20 transfer of Circle's official test USDC on
 * Ethereum Sepolia (11155111). The same adapter is bound to a local Hardhat chain (31337)
 * with a test token for deterministic CI.
 *
 * The buyer's own EIP-1193 wallet broadcasts `transfer(payee, amount)`. HashX never holds
 * keys or funds; it independently verifies the outcome from the configured RPC:
 *   chain ID → receipt status → token contract → Transfer(from=payer, to=payee, value=amount)
 *   → canonical block hash (reorg check) → confirmation / finality policy.
 */
import { decodeEventLog, encodeFunctionData, type TransactionReceipt } from "viem";
import { ERC20_ABI, ERC20_TRANSFER_TOPIC, sameAddress } from "../../../shared/protocol.js";
import type { ChainRuntimeConfig, FinalityPolicy } from "../config.js";
import type { ChainReader } from "../chain/readers.js";

type Hex = `0x${string}`;

export interface TransferExpectation {
  chainId: number;
  token: Hex;
  payer: Hex;
  payee: Hex;
  amount: bigint;
  txHash: Hex;
  submittedAt: Date;
}

export type ReconcileOutcome =
  | { kind: "pending"; reason: string }
  | { kind: "dropped"; reason: string }
  | { kind: "failed"; code: "REVERTED" | "TRANSFER_MISMATCH" | "SENDER_MISMATCH" | "WRONG_CONTRACT"; detail: string }
  | {
      kind: "included";
      blockNumber: bigint;
      blockHash: Hex;
      logIndex: number;
      confirmations: number;
      policySatisfied: boolean;
      finalized: boolean;
    };

export function transferCalldata(payee: Hex, amount: bigint): Hex {
  return encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [payee, amount] });
}

export function transferInstructions(chainId: number, token: Hex, payee: Hex, amount: bigint) {
  return {
    chainId,
    to: token,
    value: "0",
    data: transferCalldata(payee, amount),
    method: "transfer(address,uint256)",
    args: { to: payee, amount: amount.toString() },
  };
}

/** Finds the unique Transfer log that satisfies the obligation. */
export function findMatchingTransfer(receipt: TransactionReceipt, exp: TransferExpectation) {
  const observed: string[] = [];
  for (const log of receipt.logs) {
    if (log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) continue;
    let decoded: { from: Hex; to: Hex; value: bigint };
    try {
      const ev = decodeEventLog({ abi: ERC20_ABI, data: log.data, topics: log.topics as [Hex, ...Hex[]] });
      if (ev.eventName !== "Transfer") continue;
      decoded = ev.args as unknown as { from: Hex; to: Hex; value: bigint };
    } catch {
      continue;
    }
    observed.push(`${log.address}:${decoded.from}->${decoded.to}:${decoded.value}`);
    if (!sameAddress(log.address, exp.token)) continue;
    if (sameAddress(decoded.from, exp.payer) && sameAddress(decoded.to, exp.payee) && decoded.value === exp.amount) {
      return { logIndex: Number(log.logIndex), observed };
    }
  }
  return { logIndex: null, observed };
}

function confirmationsRequired(policy: FinalityPolicy): number {
  return policy.kind === "confirmations" ? policy.confirmations : 0;
}

export async function reconcileTransfer(
  reader: ChainReader,
  exp: TransferExpectation,
  chainCfg: ChainRuntimeConfig,
  dropTimeoutSeconds: number,
  now: Date = new Date()
): Promise<ReconcileOutcome> {
  await reader.assertChainId();
  const receipt = await reader.getTransactionReceipt(exp.txHash);

  if (!receipt) {
    const tx = await reader.getTransaction(exp.txHash);
    if (tx) {
      if (!sameAddress(tx.from, exp.payer)) {
        return { kind: "failed", code: "SENDER_MISMATCH", detail: `Transaction sender ${tx.from} is not the authorized payer ${exp.payer}` };
      }
      if (!tx.to || !sameAddress(tx.to, exp.token)) {
        return { kind: "failed", code: "WRONG_CONTRACT", detail: `Transaction targets ${tx.to ?? "contract creation"}, not ${exp.token}` };
      }
      return { kind: "pending", reason: "Transaction is known to the RPC but not yet included in a block" };
    }
    const ageSeconds = (now.getTime() - exp.submittedAt.getTime()) / 1000;
    if (ageSeconds > dropTimeoutSeconds) {
      return { kind: "dropped", reason: `Transaction not found after ${Math.floor(ageSeconds)}s` };
    }
    return { kind: "pending", reason: "Transaction not yet visible to the RPC" };
  }

  if (receipt.status !== "success") {
    return { kind: "failed", code: "REVERTED", detail: `Transaction reverted in block ${receipt.blockNumber}` };
  }
  if (!receipt.to || !sameAddress(receipt.to, exp.token)) {
    return { kind: "failed", code: "WRONG_CONTRACT", detail: `Transaction called ${receipt.to ?? "contract creation"}, not the settlement token ${exp.token}` };
  }

  const match = findMatchingTransfer(receipt, exp);
  if (match.logIndex === null) {
    return {
      kind: "failed",
      code: "TRANSFER_MISMATCH",
      detail: `No Transfer(${exp.payer} -> ${exp.payee}, ${exp.amount}) log from ${exp.token}. Observed: ${match.observed.join("; ") || "none"}`,
    };
  }

  // Reorg protection: the receipt's block must still be canonical at its height.
  const canonicalHash = await reader.getBlockHash(receipt.blockNumber);
  if (!canonicalHash || canonicalHash.toLowerCase() !== receipt.blockHash.toLowerCase()) {
    return { kind: "pending", reason: "Receipt block is no longer canonical (reorganization); awaiting re-inclusion" };
  }

  const tip = await reader.getBlockNumber();
  const confirmations = tip >= receipt.blockNumber ? Number(tip - receipt.blockNumber + 1n) : 0;
  const finalizedNumber = await reader.getFinalizedBlockNumber();
  const finalized = finalizedNumber !== null && finalizedNumber >= receipt.blockNumber;
  const policySatisfied =
    chainCfg.finality.kind === "finalized" ? finalized : confirmations >= confirmationsRequired(chainCfg.finality);

  return {
    kind: "included",
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
    logIndex: match.logIndex,
    confirmations,
    policySatisfied,
    finalized,
  };
}

/** Validates that the configured settlement token is a live contract with the expected decimals and symbol. */
export async function validateSettlementToken(reader: ChainReader, chainCfg: ChainRuntimeConfig) {
  const token = chainCfg.settlementToken;
  if (!token) return { ok: false, reason: "No settlement token configured" };
  const code = await reader.getCode(token.address);
  if (!code || code === "0x") return { ok: false, reason: "No contract code at settlement token address" };
  const decimals = Number(await reader.readContract({ address: token.address, abi: ERC20_ABI, functionName: "decimals" }));
  const symbol = String(await reader.readContract({ address: token.address, abi: ERC20_ABI, functionName: "symbol" }));
  if (decimals !== token.decimals) return { ok: false, reason: `On-chain decimals ${decimals} != configured ${token.decimals}` };
  if (symbol !== token.symbol) return { ok: false, reason: `On-chain symbol ${symbol} != configured ${token.symbol}` };
  return { ok: true, decimals, symbol };
}
