export type Address = `0x${string}`;
export type Hash = `0x${string}`;

export type OperationMode = "demo" | "connected";

export type InvoiceStatus =
  | "DRAFT"
  | "SIGNED"
  | "VERIFIED"
  | "REJECTED"
  | "DELIVERED"
  | "DELIVERY_ACCEPTED"
  | "DELIVERY_REJECTED"
  | "SETTLED";

export type VerificationDecision = "PASS" | "FAIL" | "PENDING";
export type CheckStatus = "PASS" | "FAIL" | "SKIPPED";

export type InvoiceCheckKey =
  | "schema"
  | "signature"
  | "identity_binding"
  | "expiry"
  | "nonce_unused"
  | "terms_consistent";

export type DeliveryCheckKey =
  | "manifest_signature"
  | "artifact_hash"
  | "schema"
  | "requested_address"
  | "block_range"
  | "transaction_count"
  | "sample_transaction_proofs"
  | "freshness";

export type VerificationReasonCode =
  | "SIGNATURE_INVALID"
  | "SUBJECT_MISMATCH"
  | "BLOCK_RANGE_MISMATCH"
  | "TX_COUNT_MISMATCH"
  | "ARTIFACT_TAMPERED"
  | "MANIFEST_SIGNATURE_INVALID"
  | "DELIVERY_SCHEMA_INVALID"
  | "CHAIN_MISMATCH"
  | "EVIDENCE_INVALID"
  | "DELIVERY_STALE"
  | "DELIVERY_INCOMPLETE"
  | "INVOICE_EXPIRED"
  | "REPLAY_NONCE_REUSED"
  | "SELLER_UNBOUND"
  | "TERMS_MUTATED";

export type HSPStatus =
  | "payment-submitted"
  | "payment-verified"
  | "payment-processing"
  | "payment-included"
  | "payment-timeout"
  | "payment-safe"
  | "payment-finalized"
  | "payment-failed"
  | "unknown";

export type PaymentAttemptState =
  | "AWAITING_SIGNATURE_APPROVAL"
  | "AWAITING_SUBMISSION_APPROVAL"
  | "SUBMITTED"
  | "PROCESSING"
  | "SAFE"
  | "FINALIZED"
  | "FAILED"
  | "PENDING_RECOVERY";

export interface Counterparty {
  id: string;
  displayName: string;
  walletAddress: Address;
  walletType: "EOA" | "CONTRACT";
  status: "ACTIVE" | "REVOKED";
  createdAt: string;
  notes?: string;
}

export interface ServiceParameters {
  address: Address;
  start_block: string;
  end_block: string;
}

export interface ServiceDefinition {
  type: "hsk_address_analytics_v1";
  parameters: ServiceParameters;
  acceptance_policy: "analytics_v1";
}

export interface CommercialPaymentTerms {
  currency: "USD";
  amount_minor: string; // e.g. "100" = 1.00 USD
  payee: Address;
  preferred_chain_id: number;
}

export interface Invoice {
  id: string;
  version: number;
  clientRequestId: string;
  sellerId: string;
  sellerDisplayName?: string;
  sellerWallet: Address;
  buyerRef: string;
  buyerRefHash: Hash;
  service: ServiceDefinition;
  serviceTermsHash: Hash;
  payment: CommercialPaymentTerms;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  status: InvoiceStatus;
  digest?: Hash;
  signature?: Hash;
  signer?: Address;
  signatureValid?: boolean;
  createdAt: string;
}

export interface AnalyticsArtifactContent {
  schema: "hashx.analytics.v1";
  chain_id: number;
  address: Address;
  start_block: number;
  end_block: number;
  transaction_count: number;
  native_value_in_raw: string;
  native_value_out_raw: string;
  counterparties: Array<{ address: Address; tx_count: number }>;
  sample_transactions: Array<{ hash: Hash; block_number: number }>;
  generated_at: string;
}

export interface DeliveryManifest {
  schema: "hashx.delivery.analytics.v1";
  seller: Address;
  generated_at: string;
  service_parameters_hash: Hash;
  artifact_sha256: string;
}

export interface Delivery {
  id: string;
  invoiceId: string;
  version: number;
  artifactUri: string;
  artifactSha256: string;
  manifest: DeliveryManifest;
  manifestSignature: Hash;
  status: "PENDING_VERIFICATION" | "ACCEPTED" | "REJECTED";
  submittedAt: string;
  artifactContent: AnalyticsArtifactContent;
}

