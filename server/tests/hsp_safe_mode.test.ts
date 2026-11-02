import { describe, it, expect } from "vitest";
import { HSPClientAdapter, HSPNotConnectedError, convertMinorToRawToken } from "../src/services/hsp.js";

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

  it("fails closed: createOrder throws HSPNotConnectedError when allowlisting is pending", async () => {
    const adapter = new HSPClientAdapter({
      isAllowlisted: false,
    });

    await expect(
      adapter.createOrder({
        invoiceId: "inv-test-fail-closed",
        payTo: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        payer: "0x1234567890123456789012345678901234567890",
        amountMinor: "500",
      })
    ).rejects.toThrowError(HSPNotConnectedError);

    try {
      await adapter.createOrder({
        invoiceId: "inv-test-fail-closed",
        payTo: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        payer: "0x1234567890123456789012345678901234567890",
        amountMinor: "500",
      });
    } catch (err: any) {
      expect(err.code).toBe("HSP_NOT_CONNECTED");
      expect(err.message).toContain("HashKey HSP QA is not yet connected");
    }
  });

  it("calculates exact BigInt token amounts for various token decimal configurations", () => {
    // 100 minor units ($1.00 USD)
    // 6 decimals (USDT/USDC): 100 * 10^(6-2) = 1,000,000
    expect(convertMinorToRawToken("100", 6)).toBe("1000000");
    // 18 decimals (HSK/DAI): 100 * 10^(18-2) = 10^18
    expect(convertMinorToRawToken("100", 18)).toBe("1000000000000000000");
    // 2 decimals: 100 * 10^0 = 100
    expect(convertMinorToRawToken("100", 2)).toBe("100");
  });

  it("preparePayment in testing mode locks quote for exactly 300 seconds (5 minutes)", async () => {
    const adapter = new HSPClientAdapter({
      isAllowlisted: false,
      allowSimulationForTesting: true,
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
    expect(prep.tokenTotalRaw).toBe("1000000");
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
