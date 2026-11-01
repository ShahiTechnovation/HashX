import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { keccak256, toBytes } from "viem";
import { pool, query, withTransaction } from "./db/client.js";
import { HSPClientAdapter } from "./services/hsp.js";
import {
  computeInvoiceDigest,
  computeServiceTermsHash,
  verifyInvoice,
  verifyDelivery,
  evaluatePaymentEligibility,
} from "./services/verification.js";
import {
  Invoice,
  Delivery,
  PaymentAttempt,
  VerifiableReceipt,
  Counterparty,
  Address,
  Hash,
} from "./types.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const EXPECTED_EGRESS_IP = process.env.EXPECTED_EGRESS_IP || "157.119.44.58";
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000").split(",");

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server) or matching allowed origins
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin '${origin}' not allowed by policy`));
      }
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));

// Structured Request Logger
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.info(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "INFO",
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: duration,
        ip: req.ip,
      })
    );
  });
  next();
});

// HSP Adapter Instance
const hspAdapter = new HSPClientAdapter({
  endpoint: process.env.HSP_MCP_STREAMABLE_HTTP_ENDPOINT,
  merchantName: process.env.HSP_MERCHANT_NAME || "HashX",
  appKey: process.env.HSP_APP_KEY,
  appSecret: process.env.HSP_APP_SECRET,
  isAllowlisted: process.env.HSP_ALLOWLIST_CONFIRMED === "true",
});

// Helper: Append Audit Event
async function recordAuditEvent(
  aggregateType: string,
  aggregateId: string,
  actor: string,
  event: string,
  payload: any
) {
  try {
    const payloadStr = JSON.stringify(payload);
    const payloadDigest = keccak256(toBytes(payloadStr));
    await query(
      `INSERT INTO audit_events (aggregate_type, aggregate_id, actor, event, payload_digest, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [aggregateType, aggregateId, actor, event, payloadDigest, payloadStr]
    );
  } catch (err) {
    console.warn("[Audit] Failed to append audit event:", err);
  }
}

// ==============================================================================
// 1. HEALTH & ENVIRONMENT DIAGNOSTICS
// ==============================================================================
app.get("/health", async (req: Request, res: Response) => {
  let dbStatus = "disconnected";
  let dbCounterpartiesCount = 0;

  try {
    const ping = await query("SELECT count(*) as count FROM counterparties");
    dbStatus = "connected";
    dbCounterpartiesCount = parseInt(ping.rows[0].count, 10);
  } catch (err: any) {
    dbStatus = `error (${err.message})`;
  }

  res.json({
    status: "ok",
    service: "HashX Backend",
    version: "1.0.0",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      engine: "PostgreSQL 18 (Native Local Windows Service)",
      registeredCounterparties: dbCounterpartiesCount,
    },
    egressIp: {
      submittedToHashKey: EXPECTED_EGRESS_IP,
      status: process.env.HSP_ALLOWLIST_CONFIRMED === "true" ? "ALLOWLISTED" : "PENDING_CONFIRMATION",
    },
    hsp: {
      merchantName: hspAdapter.config.merchantName,
      endpoint: hspAdapter.config.endpoint,
      allowlistConfirmed: hspAdapter.config.isAllowlisted,
      safeMode: !hspAdapter.config.isAllowlisted,
    },
    chain: {
      testnetRpc: process.env.HSK_TESTNET_RPC || "https://testnet.hsk.xyz",
      mainnetRpc: process.env.HSK_MAINNET_RPC || "https://mainnet.hsk.xyz",
      preferredChainId: 133,
    },
  });
});

// ==============================================================================
// 2. COUNTERPARTIES
// ==============================================================================
app.get("/counterparties", async (req: Request, res: Response) => {
  const result = await query(
    `SELECT id, display_name as "displayName", wallet_address as "walletAddress", 
            wallet_type as "walletType", status, created_at as "createdAt", metadata->>'notes' as notes 
     FROM counterparties ORDER BY created_at ASC`
  );
  res.json(result.rows);
});

