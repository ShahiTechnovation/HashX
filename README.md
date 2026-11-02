# HashX — The Trust Layer for Agent Payments

> An autonomous agent should not spend funds merely because another agent asks to be paid.
> **No verified work, no authorized payment.**

HashX enforces, in order: authenticated commercial intent → a seller-signed EIP-712 invoice →
independent verification of the delivered work → replay-resistant payment eligibility → explicit
two-stage human authorization from the payer's own wallet → a real on-chain transfer → an
independently verifiable receipt.

**Current testnet rail:** direct transfer of Circle's official **Test USDC on Ethereum Sepolia**
(chain `11155111`, no monetary value). **HashKey HSP** is integrated as a separate, fail-closed adapter
and is **not connected** yet. HashKey Mainnet payments are disabled.

## What is real vs simulated

| | Status |
|---|---|
| SIWE wallet sign-in, sessions, actor-level authorization | Real, tested |
| Protocol-v2 EIP-712 invoices, delivery manifests, payment authorizations | Real, tested |
| Fail-closed delivery verification (independent, bounded RPC recomputation) | Real, tested |
| Two-stage human authorization + idempotent, concurrency-safe payment attempts | Real, tested |
| Sepolia Test USDC settlement verification (receipt, Transfer log, confirmations, reorgs) | Real, tested on a local EVM; Circle USDC validated read-only on live Sepolia |
| Live Sepolia transfer through the UI | Implemented; **not yet executed** (needs deployed backend + funded wallets) |
| Evidence Registry v2 | Tested on Hardhat; **not deployed** to Sepolia |
| MCP agent tools (9) | Real, tested |
| HashKey HSP settlement | Unavailable (fail-closed) |
| Demo mode / Proof Lab | **Simulated** in-browser fixtures (labelled) |

Details and evidence: [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md).

## Repository layout

```
shared/      networks.ts (chain/token config) · protocol.ts (all digests & EIP-712 schemas)
server/      Express API, SIWE auth, verification, settlement adapters, reconciler, MCP, migrations
contracts/   HashXEvidenceRegistry v2 (Hardhat), deploy/verify scripts
src/         Next.js app (marketing + /app); connected mode uses src/lib/live/*
docs/        security model, Sepolia integration, API contracts, deployment, end-to-end demo
```

## Quick start

```bash
pnpm install && pnpm --prefix server install && pnpm --prefix contracts install

# Frontend only (demo mode, simulated data)
pnpm dev

# Everything, tested (needs local PostgreSQL; see docs/END_TO_END_DEMO.md)
pnpm test:all
```

Connected mode: run the backend (`docs/deployment.md`), then
`NEXT_PUBLIC_OPERATION_MODE=connected NEXT_PUBLIC_HASHX_API_URL=… pnpm dev`.

## Verifying a receipt yourself

```bash
pnpm --prefix server verify-receipt receipt.json --rpc https://<sepolia-rpc>
```

Checks every signature and digest in the receipt and the referenced ERC-20 Transfer log on-chain.

## Documentation

- [Security model](docs/SECURITY_MODEL.md) — trust boundaries, commitments, invariants
- [Sepolia integration](docs/SEPOLIA_INTEGRATION.md) — rail, verification, registry deployment
- [API contracts](docs/api-contracts.md) — HTTP + MCP
- [End-to-end demo](docs/END_TO_END_DEMO.md) — automated, local, and live Sepolia runs
- [Deployment](docs/deployment.md) — what needs credentials, infrastructure, or a human
- [Production readiness](docs/PRODUCTION_READINESS.md) — baseline audit and capability matrix
- [Design system](docs/design-system.md)
