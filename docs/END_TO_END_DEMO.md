# End-to-End Demo

Three ways to exercise HashX, from fully automated to live testnet.

## 1. Automated (local EVM + PostgreSQL) — what CI runs

```bash
pnpm install && pnpm --prefix server install && pnpm --prefix contracts install
# Needs a local PostgreSQL. Either TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/hashx_test
# or DB_HOST/DB_USER/DB_PASSWORD in server/.env (a database named hashx_test is dropped and recreated).
pnpm test:all
```

The backend suite starts a Hardhat node on port 8546, deploys a local-only 6-decimal test token, recreates
`hashx_test`, applies migrations, and runs: the golden path through real HTTP routes, settlement failure modes
(wrong amount/recipient/sender, revert, drop, reorg, RPC outage), auth bypass attempts, MCP agents, and the
executable agent example (`server/examples/agent-golden-path.ts`).

## 2. Local interactive stack

```bash
# Terminal 1 — local EVM on :8545
pnpm --prefix contracts node
# Terminal 2 — deploy the local-only test token (and optionally the registry)
cd contracts && npx hardhat run scripts/deploy-local-test-usdc.js --network localhost
npx hardhat run scripts/deploy-registry.js --network localhost   # optional; writes deployments/localhost.json
# Terminal 3 — backend
cd server && cp .env.example .env   # then set, for local only:
#   NODE_ENV=development, DB_* or DATABASE_URL, ALLOWED_ORIGINS=http://localhost:3000,
#   SIWE_ALLOWED_DOMAINS=localhost:3000, HASHX_ENABLE_LOCAL_CHAIN=true,
#   LOCAL_RPC_URL=http://127.0.0.1:8545, LOCAL_SETTLEMENT_TOKEN_ADDRESS=<token>
pnpm db:migrate && pnpm dev
# Terminal 4 — frontend
NEXT_PUBLIC_OPERATION_MODE=connected NEXT_PUBLIC_HASHX_API_URL=http://localhost:8080 pnpm dev
```

The local chain (31337) is accepted only when `HASHX_ENABLE_LOCAL_CHAIN=true` and never in production.
The browser UI lists public networks only; use the API/agent example for 31337.

Agent example against this stack:

```bash
cd server
SELLER_PRIVATE_KEY=<hardhat key #1> BUYER_PRIVATE_KEY=<hardhat key #2> SUBJECT_ADDRESS=0x… \
START_BLOCK=… END_BLOCK=… CHAIN_ID=31337 RPC_URL=http://127.0.0.1:8545 pnpm example:golden-path
```

## 3. Live Sepolia run (manual; requires infrastructure)

**Requires:** a deployed backend with PostgreSQL (`docs/deployment.md`), `SEPOLIA_RPC_URL`, the frontend in
connected mode pointing at it, and **two wallets you control**:

- Seller wallet: a little Sepolia ETH (gas for nothing — sellers only sign; ETH is optional).
- Buyer wallet: Sepolia ETH for gas and Circle test USDC from https://faucet.circle.com (Ethereum Sepolia).

Steps (UI):

1. **Seller** — connect wallet, *Sign in with Ethereum*, open **Invoices → New**. Enter the buyer wallet, a subject
   address, and a recent ≤ 50-block Sepolia range ("Use recent blocks"), amount e.g. `1.00` Test USDC. Submit → wallet
   signs the EIP-712 invoice → HashX verifies it (Trust Inspector shows PASS with the recovered signer).
2. **Seller** — on the invoice, *Compute & submit delivery*: the browser recomputes the analytics from a public RPC,
   the wallet signs the manifest, HashX recomputes everything from its own RPC. PASS requires every check; an
   unconfirmed range shows PENDING (try again after ~6 blocks).
3. **Buyer** — switch accounts, sign in, open the invoice → *Request payment*.
4. **Buyer** — Human Approval: review payer, recipient, token `0x1c7D…7238`, chain 11155111, raw amount and expiry.
   Stage 1 (exact digest) → Stage 2 (wallet EIP-712 authorization) → *Send Test USDC transfer* (wallet).
5. **Settlement Explorer** shows `SUBMITTED → INCLUDED (n/12 confirmations) → CONFIRMED`, with the Etherscan link.
6. **Receipts** — export JSON and verify independently:
   `pnpm --prefix server verify-receipt receipt.json --rpc <sepolia rpc>` → `RECEIPT VERIFIED`.

**Evidence to record** (never fabricate): invoice ID and digest, delivery evidence digest, authorization digest,
the Sepolia transaction hash and Etherscan URL, block number, and the verifier output.

> Status: this live run has **not** been executed as part of this change. No Sepolia transaction hash is claimed.

## Demo mode / Proof Lab

Demo mode runs entirely in the browser with simulated fixtures (clearly labelled). Its hashes are illustrative and
it never contacts the backend. Use it to show adversarial scenarios (tampered invoice, inflated delivery claims);
use connected mode for real records.
