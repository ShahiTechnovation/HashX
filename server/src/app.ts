import express, { type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { config } from "./config.js";
import { pool, query } from "./db/client.js";
import { pendingMigrations } from "./db/migrate.js";
import {
  authenticate,
  createAgentCredential,
  issueNonce,
  listAgentCredentials,
  requireActor,
  requireHuman,
  revokeAgentCredential,
  revokeSession,
  verifySiweAndCreateSession,
} from "./auth/auth.js";
import { ApiError, badRequest, log, newRequestId, route } from "./lib/core.js";
import * as commerce from "./services/commerce.js";
import * as payments from "./services/payments.js";
import { getChainReader } from "./chain/readers.js";
import { registryStatus } from "./chain/registry.js";
import { validateSettlementToken } from "./settlement/sepoliaUsdc.js";
import { hspAdapter } from "./settlement/registry.js";
import { findNetwork } from "../../shared/networks.js";
import { mountMcp } from "./mcp/server.js";

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

function requestContext(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers["x-request-id"];
  req.requestId = typeof incoming === "string" && /^[A-Za-z0-9-]{8,64}$/.test(incoming) ? incoming : newRequestId();
  res.setHeader("X-Request-Id", req.requestId);
  const start = Date.now();
  res.on("finish", () => {
    log("INFO", "http_request", {
      requestId: req.requestId,
      method: req.method,
      path: req.path, // path only: no query strings
      status: res.statusCode,
      durationMs: Date.now() - start,
      actor: req.actor ? `${req.actor.kind}:${req.actor.wallet}` : undefined,
    });
  });
  next();
}

function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  next();
}

