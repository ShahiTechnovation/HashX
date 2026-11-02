/**
 * Invoice & delivery service — the single implementation used by HTTP routes and MCP tools.
 * Every function takes an authenticated Actor and enforces actor-level authorization.
 */
import { z } from "zod";
import { getAddress, isAddress, keccak256, toBytes } from "viem";
import {
  ACCEPTANCE_POLICY_EXACT,
  DELIVERY_MANIFEST_SCHEMA,
  SERVICE_TYPE_ADDRESS_ANALYTICS,
  canonicalJson,
  computeArtifactSha256,
  computeBuyerRefHash,
  computeInvoiceDigest,
  computeManifestDigest,
  computeServiceTermsHash,
  invoiceTypedData,
  keccakCanonical,
  manifestTypedData,
  recoverInvoiceSigner,
  sameAddress,
  typedDataToJson,
  type DeliveryManifest,
  type InvoiceTerms,
} from "../../../shared/protocol.js";
import { findNetwork, railSupportsChain, HASHKEY_MAINNET_CHAIN_ID, type SettlementRail } from "../../../shared/networks.js";
import { config } from "../config.js";
import { query, withTransaction } from "../db/client.js";
import { hasScope, type Actor } from "../auth/auth.js";
import { ApiError, badRequest, conflict, forbidden, notFound, randomBytes32, secureId, unixSeconds } from "../lib/core.js";
import { getChainReader, ChainReadError, type ChainReader } from "../chain/readers.js";
import { verifyDeliveryV2, verifyInvoiceV2 } from "./verification.js";
import { invoiceTermsFromRow, mapDelivery, mapInvoice, mapVerificationRun, type VerificationResult } from "../types.js";
import { recordAudit } from "./audit.js";

const addr = z.string().refine((v) => isAddress(v), "must be an EVM address");
const intString = z.string().regex(/^[1-9]\d{0,40}$/, "must be a positive integer string");
const blockString = z.union([z.string().regex(/^\d{1,12}$/), z.number().int().nonnegative()]).transform((v) => String(v));

export const CreateInvoiceInput = z
  .object({
    client_request_id: z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/),
    buyer_wallet: addr,
    buyer_ref: z.string().min(1).max(255),
    service: z
      .object({
        type: z.literal(SERVICE_TYPE_ADDRESS_ANALYTICS),
        delivery_chain_id: z.number().int().positive(),
        parameters: z.object({ address: addr, start_block: blockString, end_block: blockString }).strict(),
        acceptance_policy: z.literal(ACCEPTANCE_POLICY_EXACT),
      })
      .strict(),
    payment: z
      .object({
        rail: z.enum(["sepolia-usdc", "hashkey-hsp"]),
        settlement_chain_id: z.number().int().positive(),
        amount_raw: intString,
        payee: addr,
        token_address: addr.optional(),
      })
      .strict(),
    expires_in_seconds: z.number().int().min(300).max(30 * 86400).optional(),
  })
  .strict();
export type CreateInvoiceInput = z.infer<typeof CreateInvoiceInput>;

const MAX_AMOUNT_RAW = 10n ** 15n;

// ---------------------------------------------------------------------------
// Loading & authorization
// ---------------------------------------------------------------------------

export async function loadInvoiceRow(id: string): Promise<any> {
  if (typeof id !== "string" || id.length > 64) throw notFound("Invoice");
  const res = await query("SELECT * FROM invoices WHERE id = $1", [id]);
  if (res.rowCount === 0) throw notFound("Invoice");
  return res.rows[0];
}

export function participantRole(actor: Actor, row: any): "seller" | "buyer" | null {
  if (sameAddress(actor.wallet, row.seller_wallet)) return "seller";
  if (sameAddress(actor.wallet, row.buyer_wallet)) return "buyer";
  return null;
}

/** Non-participants receive 404 (no existence oracle). */
export function assertParticipant(actor: Actor, row: any) {
  const role = participantRole(actor, row);
  if (!role) throw notFound("Invoice");
  return role;
}

