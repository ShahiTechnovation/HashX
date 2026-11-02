# HashX Architecture

HashX is a trust layer between agents that request payment and humans whose funds pay.

## Pipeline

```
Seller (wallet or seller agent via MCP)
  → POST /invoices                         protocol-v2 terms, random nonce, idempotent client_request_id
  → seller wallet signs EIP-712 HashXInvoice
  → POST /invoices/:id/verify              signature, identity binding, expiry, replay, settlement terms
  → seller computes artifact, signs EIP-712 HashXDeliveryManifest
  → POST /invoices/:id/delivery/verify     SHA-256 of canonical bytes + independent, bounded RPC recomputation
Buyer
  → POST /invoices/:id/payments            immutable obligation (EIP-712 HashXPaymentAuthorization)
  → Stage 1 (human): approve exact digest
  → Stage 2 (human wallet): sign the authorization
  → buyer wallet broadcasts USDC.transfer(payee, amount) on Sepolia; reports tx hash
Backend reconciler
  → receipt status, token contract, Transfer(payer→payee, amount) log, canonical block, confirmations
  → CONFIRMED → hashx.receipt.v2 (independently verifiable) → FINALIZED
```

## Components

| Layer | Path | Responsibility |
|---|---|---|
| Shared protocol | `shared/protocol.ts` | canonical JSON, artifact hashing, EIP-712 schemas, analytics algorithm, receipt digest |
| Network config | `shared/networks.ts` | Sepolia 11155111 / HashKey 133 / HashKey 177 (independent), Circle Sepolia USDC, explorers, rails |
| API | `server/src/app.ts` | middleware (request IDs, CORS, headers, rate limits), routes, `/health`, `/ready` |
| Auth | `server/src/auth/auth.ts` | SIWE, sessions, agent credentials, guards |
| Services | `server/src/services/commerce.ts`, `payments.ts` | invoices, deliveries, eligibility, two-stage authorization, reconciliation, receipts |
| Verification | `server/src/services/verification.ts` | fail-closed invoice/delivery engines |
| Chain access | `server/src/chain/readers.ts` | chain-ID-validated, timeout-bounded RPC readers |
| Settlement adapters | `server/src/settlement/sepoliaUsdc.ts`, `hspAdapter.ts` | direct Sepolia USDC (live) · HashKey HSP (fail-closed) |
| Agents | `server/src/mcp/server.ts` | MCP Streamable HTTP, 9 tools over the same services |
| Persistence | `server/migrations/*.sql`, `server/src/db/migrate.ts` | versioned schema + invariants as unique indexes |
| Contract | `contracts/src/HashXEvidenceRegistry.sol` | optional public commitments (issuer-namespaced, write-once) |
| Frontend (connected) | `src/lib/live/*`, `src/components/live/*` | authenticated API client, wallet signing/broadcast, live views |
| Frontend (demo) | `src/lib/api/client.ts`, `src/mocks/*` | simulated in-browser fixtures (labelled) |

## Rails

| Rail | Chain | Status |
|---|---|---|
| `sepolia-usdc` | Ethereum Sepolia 11155111, Circle test USDC `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | Implemented; settlement verified independently |
| `hashkey-hsp` | HashKey Testnet 133 | Adapter present, fail-closed, not connected |
| — | HashKey Mainnet 177 | Payments disabled |

See [SECURITY_MODEL.md](SECURITY_MODEL.md) and [SEPOLIA_INTEGRATION.md](SEPOLIA_INTEGRATION.md).
