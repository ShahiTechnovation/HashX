/**
 * HashX fail-closed verification engine (protocol v2).
 *
 * Invariants:
 *  - PASS is only produced when every check independently passes.
 *  - RPC unavailability, chain-ID mismatch, timeouts or unconfirmed blocks yield PENDING, never PASS.
 *  - Seller-provided figures are never used as the reference value; they are compared against
 *    facts recomputed from the configured RPC.
 *  - Workloads are bounded (block range cap, concurrency, overall deadline).
 */
import { z } from "zod";
import { getAddress, isAddress, keccak256, toBytes } from "viem";
import {
  ANALYTICS_ARTIFACT_SCHEMA,
  DELIVERY_MANIFEST_SCHEMA,
  computeAddressAnalytics,
  computeArtifactSha256,
  computeInvoiceDigest,
  computeManifestDigest,
  computeServiceTermsHash,
  recoverInvoiceSigner,
  recoverManifestSigner,
  sameAddress,
  type DeliveryManifest,
  type InvoiceTerms,
  type MinimalBlock,
} from "../../../shared/protocol.js";
import { findNetwork, railSupportsChain } from "../../../shared/networks.js";
import type { AppConfig } from "../config.js";
import { ChainReadError, withDeadline, type ChainReader } from "../chain/readers.js";
import { invoiceTermsFromRow } from "../types.js";
import type {
  Address,
  CheckDetail,
  CheckStatus,
  EvidenceSource,
  Hash,
  VerificationReasonCode,
  VerificationResult,
} from "../types.js";

export const INVOICE_VERIFIER_VERSION = "hashx.verifier.invoice.v2.0.0";
export const DELIVERY_VERIFIER_VERSION = "hashx.verifier.analytics.v2.0.0";
const CLOCK_SKEW_SECONDS = 120;

class CheckSet {
  checks: Record<string, CheckStatus> = {};
  details: Record<string, CheckDetail> = {};
  reasons: VerificationReasonCode[] = [];

  set(key: string, status: CheckStatus, rule: string, explanation: string, extra: Partial<CheckDetail> = {}) {
    this.checks[key] = status;
    this.details[key] = { status, rule, explanation, ...extra };
    if (extra.failureCode && (status === "FAIL" || status === "PENDING") && !this.reasons.includes(extra.failureCode)) {
      this.reasons.push(extra.failureCode);
    }
  }

  decision(): "PASS" | "FAIL" | "PENDING" {
    const values = Object.values(this.checks);
    if (values.includes("FAIL")) return "FAIL";
    if (values.some((v) => v === "PENDING" || v === "SKIPPED")) return "PENDING";
    return values.length > 0 ? "PASS" : "PENDING";
  }
}

// ---------------------------------------------------------------------------
// Invoice verification
// ---------------------------------------------------------------------------

export interface InvoiceVerificationContext {
  row: any;
  sellerCounterparty: { status: string; wallet_verified_at: Date | null } | null;
  nonceReusedBy: string[];
  cfg: AppConfig;
  now?: number;
}

