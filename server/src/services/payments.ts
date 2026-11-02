/**
 * Two-stage human-authorized payments and durable settlement reconciliation.
 *
 * State machine (direct Sepolia USDC rail):
 *   AWAITING_SIGNATURE_APPROVAL --(Stage 1: human session approves exact authorization digest)-->
 *   AWAITING_SUBMISSION_APPROVAL --(Stage 2: payer wallet EIP-712 signs HashXPaymentAuthorization)-->
 *   AUTHORIZED --(payer wallet broadcasts transfer; reports tx hash)-->
 *   SUBMITTED --(receipt + matching Transfer log verified via RPC)--> INCLUDED
 *   INCLUDED --(finality policy satisfied)--> CONFIRMED (receipt issued) --(finalized tag)--> FINALIZED
 * Failure exits: FAILED (revert / mismatch), DROPPED (never mined), EXPIRED, CANCELLED.
 *
 * Concurrency: a partial unique index allows at most one non-failed attempt per invoice; every
 * transition is a compare-and-set on (state, row_version). No DB transaction is held across RPC calls.
 */
import { z } from "zod";
import { getAddress } from "viem";
import {
  RECEIPT_SCHEMA,
  authorizationTypedData,
  computeAuthorizationDigest,
  computeReceiptDigest,
  recoverAuthorizationSigner,
  sameAddress,
  typedDataToJson,
  type PaymentAuthorization,
  type ReceiptBody,
} from "../../../shared/protocol.js";
import { findNetwork, formatTokenAmount, getNetwork } from "../../../shared/networks.js";
import { config, describeFinality } from "../config.js";
import { query, withTransaction, type Queryable } from "../db/client.js";
import { hasScope, type Actor } from "../auth/auth.js";
import { ApiError, badRequest, conflict, forbidden, log, notFound, randomBytes32, secureId, unavailable, unixSeconds } from "../lib/core.js";
import { getChainReader, ChainReadError } from "../chain/readers.js";
import { reconcileTransfer, transferInstructions } from "../settlement/sepoliaUsdc.js";
import { hspAdapter } from "../settlement/registry.js";
import { HSPNotConnectedError } from "../settlement/hspAdapter.js";
import { assertBuyer, assertParticipant, evaluateEligibility, loadInvoiceRow } from "./commerce.js";
import { invoiceTermsFromRow, mapPayment, type PaymentState } from "../types.js";
import { recordAudit } from "./audit.js";

const LIVE_EXCLUDED = "('FAILED','DROPPED','EXPIRED','CANCELLED','TIMEOUT')";

function requireScopeOrThrow(actor: Actor, scope: Parameters<typeof hasScope>[1]) {
  if (!hasScope(actor, scope)) throw forbidden("INSUFFICIENT_SCOPE", `Credential lacks scope ${scope}`);
}

function requireHumanActor(actor: Actor) {
  if (actor.kind !== "wallet") throw forbidden("HUMAN_SESSION_REQUIRED", "Financial approvals require an authenticated human wallet session");
}

async function loadAttempt(id: string, db: Queryable = { query: query as any }) {
  if (typeof id !== "string" || id.length > 64) throw notFound("Payment attempt");
  const res = await db.query("SELECT * FROM payment_attempts WHERE id = $1", [id]);
  if (res.rowCount === 0) throw notFound("Payment attempt");
  return res.rows[0];
}

function assertPaymentParticipant(actor: Actor, row: any, inv: any) {
  if (!sameAddress(actor.wallet, row.payer) && !sameAddress(actor.wallet, inv.seller_wallet)) throw notFound("Payment attempt");
}

function assertPayer(actor: Actor, row: any) {
  if (!sameAddress(actor.wallet, row.payer)) throw forbidden("PAYER_ONLY", "Only the authorized payer may perform this action");
}

function authorizationFromRow(row: any): PaymentAuthorization {
  return row.authorization_message as PaymentAuthorization;
}

function view(row: any, extra: Record<string, unknown> = {}) {
  const p = mapPayment(row);
  const out: Record<string, unknown> = { ...p, ...extra };
  if (row.authorization_message) {
    out.authorizationTypedData = typedDataToJson(authorizationTypedData(authorizationFromRow(row)));
    out.approvalSummary = approvalSummary(row);
  }
  if (row.state === "AUTHORIZED" && row.rail === "sepolia-usdc") {
    out.transferInstructions = transferInstructions(row.chain_id, row.token_address, row.payee, BigInt(row.token_total_raw));
  }
  return out;
}

