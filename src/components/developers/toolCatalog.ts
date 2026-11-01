/**
 * MCP tool catalog shown on the Developers page.
 *
 * HashX tools are the commercial contracts agents call. HSP tools are the
 * settlement rail HashX calls server-side over MCP Streamable HTTP; agents
 * never call them directly.
 */

export type ToolGroup = "hashx" | "hsp";

export interface ToolParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface MCPToolDef {
  name: string;
  group: ToolGroup;
  mutates: boolean;
  authorization: string;
  /** Idempotency key, or null when the call is naturally idempotent (read-only). */
  idempotencyKey: string | null;
  description: string;
  /** REST binding on the HashX backend, if any. */
  httpBinding?: string;
  params: ToolParam[];
  requestSchema: object;
  responseSchema: object;
}

export const HASHX_TOOLS: MCPToolDef[] = [
  {
    name: "create_invoice",
    group: "hashx",
    mutates: true,
    authorization: "Seller / Integrator",
    idempotencyKey: "client_request_id",
    httpBinding: "POST /invoices",
    description: "Creates an unsigned structured commercial invoice bound to a service definition.",
    params: [
      { name: "client_request_id", type: "uuid", required: false, description: "Idempotency key. Replays return the original invoice." },
      { name: "seller_counterparty_id", type: "uuid", required: true, description: "Registered seller counterparty the invoice is bound to." },
      { name: "buyer_ref", type: "string", required: true, description: "Buyer job reference. Hashed into the signed payload." },
      { name: "service.type", type: "enum", required: true, description: "Service definition. Currently hsk_address_analytics_v1." },
      { name: "service.parameters.address", type: "address", required: true, description: "HashKey Chain address the analytics cover." },
      { name: "service.parameters.start_block", type: "uint64 string", required: true, description: "First block of the requested range (inclusive)." },
      { name: "service.parameters.end_block", type: "uint64 string", required: true, description: "Last block of the requested range (inclusive)." },
      { name: "service.acceptance_policy", type: "enum", required: true, description: "Objective acceptance policy. Currently analytics_v1." },
      { name: "payment.currency", type: "enum", required: true, description: "Invoice currency. USD." },
      { name: "payment.amount_minor", type: "integer string", required: true, description: "Price in minor units (cents). Never a float." },
      { name: "payment.payee", type: "address", required: true, description: "Wallet that receives settlement." },
      { name: "payment.preferred_chain_id", type: "integer", required: true, description: "Settlement chain. 133 testnet, 177 mainnet." },
      { name: "expires_at", type: "RFC 3339", required: true, description: "Invoice expiry. Verification fails after this instant." },
    ],
    requestSchema: {
      client_request_id: "uuid",
      seller_counterparty_id: "uuid",
      buyer_ref: "string",
      service: {
        type: "hsk_address_analytics_v1",
        parameters: {
          address: "0x...",
          start_block: "uint64-string",
          end_block: "uint64-string",
        },
        acceptance_policy: "analytics_v1",
      },
      payment: {
        currency: "USD",
        amount_minor: "100",
        payee: "0x...",
        preferred_chain_id: 133,
      },
      expires_at: "RFC3339",
    },
    responseSchema: {
      invoice_id: "uuid",
      invoice_version: 1,
      status: "DRAFT",
      typed_data: {},
      invoice_digest: "0x...",
      created_at: "RFC3339",
    },
  },
  {
    name: "sign_invoice",
    group: "hashx",
    mutates: true,
    authorization: "Seller wallet (EOA)",
    idempotencyKey: "invoice_id + version",
    httpBinding: "POST /invoices/:id/sign",
    description: "Attaches a validated EIP-712 signature from the seller wallet to the invoice.",
    params: [
      { name: "invoice_id", type: "uuid", required: true, description: "Invoice to sign." },
      { name: "signature", type: "bytes (65)", required: false, description: "EIP-712 signature over the invoice digest." },
      { name: "signer", type: "address", required: false, description: "Expected signer. Must recover from the signature." },
    ],
    requestSchema: {
      invoice_id: "uuid",
      signature: "0x65-byte-signature",
      signer: "0x...",
    },
    responseSchema: {
      invoice_id: "uuid",
      status: "SIGNED",
      signature_valid: true,
      signer: "0x...",
      signed_digest: "0x...",
    },
  },
  {
    name: "verify_invoice",
    group: "hashx",
    mutates: false,
    authorization: "Buyer / Integrator",
    idempotencyKey: null,
    httpBinding: "POST /invoices/:id/verify",
    description: "Validates schema, EIP-712 signature, seller identity binding, expiry, and replay nonce.",
    params: [
      { name: "invoice_id", type: "uuid", required: true, description: "Invoice to verify." },
      { name: "expected_seller_id", type: "uuid", required: false, description: "Fails identity_binding if the bound seller differs." },
      { name: "expected_buyer_ref", type: "string", required: false, description: "Fails terms_consistent if the buyer reference differs." },
    ],
    requestSchema: {
      invoice_id: "uuid",
      expected_seller_id: "uuid",
      expected_buyer_ref: "string",
    },
    responseSchema: {
      decision: "PASS",
      checks: {
        schema: "PASS",
        signature: "PASS",
        identity_binding: "PASS",
        expiry: "PASS",
        nonce_unused: "PASS",
        terms_consistent: "PASS",
      },
      invoice_digest: "0x...",
      reason_codes: [],
    },
  },
  {
    name: "submit_delivery",
    group: "hashx",
    mutates: true,
    authorization: "Seller agent",
    idempotencyKey: "invoice_id + delivery_version",
    httpBinding: "POST /invoices/:id/delivery",
    description: "Submits a digital artifact reference and signed manifest binding delivery to the invoice.",
    params: [
      { name: "invoice_id", type: "uuid", required: true, description: "Invoice being fulfilled." },
      { name: "artifact_uri", type: "uri", required: true, description: "Location of the delivered artifact." },
      { name: "artifact_sha256", type: "hex", required: true, description: "SHA-256 of the artifact bytes." },
      { name: "manifest", type: "object", required: true, description: "hashx.delivery.analytics.v1 manifest binding seller, parameters, and artifact hash." },
      { name: "manifest_signature", type: "bytes", required: true, description: "Seller signature over the manifest." },
      { name: "artifact_content", type: "object", required: true, description: "hashx.analytics.v1 payload, recomputed during verification." },
    ],
    requestSchema: {
      invoice_id: "uuid",
      artifact_uri: "s3://...",
      artifact_sha256: "hex",
      manifest: {
        schema: "hashx.delivery.analytics.v1",
        seller: "0x...",
        generated_at: "RFC3339",
        service_parameters_hash: "0x...",
        artifact_sha256: "hex",
      },
      manifest_signature: "0x...",
    },
    responseSchema: {
      delivery_id: "uuid",
      status: "PENDING_VERIFICATION",
      submitted_at: "RFC3339",
    },
  },
  {
    name: "verify_delivery",
    group: "hashx",
    mutates: false,
    authorization: "Buyer / System verifier",
    idempotencyKey: null,
    httpBinding: "POST /invoices/:id/delivery/verify",
    description: "Recomputes deterministic analytics facts against HashKey Chain RPC.",
    params: [
      { name: "invoice_id", type: "uuid", required: true, description: "Invoice whose delivery is verified." },
      { name: "delivery_id", type: "uuid", required: false, description: "Specific delivery. Defaults to the latest." },
    ],
    requestSchema: {
      invoice_id: "uuid",
      delivery_id: "uuid",
    },
    responseSchema: {
      decision: "PASS",
      verifier: "analytics_v1.0.0",
      checks: {
        manifest_signature: "PASS",
        artifact_hash: "PASS",
        schema: "PASS",
        requested_address: "PASS",
        block_range: "PASS",
        transaction_count: "PASS",
        sample_transaction_proofs: "PASS",
        freshness: "PASS",
      },
      evidence_digest: "0x...",
      reason_codes: [],
    },
  },
  {
    name: "request_payment",
    group: "hashx",
    mutates: true,
    authorization: "Buyer agent",
    idempotencyKey: "invoice_id",
    httpBinding: "POST /invoices/:id/pay",
    description: "Enforces payment eligibility and prepares the HSP payment order idempotently.",
    params: [
      { name: "invoice_id", type: "uuid", required: true, description: "Verified, fulfilled invoice to pay. An active attempt is returned, not duplicated." },
      { name: "payer", type: "address", required: true, description: "Wallet that will sign the payment permit." },
      { name: "merchant_name", type: "string", required: false, description: "Merchant name for HSP attribution." },
    ],
    requestSchema: {
      invoice_id: "uuid",
      payer: "0x...",
      merchant_name: "HashX",
    },
    responseSchema: {
      payment_attempt_id: "uuid",
      state: "AWAITING_SIGNATURE_APPROVAL",
      flow_id: "...",
      payment_request_id: "...",
      pay_to: "0x...",
      payer: "0x...",
      token_total_raw: "...",
      quote_expires_at: "RFC3339",
      eip712: {},
      approval_summary: {},
    },
  },
  {
    name: "get_payment_status",
    group: "hashx",
    mutates: false,
    authorization: "Buyer / Seller",
    idempotencyKey: null,
    httpBinding: "GET /invoices/:id/payment-status",
    description: "Polls the HSP reconciler for authoritative payment progression and the HashKey Chain tx hash.",
    params: [{ name: "invoice_id", type: "uuid", required: true, description: "Invoice whose payment to query. Poll ~15s while processing." }],
    requestSchema: {
      invoice_id: "uuid",
    },
    responseSchema: {
      payment_attempt_id: "uuid",
      hsp_status: "payment-processing",
      flow_id: "...",
      payment_request_id: "...",
      attribution_verified: true,
      tx_hash: null,
      last_queried_at: "RFC3339",
    },
  },
  {
    name: "get_receipt",
    group: "hashx",
    mutates: false,
    authorization: "Authorized participant",
    idempotencyKey: null,
    httpBinding: "GET /invoices/:id/receipt",
    description: "Retrieves the verifiable proof linking commercial intent, fulfillment, and HSP settlement.",
    params: [{ name: "invoice_id", type: "uuid", required: true, description: "Settled invoice. Available only after payment-finalized." }],
    requestSchema: {
      invoice_id: "uuid",
    },
    responseSchema: {
      receipt_version: "1",
      invoice_digest: "0x...",
      seller: "0x...",
      buyer_ref: "...",
      delivery_evidence_digest: "0x...",
      payment: {
        hspStatus: "payment-finalized",
        flow_id: "...",
        payment_request_id: "...",
        tx_hash: "0x...",
        payer: "0x...",
        payee: "0x...",
        token_total_raw: "...",
      },
      evidence_registry_tx: "0x...",
    },
  },
];