export async function verifyInvoiceV2(ctx: InvoiceVerificationContext): Promise<VerificationResult> {
  const { row, cfg } = ctx;
  const now = Math.floor((ctx.now ?? Date.now()) / 1000);
  const c = new CheckSet();

  if (row.protocol_version < 2) {
    c.set("schema", "FAIL", "Protocol v2 invoice", "Legacy v1 invoices cannot be verified for payment.", {
      failureCode: "LEGACY_PROTOCOL",
    });
    return finishInvoice(c, row, keccak256(toBytes(`legacy:${row.id}`)));
  }

  let terms: InvoiceTerms | null = null;
  try {
    terms = invoiceTermsFromRow(row);
    if (!isAddress(terms.seller) || !isAddress(terms.buyer) || !isAddress(terms.payee) || !isAddress(terms.token)) {
      throw new Error("address field invalid");
    }
    if (BigInt(terms.amount) <= 0n) throw new Error("amount must be positive");
    c.set("schema", "PASS", "Protocol v2 invoice schema", "All signed fields are present and well-formed.");
  } catch (err) {
    c.set("schema", "FAIL", "Protocol v2 invoice schema", `Malformed invoice terms: ${(err as Error).message}`, {
      failureCode: "SCHEMA_INVALID",
    });
    return finishInvoice(c, row, keccak256(toBytes(`malformed:${row.id}`)));
  }

  // Terms consistency: recompute both digests from stored fields; detects storage-level tampering.
  const service = row.service_params ?? {};
  let expectedTermsHash: Hash | null = null;
  try {
    expectedTermsHash = computeServiceTermsHash({
      serviceType: row.service_type,
      deliveryChainId: terms.deliveryChainId,
      subjectAddress: service.parameters?.address,
      startBlock: service.parameters?.start_block,
      endBlock: service.parameters?.end_block,
      acceptancePolicy: service.acceptance_policy,
    });
  } catch {
    expectedTermsHash = null;
  }
  const recomputedDigest = computeInvoiceDigest(terms);
  if (expectedTermsHash !== row.service_terms_hash || recomputedDigest !== row.digest) {
    c.set("terms_consistent", "FAIL", "Commercial terms match committed digests", "Stored terms do not reproduce the committed hashes.", {
      failureCode: "TERMS_MUTATED",
      expected: `${row.service_terms_hash} / ${row.digest}`,
      actual: `${expectedTermsHash ?? "uncomputable"} / ${recomputedDigest}`,
    });
  } else {
    c.set("terms_consistent", "PASS", "Commercial terms match committed digests", "Service terms hash and EIP-712 digest recompute exactly.");
  }

  // Signature
  let recovered: Address | null = null;
  if (!row.signature) {
    c.set("signature", "PENDING", "EIP-712 seller signature", "Invoice has not been signed by the seller wallet.", {
      failureCode: "SIGNATURE_MISSING",
    });
  } else {
    recovered = await recoverInvoiceSigner(terms, row.signature);
    if (!sameAddress(recovered, terms.seller)) {
      c.set("signature", "FAIL", "EIP-712 seller signature", "Signature does not recover to the seller wallet over the canonical terms.", {
        failureCode: "SIGNATURE_INVALID",
        expected: terms.seller,
        actual: recovered ?? "unrecoverable",
      });
    } else {
      c.set("signature", "PASS", "EIP-712 seller signature", `Recovered signer ${recovered} equals the seller wallet.`);
    }
  }

  // Identity binding: the seller wallet must have proven control via SIWE and be ACTIVE.
  const cp = ctx.sellerCounterparty;
  if (!cp || cp.status !== "ACTIVE" || !cp.wallet_verified_at) {
    c.set("identity_binding", "FAIL", "Seller wallet bound to an active, wallet-verified account", "Seller wallet has no active SIWE-verified account.", {
      failureCode: "SELLER_UNBOUND",
      actual: cp ? `status=${cp.status}, verified=${Boolean(cp.wallet_verified_at)}` : "no account",
    });
  } else {
    c.set("identity_binding", "PASS", "Seller wallet bound to an active, wallet-verified account", "Seller proved wallet control via SIWE.");
  }

  // Expiry
  if (now > terms.expiresAt) {
    c.set("expiry", "FAIL", "Invoice within validity window", `Invoice expired at ${new Date(terms.expiresAt * 1000).toISOString()}.`, {
      failureCode: "INVOICE_EXPIRED",
    });
  } else if (terms.issuedAt > now + CLOCK_SKEW_SECONDS) {
    c.set("expiry", "FAIL", "Invoice within validity window", "issuedAt is in the future.", { failureCode: "SCHEMA_INVALID" });
  } else {
    c.set("expiry", "PASS", "Invoice within validity window", "Current time is within [issuedAt, expiresAt].");
  }

  // Replay: nonce and digest are unique per seller (also enforced by DB constraints).
  if (ctx.nonceReusedBy.length > 0) {
    c.set("nonce_unused", "FAIL", "Replay protection: seller nonce unique", `Nonce reused by ${ctx.nonceReusedBy.join(", ")}.`, {
      failureCode: "REPLAY_NONCE_REUSED",
    });
  } else {
    c.set("nonce_unused", "PASS", "Replay protection: seller nonce unique", "No other invoice by this seller uses this nonce.");
  }

  // Settlement terms: rail/chain/token must be exactly the configured settlement asset.
  const settlementProblems: string[] = [];
  const net = findNetwork(terms.settlementChainId);
  if (!net) settlementProblems.push(`unsupported settlement chain ${terms.settlementChainId}`);
  if (!railSupportsChain(terms.settlementRail as any, terms.settlementChainId)) {
    settlementProblems.push(`rail ${terms.settlementRail} cannot settle on chain ${terms.settlementChainId}`);
  }
  if (terms.settlementRail === "sepolia-usdc") {
    const token = cfg.chains.get(terms.settlementChainId)?.settlementToken;
    if (!token || !sameAddress(token.address, terms.token)) {
      settlementProblems.push(`token ${terms.token} is not the configured settlement token`);
    }
  }
  if (sameAddress(terms.seller, terms.buyer)) settlementProblems.push("seller and buyer are the same wallet");
  if (/^0x0{40}$/i.test(terms.payee)) settlementProblems.push("payee is the zero address");
  if (terms.signingChainId !== terms.settlementChainId) settlementProblems.push("signing chain differs from settlement chain");
  if (settlementProblems.length) {
    c.set("settlement_terms", "FAIL", "Settlement rail, chain and token are supported", settlementProblems.join("; "), {
      failureCode: "SETTLEMENT_TERMS_INVALID",
    });
  } else {
    c.set("settlement_terms", "PASS", "Settlement rail, chain and token are supported", `${terms.settlementRail} on chain ${terms.settlementChainId}.`);
  }

  const inputDigest = keccak256(toBytes(`${row.digest}:${row.signature ?? "unsigned"}`));
  const result = finishInvoice(c, row, inputDigest);
  result.signerRecovered = recovered ?? undefined;
  return result;
}