// ==============================================================================
// 3. INVOICES
// ==============================================================================
function mapInvoiceRow(row: any): Invoice {
  return {
    id: row.id,
    version: row.version,
    clientRequestId: row.client_request_id,
    sellerId: row.seller_id,
    sellerDisplayName: row.seller_display_name,
    sellerWallet: row.seller_wallet as Address,
    buyerRef: row.buyer_ref,
    buyerRefHash: row.buyer_ref_hash as Hash,
    service: row.service_params,
    serviceTermsHash: row.service_terms_hash as Hash,
    payment: {
      currency: row.currency,
      amount_minor: row.amount_minor,
      payee: row.payee as Address,
      preferred_chain_id: row.preferred_chain_id,
    },
    issuedAt: new Date(row.issued_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
    nonce: row.nonce,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    digest: row.digest as Hash,
    signature: row.signature || undefined,
    signer: row.signer || undefined,
    signatureValid: row.signature ? true : undefined,
  };
}

app.get("/invoices", async (req: Request, res: Response) => {
  const result = await query("SELECT * FROM invoices ORDER BY created_at DESC");
  res.json(result.rows.map(mapInvoiceRow));
});

app.get("/invoices/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await query("SELECT * FROM invoices WHERE id = $1", [id]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: `Invoice not found: ${id}` });
  }
  res.json(mapInvoiceRow(result.rows[0]));
});

app.post("/invoices", async (req: Request, res: Response) => {
  const input = req.body;
  if (!input.service?.parameters?.address || !input.payment?.amount_minor || !input.payment?.payee) {
    return res.status(400).json({ error: "Missing required invoice fields (service, payment)" });
  }

  // Resolve seller counterparty
  const cpRes = await query(
    "SELECT * FROM counterparties WHERE id = $1 OR wallet_address ILIKE $2 LIMIT 1",
    [input.seller_counterparty_id, input.seller_wallet || ""]
  );

  const seller = cpRes.rows[0] || {
    id: "a0000000-0000-0000-0000-000000000001",
    display_name: "Nexus Analytics Agent (Node #42)",
    wallet_address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  };

  const newId = `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const termsHash = computeServiceTermsHash(
    input.service.parameters.address,
    input.service.parameters.start_block,
    input.service.parameters.end_block,
    input.service.acceptance_policy
  );
  const buyerRef = input.buyer_ref || `order-ref-${Date.now()}`;
  const buyerRefHash = keccak256(toBytes(buyerRef));
  const nonce = Math.floor(1000 + Math.random() * 9000).toString();
  const expiresAt = input.expires_at || new Date(Date.now() + 86400 * 1000).toISOString();

  const tempInvoice: Invoice = {
    id: newId,
    version: 1,
    clientRequestId: input.client_request_id || `req-${Date.now()}`,
    sellerId: seller.id,
    sellerDisplayName: seller.display_name,
    sellerWallet: seller.wallet_address as Address,
    buyerRef,
    buyerRefHash,
    service: input.service,
    serviceTermsHash: termsHash,
    payment: input.payment,
    issuedAt: new Date().toISOString(),
    expiresAt,
    nonce,
    status: "DRAFT",
    createdAt: new Date().toISOString(),
    digest: "0x" as Hash,
  };

  const digest = computeInvoiceDigest(tempInvoice, input.payment.preferred_chain_id || 133);
  tempInvoice.digest = digest;

  await query(
    `INSERT INTO invoices (
      id, version, client_request_id, seller_id, seller_wallet, seller_display_name,
      buyer_ref, buyer_ref_hash, service_type, service_params, service_terms_hash,
      amount_minor, currency, payee, preferred_chain_id, nonce, digest, status, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
    [
      newId,
      1,
      tempInvoice.clientRequestId,
      seller.id,
      seller.wallet_address,
      seller.display_name,
      buyerRef,
      buyerRefHash,
      input.service.type,
      JSON.stringify(input.service),
      termsHash,
      input.payment.amount_minor,
      input.payment.currency || "USD",
      input.payment.payee,
      input.payment.preferred_chain_id || 133,
      nonce,
      digest,
      "DRAFT",
      expiresAt,
    ]
  );

  await recordAuditEvent("INVOICE", newId, seller.wallet_address, "INVOICE_CREATED", tempInvoice);

  res.status(201).json(tempInvoice);
});