export function assertSeller(actor: Actor, row: any) {
  const role = assertParticipant(actor, row);
  if (role !== "seller") throw forbidden("SELLER_ONLY", "Only the invoice seller may perform this action");
}

export function assertBuyer(actor: Actor, row: any) {
  const role = assertParticipant(actor, row);
  if (role !== "buyer") throw forbidden("BUYER_ONLY", "Only the invoice buyer may perform this action");
}

function requireScopeOrThrow(actor: Actor, scope: Parameters<typeof hasScope>[1]) {
  if (!hasScope(actor, scope)) throw forbidden("INSUFFICIENT_SCOPE", `Credential lacks scope ${scope}`);
}

export async function getInvoice(actor: Actor, id: string) {
  requireScopeOrThrow(actor, "invoices:read");
  const row = await loadInvoiceRow(id);
  assertParticipant(actor, row);
  return { ...mapInvoice(row), viewerRole: participantRole(actor, row) };
}

export async function listInvoices(actor: Actor) {
  requireScopeOrThrow(actor, "invoices:read");
  const res = await query(
    `SELECT * FROM invoices WHERE LOWER(seller_wallet) = LOWER($1) OR LOWER(buyer_wallet) = LOWER($1)
     ORDER BY created_at DESC LIMIT 500`,
    [actor.wallet]
  );
  return res.rows.map((r) => ({ ...mapInvoice(r), viewerRole: participantRole(actor, r) }));
}

// ---------------------------------------------------------------------------
// Create (idempotent) & sign
// ---------------------------------------------------------------------------