function finishInvoice(c: CheckSet, row: any, inputDigest: Hash): VerificationResult {
  const decision = c.decision();
  return {
    objectType: "INVOICE",
    objectId: row.id,
    decision,
    payable: decision === "PASS",
    checks: c.checks,
    checkDetails: c.details,
    reasonCodes: c.reasons,
    verifierVersion: INVOICE_VERIFIER_VERSION,
    verifiedAt: new Date().toISOString(),
    inputDigest,
    evidenceDigest: row.digest,
    evidenceSources: [{ type: "signature", description: "EIP-712 HashXInvoice v2 recovered from stored canonical terms" }],
  };
}

// ---------------------------------------------------------------------------
// Delivery verification
// ---------------------------------------------------------------------------

const hexAddressLower = z.string().regex(/^0x[0-9a-f]{40}$/, "must be a lowercase hex address");
const hexHashLower = z.string().regex(/^0x[0-9a-f]{64}$/, "must be a lowercase 32-byte hash");
const decimalString = z.string().regex(/^(0|[1-9]\d*)$/, "must be a non-negative integer string");

export const AnalyticsArtifactSchema = z
  .object({
    schema: z.literal(ANALYTICS_ARTIFACT_SCHEMA),
    chain_id: z.number().int().positive(),
    address: hexAddressLower,
    start_block: z.number().int().nonnegative(),
    end_block: z.number().int().nonnegative(),
    transaction_count: z.number().int().nonnegative(),
    native_value_in_raw: decimalString,
    native_value_out_raw: decimalString,
    counterparties: z.array(z.object({ address: hexAddressLower, tx_count: z.number().int().positive() }).strict()).max(10000),
    sample_transactions: z.array(z.object({ hash: hexHashLower, block_number: z.number().int().nonnegative() }).strict()).max(100),
  })
  .strict();

export interface DeliveryVerificationContext {
  invoiceRow: any;
  deliveryRow: any;
  reader: ChainReader | null;
  readerError?: ChainReadError;
  cfg: AppConfig;
  now?: number;
}

async function fetchBlocks(reader: ChainReader, start: number, end: number, concurrency: number): Promise<MinimalBlock[]> {
  const numbers: number[] = [];
  for (let b = start; b <= end; b++) numbers.push(b);
  const out: MinimalBlock[] = new Array(numbers.length);
  let next = 0;
  async function worker() {
    while (next < numbers.length) {
      const i = next++;
      const blk = await reader.getBlockWithTransactions(BigInt(numbers[i]));
      if (blk.number === null || Number(blk.number) !== numbers[i]) {
        throw new ChainReadError("RPC_UNAVAILABLE", `RPC returned wrong block for ${numbers[i]}`);
      }
      out[i] = {
        number: blk.number,
        transactions: blk.transactions.map((tx) => ({ hash: tx.hash, from: tx.from, to: tx.to ?? null, value: tx.value })),
      };
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, numbers.length) }, worker));
  return out;
}