/** Strict CORS: only configured origins get CORS headers; disallowed browser origins are refused. */
function cors(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin) {
    if (!config().allowedOrigins.includes(origin)) {
      return res.status(403).json({ error: "Origin not allowed", code: "CORS_ORIGIN_DENIED", requestId: req.requestId });
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, Idempotency-Key, X-Request-Id, Mcp-Session-Id, Mcp-Protocol-Version");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "X-Request-Id, Mcp-Session-Id");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
}

/** Fixed-window in-memory rate limiter keyed by client IP (req.ip honours TRUST_PROXY only). */
function rateLimit(bucket: string, max: () => number) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${bucket}:${req.ip}`;
    const window = config().rateLimit.windowMs;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + window };
      hits.set(key, entry);
      if (hits.size > 50_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    }
    entry.count++;
    if (entry.count > max()) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000).toString());
      return res.status(429).json({ error: "Too many requests", code: "RATE_LIMITED", requestId: req.requestId });
    }
    next();
  };
}

const authLimiter = rateLimit("auth", () => config().rateLimit.maxAuth);
const writeLimiter = rateLimit("write", () => config().rateLimit.maxWrite);

function actor(req: Request) {
  if (!req.actor) throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
  return req.actor;
}

// ---------------------------------------------------------------------------
// Readiness (cached; public view excludes URLs, keys, and raw provider errors)
// ---------------------------------------------------------------------------

let readinessCache: { at: number; body: any } | null = null;

async function computeReadiness() {
  const cfg = config();
  let database: { status: string; pendingMigrations?: string[] } = { status: "unavailable" };
  try {
    await query("SELECT 1");
    const pending = await pendingMigrations(pool);
    database = { status: pending.length ? "migrations_pending" : "ok", pendingMigrations: pending };
  } catch {
    database = { status: "unavailable" };
  }

  const chains: Record<string, unknown> = {};
  for (const [chainId, chainCfg] of cfg.chains) {
    const net = findNetwork(chainId);
    const entry: Record<string, unknown> = {
      chainId,
      network: net?.name,
      rpc: chainCfg.rpcUrl ? "configured" : "unconfigured",
      paymentExecutionEnabled: chainCfg.paymentExecutionEnabled,
    };
    if (chainCfg.rpcUrl) {
      try {
        const reader = getChainReader(chainId);
        await reader.assertChainId();
        entry.rpc = "ok";
        entry.latestBlock = (await reader.getBlockNumber()).toString();
        if (chainCfg.settlementToken) {
          const v = await validateSettlementToken(reader, chainCfg);
          entry.settlementToken = {
            address: chainCfg.settlementToken.address,
            label: chainCfg.settlementToken.displayName,
            validatedOnChain: v.ok,
            reason: v.ok ? null : v.reason,
          };
        }
      } catch (err) {
        entry.rpc = (err as { code?: string }).code ?? "error";
      }
      entry.evidenceRegistry = await registryStatus(chainId);
    }
    chains[String(chainId)] = entry;
  }

  const sepolia = chains["11155111"] as any;
  const sepoliaSettlementReady =
    sepolia?.rpc === "ok" && sepolia?.paymentExecutionEnabled && sepolia?.settlementToken?.validatedOnChain === true;
  return {
    status: database.status === "ok" ? "ready" : "degraded",
    api: "ok",
    database,
    chains,
    settlement: {
      "sepolia-usdc": { available: Boolean(sepoliaSettlementReady && database.status === "ok") },
      "hashkey-hsp": hspAdapter().publicStatus(),
    },
    checkedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config().trustProxy);
  app.use(requestContext);
  app.use(securityHeaders);
  app.use(cors);
  app.use(express.json({ limit: "1mb" }));
  app.use(authenticate);

  // Health & readiness ------------------------------------------------------
  app.get("/health", (_req, res) => res.json({ status: "ok", service: "hashx-backend", version: "2.0.0" }));
  app.get(
    "/ready",
    route(async (_req, res) => {
      if (!readinessCache || Date.now() - readinessCache.at > 15_000) {
        readinessCache = { at: Date.now(), body: await computeReadiness() };
      }
      res.status(readinessCache.body.status === "ready" ? 200 : 503).json(readinessCache.body);
    })
  );

  // Auth --------------------------------------------------------------------
  app.get("/auth/nonce", authLimiter, route(async (_req, res) => res.json(await issueNonce())));
  app.post(
    "/auth/verify",
    authLimiter,
    route(async (req, res) => {
      const body = z.object({ message: z.string(), signature: z.string() }).safeParse(req.body);
      if (!body.success) throw badRequest("SIWE_INVALID", "message and signature are required");
      res.json(await verifySiweAndCreateSession(body.data.message, body.data.signature as `0x${string}`));
    })
  );
  app.get(
    "/auth/session",
    requireActor,
    route(async (req, res) => {
      const a = actor(req);
      const cp = await query("SELECT display_name FROM counterparties WHERE id = $1", [a.counterpartyId]);
      res.json({
        kind: a.kind,
        address: a.wallet,
        counterpartyId: a.counterpartyId,
        displayName: cp.rows[0]?.display_name ?? null,
        scopes: a.kind === "agent" ? a.scopes : "all-human",
      });
    })
  );
  app.post(
    "/auth/logout",
    requireHuman,
    route(async (req, res) => {
      const a = actor(req);
      if (a.kind === "wallet") await revokeSession(a.sessionId);
      res.json({ revoked: true });
    })
  );

  app.post(
    "/counterparties/me",
    requireHuman,
    writeLimiter,
    route(async (req, res) => {
      const body = z.object({ display_name: z.string().min(1).max(120) }).safeParse(req.body);
      if (!body.success) throw badRequest("INVALID_PAYLOAD", "display_name required");
      await query("UPDATE counterparties SET display_name = $1, updated_at = NOW() WHERE id = $2", [body.data.display_name, actor(req).counterpartyId]);
      res.json({ displayName: body.data.display_name });
    })
  );

  // Agent credentials (minted only by a human wallet session) ----------------
  app.post(
    "/agent-credentials",
    requireHuman,
    writeLimiter,
    route(async (req, res) => {
      const body = z
        .object({ label: z.string().min(1).max(128), scopes: z.array(z.string()).min(1), ttl_days: z.number().int().min(1).max(365).optional() })
        .safeParse(req.body);
      if (!body.success) throw badRequest("INVALID_PAYLOAD", "label and scopes are required", body.error.flatten());
      res.status(201).json(await createAgentCredential(actor(req), body.data.label, body.data.scopes, body.data.ttl_days));
    })
  );
  app.get("/agent-credentials", requireHuman, route(async (req, res) => res.json(await listAgentCredentials(actor(req)))));
  app.delete(
    "/agent-credentials/:id",
    requireHuman,
    route(async (req, res) => {
      const ok = await revokeAgentCredential(actor(req), String(req.params.id));
      if (!ok) throw new ApiError(404, "NOT_FOUND", "Credential not found");
      res.json({ revoked: true });
    })
  );

  // Invoices ----------------------------------------------------------------
  app.get("/invoices", requireActor, route(async (req, res) => res.json(await commerce.listInvoices(actor(req)))));
  app.post(
    "/invoices",
    requireActor,
    writeLimiter,
    route(async (req, res) => {
      const out = await commerce.createInvoice(actor(req), req.body);
      res.status(out.status).json({ ...out.invoice, typedData: out.typedData, idempotentReplay: out.idempotentReplay });
    })
  );
  app.get("/invoices/:id", requireActor, route(async (req, res) => res.json(await commerce.getInvoice(actor(req), String(req.params.id)))));
  app.get("/invoices/:id/typed-data", requireActor, route(async (req, res) => res.json(await commerce.getInvoiceTypedData(actor(req), String(req.params.id)))));
  app.post(
    "/invoices/:id/sign",
    requireActor,
    writeLimiter,
    route(async (req, res) => res.json(await commerce.signInvoice(actor(req), String(req.params.id), req.body?.signature)))
  );
  app.post("/invoices/:id/verify", requireActor, writeLimiter, route(async (req, res) => res.json(await commerce.verifyInvoice(actor(req), String(req.params.id)))));
  app.get("/invoices/:id/verification", requireActor, route(async (req, res) => res.json(await commerce.getVerificationSummary(actor(req), String(req.params.id)))));

  // Deliveries --------------------------------------------------------------
  app.get("/deliveries", requireActor, route(async (req, res) => res.json(await commerce.listDeliveries(actor(req)))));
  app.get("/invoices/:id/delivery", requireActor, route(async (req, res) => res.json(await commerce.getLatestDelivery(actor(req), String(req.params.id)))));
  app.post(
    "/invoices/:id/delivery/prepare",
    requireActor,
    writeLimiter,
    route(async (req, res) => res.json(await commerce.prepareDelivery(actor(req), String(req.params.id), req.body)))
  );
  app.post(
    "/invoices/:id/delivery",
    requireActor,
    writeLimiter,
    route(async (req, res) => res.status(201).json(await commerce.submitDelivery(actor(req), String(req.params.id), req.body)))
  );
  app.post(
    "/invoices/:id/delivery/verify",
    requireActor,
    writeLimiter,
    route(async (req, res) => res.json(await commerce.verifyDelivery(actor(req), String(req.params.id))))
  );

  // Payments ----------------------------------------------------------------
  const requestPaymentHandler = route(async (req, res) => {
    const key = req.headers["idempotency-key"];
    const out = await payments.requestPayment(actor(req), String(req.params.id), typeof key === "string" ? key : undefined);
    res.status(out.status).json({ ...out.attempt, idempotentReplay: out.idempotentReplay });
  });
  app.post("/invoices/:id/payments", requireActor, writeLimiter, requestPaymentHandler);
  app.post("/invoices/:id/pay", requireActor, writeLimiter, requestPaymentHandler); // v1 path alias
  app.get("/invoices/:id/payment-status", requireActor, route(async (req, res) => res.json(await payments.getPaymentStatusForInvoice(actor(req), String(req.params.id)))));
  app.get("/payments", requireActor, route(async (req, res) => res.json(await payments.listPayments(actor(req)))));
  app.get("/payments/:id", requireActor, route(async (req, res) => res.json(await payments.getPayment(actor(req), String(req.params.id)))));

  const stage1 = route(async (req, res) => res.json(await payments.approveTerms(actor(req), String(req.params.id), req.body)));
  const stage2 = route(async (req, res) => res.json(await payments.authorizePayment(actor(req), String(req.params.id), req.body)));
  app.post("/payments/:id/approve-terms", requireHuman, writeLimiter, stage1);
  app.post("/payments/:id/approve-signing", requireHuman, writeLimiter, stage1); // v1 path alias
  app.post("/payments/:id/authorize", requireHuman, writeLimiter, stage2);
  app.post("/payments/:id/approve-submission", requireHuman, writeLimiter, stage2); // v1 path alias
  app.post(
    "/payments/:id/transaction",
    requireHuman,
    writeLimiter,
    route(async (req, res) => res.json(await payments.submitTransaction(actor(req), String(req.params.id), req.body)))
  );
  app.post("/payments/:id/cancel", requireHuman, writeLimiter, route(async (req, res) => res.json(await payments.cancelAttempt(actor(req), String(req.params.id)))));
  app.post("/payments/:id/reconcile", requireActor, writeLimiter, route(async (req, res) => res.json(await payments.reconcileForActor(actor(req), String(req.params.id)))));

  // Receipts & stats ----------------------------------------------------------
  app.get("/receipts", requireActor, route(async (req, res) => res.json(await payments.listReceipts(actor(req)))));
  app.get("/receipts/:id", requireActor, route(async (req, res) => res.json(await payments.getReceiptById(actor(req), String(req.params.id)))));
  app.get(
    "/receipts/:id/export",
    requireActor,
    route(async (req, res) => {
      const r = await payments.getReceiptById(actor(req), String(req.params.id));
      res.setHeader("Content-Disposition", `attachment; filename="${r.id}.json"`);
      res.json(r.document);
    })
  );
  app.get("/invoices/:id/receipt", requireActor, route(async (req, res) => res.json(await payments.getReceiptForInvoice(actor(req), String(req.params.id)))));
  app.get("/stats", requireActor, route(async (req, res) => res.json(await payments.getStats(actor(req)))));
  app.get("/counterparties", requireActor, route(async (req, res) => {
    const r = await query(`SELECT id, display_name AS "displayName", wallet_address AS "walletAddress", status, wallet_verified_at IS NOT NULL AS "walletVerified" FROM counterparties WHERE status = 'ACTIVE' ORDER BY created_at ASC LIMIT 200`);
    res.json(r.rows);
  }));

  // MCP (agent-to-agent) ----------------------------------------------------
  mountMcp(app);

  // 404 & errors --------------------------------------------------------------
  app.use((req, res) => res.status(404).json({ error: "Not found", code: "NOT_FOUND", requestId: req.requestId }));
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: err.message, code: err.code, details: err.details, requestId: req.requestId });
    }
    if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
      return res.status(400).json({ error: "Malformed JSON body", code: "MALFORMED_JSON", requestId: req.requestId });
    }
    if (err?.type === "entity.too.large") {
      return res.status(413).json({ error: "Payload too large", code: "PAYLOAD_TOO_LARGE", requestId: req.requestId });
    }
    log("ERROR", "unhandled_error", { requestId: req.requestId, error: err?.message, code: err?.code });
    res.status(500).json({ error: "Internal Server Error", code: "INTERNAL_ERROR", requestId: req.requestId });
  });

  return app;
}