export async function createInvoice(actor: Actor, raw: unknown) {
  requireScopeOrThrow(actor, "invoices:write");
  const parsed = CreateInvoiceInput.safeParse(raw);
  if (!parsed.success) throw badRequest("INVALID_INVOICE_PAYLOAD", "Invalid invoice payload", parsed.error.flatten());
  const input = parsed.data;
  const cfg = config();

  const seller = actor.wallet;
  const buyer = getAddress(input.buyer_wallet);
  const payee = getAddress(input.payment.payee);
  if (sameAddress(seller, buyer)) throw badRequest("SELF_DEALING", "Seller and buyer must be different wallets");
  if (/^0x0{40}$/i.test(payee)) throw badRequest("INVALID_PAYEE", "Payee cannot be the zero address");

  // Settlement chain & rail: explicit, never defaulted.
  const rail = input.payment.rail as SettlementRail;
  const chainId = input.payment.settlement_chain_id;
  const net = findNetwork(chainId);
  const chainCfg = cfg.chains.get(chainId);
  if (!net || !chainCfg) throw badRequest("UNSUPPORTED_CHAIN", `Settlement chain ${chainId} is not supported`);
  if (!railSupportsChain(rail, chainId)) throw badRequest("RAIL_CHAIN_MISMATCH", `Rail ${rail} cannot settle on chain ${chainId}`);
  if (chainId === HASHKEY_MAINNET_CHAIN_ID) {
    throw badRequest("MAINNET_PAYMENTS_DISABLED", "HashKey Mainnet payment execution is disabled");
  }

  let token: `0x${string}`;
  let tokenSymbol: string;
  let tokenDecimals: number;
  if (rail === "sepolia-usdc") {
    if (!chainCfg.settlementToken) throw badRequest("SETTLEMENT_TOKEN_UNCONFIGURED", `No settlement token configured for chain ${chainId}`);
    if (input.payment.token_address && !sameAddress(input.payment.token_address, chainCfg.settlementToken.address)) {
      throw badRequest("TOKEN_NOT_ALLOWED", "Only the configured official test USDC token is accepted on this rail");
    }
    token = chainCfg.settlementToken.address;
    tokenSymbol = chainCfg.settlementToken.symbol;
    tokenDecimals = chainCfg.settlementToken.decimals;
  } else {
    if (!input.payment.token_address) throw badRequest("TOKEN_REQUIRED", "token_address is required for the HSP rail");
    token = getAddress(input.payment.token_address);
    tokenSymbol = "HSP-TOKEN";
    tokenDecimals = 6;
  }

  const amount = BigInt(input.payment.amount_raw);
  if (amount <= 0n || amount > MAX_AMOUNT_RAW) throw badRequest("INVALID_AMOUNT", "amount_raw out of accepted bounds");

  // Delivery verification feasibility is enforced up front: an unverifiable invoice is never created.
  const deliveryNet = findNetwork(input.service.delivery_chain_id);
  if (!deliveryNet?.deliveryVerificationSupported || !cfg.chains.has(input.service.delivery_chain_id)) {
    throw badRequest("UNSUPPORTED_DELIVERY_CHAIN", `Delivery chain ${input.service.delivery_chain_id} is not supported`);
  }
  const start = BigInt(input.service.parameters.start_block);
  const end = BigInt(input.service.parameters.end_block);
  if (end < start) throw badRequest("INVALID_BLOCK_RANGE", "end_block must be >= start_block");
  if (end - start + 1n > BigInt(cfg.delivery.maxBlockRange)) {
    throw badRequest("RANGE_UNSUPPORTED", `Block range exceeds verifier limit of ${cfg.delivery.maxBlockRange} blocks`);
  }

  const subject = getAddress(input.service.parameters.address);
  const serviceParams = {
    type: input.service.type,
    delivery_chain_id: input.service.delivery_chain_id,
    parameters: { address: subject, start_block: start.toString(), end_block: end.toString() },
    acceptance_policy: input.service.acceptance_policy,
  };
  const requestHash = keccakCanonical({ ...input, buyer_wallet: buyer, payment: { ...input.payment, payee }, service: serviceParams });

  const cp = await query("SELECT id, display_name FROM counterparties WHERE id = $1", [actor.counterpartyId]);
  if (cp.rowCount === 0) throw forbidden("SELLER_UNBOUND", "Seller account not found");

  const existing = await findByClientRequest(actor.counterpartyId, input.client_request_id);
  if (existing) return replayOrConflict(existing, requestHash);

  const now = unixSeconds();
  const terms: InvoiceTerms = {
    invoiceId: secureId("inv"),
    version: 1,
    seller,
    buyer,
    buyerRefHash: computeBuyerRefHash(input.buyer_ref),
    serviceType: input.service.type,
    serviceTermsHash: computeServiceTermsHash({
      serviceType: input.service.type,
      deliveryChainId: input.service.delivery_chain_id,
      subjectAddress: subject,
      startBlock: start,
      endBlock: end,
      acceptancePolicy: input.service.acceptance_policy,
    }),
    deliveryChainId: input.service.delivery_chain_id,
    settlementRail: rail,
    settlementChainId: chainId,
    token,
    amount: amount.toString(),
    payee,
    nonce: randomBytes32(),
    issuedAt: now,
    expiresAt: now + (input.expires_in_seconds ?? 86400),
    signingChainId: chainId,
  };
  const digest = computeInvoiceDigest(terms);

  try {
    await query(
      `INSERT INTO invoices (
        id, version, protocol_version, client_request_id, request_hash, seller_id, seller_wallet, seller_display_name,
        buyer_wallet, buyer_ref, buyer_ref_hash, service_type, service_params, service_terms_hash,
        currency, payee, preferred_chain_id, signing_chain_id, delivery_chain_id, settlement_rail, settlement_chain_id,
        token_address, token_symbol, token_decimals, amount_raw, nonce, digest, status, issued_at, expires_at, created_by
      ) VALUES ($1,1,2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15,$16,$17,$15,$18,$19,$20,$21,$22,$23,'DRAFT',
        to_timestamp($24), to_timestamp($25), $26)`,
      [
        terms.invoiceId,
        input.client_request_id,
        requestHash,
        actor.counterpartyId,
        seller,
        cp.rows[0].display_name,
        buyer,
        input.buyer_ref,
        terms.buyerRefHash,
        terms.serviceType,
        JSON.stringify(serviceParams),
        terms.serviceTermsHash,
        tokenSymbol,
        payee,
        chainId,
        terms.deliveryChainId,
        rail,
        token,
        tokenSymbol,
        tokenDecimals,
        amount.toString(),
        terms.nonce,
        digest,
        terms.issuedAt,
        terms.expiresAt,
        actor.kind === "wallet" ? `wallet:${actor.wallet}` : `agent:${actor.credentialId}`,
      ]
    );
  } catch (err: any) {
    // Concurrent duplicate create with the same client_request_id: the unique index decides.
    if (err?.code === "23505") {
      const winner = await findByClientRequest(actor.counterpartyId, input.client_request_id);
      if (winner) return replayOrConflict(winner, requestHash);
    }
    throw err;
  }

  const row = await loadInvoiceRow(terms.invoiceId);
  await recordAudit("INVOICE", terms.invoiceId, actor, "INVOICE_CREATED", { digest });
  return { invoice: mapInvoice(row), typedData: typedDataToJson(invoiceTypedData(terms)), idempotentReplay: false, status: 201 };
}

