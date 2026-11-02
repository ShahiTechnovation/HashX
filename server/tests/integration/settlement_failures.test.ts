/**
 * Settlement failure modes on a real local EVM. None of these may ever produce a receipt.
 */
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { encodeFunctionData, type Hex } from "viem";
import { apiClient, attacker, buyer, createSubjectActivity, login, seller, startApp, testClient, walletFor, pub, TOKEN_ABI, type Api } from "../setup/helpers";
import { authorizedAttempt, payableInvoice, sendTokenTransfer } from "../setup/flows";
import { query } from "../../src/db/client";
import { reconcileAttempt } from "../../src/services/payments";
import { resetChainReaders, setChainReader, ViemChainReader } from "../../src/chain/readers";

let app: Awaited<ReturnType<typeof startApp>>;
let sellerApi: Api, buyerApi: Api;
let range: { start: number; end: number };
const token = inject("localToken") as Hex;

beforeAll(async () => {
  app = await startApp();
  sellerApi = apiClient(app.baseUrl, await login(app.baseUrl, seller));
  buyerApi = apiClient(app.baseUrl, await login(app.baseUrl, buyer));
  range = await createSubjectActivity();
});
afterAll(async () => {
  resetChainReaders();
  await app.close();
});

async function freshAuthorized() {
  const invoiceId = await payableInvoice(sellerApi, range);
  const attempt = await authorizedAttempt(buyerApi, invoiceId);
  return { invoiceId, attempt };
}

async function expectNoReceipt(invoiceId: string) {
  expect((await buyerApi.get(`/invoices/${invoiceId}/receipt`)).status).toBe(404);
  expect((await buyerApi.get(`/invoices/${invoiceId}`)).body.status).not.toBe("SETTLED");
}

