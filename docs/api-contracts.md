# HashX API Contracts (protocol v2)

Base URL: the persistent backend (`NEXT_PUBLIC_HASHX_API_URL`). All bodies are JSON. Every
error has the shape `{ "error": string, "code": string, "details"?: any, "requestId": string }`.
Every response carries an `X-Request-Id` header.

Implementation: `server/src/app.ts` (routes), `server/src/services/*` (logic shared with MCP).
Executable evidence: `server/tests/integration/*.test.ts`.

## Authentication

| Credential | Header | How obtained | Can do |
|---|---|---|---|
| Wallet session | `Authorization: Bearer hx_sess_…` | SIWE (`/auth/nonce` → sign → `/auth/verify`) | Everything the wallet's role allows, including human approvals |
| Agent credential | `Authorization: Bearer hx_agent_…` | Minted by a wallet session (`POST /agent-credentials`) | Only its scopes; **never** Stage 1, Stage 2, or transaction reporting |

Headers such as `x-wallet-address`, `x-api-key`, `X-Forwarded-*` are ignored for identity.
An invalid/expired/revoked bearer token returns `401 INVALID_CREDENTIAL` (never downgraded to anonymous).

Agent scopes: `invoices:read`, `invoices:write`, `deliveries:write`, `verification:run`, `payments:request`, `payments:read`.

| Method & path | Auth | Notes |
|---|---|---|
| `GET /auth/nonce` | none (rate-limited) | `{ nonce, expiresAt }`, single use, 5 min TTL |
| `POST /auth/verify` | none (rate-limited) | `{ message, signature }` (EIP-4361). Domain must be in `SIWE_ALLOWED_DOMAINS`, `uri` origin in `ALLOWED_ORIGINS`, chain supported. Returns `{ token, expiresAt, address, counterpartyId, displayName }` |
| `GET /auth/session` | any | current identity |
| `POST /auth/logout` | wallet | revokes the session |
| `POST /counterparties/me` | wallet | `{ display_name }` |
| `POST/GET /agent-credentials`, `DELETE /agent-credentials/:id` | wallet | secret returned once; only SHA-256 stored |

## Invoices

Authorization: only the seller or buyer of an invoice can read it; non-participants get `404`.

| Method & path | Who | Body / result |
|---|---|---|
| `GET /invoices` | any (`invoices:read`) | invoices where caller is seller or buyer |
| `POST /invoices` | seller (`invoices:write`) | see below → `201` invoice + `typedData` (EIP-712 to sign); replay with same `client_request_id` + same body → `200` with `idempotentReplay: true`; different body → `409 IDEMPOTENCY_KEY_REUSED` |
| `GET /invoices/:id` | participant | invoice (+ `viewerRole`) |
| `GET /invoices/:id/typed-data` | participant | `{ digest, typedData }` |
| `POST /invoices/:id/sign` | seller | `{ signature }` — must recover to the seller over the stored terms; `DRAFT → SIGNED` |
| `POST /invoices/:id/verify` | participant (`verification:run`) | verification run (`PASS`/`FAIL`/`PENDING`) |
| `GET /invoices/:id/verification` | participant | authoritative eligibility summary (`isEligibleForPayment`, `blockingReasons`) |

`POST /invoices` body:

```json
{
  "client_request_id": "ui-…(8-128 chars)",
  "buyer_wallet": "0x…",
  "buyer_ref": "free text (hashed into the signed terms)",
  "service": {
    "type": "evm_address_analytics_v1",
    "delivery_chain_id": 11155111,
    "parameters": { "address": "0x…", "start_block": "7000000", "end_block": "7000020" },
    "acceptance_policy": "exact_recompute_v1"
  },
  "payment": { "rail": "sepolia-usdc", "settlement_chain_id": 11155111, "amount_raw": "2500000", "payee": "0x…" },
  "expires_in_seconds": 86400
}
```

Rules: buyer ≠ seller; settlement chain explicit (no defaults; unknown → `UNSUPPORTED_CHAIN`);
`sepolia-usdc` uses only the configured official test USDC; HashKey Mainnet → `MAINNET_PAYMENTS_DISABLED`;
block range ≤ `DELIVERY_MAX_BLOCK_RANGE` (default 50) → else `RANGE_UNSUPPORTED`.