async function findByClientRequest(sellerId: string, clientRequestId: string) {
  const res = await query(
    `SELECT * FROM invoices WHERE seller_id = $1 AND client_request_id = $2 AND protocol_version >= 2`,
    [sellerId, clientRequestId]
  );
  return res.rows[0] ?? null;
}

function replayOrConflict(row: any, requestHash: string) {
  if (row.request_hash !== requestHash) {
    throw conflict("IDEMPOTENCY_KEY_REUSED", "client_request_id was already used with a different request body", {
      invoiceId: row.id,
    });
  }
  return {
    invoice: mapInvoice(row),
    typedData: typedDataToJson(invoiceTypedData(invoiceTermsFromRow(row))),
    idempotentReplay: true,
    status: 200,
  };
}

export async function getInvoiceTypedData(actor: Actor, id: string) {
  requireScopeOrThrow(actor, "invoices:read");
  const row = await loadInvoiceRow(id);
  assertParticipant(actor, row);
  if (row.protocol_version < 2) throw badRequest("LEGACY_PROTOCOL", "Legacy v1 invoices cannot be signed");
  return { digest: row.digest, typedData: typedDataToJson(invoiceTypedData(invoiceTermsFromRow(row))) };
}

export async function signInvoice(actor: Actor, id: string, signature: unknown) {
  requireScopeOrThrow(actor, "invoices:write");
  if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    throw badRequest("INVALID_SIGNATURE_PAYLOAD", "A 65-byte hex EIP-712 signature is required");
  }
  const row = await loadInvoiceRow(id);
  assertSeller(actor, row);
  if (row.protocol_version < 2) throw badRequest("LEGACY_PROTOCOL", "Legacy v1 invoices cannot be signed");
  if (row.status !== "DRAFT") throw conflict("INVALID_STATE", `Invoice is ${row.status}; only DRAFT invoices can be signed`);
  if (new Date(row.expires_at).getTime() <= Date.now()) throw conflict("INVOICE_EXPIRED", "Invoice has expired");

  const terms = invoiceTermsFromRow(row);
  if (computeInvoiceDigest(terms) !== row.digest) throw new ApiError(500, "TERMS_MUTATED", "Stored invoice terms are inconsistent");
  const recovered = await recoverInvoiceSigner(terms, signature as `0x${string}`);
  if (!sameAddress(recovered, row.seller_wallet)) {
    throw forbidden("INVALID_EIP712_SIGNATURE", "Signature does not recover to the seller wallet over the canonical invoice terms");
  }
  const upd = await query(
    `UPDATE invoices SET signature = $1, signer = $2, status = 'SIGNED', updated_at = NOW() WHERE id = $3 AND status = 'DRAFT'`,
    [signature, recovered, id]
  );
  if (upd.rowCount === 0) throw conflict("INVALID_STATE", "Invoice state changed concurrently");
  await recordAudit("INVOICE", id, actor, "INVOICE_SIGNED", { signer: recovered });
  return mapInvoice(await loadInvoiceRow(id));
}

