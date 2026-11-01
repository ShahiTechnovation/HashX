import { describe, it, expect } from "vitest";
import {
  verifyInvoice,
  verifyDelivery,
  evaluatePaymentEligibility,
} from "@/lib/verification/engine";
import {
  FIXTURE_INVOICE_GOLDEN,
  FIXTURE_DELIVERY_GOLDEN,
  FIXTURE_INVOICE_TAMPERED,
  FIXTURE_INVOICE_FAKE_DELIVERY,
  FIXTURE_DELIVERY_FAKE_COUNT,
  MOCK_COUNTERPARTIES,
} from "@/mocks/fixtures";

describe("Trust & Verification Engine", () => {
  it("passes all 6 checks for a valid, signed golden invoice", () => {
    const result = verifyInvoice(FIXTURE_INVOICE_GOLDEN, MOCK_COUNTERPARTIES);
    expect(result.decision).toBe("PASS");
    expect(result.checks.schema).toBe("PASS");
    expect(result.checks.signature).toBe("PASS");
    expect(result.checks.identity_binding).toBe("PASS");
    expect(result.checks.expiry).toBe("PASS");
    expect(result.checks.nonce_unused).toBe("PASS");
    expect(result.checks.terms_consistent).toBe("PASS");
    expect(result.reasonCodes).toHaveLength(0);
  });

  it("detects tampered invoice signature and rejects with SIGNATURE_INVALID", () => {
    const result = verifyInvoice(FIXTURE_INVOICE_TAMPERED, MOCK_COUNTERPARTIES);
    expect(result.decision).toBe("FAIL");
    expect(result.checks.signature).toBe("FAIL");
    expect(result.reasonCodes).toContain("SIGNATURE_INVALID");
  });

  it("detects seller counterparty unbound to active registry", () => {
    const unboundInvoice = {
      ...FIXTURE_INVOICE_GOLDEN,
      sellerWallet: "0x000000000000000000000000000000000000dEaD" as `0x${string}`,
    };
    const result = verifyInvoice(unboundInvoice, MOCK_COUNTERPARTIES);
    expect(result.decision).toBe("FAIL");
    expect(result.checks.identity_binding).toBe("FAIL");
    expect(result.reasonCodes).toContain("SELLER_UNBOUND");
  });

  it("detects expired invoice and returns INVOICE_EXPIRED", () => {
    const expiredInvoice = {
      ...FIXTURE_INVOICE_GOLDEN,
      expiresAt: "2020-01-01T00:00:00Z",
    };
    const result = verifyInvoice(expiredInvoice, MOCK_COUNTERPARTIES);
    expect(result.decision).toBe("FAIL");
    expect(result.checks.expiry).toBe("FAIL");
    expect(result.reasonCodes).toContain("INVOICE_EXPIRED");
  });

  it("detects reused nonce and returns REPLAY_NONCE_REUSED", () => {
    const usedNonces = new Set([
      `${FIXTURE_INVOICE_GOLDEN.sellerWallet.toLowerCase()}:${FIXTURE_INVOICE_GOLDEN.nonce}`,
    ]);
    const result = verifyInvoice(FIXTURE_INVOICE_GOLDEN, MOCK_COUNTERPARTIES, usedNonces);
    expect(result.decision).toBe("FAIL");
    expect(result.checks.nonce_unused).toBe("FAIL");
    expect(result.reasonCodes).toContain("REPLAY_NONCE_REUSED");
  });

  it("passes all 8 delivery checks for valid golden fulfillment artifact", () => {
    const result = verifyDelivery(FIXTURE_INVOICE_GOLDEN, FIXTURE_DELIVERY_GOLDEN);
    expect(result.decision).toBe("PASS");
    expect(result.checks.manifest_signature).toBe("PASS");
    expect(result.checks.artifact_hash).toBe("PASS");
    expect(result.checks.schema).toBe("PASS");
    expect(result.checks.requested_address).toBe("PASS");
    expect(result.checks.block_range).toBe("PASS");
    expect(result.checks.transaction_count).toBe("PASS");
    expect(result.checks.sample_transaction_proofs).toBe("PASS");
    expect(result.checks.freshness).toBe("PASS");
    expect(result.reasonCodes).toHaveLength(0);
  });

  it("detects transaction count mismatch against RPC recomputation with TX_COUNT_MISMATCH", () => {
    // Seller claimed 23 transactions, RPC finds 17
    const result = verifyDelivery(FIXTURE_INVOICE_FAKE_DELIVERY, FIXTURE_DELIVERY_FAKE_COUNT, 17);
    expect(result.decision).toBe("FAIL");
    expect(result.checks.transaction_count).toBe("FAIL");
    expect(result.reasonCodes).toContain("TX_COUNT_MISMATCH");
  });

  it("detects artifact byte tampering with ARTIFACT_TAMPERED", () => {
    const tamperedDelivery = {
      ...FIXTURE_DELIVERY_GOLDEN,
      artifactSha256: "0000000000000000000000000000000000000000000000000000000000000000",
    };
    const result = verifyDelivery(FIXTURE_INVOICE_GOLDEN, tamperedDelivery);
    expect(result.decision).toBe("FAIL");
    expect(result.checks.artifact_hash).toBe("FAIL");
    expect(result.reasonCodes).toContain("ARTIFACT_TAMPERED");
  });

  it("enforces payment gating: unlocks payment ONLY when both invoice and delivery pass", () => {
    const validInv = verifyInvoice(FIXTURE_INVOICE_GOLDEN, MOCK_COUNTERPARTIES);
    const validDel = verifyDelivery(FIXTURE_INVOICE_GOLDEN, FIXTURE_DELIVERY_GOLDEN);
    const passElig = evaluatePaymentEligibility(validInv, validDel);
    expect(passElig.isEligibleForPayment).toBe(true);
    expect(passElig.overallDecision).toBe("PASS");

    // Without delivery, payment is gated
    const pendingElig = evaluatePaymentEligibility(validInv, undefined);
    expect(pendingElig.isEligibleForPayment).toBe(false);
    expect(pendingElig.overallDecision).toBe("PENDING");

    // With failed delivery, payment is gated
    const badDel = verifyDelivery(FIXTURE_INVOICE_FAKE_DELIVERY, FIXTURE_DELIVERY_FAKE_COUNT, 17);
    const failElig = evaluatePaymentEligibility(validInv, badDel);
    expect(failElig.isEligibleForPayment).toBe(false);
    expect(failElig.overallDecision).toBe("FAIL");
  });
});
