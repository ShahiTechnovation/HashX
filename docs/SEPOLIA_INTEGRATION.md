# Ethereum Sepolia Integration (Test USDC)

HashX settles testnet payments as a **direct ERC-20 transfer of Circle's official test USDC on
Ethereum Sepolia**, broadcast by the buyer's own wallet and independently verified by the backend.
Test USDC has **no monetary value**. This rail is separate from — and is never presented as — a
HashKey HSP settlement.

## Network configuration

Single source of truth: `shared/networks.ts` (used by frontend and backend).

| | Ethereum Sepolia | HashKey Testnet | HashKey Mainnet |
|---|---|---|---|
| Chain ID | `11155111` | `133` | `177` |
| Settlement rail | `sepolia-usdc` | `hashkey-hsp` (not connected) | `hashkey-hsp` (disabled) |
| Settlement token | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` (USDC, 6 decimals, test) | — | — |
| Explorer | https://sepolia.etherscan.io | https://testnet-explorer.hsk.xyz | https://hashkey.blockscout.com |
| Payment execution | enabled (`SEPOLIA_PAYMENTS_ENABLED`) | unavailable | hard-disabled |
| Delivery verification | yes | yes (needs `HSK_TESTNET_RPC`) | yes, read-only (needs `HSK_MAINNET_RPC`) |

Unknown chain IDs throw `UnsupportedChainError`; nothing defaults to 133.

The token address comes from Circle's USDC contract-address directory (Ethereum Sepolia). The backend
re-validates it on-chain in `/ready` (`validateSettlementToken`: contract code present, `decimals() == 6`,
`symbol() == "USDC"`). This was executed read-only against live Sepolia via
`server/tests/integration/sepolia_rpc.test.ts` (opt-in with `SEPOLIA_RPC_URL_TEST`).

Separated chain roles per invoice: **delivery chain** (`service.delivery_chain_id`, where the work is
verified), **signing chain** (EIP-712 domain; equals the settlement chain so wallets sign on the chain they pay on),
**settlement chain + rail** (`payment.settlement_chain_id`, `payment.rail`), and the **registry chain**
(deployment config, `EVIDENCE_REGISTRY_ADDRESS_SEPOLIA`).

## Payment flow

```
buyer: POST /invoices/:id/payments ──► attempt AWAITING_SIGNATURE_APPROVAL (+ EIP-712 authorization)
buyer (human): approve-terms(digest) ──► AWAITING_SUBMISSION_APPROVAL
buyer wallet: sign HashXPaymentAuthorization ──► AUTHORIZED (+ transferInstructions)
buyer wallet: USDC.transfer(payee, amount) on 11155111 ──► POST /payments/:id/transaction ──► SUBMITTED
backend: reconcile (immediately + every RECONCILE_INTERVAL_MS) ──► INCLUDED ──► CONFIRMED ──► FINALIZED
```

`transferInstructions` = `{ chainId, to: <USDC>, data: transfer(payee, amount), value: "0" }`. The wallet,
not HashX, signs and broadcasts. The UI stores the hash in `localStorage` before reporting it so a refresh
cannot lose it (`src/lib/live/wallet.ts`).

## Independent settlement verification

`server/src/settlement/sepoliaUsdc.ts › reconcileTransfer()`:

1. `eth_chainId` must equal the attempt's chain (checked once per reader).
2. No receipt: if the tx is known but pending → stay `SUBMITTED` (but `FAILED` immediately if its sender is not the
   payer or it does not call the token); unknown for longer than `PAYMENT_DROP_TIMEOUT_SECONDS` → `DROPPED`.
3. Receipt `status != success` → `FAILED (REVERTED)`.
4. `receipt.to` must be the configured token → else `FAILED (WRONG_CONTRACT)`.
5. A `Transfer` log **emitted by the token** with `from == payer`, `to == payee`, `value == amount` (exact integer)
   must exist → else `FAILED (TRANSFER_MISMATCH)` with the observed logs in the detail.
6. The receipt's block hash must still be canonical at its height → else roll back to `SUBMITTED` (reorg).
7. Confirmations = `tip − block + 1`; policy `SEPOLIA_FINALITY_POLICY` (`confirmations:12` default, or `finalized`).
   Below policy → `INCLUDED`; satisfied → `CONFIRMED` (+ settlement row, receipt, invoice `SETTLED`);
   at or below the `finalized` block → `FINALIZED`.

RPC errors never advance state (the attempt records "Reconciliation deferred"). The reconciler keeps
monitoring `CONFIRMED` attempts until `FINALIZED`; a reorg after confirmation revokes the receipt
(`receipts.revoked_at`) and returns the invoice to `DELIVERY_ACCEPTED`.

The tx hash ↔ attempt binding is unique forever; a settlement row is unique per `(chain_id, tx_hash)`.

## Receipt

`hashx.receipt.v2` (`shared/protocol.ts › ReceiptBody`) contains the full signed invoice terms + seller
signature, the delivery manifest + signature + artifact SHA-256 + verification run ID, the authorization
message + payer signature + Stage 1/2 timestamps, and settlement facts (chain, token, tx hash, log index,
block number/hash, from, to, raw amount, confirmations at issuance, finality policy).

Verify independently (no HashX backend needed):

```bash
pnpm --prefix server verify-receipt receipt.json --rpc https://<your-sepolia-rpc>
```

## Evidence registry on Sepolia

Contract: `contracts/src/HashXEvidenceRegistry.sol` (v2). **Not deployed yet.** To deploy (requires your explicit
authorization and your own signer; the key is read from the environment only):

```bash
cd contracts
SEPOLIA_RPC_URL=https://… DEPLOYER_PRIVATE_KEY=0x… CONFIRM_DEPLOY=yes pnpm deploy:sepolia
SEPOLIA_RPC_URL=https://… pnpm verify-deployment:sepolia
```

The script writes `deployments/sepolia.json` only after confirming a successful receipt, chain ID 11155111,
on-chain bytecode equal to the compiled artifact, and a working `VERSION()` read. The backend's `/ready`
re-checks code and `VERSION()` independently before reporting the registry as deployed.

## Manual Sepolia smoke test

See `docs/END_TO_END_DEMO.md` § "Live Sepolia run". CI never sends Sepolia transactions; deterministic
settlement tests run against a local Hardhat EVM with a local-only 6-decimal test token.