// ---------------------------------------------------------------------------
// Verification persistence
// ---------------------------------------------------------------------------

async function persistRun(result: VerificationResult, actor: Actor): Promise<VerificationResult> {
  const res = await query(
    `INSERT INTO verification_runs (object_type, object_id, verifier_version, decision, checks, check_details, reason_codes,
       evidence_digest, rpc_endpoint_used, input_digest, evidence_sources, chain_id, observed_block, payable, triggered_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id, created_at`,
    [
      result.objectType,
      result.objectId,
      result.verifierVersion,
      result.decision,
      JSON.stringify(result.checks),
      JSON.stringify(result.checkDetails),
      JSON.stringify(result.reasonCodes),
      result.evidenceDigest ?? null,
      result.evidenceSources.find((s) => s.rpc)?.rpc ?? null,
      result.inputDigest,
      JSON.stringify(result.evidenceSources),
      result.chainId ?? null,
      result.observedBlock ?? null,
      result.payable,
      actor.kind === "wallet" ? `wallet:${actor.wallet}` : `agent:${actor.credentialId}`,
    ]
  );
  return { ...result, runId: res.rows[0].id, verifiedAt: new Date(res.rows[0].created_at).toISOString() };
}

export async function verifyInvoice(actor: Actor, id: string) {
  requireScopeOrThrow(actor, "verification:run");
  const row = await loadInvoiceRow(id);
  assertParticipant(actor, row);
  const cp = await query("SELECT status, wallet_verified_at FROM counterparties WHERE id = $1", [row.seller_id]);
  const reuse = await query(
    "SELECT id FROM invoices WHERE seller_id = $1 AND nonce = $2 AND id <> $3",
    [row.seller_id, row.nonce, row.id]
  );
  const result = await verifyInvoiceV2({
    row,
    sellerCounterparty: cp.rows[0] ?? null,
    nonceReusedBy: reuse.rows.map((r) => r.id),
    cfg: config(),
  });
  const saved = await persistRun(result, actor);
  if (result.decision === "PASS") {
    await query(`UPDATE invoices SET status = 'VERIFIED', updated_at = NOW() WHERE id = $1 AND status = 'SIGNED'`, [id]);
  } else if (result.decision === "FAIL") {
    await query(`UPDATE invoices SET status = 'REJECTED', updated_at = NOW() WHERE id = $1 AND status IN ('DRAFT','SIGNED','VERIFIED')`, [id]);
  }
  await recordAudit("INVOICE", id, actor, `INVOICE_VERIFICATION_${result.decision}`, { runId: saved.runId, reasons: result.reasonCodes });
  return saved;
}