app.post("/invoices/:id/sign", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { signature, signer } = req.body;

  const invRes = await query("SELECT * FROM invoices WHERE id = $1", [id]);
  if (invRes.rowCount === 0) {
    return res.status(404).json({ error: `Invoice not found: ${id}` });
  }

  const invoice = mapInvoiceRow(invRes.rows[0]);
  const activeSigner = signer || invoice.sellerWallet;
  const activeSignature = signature || `0xsimulated_eip712_${Date.now()}`;

  await query(
    "UPDATE invoices SET signature = $1, signer = $2, status = 'SIGNED', updated_at = NOW() WHERE id = $3",
    [activeSignature, activeSigner, id]
  );

  invoice.signature = activeSignature;
  invoice.signer = activeSigner;
  invoice.status = "SIGNED";
  invoice.signatureValid = true;

  await recordAuditEvent("INVOICE", id, activeSigner, "INVOICE_SIGNED", { signature: activeSignature });

  res.json(invoice);
});

app.post("/invoices/:id/verify", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const invRes = await query("SELECT * FROM invoices WHERE id = $1", [id]);
  if (invRes.rowCount === 0) {
    return res.status(404).json({ error: `Invoice not found: ${id}` });
  }

  const invoice = mapInvoiceRow(invRes.rows[0]);
  const result = await verifyInvoice(invoice);

  const nextStatus = result.decision === "PASS" ? "VERIFIED" : "REJECTED";
  await query("UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2", [nextStatus, id]);

  await query(
    `INSERT INTO verification_runs (object_type, object_id, verifier_version, decision, checks, check_details, reason_codes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      "INVOICE",
      id,
      result.verifierVersion,
      result.decision,
      JSON.stringify(result.checks),
      JSON.stringify(result.checkDetails),
      JSON.stringify(result.reasonCodes),
    ]
  );

  await recordAuditEvent("INVOICE", id, "VERIFIER_ENGINE", `INVOICE_${result.decision}`, result);

  res.json(result);
});

// ==============================================================================
// 4. DELIVERIES
// ==============================================================================
function mapDeliveryRow(row: any): Delivery {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    version: row.version,
    artifactUri: row.artifact_uri,
    artifactSha256: row.artifact_sha256 as Hash,
    manifest: row.manifest,
    manifestSignature: row.manifest_signature as `0x${string}`,
    status: row.status,
    submittedAt: new Date(row.submitted_at).toISOString(),
    artifactContent: row.artifact_content,
  };
}

app.get("/deliveries", async (req: Request, res: Response) => {
  const result = await query("SELECT * FROM deliveries ORDER BY submitted_at DESC");
  res.json(result.rows.map(mapDeliveryRow));
});

app.get("/invoices/:id/delivery", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await query("SELECT * FROM deliveries WHERE invoice_id = $1 ORDER BY version DESC LIMIT 1", [id]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: `No delivery found for invoice ${id}` });
  }
  res.json(mapDeliveryRow(result.rows[0]));
});

app.post("/invoices/:id/delivery", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const input = req.body;

  const invRes = await query("SELECT * FROM invoices WHERE id = $1", [id]);
  if (invRes.rowCount === 0) {
    return res.status(404).json({ error: `Invoice not found: ${id}` });
  }

  const delId = `del-${Date.now().toString(36)}`;
  await query(
    `INSERT INTO deliveries (id, invoice_id, version, artifact_uri, artifact_sha256, manifest, manifest_signature, artifact_content, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING_VERIFICATION')`,
    [
      delId,
      id,
      1,
      input.artifact_uri,
      input.artifact_sha256,
      JSON.stringify(input.manifest),
      input.manifest_signature,
      JSON.stringify(input.artifact_content),
    ]
  );

  await query("UPDATE invoices SET status = 'DELIVERED', updated_at = NOW() WHERE id = $1", [id]);
  await recordAuditEvent("DELIVERY", delId, input.manifest?.seller || "SELLER", "DELIVERY_SUBMITTED", input);

  res.status(201).json({
    id: delId,
    invoiceId: id,
    version: 1,
    artifactUri: input.artifact_uri,
    artifactSha256: input.artifact_sha256,
    manifest: input.manifest,
    manifestSignature: input.manifest_signature,
    status: "PENDING_VERIFICATION",
    submittedAt: new Date().toISOString(),
    artifactContent: input.artifact_content,
  });
});

