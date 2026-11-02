import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import {
  ACCEPTANCE_POLICY_EXACT,
  DELIVERY_MANIFEST_SCHEMA,
  SERVICE_TYPE_ADDRESS_ANALYTICS,
  computeAddressAnalytics,
  computeArtifactSha256,
  computeInvoiceDigest,
  computeServiceTermsHash,
  manifestTypedData,
  type DeliveryManifest,
  type MinimalBlock,
} from "../../../shared/protocol";
import { verifyDeliveryV2 } from "../../src/services/verification";
import { loadConfig } from "../../src/config";
import { ChainReadError, type ChainReader } from "../../src/chain/readers";
import { invoiceTermsFromRow } from "../../src/types";
import { KEYS } from "../setup/accounts";

const seller = privateKeyToAccount(KEYS.seller);
const other = privateKeyToAccount(KEYS.attacker);
const SUBJECT = "0x00000000000000000000000000000000000000aa";
const CP = "0x00000000000000000000000000000000000000bb";
const CHAIN = 11155111;
const cfg = loadConfig({ ...process.env, DELIVERY_MAX_BLOCK_RANGE: "50", DELIVERY_MIN_CONFIRMATIONS: "6" });

function blocks(start: number, end: number): MinimalBlock[] {
  const out: MinimalBlock[] = [];
  for (let b = start; b <= end; b++) {
    out.push({
      number: BigInt(b),
      transactions:
        b % 2 === 0
          ? [
              { hash: keccak256(toBytes(`tx-${b}-a`)), from: SUBJECT, to: CP, value: 5n },
              { hash: keccak256(toBytes(`tx-${b}-b`)), from: CP, to: "0x00000000000000000000000000000000000000cc", value: 1n },
            ]
          : [{ hash: keccak256(toBytes(`tx-${b}-c`)), from: CP, to: SUBJECT, value: 9n }],
    });
  }
  return out;
}

class MockReader implements ChainReader {
  label = "chain:11155111/rpc#mock";
  constructor(
    public chainId: number,
    private opts: { tip?: bigint; fail?: ChainReadError; reportedChain?: number; data?: MinimalBlock[] } = {}
  ) {}
  calls = 0;
  async assertChainId() {
    if (this.opts.fail) throw this.opts.fail;
    if ((this.opts.reportedChain ?? this.chainId) !== this.chainId) throw new ChainReadError("RPC_CHAIN_MISMATCH", "mismatch");
  }
  async getBlockNumber() {
    return this.opts.tip ?? 1000n;
  }
  async getFinalizedBlockNumber() {
    return null;
  }
  async getBlockWithTransactions(n: bigint) {
    this.calls++;
    const b = (this.opts.data ?? blocks(100, 120)).find((x) => BigInt(x.number) === n)!;
    return { number: n, transactions: b.transactions } as any;
  }
  async getBlockHash() {
    return null;
  }
  async getTransactionReceipt() {
    return null;
  }
  async getTransaction() {
    return null;
  }
  async getCode() {
    return undefined;
  }
  async readContract() {
    return null;
  }
}

