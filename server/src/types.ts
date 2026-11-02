import type { InvoiceTerms } from "../../shared/protocol.js";
import { findNetwork, formatTokenAmount, type SettlementRail } from "../../shared/networks.js";
import { toIso } from "./lib/core.js";

export type Address = `0x${string}`;
export type Hash = `0x${string}`;

export type InvoiceStatus =
  | "DRAFT"
  | "SIGNED"
  | "VERIFIED"
  | "DELIVERED"
  | "DELIVERY_ACCEPTED"
  | "DELIVERY_REJECTED"
  | "SETTLED"
  | "REJECTED";

export type CheckStatus = "PASS" | "FAIL" | "PENDING" | "SKIPPED";
export type VerificationDecision = "PASS" | "FAIL" | "PENDING";

export type VerificationReasonCode =
  | "SCHEMA_INVALID"
  | "LEGACY_PROTOCOL"
  | "SIGNATURE_MISSING"
  | "SIGNATURE_INVALID"
  | "SELLER_UNBOUND"
  | "INVOICE_EXPIRED"
  | "REPLAY_NONCE_REUSED"
  | "TERMS_MUTATED"
  | "SETTLEMENT_TERMS_INVALID"
  | "CHAIN_MISMATCH"
  | "DELIVERY_SCHEMA_INVALID"
  | "ARTIFACT_TAMPERED"
  | "SUBJECT_MISMATCH"
  | "BLOCK_RANGE_MISMATCH"
  | "RANGE_UNSUPPORTED"
  | "BLOCK_NOT_CONFIRMED"
  | "TX_COUNT_MISMATCH"
  | "VALUE_MISMATCH"
  | "COUNTERPARTY_MISMATCH"
  | "MANIFEST_SIGNATURE_INVALID"
  | "EVIDENCE_BINDING_MISMATCH"
  | "EVIDENCE_INVALID"
  | "DELIVERY_STALE"
  | "RPC_UNAVAILABLE"
  | "RPC_CHAIN_MISMATCH"
  | "RPC_UNCONFIGURED";

export interface CheckDetail {
  status: CheckStatus;
  rule: string;
  explanation: string;
  failureCode?: VerificationReasonCode;
  expected?: string;
  actual?: string;
}

export interface EvidenceSource {
  type: "rpc" | "artifact" | "signature" | "database";
  description: string;
  chainId?: number;
  rpc?: string;
  observedBlock?: string;
  blocksScanned?: number;
}

export interface VerificationResult {
  runId?: string;
  objectType: "INVOICE" | "DELIVERY";
  objectId: string;
  decision: VerificationDecision;
  payable: boolean;
  checks: Record<string, CheckStatus>;
  checkDetails: Record<string, CheckDetail>;
  reasonCodes: VerificationReasonCode[];
  verifierVersion: string;
  verifiedAt: string;
  inputDigest: Hash;
  evidenceDigest?: Hash;
  evidenceSources: EvidenceSource[];
  chainId?: number;
  observedBlock?: string;
  signerRecovered?: Address;
}

export type PaymentState =
  | "AWAITING_SIGNATURE_APPROVAL"
  | "AWAITING_SUBMISSION_APPROVAL"
  | "AUTHORIZED"
  | "SUBMITTED"
  | "INCLUDED"
  | "CONFIRMED"
  | "FINALIZED"
  | "FAILED"
  | "DROPPED"
  | "EXPIRED"
  | "CANCELLED"
  | "TIMEOUT";

export const TERMINAL_FAILURE_STATES: PaymentState[] = ["FAILED", "DROPPED", "EXPIRED", "CANCELLED", "TIMEOUT"];
export const SETTLED_STATES: PaymentState[] = ["CONFIRMED", "FINALIZED"];
export const PRE_SUBMISSION_STATES: PaymentState[] = [
  "AWAITING_SIGNATURE_APPROVAL",
  "AWAITING_SUBMISSION_APPROVAL",
  "AUTHORIZED",
];

// ---------------------------------------------------------------------------
// Row mappers
// ---------------------------------------------------------------------------

export function invoiceTermsFromRow(row: any): InvoiceTerms {
  const service = row.service_params;
  return {
    invoiceId: row.id,
    version: row.version,
    seller: row.seller_wallet,
    buyer: row.buyer_wallet,
    buyerRefHash: row.buyer_ref_hash,
    serviceType: row.service_type,
    serviceTermsHash: row.service_terms_hash,
    deliveryChainId: row.delivery_chain_id ?? service?.delivery_chain_id,
    settlementRail: row.settlement_rail,
    settlementChainId: row.settlement_chain_id,
    token: row.token_address,
    amount: String(row.amount_raw),
    payee: row.payee,
    nonce: row.nonce,
    issuedAt: Math.floor(new Date(row.issued_at).getTime() / 1000),
    expiresAt: Math.floor(new Date(row.expires_at).getTime() / 1000),
    signingChainId: row.signing_chain_id,
  };
}

