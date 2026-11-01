# HashX — The Trust Layer for Agent Payments

[![Next.js](https://img.shields.io/badge/Next.js-15.2.1-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)](https://www.typescriptlang.org/)
[![HashKey Chain](https://img.shields.io/badge/HashKey_Chain-EVM_133_%2F_177-purple)](https://www.hashkey.id/)
[![Tests](https://img.shields.io/badge/Tests-23_Passed-success)](https://vitest.dev/)
[![A11y](https://img.shields.io/badge/Accessibility-WCAG_2.2_AA-green)](https://www.w3.org/WAI/standards-guidelines/wcag/)

> **HashX** is a verification-first agent-to-agent commerce protocol built around **HashKey Chain** and **HSP (HashKey Settlement Protocol)**.
>
> An AI agent should never authorize payment merely because another agent sends a payment request. A commercial obligation must first be cryptographically authenticated, fulfilled according to testable terms, approved by a human, and reconciled to settlement.

---

## Design System
Graphite base, warm near-white type, and electric violet used only as a signal. Inter for UI, Geist for display, Geist Mono for machine data. Status is never conveyed by color alone, and `payment-safe` is always rendered as **not final**. See [docs/design-system.md](docs/design-system.md).

---

## ⚡ Core Value Proposition & Protocol Pipeline

```text
Commercial Intent  
→ EIP-712 Invoice Signature  
→ Invoice Verification (6 Checks)  
→ Service Delivery (hashx.analytics.v1 Artifact + Manifest)  
→ Deterministic Fulfillment Verification (8 RPC Checks)  
→ Payment Eligibility Gating  
→ Human Signing Approval (Stage 1: Exact Raw Amount, Payee, Payer, Expiry)  
→ Wallet EIP-712 Signature  
→ Human Submission Approval (Stage 2: Deliberate Broadcast Confirmation)  
→ HSP Payment Rail Finalization  
→ Settlement Reconciliation (Strict payment-safe != payment-finalized)  
→ Verifiable Cryptographic Receipt
```

---

## 🚀 Key Implemented Features

### 1. Marketing Platform (`/`)
- High-contrast fintech storytelling inspired by Spectram.
- Interactive 6-stage lifecycle animation.
- Unsafe vs Verification-First agentic commerce risk comparison.
- Three core pillars: **Verify**, **Authorize**, **Settle**.
- Developer MCP integration section with live code samples.

### 2. Commercial Invoice Workspace (`/app/invoices`)
- Compact tabular view of commercial obligations with filtering by status, search, and sorting.
- Multi-step Invoice Composer (`/app/invoices/new`):
  - Step 1: Counterparty identity binding.
  - Step 2: Locked service definition (`hsk_address_analytics_v1`, block range).
  - Step 3: Exact commercial terms (USD minor units, payee wallet, validity window).
  - Step 4: Review agreement and EIP-712 typed structured data.
  - Step 5: Seller wallet cryptographic signature.
- Invoice Detail (`/app/invoices/[id]`):
  - Immutable signed commercial terms.
  - Interactive service fulfillment deliverable submitter with syntax-highlighted JSON viewer.
  - Real-time payment eligibility indicator.

### 3. Trust Inspector (`/app/trust` & `/app/trust/[id]`) — Signature Screen
- Instant 5-second diagnostic verdict: **PASS**, **FAIL**, or **PENDING**.
- **6 Invoice Cryptographic Checks**:
  1. `schema`
  2. `signature`
  3. `identity_binding`
  4. `expiry`
  5. `nonce_unused`
  6. `terms_consistent`
- **8 Deterministic Delivery Checks**:
  1. `manifest_signature`
  2. `artifact_hash`
  3. `schema`
  4. `requested_address`
  5. `block_range`
  6. `transaction_count` (recomputed against HashKey Chain RPC)
  7. `sample_transaction_proofs`
  8. `freshness`
- Expandable evidence cards with **Expected vs Actual** values and reason codes (`SIGNATURE_INVALID`, `TX_COUNT_MISMATCH`, `ARTIFACT_TAMPERED`, `BLOCK_RANGE_MISMATCH`, `SELLER_UNBOUND`, `INVOICE_EXPIRED`, etc.).
- Strict payment action disabling whenever policy checks fail.

### 4. Two-Stage Human Financial Authorization (`/app/approvals` & `/app/approvals/[id]`)
- **Stage 1 (Pre-Signing)**: Displays exact merchant attribution, payer, payee, token contract, raw integer token units (`token_total_raw`), human-readable amount, and 5-minute quote expiration timer before wallet signing.
- **Stage 2 (Pre-Submission)**: Re-displays verified terms after signing; requires a deliberate second click to submit. No silent auto-broadcast!
- **Quote Expiry Handling**: Disabled actions with repreparation notice upon quote expiration.

### 5. Settlement Explorer (`/app/settlements` & `/app/settlements/[id]`)
- Preserves all authoritative HSP identifiers: `payment_attempt_id`, `flow_id`, `payment_request_id`, `attribution_verified`, `token_total_raw`.
- Strict semantic mapping: `payment-safe` is labeled **On-Chain Safe (Unfinalized)** and is **never** presented as finalized until irreversible finality is reached.
- 15-second status polling simulator and event audit timeline.

### 6. Verifiable Commercial Receipts (`/app/receipts` & `/app/receipts/[id]`)
- Document layout linking the signed invoice, seller identity, fulfillment telemetry digest, human approval record, and HashKey Chain settlement transaction.
- JSON proof bundle export and optimized print stylesheet (`@media print`).

### 7. Guided Demo Center (`/app/demo`)
- Hackathon-ready demonstration center featuring:
  - **Scenario A**: Tampered invoice payee -> `SIGNATURE_INVALID`. Payment blocked.
  - **Scenario B**: Fraudulent delivery transaction count -> `TX_COUNT_MISMATCH`. Payment blocked.
  - **Scenario C**: Concurrent duplicate payment requests -> Idempotency enforced, returning existing attempt without duplicate orders.
  - **Scenario D**: Complete Golden Path from procurement to finalized receipt.

### 8. Developer & MCP Tool Catalog (`/app/developers`)
- Fully typed interfaces for the 8 HashX-owned tools (`create_invoice`, `sign_invoice`, `verify_invoice`, `submit_delivery`, `verify_delivery`, `request_payment`, `get_payment_status`, `get_receipt`).
- Clear distinction from HSP's separate 8 payment rail tools.

---

## 🧪 Automated Test Verification

The repository includes comprehensive unit and integration test suites:

```bash
# Run tests with vitest
pnpm test
```

### Actual Test Results
```text
 ✓ tests/unit/formatters.test.ts (7 tests)
 ✓ tests/unit/eip712.test.ts (6 tests)
 ✓ tests/unit/idempotency.test.ts (1 test)
 ✓ tests/unit/verification.test.ts (9 tests)

 Test Files  4 passed (4)
      Tests  23 passed (23)
```

### TypeScript Strict Mode
```bash
# Run typecheck
pnpm typecheck
# Result: 0 errors
```

---

## 🛠️ Tech Stack
- **Framework**: Next.js 15.2 (App Router), React 19, TypeScript Strict Mode
- **Styling**: Tailwind CSS, Obsidian × Electric Violet custom tokens
- **Cryptography & EVM**: `viem` (EIP-712 typed structured data, keccak256, address checksumming)
- **Icons**: Lucide React
- **Testing**: Vitest, JSDOM, React Testing Library
- **Package Manager**: `pnpm`

---

## 📖 Documentation Index
- [Architecture & Threat Model](docs/architecture.md)
- [API & MCP Tool Contracts](docs/api-contracts.md)
- [Design System & Accessibility](docs/design-system.md)
- [Demo Guide & Reproduction Walkthrough](docs/demo-guide.md)
- [Deployment & Environment Configuration](docs/deployment.md)

---

## 🔒 Security Invariants
1. **Zero Private Key Custody**: HashX never handles, persists, or transmits raw private keys.
2. **Deterministic RPC Recomputation**: Digital work claims are verified against HashKey Chain node data, not LLM opinions.
3. **Idempotent Payment Rails**: Multiple concurrent requests never create duplicate financial obligations.
4. **Honest Settlement States**: `payment-safe` is never misrepresented as finalized.

