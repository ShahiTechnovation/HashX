import { describe, it, expect } from "vitest";
import {
  verifyDelivery,
  evaluatePaymentEligibility,
  verifyInvoice,
} from "../src/services/verification.js";
import { Invoice, Delivery } from "../src/types.js";

function getFixtures() {
  const invoice: Invoice = {
    id: "inv-del-test-01",
    version: 1,
    clientRequestId: "req-del-01",
    sellerId: "cp-seller-01",
    sellerDisplayName: "Nexus Analytics Agent",
    sellerWallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    buyerRef: "buyer-ref-del",
    buyerRefHash: "0x3a4b9c1d8e7f2a1b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
    service: {
      type: "hsk_address_analytics_v1",
      parameters: {
        address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
        start_block: "1201000",
        end_block: "1201500",
      },
      acceptance_policy: "analytics_v1",
    },
    serviceTermsHash: "0x11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff",
    payment: {
      currency: "USD",
      amount_minor: "100",
      payee: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      preferred_chain_id: 133,
    },
    issuedAt: "2026-10-31T10:00:00Z",
    expiresAt: "2026-11-05T10:00:00Z",
    nonce: "4444",
    status: "SIGNED",
    createdAt: "2026-10-31T10:00:00Z",
    digest: "0x1111111111111111111111111111111111111111111111111111111111111111",
    signature: "0xsimulated_sig",
    signer: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    signatureValid: true,
  };

  const artifactSha256 = "0x8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b";

  const delivery: Delivery = {
    id: "del-test-01",
    invoiceId: invoice.id,
    version: 1,
    artifactUri: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    artifactSha256,
    manifest: {
      schema: "hashx.delivery.analytics.v1",
      invoice_id: invoice.id,
      seller: invoice.sellerWallet,
      artifact_sha256: artifactSha256,
      generated_at: "2026-10-31T11:00:00Z",
    },
    manifestSignature: "0xmanifest_sig_valid",
    status: "PENDING_VERIFICATION",
    submittedAt: "2026-10-31T11:05:00Z",
    artifactContent: {
      schema: "hashx.analytics.v1",
      chain_id: 133,
      address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
      start_block: 1201000,
      end_block: 1201500,
      transaction_count: 17,
      native_value_in_raw: "5000000000000000000",
      native_value_out_raw: "2500000000000000000",
      counterparties: [{ address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", tx_count: 17 }],
      sample_transactions: [{ hash: "0xabcdef123456", block_number: 1201200 }],
      generated_at: "2026-10-31T11:00:00Z",
    },
  };

  return { invoice, delivery };
}

describe("Server-Side Delivery Fulfillment & Policy Firewall", () => {
  it("accepts valid delivery when all deterministic checks and RPC counts match", async () => {
    const { invoice, delivery } = getFixtures();
    const result = await verifyDelivery(invoice, delivery, 17);
    expect(result.decision).toBe("PASS");
    expect(result.reasonCodes).toHaveLength(0);
    expect(result.checks.transaction_count).toBe("PASS");
    expect(result.checks.artifact_hash).toBe("PASS");
  });

  it("rejects delivery when transaction count recomputation detects mismatch (Scenario B)", async () => {
    const { invoice, delivery } = getFixtures();
    delivery.artifactContent.transaction_count = 23; // Seller claims 23, but actual on-chain is 17
    const result = await verifyDelivery(invoice, delivery, 17);
    expect(result.decision).toBe("FAIL");
    expect(result.checks.transaction_count).toBe("FAIL");
    expect(result.reasonCodes).toContain("TX_COUNT_MISMATCH");
    expect(result.checkDetails.transaction_count.actual).toContain("23");
  });

  it("rejects delivery when artifact byte hash does not match signed manifest commitment", async () => {
    const { invoice, delivery } = getFixtures();
    delivery.artifactSha256 = "0x9999999999999999999999999999999999999999999999999999999999999999";
    const result = await verifyDelivery(invoice, delivery, 17);
    expect(result.decision).toBe("FAIL");
    expect(result.checks.artifact_hash).toBe("FAIL");
    expect(result.reasonCodes).toContain("ARTIFACT_TAMPERED");
  });

  it("rejects delivery when block range differs from invoice agreement", async () => {
    const { invoice, delivery } = getFixtures();
    delivery.artifactContent.start_block = 1200000;
    const result = await verifyDelivery(invoice, delivery, 17);
    expect(result.decision).toBe("FAIL");
    expect(result.checks.block_range).toBe("FAIL");
    expect(result.reasonCodes).toContain("BLOCK_RANGE_MISMATCH");
  });

  it("strictly gates payment eligibility: blocked when delivery fails", async () => {
    const { invoice, delivery } = getFixtures();
    delivery.artifactContent.transaction_count = 99; // fraudulent
    const delResult = await verifyDelivery(invoice, delivery, 17);

    const invResult = {
      decision: "PASS" as const,
      checks: {} as any,
      checkDetails: {},
      invoiceDigest: invoice.digest,
      reasonCodes: [],
      verifierVersion: "1.0",
      verifiedAt: "",
    };

    const combined = evaluatePaymentEligibility(invResult, delResult);
    expect(combined.isEligibleForPayment).toBe(false);
    expect(combined.overallDecision).toBe("FAIL");
    expect(combined.eligibilityExplanation).toContain("Payment blocked");
  });
});

