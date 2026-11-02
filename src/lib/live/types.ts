/**
 * Connected-mode DTOs returned by the HashX backend (server/src/types.ts, services/*).
 * These describe REAL persisted records — never demo fixtures.
 */
import type { SettlementRail } from "@shared/networks";

export type Hex = `0x${string}`;

export type LiveInvoiceStatus =
  | "DRAFT"
  | "SIGNED"
  | "VERIFIED"
  | "DELIVERED"
  | "DELIVERY_ACCEPTED"
  | "DELIVERY_REJECTED"
  | "SETTLED"
  | "REJECTED";

export type LivePaymentState =
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

export interface TypedDataJson {
  domain: { name: string; version: string; chainId: number | string; verifyingContract?: Hex };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface LiveInvoice {
  id: string;
  version: number;
  protocolVersion: number;
  legacy: boolean;
  clientRequestId: string;
  sellerId: string;
  sellerDisplayName: string;
  sellerWallet: Hex;
  buyerWallet: Hex | null;
  buyerRef: string;
  buyerRefHash: Hex;
  service: {
    type: string;
    delivery_chain_id: number;
    parameters: { address: Hex; start_block: string; end_block: string };
    acceptance_policy: string;
  };
  serviceTermsHash: Hex;
  payment: {
    rail: SettlementRail | null;
    settlement_chain_id: number;
    settlement_network: string | null;
    is_testnet: boolean | null;
    token_address: Hex | null;
    token_symbol: string | null;
    token_decimals: number | null;
    amount_raw: string | null;
    amount_display: string | null;
    payee: Hex;
  };
  signingChainId: number | null;
  deliveryChainId: number | null;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  status: LiveInvoiceStatus;
  createdAt: string;
  digest: Hex;
  signature?: Hex;
  signer?: Hex;
  signatureVerifiedAtSubmission: boolean;
  viewerRole?: "seller" | "buyer" | null;
  typedData?: TypedDataJson;
  idempotentReplay?: boolean;
}

export interface LiveCheckDetail {
  status: "PASS" | "FAIL" | "PENDING" | "SKIPPED";
  rule: string;
  explanation: string;
  failureCode?: string;
  expected?: string;
  actual?: string;
}

export interface LiveVerificationRun {
  runId?: string;
  objectType: "INVOICE" | "DELIVERY";
  objectId: string;
  decision: "PASS" | "FAIL" | "PENDING";
  payable: boolean;
  checks: Record<string, LiveCheckDetail["status"]>;
  checkDetails: Record<string, LiveCheckDetail>;
  reasonCodes: string[];
  verifierVersion: string;
  verifiedAt: string;
  inputDigest: Hex;
  evidenceDigest?: Hex;
  evidenceSources: Array<{ type: string; description: string; chainId?: number; rpc?: string; observedBlock?: string; blocksScanned?: number }>;
  chainId?: number;
  observedBlock?: string;
  signerRecovered?: Hex;
}

export interface LiveVerificationSummary {
  invoiceId: string;
  invoiceDecision: "PASS" | "FAIL" | "PENDING";
  deliveryDecision?: "PASS" | "FAIL" | "PENDING";
  overallDecision: "PASS" | "FAIL" | "PENDING";
  isEligibleForPayment: boolean;
  eligibilityExplanation: string;
  blockingReasons: string[];
  invoiceVerification: LiveVerificationRun | null;
  deliveryVerification: LiveVerificationRun | null;
  provenance: "backend_persisted";
}

export interface LiveDelivery {
  id: string;
  invoiceId: string;
  version: number;
  artifactUri: string;
  artifactSha256: Hex;
  artifactSha256Computed: Hex | null;
  manifest: Record<string, unknown>;
  manifestDigest: Hex | null;
  manifestSignature: Hex;
  status: "PENDING_VERIFICATION" | "ACCEPTED" | "REJECTED";
  submittedAt: string;
  submittedBy: string | null;
  artifactContent: Record<string, unknown>;
}

export interface PreparedDelivery {
  manifest: Record<string, unknown>;
  artifactSha256: Hex;
  canonicalArtifact: string;
  typedData: TypedDataJson;
}

export interface TransferInstructions {
  chainId: number;
  to: Hex;
  value: string;
  data: Hex;
  method: string;
  args: { to: Hex; amount: string };
}

export interface LiveApprovalSummary {
  rail: SettlementRail;
  network: string;
  chainId: number;
  isTestnet: boolean | null;
  payer: Hex;
  payee: Hex;
  tokenAddress: Hex;
  tokenSymbol: string;
  tokenLabel: string;
  tokenDecimals: number;
  tokenTotalRaw: string;
  humanAmount: string;
  authorizationDigest: Hex;
  authorizationExpiresAt: string | null;
  invoiceDigest: Hex;
  deliveryEvidenceDigest: Hex;
  finalityPolicy: string;
}

export interface LivePayment {
  id: string;
  invoiceId: string;
  rail: SettlementRail | "legacy-v1";
  chainId: number | null;
  network: string | null;
  isTestnet: boolean | null;
  payer: Hex;
  payee: Hex;
  tokenAddress: Hex;
  tokenSymbol: string | null;
  tokenDecimals: number | null;
  tokenTotalRaw: string;
  amountDisplay: string;
  state: LivePaymentState;
  invoiceDigest: Hex | null;
  deliveryId: string | null;
  deliveryEvidenceDigest: Hex | null;
  authorization: { digest: Hex; message: Record<string, unknown>; expiresAt: string; signature: Hex | null } | null;
  authorizationTypedData?: TypedDataJson;
  approvalSummary?: LiveApprovalSummary;
  transferInstructions?: TransferInstructions;
  txHash?: Hex;
  blockNumber: string | null;
  blockHash: Hex | null;
  logIndex: number | null;
  confirmations: number;
  finalityPolicy: string | null;
  failureCode: string | null;
  failureDetail: string | null;
  submittedAt: string | null;
  includedAt: string | null;
  confirmedAt: string | null;
  finalizedAt: string | null;
  lastReconciledAt: string | null;
  flowId: string | null;
  paymentRequestId: string | null;
  hspStatus: string | null;
  createdAt: string;
  updatedAt: string;
  viewerRole?: "payer" | "payee-seller";
  idempotentReplay?: boolean;
}

export interface LiveReceipt {
  id: string;
  invoiceId: string;
  receiptVersion: string;
  receiptDigest: Hex | null;
  invoiceDigest: Hex;
  seller: Hex;
  sellerDisplayName: string | null;
  buyerRef: string;
  deliveryEvidenceDigest: Hex;
  payment: Record<string, unknown>;
  paymentAttemptId: string | null;
  chainId: number | null;
  txHash: Hex | null;
  revokedAt: string | null;
  revocationReason: string | null;
  legacy: boolean;
  issuedAt: string;
  document: any;
  rawPayloadJson: string;
}

export interface LiveStats {
  source: "backend_persisted";
  invoicesByStatus: Record<string, number>;
  paymentsByState: Record<string, number>;
  deliveryVerificationsByDecision: Record<string, number>;
  liveReceipts: number;
  settledTestUsdcRaw: string;
  settledTestUsdcDisplay: string;
}

export interface LiveReadiness {
  status: "ready" | "degraded";
  api: "ok";
  database: { status: string; pendingMigrations?: string[] };
  chains: Record<
    string,
    {
      chainId: number;
      network?: string;
      rpc: string;
      paymentExecutionEnabled: boolean;
      latestBlock?: string;
      settlementToken?: { address: Hex; label: string; validatedOnChain: boolean; reason: string | null };
      evidenceRegistry?: { configured: boolean; address: string | null; deployed: boolean; version: string | null; reason: string | null };
    }
  >;
  settlement: {
    "sepolia-usdc": { available: boolean };
    "hashkey-hsp": { configured: boolean; allowlistConfirmed: boolean; connection: string; authentication: string; toolsDiscovered: number; settlementAvailable: boolean; blockers: string[] };
  };
  checkedAt: string;
}

export interface LiveSession {
  token: string;
  address: Hex;
  expiresAt: string;
  counterpartyId: string;
  displayName: string;
}

export interface CreateLiveInvoiceInput {
  client_request_id: string;
  buyer_wallet: Hex;
  buyer_ref: string;
  service: {
    type: "evm_address_analytics_v1";
    delivery_chain_id: number;
    parameters: { address: Hex; start_block: string; end_block: string };
    acceptance_policy: "exact_recompute_v1";
  };
  payment: { rail: SettlementRail; settlement_chain_id: number; amount_raw: string; payee: Hex; token_address?: Hex };
  expires_in_seconds?: number;
}

export class LiveApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly requestId?: string
  ) {
    super(message);
    this.name = "LiveApiError";
  }
}