function approvalSummary(row: any) {
  const net = findNetwork(row.chain_id);
  const decimals = row.token_decimals ?? 6;
  return {
    rail: row.rail,
    network: net?.name ?? `chain ${row.chain_id}`,
    chainId: row.chain_id,
    isTestnet: net?.isTestnet ?? null,
    payer: row.payer,
    payee: row.payee,
    tokenAddress: row.token_address,
    tokenSymbol: row.token_symbol,
    tokenLabel: net?.isTestnet ? `Test ${row.token_symbol} (${net.shortName})` : row.token_symbol,
    tokenDecimals: decimals,
    tokenTotalRaw: String(row.token_total_raw),
    humanAmount: `${formatTokenAmount(String(row.token_total_raw), decimals)} ${row.token_symbol}`,
    authorizationDigest: row.authorization_digest,
    authorizationExpiresAt: row.authorization_expires_at ? new Date(row.authorization_expires_at).toISOString() : null,
    invoiceDigest: row.invoice_digest,
    deliveryEvidenceDigest: row.delivery_evidence_digest,
    finalityPolicy: row.finality_policy,
  };
}

/** Lazily expires pre-submission attempts whose authorization window has passed. */
async function expireStale(db: Queryable, invoiceId?: string) {
  await db.query(
    `UPDATE payment_attempts SET state = 'EXPIRED', failure_code = 'AUTHORIZATION_EXPIRED', row_version = row_version + 1, updated_at = NOW()
     WHERE state IN ('AWAITING_SIGNATURE_APPROVAL','AWAITING_SUBMISSION_APPROVAL')
       AND authorization_expires_at < NOW() ${invoiceId ? "AND invoice_id = $1" : ""}`,
    invoiceId ? [invoiceId] : []
  );
}

// ---------------------------------------------------------------------------
// Request payment (creates the immutable obligation to be approved)
// ---------------------------------------------------------------------------