export interface VerificationCheckDetail {
  status: CheckStatus;
  rule: string;
  explanation: string;
  failureCode?: VerificationReasonCode;
  expected?: string;
  actual?: string;
}

export interface InvoiceVerificationResult {
  decision: VerificationDecision;
  checks: Record<InvoiceCheckKey, CheckStatus>;
  checkDetails: Record<InvoiceCheckKey, VerificationCheckDetail>;
  invoiceDigest: Hash;
  reasonCodes: VerificationReasonCode[];
  verifierVersion: string;
  verifiedAt: string;
  signerRecovered?: Address;
}

export interface DeliveryVerificationResult {
  decision: VerificationDecision;
  verifier: string;
  checks: Record<DeliveryCheckKey, CheckStatus>;
  checkDetails: Record<DeliveryCheckKey, VerificationCheckDetail>;
  evidenceDigest: Hash;
  reasonCodes: VerificationReasonCode[];
  verifiedAt: string;
  rpcEndpointUsed?: string;
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

export interface ApprovalSummary {
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
  paymentFeeEstimateUsd?: string;
  chain: string;
  chainId: number;
  quoteExpiresAt: string;
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
  txHash?: Hash;
  evidenceRegistryTx?: Hash;
  createdAt: string;
  updatedAt: string;
  approvalSummary: ApprovalSummary;
  eip712Payload?: Record<string, unknown>;
  failureReason?: string;
}

export interface HumanApprovalRecord {
  id: string;
  paymentAttemptId: string;
  stage: "PRE_SIGNING" | "PRE_SUBMISSION";
  actor: string;
  termsHash: Hash;
  approvedAt: string;
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
    txHash: Hash;
    payer: Address;
    payee: Address;
    tokenTotalRaw: string;
    tokenSymbol: string;
    humanAmount: string;
    finalizedAt: string;
  };
  evidenceRegistryTx: Hash;
  issuedAt: string;
  rawPayloadJson: string;
}

export interface HashXClient {
  getInvoices(): Promise<Invoice[]>;
  getInvoiceById(id: string): Promise<Invoice | null>;
  getDeliveries(): Promise<Delivery[]>;
  getDeliveryByInvoiceId(invoiceId: string): Promise<Delivery | null>;
  getPaymentAttempts(): Promise<PaymentAttempt[]>;
  getPaymentAttemptById(id: string): Promise<PaymentAttempt | null>;
  getReceipts(): Promise<VerifiableReceipt[]>;

  createInvoice(input: CreateInvoiceInput): Promise<Invoice>;
  signInvoice(input: SignInvoiceInput): Promise<Invoice>;
  verifyInvoice(input: VerifyInvoiceInput): Promise<InvoiceVerificationResult>;
  submitDelivery(input: SubmitDeliveryInput): Promise<Delivery>;
  verifyDelivery(input: VerifyDeliveryInput): Promise<DeliveryVerificationResult>;
  requestPayment(input: RequestPaymentInput): Promise<PaymentAttempt>;
  getPaymentStatus(invoiceId: string): Promise<PaymentAttempt>;
  getReceipt(invoiceId: string): Promise<VerifiableReceipt>;
}

export interface CreateInvoiceInput {
  client_request_id?: string;
  seller_counterparty_id: string;
  buyer_ref: string;
  service: ServiceDefinition;
  payment: CommercialPaymentTerms;
  expires_at: string;
}

export interface SignInvoiceInput {
  invoice_id: string;
  signature?: Hash;
  signer?: Address;
}

export interface VerifyInvoiceInput {
  invoice_id: string;
  expected_seller_id?: string;
  expected_buyer_ref?: string;
}

export interface SubmitDeliveryInput {
  invoice_id: string;
  artifact_uri: string;
  artifact_sha256: string;
  manifest: DeliveryManifest;
  manifest_signature: Hash;
  artifact_content: AnalyticsArtifactContent;
}

export interface VerifyDeliveryInput {
  invoice_id: string;
  delivery_id?: string;
}

export interface RequestPaymentInput {
  invoice_id: string;
  payer: Address;
  merchant_name?: string;
}
