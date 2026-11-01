import {
  Counterparty,
  Invoice,
  Delivery,
  PaymentAttempt,
  VerifiableReceipt,
  CombinedVerificationResult,
} from "@/types/domain";
import { computeServiceTermsHash } from "@/lib/crypto/eip712";
import { verifyInvoice, verifyDelivery, evaluatePaymentEligibility } from "@/lib/verification/engine";

// ---------------------------------------------------------------------------
// Registered Counterparties
// ---------------------------------------------------------------------------
export const MOCK_COUNTERPARTIES: Counterparty[] = [
  {
    id: "cp-seller-01",
    displayName: "Nexus Analytics Agent (Node #42)",
    walletAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    walletType: "EOA",
    status: "ACTIVE",
    createdAt: "2026-10-15T08:00:00Z",
    notes: "Verified provider of HashKey Chain block-range telemetry reports",
  },
  {
    id: "cp-seller-02-adversarial",
    displayName: "ShadowData Synthetics",
    walletAddress: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
    walletType: "EOA",
    status: "ACTIVE",
    createdAt: "2026-10-20T12:00:00Z",
    notes: "Telemetry supplier flagged for signature discrepancy test",
  },
  {
    id: "cp-buyer-01",
    displayName: "Autonomous Treasury Agent alpha",
    walletAddress: "0x1234567890123456789012345678901234567890",
    walletType: "EOA",
    status: "ACTIVE",
    createdAt: "2026-10-01T10:00:00Z",
    notes: "HashX buyer bot executing automated digital procurement",
  },
];

// ---------------------------------------------------------------------------
// Scenario A: Tampered Invoice Fixture
// Payee mutated after signature -> SIGNATURE_INVALID
// ---------------------------------------------------------------------------
const termsHashA = computeServiceTermsHash(
  "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "1200000",
  "1200500",
  "analytics_v1"
);

export const FIXTURE_INVOICE_TAMPERED: Invoice = {
  id: "inv-tampered-scenario-a",
  version: 1,
  clientRequestId: "req-tampered-uuid-001",
  sellerId: "cp-seller-02-adversarial",
  sellerDisplayName: "ShadowData Synthetics",
  sellerWallet: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
  buyerRef: "buyer-job-audit-hashkey-88",
  buyerRefHash: "0x3a4b9c1d8e7f2a1b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
  service: {
    type: "hsk_address_analytics_v1",
    parameters: {
      address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      start_block: "1200000",
      end_block: "1200500",
    },
    acceptance_policy: "analytics_v1",
  },
  serviceTermsHash: termsHashA,
  payment: {
    currency: "USD",
    amount_minor: "100", // $1.00 USD
    payee: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe", // Mutated payee! Originally signed to 0x89205...
    preferred_chain_id: 133,
  },
  issuedAt: "2026-10-31T09:00:00Z",
  expiresAt: "2026-11-05T09:00:00Z",
  nonce: "1001",
  status: "REJECTED",
  digest: "0x98124efac98214309aef908123bcdefa98712345bcde890123456789abcdef01",
  signature: "0x9f81a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f80123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef1b",
  signer: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
  signatureValid: false, // Intentionally invalid because payee was changed to an unauthorized address
  createdAt: "2026-10-31T09:00:00Z",
};

// ---------------------------------------------------------------------------
// Scenario B: Fake Fulfillment Fixture
// Seller claims 23 txs, chain RPC confirms 17 -> TX_COUNT_MISMATCH
// ---------------------------------------------------------------------------
const termsHashB = computeServiceTermsHash(
  "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  "1201000",
  "1201500",
  "analytics_v1"
);