export async function requestPayment(actor: Actor, invoiceId: string, idempotencyKey?: string) {
  requireScopeOrThrow(actor, "payments:request");
  if (idempotencyKey !== undefined && !/^[A-Za-z0-9._:-]{8,128}$/.test(idempotencyKey)) {
    throw badRequest("INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be 8-128 URL-safe characters");
  }
  const inv = await loadInvoiceRow(invoiceId);
  assertBuyer(actor, inv);

  if (inv.settlement_rail === "hashkey-hsp") {
    try {
      hspAdapter().assertAvailable();
    } catch (err) {
      if (err instanceof HSPNotConnectedError) {
        throw unavailable("HSP_NOT_CONNECTED", err.message, { rail: "hashkey-hsp", status: hspAdapter().publicStatus() });
      }
      throw err;
    }
    // Unreachable while settlementAvailable is hard-false; kept explicit for clarity.
    throw unavailable("HSP_NOT_CONNECTED", "HSP settlement is not available");
  }
  if (inv.settlement_rail !== "sepolia-usdc") throw badRequest("UNSUPPORTED_RAIL", "Invoice has no supported settlement rail");

  const chainCfg = config().chains.get(inv.settlement_chain_id);
  if (!chainCfg?.paymentExecutionEnabled || !chainCfg.settlementToken) {
    throw unavailable("SETTLEMENT_DISABLED", `Payment execution is disabled for chain ${inv.settlement_chain_id}`);
  }
  if (!sameAddress(chainCfg.settlementToken.address, inv.token_address)) {
    throw conflict("SETTLEMENT_TERMS_INVALID", "Invoice token is not the configured settlement token");
  }

  await expireStale({ query: query as any }, invoiceId);
  const existing = await query(`SELECT * FROM payment_attempts WHERE invoice_id = $1 AND state NOT IN ${LIVE_EXCLUDED}`, [invoiceId]);
  if (existing.rowCount > 0) return { attempt: view(existing.rows[0]), idempotentReplay: true, status: 200 };

  const elig = await evaluateEligibility(inv);
  if (!elig.eligible) {
    throw new ApiError(409, "PAYMENT_NOT_ELIGIBLE", `Payment blocked by policy: ${elig.reasons.join("; ")}`, { reasons: elig.reasons });
  }
  const del = elig.deliveryRow!;
  const ttl = config().payments.authorizationTtlSeconds;
  const attemptId = secureId("pay");
  const auth: PaymentAuthorization = {
    attemptId,
    invoiceId,
    invoiceDigest: inv.digest,
    deliveryEvidenceDigest: del.manifest_digest,
    payer: getAddress(inv.buyer_wallet),
    payee: getAddress(inv.payee),
    token: getAddress(inv.token_address),
    chainId: inv.settlement_chain_id,
    amount: String(inv.amount_raw),
    settlementRail: inv.settlement_rail,
    nonce: randomBytes32(),
    expiresAt: unixSeconds() + ttl,
  };
  const digest = computeAuthorizationDigest(auth);

  try {
    await withTransaction(async (client) => {
      const lock = await client.query("SELECT status FROM invoices WHERE id = $1 FOR UPDATE", [invoiceId]);
      if (lock.rows[0]?.status !== "DELIVERY_ACCEPTED") throw conflict("PAYMENT_NOT_ELIGIBLE", "Invoice state changed");
      const inserted = await client.query(
        `INSERT INTO payment_attempts (
          id, invoice_id, rail, chain_id, merchant_name, attribution_verified, payer, payee, token_address, token_symbol,
          token_decimals, token_total_raw, state, approval_summary, invoice_digest, delivery_id, delivery_evidence_digest,
          authorization_nonce, authorization_digest, authorization_expires_at, authorization_message, finality_policy,
          idempotency_key, requested_by
        ) VALUES ($1,$2,$3,$4,'HashX',FALSE,$5,$6,$7,$8,$9,$10,'AWAITING_SIGNATURE_APPROVAL','{}'::jsonb,$11,$12,$13,$14,$15,
          to_timestamp($16),$17,$18,$19,$20) RETURNING *`,
        [
          attemptId,
          invoiceId,
          auth.settlementRail,
          auth.chainId,
          auth.payer,
          auth.payee,
          auth.token,
          chainCfg.settlementToken!.symbol,
          chainCfg.settlementToken!.decimals,
          auth.amount,
          auth.invoiceDigest,
          del.id,
          auth.deliveryEvidenceDigest,
          auth.nonce,
          digest,
          auth.expiresAt,
          JSON.stringify(auth),
          describeFinality(chainCfg.finality),
          idempotencyKey ?? null,
          actor.kind === "wallet" ? `wallet:${actor.wallet}` : `agent:${actor.credentialId}`,
        ]
      );
      await client.query(`UPDATE payment_attempts SET approval_summary = $2 WHERE id = $1`, [attemptId, JSON.stringify(approvalSummary(inserted.rows[0]))]);
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      // Lost a race against a concurrent request: return the winner (exactly one live attempt).
      const winner = await query(`SELECT * FROM payment_attempts WHERE invoice_id = $1 AND state NOT IN ${LIVE_EXCLUDED}`, [invoiceId]);
      if (winner.rowCount > 0) return { attempt: view(winner.rows[0]), idempotentReplay: true, status: 200 };
    }
    throw err;
  }
  await recordAudit("PAYMENT", attemptId, actor, "PAYMENT_REQUESTED", { invoiceId, authorizationDigest: digest });
  return { attempt: view(await loadAttempt(attemptId)), idempotentReplay: false, status: 201 };
}

// ---------------------------------------------------------------------------
// Stage 1 — authenticated human approval of the exact obligation
// ---------------------------------------------------------------------------

async function transition(id: string, from: PaymentState[], version: number, set: string, params: unknown[]) {
  const res = await query(
    `UPDATE payment_attempts SET ${set}, row_version = row_version + 1, updated_at = NOW()
     WHERE id = $1 AND state = ANY($2::text[]) AND row_version = $3 RETURNING *`,
    [id, from, version, ...params]
  );
  if (res.rowCount === 0) throw conflict("CONCURRENT_MODIFICATION", "Payment attempt changed concurrently; reload and retry");
  return res.rows[0];
}

function assertNotExpired(row: any) {
  if (new Date(row.authorization_expires_at).getTime() <= Date.now()) {
    throw conflict("AUTHORIZATION_EXPIRED", "Authorization window expired; request a new payment attempt");
  }
}

export async function approveTerms(actor: Actor, attemptId: string, raw: unknown) {
  requireHumanActor(actor);
  const body = z.object({ authorization_digest: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }).safeParse(raw);
  if (!body.success) {
    throw badRequest("AUTHORIZATION_DIGEST_REQUIRED", "Stage 1 requires the exact authorization_digest being approved");
  }
  const row = await loadAttempt(attemptId);
  assertPayer(actor, row);
  if (row.state !== "AWAITING_SIGNATURE_APPROVAL") throw conflict("OUT_OF_SEQUENCE", `Stage 1 not allowed in state ${row.state}`);
  assertNotExpired(row);
  if (computeAuthorizationDigest(authorizationFromRow(row)) !== row.authorization_digest) {
    throw new ApiError(500, "AUTHORIZATION_CORRUPTED", "Stored authorization terms are inconsistent");
  }
  if (body.data.authorization_digest.toLowerCase() !== row.authorization_digest.toLowerCase()) {
    throw conflict("TERMS_MISMATCH", "Approved digest does not match the payment obligation");
  }
  const inv = await loadInvoiceRow(row.invoice_id);
  if (inv.status !== "DELIVERY_ACCEPTED" || inv.digest !== row.invoice_digest) {
    throw conflict("PAYMENT_NOT_ELIGIBLE", "Invoice is no longer payable");
  }

  const updated = await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO approvals (payment_attempt_id, stage, actor, terms_hash, authorization_digest, session_id)
       VALUES ($1, 'STAGE1_TERMS', $2, $3, $3, $4)`,
      [attemptId, actor.wallet, row.authorization_digest, (actor as Extract<Actor, { kind: "wallet" }>).sessionId]
    );
    const res = await client.query(
      `UPDATE payment_attempts SET state = 'AWAITING_SUBMISSION_APPROVAL', row_version = row_version + 1, updated_at = NOW()
       WHERE id = $1 AND state = 'AWAITING_SIGNATURE_APPROVAL' AND row_version = $2 RETURNING *`,
      [attemptId, row.row_version]
    );
    if (res.rowCount === 0) throw conflict("CONCURRENT_MODIFICATION", "Payment attempt changed concurrently");
    return res.rows[0];
  }).catch((err) => {
    if (err?.code === "23505") throw conflict("OUT_OF_SEQUENCE", "Stage 1 already recorded");
    throw err;
  });
  await recordAudit("PAYMENT", attemptId, actor, "STAGE1_TERMS_APPROVED", { authorizationDigest: row.authorization_digest });
  return view(updated);
}

// ---------------------------------------------------------------------------
// Stage 2 — payer wallet signs the full EIP-712 authorization
// ---------------------------------------------------------------------------

export async function authorizePayment(actor: Actor, attemptId: string, raw: unknown) {
  requireHumanActor(actor);
  const body = z.object({ signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/) }).safeParse(raw);
  if (!body.success) throw badRequest("SIGNATURE_REQUIRED", "Stage 2 requires a 65-byte EIP-712 wallet signature");
  const row = await loadAttempt(attemptId);
  assertPayer(actor, row);
  if (row.state !== "AWAITING_SUBMISSION_APPROVAL") throw conflict("OUT_OF_SEQUENCE", `Stage 2 not allowed in state ${row.state}`);
  assertNotExpired(row);

  const stage1 = await query(`SELECT authorization_digest FROM approvals WHERE payment_attempt_id = $1 AND stage = 'STAGE1_TERMS'`, [attemptId]);
  if (stage1.rowCount === 0 || stage1.rows[0].authorization_digest !== row.authorization_digest) {
    throw conflict("STAGE1_APPROVAL_MISSING", "Stage 1 approval for this exact obligation is required first");
  }
  const auth = authorizationFromRow(row);
  if (computeAuthorizationDigest(auth) !== row.authorization_digest) {
    throw new ApiError(500, "AUTHORIZATION_CORRUPTED", "Stored authorization terms are inconsistent");
  }
  const recovered = await recoverAuthorizationSigner(auth, body.data.signature as `0x${string}`);
  if (!sameAddress(recovered, row.payer)) {
    throw forbidden("PAYER_SIGNATURE_MISMATCH", `Authorization signature recovers to ${recovered ?? "nothing"}, not the payer`);
  }

  const updated = await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO approvals (payment_attempt_id, stage, actor, terms_hash, authorization_digest, signature, session_id)
       VALUES ($1, 'STAGE2_WALLET_AUTHORIZATION', $2, $3, $3, $4, $5)`,
      [attemptId, actor.wallet, row.authorization_digest, body.data.signature, (actor as Extract<Actor, { kind: "wallet" }>).sessionId]
    );
    const res = await client.query(
      `UPDATE payment_attempts SET state = 'AUTHORIZED', authorization_signature = $3, row_version = row_version + 1, updated_at = NOW()
       WHERE id = $1 AND state = 'AWAITING_SUBMISSION_APPROVAL' AND row_version = $2 RETURNING *`,
      [attemptId, row.row_version, body.data.signature]
    );
    if (res.rowCount === 0) throw conflict("CONCURRENT_MODIFICATION", "Payment attempt changed concurrently");
    return res.rows[0];
  }).catch((err) => {
    if (err?.code === "23505") throw conflict("OUT_OF_SEQUENCE", "Stage 2 already recorded");
    throw err;
  });
  await recordAudit("PAYMENT", attemptId, actor, "STAGE2_WALLET_AUTHORIZED", { signer: recovered });
  return view(updated);
}

