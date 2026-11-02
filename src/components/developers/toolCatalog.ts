/**
 * MCP tool catalog shown on the Developers page.
 *
 * Source of truth: server/src/mcp/server.ts (MCP_TOOL_NAMES) and the service functions it
 * calls (server/src/services/commerce.ts, payments.ts). Exactly nine tools are exposed at
 * POST /mcp (MCP Streamable HTTP, stateless, JSON responses). There is intentionally no
 * approval, authorization, or transaction-reporting tool.
 *
 * Example arguments below are illustrative placeholders, not real records.
 */

export type ToolGroup = "invoice" | "delivery" | "payment";

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
  /** Agent-credential scope the backend requires for this tool. */
  scope: string;
  /** Which participant may call it successfully. */
  caller: string;
  description: string;
  /** Equivalent HTTP route on the HashX backend (same service function). */
  httpBinding: string;
  params: ToolParam[];
  /** Illustrative arguments (placeholders). */
  exampleArguments: Record<string, unknown>;
  /** Shape of the JSON text content the tool returns (field list, not real data). */
  resultShape: Record<string, unknown>;
}

export const MCP_ENDPOINT_PATH = "/mcp";

export const TOOL_GROUP_LABELS: Record<ToolGroup, string> = {
  invoice: "Invoices",
  delivery: "Delivery evidence",
  payment: "Payment requests & receipts",
};

const INVOICE_ID: ToolParam = { name: "invoice_id", type: "string", required: true, description: "HashX invoice identifier (inv_…)" };
const SIG: ToolParam = { name: "signature", type: "0x-hex (65 bytes)", required: true, description: "EIP-712 signature produced by the seller wallet" };

const PLACEHOLDER_ID = "inv_<id returned by create_invoice>";
const PLACEHOLDER_SIG = "0x<130 hex chars from the seller wallet>";

