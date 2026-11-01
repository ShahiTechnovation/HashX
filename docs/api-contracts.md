# HashX Global V1 — API & MCP Tool Contracts

This document formalizes the eight HashX-owned tool interfaces and their typed schemas, as well as their integration boundary with HSP tools.

## 1. Architectural Distinction
- **HashX MCP Tools (8 tools)**: High-level commercial contracts governing intent, EIP-712 structured data signing, delivery verification, human authorization, and verifiable receipts.
- **HSP Payment Rails (8 tools)**: Lower-level payment preparation and execution tools (`get_chain_config`, `create_order`, `get_order`, `prepare_payment`, `finalize_payment`, `estimate_fee`, `submit_payment`, `query_payment`).

---

## 2. HashX-Owned Tool Contracts

### 2.1 `create_invoice`
- **Mutates State**: Yes
- **Authorization**: Seller Agent / Integrator
- **Idempotency Key**: `client_request_id` (UUID)

```json
{
  "client_request_id": "uuid",
  "seller_counterparty_id": "uuid",
  "buyer_ref": "string",
  "service": {
    "type": "hsk_address_analytics_v1",
    "parameters": {
      "address": "0x...",
      "start_block": "uint64-string",
      "end_block": "uint64-string"
    },
    "acceptance_policy": "analytics_v1"
  },
  "payment": {
    "currency": "USD",
    "amount_minor": "100",
    "payee": "0x...",
    "preferred_chain_id": 133
  },
  "expires_at": "RFC3339"
}
```

### 2.2 `sign_invoice`
- **Mutates State**: Yes
- **Authorization**: Seller Wallet (EOA)
- **Idempotency Key**: `invoice_id` + `version`

```json
{
  "invoice_id": "uuid",
  "signature": "0x65-byte-signature",
  "signer": "0x..."
}
```

### 2.3 `verify_invoice`
- **Mutates State**: No
- **Checks**:
  - `schema`: Strict EIP-712 schema
  - `signature`: EIP-712 digest recovery
  - `identity_binding`: Seller wallet bound to active counterparty
  - `expiry`: Valid current timestamp
  - `nonce_unused`: Replay protection check
  - `terms_consistent`: Recomputed `serviceTermsHash`

### 2.4 `submit_delivery`
- **Mutates State**: Yes
- **Authorization**: Seller Agent
- **Deliverable Schema**: `hashx.analytics.v1`
- **Manifest Schema**: `hashx.delivery.analytics.v1`

### 2.5 `verify_delivery`
- **Mutates State**: No
- **Checks**:
  - `manifest_signature`
  - `artifact_hash` (SHA-256)
  - `schema`
  - `requested_address`
  - `block_range`
  - `transaction_count` (recomputed against HashKey Chain RPC)
  - `sample_transaction_proofs`
  - `freshness`

### 2.6 `request_payment`
- **Mutates State**: Yes
- **Authorization**: Buyer Agent
- **Idempotency Invariant**: If an active attempt exists, returns it without creating a new order.

### 2.7 `get_payment_status`
- **Mutates State**: No
- **Poll Interval**: ~15 seconds recommended during active processing.
- **Timeout Rule**: After 10 minutes without terminal safe/final/failed state, display pending confirmation while retaining identifiers for recovery.

### 2.8 `get_receipt`
- **Mutates State**: No
- **Returns**: Complete cryptographic evidence bundle linking invoice digest, fulfillment digest, human authorization hash, and finalized HSP settlement tx.