## Deliveries

| Method & path | Who | Notes |
|---|---|---|
| `POST /invoices/:id/delivery/prepare` | seller | `{ artifact_uri, artifact_content }` → `{ manifest, artifactSha256, canonicalArtifact, typedData }` |
| `POST /invoices/:id/delivery` | seller | `{ artifact_uri, artifact_content, manifest, manifest_signature }`; requires `VERIFIED` or `DELIVERY_REJECTED`; versions increment; reused manifest → `409 EVIDENCE_REUSED` |
| `GET /invoices/:id/delivery`, `GET /deliveries` | participant | latest / all visible |
| `POST /invoices/:id/delivery/verify` | participant | independent RPC recomputation; RPC problems → `PENDING` |

## Payments (two-stage human authorization)

| Method & path | Who | Transition |
|---|---|---|
| `POST /invoices/:id/payments` (alias `/pay`) | buyer (`payments:request`) | creates attempt `AWAITING_SIGNATURE_APPROVAL` with `authorizationTypedData`, `approvalSummary`; optional `Idempotency-Key`; at most one live attempt per invoice — duplicates return it (`idempotentReplay`) |
| `POST /payments/:id/approve-terms` (alias `/approve-signing`) | **human payer session** | `{ authorization_digest }` must equal the obligation's digest → `AWAITING_SUBMISSION_APPROVAL` |
| `POST /payments/:id/authorize` (alias `/approve-submission`) | **human payer session** | `{ signature }` EIP-712 `HashXPaymentAuthorization` by the payer → `AUTHORIZED` + `transferInstructions` |
| `POST /payments/:id/transaction` | **human payer session** | `{ tx_hash }` from the payer's wallet broadcast → `SUBMITTED`; a hash binds to one obligation forever (`409 TX_ALREADY_BOUND`) |
| `POST /payments/:id/reconcile` | participant | runs independent on-chain verification now (also runs in background) |
| `POST /payments/:id/cancel` | human payer | pre-submission only (or `AUTHORIZED` after expiry) |
| `GET /payments`, `GET /payments/:id`, `GET /invoices/:id/payment-status` | participant | |

States: `AWAITING_SIGNATURE_APPROVAL → AWAITING_SUBMISSION_APPROVAL → AUTHORIZED → SUBMITTED → INCLUDED → CONFIRMED → FINALIZED`;
failure exits `FAILED`, `DROPPED`, `EXPIRED`, `CANCELLED` (`TIMEOUT` reserved for HSP).
`INCLUDED` means the matching Transfer log was verified in a canonical block but the finality policy
(`SEPOLIA_FINALITY_POLICY`, default `confirmations:12`) is not yet met. A receipt is issued only at `CONFIRMED`.

HSP-rail invoices return `503 HSP_NOT_CONNECTED` with a typed status; no attempt is created.

## Receipts

| Method & path | Who | Notes |
|---|---|---|
| `GET /receipts`, `GET /receipts/:id`, `GET /invoices/:id/receipt` | participant | `document` is the full `hashx.receipt.v2` JSON incl. `receiptDigest` |
| `GET /receipts/:id/export` | participant | downloadable JSON; verify with `pnpm --prefix server verify-receipt <file> --rpc <url>` |

## Health

| Path | Notes |
|---|---|
| `GET /health` | liveness only |
| `GET /ready` | `200` ready / `503` degraded. Database + pending migrations, per-chain RPC status & latest block, settlement-token on-chain validation, evidence-registry deployment check (code + `VERSION()`), HSP public status. No URLs, keys or raw provider errors |
| `GET /stats` | caller-scoped counts (real persisted records only) |

## MCP (agent-to-agent)

`POST /mcp` — MCP Streamable HTTP (stateless, JSON responses), `@modelcontextprotocol/sdk` 1.32.
Authenticate with an agent credential. Tools: `create_invoice`, `sign_invoice`, `verify_invoice`,
`prepare_delivery`, `submit_delivery`, `verify_delivery`, `request_payment`, `get_payment_status`,
`get_receipt`. There is intentionally no approval/authorization/transaction tool.
