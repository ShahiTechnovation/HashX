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

export type DeliveryStatus = "PENDING_VERIFICATION" | "ACCEPTED" | "REJECTED";

export type CheckStatus = "PASS" | "FAIL" | "PENDING" | "SKIPPED";
export type VerificationDecision = "PASS" | "FAIL" | "PENDING";

export type VerificationReasonCode =
  | "SIGNATURE_INVALID"
  | "SIGNER_UNAUTHORIZED"
  | "SELLER_UNBOUND"
  | "INVOICE_EXPIRED"
  | "REPLAY_NONCE_REUSED"
  | "TERMS_MUTATED"
  | "BUYER_REF_MISMATCH"
  | "CHAIN_MISMATCH"
  | "DELIVERY_SCHEMA_INVALID"
  | "ARTIFACT_TAMPERED"
  | "SUBJECT_MISMATCH"
  | "BLOCK_RANGE_MISMATCH"
  | "TX_COUNT_MISMATCH"
  | "MANIFEST_SIGNATURE_INVALID"
  | "EVIDENCE_INVALID"
  | "DELIVERY_STALE"
  | "DELIVERY_INCOMPLETE";

export type HSPStatus =
  | "payment-submitted"
  | "payment-verified"
  | "payment-processing"
  | "payment-included"
  | "payment-safe"
  | "payment-finalized"
  | "payment-failed"
  | "payment-timeout";

export type PaymentAttemptState =
  | "AWAITING_SIGNATURE_APPROVAL"
  | "AWAITING_SUBMISSION_APPROVAL"
  | "SUBMITTED"
  | "FINALIZED"
  | "FAILED"
  | "TIMEOUT";

export interface Counterparty {
  id: string;
  displayName: string;
  walletAddress: Address;
  walletType: "EOA" | "CONTRACT";
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  createdAt: string;
  notes?: string;
}

export interface ServiceTerms {
  type: string;
  parameters: {
    address: Address;
    start_block: string;
    end_block: string;
  };
  acceptance_policy: string;
}

export interface PaymentTerms {
  currency: string;
  amount_minor: string;
  payee: Address;
  preferred_chain_id: number;
}

export interface Invoice {
  id: string;
  version: number;
  clientRequestId: string;
  sellerId: string;
  sellerDisplayName: string;
  sellerWallet: Address;
  buyerRef: string;
  buyerRefHash: Hash;
  service: ServiceTerms;
  serviceTermsHash: Hash;
  payment: PaymentTerms;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  status: InvoiceStatus;
  createdAt: string;
  digest: Hash;
  signature?: `0x${string}`;
  signer?: Address;
  signatureValid?: boolean;
}

export interface Delivery {
  id: string;
  invoiceId: string;
  version: number;
  artifactUri: string;
  artifactSha256: Hash;
  manifest: {
    schema: string;
    invoice_id: string;
    seller: Address;
    artifact_sha256: Hash;
    generated_at: string;
  };
  manifestSignature: `0x${string}`;
  status: DeliveryStatus;
  submittedAt: string;
  artifactContent: any;
}

export interface InvoiceCheckDetail {
  status: CheckStatus;
  rule: string;
  explanation: string;
  failureCode?: VerificationReasonCode;
  expected?: string;
  actual?: string;
}

export interface InvoiceVerificationResult {
  decision: VerificationDecision;
  checks: {
    schema: CheckStatus;
    signature: CheckStatus;
    identity_binding: CheckStatus;
    expiry: CheckStatus;
    nonce_unused: CheckStatus;
    terms_consistent: CheckStatus;
  };
  checkDetails: Record<string, InvoiceCheckDetail>;
  invoiceDigest: Hash;
  reasonCodes: VerificationReasonCode[];
  verifierVersion: string;
  verifiedAt: string;
  signerRecovered?: Address;
}

export interface DeliveryCheckDetail {
  status: CheckStatus;
  rule: string;
  explanation: string;
  failureCode?: VerificationReasonCode;
  expected?: string;
  actual?: string;
}

export interface DeliveryVerificationResult {
  decision: VerificationDecision;
  verifier: string;
  checks: {
    manifest_signature: CheckStatus;
    artifact_hash: CheckStatus;
    schema: CheckStatus;
    requested_address: CheckStatus;
    block_range: CheckStatus;
    transaction_count: CheckStatus;
    sample_transaction_proofs: CheckStatus;
    freshness: CheckStatus;
  };
  checkDetails: Record<string, DeliveryCheckDetail>;
  evidenceDigest: Hash;
  reasonCodes: VerificationReasonCode[];
  verifiedAt: string;
  rpcEndpointUsed: string;
}

export interface CombinedVerificationResult {
  invoiceId: string;
  invoiceDecision: VerificationDecision;
  deliveryDecision?: VerificationDecision;
  overallDecision: VerificationDecision;
  isEligibleForPayment: boolean;
  eligibilityExplanation: string;
  invoiceVerification: InvoiceVerificationResult;
  deliveryVerification?: DeliveryVerificationResult;
}

export interface PaymentAttempt {
  id: string;
  invoiceId: string;
  flowId: string;
  paymentRequestId: string;
  merchantName: string;
  attributionVerified: boolean;
  payer: Address;
  payee: Address;
  tokenAddress: Address;
  tokenTotalRaw: string;
  quoteExpiresAt: string;
  hspStatus: HSPStatus;
  state: PaymentAttemptState;
  createdAt: string;
  updatedAt: string;
  txHash?: Hash;
  evidenceRegistryTx?: Hash;
  approvalSummary: {
    merchantName: string;
    attributionVerified: boolean;
    payer: Address;
    payee: Address;
    tokenAddress: Address;
    tokenSymbol: string;
    tokenDecimals: number;
    tokenTotalRaw: string;
    humanAmount: string;
    invoiceValueUsd: string;
    paymentFeeEstimateUsd: string;
    chain: string;
    chainId: number;
    quoteExpiresAt: string;
  };
}

export interface VerifiableReceipt {
  id: string;
  invoiceId: string;
  receiptVersion: string;
  invoiceDigest: Hash;
  seller: Address;
  sellerDisplayName?: string;
  buyerRef: string;
  deliveryEvidenceDigest: Hash;
  payment: {
    hspStatus: HSPStatus;
    flowId: string;
    paymentRequestId: string;
    txHash?: Hash;
    payer: Address;
    payee: Address;
    tokenTotalRaw: string;
    tokenSymbol: string;
    humanAmount: string;
    finalizedAt: string;
  };
  evidenceRegistryTx?: Hash;
  issuedAt: string;
  rawPayloadJson: string;
}