// ---------------------------------------------------------------------------
// Transaction reporting (the payer wallet broadcast; HashX only observes)
// ---------------------------------------------------------------------------

export async function submitTransaction(actor: Actor, attemptId: string, raw: unknown) {
  requireHumanActor(actor);
  const body = z.object({ tx_hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }).safeParse(raw);
  if (!body.success) throw badRequest("INVALID_TX_HASH", "tx_hash must be a 32-byte hex transaction hash");
  const txHash = body.data.tx_hash.toLowerCase();
  const row = await loadAttempt(attemptId);
  assertPayer(actor, row);
  if (row.tx_hash) {
    if (row.tx_hash.toLowerCase() === txHash) return view(row, { idempotentReplay: true });
    throw conflict("TX_ALREADY_REPORTED", "A different transaction is already bound to this attempt");
  }
  if (row.state !== "AUTHORIZED") throw conflict("OUT_OF_SEQUENCE", `Transaction reporting not allowed in state ${row.state}`);

  let updated;
  try {
    updated = await transition(attemptId, ["AUTHORIZED"], row.row_version, "state = 'SUBMITTED', tx_hash = $4, submitted_at = NOW()", [txHash]);
  } catch (err: any) {
    if (err?.code === "23505") throw conflict("TX_ALREADY_BOUND", "This transaction is already bound to another payment obligation");
    throw err;
  }
  await recordAudit("PAYMENT", attemptId, actor, "TX_REPORTED", { txHash });
  // Kick off an immediate, non-blocking reconciliation pass.
  setImmediate(() => reconcileAttempt(attemptId).catch(() => undefined));
  return view(updated);
}

