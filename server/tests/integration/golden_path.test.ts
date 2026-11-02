/**
 * End-to-end golden path through the REAL HTTP routes, PostgreSQL, and a REAL local EVM:
 * seller invoice → EIP-712 signature → verification → signed delivery → independent RPC
 * recomputation → buyer request → Stage 1 → Stage 2 → wallet ERC-20 transfer → reconciliation
 * → receipt → independent receipt verification.
 */
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import type { Hex } from "viem";
import { apiClient, attacker, buyer, createSubjectActivity, invoicePayload, login, pub, seller, signTypedJson, startApp, testClient, TOKEN_ABI, type Api } from "../setup/helpers";
import { authorizedAttempt, createSignedVerifiedInvoice, deliverHonestly, sendTokenTransfer } from "../setup/flows";
import { verifyReceiptDocument } from "../../src/cli/verify-receipt";
import { LOCAL_RPC_URL } from "../setup/dbUrl";
import { reconcileAttempt } from "../../src/services/payments";

let app: Awaited<ReturnType<typeof startApp>>;
let sellerApi: Api, buyerApi: Api, attackerApi: Api, anon: Api;
let range: { start: number; end: number };
const token = inject("localToken") as Hex;

beforeAll(async () => {
  app = await startApp();
  sellerApi = apiClient(app.baseUrl, await login(app.baseUrl, seller));
  buyerApi = apiClient(app.baseUrl, await login(app.baseUrl, buyer));
  attackerApi = apiClient(app.baseUrl, await login(app.baseUrl, attacker));
  anon = apiClient(app.baseUrl);
  range = await createSubjectActivity();
});
afterAll(async () => app.close());

