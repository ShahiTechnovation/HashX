import { describe, it, expect } from "vitest";
import {
  computeInvoiceDigest,
  computeServiceTermsHash,
  verifyInvoice,
  buildInvoiceEIP712Message,
  HASHX_EIP712_DOMAIN,
  HASHX_EIP712_TYPES,
} from "../src/services/verification.js";
import { Invoice, Counterparty } from "../src/types.js";
import { keccak256, toBytes, getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Standard Anvil/Hardhat test EOA for cryptographic tests
const TEST_SIGNER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const testAccount = privateKeyToAccount(TEST_SIGNER_KEY);

const MOCK_TRUSTED_SELLER: Counterparty = {
  id: "cp-seller-01",
  displayName: "Nexus Analytics Agent (Node #42)",
  walletAddress: getAddress(testAccount.address),
  walletType: "EOA",
  status: "ACTIVE",
  createdAt: "2026-10-15T08:00:00Z",
};

async function createBaseInvoice(): Promise<Invoice> {
  const address = getAddress("0x5FbDB2315678afecb367f032d93F642f64180aa3");
  const startBlock = "1200000";
  const endBlock = "1200500";
  const acceptancePolicy = "analytics_v1";
  const termsHash = computeServiceTermsHash(address, startBlock, endBlock, acceptancePolicy);
  const buyerRef = "buyer-order-001";
  const buyerRefHash = keccak256(toBytes(buyerRef));

  const inv: Invoice = {
    id: "inv-test-mutation-001",
    version: 1,
    clientRequestId: "req-001",
    sellerId: MOCK_TRUSTED_SELLER.id,
    sellerDisplayName: MOCK_TRUSTED_SELLER.displayName,
    sellerWallet: getAddress(testAccount.address),
    buyerRef,
    buyerRefHash,
    service: {
      type: "hsk_address_analytics_v1",
      parameters: { address, start_block: startBlock, end_block: endBlock },
      acceptance_policy: acceptancePolicy,
    },
    serviceTermsHash: termsHash,
    payment: {
      currency: "USD",
      amount_minor: "100",
      payee: getAddress(testAccount.address),
      preferred_chain_id: 133,
    },
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    nonce: "1001",
    status: "SIGNED",
    createdAt: new Date().toISOString(),
    digest: "0x0" as `0x${string}`,
    signer: getAddress(testAccount.address),
  };

  inv.digest = computeInvoiceDigest(inv, 133);

  // Generate authentic cryptographic EIP-712 signature using private key
  const message = buildInvoiceEIP712Message(inv);
  const signature = await testAccount.signTypedData({
    domain: {
      ...HASHX_EIP712_DOMAIN,
      chainId: 133,
    },
    types: HASHX_EIP712_TYPES,
    primaryType: "HashXInvoice",
    message,
  });

  inv.signature = signature;
  return inv;
}

describe("Server-Side Real Cryptographic EIP-712 & Mutation Verification", () => {
  it("cryptographically verifies an untampered invoice signed with a real private key", async () => {
    const inv = await createBaseInvoice();
    const result = await verifyInvoice(inv, [MOCK_TRUSTED_SELLER]);
    expect(result.decision).toBe("PASS");
    expect(result.reasonCodes).toHaveLength(0);
    expect(result.checks.signature).toBe("PASS");
    expect(result.checks.terms_consistent).toBe("PASS");
    expect(result.checks.identity_binding).toBe("PASS");
    expect(result.checks.expiry).toBe("PASS");
    expect(result.signerRecovered?.toLowerCase()).toBe(testAccount.address.toLowerCase());
  });

  it("cryptographically detects in-flight payee alteration and permanently rejects", async () => {
    const inv = await createBaseInvoice();
    // Tamper with payee: seller signed for themselves, but attacker changed payee to attacker address
    inv.payment.payee = getAddress("0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe");
    const result = await verifyInvoice(inv, [MOCK_TRUSTED_SELLER]);
    expect(result.decision).toBe("FAIL");
    expect(result.checks.signature).toBe("FAIL");
    expect(result.reasonCodes).toContain("SIGNATURE_INVALID");
  });

  it("rejects when service terms parameters are mutated after signature", async () => {
    const inv = await createBaseInvoice();
    inv.service.parameters.end_block = "1200999";
    const result = await verifyInvoice(inv, [MOCK_TRUSTED_SELLER]);
    expect(result.decision).toBe("FAIL");
    expect(result.checks.terms_consistent).toBe("FAIL");
    expect(result.reasonCodes).toContain("TERMS_MUTATED");
  });

  it("rejects when seller wallet is not bound in trusted counterparty registry", async () => {
    const inv = await createBaseInvoice();
    const otherCounterparty: Counterparty = {
      id: "cp-other",
      displayName: "Other",
      walletAddress: getAddress("0x2222222222222222222222222222222222222222"),
      walletType: "EOA",
      status: "ACTIVE",
      createdAt: "",
    };
    const result = await verifyInvoice(inv, [otherCounterparty]);
    expect(result.decision).toBe("FAIL");
    expect(result.checks.identity_binding).toBe("FAIL");
    expect(result.reasonCodes).toContain("SELLER_UNBOUND");
  });

  it("rejects when invoice expiration timestamp is in the past", async () => {
    const inv = await createBaseInvoice();
    inv.expiresAt = new Date(Date.now() - 10000).toISOString();
    const result = await verifyInvoice(inv, [MOCK_TRUSTED_SELLER]);
    expect(result.decision).toBe("FAIL");
    expect(result.checks.expiry).toBe("FAIL");
    expect(result.reasonCodes).toContain("INVOICE_EXPIRED");
  });
});