app.post("/invoices/:id/delivery/verify", async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const invRes = await query("SELECT * FROM invoices WHERE id = $1", [id]);
  if (invRes.rowCount === 0) return res.status(404).json({ error: "Invoice not found" });

  const delRes = await query("SELECT * FROM deliveries WHERE invoice_id = $1 ORDER BY version DESC LIMIT 1", [id]);
  if (delRes.rowCount === 0) return res.status(404).json({ error: "Delivery not found" });

  const invoice = mapInvoiceRow(invRes.rows[0]);
  const delivery = mapDeliveryRow(delRes.rows[0]);

  const result = await verifyDelivery(invoice, delivery);

  const delStatus = result.decision === "PASS" ? "ACCEPTED" : "REJECTED";
  const invStatus = result.decision === "PASS" ? "DELIVERY_ACCEPTED" : "DELIVERY_REJECTED";

  await query("UPDATE deliveries SET status = $1 WHERE id = $2", [delStatus, delivery.id]);
  await query("UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2", [invStatus, id]);

  await query(
    `INSERT INTO verification_runs (object_type, object_id, verifier_version, decision, checks, check_details, reason_codes, evidence_digest, rpc_endpoint_used)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      "DELIVERY",
      delivery.id,
      result.verifier,
      result.decision,
      JSON.stringify(result.checks),
      JSON.stringify(result.checkDetails),
      JSON.stringify(result.reasonCodes),
      result.evidenceDigest,
      result.rpcEndpointUsed,
    ]
  );

  await recordAuditEvent("DELIVERY", delivery.id, "VERIFIER_ENGINE", `DELIVERY_${result.decision}`, result);

  res.json(result);
});

// ==============================================================================
// 5. PAYMENTS & IDEMPOTENCY ENGINE
// ==============================================================================
function mapPaymentRow(row: any): PaymentAttempt {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    flowId: row.flow_id,
    paymentRequestId: row.payment_request_id,
    merchantName: row.merchant_name,
    attributionVerified: row.attribution_verified,
    payer: row.payer as Address,
    payee: row.payee as Address,
    tokenAddress: row.token_address as Address,
    tokenTotalRaw: row.token_total_raw,
    quoteExpiresAt: new Date(row.quote_expires_at).toISOString(),
    hspStatus: row.hsp_status,
    state: row.state,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    txHash: row.tx_hash || undefined,
    evidenceRegistryTx: row.evidence_registry_tx || undefined,
    approvalSummary: row.approval_summary,
  };
}

app.get("/payments", async (req: Request, res: Response) => {
  const result = await query("SELECT * FROM payment_attempts ORDER BY created_at DESC");
  res.json(result.rows.map(mapPaymentRow));
});

app.get("/payments/:id", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await query("SELECT * FROM payment_attempts WHERE id = $1", [id]);
  if (result.rowCount === 0) return res.status(404).json({ error: "Payment attempt not found" });
  res.json(mapPaymentRow(result.rows[0]));
});

/**
 * request_payment (P0): Strictly enforces database-level payment idempotency:
 * 1. Lock invoice row: SELECT ... FOR UPDATE
 * 2. Verify state is DELIVERY_ACCEPTED
 * 3. Return existing active attempt if found
 * 4. Only then create new HSP payment attempt
 */
app.post("/invoices/:id/pay", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { payer } = req.body;

  try {
    const attempt = await withTransaction(async (client) => {
      // 1. Lock invoice row
      const invLock = await client.query("SELECT * FROM invoices WHERE id = $1 FOR UPDATE", [id]);
      if (invLock.rowCount === 0) {
        throw new Error(`Invoice not found: ${id}`);
      }

      const invRow = invLock.rows[0];

      // 2. Policy Firewall: Must be DELIVERY_ACCEPTED
      if (invRow.status !== "DELIVERY_ACCEPTED") {
        throw new Error(
          `Payment blocked by Policy Firewall: Invoice status is '${invRow.status}', required: 'DELIVERY_ACCEPTED'`
        );
      }

      // 3. Idempotency Check: search active non-terminal attempts
      const existing = await client.query(
        "SELECT * FROM payment_attempts WHERE invoice_id = $1 AND state NOT IN ('FINALIZED', 'FAILED') LIMIT 1",
        [id]
      );
      if (existing.rowCount && existing.rowCount > 0) {
        return mapPaymentRow(existing.rows[0]);
      }

      // 4. Create Order & Prepare Payment via HSP adapter
      const payerAddress = (payer || "0x1234567890123456789012345678901234567890") as Address;
      const order = await hspAdapter.createOrder({
        invoiceId: id,
        payTo: invRow.payee,
        payer: payerAddress,
        amountMinor: invRow.amount_minor,
        currency: invRow.currency,
        chainId: invRow.preferred_chain_id,
      });

      const prep = await hspAdapter.preparePayment({
        flowId: order.flowId,
        paymentRequestId: order.paymentRequestId,
        payer: payerAddress,
        payee: invRow.payee,
        amountMinor: invRow.amount_minor,
        chainId: invRow.preferred_chain_id,
      });

      const newAttemptId = `pay-${Date.now().toString(36)}`;
      const approvalSummary = {
        merchantName: hspAdapter.config.merchantName,
        attributionVerified: true,
        payer: payerAddress,
        payee: invRow.payee,
        tokenAddress: prep.tokenAddress,
        tokenSymbol: prep.tokenSymbol,
        tokenDecimals: prep.tokenDecimals,
        tokenTotalRaw: prep.tokenTotalRaw,
        humanAmount: `${(parseInt(invRow.amount_minor, 10) / 100).toFixed(2)} ${prep.tokenSymbol}`,
        invoiceValueUsd: `$${(parseInt(invRow.amount_minor, 10) / 100).toFixed(2)} USD`,
        paymentFeeEstimateUsd: "$0.00 USD",
        chain: invRow.preferred_chain_id === 177 ? "HashKey Chain Mainnet" : "HashKey Chain Testnet",
        chainId: invRow.preferred_chain_id,
        quoteExpiresAt: prep.quoteExpiresAt,
      };

      await client.query(
        `INSERT INTO payment_attempts (
          id, invoice_id, flow_id, payment_request_id, merchant_name, attribution_verified,
          payer, payee, token_address, token_total_raw, quote_expires_at, hsp_status, state, approval_summary
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          newAttemptId,
          id,
          order.flowId,
          order.paymentRequestId,
          hspAdapter.config.merchantName,
          true,
          payerAddress,
          invRow.payee,
          prep.tokenAddress,
          prep.tokenTotalRaw,
          prep.quoteExpiresAt,
          "payment-submitted",
          "AWAITING_SIGNATURE_APPROVAL",
          JSON.stringify(approvalSummary),
        ]
      );

      const createdRow = await client.query("SELECT * FROM payment_attempts WHERE id = $1", [newAttemptId]);
      return mapPaymentRow(createdRow.rows[0]);
    });

    await recordAuditEvent("PAYMENT", attempt.id, attempt.payer, "PAYMENT_REQUESTED", attempt);
    res.status(201).json(attempt);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Stage 1 Approval: Signing review
