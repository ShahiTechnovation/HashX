-- ==============================================================================
-- HashXV1 — Production PostgreSQL Relational Schema
-- ==============================================================================
-- Strictly implements the transactional and security invariants defined in the
-- HashXV1 Product Requirements Document (PRD Section 12-13).
--
-- CORE INVARIANT:
-- "There may never be two simultaneously payable HSP attempts for one invoice.
--  Enforce this with a transaction plus a partial unique index, not a UI-level check."
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. COUNTERPARTIES (Wallet-backed identity binding)
CREATE TABLE IF NOT EXISTS counterparties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_name VARCHAR(255) NOT NULL,
    wallet_address VARCHAR(42) NOT NULL,
    wallet_type VARCHAR(32) NOT NULL DEFAULT 'EOA', -- 'EOA' | 'CONTRACT'
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE' | 'SUSPENDED' | 'REVOKED'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_counterparty_wallet UNIQUE (wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_counterparties_wallet ON counterparties(LOWER(wallet_address));

-- 2. WALLET PROOFS (Single-use challenge signature verifications)
CREATE TABLE IF NOT EXISTS wallet_proofs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    counterparty_id UUID NOT NULL REFERENCES counterparties(id) ON DELETE CASCADE,
    challenge VARCHAR(255) NOT NULL UNIQUE,
    signature VARCHAR(132) NOT NULL,
    signer VARCHAR(42) NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- 3. INVOICES (Signed commercial obligations)
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(64) PRIMARY KEY, -- e.g. inv-XXXXXX
    version INT NOT NULL DEFAULT 1,
    client_request_id VARCHAR(128) NOT NULL,
    seller_id UUID NOT NULL REFERENCES counterparties(id),
    seller_wallet VARCHAR(42) NOT NULL,
    seller_display_name VARCHAR(255) NOT NULL,
    buyer_ref VARCHAR(255) NOT NULL,
    buyer_ref_hash VARCHAR(66) NOT NULL,
    service_type VARCHAR(64) NOT NULL, -- 'hsk_address_analytics_v1'
    service_params JSONB NOT NULL,
    service_terms_hash VARCHAR(66) NOT NULL,
    amount_minor VARCHAR(32) NOT NULL,
    currency VARCHAR(16) NOT NULL DEFAULT 'USD',
    payee VARCHAR(42) NOT NULL,
    preferred_chain_id INT NOT NULL DEFAULT 133,
    nonce VARCHAR(64) NOT NULL,
    digest VARCHAR(66) NOT NULL UNIQUE,
    signature VARCHAR(132),
    signer VARCHAR(42),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
    -- DRAFT, SIGNED, VERIFIED, DELIVERED, DELIVERY_ACCEPTED, DELIVERY_REJECTED, SETTLED, REJECTED
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_invoices_seller_nonce UNIQUE (seller_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_seller_wallet ON invoices(LOWER(seller_wallet));
CREATE INDEX IF NOT EXISTS idx_invoices_payee ON invoices(LOWER(payee));

-- 4. DELIVERIES (Objective service fulfillments & manifests)
CREATE TABLE IF NOT EXISTS deliveries (
    id VARCHAR(64) PRIMARY KEY, -- e.g. del-XXXXXX
    invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    version INT NOT NULL DEFAULT 1,
    artifact_uri TEXT NOT NULL,
    artifact_sha256 VARCHAR(66) NOT NULL,
    manifest JSONB NOT NULL,
    manifest_signature VARCHAR(132) NOT NULL,
    artifact_content JSONB NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_VERIFICATION',
    -- PENDING_VERIFICATION, ACCEPTED, REJECTED
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_deliveries_invoice_version UNIQUE (invoice_id, version)
);

CREATE INDEX IF NOT EXISTS idx_deliveries_invoice_id ON deliveries(invoice_id);

-- 5. VERIFICATION RUNS (Append-only deterministic evaluation audit)
CREATE TABLE IF NOT EXISTS verification_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    object_type VARCHAR(32) NOT NULL, -- 'INVOICE' | 'DELIVERY'
    object_id VARCHAR(64) NOT NULL,
    verifier_version VARCHAR(64) NOT NULL,
    decision VARCHAR(16) NOT NULL, -- 'PASS' | 'FAIL' | 'PENDING'
    checks JSONB NOT NULL,
    check_details JSONB NOT NULL,
    reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_digest VARCHAR(66),
    rpc_endpoint_used TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_runs_object ON verification_runs(object_type, object_id);

-- 6. PAYMENT ATTEMPTS (Authoritative HSP payment state machine)
CREATE TABLE IF NOT EXISTS payment_attempts (
    id VARCHAR(64) PRIMARY KEY, -- e.g. pay-XXXXXX
    invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    flow_id VARCHAR(128) NOT NULL,
    payment_request_id VARCHAR(128) NOT NULL,
    merchant_name VARCHAR(128) NOT NULL DEFAULT 'HashX Global',
    attribution_verified BOOLEAN NOT NULL DEFAULT TRUE,
    payer VARCHAR(42) NOT NULL,
    payee VARCHAR(42) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    token_total_raw VARCHAR(64) NOT NULL,
    quote_expires_at TIMESTAMPTZ NOT NULL,
    hsp_status VARCHAR(64) NOT NULL DEFAULT 'payment-submitted',
    -- payment-submitted, payment-verified, payment-processing, payment-included, payment-safe, payment-finalized, payment-failed, payment-timeout
    state VARCHAR(64) NOT NULL DEFAULT 'AWAITING_SIGNATURE_APPROVAL',
    -- AWAITING_SIGNATURE_APPROVAL, AWAITING_SUBMISSION_APPROVAL, SUBMITTED, FINALIZED, FAILED, TIMEOUT
    tx_hash VARCHAR(66),
    evidence_registry_tx VARCHAR(66),
    approval_summary JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_attempts_flow UNIQUE (flow_id),
    CONSTRAINT uq_payment_attempts_request UNIQUE (payment_request_id)
);

-- PARTIAL UNIQUE INDEX: Strictly enforces the PRD Invariant:
-- There can NEVER be two active, payable HSP payment attempts for the same invoice!
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_attempts_active_invoice 
ON payment_attempts(invoice_id) 
WHERE state NOT IN ('FINALIZED', 'FAILED');

CREATE INDEX IF NOT EXISTS idx_payment_attempts_invoice_id ON payment_attempts(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_hsp_status ON payment_attempts(hsp_status);

-- 7. APPROVALS (Two-stage human financial authorization records)
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_attempt_id VARCHAR(64) NOT NULL REFERENCES payment_attempts(id) ON DELETE CASCADE,
    stage VARCHAR(32) NOT NULL, -- 'SIGNING' | 'SUBMISSION'
    actor VARCHAR(42) NOT NULL,
    terms_hash VARCHAR(66) NOT NULL,
    signature VARCHAR(132),
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_approvals_attempt_stage UNIQUE (payment_attempt_id, stage)
);

-- 8. RECEIPTS (Verifiable cryptographic receipts linking invoice, delivery, approval & HSP settlement)
CREATE TABLE IF NOT EXISTS receipts (
    id VARCHAR(64) PRIMARY KEY, -- e.g. rcpt-XXXXXX
    invoice_id VARCHAR(64) NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT UNIQUE,
    receipt_version VARCHAR(16) NOT NULL DEFAULT '1',
    invoice_digest VARCHAR(66) NOT NULL,
    seller VARCHAR(42) NOT NULL,
    seller_display_name VARCHAR(255),
    buyer_ref VARCHAR(255) NOT NULL,
    delivery_evidence_digest VARCHAR(66) NOT NULL,
    payment_data JSONB NOT NULL,
    evidence_registry_tx VARCHAR(66),
    raw_payload_json JSONB NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. AUDIT EVENTS (Append-only immutable audit trail)
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregate_type VARCHAR(64) NOT NULL, -- 'INVOICE' | 'DELIVERY' | 'PAYMENT' | 'SETTLEMENT'
    aggregate_id VARCHAR(64) NOT NULL,
    sequence BIGSERIAL,
    actor VARCHAR(128) NOT NULL,
    event VARCHAR(64) NOT NULL,
    payload_digest VARCHAR(66) NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_aggregate ON audit_events(aggregate_type, aggregate_id);

-- 10. IDEMPOTENCY KEYS (API Request Replay & Concurrency Protection)
CREATE TABLE IF NOT EXISTS idempotency_keys (
    scope VARCHAR(64) NOT NULL, -- e.g. 'request_payment' | 'create_invoice'
    key VARCHAR(128) NOT NULL,  -- e.g. client_request_id or invoice_id
    request_hash VARCHAR(66) NOT NULL,
    response_payload JSONB,
    status_code INT NOT NULL DEFAULT 200,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (scope, key)
);