export const FIXTURE_INVOICE_FAKE_DELIVERY: Invoice = {
  id: "inv-fake-fulfillment-scenario-b",
  version: 1,
  clientRequestId: "req-fakedelivery-uuid-002",
  sellerId: "cp-seller-01",
  sellerDisplayName: "Nexus Analytics Agent (Node #42)",
  sellerWallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  buyerRef: "buyer-job-audit-hashkey-91",
  buyerRefHash: "0x7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b",
  service: {
    type: "hsk_address_analytics_v1",
    parameters: {
      address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
      start_block: "1201000",
      end_block: "1201500",
    },
    acceptance_policy: "analytics_v1",
  },
  serviceTermsHash: termsHashB,
  payment: {
    currency: "USD",
    amount_minor: "250", // $2.50 USD
    payee: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    preferred_chain_id: 133,
  },
  issuedAt: "2026-10-31T10:00:00Z",
  expiresAt: "2026-11-05T10:00:00Z",
  nonce: "1002",
  status: "DELIVERY_REJECTED",
  digest: "0x4a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
  signature: "0x5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f80123456789a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8012341c",
  signer: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  signatureValid: true,
  createdAt: "2026-10-31T10:00:00Z",
};

export const FIXTURE_DELIVERY_FAKE_COUNT: Delivery = {
  id: "del-fake-scenario-b",
  invoiceId: "inv-fake-fulfillment-scenario-b",
  version: 1,
  artifactUri: "s3://hashx-deliveries/artifacts/20261031-del-fake-002.json",
  artifactSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  manifest: {
    schema: "hashx.delivery.analytics.v1",
    seller: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    generated_at: "2026-10-31T10:15:00Z",
    service_parameters_hash: termsHashB,
    artifact_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  },
  manifestSignature: "0x4b3a2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d1b",
  status: "REJECTED",
  submittedAt: "2026-10-31T10:16:00Z",
  artifactContent: {
    schema: "hashx.analytics.v1",
    chain_id: 133,
    address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    start_block: 1201000,
    end_block: 1201500,
    transaction_count: 23, // Faked! The blockchain RPC actually only recorded 17 txs
    native_value_in_raw: "4500000000000000000",
    native_value_out_raw: "2100000000000000000",
    counterparties: [
      { address: "0x1234567890123456789012345678901234567890", tx_count: 12 },
      { address: "0x999999cf1046e68e36e1aA2E0E07105eDDD1f08E", tx_count: 11 },
    ],
    sample_transactions: [
      { hash: "0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b", block_number: 1201020 },
    ],
    generated_at: "2026-10-31T10:15:00Z",
  },
};

// ---------------------------------------------------------------------------
// Scenario C: Duplicate Payment Replay Fixture
// request_payment returns existing attempt instead of creating a second order
// ---------------------------------------------------------------------------
const termsHashC = computeServiceTermsHash(
  "0x9A676e781A523b5d0C0e43731313A708CB607508",
  "1202000",
  "1202400",
  "analytics_v1"
);

export const FIXTURE_INVOICE_REPLAY: Invoice = {
  id: "inv-replay-scenario-c",
  version: 1,
  clientRequestId: "req-replay-uuid-003",
  sellerId: "cp-seller-01",
  sellerDisplayName: "Nexus Analytics Agent (Node #42)",
  sellerWallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  buyerRef: "buyer-job-audit-hashkey-95",
  buyerRefHash: "0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c",
  service: {
    type: "hsk_address_analytics_v1",
    parameters: {
      address: "0x9A676e781A523b5d0C0e43731313A708CB607508",
      start_block: "1202000",
      end_block: "1202400",
    },
    acceptance_policy: "analytics_v1",
  },
  serviceTermsHash: termsHashC,
  payment: {
    currency: "USD",
    amount_minor: "100", // $1.00 USD
    payee: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    preferred_chain_id: 133,
  },
  issuedAt: "2026-10-31T11:00:00Z",
  expiresAt: "2026-11-05T11:00:00Z",
  nonce: "1003",
  status: "DELIVERY_ACCEPTED",
  digest: "0x7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d",
  signature: "0x3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d1b",
  signer: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  signatureValid: true,
  createdAt: "2026-10-31T11:00:00Z",
};

