/**
 * SIWE authentication, session lifecycle, header-spoofing resistance, and scoped agent credentials.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiClient, attacker, buyer, createSubjectActivity, invoicePayload, login, seller, siweMessage, startApp, type Api } from "../setup/helpers";
import { query } from "../../src/db/client";

let app: Awaited<ReturnType<typeof startApp>>;
let anon: Api;

beforeAll(async () => {
  app = await startApp();
  anon = apiClient(app.baseUrl);
});
afterAll(async () => app.close());

async function verify(message: string, signature: string) {
  return anon.post("/auth/verify", { message, signature });
}

describe("SIWE sign-in", () => {
  it("issues a session for a valid signature and binds the wallet to an account", async () => {
    const message = await siweMessage(app.baseUrl, seller);
    const res = await verify(message, await seller.signMessage({ message }));
    expect(res.status).toBe(200);
    expect(res.body.token).toMatch(/^hx_sess_/);
    expect(res.body.address).toBe(seller.address);
    const session = await apiClient(app.baseUrl, res.body.token).get("/auth/session");
    expect(session.body.address).toBe(seller.address);
    const stored = await query("SELECT token_hash FROM auth_sessions WHERE wallet_address = $1", [seller.address]);
    expect(stored.rows.every((r) => !String(r.token_hash).includes("hx_sess_"))).toBe(true); // only hashes stored
  });

  it("rejects nonce replay", async () => {
    const message = await siweMessage(app.baseUrl, seller);
    const sig = await seller.signMessage({ message });
    expect((await verify(message, sig)).status).toBe(200);
    const replay = await verify(message, sig);
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe("SIWE_NONCE_INVALID");
  });

  it("rejects server-unknown nonces", async () => {
    const message = (await siweMessage(app.baseUrl, seller)).replace(/Nonce: (\w+)/, "Nonce: deadbeefdeadbeefdeadbeef");
    expect((await verify(message, await seller.signMessage({ message }))).body.code).toBe("SIWE_NONCE_INVALID");
  });

  it("rejects a signature by a different wallet than the message address", async () => {
    const message = await siweMessage(app.baseUrl, seller);
    const res = await verify(message, await attacker.signMessage({ message }));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("SIWE_SIGNATURE_INVALID");
  });

  it("rejects foreign domains and origins (phishing-site messages)", async () => {
    const m1 = await siweMessage(app.baseUrl, seller, { domain: "evil.example", uri: "https://evil.example" });
    expect((await verify(m1, await seller.signMessage({ message: m1 }))).body.code).toBe("SIWE_DOMAIN_MISMATCH");
    const m2 = await siweMessage(app.baseUrl, seller, { uri: "https://evil.example/login" });
    expect((await verify(m2, await seller.signMessage({ message: m2 }))).body.code).toBe("SIWE_ORIGIN_MISMATCH");
  });

  it("rejects expired and unsupported-chain messages", async () => {
    const m1 = await siweMessage(app.baseUrl, seller, { expirationTime: new Date(Date.now() - 1000), issuedAt: new Date(Date.now() - 2000) });
    expect((await verify(m1, await seller.signMessage({ message: m1 }))).body.code).toBe("SIWE_EXPIRED");
    const m2 = await siweMessage(app.baseUrl, seller, { chainId: 999999 });
    expect((await verify(m2, await seller.signMessage({ message: m2 }))).body.code).toBe("SIWE_CHAIN_UNSUPPORTED");
  });

  it("expired sessions and logged-out sessions are rejected", async () => {
    const token = await login(app.baseUrl, buyer);
    const api = apiClient(app.baseUrl, token);
    expect((await api.post("/auth/logout")).status).toBe(200);
    const after = await api.get("/auth/session");
    expect(after.status).toBe(401);
    expect(after.body.code).toBe("INVALID_CREDENTIAL");

    const token2 = await login(app.baseUrl, buyer);
    await query(`UPDATE auth_sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE wallet_address = $1 AND revoked_at IS NULL`, [buyer.address]);
    expect((await apiClient(app.baseUrl, token2).get("/auth/session")).status).toBe(401);
  });
});

describe("header spoofing cannot bypass authentication", () => {
  const spoofed = {
    "x-wallet-address": seller.address,
    "x-api-key": "anything",
    "X-Forwarded-For": "127.0.0.1",
    "X-Forwarded-Host": "localhost",
    "X-Real-IP": "127.0.0.1",
  };

  it("financial writes reject header-only identity from a localhost connection", async () => {
    for (const [path, body] of [
      ["/invoices", invoicePayload({}, { start: 1, end: 2 })],
      ["/invoices/inv_x/sign", { signature: `0x${"11".repeat(65)}` }],
      ["/invoices/inv_x/delivery", {}],
      ["/invoices/inv_x/payments", {}],
      ["/payments/pay_x/approve-terms", { authorization_digest: `0x${"11".repeat(32)}` }],
      ["/payments/pay_x/authorize", { signature: `0x${"11".repeat(65)}` }],
      ["/payments/pay_x/transaction", { tx_hash: `0x${"11".repeat(32)}` }],
    ] as const) {
      const res = await anon.post(path, body, spoofed);
      expect(res.status, path).toBe(401);
    }
  });

  it("an unverifiable bearer token is rejected, not treated as anonymous or valid", async () => {
    for (const t of ["Bearer hx_sess_forged", "Bearer hx_agent_forged", "Bearer anything", "Basic Zm9vOmJhcg=="]) {
      const res = await anon.get("/invoices", { Authorization: t });
      expect(res.status, t).toBe(401);
    }
  });

  it("reads are also authenticated and participant-scoped", async () => {
    expect((await anon.get("/invoices")).status).toBe(401);
    expect((await anon.get("/payments")).status).toBe(401);
    expect((await anon.get("/receipts")).status).toBe(401);
  });

  it("disallowed browser origins are refused", async () => {
    const res = await anon.get("/health", { Origin: "https://evil.example" });
    expect(res.status).toBe(403);
    const ok = await anon.get("/health", { Origin: "http://localhost:3000" });
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });
});

describe("actor-level authorization", () => {
  it("a third party cannot modify, deliver, verify, or pay someone else's invoice", async () => {
    const range = await createSubjectActivity();
    const sellerApi = apiClient(app.baseUrl, await login(app.baseUrl, seller));
    const evil = apiClient(app.baseUrl, await login(app.baseUrl, attacker));
    const inv = await sellerApi.post("/invoices", invoicePayload({}, range));
    const id = inv.body.id;
    expect((await evil.get(`/invoices/${id}`)).status).toBe(404);
    expect((await evil.post(`/invoices/${id}/sign`, { signature: `0x${"11".repeat(65)}` })).status).toBe(404);
    expect((await evil.post(`/invoices/${id}/verify`)).status).toBe(404);
    expect((await evil.post(`/invoices/${id}/delivery/prepare`, { artifact_uri: "x", artifact_content: {} })).status).toBe(404);
    expect((await evil.post(`/invoices/${id}/payments`)).status).toBe(404);
    expect((await evil.get("/invoices")).body.find((i: any) => i.id === id)).toBeUndefined();
  });

  it("a seller cannot create an invoice that names themselves as buyer, or an unsupported chain", async () => {
    const sellerApi = apiClient(app.baseUrl, await login(app.baseUrl, seller));
    expect((await sellerApi.post("/invoices", invoicePayload({ buyer_wallet: seller.address }))).body.code).toBe("SELF_DEALING");
    const p = invoicePayload();
    expect((await sellerApi.post("/invoices", { ...p, payment: { ...p.payment, settlement_chain_id: 1 } })).body.code).toBe("UNSUPPORTED_CHAIN");
    expect((await sellerApi.post("/invoices", { ...p, payment: { ...p.payment, settlement_chain_id: 177, rail: "hashkey-hsp", token_address: seller.address } })).body.code).toBe("MAINNET_PAYMENTS_DISABLED");
    const bigRange = invoicePayload({}, { start: 1, end: 10_000 });
    expect((await sellerApi.post("/invoices", bigRange)).body.code).toBe("RANGE_UNSUPPORTED");
  });
});

describe("scoped agent credentials", () => {
  it("are minted only by humans, enforce scopes, and can be revoked", async () => {
    const human = apiClient(app.baseUrl, await login(app.baseUrl, seller));
    const cred = await human.post("/agent-credentials", { label: "seller agent", scopes: ["invoices:read"] });
    expect(cred.status).toBe(201);
    expect(cred.body.secret).toMatch(/^hx_agent_/);
    const agent = apiClient(app.baseUrl, cred.body.secret);
    expect((await agent.get("/invoices")).status).toBe(200);
    expect((await agent.post("/invoices", invoicePayload())).body.code).toBe("INSUFFICIENT_SCOPE");
    // Agents cannot mint further credentials (no privilege escalation).
    expect((await agent.post("/agent-credentials", { label: "x", scopes: ["invoices:write"] })).body.code).toBe("HUMAN_SESSION_REQUIRED");
    expect((await human.post("/agent-credentials", { label: "x", scopes: ["payments:approve"] })).body.code).toBe("INVALID_SCOPE");
    expect((await human.del(`/agent-credentials/${cred.body.id}`)).status).toBe(200);
    expect((await agent.get("/invoices")).status).toBe(401);
  });
});
