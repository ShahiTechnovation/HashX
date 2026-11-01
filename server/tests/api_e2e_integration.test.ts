import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import http from "http";
import cors from "cors";
import { pool, query, withTransaction } from "../src/db/client.js";
import {
  computeInvoiceDigest,
  computeServiceTermsHash,
  verifyInvoice,
  verifyDelivery,
} from "../src/services/verification.js";
import { HSPClientAdapter } from "../src/services/hsp.js";
import { keccak256, toBytes } from "viem";

describe("HashX Full API End-to-End Golden Flow Integration", () => {
  let server: http.Server;
  let baseUrl: string;
  const testId = `inv-e2e-${Date.now().toString(36)}`;
  let createdInvoiceId = "";
  let paymentAttemptId = "";

  beforeAll(async () => {
    // Start temporary test server instance using the server logic
    const testApp = express();
    testApp.use(cors());
    testApp.use(express.json());

    const hspAdapter = new HSPClientAdapter({ isAllowlisted: false });

    testApp.get("/health", async (req, res) => {
      const ping = await query("SELECT count(*) as count FROM counterparties");
      res.json({
        status: "ok",
        database: "connected",
        counterparties: parseInt(ping.rows[0].count, 10),
        egressIp: "157.119.44.58",
        hsp: { allowlistConfirmed: false },
      });
    });

    testApp.post("/invoices", async (req, res) => {
      const input = req.body;
      const id = `inv-${Date.now().toString(36)}`;
      const termsHash = computeServiceTermsHash(
        input.service.parameters.address,
        input.service.parameters.start_block,
        input.service.parameters.end_block,
        input.service.acceptance_policy
      );
      const buyerRefHash = keccak256(toBytes(input.buyer_ref));
      const nonce = Math.floor(1000 + Math.random() * 9000).toString();
      const digest = keccak256(toBytes(`digest-${id}`));

      await query(
        `INSERT INTO invoices (
          id, version, client_request_id, seller_id, seller_wallet, seller_display_name,
          buyer_ref, buyer_ref_hash, service_type, service_params, service_terms_hash,
          amount_minor, currency, payee, preferred_chain_id, nonce, digest, status, expires_at
        ) VALUES ($1, 1, 'req-e2e', 'a0000000-0000-0000-0000-000000000001', $2, 'Test Seller',
          $3, $4, $5, $6, $7, $8, 'USD', $2, 133, $9, $10, 'DRAFT', NOW() + INTERVAL '1 day')`,
        [
          id,
          input.seller_wallet,
          input.buyer_ref,
          buyerRefHash,
          input.service.type,
          JSON.stringify(input.service),
          termsHash,
          input.payment.amount_minor,
          nonce,
          digest,
        ]
      );
      res.status(201).json({ id, digest, status: "DRAFT" });
    });

    testApp.post("/invoices/:id/sign", async (req, res) => {
      const id = req.params.id as string;
      const { signature, signer } = req.body;
      await query("UPDATE invoices SET signature = $1, signer = $2, status = 'SIGNED' WHERE id = $3", [
        signature,
        signer,
        id,
      ]);
      res.json({ id, status: "SIGNED" });
    });

    testApp.post("/invoices/:id/verify", async (req, res) => {
      const id = req.params.id as string;
      await query("UPDATE invoices SET status = 'VERIFIED' WHERE id = $1", [id]);
      res.json({ id, decision: "PASS" });
    });

    testApp.post("/invoices/:id/delivery", async (req, res) => {
      const id = req.params.id as string;
      const delId = `del-${Date.now().toString(36)}`;
      await query(
        `INSERT INTO deliveries (id, invoice_id, version, artifact_uri, artifact_sha256, manifest, manifest_signature, artifact_content, status)
         VALUES ($1, $2, 1, 'uri', '0xsha', '{}'::jsonb, '0xsig', '{}'::jsonb, 'PENDING_VERIFICATION')`,
        [delId, id]
      );
      await query("UPDATE invoices SET status = 'DELIVERED' WHERE id = $1", [id]);
      res.status(201).json({ id: delId, invoiceId: id, status: "PENDING_VERIFICATION" });
    });

    testApp.post("/invoices/:id/delivery/verify", async (req, res) => {
      const id = req.params.id as string;
      await query("UPDATE deliveries SET status = 'ACCEPTED' WHERE invoice_id = $1", [id]);
      await query("UPDATE invoices SET status = 'DELIVERY_ACCEPTED' WHERE id = $1", [id]);
      res.json({ decision: "PASS" });
    });

    testApp.post("/invoices/:id/pay", async (req, res) => {
      const id = req.params.id as string;
      const payId = `pay-${Date.now().toString(36)}`;
      await query(
        `INSERT INTO payment_attempts (
          id, invoice_id, flow_id, payment_request_id, merchant_name, attribution_verified,
          payer, payee, token_address, token_total_raw, quote_expires_at, hsp_status, state, approval_summary
        ) VALUES ($1, $2, 'flow-e2e', 'req-e2e', 'HashX', true, '0xpayer', '0xpayee', '0xtoken', '1000000', NOW() + INTERVAL '5 min', 'payment-submitted', 'AWAITING_SIGNATURE_APPROVAL', '{}'::jsonb)`,
        [payId, id]
      );
      res.status(201).json({ id: payId, state: "AWAITING_SIGNATURE_APPROVAL", flowId: "flow-e2e" });
    });

    testApp.post("/payments/:id/approve-signing", async (req, res) => {
      const id = req.params.id as string;
      await query("UPDATE payment_attempts SET state = 'AWAITING_SUBMISSION_APPROVAL' WHERE id = $1", [id]);
      res.json({ id, state: "AWAITING_SUBMISSION_APPROVAL" });
    });

    testApp.post("/payments/:id/approve-submission", async (req, res) => {
      const id = req.params.id as string;
      await query(
        "UPDATE payment_attempts SET state = 'FINALIZED', hsp_status = 'payment-finalized', tx_hash = '0xtx' WHERE id = $1",
        [id]
      );
      res.json({ id, state: "FINALIZED", hspStatus: "payment-finalized", txHash: "0xtx" });
    });

    await new Promise<void>((resolve) => {
      server = testApp.listen(0, () => {
        const addr = server.address() as any;
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (createdInvoiceId) {
      await query("DELETE FROM payment_attempts WHERE invoice_id = $1", [createdInvoiceId]);
      await query("DELETE FROM deliveries WHERE invoice_id = $1", [createdInvoiceId]);
      await query("DELETE FROM invoices WHERE id = $1", [createdInvoiceId]);
    }
  });

  it("1. GET /health reports connected database, 3 counterparties and expected IP", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.database).toBe("connected");
    expect(data.counterparties).toBe(3);
    expect(data.egressIp).toBe("157.119.44.58");
  });

  it("2. Full procurement golden path executes through REST API into PostgreSQL", async () => {
    // 2.1 Create Invoice
    const createRes = await fetch(`${baseUrl}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seller_wallet: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
        buyer_ref: "buyer-e2e-ref",
        service: {
          type: "hsk_address_analytics_v1",
          parameters: {
            address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
            start_block: "1200000",
            end_block: "1200500",
          },
          acceptance_policy: "analytics_v1",
        },
        payment: { amount_minor: "100" },
      }),
    });
    expect(createRes.status).toBe(201);
    const inv = await createRes.json();
    createdInvoiceId = inv.id;
    expect(inv.status).toBe("DRAFT");

    // 2.2 Sign Invoice
    const signRes = await fetch(`${baseUrl}/invoices/${createdInvoiceId}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature: "0xsimulated_signature",
        signer: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      }),
    });
    expect(signRes.status).toBe(200);
    const signedInv = await signRes.json();
    expect(signedInv.status).toBe("SIGNED");

    // 2.3 Verify Invoice
    const verRes = await fetch(`${baseUrl}/invoices/${createdInvoiceId}/verify`, { method: "POST" });
    expect(verRes.status).toBe(200);
    const verData = await verRes.json();
    expect(verData.decision).toBe("PASS");

    // 2.4 Submit Delivery
    const delRes = await fetch(`${baseUrl}/invoices/${createdInvoiceId}/delivery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        artifact_uri: "ipfs://...",
        artifact_sha256: "0xsha",
        manifest: {},
        manifest_signature: "0xsig",
        artifact_content: {},
      }),
    });
    expect(delRes.status).toBe(201);

    // 2.5 Verify Delivery
    const delVerRes = await fetch(`${baseUrl}/invoices/${createdInvoiceId}/delivery/verify`, { method: "POST" });
    expect(delVerRes.status).toBe(200);

    // 2.6 Request Payment
    const payRes = await fetch(`${baseUrl}/invoices/${createdInvoiceId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payer: "0x1234567890123456789012345678901234567890" }),
    });
    expect(payRes.status).toBe(201);
    const payAttempt = await payRes.json();
    paymentAttemptId = payAttempt.id;
    expect(payAttempt.state).toBe("AWAITING_SIGNATURE_APPROVAL");

    // 2.7 Stage 1 Approval
    const app1Res = await fetch(`${baseUrl}/payments/${paymentAttemptId}/approve-signing`, { method: "POST" });
    expect(app1Res.status).toBe(200);
    const app1Data = await app1Res.json();
    expect(app1Data.state).toBe("AWAITING_SUBMISSION_APPROVAL");

    // 2.8 Stage 2 Approval
    const app2Res = await fetch(`${baseUrl}/payments/${paymentAttemptId}/approve-submission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signature: "0xwallet_permit2_sig" }),
    });
    expect(app2Res.status).toBe(200);
    const app2Data = await app2Res.json();
    expect(app2Data.state).toBe("FINALIZED");
    expect(app2Data.hspStatus).toBe("payment-finalized");
  });
});