export async function cancelAttempt(actor: Actor, attemptId: string) {
  requireHumanActor(actor);
  const row = await loadAttempt(attemptId);
  assertPayer(actor, row);
  const cancellable =
    ["AWAITING_SIGNATURE_APPROVAL", "AWAITING_SUBMISSION_APPROVAL"].includes(row.state) ||
    (row.state === "AUTHORIZED" && new Date(row.authorization_expires_at).getTime() <= Date.now());
  if (!cancellable) {
    throw conflict("NOT_CANCELLABLE", row.state === "AUTHORIZED" ? "An authorized attempt can be cancelled only after its authorization expires" : `Cannot cancel in state ${row.state}`);
  }
  const updated = await transition(attemptId, [row.state], row.row_version, "state = 'CANCELLED', failure_code = 'CANCELLED_BY_PAYER'", []);
  await recordAudit("PAYMENT", attemptId, actor, "PAYMENT_CANCELLED", {});
  return view(updated);
}

// ---------------------------------------------------------------------------
// Reconciliation (independent on-chain verification)
// ---------------------------------------------------------------------------

export async function reconcileAttempt(attemptId: string): Promise<any> {
  const row = await loadAttempt(attemptId);
  if (!["SUBMITTED", "INCLUDED", "CONFIRMED"].includes(row.state) || row.rail !== "sepolia-usdc") return row;
  const chainCfg = config().chains.get(row.chain_id);
  if (!chainCfg) return row;

  let outcome;
  try {
    const reader = getChainReader(row.chain_id);
    outcome = await reconcileTransfer(
      reader,
      {
        chainId: row.chain_id,
        token: row.token_address,
        payer: row.payer,
        payee: row.payee,
        amount: BigInt(row.token_total_raw),
        txHash: row.tx_hash,
        submittedAt: new Date(row.submitted_at),
      },
      chainCfg,
      config().payments.dropTimeoutSeconds
    );
  } catch (err) {
    const reason = err instanceof ChainReadError ? `${err.code}: ${err.message}` : (err as Error).message;
    await query(
      `UPDATE payment_attempts SET last_reconciled_at = NOW(), reconcile_count = reconcile_count + 1, failure_detail = $2 WHERE id = $1`,
      [attemptId, `Reconciliation deferred (${reason})`]
    );
    return loadAttempt(attemptId);
  }

  try {
    return await withTransaction(async (client) => {
      const cur = await loadAttempt(attemptId, client);
      if (cur.row_version !== row.row_version) return cur; // another worker advanced it
      const base = `last_reconciled_at = NOW(), reconcile_count = reconcile_count + 1, row_version = row_version + 1, updated_at = NOW()`;

      if (outcome.kind === "pending") {
        if (cur.state === "SUBMITTED") {
          const r = await client.query(`UPDATE payment_attempts SET ${base}, failure_detail = $2 WHERE id = $1 RETURNING *`, [attemptId, outcome.reason]);
          return r.rows[0];
        }
        // INCLUDED/CONFIRMED but no longer canonical → reorg: roll back to SUBMITTED and revoke any receipt.
        await client.query(`DELETE FROM settlement_transfers WHERE payment_attempt_id = $1`, [attemptId]).catch(() => undefined);
        if (cur.state === "CONFIRMED") {
          await client.query(`UPDATE receipts SET revoked_at = NOW(), revocation_reason = $2 WHERE payment_attempt_id = $1 AND revoked_at IS NULL`, [attemptId, outcome.reason]);
          await client.query(`UPDATE invoices SET status = 'DELIVERY_ACCEPTED', updated_at = NOW() WHERE id = $1 AND status = 'SETTLED'`, [cur.invoice_id]);
        }
        const r = await client.query(
          `UPDATE payment_attempts SET ${base}, state = 'SUBMITTED', block_number = NULL, block_hash = NULL, log_index = NULL,
             confirmations = 0, included_at = NULL, confirmed_at = NULL, failure_detail = $2 WHERE id = $1 RETURNING *`,
          [attemptId, outcome.reason]
        );
        log("WARN", "settlement_reorg_detected", { attemptId, previousState: cur.state });
        return r.rows[0];
      }

      if (outcome.kind === "dropped" || outcome.kind === "failed") {
        if (cur.state === "CONFIRMED") return cur; // cannot occur for a canonical confirmed receipt; never downgrade silently
        const state = outcome.kind === "dropped" ? "DROPPED" : "FAILED";
        const code = outcome.kind === "dropped" ? "TX_DROPPED" : outcome.code;
        const detail = outcome.kind === "dropped" ? outcome.reason : outcome.detail;
        const r = await client.query(
          `UPDATE payment_attempts SET ${base}, state = $2, failure_code = $3, failure_detail = $4 WHERE id = $1 RETURNING *`,
          [attemptId, state, code, detail]
        );
        return r.rows[0];
      }

      // included
      const settledNow = outcome.policySatisfied;
      const nextState: PaymentState = settledNow ? (outcome.finalized ? "FINALIZED" : "CONFIRMED") : "INCLUDED";
      const r = await client.query(
        `UPDATE payment_attempts SET ${base}, state = $2, block_number = $3, block_hash = $4, log_index = $5, confirmations = $6,
           included_at = COALESCE(included_at, NOW()),
           confirmed_at = CASE WHEN $7 THEN COALESCE(confirmed_at, NOW()) ELSE confirmed_at END,
           finalized_at = CASE WHEN $8 THEN COALESCE(finalized_at, NOW()) ELSE finalized_at END,
           failure_detail = NULL
         WHERE id = $1 RETURNING *`,
        [attemptId, nextState, outcome.blockNumber.toString(), outcome.blockHash, outcome.logIndex, outcome.confirmations, settledNow, settledNow && outcome.finalized]
      );
      const updated = r.rows[0];
      await client.query(
        `INSERT INTO settlement_transfers (payment_attempt_id, chain_id, tx_hash, log_index, token_address, from_address, to_address, amount_raw, block_number, block_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (payment_attempt_id) DO UPDATE SET log_index = EXCLUDED.log_index, block_number = EXCLUDED.block_number,
           block_hash = EXCLUDED.block_hash, verified_at = NOW()`,
        [attemptId, updated.chain_id, updated.tx_hash, outcome.logIndex, updated.token_address, updated.payer, updated.payee, updated.token_total_raw, outcome.blockNumber.toString(), outcome.blockHash]
      );
      if (settledNow) {
        const live = await client.query(`SELECT id FROM receipts WHERE payment_attempt_id = $1 AND revoked_at IS NULL`, [attemptId]);
        if (live.rowCount === 0) await issueReceipt(client, updated);
        await client.query(`UPDATE invoices SET status = 'SETTLED', updated_at = NOW() WHERE id = $1`, [updated.invoice_id]);
      }
      return updated;
    });
  } catch (err: any) {
    if (err?.code === "23505") {
      // The tx is already reconciled to another obligation — never count it twice.
      await query(
        `UPDATE payment_attempts SET state = 'FAILED', failure_code = 'TX_ALREADY_RECONCILED', row_version = row_version + 1, updated_at = NOW()
         WHERE id = $1 AND state IN ('SUBMITTED','INCLUDED')`,
        [attemptId]
      );
      return loadAttempt(attemptId);
    }
    throw err;
  }
}

