/**
 * Wallet authentication (EIP-4361 / SIWE), short-lived bearer sessions, and
 * scoped service-to-service agent credentials.
 *
 * Trust model:
 *  - A wallet address is trusted only after it signs a server-issued, single-use
 *    SIWE nonce for an allowed domain/origin. Headers such as x-wallet-address are ignored.
 *  - Bearer tokens are random 256-bit secrets; only their SHA-256 is stored.
 *  - Agent credentials act for the wallet that minted them, limited to explicit scopes.
 *    They can never perform human approvals (Stage 1 / Stage 2 / transaction reporting).
 */
import type { NextFunction, Request, Response } from "express";
import { getAddress, isAddress, recoverMessageAddress } from "viem";
import { generateSiweNonce, parseSiweMessage } from "viem/siwe";
import { config } from "../config.js";
import { query, withTransaction } from "../db/client.js";
import { findNetwork, isPublicNetwork, type Address } from "../../../shared/networks.js";
import { ApiError, forbidden, randomToken, sha256Hex, unauthorized } from "../lib/core.js";

export const AGENT_SCOPES = [
  "invoices:read",
  "invoices:write",
  "deliveries:write",
  "verification:run",
  "payments:request",
  "payments:read",
] as const;
export type AgentScope = (typeof AGENT_SCOPES)[number];

export type Actor =
  | { kind: "wallet"; wallet: Address; counterpartyId: string; sessionId: string }
  | { kind: "agent"; wallet: Address; counterpartyId: string; credentialId: string; scopes: AgentScope[] };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: Actor;
      requestId?: string;
    }
  }
}

const SESSION_PREFIX = "hx_sess_";
const AGENT_PREFIX = "hx_agent_";
const CLOCK_SKEW_MS = 60_000;

// ---------------------------------------------------------------------------
// Nonces
// ---------------------------------------------------------------------------

export async function issueNonce(): Promise<{ nonce: string; expiresAt: string }> {
  const nonce = generateSiweNonce(); // 96 chars of cryptographic randomness, alphanumeric
  const ttl = config().nonceTtlSeconds;
  const res = await query<{ expires_at: Date }>(
    `INSERT INTO auth_nonces (nonce, expires_at) VALUES ($1, NOW() + ($2 || ' seconds')::interval) RETURNING expires_at`,
    [nonce.slice(0, 64), String(ttl)]
  );
  // Opportunistic cleanup of stale nonces.
  query("DELETE FROM auth_nonces WHERE expires_at < NOW() - INTERVAL '1 day'").catch(() => undefined);
  return { nonce: nonce.slice(0, 64), expiresAt: new Date(res.rows[0].expires_at).toISOString() };
}

// ---------------------------------------------------------------------------
// SIWE verification → session
// ---------------------------------------------------------------------------

export interface SessionResult {
  token: string;
  expiresAt: string;
  address: Address;
  counterpartyId: string;
  displayName: string;
}

