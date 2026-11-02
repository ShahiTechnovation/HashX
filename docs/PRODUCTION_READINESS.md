# HashX — Production Readiness

Status as of branch `feat/sepolia-production-foundation`. This document records (1) the audited
baseline, (2) what changed, and (3) a capability matrix that separates what is real, tested,
simulated, or blocked. Every "Real" claim points at code and an executed test.

---

## 1. Baseline audit (`main` @ `1961922`)

The prompt referenced `1b34735`; HEAD was `1961922`, which only changed logo assets. Findings below
were verified by reading the code, not the README.

### Execution path: invoice → receipt (baseline)

| Step | Baseline implementation | Classification |
|---|---|---|
| Auth | `requireAuth()` passed if **any** of `Authorization`, `x-wallet-address`, `x-api-key` was present — never verified. Skipped entirely when `req.ip` was loopback **or** `req.hostname` was `localhost` | **Insecure.** Behind the documented Caddy reverse proxy (`localhost:8080`) every request originates from 127.0.0.1 → auth fully bypassed. `Host` is attacker-controlled |
| Reads | `GET /invoices`, `/payments`, `/receipts`, `/deliveries`, `/counterparties` unauthenticated | **Insecure** (global data exposure) |
| Create invoice | Seller taken from body `seller_counterparty_id`, falling back to a hardcoded seed seller; caller never bound | **Insecure** |
| IDs / nonces | `Date.now().toString(36)` + `Math.random`; invoice nonce = 4-digit `Math.random` (9,000 values) | **Insecure / collision-prone** |
| Idempotency | `client_request_id` stored, never used; defaulted to `req-<timestamp>` | **Not implemented** |
| Sign invoice | EIP-712 recovered against seller — real | Implemented, but signer binding to caller absent |
| Terms hash | Frontend `encodePacked(strings)` vs backend `encodeAbiParameters(uint64)` | **Broken** — FE and BE digests disagree |
| Invoice verify | Unauthenticated; identity check passed when counterparty list empty; replay check swallowed DB errors | **Incomplete** |
| Delivery submit | No seller binding; `artifact_sha256` compared only to the seller's own manifest field; artifact bytes never hashed; manifest signature never verified | **Unverified** |
| Delivery verify | Tx count fell back to the **seller-claimed count** when RPC failed or range > 10 → PASS; any chain ≠ 177 silently mapped to testnet 133; delivery chain conflated with payment chain | **Fails open** |
| Request payment | `payer` arbitrary from body; unique index excluded `FINALIZED` → a second attempt was possible after settlement | **Double-payment risk** |
| Stage 1 | Any caller; recorded `actor = attempt.payer` regardless of who called; `terms_hash = keccak(amount)` | **Not authorization** |
| Stage 2 | Signature over `keccak256(tokenTotalRaw)` only (replayable across any invoice with the same amount); also accepted raw-hash `recoverAddress` | **Insecure** |
| Settlement | HSP only; fail-closed (good); `initialize()` never called; SSE transport despite "streamable HTTP" naming; fixture mode fabricated flow IDs | Unavailable |
| Receipt | Generated from a `FINALIZED` state that could not be reached honestly; zero-hash delivery digest fallback; no signatures or on-chain references | **Simulated** |
| Migrations | `db:migrate` → `dist/db/migrate.js` did not exist; schema only via docker initdb | **Broken** |
| Secrets | DB client defaulted to a hardcoded password; egress IP hardcoded and exposed in `/health` and errors; `/health` exposed endpoints/RPC URLs/DB errors | **Leaks** — rotate that password |
| Addresses | `0x19B8…66C2` used simultaneously as EIP-712 verifying contract, evidence registry and HSP token; mis-checksummed; never verified as deployed | **Misleading** |
| Contract | First caller of `commitInvoice(digest)` became issuer → public digests front-runnable; receipt commit without delivery | **Hardening needed** |
| Frontend client | Connected client sent no auth headers | **Broken** |
| Tests | Server tests wrote into the developer DB; one "positive" test asserted the amount-only Stage 2 signature; `test:all` skipped backend; no CI | **Insufficient** |

---

## 2. What is implemented now

See `docs/SECURITY_MODEL.md` for the trust model and `docs/SEPOLIA_INTEGRATION.md` for settlement.

