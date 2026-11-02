/**
 * Seller-side tooling: computes the analytics artifact for a delivery from a public RPC,
 * using the exact deterministic algorithm the HashX verifier re-runs independently.
 * Computing it here grants no trust — the backend recomputes every figure itself.
 */
import { computeAddressAnalytics, type AnalyticsArtifact, type MinimalBlock } from "@shared/protocol";
import { publicClientFor } from "./wallet";

export async function computeArtifactInBrowser(params: {
  chainId: number;
  address: string;
  startBlock: number;
  endBlock: number;
  maxBlocks?: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<AnalyticsArtifact> {
  const total = params.endBlock - params.startBlock + 1;
  if (total < 1 || total > (params.maxBlocks ?? 50)) throw new Error(`Block range of ${total} blocks is outside the supported bound`);
  const client = publicClientFor(params.chainId);
  const remote = await client.getChainId();
  if (remote !== params.chainId) throw new Error(`Public RPC reports chain ${remote}, expected ${params.chainId}`);
  const blocks: MinimalBlock[] = [];
  for (let b = params.startBlock; b <= params.endBlock; b++) {
    const blk = await client.getBlock({ blockNumber: BigInt(b), includeTransactions: true });
    blocks.push({ number: blk.number!, transactions: blk.transactions.map((t) => ({ hash: t.hash, from: t.from, to: t.to ?? null, value: t.value })) });
    params.onProgress?.(blocks.length, total);
  }
  return computeAddressAnalytics({
    chainId: params.chainId,
    address: params.address,
    startBlock: params.startBlock,
    endBlock: params.endBlock,
    blocks,
    maxSamples: 10,
  }).artifact;
}