async function issueReceipt(client: Queryable, attempt: any) {
  const inv = (await client.query("SELECT * FROM invoices WHERE id = $1", [attempt.invoice_id])).rows[0];
  const del = (await client.query("SELECT * FROM deliveries WHERE id = $1", [attempt.delivery_id])).rows[0];
  const run = (
    await client.query(
      `SELECT id FROM verification_runs WHERE object_type = 'DELIVERY' AND object_id = $1 AND decision = 'PASS' ORDER BY created_at DESC LIMIT 1`,
      [del.id]
    )
  ).rows[0];
  const approvals = (await client.query(`SELECT stage, approved_at FROM approvals WHERE payment_attempt_id = $1`, [attempt.id])).rows;
  const at = (stage: string) => new Date(approvals.find((a: any) => a.stage === stage)?.approved_at).toISOString();
  const net = getNetwork(attempt.chain_id);
  const terms = invoiceTermsFromRow(inv);
  const receiptId = secureId("rcpt");

  const body: ReceiptBody = {
    schema: RECEIPT_SCHEMA,
    receiptId,
    issuedAt: new Date().toISOString(),
    network: { chainId: net.chainId, name: net.name, isTestnet: net.isTestnet },
    invoice: { id: inv.id, digest: inv.digest, terms: { ...terms } as unknown as Record<string, string | number>, sellerSignature: inv.signature },
    delivery: {
      id: del.id,
      version: del.version,
      evidenceDigest: del.manifest_digest,
      artifactSha256: del.artifact_sha256_computed,
      manifest: del.manifest,
      manifestSignature: del.manifest_signature,
      verificationRunId: run?.id ?? "",
    },
    authorization: {
      attemptId: attempt.id,
      digest: attempt.authorization_digest,
      message: attempt.authorization_message,
      payerSignature: attempt.authorization_signature,
      stage1ApprovedAt: at("STAGE1_TERMS"),
      stage2AuthorizedAt: at("STAGE2_WALLET_AUTHORIZATION"),
    },
    settlement: {
      rail: attempt.rail,
      chainId: attempt.chain_id,
      token: getAddress(attempt.token_address),
      tokenSymbol: attempt.token_symbol,
      tokenDecimals: attempt.token_decimals,
      isTestToken: net.isTestnet,
      txHash: attempt.tx_hash,
      logIndex: attempt.log_index,
      blockNumber: String(attempt.block_number),
      blockHash: attempt.block_hash,
      from: getAddress(attempt.payer),
      to: getAddress(attempt.payee),
      amount: String(attempt.token_total_raw),
      confirmationsAtIssuance: attempt.confirmations,
      finalityPolicy: attempt.finality_policy,
    },
  };
  const receiptDigest = computeReceiptDigest(body);
  await client.query(
    `INSERT INTO receipts (id, invoice_id, receipt_version, invoice_digest, seller, seller_display_name, buyer_ref,
       delivery_evidence_digest, payment_data, raw_payload_json, receipt_digest, payment_attempt_id, chain_id, tx_hash)
     VALUES ($1,$2,'2',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      receiptId,
      inv.id,
      inv.digest,
      inv.seller_wallet,
      inv.seller_display_name,
      inv.buyer_ref,
      del.manifest_digest,
      JSON.stringify(body.settlement),
      JSON.stringify({ ...body, receiptDigest }),
      receiptDigest,
      attempt.id,
      attempt.chain_id,
      attempt.tx_hash,
    ]
  );
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getPayment(actor: Actor, id: string) {
  requireScopeOrThrow(actor, "payments:read");
  const row = await loadAttempt(id);
  const inv = await loadInvoiceRow(row.invoice_id);
  assertPaymentParticipant(actor, row, inv);
  return view(row, { viewerRole: sameAddress(actor.wallet, row.payer) ? "payer" : "payee-seller" });
}

export async function listPayments(actor: Actor) {
  requireScopeOrThrow(actor, "payments:read");
  await expireStale({ query: query as any });
  const res = await query(
    `SELECT p.* FROM payment_attempts p JOIN invoices i ON i.id = p.invoice_id
     WHERE LOWER(p.payer) = LOWER($1) OR LOWER(i.seller_wallet) = LOWER($1)
     ORDER BY p.created_at DESC LIMIT 500`,
    [actor.wallet]
  );
  return res.rows.map((r) => view(r));
}

export async function getPaymentStatusForInvoice(actor: Actor, invoiceId: string) {
  requireScopeOrThrow(actor, "payments:read");
  const inv = await loadInvoiceRow(invoiceId);
  assertParticipant(actor, inv);
  await expireStale({ query: query as any }, invoiceId);
  const res = await query(`SELECT * FROM payment_attempts WHERE invoice_id = $1 ORDER BY created_at DESC LIMIT 1`, [invoiceId]);
  if (res.rowCount === 0) throw notFound("Payment attempt");
  return view(res.rows[0]);
}

export async function reconcileForActor(actor: Actor, attemptId: string) {
  requireScopeOrThrow(actor, "payments:read");
  const row = await loadAttempt(attemptId);
  const inv = await loadInvoiceRow(row.invoice_id);
  assertPaymentParticipant(actor, row, inv);
  return view(await reconcileAttempt(attemptId));
}

function mapReceipt(r: any) {
  const raw = typeof r.raw_payload_json === "string" ? JSON.parse(r.raw_payload_json) : r.raw_payload_json;
  return {
    id: r.id,
    invoiceId: r.invoice_id,
    receiptVersion: r.receipt_version,
    receiptDigest: r.receipt_digest ?? null,
    invoiceDigest: r.invoice_digest,
    seller: r.seller,
    sellerDisplayName: r.seller_display_name,
    buyerRef: r.buyer_ref,
    deliveryEvidenceDigest: r.delivery_evidence_digest,
    payment: r.payment_data,
    paymentAttemptId: r.payment_attempt_id ?? null,
    chainId: r.chain_id ?? null,
    txHash: r.tx_hash ?? null,
    revokedAt: r.revoked_at ? new Date(r.revoked_at).toISOString() : null,
    revocationReason: r.revocation_reason ?? null,
    legacy: r.receipt_version !== "2",
    issuedAt: new Date(r.issued_at).toISOString(),
    document: raw,
    rawPayloadJson: JSON.stringify(raw, null, 2),
  };
}

export async function getReceiptForInvoice(actor: Actor, invoiceId: string) {
  requireScopeOrThrow(actor, "payments:read");
  const inv = await loadInvoiceRow(invoiceId);
  assertParticipant(actor, inv);
  const res = await query(`SELECT * FROM receipts WHERE invoice_id = $1 ORDER BY issued_at DESC LIMIT 1`, [invoiceId]);
  if (res.rowCount === 0) throw notFound("Receipt (issued only after independently verified settlement)");
  return mapReceipt(res.rows[0]);
}

export async function getReceiptById(actor: Actor, id: string) {
  requireScopeOrThrow(actor, "payments:read");
  const res = await query(`SELECT * FROM receipts WHERE id = $1`, [id]);
  if (res.rowCount === 0) throw notFound("Receipt");
  const inv = await loadInvoiceRow(res.rows[0].invoice_id);
  assertParticipant(actor, inv);
  return mapReceipt(res.rows[0]);
}

export async function listReceipts(actor: Actor) {
  requireScopeOrThrow(actor, "payments:read");
  const res = await query(
    `SELECT r.* FROM receipts r JOIN invoices i ON i.id = r.invoice_id
     WHERE LOWER(i.seller_wallet) = LOWER($1) OR LOWER(i.buyer_wallet) = LOWER($1)
     ORDER BY r.issued_at DESC LIMIT 500`,
    [actor.wallet]
  );
  return res.rows.map(mapReceipt);
}

export async function getStats(actor: Actor) {
  const inv = await query(
    `SELECT status, COUNT(*)::int AS n FROM invoices WHERE protocol_version >= 2 AND (LOWER(seller_wallet) = LOWER($1) OR LOWER(buyer_wallet) = LOWER($1)) GROUP BY status`,
    [actor.wallet]
  );
  const pay = await query(
    `SELECT p.state, COUNT(*)::int AS n, COALESCE(SUM(p.token_total_raw::numeric) FILTER (WHERE p.state IN ('CONFIRMED','FINALIZED')), 0)::text AS settled_raw
     FROM payment_attempts p JOIN invoices i ON i.id = p.invoice_id
     WHERE p.rail IS NOT NULL AND (LOWER(p.payer) = LOWER($1) OR LOWER(i.seller_wallet) = LOWER($1)) GROUP BY p.state`,
    [actor.wallet]
  );
  const runs = await query(
    `SELECT v.decision, COUNT(*)::int AS n FROM verification_runs v
     JOIN deliveries d ON v.object_type = 'DELIVERY' AND d.id = v.object_id JOIN invoices i ON i.id = d.invoice_id
     WHERE LOWER(i.seller_wallet) = LOWER($1) OR LOWER(i.buyer_wallet) = LOWER($1) GROUP BY v.decision`,
    [actor.wallet]
  );
  const receipts = await query(
    `SELECT COUNT(*)::int AS n FROM receipts r JOIN invoices i ON i.id = r.invoice_id
     WHERE r.revoked_at IS NULL AND r.receipt_version = '2' AND (LOWER(i.seller_wallet) = LOWER($1) OR LOWER(i.buyer_wallet) = LOWER($1))`,
    [actor.wallet]
  );
  const settledRaw = pay.rows.reduce((acc, r) => acc + BigInt(r.settled_raw.split(".")[0] || "0"), 0n);
  return {
    source: "backend_persisted",
    invoicesByStatus: Object.fromEntries(inv.rows.map((r) => [r.status, r.n])),
    paymentsByState: Object.fromEntries(pay.rows.map((r) => [r.state, r.n])),
    deliveryVerificationsByDecision: Object.fromEntries(runs.rows.map((r) => [r.decision, r.n])),
    liveReceipts: receipts.rows[0].n,
    settledTestUsdcRaw: settledRaw.toString(),
    settledTestUsdcDisplay: formatTokenAmount(settledRaw, 6),
  };
}

// ---------------------------------------------------------------------------
// Background reconciler (survives restarts: all state lives in PostgreSQL)
// ---------------------------------------------------------------------------

let reconcilerTimer: NodeJS.Timeout | null = null;
let reconcilerBusy = false;

export async function reconcilePendingOnce(limit = 25): Promise<number> {
  await expireStale({ query: query as any });
  const due = await query<{ id: string }>(
    `SELECT id FROM payment_attempts
     WHERE rail = 'sepolia-usdc' AND state IN ('SUBMITTED','INCLUDED','CONFIRMED')
     ORDER BY COALESCE(last_reconciled_at, 'epoch') ASC LIMIT $1`,
    [limit]
  );
  for (const { id } of due.rows) {
    try {
      await reconcileAttempt(id);
    } catch (err) {
      log("WARN", "reconcile_failed", { attemptId: id, error: (err as Error).message });
    }
  }
  return due.rowCount;
}

export function startReconciler() {
  if (reconcilerTimer || !config().payments.reconcilerEnabled) return;
  reconcilerTimer = setInterval(() => {
    if (reconcilerBusy) return;
    reconcilerBusy = true;
    reconcilePendingOnce()
      .catch((err) => log("WARN", "reconciler_tick_failed", { error: (err as Error).message }))
      .finally(() => {
        reconcilerBusy = false;
      });
  }, config().payments.reconcileIntervalMs);
  reconcilerTimer.unref();
}

export function stopReconciler() {
  if (reconcilerTimer) clearInterval(reconcilerTimer);
  reconcilerTimer = null;
}