export const FIXTURE_PAYMENT_ATTEMPT_EXISTING: PaymentAttempt = {
  id: "pay-attempt-c-active",
  invoiceId: "inv-replay-scenario-c",
  flowId: "hsp-flow-89912",
  paymentRequestId: "hsp-pr-5510294",
  merchantName: "HashX",
  attributionVerified: true,
  payer: "0x1234567890123456789012345678901234567890",
  payee: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  tokenAddress: "0x19B861876D8075A11eC6c4596395b058fe8466C2",
  tokenTotalRaw: "1000000", // 1.000000 USDT
  quoteExpiresAt: new Date(Date.now() + 240 * 1000).toISOString(),
  hspStatus: "payment-processing",
  state: "PROCESSING",
  createdAt: "2026-10-31T11:20:00Z",
  updatedAt: "2026-10-31T11:21:00Z",
  approvalSummary: {
    merchantName: "HashX",
    attributionVerified: true,
    payer: "0x1234567890123456789012345678901234567890",
    payee: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    tokenAddress: "0x19B861876D8075A11eC6c4596395b058fe8466C2",
    tokenSymbol: "USDT",
    tokenDecimals: 6,
    tokenTotalRaw: "1000000",
    humanAmount: "1.00 USDT",
    invoiceValueUsd: "$1.00 USD",
    paymentFeeEstimateUsd: "$0.00 USD",
    chain: "HashKey Chain Testnet",
    chainId: 133,
    quoteExpiresAt: new Date(Date.now() + 240 * 1000).toISOString(),
  },
};

// ---------------------------------------------------------------------------
// Scenario D: Golden Path (Complete Verified Journey)
// ---------------------------------------------------------------------------
const termsHashD = computeServiceTermsHash(
  "0x0B306BF915C4d645ff596e518fAf3F9669b97016",
  "1205000",
  "1205250",
  "analytics_v1"
);

export const FIXTURE_INVOICE_GOLDEN: Invoice = {
  id: "inv-golden-path-scenario-d",
  version: 1,
  clientRequestId: "req-golden-uuid-004",
  sellerId: "cp-seller-01",
  sellerDisplayName: "Nexus Analytics Agent (Node #42)",
  sellerWallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  buyerRef: "buyer-job-audit-hashkey-104",
  buyerRefHash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
  service: {
    type: "hsk_address_analytics_v1",
    parameters: {
      address: "0x0B306BF915C4d645ff596e518fAf3F9669b97016",
      start_block: "1205000",
      end_block: "1205250",
    },
    acceptance_policy: "analytics_v1",
  },
  serviceTermsHash: termsHashD,
  payment: {
    currency: "USD",
    amount_minor: "100", // $1.00 USD
    payee: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    preferred_chain_id: 133,
  },
  issuedAt: "2026-10-31T14:00:00Z",
  expiresAt: "2026-11-06T14:00:00Z",
  nonce: "1004",
  status: "SETTLED",
  digest: "0x5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
  signature: "0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d1b",
  signer: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  signatureValid: true,
  createdAt: "2026-10-31T14:00:00Z",
};