export async function latestRun(objectType: "INVOICE" | "DELIVERY", objectId: string): Promise<VerificationResult | null> {
  const res = await query(
    `SELECT * FROM verification_runs WHERE object_type = $1 AND object_id = $2 ORDER BY created_at DESC, id DESC LIMIT 1`,
    [objectType, objectId]
  );
  return res.rows[0] ? mapVerificationRun(res.rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Deliveries
// ---------------------------------------------------------------------------

const SubmitDeliveryInput = z
  .object({
    artifact_uri: z.string().min(1).max(512),
    artifact_content: z.record(z.unknown()),
    manifest: z
      .object({
        schema: z.string(),
        invoiceId: z.string(),
        invoiceDigest: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
        seller: addr,
        deliveryVersion: z.number().int().positive(),
        deliveryChainId: z.number().int().positive(),
        serviceTermsHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
        artifactSha256: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
        artifactUri: z.string().max(512),
        generatedAt: z.number().int().positive(),
      })
      .strict(),
    manifest_signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
  })
  .strict();

async function nextDeliveryVersion(invoiceId: string): Promise<number> {
  const res = await query("SELECT COALESCE(MAX(version), 0) AS v FROM deliveries WHERE invoice_id = $1", [invoiceId]);
  return Number(res.rows[0].v) + 1;
}

async function assertDeliverable(row: any) {
  if (row.protocol_version < 2) throw badRequest("LEGACY_PROTOCOL", "Legacy v1 invoices cannot receive v2 deliveries");
  if (!["VERIFIED", "DELIVERY_REJECTED"].includes(row.status)) {
    throw conflict("INVALID_STATE", `Delivery requires a VERIFIED invoice (current: ${row.status})`);
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) throw conflict("INVOICE_EXPIRED", "Invoice has expired");
  const run = await latestRun("INVOICE", row.id);
  if (!run || run.decision !== "PASS") throw conflict("INVOICE_NOT_VERIFIED", "Latest invoice verification is not PASS");
}

/** Builds the exact manifest the seller wallet must sign for an artifact. */
export async function prepareDelivery(actor: Actor, id: string, raw: unknown) {
  requireScopeOrThrow(actor, "deliveries:write");
  const body = z.object({ artifact_uri: z.string().min(1).max(512), artifact_content: z.record(z.unknown()) }).strict().safeParse(raw);
  if (!body.success) throw badRequest("INVALID_DELIVERY_PAYLOAD", "Invalid delivery payload", body.error.flatten());
  const row = await loadInvoiceRow(id);
  assertSeller(actor, row);
  await assertDeliverable(row);
  let sha: `0x${string}`;
  try {
    sha = computeArtifactSha256(body.data.artifact_content);
  } catch (err) {
    throw badRequest("ARTIFACT_NOT_CANONICAL", (err as Error).message);
  }
  const manifest: DeliveryManifest = {
    schema: DELIVERY_MANIFEST_SCHEMA,
    invoiceId: row.id,
    invoiceDigest: row.digest,
    seller: getAddress(row.seller_wallet),
    deliveryVersion: await nextDeliveryVersion(row.id),
    deliveryChainId: row.delivery_chain_id,
    serviceTermsHash: row.service_terms_hash,
    artifactSha256: sha,
    artifactUri: body.data.artifact_uri,
    generatedAt: unixSeconds(),
  };
  return {
    manifest,
    artifactSha256: sha,
    canonicalArtifact: canonicalJson(body.data.artifact_content),
    typedData: typedDataToJson(manifestTypedData(manifest, row.signing_chain_id)),
  };
}

export async function submitDelivery(actor: Actor, id: string, raw: unknown) {
  requireScopeOrThrow(actor, "deliveries:write");
  const parsed = SubmitDeliveryInput.safeParse(raw);
  if (!parsed.success) throw badRequest("INVALID_DELIVERY_PAYLOAD", "Invalid delivery payload", parsed.error.flatten());
  const input = parsed.data;
  const row = await loadInvoiceRow(id);
  assertSeller(actor, row);
  await assertDeliverable(row);

  let computedSha: string;
  try {
    computedSha = computeArtifactSha256(input.artifact_content);
  } catch (err) {
    throw badRequest("ARTIFACT_NOT_CANONICAL", (err as Error).message);
  }
  const manifest = { ...input.manifest, seller: getAddress(input.manifest.seller) } as DeliveryManifest;
  const manifestDigest = computeManifestDigest(manifest, row.signing_chain_id);
  const delId = secureId("del");

  try {
    await withTransaction(async (client) => {
      await client.query("SELECT id FROM invoices WHERE id = $1 FOR UPDATE", [id]);
      const v = await client.query("SELECT COALESCE(MAX(version), 0) AS v FROM deliveries WHERE invoice_id = $1", [id]);
      const expected = Number(v.rows[0].v) + 1;
      if (manifest.deliveryVersion !== expected) {
        throw conflict("DELIVERY_VERSION_CONFLICT", `Manifest deliveryVersion must be ${expected}`);
      }
      // Commitments are stored as submitted; mismatches are judged (and recorded) by the verifier.
      await client.query(
        `INSERT INTO deliveries (id, invoice_id, version, artifact_uri, artifact_sha256, artifact_sha256_computed, manifest,
           manifest_signature, manifest_digest, artifact_content, status, submitted_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'PENDING_VERIFICATION',$11)`,
        [
          delId,
          id,
          expected,
          input.artifact_uri,
          manifest.artifactSha256,
          computedSha,
          JSON.stringify(manifest),
          input.manifest_signature,
          manifestDigest,
          JSON.stringify(input.artifact_content),
          actor.kind === "wallet" ? `wallet:${actor.wallet}` : `agent:${actor.credentialId}`,
        ]
      );
      await client.query(`UPDATE invoices SET status = 'DELIVERED', updated_at = NOW() WHERE id = $1`, [id]);
    });
  } catch (err: any) {
    if (err?.code === "23505") throw conflict("EVIDENCE_REUSED", "This signed manifest has already been submitted");
    throw err;
  }
  await recordAudit("DELIVERY", delId, actor, "DELIVERY_SUBMITTED", { invoiceId: id, manifestDigest });
  const d = await query("SELECT * FROM deliveries WHERE id = $1", [delId]);
  return mapDelivery(d.rows[0]);
}

export async function latestDeliveryRow(invoiceId: string) {
  const res = await query("SELECT * FROM deliveries WHERE invoice_id = $1 ORDER BY version DESC LIMIT 1", [invoiceId]);
  return res.rows[0] ?? null;
}

export async function getLatestDelivery(actor: Actor, invoiceId: string) {
  requireScopeOrThrow(actor, "invoices:read");
  const row = await loadInvoiceRow(invoiceId);
  assertParticipant(actor, row);
  const d = await latestDeliveryRow(invoiceId);
  if (!d) throw notFound("Delivery");
  return mapDelivery(d);
}

export async function listDeliveries(actor: Actor) {
  requireScopeOrThrow(actor, "invoices:read");
  const res = await query(
    `SELECT d.* FROM deliveries d JOIN invoices i ON i.id = d.invoice_id
     WHERE LOWER(i.seller_wallet) = LOWER($1) OR LOWER(i.buyer_wallet) = LOWER($1)
     ORDER BY d.submitted_at DESC LIMIT 500`,
    [actor.wallet]
  );
  return res.rows.map(mapDelivery);
}

export async function verifyDelivery(actor: Actor, invoiceId: string, readerOverride?: ChainReader) {
  requireScopeOrThrow(actor, "verification:run");
  const inv = await loadInvoiceRow(invoiceId);
  assertParticipant(actor, inv);
  const del = await latestDeliveryRow(invoiceId);
  if (!del) throw notFound("Delivery");

  let reader: ChainReader | null = readerOverride ?? null;
  let readerError: ChainReadError | undefined;
  if (!reader) {
    try {
      reader = getChainReader(inv.delivery_chain_id);
    } catch (err) {
      readerError = err instanceof ChainReadError ? err : new ChainReadError("RPC_UNAVAILABLE", String(err));
    }
  }
  // RPC work happens outside any database transaction.
  const result = await verifyDeliveryV2({ invoiceRow: inv, deliveryRow: del, reader, readerError, cfg: config() });
  const saved = await persistRun(result, actor);

  if (result.decision !== "PENDING") {
    const accepted = result.decision === "PASS";
    await withTransaction(async (client) => {
      // Only the still-latest delivery may move the invoice state.
      const latest = await client.query(
        "SELECT id FROM deliveries WHERE invoice_id = $1 ORDER BY version DESC LIMIT 1 FOR UPDATE",
        [invoiceId]
      );
      if (latest.rows[0]?.id !== del.id) return;
      await client.query("UPDATE deliveries SET status = $1 WHERE id = $2", [accepted ? "ACCEPTED" : "REJECTED", del.id]);
      await client.query(
        `UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2 AND status IN ('DELIVERED','DELIVERY_ACCEPTED','DELIVERY_REJECTED')`,
        [accepted ? "DELIVERY_ACCEPTED" : "DELIVERY_REJECTED", invoiceId]
      );
    });
  }
  await recordAudit("DELIVERY", del.id, actor, `DELIVERY_VERIFICATION_${result.decision}`, { runId: saved.runId, reasons: result.reasonCodes });
  return saved;
}

// ---------------------------------------------------------------------------
// Eligibility (authoritative)
// ---------------------------------------------------------------------------

export interface Eligibility {
  eligible: boolean;
  reasons: string[];
  invoiceRun: VerificationResult | null;
  deliveryRun: VerificationResult | null;
  deliveryRow: any | null;
}

/** Payment eligibility requires fresh, input-matched PASS runs for both invoice and the accepted delivery. */
export async function evaluateEligibility(inv: any): Promise<Eligibility> {
  const reasons: string[] = [];
  const ttlMs = config().delivery.verificationTtlSeconds * 1000;
  if (inv.protocol_version < 2) reasons.push("Legacy v1 invoice");
  if (inv.status !== "DELIVERY_ACCEPTED") reasons.push(`Invoice status is ${inv.status}, required DELIVERY_ACCEPTED`);
  if (new Date(inv.expires_at).getTime() <= Date.now()) reasons.push("Invoice expired");

  const invoiceRun = await latestRun("INVOICE", inv.id);
  const expectedInvoiceInput = keccak256(toBytes(`${inv.digest}:${inv.signature ?? "unsigned"}`));
  if (!invoiceRun || invoiceRun.decision !== "PASS" || !invoiceRun.payable) reasons.push("Latest invoice verification is not PASS");
  else if (invoiceRun.inputDigest !== expectedInvoiceInput) reasons.push("Invoice verification input does not match current invoice");

  const del = await latestDeliveryRow(inv.id);
  let deliveryRun: VerificationResult | null = null;
  if (!del) reasons.push("No delivery submitted");
  else {
    if (del.status !== "ACCEPTED") reasons.push(`Latest delivery status is ${del.status}`);
    deliveryRun = await latestRun("DELIVERY", del.id);
    if (!deliveryRun || deliveryRun.decision !== "PASS" || !deliveryRun.payable) reasons.push("Latest delivery verification is not PASS");
    else {
      if (deliveryRun.evidenceDigest !== del.manifest_digest) reasons.push("Delivery verification evidence does not match current delivery");
      if (Date.now() - new Date(deliveryRun.verifiedAt).getTime() > ttlMs) reasons.push("Delivery verification is stale; re-verify");
    }
  }
  return { eligible: reasons.length === 0, reasons, invoiceRun, deliveryRun, deliveryRow: del };
}

export async function getVerificationSummary(actor: Actor, invoiceId: string) {
  requireScopeOrThrow(actor, "invoices:read");
  const inv = await loadInvoiceRow(invoiceId);
  assertParticipant(actor, inv);
  const e = await evaluateEligibility(inv);
  const invoiceDecision = e.invoiceRun?.decision ?? "PENDING";
  const deliveryDecision = e.deliveryRow ? e.deliveryRun?.decision ?? "PENDING" : undefined;
  const overallDecision =
    invoiceDecision === "FAIL" || deliveryDecision === "FAIL" ? "FAIL" : e.eligible ? "PASS" : "PENDING";
  return {
    invoiceId,
    invoiceDecision,
    deliveryDecision,
    overallDecision,
    isEligibleForPayment: e.eligible,
    eligibilityExplanation: e.eligible
      ? "Invoice signature and delivery facts independently verified; payment may be requested by the buyer."
      : `Not payable: ${e.reasons.join("; ")}`,
    blockingReasons: e.reasons,
    invoiceVerification: e.invoiceRun,
    deliveryVerification: e.deliveryRun,
    provenance: "backend_persisted",
  };
}
