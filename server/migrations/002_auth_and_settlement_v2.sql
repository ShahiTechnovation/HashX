-- 002_auth_and_settlement_v2
-- Wallet (SIWE) authentication, scoped agent credentials, protocol-v2 invoices,
-- fail-closed verification provenance, and the direct Sepolia USDC settlement state machine.

-- ---------------------------------------------------------------------------
-- Identity & authentication
-- ---------------------------------------------------------------------------
ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS wallet_verified_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS uq_counterparties_wallet_lower ON counterparties (LOWER(wallet_address));

CREATE TABLE IF NOT EXISTS auth_nonces (
    nonce VARCHAR(64) PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires ON auth_nonces (expires_at);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- SHA-256 of the bearer token; the token itself is never stored.
    token_hash CHAR(64) NOT NULL UNIQUE,
    wallet_address VARCHAR(42) NOT NULL,
    counterparty_id UUID NOT NULL REFERENCES counterparties(id),
    siwe_domain VARCHAR(255) NOT NULL,
    siwe_chain_id INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_wallet ON auth_sessions (LOWER(wallet_address));

CREATE TABLE IF NOT EXISTS agent_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash CHAR(64) NOT NULL UNIQUE,
    key_prefix VARCHAR(24) NOT NULL,
    owner_counterparty_id UUID NOT NULL REFERENCES counterparties(id),
    owner_wallet VARCHAR(42) NOT NULL,
    label VARCHAR(128) NOT NULL,
    scopes TEXT[] NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    CONSTRAINT ck_agent_scopes CHECK (
        scopes <@ ARRAY['invoices:read','invoices:write','deliveries:write','verification:run','payments:request','payments:read']::TEXT[]
    )
);

-- ---------------------------------------------------------------------------
-- Invoices (protocol v2)
-- ---------------------------------------------------------------------------
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS protocol_version INT NOT NULL DEFAULT 1;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS buyer_wallet VARCHAR(42);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signing_chain_id INT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS delivery_chain_id INT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS settlement_rail VARCHAR(32);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS settlement_chain_id INT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS token_address VARCHAR(42);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS token_symbol VARCHAR(16);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS token_decimals INT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_raw NUMERIC(78, 0);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS request_hash VARCHAR(66);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by VARCHAR(128);
ALTER TABLE invoices ALTER COLUMN nonce TYPE VARCHAR(66);
-- v1 USD-cent amounts do not apply to v2 raw-token invoices.
ALTER TABLE invoices ALTER COLUMN amount_minor DROP NOT NULL;
ALTER TABLE invoices ALTER COLUMN preferred_chain_id DROP DEFAULT;

-- Idempotent creation: one invoice per (seller, client_request_id) for v2 invoices.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_v2_client_request
    ON invoices (seller_id, client_request_id) WHERE protocol_version >= 2;
CREATE INDEX IF NOT EXISTS idx_invoices_buyer_wallet ON invoices (LOWER(buyer_wallet));

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS ck_invoices_v2_terms;
ALTER TABLE invoices ADD CONSTRAINT ck_invoices_v2_terms CHECK (
    protocol_version < 2 OR (
        buyer_wallet IS NOT NULL
        AND signing_chain_id IS NOT NULL
        AND delivery_chain_id IS NOT NULL
        AND settlement_rail IN ('sepolia-usdc', 'hashkey-hsp')
        AND settlement_chain_id IS NOT NULL
        AND token_address IS NOT NULL
        AND amount_raw IS NOT NULL AND amount_raw > 0
    )
) NOT VALID;

-- ---------------------------------------------------------------------------
-- Deliveries
-- ---------------------------------------------------------------------------
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS manifest_digest VARCHAR(66);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS artifact_sha256_computed VARCHAR(66);
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS submitted_by VARCHAR(128);
-- A signed manifest commits to one invoice digest; it can never be reused elsewhere.
CREATE UNIQUE INDEX IF NOT EXISTS uq_deliveries_manifest_digest ON deliveries (manifest_digest) WHERE manifest_digest IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Verification provenance
-- ---------------------------------------------------------------------------
ALTER TABLE verification_runs ADD COLUMN IF NOT EXISTS input_digest VARCHAR(66);
ALTER TABLE verification_runs ADD COLUMN IF NOT EXISTS evidence_sources JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE verification_runs ADD COLUMN IF NOT EXISTS chain_id INT;
ALTER TABLE verification_runs ADD COLUMN IF NOT EXISTS observed_block BIGINT;
ALTER TABLE verification_runs ADD COLUMN IF NOT EXISTS payable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE verification_runs ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(128);

