import { describe, it, expect } from "vitest";
import { demoClient } from "@/lib/api/client";
import { FIXTURE_INVOICE_REPLAY } from "@/mocks/fixtures";

describe("Payment Idempotency & Replay Protection", () => {
  it("returns existing payment attempt when request_payment is called multiple times on the same invoice", async () => {
    const attempt1 = await demoClient.requestPayment({
      invoice_id: FIXTURE_INVOICE_REPLAY.id,
      payer: "0x1234567890123456789012345678901234567890",
    });

    const attempt2 = await demoClient.requestPayment({
      invoice_id: FIXTURE_INVOICE_REPLAY.id,
      payer: "0x1234567890123456789012345678901234567890",
    });

    // Both calls MUST return the exact same payment attempt
    expect(attempt1.id).toBe(attempt2.id);
    expect(attempt1.flowId).toBe(attempt2.flowId);
    expect(attempt1.paymentRequestId).toBe(attempt2.paymentRequestId);
  });
});