async function fixture(opts: { start?: number; end?: number; artifactMutate?: (a: any) => any; manifestMutate?: (m: DeliveryManifest) => DeliveryManifest; signer?: typeof seller; generatedAt?: number } = {}) {
  const start = opts.start ?? 100;
  const end = opts.end ?? 120;
  const now = Math.floor(Date.now() / 1000);
  const serviceParams = {
    type: SERVICE_TYPE_ADDRESS_ANALYTICS,
    delivery_chain_id: CHAIN,
    parameters: { address: SUBJECT, start_block: String(start), end_block: String(end) },
    acceptance_policy: ACCEPTANCE_POLICY_EXACT,
  };
  const invoiceRow: any = {
    id: "inv_unit",
    version: 1,
    protocol_version: 2,
    seller_wallet: seller.address,
    buyer_wallet: other.address,
    buyer_ref_hash: keccak256(toBytes("ref")),
    service_type: SERVICE_TYPE_ADDRESS_ANALYTICS,
    service_params: serviceParams,
    service_terms_hash: computeServiceTermsHash({ serviceType: SERVICE_TYPE_ADDRESS_ANALYTICS, deliveryChainId: CHAIN, subjectAddress: SUBJECT as any, startBlock: start, endBlock: end, acceptancePolicy: ACCEPTANCE_POLICY_EXACT }),
    delivery_chain_id: CHAIN,
    settlement_rail: "sepolia-usdc",
    settlement_chain_id: CHAIN,
    signing_chain_id: CHAIN,
    token_address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    amount_raw: "1000000",
    payee: seller.address,
    nonce: keccak256(toBytes("nonce")),
    issued_at: new Date((now - 3600) * 1000),
    expires_at: new Date((now + 3600) * 1000),
  };
  invoiceRow.digest = computeInvoiceDigest(invoiceTermsFromRow(invoiceRow));
  const honest = computeAddressAnalytics({ chainId: CHAIN, address: SUBJECT, startBlock: start, endBlock: end, blocks: blocks(start, end), maxSamples: 10 }).artifact;
  const artifact = opts.artifactMutate ? opts.artifactMutate(structuredClone(honest)) : honest;
  let manifest: DeliveryManifest = {
    schema: DELIVERY_MANIFEST_SCHEMA,
    invoiceId: invoiceRow.id,
    invoiceDigest: invoiceRow.digest,
    seller: seller.address,
    deliveryVersion: 1,
    deliveryChainId: CHAIN,
    serviceTermsHash: invoiceRow.service_terms_hash,
    artifactSha256: computeArtifactSha256(honest),
    artifactUri: "ipfs://a",
    generatedAt: opts.generatedAt ?? now - 60,
  };
  if (opts.manifestMutate) manifest = opts.manifestMutate(manifest);
  const td = manifestTypedData(manifest, CHAIN);
  const signature = await (opts.signer ?? seller).signTypedData(td as any);
  const deliveryRow = { id: "del_unit", version: 1, artifact_uri: "ipfs://a", artifact_content: artifact, manifest, manifest_signature: signature, submitted_at: new Date() };
  return { invoiceRow, deliveryRow };
}

const run = (f: Awaited<ReturnType<typeof fixture>>, reader: ChainReader | null, readerError?: ChainReadError) =>
  verifyDeliveryV2({ invoiceRow: f.invoiceRow, deliveryRow: f.deliveryRow, reader, readerError, cfg });