export async function verifySiweAndCreateSession(message: string, signature: `0x${string}`): Promise<SessionResult> {
  const cfg = config();
  if (typeof message !== "string" || message.length > 4096) throw new ApiError(400, "SIWE_INVALID", "Malformed SIWE message");
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new ApiError(400, "SIWE_INVALID", "Malformed signature");

  const parsed = parseSiweMessage(message);
  if (!parsed.address || !parsed.domain || !parsed.nonce || !parsed.uri || !parsed.chainId || !parsed.issuedAt) {
    throw new ApiError(400, "SIWE_INVALID", "SIWE message is missing required fields");
  }
  if (parsed.version !== "1") throw new ApiError(400, "SIWE_INVALID", "Unsupported SIWE version");

  // Domain & origin binding: never derived from Host / X-Forwarded-* headers.
  if (!cfg.siweDomains.includes(parsed.domain)) {
    throw forbidden("SIWE_DOMAIN_MISMATCH", `SIWE domain "${parsed.domain}" is not accepted by this API`);
  }
  let uriOrigin: string;
  try {
    uriOrigin = new URL(parsed.uri).origin;
  } catch {
    throw new ApiError(400, "SIWE_INVALID", "SIWE uri is not a valid URL");
  }
  if (!cfg.allowedOrigins.includes(uriOrigin) || new URL(parsed.uri).host !== parsed.domain) {
    throw forbidden("SIWE_ORIGIN_MISMATCH", "SIWE uri origin is not allowed or does not match the domain");
  }

  const chainOk = isPublicNetwork(parsed.chainId) || cfg.chains.has(parsed.chainId);
  if (!chainOk || !findNetwork(parsed.chainId)) {
    throw forbidden("SIWE_CHAIN_UNSUPPORTED", `Chain ${parsed.chainId} is not supported for sign-in`);
  }

  const now = Date.now();
  const issuedAt = parsed.issuedAt.getTime();
  if (issuedAt > now + CLOCK_SKEW_MS || issuedAt < now - cfg.nonceTtlSeconds * 1000 - CLOCK_SKEW_MS) {
    throw unauthorized("SIWE_STALE", "SIWE message issuedAt is outside the accepted window");
  }
  if (parsed.expirationTime && parsed.expirationTime.getTime() <= now) {
    throw unauthorized("SIWE_EXPIRED", "SIWE message has expired");
  }
  if (parsed.notBefore && parsed.notBefore.getTime() > now + CLOCK_SKEW_MS) {
    throw unauthorized("SIWE_NOT_YET_VALID", "SIWE message is not yet valid");
  }

  let recovered: Address;
  try {
    recovered = await recoverMessageAddress({ message, signature });
  } catch {
    throw unauthorized("SIWE_SIGNATURE_INVALID", "Signature could not be recovered");
  }
  if (recovered.toLowerCase() !== parsed.address.toLowerCase()) {
    throw unauthorized("SIWE_SIGNATURE_INVALID", "Signature does not match the SIWE address");
  }
  const wallet = getAddress(parsed.address);

  return withTransaction(async (client) => {
    // Single-use: the nonce is consumed atomically; a replay finds no unconsumed row.
    const consumed = await client.query(
      `UPDATE auth_nonces SET consumed_at = NOW()
       WHERE nonce = $1 AND consumed_at IS NULL AND expires_at > NOW()
       RETURNING nonce`,
      [parsed.nonce]
    );
    if (consumed.rowCount === 0) throw unauthorized("SIWE_NONCE_INVALID", "Nonce is unknown, expired, or already used");

    let cp = await client.query(`SELECT id, display_name FROM counterparties WHERE LOWER(wallet_address) = LOWER($1)`, [
      wallet,
    ]);
    if (cp.rowCount === 0) {
      cp = await client.query(
        `INSERT INTO counterparties (display_name, wallet_address, wallet_type, status, wallet_verified_at)
         VALUES ($1, $2, 'EOA', 'ACTIVE', NOW()) RETURNING id, display_name`,
        [`Wallet ${wallet.slice(0, 6)}…${wallet.slice(-4)}`, wallet]
      );
    } else {
      await client.query(`UPDATE counterparties SET wallet_verified_at = NOW(), updated_at = NOW() WHERE id = $1`, [
        cp.rows[0].id,
      ]);
    }
    const counterpartyId: string = cp.rows[0].id;

    const token = randomToken(SESSION_PREFIX);
    const res = await client.query(
      `INSERT INTO auth_sessions (token_hash, wallet_address, counterparty_id, siwe_domain, siwe_chain_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + ($6 || ' seconds')::interval) RETURNING expires_at`,
      [sha256Hex(token), wallet, counterpartyId, parsed.domain, parsed.chainId, String(cfg.sessionTtlSeconds)]
    );
    return {
      token,
      expiresAt: new Date(res.rows[0].expires_at).toISOString(),
      address: wallet,
      counterpartyId,
      displayName: cp.rows[0].display_name,
    };
  });
}

export async function revokeSession(sessionId: string) {
  await query(`UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`, [sessionId]);
}

// ---------------------------------------------------------------------------
// Agent credentials
// ---------------------------------------------------------------------------

export async function createAgentCredential(owner: Actor, label: string, scopes: string[], ttlDays?: number) {
  if (owner.kind !== "wallet") throw forbidden("HUMAN_SESSION_REQUIRED", "Agent credentials can only be minted by a wallet session");
  const unique = Array.from(new Set(scopes));
  for (const s of unique) {
    if (!(AGENT_SCOPES as readonly string[]).includes(s)) throw new ApiError(400, "INVALID_SCOPE", `Unknown scope: ${s}`);
  }
  if (unique.length === 0) throw new ApiError(400, "INVALID_SCOPE", "At least one scope is required");
  const secret = randomToken(AGENT_PREFIX);
  const res = await query(
    `INSERT INTO agent_credentials (key_hash, key_prefix, owner_counterparty_id, owner_wallet, label, scopes, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $7::int IS NULL THEN NULL ELSE NOW() + ($7::int * INTERVAL '1 day') END)
     RETURNING id, created_at, expires_at`,
    [sha256Hex(secret), secret.slice(0, 16), owner.counterpartyId, owner.wallet, label.slice(0, 128), unique, ttlDays ?? null]
  );
  return {
    id: res.rows[0].id as string,
    secret, // returned exactly once
    label,
    scopes: unique,
    createdAt: new Date(res.rows[0].created_at).toISOString(),
    expiresAt: res.rows[0].expires_at ? new Date(res.rows[0].expires_at).toISOString() : null,
  };
}