-- ---------------------------------------------------------------------------
-- Payment attempts (rail-aware durable state machine)
-- ---------------------------------------------------------------------------
ALTER TABLE payment_attempts ALTER COLUMN flow_id DROP NOT NULL;
ALTER TABLE payment_attempts ALTER COLUMN payment_request_id DROP NOT NULL;
ALTER TABLE payment_attempts ALTER COLUMN quote_expires_at DROP NOT NULL;
ALTER TABLE payment_attempts ALTER COLUMN hsp_status DROP NOT NULL;
ALTER TABLE payment_attempts ALTER COLUMN hsp_status DROP DEFAULT;
ALTER TABLE payment_attempts ALTER COLUMN attribution_verified SET DEFAULT FALSE;
ALTER TABLE payment_attempts ALTER COLUMN merchant_name SET DEFAULT 'HashX';

ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS rail VARCHAR(32);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS chain_id INT;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS token_symbol VARCHAR(16);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS token_decimals INT;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS invoice_digest VARCHAR(66);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS delivery_id VARCHAR(64);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS delivery_evidence_digest VARCHAR(66);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS authorization_nonce VARCHAR(66);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS authorization_digest VARCHAR(66);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS authorization_expires_at TIMESTAMPTZ;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS authorization_message JSONB;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS authorization_signature VARCHAR(132);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS finality_policy VARCHAR(64);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS confirmations INT NOT NULL DEFAULT 0;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS block_number BIGINT;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS block_hash VARCHAR(66);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS log_index INT;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS failure_code VARCHAR(64);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS failure_detail TEXT;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS included_at TIMESTAMPTZ;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS reconcile_count INT NOT NULL DEFAULT 0;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS row_version INT NOT NULL DEFAULT 0;
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);
ALTER TABLE payment_attempts ADD COLUMN IF NOT EXISTS requested_by VARCHAR(128);

ALTER TABLE payment_attempts DROP CONSTRAINT IF EXISTS ck_payment_attempts_state;
ALTER TABLE payment_attempts ADD CONSTRAINT ck_payment_attempts_state CHECK (state IN (
    'AWAITING_SIGNATURE_APPROVAL', 'AWAITING_SUBMISSION_APPROVAL', 'AUTHORIZED',
    'SUBMITTED', 'INCLUDED', 'CONFIRMED', 'FINALIZED',
    'FAILED', 'DROPPED', 'EXPIRED', 'CANCELLED', 'TIMEOUT'
)) NOT VALID;

-- The v1 index allowed a new attempt after FINALIZED (double payment). Settled attempts now
-- also occupy the slot: an invoice can have at most one non-failed attempt, ever.
DROP INDEX IF EXISTS idx_payment_attempts_active_invoice;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempts_live_invoice
    ON payment_attempts (invoice_id)
    WHERE state NOT IN ('FAILED', 'DROPPED', 'EXPIRED', 'CANCELLED', 'TIMEOUT');

-- A transaction hash can be bound to at most one payment attempt, permanently.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempts_chain_tx
    ON payment_attempts (chain_id, LOWER(tx_hash)) WHERE tx_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempts_auth_nonce
    ON payment_attempts (authorization_nonce) WHERE authorization_nonce IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_attempts_idempotency
    ON payment_attempts (invoice_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_attempts_state ON payment_attempts (state);

-- ---------------------------------------------------------------------------
-- Approvals
-- ---------------------------------------------------------------------------
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS session_id UUID;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS authorization_digest VARCHAR(66);

-- ---------------------------------------------------------------------------
-- Settlement transfers (independently verified ERC-20 Transfer logs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settlement_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_attempt_id VARCHAR(64) NOT NULL UNIQUE REFERENCES payment_attempts(id),
    chain_id INT NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INT NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    from_address VARCHAR(42) NOT NULL,
    to_address VARCHAR(42) NOT NULL,
    amount_raw NUMERIC(78, 0) NOT NULL,
    block_number BIGINT NOT NULL,
    block_hash VARCHAR(66) NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_settlement_transfers_tx UNIQUE (chain_id, tx_hash)
);

-- ---------------------------------------------------------------------------
-- Receipts
-- ---------------------------------------------------------------------------
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS receipt_digest VARCHAR(66);
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS payment_attempt_id VARCHAR(64);
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS chain_id INT;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS tx_hash VARCHAR(66);
CREATE UNIQUE INDEX IF NOT EXISTS uq_receipts_digest ON receipts (receipt_digest) WHERE receipt_digest IS NOT NULL;
-- If a confirmed transfer is later reorganized out of the canonical chain, the receipt is
-- marked revoked (receipts are never silently rewritten or deleted).
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS revocation_reason TEXT;
-- One *live* receipt per invoice / payment attempt; revoked receipts remain as history.
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_invoice_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_receipts_live_invoice ON receipts (invoice_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_receipts_live_attempt ON receipts (payment_attempt_id)
    WHERE payment_attempt_id IS NOT NULL AND revoked_at IS NULL;