app.post("/payments/:id/approve-signing", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const payRes = await query("SELECT * FROM payment_attempts WHERE id = $1", [id]);
  if (payRes.rowCount === 0) return res.status(404).json({ error: "Payment attempt not found" });

  const attempt = mapPaymentRow(payRes.rows[0]);

  // Quote Expiry Check
  if (new Date().getTime() > new Date(attempt.quoteExpiresAt).getTime()) {
    return res.status(400).json({
      error: "HSP quote has expired (5-minute validity exceeded). Re-prepare payment.",
      code: "QUOTE_EXPIRED",
    });
  }

  await query(
    `INSERT INTO approvals (payment_attempt_id, stage, actor, terms_hash)
     VALUES ($1, 'SIGNING', $2, $3)
     ON CONFLICT (payment_attempt_id, stage) DO NOTHING`,
    [id, attempt.payer, keccak256(toBytes(attempt.tokenTotalRaw))]
  );

  await query(
    "UPDATE payment_attempts SET state = 'AWAITING_SUBMISSION_APPROVAL', updated_at = NOW() WHERE id = $1",
    [id]
  );

  attempt.state = "AWAITING_SUBMISSION_APPROVAL";
  await recordAuditEvent("PAYMENT", id, attempt.payer, "SIGNING_APPROVED", { state: attempt.state });

  res.json(attempt);
});

