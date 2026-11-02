# HashX — Deployment Guide

Legend: 🔑 needs credentials · 🏗️ needs external infrastructure · 🧑 needs a human decision/action.
Nothing here provisions paid infrastructure or sends mainnet transactions.

## Architecture

- **Frontend** — Next.js on Vercel (unchanged). Public config only (`.env.example`).
- **Backend** — Node 22+ service (`server/`), long-running (reconciler loop), behind TLS (Caddy example in `Caddyfile`).
- **PostgreSQL** 15+.
- **RPC** — your own Sepolia RPC provider (server-side only).

## 1. Database 🏗️

Provision PostgreSQL and set `DATABASE_URL`. Apply versioned migrations (idempotent, checksummed,
advisory-locked):

```bash
pnpm --prefix server install && pnpm --prefix server build
DATABASE_URL=… pnpm --prefix server db:migrate:prod
```

The server refuses to start while migrations are pending. If an older database was created from the
former `schema.sql`, migration `001_baseline` adopts it safely.

> 🧑 Rotate any database password that ever appeared in source history.

## 2. Backend 🔑 🏗️

Configure from `server/.env.example`. Required in production (validated at startup):

| Variable | Notes |
|---|---|
| `DATABASE_URL` | required |
| `ALLOWED_ORIGINS` | https origins of the frontend, e.g. `https://hashx-a2a.vercel.app` |
| `SIWE_ALLOWED_DOMAINS` | host(s) users sign in from, e.g. `hashx-a2a.vercel.app` |
| `SEPOLIA_RPC_URL` 🔑 | provider URL (never exposed by the API) |
| `TRUST_PROXY` | hop count when behind a proxy (e.g. `1`); leave unset otherwise |
| `SEPOLIA_FINALITY_POLICY` | `confirmations:12` (default) or `finalized` |

Docker (build context = repository root):

```bash
docker build -f server/Dockerfile -t hashx-backend .
# or: POSTGRES_PASSWORD=… ALLOWED_ORIGINS=… SIWE_ALLOWED_DOMAINS=… SEPOLIA_RPC_URL=… docker compose up -d
```

Health:
- `GET /health` — liveness.
- `GET /ready` — 200 only when the database is migrated; per-chain RPC status, on-chain validation of
  Circle's Sepolia USDC, evidence-registry status, HSP status. No secrets are exposed.

## 3. Frontend

Vercel environment:

```
NEXT_PUBLIC_OPERATION_MODE=connected
NEXT_PUBLIC_HASHX_API_URL=https://<your-backend>
```

Never put keys or secrets in `NEXT_PUBLIC_*`.

## 4. Evidence Registry on Sepolia 🔑 🧑

Not deployed yet. Deployment requires explicit authorization and a signing environment you control:

```bash
cd contracts
SEPOLIA_RPC_URL=… DEPLOYER_PRIVATE_KEY=… CONFIRM_DEPLOY=yes pnpm deploy:sepolia
SEPOLIA_RPC_URL=… pnpm verify-deployment:sepolia
```

Commit the generated `deployments/sepolia.json` and set `EVIDENCE_REGISTRY_ADDRESS_SEPOLIA`.
The registry is optional for payments; `/ready` reports it as deployed only after an on-chain code + `VERSION()` check.

## 5. Live Sepolia smoke test 🧑 🏗️

Two wallets you control; the buyer needs Sepolia ETH and Circle test USDC (https://faucet.circle.com).
Follow `docs/END_TO_END_DEMO.md` §3 and record the real transaction hash and verifier output.

## 6. HashKey HSP 🔑 🏗️ 🧑 (blocked)

1. Obtain an official HSP integration specification (transport, credential scheme, tool schemas).
2. Determine the backend's **actual** public egress IP (e.g. from the host, not a developer laptop) and have HSP operations allowlist it.
3. Configure `HSP_MCP_STREAMABLE_HTTP_ENDPOINT`, `HSP_APP_KEY`, `HSP_APP_SECRET`; then set `HSP_ALLOWLIST_CONFIRMED=true`.
4. Check `/ready` → `settlement.hashkey-hsp` for connection, authentication, discovered tools and blockers.

Execution stays disabled in code until the credential scheme is verified and the adapter is updated to the
official schemas — a flag alone cannot enable it.

## 7. Operational notes

- Rate limiting is in-memory per instance; add an edge/WAF limiter for multi-instance deployments.
- Logs are structured JSON with request IDs; they never contain tokens, signatures or request bodies.
- The reconciler resumes pending settlements after restarts (state lives in PostgreSQL).
- CI: `.github/workflows/ci.yml` (frontend typecheck/test/build, Hardhat tests, backend tests with PostgreSQL + local EVM).