const HSP_AUTH = "HashX backend (merchant key, allowlisted IP)";
const flowParams: ToolParam[] = [
  { name: "flow_id", type: "string", required: true, description: "HSP flow identifier returned by create_order." },
  { name: "payment_request_id", type: "string", required: true, description: "HSP payment request identifier." },
];

/** Argument shapes mirror the HashX backend's HSP adapter (server/src/services/hsp.ts). */
export const HSP_TOOLS: MCPToolDef[] = [
  {
    name: "get_chain_config",
    group: "hsp",
    mutates: false,
    authorization: HSP_AUTH,
    idempotencyKey: null,
    description: "Returns settlement token, decimals, and permit protocol for a chain.",
    params: [{ name: "chain_id", type: "integer", required: true, description: "HashKey Chain ID (133 testnet, 177 mainnet)." }],
    requestSchema: { chain_id: 133 },
    responseSchema: { chain_name: "HashKey Chain Testnet", token_address: "0x...", token_symbol: "USDT", token_decimals: 6, protocol: "permit2" },
  },
  {
    name: "create_order",
    group: "hsp",
    mutates: true,
    authorization: HSP_AUTH,
    idempotencyKey: "invoice_id (guarded by request_payment)",
    description: "Opens an HSP payment order for a verified invoice.",
    params: [
      { name: "merchant_name", type: "string", required: true, description: "Attributed merchant." },
      { name: "pay_to", type: "address", required: true, description: "Payee wallet." },
      { name: "payer", type: "address", required: true, description: "Payer wallet." },
      { name: "currency", type: "enum", required: true, description: "Order currency. USD." },
      { name: "amount_minor", type: "integer string", required: true, description: "Amount in minor units." },
      { name: "preferred_chain_id", type: "integer", required: true, description: "Settlement chain." },
      { name: "reference_id", type: "string", required: true, description: "HashX invoice ID. Binds the order to the invoice." },
    ],
    requestSchema: {
      merchant_name: "HashX",
      pay_to: "0x...",
      payer: "0x...",
      currency: "USD",
      amount_minor: "100",
      preferred_chain_id: 133,
      reference_id: "inv-...",
    },
    responseSchema: { flow_id: "hsp-flow-...", payment_request_id: "hsp-pr-...", payment_url: "https://...", status: "created" },
  },
  {
    name: "get_order",
    group: "hsp",
    mutates: false,
    authorization: HSP_AUTH,
    idempotencyKey: null,
    description: "Reads the current state of an HSP order.",
    params: flowParams,
    requestSchema: { flow_id: "hsp-flow-...", payment_request_id: "hsp-pr-..." },
    responseSchema: { flow_id: "hsp-flow-...", payment_request_id: "hsp-pr-...", status: "ready" },
  },
  {
    name: "estimate_fee",
    group: "hsp",
    mutates: false,
    authorization: HSP_AUTH,
    idempotencyKey: null,
    description: "Estimates the network fee shown on the approval summary.",
    params: flowParams,
    requestSchema: { flow_id: "hsp-flow-...", payment_request_id: "hsp-pr-..." },
    responseSchema: { estimated_fee_usd: "$0.00 USD" },
  },
  {
    name: "prepare_payment",
    group: "hsp",
    mutates: true,
    authorization: HSP_AUTH,
    idempotencyKey: "flow_id + payment_request_id",
    description: "Returns the exact EIP-712 permit payload and a short-lived quote for human approval.",
    params: [...flowParams, { name: "payer", type: "address", required: true, description: "Wallet that will sign the permit." }],
    requestSchema: { flow_id: "hsp-flow-...", payment_request_id: "hsp-pr-...", payer: "0x..." },
    responseSchema: {
      eip712: {},
      cart_hash: "0x...",
      token_total_raw: "1000000",
      quote_expires_at: "RFC3339",
      token_address: "0x...",
      token_symbol: "USDT",
      token_decimals: 6,
      payment_objects: {},
    },
  },
  {
    name: "finalize_payment",
    group: "hsp",
    mutates: true,
    authorization: HSP_AUTH,
    idempotencyKey: "flow_id + payment_request_id",
    description: "Attaches the payer's signed permit after pre-signing approval.",
    params: [
      ...flowParams,
      { name: "signature", type: "bytes", required: true, description: "Payer signature over the prepared permit." },
      { name: "payment_objects", type: "object", required: false, description: "Opaque objects returned by prepare_payment." },
    ],
    requestSchema: { flow_id: "hsp-flow-...", payment_request_id: "hsp-pr-...", signature: "0x...", payment_objects: {} },
    responseSchema: { status: "finalized", flow_id: "hsp-flow-..." },
  },
  {
    name: "submit_payment",
    group: "hsp",
    mutates: true,
    authorization: HSP_AUTH,
    idempotencyKey: "flow_id + payment_request_id",
    description: "Broadcasts the signed payment after pre-submission approval.",
    params: flowParams,
    requestSchema: { flow_id: "hsp-flow-...", payment_request_id: "hsp-pr-..." },
    responseSchema: { status: "payment-submitted", tx_hash: "0x..." },
  },
  {
    name: "query_payment",
    group: "hsp",
    mutates: false,
    authorization: HSP_AUTH,
    idempotencyKey: null,
    description: "Authoritative payment status. Used for reconciliation and timeout recovery.",
    params: flowParams,
    requestSchema: { flow_id: "hsp-flow-...", payment_request_id: "hsp-pr-..." },
    responseSchema: { status: "payment-finalized", tx_hash: "0x..." },
  },
];

export const HSP_MCP_ENDPOINT = "https://qa-hsp.hashkey.com/mcp";
