import { describe, it, expect } from "vitest";
import {
  HASHX_EIP712_DOMAIN,
  HASHX_EIP712_TYPES,
  computeInvoiceDigest,
  computeServiceTermsHash,
  stringToBytes32,
  buildInvoiceEIP712Message,
  HASHX_EVIDENCE_REGISTRY_ADDRESS,
} from "@/lib/crypto/eip712";
import { FIXTURE_INVOICE_GOLDEN } from "@/mocks/fixtures";

describe("EIP-712 Cryptographic Specification", () => {
  it("enforces canonical domain separator parameters", () => {
    expect(HASHX_EIP712_DOMAIN.name).toBe("HashX Global");
    expect(HASHX_EIP712_DOMAIN.version).toBe("1");
    expect(HASHX_EIP712_DOMAIN.chainId).toBe(133);
    expect(HASHX_EIP712_DOMAIN.verifyingContract.toLowerCase()).toBe(
      "0x19B861876D8075A11eC6c4596395b058fe8466C2".toLowerCase()
    );
  });

  it("has exactly 13 fields in HashXInvoice type definition conforming to PRD page 11", () => {
    const fields = HASHX_EIP712_TYPES.HashXInvoice.map((f) => f.name);
    expect(fields).toEqual([
      "invoiceId",
      "version",
      "seller",
      "buyerRefHash",
      "serviceType",
      "serviceTermsHash",
      "amountMinor",
      "currency",
      "payee",
      "paymentChainId",
      "nonce",
      "issuedAt",
      "expiresAt",
    ]);
  });

  it("computes deterministic EIP-712 digest", () => {
    const digest1 = computeInvoiceDigest(FIXTURE_INVOICE_GOLDEN, 133);
    const digest2 = computeInvoiceDigest(FIXTURE_INVOICE_GOLDEN, 133);
    expect(digest1).toBe(digest2);
    expect(digest1.startsWith("0x")).toBe(true);
    expect(digest1.length).toBe(66); // 32 bytes hex with 0x prefix
  });

  it("detects field mutation: changing payee alters the EIP-712 digest", () => {
    const originalDigest = computeInvoiceDigest(FIXTURE_INVOICE_GOLDEN, 133);

    const mutatedInvoice = {
      ...FIXTURE_INVOICE_GOLDEN,
      payment: {
        ...FIXTURE_INVOICE_GOLDEN.payment,
        payee: "0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe" as `0x${string}`, // Mutated payee
      },
    };

    const mutatedDigest = computeInvoiceDigest(mutatedInvoice, 133);
    expect(mutatedDigest).not.toBe(originalDigest);
  });

  it("detects field mutation: changing amount alters the EIP-712 digest", () => {
    const originalDigest = computeInvoiceDigest(FIXTURE_INVOICE_GOLDEN, 133);

    const mutatedInvoice = {
      ...FIXTURE_INVOICE_GOLDEN,
      payment: {
        ...FIXTURE_INVOICE_GOLDEN.payment,
        amount_minor: "500", // Mutated amount
      },
    };

    const mutatedDigest = computeInvoiceDigest(mutatedInvoice, 133);
    expect(mutatedDigest).not.toBe(originalDigest);
  });

  it("computes service terms hash deterministically", () => {
    const hash = computeServiceTermsHash(
      "0x0B306BF915C4d645ff596e518fAf3F9669b97016",
      "1205000",
      "1205250",
      "analytics_v1"
    );
    expect(hash.startsWith("0x")).toBe(true);
    expect(hash.length).toBe(66);
  });
});
