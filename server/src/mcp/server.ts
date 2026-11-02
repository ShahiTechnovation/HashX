/**
 * HashX MCP server (Streamable HTTP, stateless) for agent-to-agent commerce.
 *
 * Mounted at POST /mcp. Callers authenticate with a scoped agent credential
 * (Authorization: Bearer hx_agent_…) or a wallet session. Tools call the exact same
 * service functions as the HTTP API, so authorization and verification are identical.
 *
 * Human boundary: no tool can perform Stage 1 approval, Stage 2 wallet authorization,
 * or transaction reporting. `request_payment` only creates an obligation that a human
 * must approve in the HashX app with their own wallet. The server never signs anything.
 */
import type { Express, Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { Actor } from "../auth/auth.js";
import { ApiError, log } from "../lib/core.js";
import * as commerce from "../services/commerce.js";
import * as payments from "../services/payments.js";

export const MCP_TOOL_NAMES = [
  "create_invoice",
  "sign_invoice",
  "verify_invoice",
  "prepare_delivery",
  "submit_delivery",
  "verify_delivery",
  "request_payment",
  "get_payment_status",
  "get_receipt",
] as const;

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(err: unknown) {
  const e =
    err instanceof ApiError
      ? { error: err.message, code: err.code, status: err.status, details: err.details }
      : { error: "Internal error", code: "INTERNAL_ERROR" };
  if (!(err instanceof ApiError)) log("ERROR", "mcp_tool_error", { error: (err as Error)?.message });
  return { isError: true, content: [{ type: "text" as const, text: JSON.stringify(e) }] };
}

const invoiceId = { invoice_id: z.string().min(1).max(64).describe("HashX invoice identifier (inv_…)") };

export function buildMcpServer(actor: Actor): McpServer {
  const server = new McpServer({ name: "hashx", version: "2.0.0" });
  const wrap = <T>(fn: (args: T) => Promise<unknown>) => async (args: T) => {
    try {
      return ok(await fn(args));
    } catch (err) {
      return fail(err);
    }
  };

  server.registerTool(
    "create_invoice",
    {
      description:
        "Create a protocol-v2 invoice where the calling agent's owner wallet is the seller. Idempotent on client_request_id. Returns EIP-712 typed data the seller wallet must sign (HashX never signs).",
      inputSchema: commerce.CreateInvoiceInput.shape,
    },
    wrap(async (args) => {
      const out = await commerce.createInvoice(actor, args);
      return { invoice: out.invoice, typedData: out.typedData, idempotentReplay: out.idempotentReplay };
    })
  );

  server.registerTool(
    "sign_invoice",
    {
      description: "Attach the seller wallet's EIP-712 signature to a DRAFT invoice. The signature must recover to the seller wallet.",
      inputSchema: { ...invoiceId, signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/) },
    },
    wrap(async (a: { invoice_id: string; signature: string }) => commerce.signInvoice(actor, a.invoice_id, a.signature))
  );

  server.registerTool(
    "verify_invoice",
    { description: "Run fail-closed invoice verification (signature, identity binding, expiry, replay, settlement terms).", inputSchema: invoiceId },
    wrap(async (a: { invoice_id: string }) => commerce.verifyInvoice(actor, a.invoice_id))
  );

  server.registerTool(
    "prepare_delivery",
    {
      description: "Compute the canonical artifact SHA-256 and the EIP-712 delivery manifest the seller wallet must sign.",
      inputSchema: { ...invoiceId, artifact_uri: z.string().min(1).max(512), artifact_content: z.record(z.unknown()) },
    },
    wrap(async (a: { invoice_id: string; artifact_uri: string; artifact_content: Record<string, unknown> }) =>
      commerce.prepareDelivery(actor, a.invoice_id, { artifact_uri: a.artifact_uri, artifact_content: a.artifact_content })
    )
  );

  server.registerTool(
    "submit_delivery",
    {
      description: "Submit a delivery artifact with its seller-signed manifest. Commitments are re-verified independently by verify_delivery.",
      inputSchema: {
        ...invoiceId,
        artifact_uri: z.string().min(1).max(512),
        artifact_content: z.record(z.unknown()),
        manifest: z.record(z.unknown()),
        manifest_signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
      },
    },
    wrap(async (a: any) =>
      commerce.submitDelivery(actor, a.invoice_id, {
        artifact_uri: a.artifact_uri,
        artifact_content: a.artifact_content,
        manifest: a.manifest,
        manifest_signature: a.manifest_signature,
      })
    )
  );

  server.registerTool(
    "verify_delivery",
    {
      description: "Independently recompute delivery facts from the configured RPC. RPC failures produce PENDING, never PASS.",
      inputSchema: invoiceId,
    },
    wrap(async (a: { invoice_id: string }) => commerce.verifyDelivery(actor, a.invoice_id))
  );

  server.registerTool(
    "request_payment",
    {
      description:
        "Buyer-side: create the immutable payment obligation for a fully verified invoice. Does NOT approve or pay: a human must complete Stage 1 and Stage 2 with their own wallet in the HashX app.",
      inputSchema: { ...invoiceId, idempotency_key: z.string().min(8).max(128).optional() },
    },
    wrap(async (a: { invoice_id: string; idempotency_key?: string }) => {
      const out = await payments.requestPayment(actor, a.invoice_id, a.idempotency_key);
      return { attempt: out.attempt, idempotentReplay: out.idempotentReplay, humanApprovalRequired: true };
    })
  );

  server.registerTool(
    "get_payment_status",
    { description: "Latest payment attempt for an invoice, including on-chain reconciliation state.", inputSchema: invoiceId },
    wrap(async (a: { invoice_id: string }) => payments.getPaymentStatusForInvoice(actor, a.invoice_id))
  );

  server.registerTool(
    "get_receipt",
    { description: "Verifiable receipt, issued only after the settlement transfer is independently verified on-chain.", inputSchema: invoiceId },
    wrap(async (a: { invoice_id: string }) => payments.getReceiptForInvoice(actor, a.invoice_id))
  );

  return server;
}

export function mountMcp(app: Express) {
  app.post("/mcp", async (req: Request, res: Response) => {
    if (!req.actor) {
      return res.status(401).json({ jsonrpc: "2.0", error: { code: -32001, message: "Authentication required (Bearer agent credential)" }, id: null });
    }
    const server = buildMcpServer(req.actor);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      transport.close().catch(() => undefined);
      server.close().catch(() => undefined);
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      log("ERROR", "mcp_request_failed", { error: (err as Error).message });
      if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
    }
  });
  const notAllowed = (_req: Request, res: Response) =>
    res.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed (stateless server)" }, id: null });
  app.get("/mcp", notAllowed);
  app.delete("/mcp", notAllowed);
}
