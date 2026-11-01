import { describe, it, expect } from "vitest";
import {
  formatMinorToUsd,
  parseUsdToMinor,
  formatRawTokenUnits,
  formatAddress,
  formatHash,
  getHSPStatusMeta,
  formatExpiryCountdown,
} from "@/lib/formatters";

describe("Financial and String Formatters", () => {
  it("formats minor units (cents) into USD correctly without floating-point errors", () => {
    expect(formatMinorToUsd("100")).toBe("$1.00");
    expect(formatMinorToUsd("250")).toBe("$2.50");
    expect(formatMinorToUsd("5")).toBe("$0.05");
    expect(formatMinorToUsd("0")).toBe("$0.00");
    expect(formatMinorToUsd("100000")).toBe("$1,000.00");
    expect(formatMinorToUsd(150)).toBe("$1.50");
  });

  it("parses USD string to minor units without loss", () => {
    expect(parseUsdToMinor("1.00")).toBe("100");
    expect(parseUsdToMinor("2.50")).toBe("250");
    expect(parseUsdToMinor("0.05")).toBe("5");
    expect(parseUsdToMinor("100")).toBe("10000");
  });

  it("formats raw token units accurately given decimals", () => {
    expect(formatRawTokenUnits("1000000", 6, "USDT")).toBe("1.00 USDT");
    expect(formatRawTokenUnits("2500000", 6, "USDT")).toBe("2.50 USDT");
    expect(formatRawTokenUnits("1000000000000000000", 18, "HSK")).toBe("1.00 HSK");
  });

  it("truncates addresses safely", () => {
    const addr = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
    expect(formatAddress(addr, 4)).toBe("0x742d...f44e");
  });

  it("truncates hashes safely", () => {
    const hash = "0x4b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c";
    expect(formatHash(hash, 6)).toBe("0x4b7c8d...5a6b7c");
  });

  it("preserves strict HSP payment-safe vs payment-finalized distinction", () => {
    const safeMeta = getHSPStatusMeta("payment-safe");
    const finalizedMeta = getHSPStatusMeta("payment-finalized");

    expect(safeMeta.category).toBe("safe");
    expect(safeMeta.label).toContain("Safe");
    expect(safeMeta.label).not.toContain("Finalized");

    expect(finalizedMeta.category).toBe("finalized");
    expect(finalizedMeta.label).toBe("Finalized");

    // payment-safe must NEVER equal finalized
    expect(safeMeta.category).not.toBe(finalizedMeta.category);
  });

  it("computes expiry countdown correctly", () => {
    const ref = new Date("2026-11-01T12:00:00Z");
    const future = new Date("2026-11-01T12:05:00Z").toISOString();
    const past = new Date("2026-11-01T11:59:00Z").toISOString();

    const futureRes = formatExpiryCountdown(future, ref);
    expect(futureRes.isExpired).toBe(false);
    expect(futureRes.secondsRemaining).toBe(300);

    const pastRes = formatExpiryCountdown(past, ref);
    expect(pastRes.isExpired).toBe(true);
    expect(pastRes.secondsRemaining).toBe(0);
  });
});