export const HASHX_TOOLS: MCPToolDef[] = [
  {
    name: "create_invoice",
    group: "invoice",
    mutates: true,
    scope: "invoices:write",
    caller: "Seller (the agent owner's wallet becomes the seller)",
    description:
      "Create a protocol-v2 invoice where the calling agent's owner wallet is the seller. Idempotent on client_request_id. Returns EIP-712 typed data the seller wallet must sign (HashX never signs).",
    httpBinding: "POST /invoices",
    params: [
      { name: "client_request_id", type: "string (8–128, [A-Za-z0-9._:-])", required: true, description: "Idempotency key; same key + same body replays, different body → 409 IDEMPOTENCY_KEY_REUSED" },
      { name: "buyer_wallet", type: "address", required: true, description: "Buyer wallet; must differ from the seller" },
      { name: "buyer_ref", type: "string (1–255)", required: true, description: "Free-text reference, hashed into the signed terms" },
      { name: "service", type: "object", required: true, description: "type evm_address_analytics_v1, delivery_chain_id, parameters { address, start_block, end_block }, acceptance_policy exact_recompute_v1" },
      { name: "payment", type: "object", required: true, description: "rail (sepolia-usdc | hashkey-hsp), settlement_chain_id, amount_raw (integer string), payee, optional token_address" },
      { name: "expires_in_seconds", type: "integer (300–2592000)", required: false, description: "Invoice validity window" },
    ],
    exampleArguments: {
      client_request_id: "agent-example-0001",
      buyer_wallet: "0x<buyer wallet>",
      buyer_ref: "Address analytics for blocks 7000000–7000020",
      service: {
        type: "evm_address_analytics_v1",
        delivery_chain_id: 11155111,
        parameters: { address: "0x<subject address>", start_block: "7000000", end_block: "7000020" },
        acceptance_policy: "exact_recompute_v1",
      },
      payment: { rail: "sepolia-usdc", settlement_chain_id: 11155111, amount_raw: "2500000", payee: "0x<seller wallet>" },
      expires_in_seconds: 86400,
    },
    resultShape: { invoice: "LiveInvoice (status DRAFT)", typedData: "EIP-712 typed data for the seller wallet to sign", idempotentReplay: "boolean" },
  },
  {
    name: "sign_invoice",
    group: "invoice",
    mutates: true,
    scope: "invoices:write",
    caller: "Seller",
    description: "Attach the seller wallet's EIP-712 signature to a DRAFT invoice. The signature must recover to the seller wallet over the stored terms.",
    httpBinding: "POST /invoices/:id/sign",
    params: [INVOICE_ID, SIG],
    exampleArguments: { invoice_id: PLACEHOLDER_ID, signature: PLACEHOLDER_SIG },
    resultShape: { id: "string", status: "SIGNED", signer: "address", digest: "0x…" },
  },
  {
    name: "verify_invoice",
    group: "invoice",
    mutates: true,
    scope: "verification:run",
    caller: "Seller or buyer",
    description: "Run fail-closed invoice verification: signature, identity binding, expiry, replay, and settlement terms. Persists a verification run.",
    httpBinding: "POST /invoices/:id/verify",
    params: [INVOICE_ID],
    exampleArguments: { invoice_id: PLACEHOLDER_ID },
    resultShape: { decision: "PASS | FAIL | PENDING", payable: "boolean", checks: "Record<check, status>", reasonCodes: "string[]", inputDigest: "0x…" },
  },
  {
    name: "prepare_delivery",
    group: "delivery",
    mutates: false,
    scope: "deliveries:write",
    caller: "Seller",
    description: "Compute the canonical artifact SHA-256 and the EIP-712 delivery manifest the seller wallet must sign. Does not store anything.",
    httpBinding: "POST /invoices/:id/delivery/prepare",
    params: [
      INVOICE_ID,
      { name: "artifact_uri", type: "string (1–512)", required: true, description: "Where the artifact is published" },
      { name: "artifact_content", type: "object", required: true, description: "The delivered analytics result (canonicalized and hashed)" },
    ],
    exampleArguments: { invoice_id: PLACEHOLDER_ID, artifact_uri: "https://example.com/artifact.json", artifact_content: { "…": "result computed for the invoice's block range" } },
    resultShape: { manifest: "object", artifactSha256: "0x…", canonicalArtifact: "string", typedData: "EIP-712 manifest typed data" },
  },
  {
    name: "submit_delivery",
    group: "delivery",
    mutates: true,
    scope: "deliveries:write",
    caller: "Seller",
    description:
      "Submit a delivery artifact with its seller-signed manifest. Requires a VERIFIED (or DELIVERY_REJECTED) invoice; reused manifests are rejected (409 EVIDENCE_REUSED). Commitments are re-verified independently by verify_delivery.",
    httpBinding: "POST /invoices/:id/delivery",
    params: [
      INVOICE_ID,
      { name: "artifact_uri", type: "string (1–512)", required: true, description: "Same URI used in prepare_delivery" },
      { name: "artifact_content", type: "object", required: true, description: "Same content used in prepare_delivery" },
      { name: "manifest", type: "object", required: true, description: "Manifest returned by prepare_delivery" },
      { name: "manifest_signature", type: "0x-hex (65 bytes)", required: true, description: "Seller wallet EIP-712 signature over the manifest" },
    ],
    exampleArguments: { invoice_id: PLACEHOLDER_ID, artifact_uri: "https://example.com/artifact.json", artifact_content: { "…": "…" }, manifest: { "…": "from prepare_delivery" }, manifest_signature: PLACEHOLDER_SIG },
    resultShape: { id: "string", version: "number", status: "PENDING_VERIFICATION", artifactSha256: "0x…" },
  },
  {
    name: "verify_delivery",
    group: "delivery",
    mutates: true,
    scope: "verification:run",
    caller: "Seller or buyer",
    description: "Independently recompute delivery facts from the backend's configured RPC. RPC failures produce PENDING, never PASS.",
    httpBinding: "POST /invoices/:id/delivery/verify",
    params: [INVOICE_ID],
    exampleArguments: { invoice_id: PLACEHOLDER_ID },
    resultShape: { decision: "PASS | FAIL | PENDING", checks: "Record<check, status>", evidenceDigest: "0x…", observedBlock: "string", chainId: "number" },
  },
  {
    name: "request_payment",
    group: "payment",
    mutates: true,
    scope: "payments:request",
    caller: "Buyer",
    description:
      "Create the immutable payment obligation for a fully verified invoice. Does NOT approve or pay: a human must complete Stage 1 and Stage 2 with their own wallet in the HashX app. At most one live attempt per invoice.",
    httpBinding: "POST /invoices/:id/payments",
    params: [INVOICE_ID, { name: "idempotency_key", type: "string (8–128)", required: false, description: "Optional idempotency key" }],
    exampleArguments: { invoice_id: PLACEHOLDER_ID },
    resultShape: { attempt: "LivePayment (state AWAITING_SIGNATURE_APPROVAL)", idempotentReplay: "boolean", humanApprovalRequired: true },
  },
  {
    name: "get_payment_status",
    group: "payment",
    mutates: false,
    scope: "payments:read",
    caller: "Seller or buyer",
    description: "Latest payment attempt for an invoice, including on-chain reconciliation state (SUBMITTED → INCLUDED → CONFIRMED → FINALIZED, or a failure state).",
    httpBinding: "GET /invoices/:id/payment-status",
    params: [INVOICE_ID],
    exampleArguments: { invoice_id: PLACEHOLDER_ID },
    resultShape: { id: "string", state: "LivePaymentState", txHash: "0x… | undefined", confirmations: "number", failureCode: "string | null" },
  },
  {
    name: "get_receipt",
    group: "payment",
    mutates: false,
    scope: "payments:read",
    caller: "Seller or buyer",
    description: "Verifiable hashx.receipt.v2 document, issued only after the settlement transfer is independently verified on-chain (CONFIRMED). Returns an error before then.",
    httpBinding: "GET /invoices/:id/receipt",
    params: [INVOICE_ID],
    exampleArguments: { invoice_id: PLACEHOLDER_ID },
    resultShape: { id: "string", receiptDigest: "0x…", txHash: "0x…", chainId: 11155111, document: "hashx.receipt.v2 JSON" },
  },
];

