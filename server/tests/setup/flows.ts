import { expect } from "vitest";
import type { Hex } from "viem";
import { buyer, computeArtifact, invoicePayload, seller, signTypedJson, subject, walletFor, pub, TOKEN_ABI, type Api } from "./helpers";

export async function createSignedVerifiedInvoice(sellerApi: Api, range: { start: number; end: number }, overrides: Record<string, any> = {}) {
  const created = await sellerApi.post("/invoices", invoicePayload(overrides, range));
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const sig = await signTypedJson(seller, created.body.typedData);
  const signed = await sellerApi.post(`/invoices/${created.body.id}/sign`, { signature: sig });
  expect(signed.status, JSON.stringify(signed.body)).toBe(200);
  const verified = await sellerApi.post(`/invoices/${created.body.id}/verify`);
  expect(verified.body.decision, JSON.stringify(verified.body)).toBe("PASS");
  return created.body.id as string;
}

export async function deliverHonestly(sellerApi: Api, invoiceId: string, range: { start: number; end: number }, artifactOverride?: (a: any) => any) {
  const artifact = await computeArtifact(subject.address, range.start, range.end);
  const prep = await sellerApi.post(`/invoices/${invoiceId}/delivery/prepare`, { artifact_uri: "ipfs://hashx-test/artifact.json", artifact_content: artifact });
  expect(prep.status, JSON.stringify(prep.body)).toBe(200);
  const manifestSig = await signTypedJson(seller, prep.body.typedData);
  const content = artifactOverride ? artifactOverride(structuredClone(artifact)) : artifact;
  const submitted = await sellerApi.post(`/invoices/${invoiceId}/delivery`, {
    artifact_uri: "ipfs://hashx-test/artifact.json",
    artifact_content: content,
    manifest: prep.body.manifest,
    manifest_signature: manifestSig,
  });
  expect(submitted.status, JSON.stringify(submitted.body)).toBe(201);
  return (await sellerApi.post(`/invoices/${invoiceId}/delivery/verify`)).body;
}

export async function payableInvoice(sellerApi: Api, range: { start: number; end: number }, overrides: Record<string, any> = {}) {
  const id = await createSignedVerifiedInvoice(sellerApi, range, overrides);
  const v = await deliverHonestly(sellerApi, id, range);
  expect(v.decision, JSON.stringify(v)).toBe("PASS");
  return id;
}

export async function authorizedAttempt(buyerApi: Api, invoiceId: string) {
  const req = await buyerApi.post(`/invoices/${invoiceId}/payments`);
  expect([200, 201]).toContain(req.status);
  const attempt = req.body;
  const s1 = await buyerApi.post(`/payments/${attempt.id}/approve-terms`, { authorization_digest: attempt.authorization.digest });
  expect(s1.status, JSON.stringify(s1.body)).toBe(200);
  const sig = await signTypedJson(buyer, attempt.authorizationTypedData);
  const s2 = await buyerApi.post(`/payments/${attempt.id}/authorize`, { signature: sig });
  expect(s2.status, JSON.stringify(s2.body)).toBe(200);
  return s2.body;
}

export async function sendTokenTransfer(token: Hex, to: Hex, amount: bigint, from = buyer) {
  const hash = await walletFor(from).writeContract({ address: token, abi: TOKEN_ABI, functionName: "transfer", args: [to, amount] });
  await pub.waitForTransactionReceipt({ hash });
  return hash;
}
