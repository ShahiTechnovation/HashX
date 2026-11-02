# HashX Security Model (protocol v2)

**Promise:** no verified work, no authorized payment. Agents prepare requests and submit evidence;
only a human, with their own wallet, can authorize a payment; only an independently verified
on-chain transfer produces a receipt.

## Actors and trust

| Actor | Proves identity by | May | May never |
|---|---|---|---|
| Seller (human or seller agent's wallet) | SIWE session, or agent credential minted by that wallet | create/sign invoices, submit signed deliveries, trigger verification | approve or pay, act on others' invoices |
| Buyer (human) | SIWE session | verify, request payment, Stage 1, Stage 2, report its transaction, cancel | — |
| Buyer agent | Agent credential (`payments:request`) | request payment, read status/receipts | Stage 1, Stage 2, report transactions (403 `HUMAN_SESSION_REQUIRED`); there is no MCP tool for these |
| HashX backend | — | verify signatures, recompute facts from RPC, persist, reconcile | hold keys, sign, move funds |
| RPC provider | trusted for chain data, **chain ID checked on every reader** | — | — |

Untrusted: all request headers (`x-wallet-address`, `Host`, `X-Forwarded-*`), seller-provided
artifact figures, client-reported transaction hashes, frontend state, and the demo mode.

## Authentication

- **SIWE (EIP-4361)** — `server/src/auth/auth.ts`. Nonce: 64 random alphanumerics, stored server-side,
  5-min TTL, consumed with an atomic `UPDATE … WHERE consumed_at IS NULL AND expires_at > NOW()`.
  The message `domain` must be in `SIWE_ALLOWED_DOMAINS`; `uri` origin in `ALLOWED_ORIGINS` and on the same host;
  chain must be supported; `issuedAt`/`expirationTime`/`notBefore` enforced with 60 s skew.
  These values are never derived from request headers.
- **Sessions** — `hx_sess_` + 256-bit random token; only its SHA-256 is stored; 1 h TTL; explicit logout;
  a session for a SUSPENDED account stops working immediately.
- **Agent credentials** — `hx_agent_` + 256-bit random; SHA-256 stored; explicit scopes checked by the
  database `CHECK` and in code; minted and revoked only by a human session; optional expiry.
- An invalid bearer token is a hard 401 — never treated as anonymous.
- `TRUST_PROXY` controls whether forwarded client IPs are honoured (rate limiting only; never identity).

## Authorization

Every service function takes an `Actor` (`server/src/services/commerce.ts`, `payments.ts`):
participant checks return 404 to outsiders (no existence oracle); role checks return 403
(`SELLER_ONLY`, `BUYER_ONLY`, `PAYER_ONLY`); scopes return 403 `INSUFFICIENT_SCOPE`.
HTTP and MCP share these functions, so there is one authorization implementation.

## Commitments (deterministic, documented)

All implemented once in `shared/protocol.ts`. EIP-712 domain: `{ name: "HashX", version: "2", chainId }`
(no verifying contract; the domain chain is the chain the wallet signed on).

| Commitment | Definition |
|---|---|
| Service terms hash | `keccak256(abi.encode(string serviceType, uint256 deliveryChainId, address subject, uint64 start, uint64 end, string acceptancePolicy))` |
| Invoice digest | EIP-712 `HashXInvoice{invoiceId, version, seller, buyer, buyerRefHash, serviceType, serviceTermsHash, deliveryChainId, settlementRail, settlementChainId, token, amount, payee, nonce(bytes32 random), issuedAt, expiresAt}` |
| Artifact SHA-256 | `sha256(utf8(canonicalJson(artifact)))` — sorted keys, no whitespace, safe integers only (floats, `undefined`, bigint rejected) |
| Delivery evidence digest | EIP-712 `HashXDeliveryManifest{schema, invoiceId, invoiceDigest, seller, deliveryVersion, deliveryChainId, serviceTermsHash, artifactSha256, artifactUri, generatedAt}` |
| Authorization digest | EIP-712 `HashXPaymentAuthorization{attemptId, invoiceId, invoiceDigest, deliveryEvidenceDigest, payer, payee, token, chainId, amount, settlementRail, nonce, expiresAt}` |
| Receipt digest | `keccak256(utf8(canonicalJson(receiptBody)))` |
| Registry commitments | invoice = invoice digest, delivery = evidence digest, receipt = receipt digest |

## Verification (fail-closed)

- **Invoice:** schema; stored terms recompute both the terms hash and the EIP-712 digest (detects storage tampering);
  signature recovers to seller; seller wallet SIWE-verified and ACTIVE; expiry; nonce uniqueness;
  settlement terms (rail supports chain, token is exactly the configured settlement token, buyer ≠ seller,
  non-zero payee, signing chain = settlement chain).
- **Delivery:** manifest signature by seller; manifest bound to invoice id + digest, seller, version, chain,
  terms, URI; artifact SHA-256 recomputed from stored bytes; strict schema; subject/chain/range match;
  freshness (generated after issuance, submitted before expiry); RPC recomputation of count, native
  in/out values, counterparty breakdown and sample proofs.
- **Bounds:** ≤ `DELIVERY_MAX_BLOCK_RANGE` blocks (refused at invoice creation and at verification),
  5 concurrent block fetches, per-call RPC timeout, overall deadline.
- **Fail-closed rules:** RPC unconfigured/unavailable/timeout, chain-ID mismatch, or end block not
  `DELIVERY_MIN_CONFIRMATIONS` deep → `PENDING` (non-payable). Any mismatch → `FAIL`. PASS requires every check.
- **Provenance:** every run persists verifier version, input digest, evidence digest, evidence sources
  (RPC label = non-reversible hash of the URL), observed block, payable flag, triggering actor.

## Payment eligibility and authorization

`evaluateEligibility()` requires: protocol v2, invoice `DELIVERY_ACCEPTED`, not expired, latest invoice run PASS
whose input digest matches the current digest+signature, latest delivery ACCEPTED with a PASS run whose evidence
digest equals that delivery's manifest digest and is younger than `VERIFICATION_TTL_SECONDS`.

1. **Request** (buyer): creates the immutable obligation with a random nonce and expiry (default 15 min).
2. **Stage 1** (human payer session): must submit the exact authorization digest it reviewed.
3. **Stage 2** (human payer session): EIP-712 signature by the payer over the full authorization.
4. **Broadcast:** the payer's wallet sends `transfer(payee, amount)`; HashX only receives the hash.

Every transition is a compare-and-set on `(state, row_version)`; approvals are unique per stage; the attempt
cannot skip or repeat stages. No database transaction is held across network calls.

## Settlement verification

See `docs/SEPOLIA_INTEGRATION.md`. Summary: chain ID → receipt status → called contract = token → unique
`Transfer(payer → payee, amount)` log from the token → block still canonical → confirmations/finality policy.
A tx hash binds to exactly one attempt (unique index) and one settlement row. Reorgs roll back to `SUBMITTED`
and revoke any issued receipt (never deleted).

## Persistence invariants (database-enforced)

- `uq_payment_attempts_live_invoice`: one non-failed attempt per invoice **including settled ones** (the v1 index allowed a second attempt after `FINALIZED`).
- `uq_payment_attempts_chain_tx`, `uq_settlement_transfers_tx`: a transaction satisfies at most one obligation.
- `uq_payment_attempts_auth_nonce`, `uq_invoices_v2_client_request`, `uq_deliveries_manifest_digest`, `uq_receipts_live_invoice`.

## Smart contract: HashXEvidenceRegistry v2

Issuer-namespaced storage `(msg.sender, invoiceCommitment)` makes front-running a public digest harmless;
write-once fields; ordering (receipt requires delivery requires invoice); no payable/receive/fallback;
`VERSION() == "2"`. It attests who committed what and when — it does not prove the content is true.

## Secrets & operations

- No private keys, mnemonics or signing secrets anywhere in frontend, API, database or logs. HSP credentials are backend-only.
- Logs: structured JSON with request ID, path (no query), status, actor address — never bodies, tokens or signatures.
- `/ready` exposes statuses only (no URLs, keys, provider errors). CORS rejects unknown browser origins (403).
- Production config validation: `DATABASE_URL`, https `ALLOWED_ORIGINS`, `SIWE_ALLOWED_DOMAINS` required; local chain forbidden.

## Known limitations

EOA-only signatures (no ERC-1271); in-memory rate limiting; verification limited to `evm_address_analytics_v1`;
HSP execution disabled; registry undeployed on public networks. See `PRODUCTION_READINESS.md` §4.
