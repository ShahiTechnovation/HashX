# HashX Global V1 — Deployment Guide

## 1. Prerequisites
- Node.js `v20+` (or `v24+`)
- Package manager: `pnpm` (recommended) or `npm`
- Git

---

## 2. Local Installation & Development

```bash
# 1. Clone repository
git clone https://github.com/hashx-global/hashx-frontend.git
cd hashx-frontend

# 2. Install dependencies
pnpm install

# 3. Configure environment variables
cp .env.example .env.local

# 4. Run automated test suite
pnpm test

# 5. Typecheck code
pnpm typecheck

# 6. Start development server
pnpm dev
```

Open `http://localhost:3000` to view the marketing site and application.

---

## 3. Production Build & Deployment

```bash
# Build optimized production bundle
pnpm build

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
| `NEXT_PUBLIC_EVIDENCE_REGISTRY_ADDRESS_TESTNET` | HashX Evidence Registry contract | `0x19B861876D8075A11eC6c4596395b058fe8466C2` |
| `NEXT_PUBLIC_HASHX_API_URL` | Connected Mode backend URL | `https://api.hashx.global/v1` |

---

## 5. Persistent Backend & HSP QA Integration Requirements
When transitioning from `demo` mode to `connected` mode:
1. **Public Outbound IP Allowlist**: HashKey HSP QA requires the caller's public egress IP to be registered with HSP Operations.
2. **HSP Centralized Credentials**: Merchant App Key and App Secret are configured on the backend server and never exposed in `NEXT_PUBLIC_*` frontend variables.
3. **Database Uniqueness**: PostgreSQL with partial unique indices on active payment attempts enforces the single-payable-attempt invariant at the database layer.