describe("golden path", () => {
  let invoiceId = "";
  let attempt: any;
  let txHash: Hex;

  it("seller creates an invoice idempotently; a reused key with a different body conflicts", async () => {
    const payload = invoicePayload({}, range);
    const a = await sellerApi.post("/invoices", payload);
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    expect(a.body.id).toMatch(/^inv_[0-9a-f]{32}$/);
    expect(a.body.nonce).toMatch(/^0x[0-9a-f]{64}$/);
    expect(a.body.status).toBe("DRAFT");
    const replay = await sellerApi.post("/invoices", payload);
    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(a.body.id);
    expect(replay.body.idempotentReplay).toBe(true);
    const conflict = await sellerApi.post("/invoices", { ...payload, payment: { ...payload.payment, amount_raw: "999" } });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    invoiceId = a.body.id;
  });

  it("unsigned invoice verifies as PENDING (never PASS); outsiders cannot see it", async () => {
    const v = await sellerApi.post(`/invoices/${invoiceId}/verify`);
    expect(v.body.decision).toBe("PENDING");
    expect(v.body.reasonCodes).toContain("SIGNATURE_MISSING");
    expect((await attackerApi.get(`/invoices/${invoiceId}`)).status).toBe(404);
    expect((await anon.get(`/invoices/${invoiceId}`)).status).toBe(401);
  });

  it("rejects forged and buyer signatures; accepts the seller's EIP-712 signature", async () => {
    const td = (await sellerApi.get(`/invoices/${invoiceId}/typed-data`)).body.typedData;
    const forged = await signTypedJson(attacker, td);
    expect((await sellerApi.post(`/invoices/${invoiceId}/sign`, { signature: forged })).status).toBe(403);
    // Buyer is a participant but not the seller.
    const buyerSig = await signTypedJson(buyer, td);
    expect((await buyerApi.post(`/invoices/${invoiceId}/sign`, { signature: buyerSig })).body.code).toBe("SELLER_ONLY");
    // A signature over mutated terms (amount changed) does not recover to the seller for the stored terms.
    const mutated = await signTypedJson(seller, { ...td, message: { ...td.message, amount: "1" } });
    expect((await sellerApi.post(`/invoices/${invoiceId}/sign`, { signature: mutated })).status).toBe(403);
    const good = await signTypedJson(seller, td);
    const signed = await sellerApi.post(`/invoices/${invoiceId}/sign`, { signature: good });
    expect(signed.status).toBe(200);
    expect(signed.body.status).toBe("SIGNED");
    const v = await buyerApi.post(`/invoices/${invoiceId}/verify`);
    expect(v.body.decision).toBe("PASS");
    expect(v.body.payable).toBe(true);
  });

  it("tampered delivery bytes are rejected; honest delivery passes independent RPC recomputation", async () => {
    // Buyer cannot submit a delivery for the seller.
    const prepAsBuyer = await buyerApi.post(`/invoices/${invoiceId}/delivery/prepare`, { artifact_uri: "x", artifact_content: {} });
    expect(prepAsBuyer.body.code).toBe("SELLER_ONLY");

    const tampered = await deliverHonestly(sellerApi, invoiceId, range, (a) => ({ ...a, transaction_count: a.transaction_count + 5 }));
    expect(tampered.decision).toBe("FAIL");
    expect(tampered.reasonCodes).toContain("ARTIFACT_TAMPERED");

    const honest = await deliverHonestly(sellerApi, invoiceId, range);
    expect(honest.decision, JSON.stringify(honest.checkDetails)).toBe("PASS");
    expect(honest.evidenceSources.some((s: any) => s.type === "rpc" && s.blocksScanned === range.end - range.start + 1)).toBe(true);
    const summary = await buyerApi.get(`/invoices/${invoiceId}/verification`);
    expect(summary.body.isEligibleForPayment).toBe(true);
  });

  it("only the buyer can request payment, and concurrent duplicates yield exactly one attempt", async () => {
    expect((await sellerApi.post(`/invoices/${invoiceId}/payments`)).body.code).toBe("BUYER_ONLY");
    expect((await attackerApi.post(`/invoices/${invoiceId}/payments`)).status).toBe(404);
    const results = await Promise.all(Array.from({ length: 6 }, () => buyerApi.post(`/invoices/${invoiceId}/payments`)));
    const ids = new Set(results.map((r) => r.body.id));
    expect(ids.size).toBe(1);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    attempt = results[0].body;
    expect(attempt.state).toBe("AWAITING_SIGNATURE_APPROVAL");
    expect(attempt.authorizationTypedData.message.payer).toBe(buyer.address);
    expect(attempt.authorizationTypedData.message.payee).toBe(seller.address);
    expect(attempt.authorizationTypedData.message.token.toLowerCase()).toBe(token.toLowerCase());
    expect(attempt.authorizationTypedData.message.amount).toBe("2500000");
    expect(attempt.authorizationTypedData.message.chainId).toBe("31337");
  });

  it("enforces two-stage human authorization in sequence, bound to the exact obligation", async () => {
    const td = attempt.authorizationTypedData;
    const buyerSig = await signTypedJson(buyer, td);
    // Out of sequence: Stage 2 before Stage 1.
    expect((await buyerApi.post(`/payments/${attempt.id}/authorize`, { signature: buyerSig })).body.code).toBe("OUT_OF_SEQUENCE");
    // Seller (payee) cannot approve on the buyer's behalf.
    expect((await sellerApi.post(`/payments/${attempt.id}/approve-terms`, { authorization_digest: attempt.authorization.digest })).body.code).toBe("PAYER_ONLY");
    // Wrong digest (terms the human did not see) is rejected.
    const wrong = await buyerApi.post(`/payments/${attempt.id}/approve-terms`, { authorization_digest: `0x${"11".repeat(32)}` });
    expect(wrong.body.code).toBe("TERMS_MISMATCH");
    expect((await buyerApi.post(`/payments/${attempt.id}/approve-terms`, {})).status).toBe(400);
    const s1 = await buyerApi.post(`/payments/${attempt.id}/approve-terms`, { authorization_digest: attempt.authorization.digest });
    expect(s1.body.state).toBe("AWAITING_SUBMISSION_APPROVAL");
    // Stage 1 cannot be replayed.
    expect((await buyerApi.post(`/payments/${attempt.id}/approve-terms`, { authorization_digest: attempt.authorization.digest })).body.code).toBe("OUT_OF_SEQUENCE");
    // Stage 2 signed by someone else / over mutated terms is rejected.
    const attackerSig = await signTypedJson(attacker, td);
    expect((await buyerApi.post(`/payments/${attempt.id}/authorize`, { signature: attackerSig })).body.code).toBe("PAYER_SIGNATURE_MISMATCH");
    const mutatedSig = await signTypedJson(buyer, { ...td, message: { ...td.message, payee: attacker.address } });
    expect((await buyerApi.post(`/payments/${attempt.id}/authorize`, { signature: mutatedSig })).body.code).toBe("PAYER_SIGNATURE_MISMATCH");
    const s2 = await buyerApi.post(`/payments/${attempt.id}/authorize`, { signature: buyerSig });
    expect(s2.body.state).toBe("AUTHORIZED");
    expect(s2.body.transferInstructions.to.toLowerCase()).toBe(token.toLowerCase());
    expect(s2.body.transferInstructions.args).toEqual({ to: seller.address, amount: "2500000" });
    attempt = s2.body;
  });

  it("observes the real ERC-20 transfer and only settles after independent verification and confirmations", async () => {
    const before = (await pub.readContract({ address: token, abi: TOKEN_ABI, functionName: "balanceOf", args: [seller.address] })) as bigint;
    txHash = await sendTokenTransfer(token, seller.address, 2_500_000n);
    // Only the payer can report the transaction.
    expect((await sellerApi.post(`/payments/${attempt.id}/transaction`, { tx_hash: txHash })).body.code).toBe("PAYER_ONLY");
    const sub = await buyerApi.post(`/payments/${attempt.id}/transaction`, { tx_hash: txHash });
    expect(sub.body.state).toBe("SUBMITTED");
    expect((await buyerApi.post(`/payments/${attempt.id}/transaction`, { tx_hash: txHash })).body.idempotentReplay).toBe(true);
    expect((await buyerApi.get(`/invoices/${invoiceId}/receipt`)).status).toBe(404);

    const r1 = await buyerApi.post(`/payments/${attempt.id}/reconcile`);
    expect(r1.body.state).toBe("INCLUDED");
    expect(r1.body.confirmations).toBeLessThan(3);
    expect((await buyerApi.get(`/invoices/${invoiceId}/receipt`)).status).toBe(404); // included ≠ settled

    await testClient.mine({ blocks: 3 });
    const r2 = await buyerApi.post(`/payments/${attempt.id}/reconcile`);
    expect(r2.body.state).toMatch(/^(CONFIRMED|FINALIZED)$/);
    expect(r2.body.txHash).toBe(txHash.toLowerCase());
    expect(r2.body.confirmations).toBeGreaterThanOrEqual(3);
    const after = (await pub.readContract({ address: token, abi: TOKEN_ABI, functionName: "balanceOf", args: [seller.address] })) as bigint;
    expect(after - before).toBe(2_500_000n);
    expect((await sellerApi.get(`/invoices/${invoiceId}`)).body.status).toBe("SETTLED");
  });

  it("issues a receipt that verifies independently against the chain", async () => {
    const receipt = await sellerApi.get(`/invoices/${invoiceId}/receipt`);
    expect(receipt.status).toBe(200);
    const doc = receipt.body.document;
    expect(doc.settlement.txHash).toBe(txHash.toLowerCase());
    expect(doc.settlement.isTestToken).toBe(true);
    const checks = await verifyReceiptDocument(doc, LOCAL_RPC_URL);
    const failed = checks.filter((c) => !c.ok);
    expect(failed, JSON.stringify(failed)).toHaveLength(0);
    // Tampering with any field breaks verification.
    const tampered = structuredClone(doc);
    tampered.settlement.amount = "1";
    expect((await verifyReceiptDocument(tampered, LOCAL_RPC_URL)).some((c) => !c.ok)).toBe(true);
    const exported = await buyerApi.get(`/receipts/${receipt.body.id}/export`);
    expect(exported.body.receiptDigest).toBe(receipt.body.receiptDigest);
  });

  it("a settled invoice can never get a second payment attempt", async () => {
    const again = await buyerApi.post(`/invoices/${invoiceId}/payments`);
    expect(again.body.id).toBe(attempt.id);
    expect(again.body.idempotentReplay).toBe(true);
  });

  it("state persists across an API restart", async () => {
    await app.close();
    app = await startApp();
    const api = apiClient(app.baseUrl, await login(app.baseUrl, buyer));
    const status = await api.get(`/invoices/${invoiceId}/payment-status`);
    expect(status.body.state).toMatch(/^(CONFIRMED|FINALIZED)$/);
    expect(status.body.txHash).toBe(txHash.toLowerCase());
    buyerApi = api;
    sellerApi = apiClient(app.baseUrl, await login(app.baseUrl, seller));
  });

  it("a transaction hash already reconciled cannot satisfy another obligation", async () => {
    const id2 = await createSignedVerifiedInvoice(sellerApi, range);
    expect((await deliverHonestly(sellerApi, id2, range)).decision).toBe("PASS");
    const a2 = await authorizedAttempt(buyerApi, id2);
    const reuse = await buyerApi.post(`/payments/${a2.id}/transaction`, { tx_hash: txHash });
    expect(reuse.status).toBe(409);
    expect(reuse.body.code).toBe("TX_ALREADY_BOUND");
    // Clean up: still reconcilable via the background path with no tx bound.
    expect((await reconcileAttempt(a2.id)).state).toBe("AUTHORIZED");
  });
});