export async function listAgentCredentials(owner: Actor) {
  const res = await query(
    `SELECT id, key_prefix, label, scopes, created_at, expires_at, revoked_at, last_used_at
     FROM agent_credentials WHERE owner_counterparty_id = $1 ORDER BY created_at DESC`,
    [owner.counterpartyId]
  );
  return res.rows.map((r) => ({
    id: r.id,
    keyPrefix: r.key_prefix,
    label: r.label,
    scopes: r.scopes,
    createdAt: new Date(r.created_at).toISOString(),
    expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    revokedAt: r.revoked_at ? new Date(r.revoked_at).toISOString() : null,
    lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
  }));
}

export async function revokeAgentCredential(owner: Actor, id: string) {
  const res = await query(
    `UPDATE agent_credentials SET revoked_at = NOW() WHERE id = $1 AND owner_counterparty_id = $2 AND revoked_at IS NULL`,
    [id, owner.counterpartyId]
  );
  return res.rowCount > 0;
}

// ---------------------------------------------------------------------------
// Bearer resolution & middleware
// ---------------------------------------------------------------------------

export async function resolveBearer(header: string | undefined): Promise<Actor | null> {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!m) return null;
  const token = m[1];
  if (token.length > 200) return null;
  const hash = sha256Hex(token);

  if (token.startsWith(SESSION_PREFIX)) {
    const res = await query(
      `UPDATE auth_sessions s SET last_seen_at = NOW()
       FROM counterparties c
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
         AND c.id = s.counterparty_id AND c.status = 'ACTIVE'
       RETURNING s.id, s.wallet_address, s.counterparty_id`,
      [hash]
    );
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
    return { kind: "wallet", wallet: getAddress(r.wallet_address), counterpartyId: r.counterparty_id, sessionId: r.id };
  }

  if (token.startsWith(AGENT_PREFIX)) {
    const res = await query(
      `UPDATE agent_credentials a SET last_used_at = NOW()
       FROM counterparties c
       WHERE a.key_hash = $1 AND a.revoked_at IS NULL AND (a.expires_at IS NULL OR a.expires_at > NOW())
         AND c.id = a.owner_counterparty_id AND c.status = 'ACTIVE'
       RETURNING a.id, a.owner_wallet, a.owner_counterparty_id, a.scopes`,
      [hash]
    );
    if (res.rowCount === 0) return null;
    const r = res.rows[0];
    return {
      kind: "agent",
      wallet: getAddress(r.owner_wallet),
      counterpartyId: r.owner_counterparty_id,
      credentialId: r.id,
      scopes: r.scopes,
    };
  }
  return null;
}

/** Resolves the bearer credential if present. Invalid credentials are rejected, never downgraded to anonymous. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return next();
  resolveBearer(header)
    .then((actor) => {
      if (!actor) return next(unauthorized("INVALID_CREDENTIAL", "Bearer credential is invalid, expired, or revoked"));
      req.actor = actor;
      next();
    })
    .catch(next);
}

export function requireActor(req: Request, _res: Response, next: NextFunction) {
  if (!req.actor) return next(unauthorized());
  next();
}

/** Human wallet session only: agents can never perform financial approvals. */
export function requireHuman(req: Request, _res: Response, next: NextFunction) {
  if (!req.actor) return next(unauthorized());
  if (req.actor.kind !== "wallet") {
    return next(forbidden("HUMAN_SESSION_REQUIRED", "This action requires an authenticated human wallet session"));
  }
  next();
}

export function hasScope(actor: Actor, scope: AgentScope): boolean {
  return actor.kind === "wallet" || actor.scopes.includes(scope);
}

export function requireScope(scope: AgentScope) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.actor) return next(unauthorized());
    if (!hasScope(req.actor, scope)) return next(forbidden("INSUFFICIENT_SCOPE", `Credential lacks scope ${scope}`));
    next();
  };
}

export function actorLabel(actor: Actor | undefined): string {
  if (!actor) return "anonymous";
  return actor.kind === "wallet" ? `wallet:${actor.wallet}` : `agent:${actor.credentialId}:${actor.wallet}`;
}

export function assertAddress(value: unknown, field: string): Address {
  if (typeof value !== "string" || !isAddress(value)) throw new ApiError(400, "INVALID_ADDRESS", `${field} must be an address`);
  return getAddress(value);
}
