import { describe, it, expect } from "vitest";
import { HSPClientAdapter } from "../src/services/hsp.js";

describe("HSP Adapter Safe Mode & Protocol Constraints", () => {
  it("safe mode active when allowlisting is not confirmed: live connection safely blocked", async () => {
    const adapter = new HSPClientAdapter({
      isAllowlisted: false,
      merchantName: "HashX",
      appKey: "",
    });

    expect(adapter.isConfiguredForLive()).toBe(false);
    const initResult = await adapter.initialize();
    expect(initResult.connected).toBe(false);
    expect(initResult.message).toContain("PENDING CONFIRMATION");
  });

  it("preparePayment locks quote for exactly 300 seconds (5 minutes)", async () => {
    const adapter = new HSPClientAdapter({
      isAllowlisted: false,
    });

    const now = Date.now();
    const prep = await adapter.preparePayment({
      flowId: "flow-test-01",
      paymentRequestId: "pr-test-01",
      payer: "0x1234567890123456789012345678901234567890",
      payee: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      amountMinor: "100",
      chainId: 133,
    });

    const expiryTime = new Date(prep.quoteExpiresAt).getTime();
    const diffSeconds = Math.round((expiryTime - now) / 1000);

    // Should be approximately 300 seconds (5 minutes)
    expect(diffSeconds).toBeGreaterThanOrEqual(295);
    expect(diffSeconds).toBeLessThanOrEqual(305);
    expect(prep.eip712Payload.primaryType).toBe("PermitTransferFrom");
  });

  it("queryPayment in safe mode returns payment-submitted without connecting to remote server", async () => {
    const adapter = new HSPClientAdapter({
      isAllowlisted: false,
    });

    const queryResult = await adapter.queryPayment({
      flowId: "flow-local-01",
      paymentRequestId: "pr-local-01",
    });

    expect(queryResult.status).toBe("payment-submitted");
    expect(queryResult.details.mode).toBe("local-unconfirmed");
  });
});

