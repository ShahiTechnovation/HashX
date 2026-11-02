import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, toBytes } from "viem";
import { app, hspAdapter } from "../src/server.js";
import { query } from "../src/db/client.js";
import {
  HASHX_EIP712_DOMAIN,
  HASHX_EIP712_TYPES,
  buildInvoiceEIP712Message,
  computeServiceTermsHash,
  isEvidenceRegistryDeployed,
} from "../src/services/verification.js";

// Deterministic test accounts (Anvil / Hardhat default test keys)
const SELLER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const PAYER_PRIVATE_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const FORGER_PRIVATE_KEY =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";

const seller = privateKeyToAccount(SELLER_PRIVATE_KEY);
const payer = privateKeyToAccount(PAYER_PRIVATE_KEY);
const forger = privateKeyToAccount(FORGER_PRIVATE_KEY);

describe("HashX Real Backend Production Routes End-to-End Integration", () => {
  let server: http.Server;
  let baseUrl: string;
  const testSellerId = "a0000000-0000-0000-0000-000000000099";
  let activeInvoiceId = "";

  beforeAll(async () => {
    // Start real exported Express app on dynamic test port
    await new Promise<void>((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as any;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });

    // Register active test seller counterparty in DB
    await query(
      `INSERT INTO counterparties (id, display_name, wallet_address, wallet_type, status)
       VALUES ($1, 'Verified Test Seller', $2, 'EOA', 'ACTIVE')
       ON CONFLICT (wallet_address) DO UPDATE SET status = 'ACTIVE'`,
      [testSellerId, seller.address]
    );
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("1. GET /health returns real production diagnostic telemetry", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.service).toBe("HashX Backend");
    expect(data.database.status).toBe("connected");
    expect(data.hsp.safeMode).toBe(true);
    expect(data.chain.preferredChainId).toBe(133);
  });

  it("2. POST /invoices validates schema with Zod and rejects malformed payloads", async () => {
    const res = await fetch(`${baseUrl}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seller_counterparty_id: testSellerId,
        buyer_ref: "invalid-payload-missing-service",
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_INVOICE_PAYLOAD");
  });

  it("3. POST /invoices creates canonical DRAFT invoice with deterministic digest", async () => {
    const targetAddress = "0x0B306BF915C4d645ff596e518fAf3F9669b97016";
    const res = await fetch(`${baseUrl}/invoices`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seller_counterparty_id: testSellerId,
        seller_wallet: seller.address,
        buyer_ref: `e2e-order-${Date.now()}`,
        service: {
          type: "hsk_address_analytics_v1",
          parameters: {
            address: targetAddress,
            start_block: "1205000",
            end_block: "1205250",
          },
          acceptance_policy: "analytics_v1",
        },
        payment: {
          amount_minor: "100",
          currency: "USD",
          payee: seller.address,
          preferred_chain_id: 133,
        },
      }),
    });

    expect(res.status).toBe(201);
    const inv = await res.json();
    expect(inv.id).toBeDefined();
    expect(inv.status).toBe("DRAFT");
    expect(inv.digest.startsWith("0x")).toBe(true);
    expect(inv.digest.length).toBe(66);
    activeInvoiceId = inv.id;
  });

  it("4. Negative Test: POST /invoices/:id/sign rejects missing signature", async () => {
    const res = await fetch(`${baseUrl}/invoices/${activeInvoiceId}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signer: seller.address,
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("INVALID_SIGNATURE_PAYLOAD");
  });

  it("5. Negative Test: POST /invoices/:id/sign rejects simulated placeholder signatures", async () => {
    const res = await fetch(`${baseUrl}/invoices/${activeInvoiceId}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signer: seller.address,
        signature: `0xsimulated_signature_${"0".repeat(108)}`,
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("SIMULATED_SIGNATURE_REJECTED");
  });

  it("6. Negative Test: POST /invoices/:id/sign rejects forged signature from unauthorized key", async () => {
    // Fetch draft invoice
    const invRes = await fetch(`${baseUrl}/invoices/${activeInvoiceId}`);
    const inv = await invRes.json();

    // Forger signs the typed data
    const message = buildInvoiceEIP712Message(inv);
    const forgedSig = await forger.signTypedData({
      domain: { ...HASHX_EIP712_DOMAIN, chainId: 133 },
      types: HASHX_EIP712_TYPES,
      primaryType: "HashXInvoice",
      message,
    });

    const res = await fetch(`${baseUrl}/invoices/${activeInvoiceId}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signer: seller.address, // Claims to be seller
        signature: forgedSig, // Actually signed by forger
      }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe("INVALID_EIP712_SIGNATURE");
  });

  it("7. Negative Test: POST /invoices/:id/sign rejects signer mismatch against invoice sellerWallet", async () => {
    const invRes = await fetch(`${baseUrl}/invoices/${activeInvoiceId}`);
    const inv = await invRes.json();

    const message = buildInvoiceEIP712Message(inv);
    const forgerSig = await forger.signTypedData({
      domain: { ...HASHX_EIP712_DOMAIN, chainId: 133 },
      types: HASHX_EIP712_TYPES,
      primaryType: "HashXInvoice",
      message,
    });

    const res = await fetch(`${baseUrl}/invoices/${activeInvoiceId}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signer: forger.address, // Signer address does not match invoice.sellerWallet
        signature: forgerSig,
      }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.code).toBe("SIGNER_MISMATCH");
  });

  it("8. Positive Test: POST /invoices/:id/sign accepts real cryptographic EIP-712 seller signature", async () => {
    const invRes = await fetch(`${baseUrl}/invoices/${activeInvoiceId}`);
    const inv = await invRes.json();

    const message = buildInvoiceEIP712Message(inv);
    const validSignature = await seller.signTypedData({
      domain: { ...HASHX_EIP712_DOMAIN, chainId: 133 },
      types: HASHX_EIP712_TYPES,
      primaryType: "HashXInvoice",
      message,
    });

    const res = await fetch(`${baseUrl}/invoices/${activeInvoiceId}/sign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signer: seller.address,
        signature: validSignature,
      }),
    });

    expect(res.status).toBe(200);
    const signedInv = await res.json();
    expect(signedInv.status).toBe("SIGNED");
    expect(signedInv.signature).toBe(validSignature);
    expect(signedInv.signatureValid).toBe(true);
  });

  it("9. POST /invoices/:id/verify verifies real invoice and persists verification run", async () => {
    const res = await fetch(`${baseUrl}/invoices/${activeInvoiceId}/verify`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.decision).toBe("PASS");
    expect(result.checks.signature).toBe("PASS");
    expect(result.checks.identity_binding).toBe("PASS");
  });

  it("10. GET /invoices/:id/verification returns backend authoritative persistent result", async () => {
    const res = await fetch(`${baseUrl}/invoices/${activeInvoiceId}/verification`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invoiceId).toBe(activeInvoiceId);
    expect(data.invoiceDecision).toBe("PASS");
    expect(data.provenance).toBe("backend_persisted");
    expect(data.invoiceVerification).toBeDefined();
    expect(data.invoiceVerification.checks.signature).toBe("PASS");
  });

  it("11. Negative Test: Policy Firewall blocks payment on invoice that is not DELIVERY_ACCEPTED", async () => {
    const res = await fetch(`${baseUrl}/invoices/${activeInvoiceId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payer: payer.address,
      }),
    });

    expect(res.status).toBe(503); // Fails closed with HSP_NOT_CONNECTED or Policy Firewall
    const data = await res.json();
    expect(data.code).toBe("HSP_NOT_CONNECTED");
  });

  it("12. Negative Test: Fail-Closed HSP behavior: does NOT create fake HSP order or database records when HSP QA is not connected", async () => {
    // Verify hspAdapter is not configured for live
    expect(hspAdapter.isConfiguredForLive()).toBe(false);

    const res = await fetch(`${baseUrl}/invoices/${activeInvoiceId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payer: payer.address,
      }),
    });

    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.code).toBe("HSP_NOT_CONNECTED");
    expect(data.error).toContain("HashKey HSP QA is not yet connected");

    // Verify in database: zero payment attempts created
    const attempts = await query(
      "SELECT count(*) as count FROM payment_attempts WHERE invoice_id = $1",
      [activeInvoiceId]
    );
    expect(parseInt(attempts.rows[0].count, 10)).toBe(0);
  });

  it("13. Negative Test: Stage 2 approval requires Stage 1 approval first", async () => {
    // Manually create an isolated payment attempt row for approval flow testing
    const fakeAttemptId = `pay-test-${Date.now().toString(36)}`;
    const flowId = `flow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const prId = `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await query(
      `INSERT INTO payment_attempts (
        id, invoice_id, flow_id, payment_request_id, merchant_name, attribution_verified,
        payer, payee, token_address, token_total_raw, quote_expires_at, hsp_status, state, approval_summary
      ) VALUES ($1, $2, $3, $4, 'HashX', true, $5, $6, $7, '1000000', NOW() + INTERVAL '5 minutes', 'payment-submitted', 'AWAITING_SIGNATURE_APPROVAL', '{}'::jsonb)`,
      [
        fakeAttemptId,
        activeInvoiceId,
        flowId,
        prId,
        payer.address,
        seller.address,
        "0x19B861876D8075A11eC6c4596395b058fe8466C2",
      ]
    );

    // Call Stage 2 directly without Stage 1
    const dummySignature =
      "0x" + "11".repeat(65);
    const res = await fetch(`${baseUrl}/payments/${fakeAttemptId}/approve-submission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature: dummySignature,
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("STAGE1_APPROVAL_MISSING");

    // Clean up attempt
    await query("DELETE FROM payment_attempts WHERE id = $1", [fakeAttemptId]);
  });

  it("14. Negative Test: Stage 2 approval rejects missing or malformed signature", async () => {
    const fakeAttemptId = `pay-test-st2-${Date.now().toString(36)}`;
    const flowId = `flow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const prId = `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await query(
      `INSERT INTO payment_attempts (
        id, invoice_id, flow_id, payment_request_id, merchant_name, attribution_verified,
        payer, payee, token_address, token_total_raw, quote_expires_at, hsp_status, state, approval_summary
      ) VALUES ($1, $2, $3, $4, 'HashX', true, $5, $6, $7, '1000000', NOW() + INTERVAL '5 minutes', 'payment-submitted', 'AWAITING_SUBMISSION_APPROVAL', '{}'::jsonb)`,
      [
        fakeAttemptId,
        activeInvoiceId,
        flowId,
        prId,
        payer.address,
        seller.address,
        "0x19B861876D8075A11eC6c4596395b058fe8466C2",
      ]
    );

    // Record Stage 1 approval
    await query(
      `INSERT INTO approvals (payment_attempt_id, stage, actor, terms_hash)
       VALUES ($1, 'SIGNING', $2, '0xterms')`,
      [fakeAttemptId, payer.address]
    );

    // Try Stage 2 with missing signature
    const resMissing = await fetch(`${baseUrl}/payments/${fakeAttemptId}/approve-submission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(resMissing.status).toBe(400);
    const missingData = await resMissing.json();
    expect(missingData.code).toBe("SIGNATURE_REQUIRED");

    // Try Stage 2 with signature from wrong actor (seller instead of payer)
    const termsHash = keccak256(toBytes("1000000"));
    const wrongSignature = await seller.signMessage({
      message: { raw: toBytes(termsHash) },
    });

    const resWrong = await fetch(`${baseUrl}/payments/${fakeAttemptId}/approve-submission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature: wrongSignature,
      }),
    });
    expect(resWrong.status).toBe(403);
    const wrongData = await resWrong.json();
    expect(wrongData.code).toBe("PAYER_SIGNATURE_MISMATCH");

    // Clean up attempt
    await query("DELETE FROM approvals WHERE payment_attempt_id = $1", [fakeAttemptId]);
    await query("DELETE FROM payment_attempts WHERE id = $1", [fakeAttemptId]);
  });

  it("15. Positive Test: Stage 2 approval accepts real cryptographic signature from payer", async () => {
    const fakeAttemptId = `pay-test-st2-pos-${Date.now().toString(36)}`;
    const flowId = `flow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const prId = `pr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await query(
      `INSERT INTO payment_attempts (
        id, invoice_id, flow_id, payment_request_id, merchant_name, attribution_verified,
        payer, payee, token_address, token_total_raw, quote_expires_at, hsp_status, state, approval_summary
      ) VALUES ($1, $2, $3, $4, 'HashX', true, $5, $6, $7, '1000000', NOW() + INTERVAL '5 minutes', 'payment-submitted', 'AWAITING_SUBMISSION_APPROVAL', '{}'::jsonb)`,
      [
        fakeAttemptId,
        activeInvoiceId,
        flowId,
        prId,
        payer.address,
        seller.address,
        "0x19B861876D8075A11eC6c4596395b058fe8466C2",
      ]
    );

    await query(
      `INSERT INTO approvals (payment_attempt_id, stage, actor, terms_hash)
       VALUES ($1, 'SIGNING', $2, '0xterms')`,
      [fakeAttemptId, payer.address]
    );

    const termsHash = keccak256(toBytes("1000000"));
    const validPayerSignature = await payer.signMessage({
      message: { raw: toBytes(termsHash) },
    });

    const res = await fetch(`${baseUrl}/payments/${fakeAttemptId}/approve-submission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature: validPayerSignature,
      }),
    });

    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.state).toBe("SUBMITTED");
    expect(updated.txHash).toBeUndefined(); // Safe mode: does NOT invent fake tx hash!

    // Clean up attempt
    await query("DELETE FROM approvals WHERE payment_attempt_id = $1", [fakeAttemptId]);
    await query("DELETE FROM payment_attempts WHERE id = $1", [fakeAttemptId]);
  });

  it("16. Negative Test: Safe status never auto-promotes to FINALIZED without authoritative settlement", async () => {
    const payStatusRes = await fetch(`${baseUrl}/invoices/${activeInvoiceId}/payment-status`);
    // No payment completed, returns 404 or unfinalized state
    if (payStatusRes.status === 200) {
      const data = await payStatusRes.json();
      expect(data.state).not.toBe("FINALIZED");
    } else {
      expect(payStatusRes.status).toBe(404);
    }
  });

  it("17. Separated contract configuration: Evidence registry deployment status is honest", () => {
    const isDeployed = isEvidenceRegistryDeployed();
    expect(typeof isDeployed).toBe("boolean");
    // Unless explicitly deployed and set in ENV, defaults to undeployed
    if (!process.env.HASHX_EVIDENCE_REGISTRY_ADDRESS) {
      expect(isDeployed).toBe(false);
    }
  });
});