export const FIXTURE_DELIVERY_GOLDEN: Delivery = {
  id: "del-golden-path-scenario-d",
  invoiceId: "inv-golden-path-scenario-d",
  version: 1,
  artifactUri: "s3://hashx-deliveries/artifacts/20261031-golden-analytics-104.json",
  artifactSha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  manifest: {
    schema: "hashx.delivery.analytics.v1",
    seller: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    generated_at: "2026-10-31T14:10:00Z",
    service_parameters_hash: termsHashD,
    artifact_sha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  },
  manifestSignature: "0x8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1c",
  status: "ACCEPTED",
  submittedAt: "2026-10-31T14:11:00Z",
  artifactContent: {
    schema: "hashx.analytics.v1",
    chain_id: 133,
    address: "0x0B306BF915C4d645ff596e518fAf3F9669b97016",
    start_block: 1205000,
    end_block: 1205250,
    transaction_count: 14,
    native_value_in_raw: "8200000000000000000",
    native_value_out_raw: "3100000000000000000",
    counterparties: [
      { address: "0x1234567890123456789012345678901234567890", tx_count: 8 },
      { address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", tx_count: 6 },
    ],
    sample_transactions: [
      { hash: "0x123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0", block_number: 1205042 },
      { hash: "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789", block_number: 1205118 },
    ],
    generated_at: "2026-10-31T14:10:00Z",
  },
};

export const FIXTURE_PAYMENT_ATTEMPT_GOLDEN: PaymentAttempt = {
  id: "pay-golden-001",
  invoiceId: "inv-golden-path-scenario-d",
  flowId: "hsp-flow-90124",
  paymentRequestId: "hsp-pr-5519821",
  merchantName: "HashX",
  attributionVerified: true,
  payer: "0x1234567890123456789012345678901234567890",
  payee: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  tokenAddress: "0x19B861876D8075A11eC6c4596395b058fe8466C2",
  tokenTotalRaw: "1000000", // 1.000000 USDT
  quoteExpiresAt: "2026-10-31T14:20:00Z",
  hspStatus: "payment-finalized",
  state: "FINALIZED",
  txHash: "0x4b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c",
  evidenceRegistryTx: "0x8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
  createdAt: "2026-10-31T14:14:00Z",
  updatedAt: "2026-10-31T14:18:00Z",
  approvalSummary: {
    merchantName: "HashX",
    attributionVerified: true,
    payer: "0x1234567890123456789012345678901234567890",
    payee: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    tokenAddress: "0x19B861876D8075A11eC6c4596395b058fe8466C2",
    tokenSymbol: "USDT",
    tokenDecimals: 6,
    tokenTotalRaw: "1000000",
    humanAmount: "1.00 USDT",
    invoiceValueUsd: "$1.00 USD",
    paymentFeeEstimateUsd: "$0.00 USD",
    chain: "HashKey Chain Testnet",
    chainId: 133,
    quoteExpiresAt: "2026-10-31T14:20:00Z",
  },
};

export const FIXTURE_RECEIPT_GOLDEN: VerifiableReceipt = {
  id: "rcpt-golden-001",
  invoiceId: "inv-golden-path-scenario-d",
  receiptVersion: "1",
  invoiceDigest: "0x5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
  seller: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  sellerDisplayName: "Nexus Analytics Agent (Node #42)",
  buyerRef: "buyer-job-audit-hashkey-104",
  deliveryEvidenceDigest: "0x8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
  payment: {
    hspStatus: "payment-finalized",
    flowId: "hsp-flow-90124",
    paymentRequestId: "hsp-pr-5519821",
    txHash: "0x4b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c",
    payer: "0x1234567890123456789012345678901234567890",
    payee: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    tokenTotalRaw: "1000000",
    tokenSymbol: "USDT",
    humanAmount: "1.00 USDT",
    finalizedAt: "2026-10-31T14:18:00Z",
  },
  evidenceRegistryTx: "0x8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
  issuedAt: "2026-10-31T14:18:05Z",
  rawPayloadJson: JSON.stringify(
    {
      invoice_digest: "0x5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
      delivery_evidence_digest: "0x8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
      payment_request_id: "hsp-pr-5519821",
      settlement_tx: "0x4b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c",
      chain_id: 133,
      finality: "IRREVERSIBLE",
    },
    null,
    2
  ),
};

// ---------------------------------------------------------------------------
// Additional Active Invoices for rich Workspace experience
// ---------------------------------------------------------------------------
const termsHashE = computeServiceTermsHash(
  "0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF",
  "1206000",
  "1206800",
  "analytics_v1"
);

export const FIXTURE_INVOICE_PENDING_APPROVAL: Invoice = {
  id: "inv-pending-approval-05",
  version: 1,
  clientRequestId: "req-pending-uuid-005",
  sellerId: "cp-seller-01",
  sellerDisplayName: "Nexus Analytics Agent (Node #42)",
  sellerWallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  buyerRef: "buyer-job-audit-hashkey-112",
  buyerRefHash: "0x9f8e7d6c5b4a39281701a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3",
  service: {
    type: "hsk_address_analytics_v1",
    parameters: {
      address: "0x2B5AD5c4795c026514f8317c7a215E218DcCD6cF",
      start_block: "1206000",
      end_block: "1206800",
    },
    acceptance_policy: "analytics_v1",
  },
  serviceTermsHash: termsHashE,
  payment: {
    currency: "USD",
    amount_minor: "300", // $3.00 USD
    payee: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    preferred_chain_id: 133,
  },
  issuedAt: "2026-10-31T16:00:00Z",
  expiresAt: "2026-11-06T16:00:00Z",
  nonce: "1005",
  status: "DELIVERY_ACCEPTED",
  digest: "0x3344556677889900aabbccddeeff00112233445566778899aabbccddeeff0011",
  signature: "0x11223344556677889900aabbccddeeff00112233445566778899aabbccddeeff0011223344556677889900aabbccddeeff00112233445566778899aabbccddeeff1c",
  signer: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  signatureValid: true,
  createdAt: "2026-10-31T16:00:00Z",
};

export const FIXTURE_PAYMENT_ATTEMPT_PENDING_APPROVAL: PaymentAttempt = {
  id: "pay-pending-appr-005",
  invoiceId: "inv-pending-approval-05",
  flowId: "hsp-flow-90455",
  paymentRequestId: "hsp-pr-5520119",
  merchantName: "HashX",
  attributionVerified: true,
  payer: "0x1234567890123456789012345678901234567890",
  payee: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  tokenAddress: "0x19B861876D8075A11eC6c4596395b058fe8466C2",
  tokenTotalRaw: "3000000", // 3.000000 USDT
  quoteExpiresAt: new Date(Date.now() + 180 * 1000).toISOString(), // 3 mins left
  hspStatus: "payment-submitted",
  state: "AWAITING_SIGNATURE_APPROVAL",
  createdAt: "2026-10-31T16:15:00Z",
  updatedAt: "2026-10-31T16:15:00Z",
  approvalSummary: {
    merchantName: "HashX",
    attributionVerified: true,
    payer: "0x1234567890123456789012345678901234567890",
    payee: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    tokenAddress: "0x19B861876D8075A11eC6c4596395b058fe8466C2",
    tokenSymbol: "USDT",
    tokenDecimals: 6,
    tokenTotalRaw: "3000000",
    humanAmount: "3.00 USDT",
    invoiceValueUsd: "$3.00 USD",
    paymentFeeEstimateUsd: "$0.00 USD",
    chain: "HashKey Chain Testnet",
    chainId: 133,
    quoteExpiresAt: new Date(Date.now() + 180 * 1000).toISOString(),
  },
};

// Initial master mock stores
export const ALL_INITIAL_INVOICES: Invoice[] = [
  FIXTURE_INVOICE_GOLDEN,
  FIXTURE_INVOICE_PENDING_APPROVAL,
  FIXTURE_INVOICE_REPLAY,
  FIXTURE_INVOICE_FAKE_DELIVERY,
  FIXTURE_INVOICE_TAMPERED,
];

export const ALL_INITIAL_DELIVERIES: Delivery[] = [
  FIXTURE_DELIVERY_GOLDEN,
  FIXTURE_DELIVERY_FAKE_COUNT,
];

export const ALL_INITIAL_PAYMENT_ATTEMPTS: PaymentAttempt[] = [
  FIXTURE_PAYMENT_ATTEMPT_GOLDEN,
  FIXTURE_PAYMENT_ATTEMPT_PENDING_APPROVAL,
  FIXTURE_PAYMENT_ATTEMPT_EXISTING,
];

export const ALL_INITIAL_RECEIPTS: VerifiableReceipt[] = [
  FIXTURE_RECEIPT_GOLDEN,
];

