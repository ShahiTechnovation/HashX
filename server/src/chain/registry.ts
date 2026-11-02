import { config } from "../config.js";
import { getChainReader } from "./readers.js";
import { findNetwork } from "../../../shared/networks.js";

/** Minimal ABI of HashXEvidenceRegistry v2 used for readiness checks. */
export const EVIDENCE_REGISTRY_ABI = [
  { type: "function", name: "VERSION", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  {
    type: "function",
    name: "getEvidence",
    stateMutability: "view",
    inputs: [
      { name: "issuer", type: "address" },
      { name: "invoiceCommitment", type: "bytes32" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "deliveryCommitment", type: "bytes32" },
          { name: "receiptCommitment", type: "bytes32" },
          { name: "invoiceCommittedAt", type: "uint64" },
          { name: "deliveryCommittedAt", type: "uint64" },
          { name: "receiptCommittedAt", type: "uint64" },
        ],
      },
    ],
  },
] as const;

export interface RegistryStatus {
  chainId: number;
  network: string;
  configured: boolean;
  address: string | null;
  deployed: boolean;
  version: string | null;
  reason: string | null;
}

/**
 * A registry is reported deployed only if the configured address has contract code on the
 * expected chain AND answers VERSION() with the expected protocol version. An env var alone
 * proves nothing.
 */
export async function registryStatus(chainId: number): Promise<RegistryStatus> {
  const chainCfg = config().chains.get(chainId);
  const base = { chainId, network: findNetwork(chainId)?.name ?? String(chainId), address: chainCfg?.evidenceRegistry ?? null };
  if (!chainCfg?.evidenceRegistry) return { ...base, configured: false, deployed: false, version: null, reason: "No registry address configured" };
  try {
    const reader = getChainReader(chainId);
    const code = await reader.getCode(chainCfg.evidenceRegistry);
    if (!code || code === "0x") return { ...base, configured: true, deployed: false, version: null, reason: "No contract code at configured address" };
    const version = String(await reader.readContract({ address: chainCfg.evidenceRegistry, abi: EVIDENCE_REGISTRY_ABI, functionName: "VERSION" }));
    if (version !== "2") return { ...base, configured: true, deployed: false, version, reason: `Unexpected registry VERSION ${version}` };
    return { ...base, configured: true, deployed: true, version, reason: null };
  } catch (err) {
    return { ...base, configured: true, deployed: false, version: null, reason: (err as Error).message.slice(0, 200) };
  }
}
