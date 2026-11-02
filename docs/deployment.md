# HashXV1 — Deployment Guide

## 1. Prerequisites
- Node.js `v20+` (or `v24+`)
- Package manager: `pnpm` (recommended) or `npm`
- Git
- PostgreSQL 15+ (for backend persistent storage)

---

## 2. Local Installation & Development

```bash
# 1. Clone repository
git clone https://github.com/ShahiTechnovation/HashX.git
cd HashX

# 2. Install root and server dependencies
pnpm install
pnpm --prefix server install

# 3. Configure environment variables
# Frontend:
cp .env.example .env.local
# Backend:
cp server/.env.example server/.env

# 4. Run automated test suites
pnpm test
pnpm test:server

# 5. Typecheck code
pnpm typecheck
pnpm --prefix server build

# 6. Start development servers
# Terminal 1 (Backend):
pnpm --prefix server dev
# Terminal 2 (Frontend):
pnpm dev
```

Open `http://localhost:3000` to view the marketing site and application.

---

## 3. Production Build & Deployment

```bash
# Build optimized production bundle
pnpm build
pnpm --prefix server build

# Start production server
pnpm start
```

### Deployment Targets
The application is fully compatible with:
- **Vercel**: Next.js App Router zero-config deployment.
- **Docker / Persistent Node Container**: Recommended for environments where a stable public egress IP is required for HSP QA allowlisting.
- **Cloudflare Pages / AWS Amplify / Netlify**: Standard Next.js serverless adapters.

---

## 4. Environment Variables Reference

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_OPERATION_MODE` | Execution mode: `demo` or `connected` | `demo` |
| `NEXT_PUBLIC_DEFAULT_CHAIN_ID` | Default HashKey Chain ID (`133` testnet / `177` mainnet) | `133` |
| `NEXT_PUBLIC_HSK_TESTNET_RPC` | Testnet RPC endpoint | `https://testnet.hsk.xyz` |
| `NEXT_PUBLIC_HSK_MAINNET_RPC` | Mainnet RPC endpoint | `https://mainnet.hsk.xyz` |
| `NEXT_PUBLIC_HASHX_API_URL` | Connected Mode backend URL | `http://127.0.0.1:8080` |
| `EVIDENCE_REGISTRY_ADDRESS_TESTNET` | Evidence Registry contract (server-side, null if not deployed) | `0x0000000000000000000000000000000000000000` |
| `HSP_ALLOWLIST_CONFIRMED` | Explicit switch to allow outbound calls to HSP QA (`qa-hsp.hashkey.com`) | `false` |

---

## 5. Persistent Backend & HSP QA Integration Requirements
When transitioning from `demo` mode to `connected` mode:
1. **Public Outbound IP Allowlist**: HashKey HSP QA requires the caller's public egress IP to be registered with HSP Operations. `HSP_ALLOWLIST_CONFIRMED=false` protects local development from premature outbound network requests.
2. **HSP Centralized Credentials**: Merchant App Key and App Secret are configured on the backend server (`server/.env`) and never exposed in `NEXT_PUBLIC_*` frontend variables.
3. **Database Uniqueness**: PostgreSQL with partial unique indices on active payment attempts (`idx_payment_attempts_active_invoice`) enforces the single-payable-attempt invariant at the database layer.