export function mapInvoice(row: any) {
  const decimals = row.token_decimals ?? 6;
  const isV2 = row.protocol_version >= 2;
  const net = row.settlement_chain_id ? findNetwork(row.settlement_chain_id) : undefined;
  return {
    id: row.id,
    version: row.version,
    protocolVersion: row.protocol_version,
    legacy: !isV2,
    clientRequestId: row.client_request_id,
    sellerId: row.seller_id,
    sellerDisplayName: row.seller_display_name,
    sellerWallet: row.seller_wallet as Address,
    buyerWallet: (row.buyer_wallet ?? null) as Address | null,
    buyerRef: row.buyer_ref,
    buyerRefHash: row.buyer_ref_hash as Hash,
    service: row.service_params,
    serviceTermsHash: row.service_terms_hash as Hash,
    payment: {
      rail: (row.settlement_rail ?? null) as SettlementRail | null,
      settlement_chain_id: row.settlement_chain_id ?? row.preferred_chain_id,
      settlement_network: net?.name ?? null,
      is_testnet: net?.isTestnet ?? null,
      token_address: row.token_address ?? null,
      token_symbol: row.token_symbol ?? null,
      token_decimals: row.token_decimals ?? null,
      amount_raw: row.amount_raw !== null && row.amount_raw !== undefined ? String(row.amount_raw) : null,
      amount_display:
        row.amount_raw !== null && row.amount_raw !== undefined ? formatTokenAmount(String(row.amount_raw), decimals) : null,
      payee: row.payee as Address,
      // v1 compatibility fields
      currency: row.token_symbol ?? row.currency,
      amount_minor: row.amount_minor ?? null,
      preferred_chain_id: row.settlement_chain_id ?? row.preferred_chain_id,
    },
    signingChainId: row.signing_chain_id ?? null,
    deliveryChainId: row.delivery_chain_id ?? null,
    issuedAt: toIso(row.issued_at)!,
    expiresAt: toIso(row.expires_at)!,
    nonce: row.nonce,
    status: row.status as InvoiceStatus,
    createdAt: toIso(row.created_at)!,
    digest: row.digest as Hash,
    signature: row.signature || undefined,
    signer: row.signer || undefined,
    // The sign endpoint only persists signatures that recover to the seller; re-checked on every verification run.
    signatureVerifiedAtSubmission: Boolean(row.signature),
  };
}

export function mapDelivery(row: any) {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    version: row.version,
    artifactUri: row.artifact_uri,
    artifactSha256: row.artifact_sha256 as Hash,
    artifactSha256Computed: (row.artifact_sha256_computed ?? null) as Hash | null,
    manifest: row.manifest,
    manifestDigest: (row.manifest_digest ?? null) as Hash | null,
    manifestSignature: row.manifest_signature as Hash,
    status: row.status as "PENDING_VERIFICATION" | "ACCEPTED" | "REJECTED",
    submittedAt: toIso(row.submitted_at)!,
    submittedBy: row.submitted_by ?? null,
    artifactContent: row.artifact_content,
  };
}

export function mapVerificationRun(row: any): VerificationResult {
  const j = (v: any) => (typeof v === "string" ? JSON.parse(v) : v);
  return {
    runId: row.id,
    objectType: row.object_type,
    objectId: row.object_id,
    decision: row.decision,
    payable: row.payable,
    checks: j(row.checks),
    checkDetails: j(row.check_details),
    reasonCodes: j(row.reason_codes),
    verifierVersion: row.verifier_version,
    verifiedAt: toIso(row.created_at)!,
    inputDigest: row.input_digest,
    evidenceDigest: row.evidence_digest ?? undefined,
    evidenceSources: j(row.evidence_sources) ?? [],
    chainId: row.chain_id ?? undefined,
    observedBlock: row.observed_block != null ? String(row.observed_block) : undefined,
  };
}

export function mapPayment(row: any) {
  const decimals = row.token_decimals ?? 6;
  const net = row.chain_id ? findNetwork(row.chain_id) : undefined;
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    rail: (row.rail ?? "legacy-v1") as SettlementRail | "legacy-v1",
    chainId: row.chain_id ?? null,
    network: net?.name ?? null,
    isTestnet: net?.isTestnet ?? null,
    payer: row.payer as Address,
    payee: row.payee as Address,
    tokenAddress: row.token_address as Address,
    tokenSymbol: row.token_symbol ?? null,
    tokenDecimals: row.token_decimals ?? null,
    tokenTotalRaw: String(row.token_total_raw),
    amountDisplay: formatTokenAmount(String(row.token_total_raw), decimals),
    state: row.state as PaymentState,
    invoiceDigest: row.invoice_digest ?? null,
    deliveryId: row.delivery_id ?? null,
    deliveryEvidenceDigest: row.delivery_evidence_digest ?? null,
    authorization: row.authorization_message
      ? {
          digest: row.authorization_digest as Hash,
          message: row.authorization_message,
          expiresAt: toIso(row.authorization_expires_at)!,
          signature: row.authorization_signature ?? null,
        }
      : null,
    txHash: (row.tx_hash ?? undefined) as Hash | undefined,
    blockNumber: row.block_number != null ? String(row.block_number) : null,
    blockHash: row.block_hash ?? null,
    logIndex: row.log_index ?? null,
    confirmations: row.confirmations ?? 0,
    finalityPolicy: row.finality_policy ?? null,
    failureCode: row.failure_code ?? null,
    failureDetail: row.failure_detail ?? null,
    submittedAt: toIso(row.submitted_at) ?? null,
    includedAt: toIso(row.included_at) ?? null,
    confirmedAt: toIso(row.confirmed_at) ?? null,
    finalizedAt: toIso(row.finalized_at) ?? null,
    lastReconciledAt: toIso(row.last_reconciled_at) ?? null,
    // HSP-only fields (null on the direct Sepolia rail — never fabricated)
    flowId: row.flow_id ?? null,
    paymentRequestId: row.payment_request_id ?? null,
    hspStatus: row.hsp_status ?? null,
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };
}

export type InvoiceDTO = ReturnType<typeof mapInvoice>;
export type DeliveryDTO = ReturnType<typeof mapDelivery>;
export type PaymentDTO = ReturnType<typeof mapPayment>;