describe("delivery verification is fail-closed", () => {
  it("PASSes only when every fact is recomputed from RPC and matches", async () => {
    const r = await run(await fixture(), new MockReader(CHAIN));
    expect(r.decision, JSON.stringify(r.checkDetails)).toBe("PASS");
    expect(r.payable).toBe(true);
    expect(r.evidenceSources.find((s) => s.type === "rpc")?.blocksScanned).toBe(21);
  });

  it("RPC unavailable → PENDING, never PASS (no fallback to seller claims)", async () => {
    const r = await run(await fixture(), new MockReader(CHAIN, { fail: new ChainReadError("RPC_UNAVAILABLE", "down") }));
    expect(r.decision).toBe("PENDING");
    expect(r.payable).toBe(false);
    expect(r.reasonCodes).toContain("RPC_UNAVAILABLE");
  });

  it("no RPC configured → PENDING", async () => {
    const r = await run(await fixture(), null, new ChainReadError("RPC_UNCONFIGURED", "none"));
    expect(r.decision).toBe("PENDING");
    expect(r.reasonCodes).toContain("RPC_UNCONFIGURED");
  });

  it("RPC reporting the wrong chain ID → PENDING", async () => {
    const r = await run(await fixture(), new MockReader(CHAIN, { reportedChain: 1 }));
    expect(r.decision).toBe("PENDING");
    expect(r.reasonCodes).toContain("RPC_CHAIN_MISMATCH");
  });

  it("unconfirmed end block → PENDING", async () => {
    const r = await run(await fixture(), new MockReader(CHAIN, { tip: 122n }));
    expect(r.decision).toBe("PENDING");
    expect(r.reasonCodes).toContain("BLOCK_NOT_CONFIRMED");
  });

  it("an unbounded block range is refused without scanning (FAIL, never PASS)", async () => {
    const reader = new MockReader(CHAIN, { data: blocks(100, 300) });
    const r = await run(await fixture({ start: 100, end: 300 }), reader);
    expect(r.decision).toBe("FAIL");
    expect(r.reasonCodes).toContain("RANGE_UNSUPPORTED");
    expect(reader.calls).toBe(0);
  });

  it("inflated transaction count → FAIL (TX_COUNT_MISMATCH) even with a valid signature", async () => {
    // The seller honestly signs an inflated artifact: signature valid, facts false.
    const f = await fixture({ artifactMutate: (a) => ({ ...a, transaction_count: a.transaction_count + 3 }), manifestMutate: (m) => m });
    f.deliveryRow.manifest = { ...f.deliveryRow.manifest, artifactSha256: computeArtifactSha256(f.deliveryRow.artifact_content) };
    f.deliveryRow.manifest_signature = await seller.signTypedData(manifestTypedData(f.deliveryRow.manifest, CHAIN) as any);
    const r = await run(f, new MockReader(CHAIN));
    expect(r.decision).toBe("FAIL");
    expect(r.reasonCodes).toContain("TX_COUNT_MISMATCH");
  });

  it("modified artifact bytes → FAIL (ARTIFACT_TAMPERED)", async () => {
    const r = await run(await fixture({ artifactMutate: (a) => ({ ...a, native_value_in_raw: "1" }) }), new MockReader(CHAIN));
    expect(r.decision).toBe("FAIL");
    expect(r.reasonCodes).toContain("ARTIFACT_TAMPERED");
  });

  it("forged manifest signature → FAIL", async () => {
    const r = await run(await fixture({ signer: other }), new MockReader(CHAIN));
    expect(r.decision).toBe("FAIL");
    expect(r.reasonCodes).toContain("MANIFEST_SIGNATURE_INVALID");
  });

  it("evidence bound to a different invoice (cross-invoice reuse) → FAIL", async () => {
    const r = await run(await fixture({ manifestMutate: (m) => ({ ...m, invoiceId: "inv_other", invoiceDigest: keccak256(toBytes("other")) }) }), new MockReader(CHAIN));
    expect(r.decision).toBe("FAIL");
    expect(r.reasonCodes).toContain("EVIDENCE_BINDING_MISMATCH");
  });

  it("wrong source chain → FAIL (CHAIN_MISMATCH)", async () => {
    const r = await run(await fixture({ artifactMutate: (a) => ({ ...a, chain_id: 133 }) }), new MockReader(CHAIN));
    expect(r.reasonCodes).toContain("CHAIN_MISMATCH");
    expect(r.decision).toBe("FAIL");
  });

  it("wrong subject address and block range → FAIL", async () => {
    const r = await run(await fixture({ artifactMutate: (a) => ({ ...a, address: CP, start_block: 101 }) }), new MockReader(CHAIN));
    expect(r.reasonCodes).toEqual(expect.arrayContaining(["SUBJECT_MISMATCH", "BLOCK_RANGE_MISMATCH"]));
  });

  it("fabricated sample transaction → FAIL (EVIDENCE_INVALID)", async () => {
    const f = await fixture({ artifactMutate: (a) => ({ ...a, sample_transactions: [{ hash: keccak256(toBytes("fake")), block_number: 105 }] }) });
    f.deliveryRow.manifest = { ...f.deliveryRow.manifest, artifactSha256: computeArtifactSha256(f.deliveryRow.artifact_content) };
    f.deliveryRow.manifest_signature = await seller.signTypedData(manifestTypedData(f.deliveryRow.manifest, CHAIN) as any);
    const r = await run(f, new MockReader(CHAIN));
    expect(r.reasonCodes).toContain("EVIDENCE_INVALID");
  });

  it("stale evidence generated before the invoice was issued → FAIL (DELIVERY_STALE)", async () => {
    const r = await run(await fixture({ generatedAt: Math.floor(Date.now() / 1000) - 86400 }), new MockReader(CHAIN));
    expect(r.reasonCodes).toContain("DELIVERY_STALE");
    expect(r.decision).toBe("FAIL");
  });

  it("overall deadline exceeded → PENDING", async () => {
    const slow = new MockReader(CHAIN);
    slow.getBlockWithTransactions = () => new Promise(() => undefined) as any;
    const r = await verifyDeliveryV2({ ...(await fixture()), reader: slow, cfg: { ...cfg, delivery: { ...cfg.delivery, totalTimeoutMs: 200 } } } as any);
    expect(r.decision).toBe("PENDING");
    expect(r.reasonCodes).toContain("RPC_TIMEOUT" as any);
  });
});