describe("settlement verification failures", () => {
  it("wrong amount → FAILED (TRANSFER_MISMATCH)", async () => {
    const { invoiceId, attempt } = await freshAuthorized();
    const tx = await sendTokenTransfer(token, seller.address, 2_499_999n);
    await buyerApi.post(`/payments/${attempt.id}/transaction`, { tx_hash: tx });
    await testClient.mine({ blocks: 5 });
    const r = await buyerApi.post(`/payments/${attempt.id}/reconcile`);
    expect(r.body.state).toBe("FAILED");
    expect(r.body.failureCode).toBe("TRANSFER_MISMATCH");
    await expectNoReceipt(invoiceId);
  });

  it("wrong recipient → FAILED (TRANSFER_MISMATCH)", async () => {
    const { invoiceId, attempt } = await freshAuthorized();
    const tx = await sendTokenTransfer(token, attacker.address, 2_500_000n);
    await buyerApi.post(`/payments/${attempt.id}/transaction`, { tx_hash: tx });
    await testClient.mine({ blocks: 5 });
    expect((await buyerApi.post(`/payments/${attempt.id}/reconcile`)).body.failureCode).toBe("TRANSFER_MISMATCH");
    await expectNoReceipt(invoiceId);
  });

  it("a transfer sent by someone other than the payer → FAILED", async () => {
    const { invoiceId, attempt } = await freshAuthorized();
    const tx = await sendTokenTransfer(token, seller.address, 2_500_000n, attacker);
    await buyerApi.post(`/payments/${attempt.id}/transaction`, { tx_hash: tx });
    await testClient.mine({ blocks: 5 });
    expect((await buyerApi.post(`/payments/${attempt.id}/reconcile`)).body.state).toBe("FAILED");
    await expectNoReceipt(invoiceId);
  });

  it("a reverted transaction → FAILED (REVERTED)", async () => {
    const { invoiceId, attempt } = await freshAuthorized();
    // Force a revert by transferring more than the buyer holds, with explicit gas to skip estimation.
    const hash = await walletFor(buyer).sendTransaction({
      to: token,
      data: encodeFunctionData({ abi: TOKEN_ABI, functionName: "transfer", args: [seller.address, 10n ** 30n] }),
      gas: 100_000n,
    });
    await pub.waitForTransactionReceipt({ hash });
    await buyerApi.post(`/payments/${attempt.id}/transaction`, { tx_hash: hash });
    const r = await buyerApi.post(`/payments/${attempt.id}/reconcile`);
    expect(r.body.state).toBe("FAILED");
    expect(r.body.failureCode).toBe("REVERTED");
    await expectNoReceipt(invoiceId);
  });

  it("an unknown/dropped transaction stays SUBMITTED, then becomes DROPPED after the timeout", async () => {
    const { invoiceId, attempt } = await freshAuthorized();
    const fake = `0x${"ab".repeat(32)}`;
    await buyerApi.post(`/payments/${attempt.id}/transaction`, { tx_hash: fake });
    expect((await buyerApi.post(`/payments/${attempt.id}/reconcile`)).body.state).toBe("SUBMITTED");
    await query(`UPDATE payment_attempts SET submitted_at = NOW() - INTERVAL '2 hours' WHERE id = $1`, [attempt.id]);
    const r = await buyerApi.post(`/payments/${attempt.id}/reconcile`);
    expect(r.body.state).toBe("DROPPED");
    await expectNoReceipt(invoiceId);
    // A dropped attempt frees the invoice for a fresh, newly authorized attempt.
    const next = await buyerApi.post(`/invoices/${invoiceId}/payments`);
    expect(next.status).toBe(201);
    expect(next.body.id).not.toBe(attempt.id);
  });

  it("RPC outage during reconciliation never advances state", async () => {
    const { invoiceId, attempt } = await freshAuthorized();
    const tx = await sendTokenTransfer(token, seller.address, 2_500_000n);
    await buyerApi.post(`/payments/${attempt.id}/transaction`, { tx_hash: tx });
    setChainReader(31337, new ViemChainReader(31337, "http://127.0.0.1:9", 500));
    const r = await reconcileAttempt(attempt.id);
    expect(r.state).toBe("SUBMITTED");
    expect(r.failure_detail).toMatch(/Reconciliation deferred/);
    setChainReader(31337, null);
    await testClient.mine({ blocks: 5 });
    expect((await reconcileAttempt(attempt.id)).state).toMatch(/^(CONFIRMED|FINALIZED)$/);
    expect((await buyerApi.get(`/invoices/${invoiceId}/receipt`)).status).toBe(200);
  });

  it("a chain reorganization rolls an INCLUDED transfer back, then re-verifies it in its new block", async () => {
    const { invoiceId, attempt } = await freshAuthorized();
    const snapshot = await testClient.snapshot();
    const tx = await sendTokenTransfer(token, seller.address, 2_500_000n);
    await buyerApi.post(`/payments/${attempt.id}/transaction`, { tx_hash: tx });
    const included = await reconcileAttempt(attempt.id);
    expect(included.state).toBe("INCLUDED");
    const originalBlockHash = included.block_hash;
    // Reorg: the block containing the transfer disappears from the canonical chain.
    await testClient.revert({ id: snapshot });
    const rolledBack = await reconcileAttempt(attempt.id);
    expect(rolledBack.state).toBe("SUBMITTED");
    expect(rolledBack.block_hash).toBeNull();
    await expectNoReceipt(invoiceId);
    // The node may re-include the transaction; if so it must be re-verified in a different block.
    await testClient.mine({ blocks: 1 });
    const after = await reconcileAttempt(attempt.id);
    if (after.state === "INCLUDED") expect(after.block_hash).not.toBe(originalBlockHash);
    else expect(after.state).toBe("SUBMITTED");
    await expectNoReceipt(invoiceId);
  });

  it("agents and unauthenticated callers can never approve or execute payments", async () => {
    const invoiceId = await payableInvoice(sellerApi, range);
    const req = await buyerApi.post(`/invoices/${invoiceId}/payments`);
    const cred = await buyerApi.post("/agent-credentials", { label: "buyer bot", scopes: ["payments:request", "payments:read", "invoices:read"] });
    const agent = apiClient(app.baseUrl, cred.body.secret);
    const anon = apiClient(app.baseUrl);
    const digest = req.body.authorization.digest;
    for (const path of [`/payments/${req.body.id}/approve-terms`, `/payments/${req.body.id}/approve-signing`]) {
      expect((await agent.post(path, { authorization_digest: digest })).body.code).toBe("HUMAN_SESSION_REQUIRED");
      expect((await anon.post(path, { authorization_digest: digest })).status).toBe(401);
    }
    expect((await agent.post(`/payments/${req.body.id}/authorize`, { signature: `0x${"00".repeat(65)}` })).body.code).toBe("HUMAN_SESSION_REQUIRED");
    expect((await agent.post(`/payments/${req.body.id}/transaction`, { tx_hash: `0x${"00".repeat(32)}` })).body.code).toBe("HUMAN_SESSION_REQUIRED");
    // The agent CAN read status within scope.
    expect((await agent.get(`/invoices/${invoiceId}/payment-status`)).body.state).toBe("AWAITING_SIGNATURE_APPROVAL");
  });

  it("an expired authorization cannot be approved and frees the invoice for a new attempt", async () => {
    const invoiceId = await payableInvoice(sellerApi, range);
    const req = await buyerApi.post(`/invoices/${invoiceId}/payments`);
    await query(`UPDATE payment_attempts SET authorization_expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, [req.body.id]);
    const s1 = await buyerApi.post(`/payments/${req.body.id}/approve-terms`, { authorization_digest: req.body.authorization.digest });
    expect(s1.body.code).toBe("AUTHORIZATION_EXPIRED");
    const fresh = await buyerApi.post(`/invoices/${invoiceId}/payments`);
    expect(fresh.status).toBe(201);
    expect(fresh.body.id).not.toBe(req.body.id);
  });

  it("the database refuses two live attempts for one invoice even if application checks are bypassed", async () => {
    const invoiceId = await payableInvoice(sellerApi, range);
    const req = await buyerApi.post(`/invoices/${invoiceId}/payments`);
    await expect(
      query(
        `INSERT INTO payment_attempts (id, invoice_id, payer, payee, token_address, token_total_raw, approval_summary, state)
         SELECT 'pay_dup_' || substr(md5(random()::text), 1, 8), invoice_id, payer, payee, token_address, token_total_raw, '{}'::jsonb, 'AWAITING_SIGNATURE_APPROVAL'
         FROM payment_attempts WHERE id = $1`,
        [req.body.id]
      )
    ).rejects.toThrow(/uq_payment_attempts_live_invoice/);
  });
});
