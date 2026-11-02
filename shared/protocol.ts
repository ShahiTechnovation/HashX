/**
 * HashX protocol v2 — canonical commitments shared by frontend, backend, agents and verifiers.
 *
 * Everything that is signed or hashed is defined exactly once here so that the
 * browser, the API, MCP agents and the standalone receipt verifier compute
 * byte-identical digests.
 *
 * Commitment formats (documented in docs/SECURITY_MODEL.md):
 *  - Invoice digest           = EIP-712 hashTypedData(HashXInvoice)            domain: {name:"HashX", version:"2", chainId: signingChainId}
 *  - Service terms hash       = keccak256(abi.encode(string,uint256,address,uint64,uint64,string))
 *  - Artifact SHA-256         = sha256(utf8(canonicalJson(artifact)))
 *  - Delivery evidence digest = EIP-712 hashTypedData(HashXDeliveryManifest)
 *  - Authorization digest     = EIP-712 hashTypedData(HashXPaymentAuthorization) domain chainId = settlement chain
 *  - Receipt digest           = keccak256(utf8(canonicalJson(receiptBody)))
 */
import {
  encodeAbiParameters,
  getAddress,
  hashTypedData,
  keccak256,
  recoverTypedDataAddress,
  sha256,
  toBytes,
  type TypedDataDomain,
} from "viem";

type Hex = `0x${string}`;
type Address = `0x${string}`;

export const PROTOCOL_VERSION = "2";
export const EIP712_DOMAIN_NAME = "HashX";

export function hashxDomain(chainId: number): TypedDataDomain {
  return { name: EIP712_DOMAIN_NAME, version: PROTOCOL_VERSION, chainId };
}

// ---------------------------------------------------------------------------
// Canonical JSON (RFC 8785-style subset)
// ---------------------------------------------------------------------------

/**
 * Deterministic JSON serialization:
 *  - object keys sorted by UTF-16 code unit order, no insignificant whitespace;
 *  - only safe integers are permitted as numbers (floats/NaN/Infinity rejected —
 *    encode large or fractional values as decimal strings);
 *  - `undefined`, functions, symbols and bigint are rejected rather than dropped.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "string":
      return JSON.stringify(value);
    case "number":
      if (!Number.isSafeInteger(value)) {
        throw new CanonicalizationError(`Non-integer or unsafe number not permitted in canonical JSON: ${value}`);
      }
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(",")}]`;
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        throw new CanonicalizationError("Only plain objects are permitted in canonical JSON");
      }
      const entries = Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => {
          const v = (value as Record<string, unknown>)[k];
          if (v === undefined) throw new CanonicalizationError(`Undefined value for key "${k}"`);
          return `${JSON.stringify(k)}:${canonicalJson(v)}`;
        });
      return `{${entries.join(",")}}`;
    }
    default:
      throw new CanonicalizationError(`Unsupported type in canonical JSON: ${typeof value}`);
  }
}

export class CanonicalizationError extends Error {
  readonly code = "CANONICALIZATION_ERROR";
}

/** SHA-256 over the canonical UTF-8 bytes of an artifact. */
export function computeArtifactSha256(artifact: unknown): Hex {
  return sha256(toBytes(canonicalJson(artifact)));
}

export function keccakCanonical(value: unknown): Hex {
  return keccak256(toBytes(canonicalJson(value)));
}

// ---------------------------------------------------------------------------
// Service terms
// ---------------------------------------------------------------------------

export interface ServiceTermsInput {
  serviceType: string;
  deliveryChainId: number;
  subjectAddress: Address;
  startBlock: bigint | number | string;
  endBlock: bigint | number | string;
  acceptancePolicy: string;
}

export function computeServiceTermsHash(t: ServiceTermsInput): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "string" },
        { type: "uint256" },
        { type: "address" },
        { type: "uint64" },
        { type: "uint64" },
        { type: "string" },
      ],
      [
        t.serviceType,
        BigInt(t.deliveryChainId),
        getAddress(t.subjectAddress),
        BigInt(t.startBlock),
        BigInt(t.endBlock),
        t.acceptancePolicy,
      ]
    )
  );
}

export function computeBuyerRefHash(buyerRef: string): Hex {
  return keccak256(toBytes(buyerRef));
}

// ---------------------------------------------------------------------------
// Invoice (EIP-712)
// ---------------------------------------------------------------------------

