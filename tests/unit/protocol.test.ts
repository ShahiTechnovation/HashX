/**
 * Shared protocol v2 — the exact code used by the browser, the backend, MCP agents and the
 * standalone receipt verifier.
 */
import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import {
  canonicalJson,
  computeArtifactSha256,
  computeAuthorizationDigest,
  computeInvoiceDigest,
  computeServiceTermsHash,
  computeAddressAnalytics,
  invoiceTypedData,
  authorizationTypedData,
  recoverAuthorizationSigner,
  recoverInvoiceSigner,
  type InvoiceTerms,
  type PaymentAuthorization,
} from "@shared/protocol";
import {
  SEPOLIA,
  SEPOLIA_USDC_ADDRESS,
  HASHKEY_MAINNET,
  UnsupportedChainError,
  findNetwork,
  getNetwork,
  formatTokenAmount,
  parseTokenAmount,
  railSupportsChain,
} from "@shared/networks";

const seller = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const buyer = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");

const terms: InvoiceTerms = {
  invoiceId: "inv_0123456789abcdef0123456789abcdef",
  version: 1,
  seller: seller.address,
  buyer: buyer.address,
  buyerRefHash: keccak256(toBytes("PO-1")),
  serviceType: "evm_address_analytics_v1",
  serviceTermsHash: computeServiceTermsHash({
    serviceType: "evm_address_analytics_v1",
    deliveryChainId: 11155111,
    subjectAddress: "0x00000000000000000000000000000000000000aa",
    startBlock: 1,
    endBlock: 10,
    acceptancePolicy: "exact_recompute_v1",
  }),
  deliveryChainId: 11155111,
  settlementRail: "sepolia-usdc",
  settlementChainId: 11155111,
  token: SEPOLIA_USDC_ADDRESS,
  amount: "2500000",
  payee: seller.address,
  nonce: keccak256(toBytes("nonce")),
  issuedAt: 1_800_000_000,
  expiresAt: 1_800_086_400,
  signingChainId: 11155111,
};

describe("network configuration", () => {
  it("configures Sepolia with Circle's official test USDC (6 decimals) and an explorer", () => {
    expect(SEPOLIA.chainId).toBe(11155111);
    expect(SEPOLIA.settlementToken).toMatchObject({ address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6, isTestToken: true });
    expect(SEPOLIA.explorerUrl).toBe("https://sepolia.etherscan.io");
  });
  it("rejects unknown chains instead of defaulting to HashKey 133", () => {
    expect(findNetwork(1)).toBeUndefined();
    expect(() => getNetwork(999)).toThrow(UnsupportedChainError);
    expect(findNetwork(undefined)).toBeUndefined();
  });
  it("keeps HashKey Mainnet payment execution disabled by default and rails separate", () => {
    expect(HASHKEY_MAINNET.paymentExecutionEnabledByDefault).toBe(false);
    expect(railSupportsChain("sepolia-usdc", 11155111)).toBe(true);
    expect(railSupportsChain("sepolia-usdc", 133)).toBe(false);
    expect(railSupportsChain("hashkey-hsp", 11155111)).toBe(false);
  });
  it("uses exact integer token math (no floating point)", () => {
    expect(parseTokenAmount("2.5", 6)).toBe(2_500_000n);
    expect(parseTokenAmount("0.000001", 6)).toBe(1n);
    expect(() => parseTokenAmount("0.0000001", 6)).toThrow(/decimal places/);
    expect(() => parseTokenAmount("1e3", 6)).toThrow();
    expect(formatTokenAmount("123456789012345678901", 6)).toBe("123456789012345.678901");
    expect(formatTokenAmount(2_500_000n, 6)).toBe("2.5");
  });
});