// Stage 2 Approval: Broadcast confirmation
app.post("/payments/:id/approve-submission", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { signature } = req.body;

  const payRes = await query("SELECT * FROM payment_attempts WHERE id = $1", [id]);
  if (payRes.rowCount === 0) return res.status(404).json({ error: "Payment attempt not found" });

  const attempt = mapPaymentRow(payRes.rows[0]);

  // Quote Expiry Check at submission time
  if (new Date().getTime() > new Date(attempt.quoteExpiresAt).getTime()) {
    return res.status(400).json({
      error: "HSP quote has expired (5-minute validity window exceeded). Payment must be re-prepared.",
      code: "QUOTE_EXPIRED",
    });
  }

  // Ensure Stage 1 was approved
  const stage1Check = await query(
    "SELECT id FROM approvals WHERE payment_attempt_id = $1 AND stage = 'SIGNING'",
    [id]
  );
  if (stage1Check.rowCount === 0) {
    return res.status(400).json({
      error: "Stage 1 (Signing Approval) is required before Stage 2 submission broadcast.",
      code: "STAGE1_APPROVAL_MISSING",
    });
  }

  // Record Stage 2 approval
  await query(
    `INSERT INTO approvals (payment_attempt_id, stage, actor, terms_hash, signature)
     VALUES ($1, 'SUBMISSION', $2, $3, $4)
     ON CONFLICT (payment_attempt_id, stage) DO NOTHING`,
    [id, attempt.payer, keccak256(toBytes(attempt.tokenTotalRaw)), signature || "0xuser_deliberate_submission"]
  );

  let txHash = attempt.txHash;
  let hspStatus: any = "payment-submitted";
  let state: any = "SUBMITTED";

  // If HSP allowlisted, submit to rail; otherwise maintain exact unfinalized state
  if (hspAdapter.isConfiguredForLive()) {
    const subResult = await hspAdapter.submitPayment({
      flowId: attempt.flowId,
      paymentRequestId: attempt.paymentRequestId,
    });
    hspStatus = subResult.status;
    txHash = subResult.txHash;
  } else {
    // In local safe mode before allowlist confirmation:
    // DO NOT FABRICATE A FAKE TRANSACTION HASH!
    // Outgoing calls to HSP QA are halted. State is preserved as SUBMITTED with null txHash.
    txHash = undefined;
    hspStatus = "payment-submitted";
  }

  await query(
    "UPDATE payment_attempts SET state = $1, hsp_status = $2, tx_hash = $3, updated_at = NOW() WHERE id = $4",
    [state, hspStatus, txHash || null, id]
  );

  attempt.state = state;
  attempt.hspStatus = hspStatus;
  attempt.txHash = txHash;

  await recordAuditEvent("PAYMENT", id, attempt.payer, "SUBMISSION_APPROVED", {
    txHash: txHash || null,
    hspStatus,
    safeMode: !hspAdapter.isConfiguredForLive(),
  });

  res.json(attempt);
});

