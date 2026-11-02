import {
  hashTypedData,
  keccak256,
  stringToHex,
  padHex,
  toBytes,
  encodePacked,
  verifyTypedData,
  getAddress,
} from "viem";
import { Address, Hash, Invoice } from "@/types/domain";

// Invoice EIP-712 Domain Verifying Contract
export const HASHX_EIP712_VERIFYING_CONTRACT: Address = getAddress(
  "0x19b861876D8075A11EC6C4596395B058fe8466c2"
);

// On-Chain Evidence Registry Contract (Separated from EIP-712 domain and token)
// Returns null when not deployed on-chain
export const HASHX_EVIDENCE_REGISTRY_ADDRESS: Address | null = process.env.NEXT_PUBLIC_EVIDENCE_REGISTRY_ADDRESS
  ? getAddress(process.env.NEXT_PUBLIC_EVIDENCE_REGISTRY_ADDRESS)
  : null;

export function isEvidenceRegistryDeployed(): boolean {
  return Boolean(
    HASHX_EVIDENCE_REGISTRY_ADDRESS &&
    HASHX_EVIDENCE_REGISTRY_ADDRESS !== "0x0000000000000000000000000000000000000000"
  );
}

// HSP Payment Token & Settlement Contracts (Distinct from Evidence Registry)
export const HSP_TESTNET_TOKEN_ADDRESS: Address = "0x19B861876D8075A11eC6c4596395b058fe8466C2";
export const HSP_TESTNET_SPENDER_CONTRACT: Address = "0x6969696969696969696969696969696969696969";

export const HASHX_EIP712_DOMAIN = {
  name: "HashX Global",
  version: "1",
  chainId: 133, // HashKey Chain Testnet default
  verifyingContract: HASHX_EIP712_VERIFYING_CONTRACT,
} as const;

export const HASHX_EIP712_TYPES = {
  HashXInvoice: [
    { name: "invoiceId", type: "bytes32" },
    { name: "version", type: "uint256" },
    { name: "seller", type: "address" },
    { name: "buyerRefHash", type: "bytes32" },
    { name: "serviceType", type: "bytes32" },
    { name: "serviceTermsHash", type: "bytes32" },
    { name: "amountMinor", type: "uint256" },
    { name: "currency", type: "bytes32" },
    { name: "payee", type: "address" },
    { name: "paymentChainId", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "issuedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

/**
 * Converts a string identifier (like a UUID) into bytes32 representation.
 */
export function stringToBytes32(str: string): Hash {
  const clean = str.replace(/-/g, "");
  if (clean.length <= 64) {
    const hex = stringToHex(clean);
    return padHex(hex, { size: 32, dir: "right" });
  }
  return keccak256(toBytes(str));
}

/**
 * Computes deterministic EIP-712 typed-data message payload for an invoice.
 */
export function buildInvoiceEIP712Message(invoice: Invoice) {
  const issuedAtSeconds = Math.floor(new Date(invoice.issuedAt).getTime() / 1000);
  const expiresAtSeconds = Math.floor(new Date(invoice.expiresAt).getTime() / 1000);

  return {
    invoiceId: stringToBytes32(invoice.id),
    version: BigInt(invoice.version || 1),
    seller: getAddress(invoice.sellerWallet),
    buyerRefHash: invoice.buyerRefHash,
    serviceType: stringToBytes32(invoice.service.type),
    serviceTermsHash: invoice.serviceTermsHash,
    amountMinor: BigInt(invoice.payment.amount_minor),
    currency: stringToBytes32(invoice.payment.currency),
    payee: getAddress(invoice.payment.payee),
    paymentChainId: BigInt(invoice.payment.preferred_chain_id),
    nonce: BigInt(invoice.nonce),
    issuedAt: BigInt(issuedAtSeconds),
    expiresAt: BigInt(expiresAtSeconds),
  };
}

/**
 * Computes the canonical EIP-712 digest for a HashX invoice.
 */
export function computeInvoiceDigest(invoice: Invoice, chainId = 133): Hash {
  const domain = {
    ...HASHX_EIP712_DOMAIN,
    chainId,
  };

  const message = buildInvoiceEIP712Message(invoice);

  return hashTypedData({
    domain,
    types: HASHX_EIP712_TYPES,
    primaryType: "HashXInvoice",
    message,
  });
}

/**
 * Computes a hash of service parameters (address, start_block, end_block).
 */
export function computeServiceTermsHash(
  address: Address,
  startBlock: string,
  endBlock: string,
  acceptancePolicy = "analytics_v1"
): Hash {
  return keccak256(
    encodePacked(
      ["address", "string", "string", "string"],
      [getAddress(address), startBlock, endBlock, acceptancePolicy]
    )
  );
}

/**
 * Generates the full typed data object suitable for eth_signTypedData_v4.
 */
export function generateInvoiceTypedData(invoice: Invoice, chainId = 133) {
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      HashXInvoice: HASHX_EIP712_TYPES.HashXInvoice,
    },
    primaryType: "HashXInvoice",
    domain: {
      ...HASHX_EIP712_DOMAIN,
      chainId,
    },
    message: buildInvoiceEIP712Message(invoice),
  };
}

/**
 * Verifies an EIP-712 signature against the invoice and declared signer.
 */
export async function verifyInvoiceSignature(
  invoice: Invoice,
  signature: Hash,
  expectedSigner: Address,
  chainId = 133
): Promise<boolean> {
  try {
    const domain = {
      ...HASHX_EIP712_DOMAIN,
      chainId,
    };
    const message = buildInvoiceEIP712Message(invoice);

    const valid = await verifyTypedData({
      address: getAddress(expectedSigner),
      domain,
      types: HASHX_EIP712_TYPES,
      primaryType: "HashXInvoice",
      message,
      signature,
    });

    return valid;
  } catch (err) {
    console.error("Signature verification failed:", err);
    return false;
  }
}
