/**
 * MCP agent interface over Streamable HTTP using the official SDK client.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { apiClient, buyer, createSubjectActivity, invoicePayload, login, seller, signTypedJson, startApp } from "../setup/helpers";
import { deliverHonestly } from "../setup/flows";

let app: Awaited<ReturnType<typeof startApp>>;

async function mcpClient(secret: string) {
  const client = new Client({ name: "test-agent", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(new URL(`${app.baseUrl}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${secret}` } } })
  );
  return client;
}
const parse = (r: any) => JSON.parse(r.content[0].text);

beforeAll(async () => {
  app = await startApp();
});
afterAll(async () => app.close());

describe("MCP agent tools", () => {
  it("rejects unauthenticated MCP calls", async () => {
    const res = await fetch(`${app.baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
  });

  it("seller agent → invoice → delivery; buyer agent can request but never approve payment", async () => {
    const range = await createSubjectActivity();
    const sellerHuman = apiClient(app.baseUrl, await login(app.baseUrl, seller));
    const buyerHuman = apiClient(app.baseUrl, await login(app.baseUrl, buyer));
    const sCred = (
      await sellerHuman.post("/agent-credentials", { label: "seller agent", scopes: ["invoices:read", "invoices:write", "deliveries:write", "verification:run"] })
    ).body;
    const bCred = (
      await buyerHuman.post("/agent-credentials", { label: "buyer agent", scopes: ["invoices:read", "payments:request", "payments:read", "verification:run"] })
    ).body;
    const sellerAgent = await mcpClient(sCred.secret);
    const buyerAgent = await mcpClient(bCred.secret);

    const tools = (await sellerAgent.listTools()).tools.map((t) => t.name).sort();
    expect(tools).toEqual([
      "create_invoice",
      "get_payment_status",
      "get_receipt",
      "prepare_delivery",
      "request_payment",
      "sign_invoice",
      "submit_delivery",
      "verify_delivery",
      "verify_invoice",
    ]);

    const created = parse(await sellerAgent.callTool({ name: "create_invoice", arguments: invoicePayload({}, range) }));
    const invoiceId = created.invoice.id;
    // The seller's own key signs (here the agent holds the seller key); HashX never signs.
    const signature = await signTypedJson(seller, created.typedData);
    expect(parse(await sellerAgent.callTool({ name: "sign_invoice", arguments: { invoice_id: invoiceId, signature } })).status).toBe("SIGNED");
    expect(parse(await sellerAgent.callTool({ name: "verify_invoice", arguments: { invoice_id: invoiceId } })).decision).toBe("PASS");

    // Buyer agent lacks write scopes.
    const denied = await buyerAgent.callTool({ name: "create_invoice", arguments: invoicePayload({ buyer_wallet: seller.address }, range) });
    expect(denied.isError).toBe(true);
    expect(parse(denied).code).toBe("INSUFFICIENT_SCOPE");

    const v = await deliverHonestly(apiClient(app.baseUrl, sCred.secret), invoiceId, range);
    expect(v.decision).toBe("PASS");
    expect(parse(await buyerAgent.callTool({ name: "verify_delivery", arguments: { invoice_id: invoiceId } })).decision).toBe("PASS");

    const req = parse(await buyerAgent.callTool({ name: "request_payment", arguments: { invoice_id: invoiceId } }));
    expect(req.humanApprovalRequired).toBe(true);
    expect(req.attempt.state).toBe("AWAITING_SIGNATURE_APPROVAL");
    // No MCP tool exists for approval, and the HTTP approval route refuses agent credentials.
    expect(tools.some((t) => /approve|authorize|transaction/.test(t))).toBe(false);
    const viaHttp = await apiClient(app.baseUrl, bCred.secret).post(`/payments/${req.attempt.id}/approve-terms`, {
      authorization_digest: req.attempt.authorization.digest,
    });
    expect(viaHttp.body.code).toBe("HUMAN_SESSION_REQUIRED");

    const status = parse(await buyerAgent.callTool({ name: "get_payment_status", arguments: { invoice_id: invoiceId } }));
    expect(status.state).toBe("AWAITING_SIGNATURE_APPROVAL");
    const receipt = await buyerAgent.callTool({ name: "get_receipt", arguments: { invoice_id: invoiceId } });
    expect(receipt.isError).toBe(true);
    await sellerAgent.close();
    await buyerAgent.close();
  });
});