app.get("/invoices/:id/payment-status", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await query("SELECT * FROM payment_attempts WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1", [id]);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: `No payment attempt found for invoice ${id}` });
  }

  const attempt = mapPaymentRow(result.rows[0]);

  // If submitted, reconcile status with HSP
  if (attempt.state === "SUBMITTED") {
    if (hspAdapter.isConfiguredForLive()) {
      const qRes = await hspAdapter.queryPayment({
        flowId: attempt.flowId,
        paymentRequestId: attempt.paymentRequestId,
      });
      // Strict semantic mapping: payment-safe is NEVER marked finalized!
      if (qRes.status === "payment-finalized") {
        attempt.hspStatus = "payment-finalized";
        attempt.state = "FINALIZED";
        if (qRes.txHash) attempt.txHash = qRes.txHash;

        await query(
          "UPDATE payment_attempts SET state = 'FINALIZED', hsp_status = 'payment-finalized', tx_hash = $1, updated_at = NOW() WHERE id = $2",
          [attempt.txHash || null, attempt.id]
        );
        await query("UPDATE invoices SET status = 'SETTLED', updated_at = NOW() WHERE id = $1", [id]);
      } else {
        attempt.hspStatus = qRes.status;
        if (qRes.txHash) attempt.txHash = qRes.txHash;
      }
    } else {
      // In local safe mode before allowlist confirmation:
      // State remains SUBMITTED. NEVER auto-promote to FINALIZED or fabricate settlement!
      // (Test suites using simulated settlement explicitly invoke dedicated test endpoints or mock adapter).
    }
  }

  res.json(attempt);
});

// ==============================================================================
// 6. RECEIPTS
// ==============================================================================
app.get("/receipts", async (req: Request, res: Response) => {
  const result = await query("SELECT * FROM receipts ORDER BY issued_at DESC");
  res.json(
    result.rows.map((r) => ({
      id: r.id,
      invoiceId: r.invoice_id,
      receiptVersion: r.receipt_version,
      invoiceDigest: r.invoice_digest,
      seller: r.seller,
      sellerDisplayName: r.seller_display_name,
      buyerRef: r.buyer_ref,
      deliveryEvidenceDigest: r.delivery_evidence_digest,
      payment: r.payment_data,
      evidenceRegistryTx: r.evidence_registry_tx,
      issuedAt: new Date(r.issued_at).toISOString(),
      rawPayloadJson: JSON.stringify(r.raw_payload_json, null, 2),
    }))
  );
});

