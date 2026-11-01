import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, query, withTransaction } from "../src/db/client.js";
import { keccak256, toBytes } from "viem";

describe("Database-Level Idempotency & Concurrency Invariant", () => {
  const testInvoiceId = `inv-test-idemp-${Date.now().toString(36)}`;
  const testSellerWallet = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const testPayerWallet = "0x1234567890123456789012345678901234567890";

  beforeAll(async () => {
    // Insert test invoice with status DELIVERY_ACCEPTED
    await query(
      `INSERT INTO invoices (
        id, version, client_request_id, seller_id, seller_wallet, seller_display_name,
        buyer_ref, buyer_ref_hash, service_type, service_params, service_terms_hash,
        amount_minor, currency, payee, preferred_chain_id, nonce, digest, status, expires_at
      ) VALUES ($1, 1, 'req-idemp-01', 'a0000000-0000-0000-0000-000000000001', $2, 'Test Seller',
        'ref-01', '0x1234', 'analytics', '{}'::jsonb, '0xterms', '100', 'USD', $2, 133, $3, $4, 'DELIVERY_ACCEPTED', NOW() + INTERVAL '1 day')`,
      [
        testInvoiceId,
        testSellerWallet,
        `nonce-${Date.now()}`,
        keccak256(toBytes(`digest-${testInvoiceId}`)),
      ]
    );
  });

  afterAll(async () => {
    // Cleanup test data
    await query("DELETE FROM payment_attempts WHERE invoice_id = $1", [testInvoiceId]);
    await query("DELETE FROM invoices WHERE id = $1", [testInvoiceId]);
  });

  it("atomic transaction returns identical attempt on sequential duplicate payment requests", async () => {
    const requestPaymentDb = async (invId: string) => {
      return withTransaction(async (client) => {
        // Lock invoice row
        const invLock = await client.query("SELECT * FROM invoices WHERE id = $1 FOR UPDATE", [invId]);
        if (invLock.rowCount === 0) throw new Error("Invoice not found");

        // Check active attempt
        const existing = await client.query(
          "SELECT * FROM payment_attempts WHERE invoice_id = $1 AND state NOT IN ('FINALIZED', 'FAILED') LIMIT 1",
          [invId]
        );
        if (existing.rowCount && existing.rowCount > 0) {
          return existing.rows[0];
        }

        const newId = `pay-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        const flowId = `flow-${Math.floor(10000 + Math.random() * 90000)}`;
        const reqId = `pr-${Math.floor(10000 + Math.random() * 90000)}`;

        await client.query(
          `INSERT INTO payment_attempts (
            id, invoice_id, flow_id, payment_request_id, merchant_name, attribution_verified,
            payer, payee, token_address, token_total_raw, quote_expires_at, hsp_status, state, approval_summary
          ) VALUES ($1, $2, $3, $4, 'HashX', true, $5, $6, '0x19B861876D8075A11eC6c4596395b058fe8466C2', '1000000', NOW() + INTERVAL '5 minutes', 'payment-submitted', 'AWAITING_SIGNATURE_APPROVAL', '{}'::jsonb)`,
          [newId, invId, flowId, reqId, testPayerWallet, testSellerWallet]
        );

        const created = await client.query("SELECT * FROM payment_attempts WHERE id = $1", [newId]);
        return created.rows[0];
      });
    };

    const attempt1 = await requestPaymentDb(testInvoiceId);
    const attempt2 = await requestPaymentDb(testInvoiceId);
    const attempt3 = await requestPaymentDb(testInvoiceId);

    expect(attempt1.id).toBe(attempt2.id);
    expect(attempt2.id).toBe(attempt3.id);
    expect(attempt1.flow_id).toBe(attempt2.flow_id);
    expect(attempt1.payment_request_id).toBe(attempt2.payment_request_id);
  });

  it("partial unique index rejects insertion of a second simultaneously active attempt", async () => {
    // Attempt raw direct insert bypassing application lock to test database constraint
    const secondFlowId = `flow-violator-${Date.now()}`;
    const secondReqId = `pr-violator-${Date.now()}`;

    let errorThrown = false;
    try {
      await query(
        `INSERT INTO payment_attempts (
          id, invoice_id, flow_id, payment_request_id, merchant_name, attribution_verified,
          payer, payee, token_address, token_total_raw, quote_expires_at, hsp_status, state, approval_summary
        ) VALUES ($1, $2, $3, $4, 'HashX', true, $5, $6, '0x19B861876D8075A11eC6c4596395b058fe8466C2', '1000000', NOW() + INTERVAL '5 minutes', 'payment-submitted', 'AWAITING_SIGNATURE_APPROVAL', '{}'::jsonb)`,
        [`pay-violator-${Date.now()}`, testInvoiceId, secondFlowId, secondReqId, testPayerWallet, testSellerWallet]
      );
    } catch (err: any) {
      errorThrown = true;
      expect(err.code).toBe("23505"); // PostgreSQL unique_violation
      expect(err.constraint).toBe("idx_payment_attempts_active_invoice");
    }

    expect(errorThrown).toBe(true);
  });
});

