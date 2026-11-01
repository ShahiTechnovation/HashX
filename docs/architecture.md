# HashXV1 — System Architecture

## 1. Overview
**HashX** is the Trust Layer for Agent Payments, built around **HashKey Chain** and **HSP (HashKey Settlement Protocol)**.

In an autonomous agent ecosystem, an AI agent should never authorize payment merely because another agent sends a payment request. HashX enforces a strict commercial pipeline:
1. **Commercial Intent**: Structured agreement creation.
2. **EIP-712 Signature**: Seller authorizes the terms using cryptographic typed structured data.
3. **Invoice Verification**: Pre-fulfillment checks for schema, signature, expiry, counterparty binding, and replay nonce.
4. **Service Delivery**: Objective digital deliverable (`hashx.analytics.v1`) and signed manifest submitted.
5. **Deterministic Fulfillment Verification**: Direct recomputation of transaction telemetry against HashKey Chain RPC (chain ID 133 / 177).
6. **Payment Eligibility Gating**: Payment actions remain completely blocked unless both invoice and delivery checks pass.
7. **Two-Stage Human Authorization**:
   - Stage 1: Explicit review and wallet signing of the exact prepared HSP EIP-712 payload (showing raw token amount, payer, payee, token contract, and quote expiration).
   - Stage 2: Deliberate second approval before broadcast and submission to HSP.
8. **HSP Settlement & Reconciliation**: Polling until terminal state with strict distinction between `payment-safe` (on-chain unfinalized) and `payment-finalized`.
9. **Verifiable Receipt**: Cryptographic proof linking the commercial agreement, fulfillment evidence, and on-chain commitment registry.

```
Commercial Intent
      │
      ▼
EIP-712 Signed Invoice
      │
      ▼
Invoice Verification (6 Checks)
      │
      ▼
Service Delivery (JSON Artifact + Manifest)
      │
      ▼
Deterministic Verification (8 Checks via RPC)
      │
      ▼
Payment Eligibility Gated
      │
      ▼
Human Approval 1 (Sign Exact HSP Payload)
      │
      ▼
Human Approval 2 (Deliberate Submission)
      │
      ▼
HSP Settlement Reconciler (payment-safe != payment-finalized)
      │
      ▼
Verifiable Receipt & On-Chain Commitment
```

## 2. Security Boundaries & Zero-Custody Rule
- **No Raw Private Keys**: HashX never handles, persists, or transmits raw private keys. All signing occurs through user or agent wallet boundaries.
- **Frontend Usability vs Security Enforcement**: Frontend button disabling is a UX affordance. The deterministic policy code and backend verification engine remain authoritative.
- **Idempotency Invariant**: Repeated payment requests return the existing active payment attempt rather than creating duplicate orders.
- **HSP Rate Quote Expiry**: Quotes expire after 5 minutes. Expired quotes cannot be submitted; a fresh quote must be prepared.

## 3. HashKey Chain Infrastructure
- **Testnet**: Chain ID `133`, RPC: `https://testnet.hsk.xyz`
- **Mainnet**: Chain ID `177`, RPC: `https://mainnet.hsk.xyz`
- **Evidence Registry Contract**: `0x19B861876D8075A11eC6c4596395b058fe8466C2`