- **Auth:** SIWE (EIP-4361) with single-use server nonces, domain/origin/chain binding, hashed 1-hour bearer sessions, logout, session-to-wallet binding in the UI; scoped agent credentials (`server/src/auth/auth.ts`).
- **Authorization:** participant-scoped reads (404 for outsiders), seller-only invoice/delivery writes, buyer-only payment requests, payer-only human approvals that agents can never perform.
- **Protocol v2** (`shared/protocol.ts`): one implementation of every digest for browser, backend, MCP and verifier.
- **Fail-closed verification** (`server/src/services/verification.ts`): canonical-JSON SHA-256 recomputed from artifact bytes, manifest signature + binding, chain-ID-validated bounded RPC recomputation of count, values, counterparties and sample proofs; PENDING on any RPC problem.
- **Payment authorization:** EIP-712 `HashXPaymentAuthorization` binding invoice digest, delivery evidence digest, payer, payee, token, chain, raw amount, attempt ID, random nonce, expiry; Stage 1 requires the exact digest; strict sequence with compare-and-set transitions.
- **Sepolia USDC settlement** (`server/src/settlement/sepoliaUsdc.ts`, `services/payments.ts`): wallet-broadcast transfer, independent receipt/log verification, confirmations policy, reorg rollback with receipt revocation, revert/drop/mismatch handling, durable background reconciler, receipts with full evidence, independent CLI verifier.
- **Persistence:** versioned checksummed migrations under an advisory lock; partial unique indexes (one live attempt per invoice incl. settled; tx hash ↔ one obligation; idempotent invoice creation; manifest reuse).
- **HSP:** separate fail-closed adapter with real connection/auth/tool/schema status.
- **MCP:** Streamable HTTP server, 9 tools, same service layer and authorization as HTTP.
- **Contract:** `HashXEvidenceRegistry` v2 (issuer-namespaced, ordered, write-once, non-custodial) + deployment/verification scripts.
- **Ops:** `/health` (liveness), `/ready` (DB, migrations, RPC per chain, on-chain token validation, registry check, HSP), request IDs, structured logs without secrets, strict CORS, security headers, rate limits, production config validation, CI.

---

## 3. Capability matrix

| Capability | Status | Evidence |
|---|---|---|
| SIWE wallet authentication, sessions, logout | **Real, tested** | `server/tests/integration/auth.test.ts` |
| Header-spoofing / localhost bypass removed | **Real, tested** | `auth.test.ts` › header spoofing |
| Actor-level authorization (seller/buyer/payer/outsider) | **Real, tested** | `auth.test.ts`, `golden_path.test.ts` |
| Scoped agent credentials; agents cannot approve | **Real, tested** | `auth.test.ts`, `settlement_failures.test.ts`, `mcp.test.ts` |
| EIP-712 invoice signing + mutation resistance | **Real, tested** | `tests/unit/protocol.test.ts`, `golden_path.test.ts` |
| Idempotent invoice creation | **Real, tested** | `golden_path.test.ts` |
| Fail-closed delivery verification (RPC down/mismatch/unbounded/unconfirmed) | **Real, tested** | `server/tests/unit/delivery_verification.test.ts` |
| Forged/tampered/cross-invoice/stale evidence rejected | **Real, tested** | same + `golden_path.test.ts` |
| Two-stage authorization bound to the full obligation | **Real, tested** | `golden_path.test.ts`, `protocol.test.ts` |
| Concurrent duplicate payment requests → one attempt | **Real, tested** | `golden_path.test.ts`, DB-level test in `settlement_failures.test.ts` |
| ERC-20 settlement verification (success, wrong amount/recipient/sender, revert, drop, reorg, RPC outage) | **Real, tested on a local EVM** | `golden_path.test.ts`, `settlement_failures.test.ts` |
| Receipt generation + independent verification (CLI) | **Real, tested on a local EVM** | `golden_path.test.ts`, `agent_example.test.ts` |
| State survives API restart | **Real, tested** | `golden_path.test.ts` › restart |
| Versioned migrations, checksum enforcement | **Real, tested** | `migrations.test.ts` |
| Circle Sepolia USDC: code, decimals 6, symbol | **Real, verified read-only against live Sepolia** | `sepolia_rpc.test.ts` (opt-in; executed with a public RPC) |
| Live Sepolia USDC transfer through the UI | **Implemented, not yet executed** | Requires deployed backend + funded wallets — see `docs/END_TO_END_DEMO.md` |
| Evidence Registry v2 contract | **Real, tested (Hardhat)** | `contracts/test_hardhat/*` |
| Evidence Registry on Sepolia | **Not deployed** | Requires explicit authorization + signer; `contracts/scripts/deploy-registry.js` |
| MCP agent tools | **Real, tested** | `mcp.test.ts`, `agent_example.test.ts` |
| HashKey HSP settlement | **Unavailable (fail-closed)** | `hsp_adapter.test.ts`; blockers in §4 |
| HashKey Mainnet payments | **Disabled by design** | `config.ts`, `auth.test.ts` |
| Demo mode / Proof Lab | **Simulated** (labelled) | `src/lib/api/client.ts` (DemoModeClient) |

## 4. Outstanding blockers & risks

1. **No live Sepolia transaction has been executed yet.** Needs a deployed backend, a Sepolia RPC URL, two wallets with Sepolia ETH and Circle test USDC.
2. **Registry not deployed.** Run `contracts/scripts/deploy-registry.js` with `CONFIRM_DEPLOY=yes` from a signing environment you control; then set `EVIDENCE_REGISTRY_ADDRESS_SEPOLIA`.
3. **HSP:** no official credential/transport specification available to this team; requires HashKey to allowlist the backend's real egress IP, then live tool-schema validation. Execution remains hard-disabled.
4. **Smart-contract wallets** (ERC-1271) are not supported for SIWE or authorization (EOA only).
5. **Rate limiting is in-memory per instance**; use an edge/WAF limiter when running multiple instances.
6. **Receipts are seller-/buyer-scoped**, not public; independent verification works from an exported file.
7. **Verification service scope:** only `evm_address_analytics_v1` (≤ 50 blocks). Other services need their own objective verifiers.
8. **Legacy v1 rows** remain readable but are flagged `legacy` and can never be paid.
9. **Credential rotation:** the formerly hardcoded database password must be treated as compromised.