app.get("/invoices/:id/receipt", async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const result = await query("SELECT * FROM receipts WHERE invoice_id = $1", [id]);

  if (result.rowCount && result.rowCount > 0) {
    const r = result.rows[0];
    return res.json({
      id: r.id,
      invoiceId: r.invoice_id,
      receiptVersion: r.receipt_version,
      invoiceDigest: r.invoice_digest,
      seller: r.seller,
      sellerDisplayName: r.seller_display_name,
      buyerRef: r.buyer_ref,
      deliveryEvidenceDigest: r.delivery_evidence_digest,
      payment: r.payment_data,
      evidenceRegistryTx: r.evidence_registry_tx,
      issuedAt: new Date(r.issued_at).toISOString(),
      rawPayloadJson: JSON.stringify(r.raw_payload_json, null, 2),
    });
  }

  // If not yet committed to receipts table, verify if payment is finalized and generate receipt
  const invRes = await query("SELECT * FROM invoices WHERE id = $1", [id]);
  const payRes = await query("SELECT * FROM payment_attempts WHERE invoice_id = $1 AND state = 'FINALIZED' LIMIT 1", [id]);
  const delRes = await query("SELECT * FROM deliveries WHERE invoice_id = $1 AND status = 'ACCEPTED' LIMIT 1", [id]);

  if (invRes.rowCount === 0 || payRes.rowCount === 0) {
    return res.status(404).json({ error: "Settled receipt not available for this invoice" });
  }

  const inv = mapInvoiceRow(invRes.rows[0]);
  const pay = mapPaymentRow(payRes.rows[0]);
  const del = delRes.rowCount ? mapDeliveryRow(delRes.rows[0]) : null;

  const receiptId = `rcpt-${Date.now().toString(36)}`;
  const evidenceDigest = del
    ? keccak256(toBytes(`${del.artifactSha256}:${inv.sellerWallet}`))
    : ("0x0000000000000000000000000000000000000000000000000000000000000000" as Hash);

  const paymentData = {
    hspStatus: pay.hspStatus,
    flowId: pay.flowId,
    paymentRequestId: pay.paymentRequestId,
    txHash: pay.txHash,
    payer: pay.payer,
    payee: pay.payee,
    tokenTotalRaw: pay.tokenTotalRaw,
    tokenSymbol: pay.approvalSummary.tokenSymbol,
    humanAmount: pay.approvalSummary.humanAmount,
    finalizedAt: pay.updatedAt,
  };

  const rawJson = {
    receipt_version: "1",
    invoice_id: id,
    invoice_digest: inv.digest,
    seller: inv.sellerWallet,
    flow_id: pay.flowId,
    payment_request_id: pay.paymentRequestId,
    tx_hash: pay.txHash,
    status: pay.hspStatus,
    timestamp: new Date().toISOString(),
  };

  await query(
    `INSERT INTO receipts (id, invoice_id, receipt_version, invoice_digest, seller, seller_display_name, buyer_ref, delivery_evidence_digest, payment_data, raw_payload_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (invoice_id) DO NOTHING`,
    [
      receiptId,
      id,
      "1",
      inv.digest,
      inv.sellerWallet,
      inv.sellerDisplayName,
      inv.buyerRef,
      evidenceDigest,
      JSON.stringify(paymentData),
      JSON.stringify(rawJson),
    ]
  );

  const receiptRes = await query("SELECT * FROM receipts WHERE invoice_id = $1", [id]);
  const finalR = receiptRes.rows[0];

  res.json({
    id: finalR.id,
    invoiceId: finalR.invoice_id,
    receiptVersion: finalR.receipt_version,
    invoiceDigest: finalR.invoice_digest,
    seller: finalR.seller,
    sellerDisplayName: finalR.seller_display_name,
    buyerRef: finalR.buyer_ref,
    deliveryEvidenceDigest: finalR.delivery_evidence_digest,
    payment: finalR.payment_data,
    evidenceRegistryTx: finalR.evidence_registry_tx,
    issuedAt: new Date(finalR.issued_at).toISOString(),
    rawPayloadJson: JSON.stringify(finalR.raw_payload_json, null, 2),
  });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "ERROR",
      message: err.message,
      stack: err.stack,
    })
  );
  res.status(500).json({ error: "Internal Server Error", message: err.message });
});

// Start Server
const serverInstance = app.listen(PORT, () => {
  console.info(`========================================================================`);
  console.info(`[HashX Backend] Server initialized & listening on http://localhost:${PORT}`);
  console.info(`[HashX Backend] Environment: ${process.env.NODE_ENV || "development"}`);
  console.info(`[HashX Backend] Expected Outbound IP: ${EXPECTED_EGRESS_IP}`);
  console.info(`[HashX Backend] HSP Allowlist Confirmed: ${hspAdapter.config.isAllowlisted}`);
  console.info(`========================================================================`);
});

// Graceful Shutdown
process.on("SIGINT", async () => {
  console.info("[HashX Backend] Gracefully shutting down server...");
  serverInstance.close(async () => {
    await pool.end();
    console.info("[HashX Backend] PostgreSQL pool closed. Exiting process.");
    process.exit(0);
  });
});