describe("canonical JSON & artifact hashing", () => {
  it("is key-order independent and whitespace free", () => {
    expect(canonicalJson({ b: 1, a: [true, null, "x"] })).toBe('{"a":[true,null,"x"],"b":1}');
    expect(computeArtifactSha256({ a: 1, b: 2 })).toBe(computeArtifactSha256({ b: 2, a: 1 }));
  });
  it("detects any byte change", () => {
    expect(computeArtifactSha256({ count: 23 })).not.toBe(computeArtifactSha256({ count: 24 }));
  });
  it("rejects ambiguous values instead of silently dropping or rounding them", () => {
    expect(() => canonicalJson({ v: 1.5 })).toThrow();
    expect(() => canonicalJson({ v: undefined })).toThrow();
    expect(() => canonicalJson({ v: 10n })).toThrow();
    expect(() => canonicalJson({ v: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
  });
});

describe("EIP-712 invoice signatures (mutation tests)", () => {
  it("recovers the seller over the canonical terms", async () => {
    const sig = await seller.signTypedData(invoiceTypedData(terms));
    expect(await recoverInvoiceSigner(terms, sig)).toBe(seller.address);
  });
  const mutations: Array<[string, Partial<InvoiceTerms>]> = [
    ["amount", { amount: "2500001" }],
    ["payee", { payee: buyer.address }],
    ["buyer", { buyer: seller.address }],
    ["token", { token: "0x0000000000000000000000000000000000000001" }],
    ["settlement chain", { settlementChainId: 133 }],
    ["signing chain (domain)", { signingChainId: 133 }],
    ["rail", { settlementRail: "hashkey-hsp" }],
    ["service terms", { serviceTermsHash: keccak256(toBytes("other")) }],
    ["expiry", { expiresAt: terms.expiresAt + 1 }],
    ["nonce", { nonce: keccak256(toBytes("n2")) }],
    ["invoice id", { invoiceId: "inv_ffffffffffffffffffffffffffffffff" }],
  ];
  for (const [name, change] of mutations) {
    it(`a signature does not survive a mutated ${name}`, async () => {
      const sig = await seller.signTypedData(invoiceTypedData(terms));
      const mutated = { ...terms, ...change };
      expect(computeInvoiceDigest(mutated)).not.toBe(computeInvoiceDigest(terms));
      expect(await recoverInvoiceSigner(mutated, sig)).not.toBe(seller.address);
    });
  }
  it("returns null for malformed signatures instead of throwing", async () => {
    expect(await recoverInvoiceSigner(terms, "0x1234")).toBeNull();
  });
});

describe("EIP-712 payment authorization binds the full obligation", () => {
  const auth: PaymentAuthorization = {
    attemptId: "pay_0123456789abcdef0123456789abcdef",
    invoiceId: terms.invoiceId,
    invoiceDigest: computeInvoiceDigest(terms),
    deliveryEvidenceDigest: keccak256(toBytes("manifest")),
    payer: buyer.address,
    payee: seller.address,
    token: SEPOLIA_USDC_ADDRESS,
    chainId: 11155111,
    amount: "2500000",
    settlementRail: "sepolia-usdc",
    nonce: keccak256(toBytes("auth-nonce")),
    expiresAt: 1_800_000_900,
  };
  it("recovers the payer", async () => {
    const sig = await buyer.signTypedData(authorizationTypedData(auth));
    expect(await recoverAuthorizationSigner(auth, sig)).toBe(buyer.address);
  });
  for (const field of ["payer", "payee", "token", "chainId", "amount", "attemptId", "invoiceDigest", "deliveryEvidenceDigest", "nonce", "expiresAt"] as const) {
    it(`changing ${field} invalidates the authorization`, async () => {
      const sig = await buyer.signTypedData(authorizationTypedData(auth));
      const v: any = { ...auth };
      v[field] =
        field === "chainId" ? 133 : field === "expiresAt" ? auth.expiresAt + 1 : field === "amount" ? "1" : ["payer", "payee", "token"].includes(field) ? "0x0000000000000000000000000000000000000002" : field === "attemptId" ? "pay_other" : keccak256(toBytes(field));
      expect(computeAuthorizationDigest(v)).not.toBe(computeAuthorizationDigest(auth));
      expect(await recoverAuthorizationSigner(v, sig)).not.toBe(buyer.address);
    });
  }
});

describe("address analytics", () => {
  const S = "0x00000000000000000000000000000000000000aa";
  const blocks = [
    { number: 1n, transactions: [{ hash: "0x" + "1".repeat(64), from: S, to: "0x00000000000000000000000000000000000000bb", value: 5n }] },
    { number: 2n, transactions: [{ hash: "0x" + "2".repeat(64), from: "0x00000000000000000000000000000000000000BB", to: S, value: 7n }] },
  ];
  it("is deterministic and recomputable", () => {
    const { artifact } = computeAddressAnalytics({ chainId: 1, address: S, startBlock: 1, endBlock: 2, blocks, maxSamples: 10 });
    expect(artifact).toMatchObject({ transaction_count: 2, native_value_in_raw: "7", native_value_out_raw: "5", counterparties: [{ address: "0x00000000000000000000000000000000000000bb", tx_count: 2 }] });
  });
  it("refuses incomplete block coverage", () => {
    expect(() => computeAddressAnalytics({ chainId: 1, address: S, startBlock: 1, endBlock: 3, blocks, maxSamples: 10 })).toThrow(/full requested range/);
  });
});