export async function verifyDeliveryV2(ctx: DeliveryVerificationContext): Promise<VerificationResult> {
  const { invoiceRow, deliveryRow, cfg } = ctx;
  const now = Math.floor((ctx.now ?? Date.now()) / 1000);
  const c = new CheckSet();
  const sources: EvidenceSource[] = [];
  const terms = invoiceTermsFromRow(invoiceRow);
  const service = invoiceRow.service_params;
  const manifest = deliveryRow.manifest as DeliveryManifest;
  let manifestDigest: Hash | null = null;

  // 1. Manifest structure & signature
  let manifestWellFormed = true;
  try {
    manifestDigest = computeManifestDigest(manifest, terms.signingChainId);
  } catch {
    manifestWellFormed = false;
  }
  if (!manifestWellFormed || manifest?.schema !== DELIVERY_MANIFEST_SCHEMA) {
    c.set("manifest_signature", "FAIL", "Seller-signed EIP-712 delivery manifest", "Manifest is malformed or uses an unknown schema.", {
      failureCode: "DELIVERY_SCHEMA_INVALID",
    });
  } else {
    const signer = await recoverManifestSigner(manifest, terms.signingChainId, deliveryRow.manifest_signature);
    if (!sameAddress(signer, terms.seller)) {
      c.set("manifest_signature", "FAIL", "Seller-signed EIP-712 delivery manifest", "Manifest signature does not recover to the invoice seller.", {
        failureCode: "MANIFEST_SIGNATURE_INVALID",
        expected: terms.seller,
        actual: signer ?? "unrecoverable",
      });
    } else {
      c.set("manifest_signature", "PASS", "Seller-signed EIP-712 delivery manifest", `Recovered ${signer}.`);
      sources.push({ type: "signature", description: `Manifest signed by ${signer}` });
    }
  }

  // 2. Manifest binding to this invoice/version/chain/terms
  const bindingProblems: string[] = [];
  if (manifestWellFormed) {
    if (manifest.invoiceId !== terms.invoiceId) bindingProblems.push("invoiceId");
    if (manifest.invoiceDigest !== invoiceRow.digest) bindingProblems.push("invoiceDigest");
    if (!sameAddress(manifest.seller, terms.seller)) bindingProblems.push("seller");
    if (manifest.deliveryVersion !== deliveryRow.version) bindingProblems.push("deliveryVersion");
    if (manifest.serviceTermsHash !== invoiceRow.service_terms_hash) bindingProblems.push("serviceTermsHash");
    if (manifest.artifactUri !== deliveryRow.artifact_uri) bindingProblems.push("artifactUri");
  } else {
    bindingProblems.push("manifest");
  }
  const chainBound = manifestWellFormed && manifest.deliveryChainId === terms.deliveryChainId;
  if (bindingProblems.length || !chainBound) {
    c.set("manifest_binding", "FAIL", "Manifest bound to this invoice, version, chain and terms", `Mismatched: ${[...bindingProblems, ...(chainBound ? [] : ["deliveryChainId"])].join(", ")}.`, {
      failureCode: chainBound ? "EVIDENCE_BINDING_MISMATCH" : "CHAIN_MISMATCH",
    });
  } else {
    c.set("manifest_binding", "PASS", "Manifest bound to this invoice, version, chain and terms", "All binding fields match.");
  }

  // 3. Artifact integrity: recompute SHA-256 from the stored artifact bytes.
  let computedSha: Hash | null = null;
  try {
    computedSha = computeArtifactSha256(deliveryRow.artifact_content);
  } catch {
    computedSha = null;
  }
  if (!computedSha || !manifestWellFormed || computedSha !== manifest.artifactSha256) {
    c.set("artifact_hash", "FAIL", "SHA-256 of canonical artifact equals signed commitment", "Artifact bytes do not match the manifest commitment.", {
      failureCode: "ARTIFACT_TAMPERED",
      expected: manifestWellFormed ? manifest.artifactSha256 : "valid manifest",
      actual: computedSha ?? "uncanonicalizable",
    });
  } else {
    c.set("artifact_hash", "PASS", "SHA-256 of canonical artifact equals signed commitment", computedSha);
    sources.push({ type: "artifact", description: `canonical JSON sha256 ${computedSha}` });
  }

  // 4. Artifact schema & subject/range binding
  const parsed = AnalyticsArtifactSchema.safeParse(deliveryRow.artifact_content);
  const start = Number(service?.parameters?.start_block);
  const end = Number(service?.parameters?.end_block);
  const subject = String(service?.parameters?.address ?? "").toLowerCase();
  if (!parsed.success) {
    c.set("schema", "FAIL", `${ANALYTICS_ARTIFACT_SCHEMA} schema`, parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 500), {
      failureCode: "DELIVERY_SCHEMA_INVALID",
    });
  } else {
    c.set("schema", "PASS", `${ANALYTICS_ARTIFACT_SCHEMA} schema`, "Artifact conforms to the strict schema.");
  }
  const art = parsed.success ? parsed.data : null;
  if (art) {
    if (art.address !== subject) {
      c.set("requested_address", "FAIL", "Subject address matches invoice", "Artifact reports a different address.", {
        failureCode: "SUBJECT_MISMATCH",
        expected: subject,
        actual: art.address,
      });
    } else c.set("requested_address", "PASS", "Subject address matches invoice", subject);

    if (art.chain_id !== terms.deliveryChainId) {
      c.set("delivery_chain", "FAIL", "Artifact chain matches invoice delivery chain", "Artifact computed on another chain.", {
        failureCode: "CHAIN_MISMATCH",
        expected: String(terms.deliveryChainId),
        actual: String(art.chain_id),
      });
    } else c.set("delivery_chain", "PASS", "Artifact chain matches invoice delivery chain", String(art.chain_id));

    if (art.start_block !== start || art.end_block !== end) {
      c.set("block_range", "FAIL", "Block range matches agreement", `Requested ${start}..${end}, delivered ${art.start_block}..${art.end_block}.`, {
        failureCode: "BLOCK_RANGE_MISMATCH",
      });
    } else c.set("block_range", "PASS", "Block range matches agreement", `${start}..${end}`);
  }

  // 5. Freshness
  const generatedAt = manifestWellFormed ? Number(manifest.generatedAt) : NaN;
  const submittedAt = Math.floor(new Date(deliveryRow.submitted_at).getTime() / 1000);
  if (!Number.isFinite(generatedAt) || generatedAt < terms.issuedAt - CLOCK_SKEW_SECONDS || generatedAt > submittedAt + CLOCK_SKEW_SECONDS || submittedAt > terms.expiresAt) {
    c.set("freshness", "FAIL", "Delivery generated after issuance and submitted before expiry", "Manifest timestamp or submission time is outside the invoice window.", {
      failureCode: "DELIVERY_STALE",
    });
  } else {
    c.set("freshness", "PASS", "Delivery generated after issuance and submitted before expiry", new Date(generatedAt * 1000).toISOString());
  }

  // 6. Independent RPC recomputation (bounded; fail-closed)
  const rangeSize = end - start + 1;
  let observedBlock: bigint | undefined;
  const rpcKeys = ["transaction_count", "native_values", "counterparties", "sample_transaction_proofs"] as const;
  const pendAll = (code: VerificationReasonCode, why: string) => {
    for (const k of rpcKeys) c.set(k, "PENDING", "Recomputed from independent RPC", why, { failureCode: code });
  };

  const network = findNetwork(terms.deliveryChainId);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) {
    for (const k of rpcKeys) c.set(k, "FAIL", "Recomputed from independent RPC", "Invalid block range.", { failureCode: "RANGE_UNSUPPORTED" });
  } else if (rangeSize > cfg.delivery.maxBlockRange) {
    for (const k of rpcKeys) {
      c.set(k, "FAIL", "Recomputed from independent RPC", `Range of ${rangeSize} blocks exceeds verifier limit ${cfg.delivery.maxBlockRange}.`, {
        failureCode: "RANGE_UNSUPPORTED",
      });
    }
  } else if (!network?.deliveryVerificationSupported) {
    for (const k of rpcKeys) c.set(k, "FAIL", "Recomputed from independent RPC", "Delivery chain unsupported.", { failureCode: "CHAIN_MISMATCH" });
  } else if (!ctx.reader) {
    const code = (ctx.readerError?.code ?? "RPC_UNCONFIGURED") as VerificationReasonCode;
    pendAll(code, ctx.readerError?.message ?? "No RPC configured for the delivery chain.");
  } else if (!art) {
    for (const k of rpcKeys) c.set(k, "SKIPPED", "Recomputed from independent RPC", "Skipped: artifact schema invalid.");
  } else {
    const reader = ctx.reader;
    try {
      const recomputed = await withDeadline(cfg.delivery.totalTimeoutMs, async () => {
        await reader.assertChainId();
        observedBlock = await reader.getBlockNumber();
        const confirmedTip = observedBlock - BigInt(cfg.delivery.minConfirmations);
        if (BigInt(end) > confirmedTip) return { notConfirmed: true as const };
        const blocks = await fetchBlocks(reader, start, end, 5);
        return {
          notConfirmed: false as const,
          ...computeAddressAnalytics({
            chainId: terms.deliveryChainId,
            address: subject,
            startBlock: start,
            endBlock: end,
            blocks,
            maxSamples: cfg.delivery.maxSampleTransactions,
          }),
        };
      });

      if (recomputed.notConfirmed) {
        pendAll("BLOCK_NOT_CONFIRMED", `Block ${end} is not yet ${cfg.delivery.minConfirmations} blocks deep (tip ${observedBlock}).`);
      } else {
        const truth = recomputed.artifact;
        sources.push({
          type: "rpc",
          description: `Recomputed ${rangeSize} blocks via independent RPC`,
          chainId: terms.deliveryChainId,
          rpc: reader.label,
          observedBlock: observedBlock?.toString(),
          blocksScanned: rangeSize,
        });
        if (art.transaction_count !== truth.transaction_count) {
          c.set("transaction_count", "FAIL", "Transaction count recomputed from RPC", `Seller claimed ${art.transaction_count}; RPC recomputation found ${truth.transaction_count}.`, {
            failureCode: "TX_COUNT_MISMATCH",
            expected: String(truth.transaction_count),
            actual: String(art.transaction_count),
          });
        } else c.set("transaction_count", "PASS", "Transaction count recomputed from RPC", `${truth.transaction_count} transactions.`);

        if (art.native_value_in_raw !== truth.native_value_in_raw || art.native_value_out_raw !== truth.native_value_out_raw) {
          c.set("native_values", "FAIL", "Native value flows recomputed from RPC", "Claimed in/out values differ from RPC recomputation.", {
            failureCode: "VALUE_MISMATCH",
            expected: `${truth.native_value_in_raw}/${truth.native_value_out_raw}`,
            actual: `${art.native_value_in_raw}/${art.native_value_out_raw}`,
          });
        } else c.set("native_values", "PASS", "Native value flows recomputed from RPC", "In/out values match.");

        const claimedCp = JSON.stringify(art.counterparties);
        const truthCp = JSON.stringify(truth.counterparties);
        if (claimedCp !== truthCp) {
          c.set("counterparties", "FAIL", "Counterparty breakdown recomputed from RPC", "Counterparty breakdown differs from RPC recomputation.", {
            failureCode: "COUNTERPARTY_MISMATCH",
          });
        } else c.set("counterparties", "PASS", "Counterparty breakdown recomputed from RPC", `${truth.counterparties.length} counterparties.`);

        const badSamples = art.sample_transactions.filter((s) => recomputed.matchedHashes.get(s.hash) !== s.block_number);
        if (art.sample_transactions.length > cfg.delivery.maxSampleTransactions || badSamples.length > 0) {
          c.set("sample_transaction_proofs", "FAIL", "Sample transactions exist in range and involve the subject", `${badSamples.length} sample(s) not found among matching transactions.`, {
            failureCode: "EVIDENCE_INVALID",
          });
        } else c.set("sample_transaction_proofs", "PASS", "Sample transactions exist in range and involve the subject", `${art.sample_transactions.length} sample(s) verified.`);
      }
    } catch (err) {
      const code = err instanceof ChainReadError ? err.code : "RPC_UNAVAILABLE";
      pendAll(code as VerificationReasonCode, `Independent RPC verification unavailable: ${(err as Error).message}`);
    }
  }

  const decision = c.decision();
  const inputDigest = keccak256(toBytes(`${manifestDigest ?? "malformed"}:${computedSha ?? "none"}:${deliveryRow.manifest_signature}`));
  return {
    objectType: "DELIVERY",
    objectId: deliveryRow.id,
    decision,
    payable: decision === "PASS",
    checks: c.checks,
    checkDetails: c.details,
    reasonCodes: c.reasons,
    verifierVersion: DELIVERY_VERIFIER_VERSION,
    verifiedAt: new Date(now * 1000).toISOString(),
    inputDigest,
    evidenceDigest: manifestDigest ?? undefined,
    evidenceSources: sources,
    chainId: terms.deliveryChainId,
    observedBlock: observedBlock?.toString(),
  };
}

export function normalizeAddress(a: string): Address {
  return getAddress(a);
}