export const INVOICE_TYPES = {
  HashXInvoice: [
    { name: "invoiceId", type: "string" },
    { name: "version", type: "uint32" },
    { name: "seller", type: "address" },
    { name: "buyer", type: "address" },
    { name: "buyerRefHash", type: "bytes32" },
    { name: "serviceType", type: "string" },
    { name: "serviceTermsHash", type: "bytes32" },
    { name: "deliveryChainId", type: "uint256" },
    { name: "settlementRail", type: "string" },
    { name: "settlementChainId", type: "uint256" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "payee", type: "address" },
    { name: "nonce", type: "bytes32" },
    { name: "issuedAt", type: "uint64" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export interface InvoiceTerms {
  invoiceId: string;
  version: number;
  seller: Address;
  buyer: Address;
  buyerRefHash: Hex;
  serviceType: string;
  serviceTermsHash: Hex;
  deliveryChainId: number;
  settlementRail: string;
  settlementChainId: number;
  token: Address;
  /** Raw integer token units, as a decimal string. */
  amount: string;
  payee: Address;
  nonce: Hex;
  /** Unix seconds. */
  issuedAt: number;
  /** Unix seconds. */
  expiresAt: number;
  /** Chain ID used in the EIP-712 domain (the chain the seller wallet signed on). */
  signingChainId: number;
}

function invoiceMessage(t: InvoiceTerms) {
  return {
    invoiceId: t.invoiceId,
    version: t.version,
    seller: getAddress(t.seller),
    buyer: getAddress(t.buyer),
    buyerRefHash: t.buyerRefHash,
    serviceType: t.serviceType,
    serviceTermsHash: t.serviceTermsHash,
    deliveryChainId: BigInt(t.deliveryChainId),
    settlementRail: t.settlementRail,
    settlementChainId: BigInt(t.settlementChainId),
    token: getAddress(t.token),
    amount: BigInt(t.amount),
    payee: getAddress(t.payee),
    nonce: t.nonce,
    issuedAt: BigInt(t.issuedAt),
    expiresAt: BigInt(t.expiresAt),
  };
}

export function invoiceTypedData(t: InvoiceTerms) {
  return {
    domain: hashxDomain(t.signingChainId),
    types: INVOICE_TYPES,
    primaryType: "HashXInvoice" as const,
    message: invoiceMessage(t),
  };
}

export function computeInvoiceDigest(t: InvoiceTerms): Hex {
  return hashTypedData(invoiceTypedData(t));
}

// ---------------------------------------------------------------------------
// Delivery manifest (EIP-712)
// ---------------------------------------------------------------------------

export const DELIVERY_MANIFEST_SCHEMA = "hashx.delivery.manifest.v2";

export const MANIFEST_TYPES = {
  HashXDeliveryManifest: [
    { name: "schema", type: "string" },
    { name: "invoiceId", type: "string" },
    { name: "invoiceDigest", type: "bytes32" },
    { name: "seller", type: "address" },
    { name: "deliveryVersion", type: "uint32" },
    { name: "deliveryChainId", type: "uint256" },
    { name: "serviceTermsHash", type: "bytes32" },
    { name: "artifactSha256", type: "bytes32" },
    { name: "artifactUri", type: "string" },
    { name: "generatedAt", type: "uint64" },
  ],
} as const;

export interface DeliveryManifest {
  schema: string;
  invoiceId: string;
  invoiceDigest: Hex;
  seller: Address;
  deliveryVersion: number;
  deliveryChainId: number;
  serviceTermsHash: Hex;
  artifactSha256: Hex;
  artifactUri: string;
  /** Unix seconds. */
  generatedAt: number;
}

export function manifestTypedData(m: DeliveryManifest, signingChainId: number) {
  return {
    domain: hashxDomain(signingChainId),
    types: MANIFEST_TYPES,
    primaryType: "HashXDeliveryManifest" as const,
    message: {
      schema: m.schema,
      invoiceId: m.invoiceId,
      invoiceDigest: m.invoiceDigest,
      seller: getAddress(m.seller),
      deliveryVersion: m.deliveryVersion,
      deliveryChainId: BigInt(m.deliveryChainId),
      serviceTermsHash: m.serviceTermsHash,
      artifactSha256: m.artifactSha256,
      artifactUri: m.artifactUri,
      generatedAt: BigInt(m.generatedAt),
    },
  };
}

export function computeManifestDigest(m: DeliveryManifest, signingChainId: number): Hex {
  return hashTypedData(manifestTypedData(m, signingChainId));
}

// ---------------------------------------------------------------------------
// Payment authorization (EIP-712) — Stage 2 wallet authorization
// ---------------------------------------------------------------------------

export const AUTHORIZATION_TYPES = {
  HashXPaymentAuthorization: [
    { name: "attemptId", type: "string" },
    { name: "invoiceId", type: "string" },
    { name: "invoiceDigest", type: "bytes32" },
    { name: "deliveryEvidenceDigest", type: "bytes32" },
    { name: "payer", type: "address" },
    { name: "payee", type: "address" },
    { name: "token", type: "address" },
    { name: "chainId", type: "uint256" },
    { name: "amount", type: "uint256" },
    { name: "settlementRail", type: "string" },
    { name: "nonce", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export interface PaymentAuthorization {
  attemptId: string;
  invoiceId: string;
  invoiceDigest: Hex;
  deliveryEvidenceDigest: Hex;
  payer: Address;
  payee: Address;
  token: Address;
  chainId: number;
  /** Raw integer token units, as a decimal string. */
  amount: string;
  settlementRail: string;
  nonce: Hex;
  /** Unix seconds. */
  expiresAt: number;
}

export function authorizationTypedData(a: PaymentAuthorization) {
  return {
    domain: hashxDomain(a.chainId),
    types: AUTHORIZATION_TYPES,
    primaryType: "HashXPaymentAuthorization" as const,
    message: {
      attemptId: a.attemptId,
      invoiceId: a.invoiceId,
      invoiceDigest: a.invoiceDigest,
      deliveryEvidenceDigest: a.deliveryEvidenceDigest,
      payer: getAddress(a.payer),
      payee: getAddress(a.payee),
      token: getAddress(a.token),
      chainId: BigInt(a.chainId),
      amount: BigInt(a.amount),
      settlementRail: a.settlementRail,
      nonce: a.nonce,
      expiresAt: BigInt(a.expiresAt),
    },
  };
}

export function computeAuthorizationDigest(a: PaymentAuthorization): Hex {
  return hashTypedData(authorizationTypedData(a));
}

// ---------------------------------------------------------------------------
// Signature recovery helpers (never throw; return null on malformed input)
// ---------------------------------------------------------------------------

async function safeRecover(params: Parameters<typeof recoverTypedDataAddress>[0]): Promise<Address | null> {
  try {
    return await recoverTypedDataAddress(params);
  } catch {
    return null;
  }
}

export function recoverInvoiceSigner(t: InvoiceTerms, signature: Hex) {
  return safeRecover({ ...invoiceTypedData(t), signature });
}

export function recoverManifestSigner(m: DeliveryManifest, signingChainId: number, signature: Hex) {
  return safeRecover({ ...manifestTypedData(m, signingChainId), signature });
}

export function recoverAuthorizationSigner(a: PaymentAuthorization, signature: Hex) {
  return safeRecover({ ...authorizationTypedData(a), signature });
}

export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

/** JSON-safe rendering of typed data (bigint → decimal string) for transport to wallets/clients. */
export function typedDataToJson<T>(td: T): unknown {
  return JSON.parse(JSON.stringify(td, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}

// ---------------------------------------------------------------------------
// ERC-20 transfer encoding & receipt
// ---------------------------------------------------------------------------

/** keccak256("Transfer(address,address,uint256)") */
export const ERC20_TRANSFER_TOPIC: Hex = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

export const ERC20_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

export const RECEIPT_SCHEMA = "hashx.receipt.v2";

/** Fields of an exported receipt body, excluding `receiptDigest` itself. */
export interface ReceiptBody {
  schema: typeof RECEIPT_SCHEMA;
  receiptId: string;
  issuedAt: string;
  network: { chainId: number; name: string; isTestnet: boolean };
  invoice: {
    id: string;
    digest: Hex;
    terms: Record<string, string | number>;
    sellerSignature: Hex;
  };
  delivery: {
    id: string;
    version: number;
    evidenceDigest: Hex;
    artifactSha256: Hex;
    manifest: Record<string, string | number>;
    manifestSignature: Hex;
    verificationRunId: string;
  };
  authorization: {
    attemptId: string;
    digest: Hex;
    message: Record<string, string | number>;
    payerSignature: Hex;
    stage1ApprovedAt: string;
    stage2AuthorizedAt: string;
  };
  settlement: {
    rail: string;
    chainId: number;
    token: Address;
    tokenSymbol: string;
    tokenDecimals: number;
    isTestToken: boolean;
    txHash: Hex;
    logIndex: number;
    blockNumber: string;
    blockHash: Hex;
    from: Address;
    to: Address;
    amount: string;
    confirmationsAtIssuance: number;
    finalityPolicy: string;
  };
}

export function computeReceiptDigest(body: ReceiptBody): Hex {
  return keccakCanonical(body);
}

// ---------------------------------------------------------------------------
// Service: EVM address activity analytics (objectively recomputable from RPC)
// ---------------------------------------------------------------------------

export const SERVICE_TYPE_ADDRESS_ANALYTICS = "evm_address_analytics_v1";
export const ACCEPTANCE_POLICY_EXACT = "exact_recompute_v1";
export const ANALYTICS_ARTIFACT_SCHEMA = "hashx.analytics.v2";

export interface AnalyticsArtifact {
  schema: typeof ANALYTICS_ARTIFACT_SCHEMA;
  chain_id: number;
  address: string; // lowercase hex
  start_block: number;
  end_block: number;
  transaction_count: number;
  native_value_in_raw: string;
  native_value_out_raw: string;
  /** Sorted by address ascending. */
  counterparties: Array<{ address: string; tx_count: number }>;
  /** Up to N matching transactions, ascending by (block_number, hash). */
  sample_transactions: Array<{ hash: string; block_number: number }>;
}

export interface MinimalBlock {
  number: bigint | number;
  transactions: ReadonlyArray<{ hash: string; from: string; to: string | null; value: bigint | string | number }>;
}

/**
 * Deterministic analytics over a contiguous block range. A transaction matches when
 * the subject is its sender or recipient. Native value in = sum(value | to == subject),
 * out = sum(value | from == subject). Counterparty = the other side of the transaction
 * (contract creations without a recipient have no counterparty).
 */
export function computeAddressAnalytics(params: {
  chainId: number;
  address: string;
  startBlock: number;
  endBlock: number;
  blocks: ReadonlyArray<MinimalBlock>;
  maxSamples: number;
}): { artifact: AnalyticsArtifact; matchedHashes: Map<string, number> } {
  const subject = params.address.toLowerCase();
  let count = 0;
  let valueIn = 0n;
  let valueOut = 0n;
  const counterparties = new Map<string, number>();
  const matched: Array<{ hash: string; block_number: number }> = [];

  const seenBlocks = new Set<number>();
  for (const block of params.blocks) {
    const bn = Number(block.number);
    if (bn < params.startBlock || bn > params.endBlock) throw new Error(`Block ${bn} outside requested range`);
    if (seenBlocks.has(bn)) throw new Error(`Duplicate block ${bn}`);
    seenBlocks.add(bn);
    for (const tx of block.transactions) {
      const from = tx.from.toLowerCase();
      const to = tx.to ? tx.to.toLowerCase() : null;
      if (from !== subject && to !== subject) continue;
      count++;
      const value = BigInt(tx.value);
      if (to === subject) valueIn += value;
      if (from === subject) valueOut += value;
      const other = from === subject ? to : from;
      if (other && other !== subject) counterparties.set(other, (counterparties.get(other) ?? 0) + 1);
      matched.push({ hash: tx.hash.toLowerCase(), block_number: bn });
    }
  }
  if (seenBlocks.size !== params.endBlock - params.startBlock + 1) {
    throw new Error("Block set does not cover the full requested range");
  }

  matched.sort((a, b) => a.block_number - b.block_number || (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0));
  const matchedHashes = new Map(matched.map((m) => [m.hash, m.block_number]));

  return {
    artifact: {
      schema: ANALYTICS_ARTIFACT_SCHEMA,
      chain_id: params.chainId,
      address: subject,
      start_block: params.startBlock,
      end_block: params.endBlock,
      transaction_count: count,
      native_value_in_raw: valueIn.toString(),
      native_value_out_raw: valueOut.toString(),
      counterparties: Array.from(counterparties.entries())
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([address, tx_count]) => ({ address, tx_count })),
      sample_transactions: matched.slice(0, params.maxSamples),
    },
    matchedHashes,
  };
}