/** HTTP endpoints verified against docs/api-contracts.md and server/src/app.ts. */
export interface HttpEndpoint {
  method: string;
  path: string;
  auth: string;
  notes: string;
}

export const HTTP_ENDPOINT_GROUPS: Array<{ title: string; endpoints: HttpEndpoint[] }> = [
  {
    title: "Authentication & identity",
    endpoints: [
      { method: "GET", path: "/auth/nonce", auth: "none (rate-limited)", notes: "Single-use SIWE nonce, 5 min TTL" },
      { method: "POST", path: "/auth/verify", auth: "none (rate-limited)", notes: "{ message, signature } (EIP-4361) → { token, expiresAt, address, counterpartyId, displayName }" },
      { method: "GET", path: "/auth/session", auth: "any", notes: "Current identity" },
      { method: "POST", path: "/auth/logout", auth: "wallet session", notes: "Revokes the session" },
      { method: "POST", path: "/counterparties/me", auth: "wallet session", notes: "{ display_name }" },
      { method: "POST / GET", path: "/agent-credentials", auth: "wallet session", notes: "Mint (secret returned once; only SHA-256 stored) / list" },
      { method: "DELETE", path: "/agent-credentials/:id", auth: "wallet session", notes: "Revoke" },
    ],
  },
  {
    title: "Invoices",
    endpoints: [
      { method: "GET", path: "/invoices", auth: "invoices:read", notes: "Invoices where caller is seller or buyer" },
      { method: "POST", path: "/invoices", auth: "seller · invoices:write", notes: "201 invoice + typedData; idempotent on client_request_id" },
      { method: "GET", path: "/invoices/:id", auth: "participant", notes: "Non-participants get 404" },
      { method: "GET", path: "/invoices/:id/typed-data", auth: "participant", notes: "{ digest, typedData }" },
      { method: "POST", path: "/invoices/:id/sign", auth: "seller", notes: "{ signature } → DRAFT → SIGNED" },
      { method: "POST", path: "/invoices/:id/verify", auth: "participant · verification:run", notes: "Verification run (PASS / FAIL / PENDING)" },
      { method: "GET", path: "/invoices/:id/verification", auth: "participant", notes: "Authoritative eligibility summary" },
    ],
  },
  {
    title: "Deliveries",
    endpoints: [
      { method: "POST", path: "/invoices/:id/delivery/prepare", auth: "seller", notes: "{ artifact_uri, artifact_content } → manifest + typedData" },
      { method: "POST", path: "/invoices/:id/delivery", auth: "seller", notes: "Submit artifact + signed manifest" },
      { method: "GET", path: "/invoices/:id/delivery · /deliveries", auth: "participant", notes: "Latest / all visible" },
      { method: "POST", path: "/invoices/:id/delivery/verify", auth: "participant", notes: "Independent RPC recomputation; RPC problems → PENDING" },
    ],
  },
  {
    title: "Payments (two-stage human authorization)",
    endpoints: [
      { method: "POST", path: "/invoices/:id/payments", auth: "buyer · payments:request", notes: "Creates attempt AWAITING_SIGNATURE_APPROVAL" },
      { method: "POST", path: "/payments/:id/approve-terms", auth: "human payer session only", notes: "Stage 1: { authorization_digest }" },
      { method: "POST", path: "/payments/:id/authorize", auth: "human payer session only", notes: "Stage 2: EIP-712 HashXPaymentAuthorization signature → transferInstructions" },
      { method: "POST", path: "/payments/:id/transaction", auth: "human payer session only", notes: "{ tx_hash } from the payer's wallet broadcast" },
      { method: "POST", path: "/payments/:id/reconcile", auth: "participant", notes: "Run independent on-chain verification now" },
      { method: "POST", path: "/payments/:id/cancel", auth: "human payer", notes: "Pre-submission only" },
      { method: "GET", path: "/payments · /payments/:id · /invoices/:id/payment-status", auth: "participant", notes: "" },
    ],
  },
  {
    title: "Receipts, health & stats",
    endpoints: [
      { method: "GET", path: "/receipts · /receipts/:id · /invoices/:id/receipt", auth: "participant", notes: "hashx.receipt.v2 document incl. receiptDigest" },
      { method: "GET", path: "/receipts/:id/export", auth: "participant", notes: "Downloadable JSON for offline verification" },
      { method: "GET", path: "/health", auth: "none", notes: "Liveness only" },
      { method: "GET", path: "/ready", auth: "none", notes: "200 ready / 503 degraded: database, chains, token validation, registry, HSP status" },
      { method: "GET", path: "/stats", auth: "any", notes: "Caller-scoped counts of real persisted records" },
      { method: "POST", path: "/mcp", auth: "agent credential or wallet session", notes: "MCP Streamable HTTP (stateless, JSON responses); GET/DELETE → 405" },
    ],
  },
];
