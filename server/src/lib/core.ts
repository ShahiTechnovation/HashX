import { createHash, randomBytes, randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

// ---------------------------------------------------------------------------
// Secure identifiers
// ---------------------------------------------------------------------------

/** Unpredictable, URL-safe identifier with a type prefix, e.g. inv_3f9c…  (128 bits of entropy). */
export function secureId(prefix: "inv" | "del" | "pay" | "rcpt"): string {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}

/** 32 random bytes as 0x-prefixed hex — used for EIP-712 nonces. */
export function randomBytes32(): `0x${string}` {
  return `0x${randomBytes(32).toString("hex")}`;
}

export function randomToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function newRequestId(): string {
  return randomUUID();
}

// ---------------------------------------------------------------------------
// Typed API errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (code: string, msg: string, details?: unknown) => new ApiError(400, code, msg, details);
export const unauthorized = (code = "UNAUTHORIZED", msg = "Authentication required") => new ApiError(401, code, msg);
export const forbidden = (code: string, msg: string) => new ApiError(403, code, msg);
export const notFound = (what: string) => new ApiError(404, "NOT_FOUND", `${what} not found`);
export const conflict = (code: string, msg: string, details?: unknown) => new ApiError(409, code, msg, details);
export const unavailable = (code: string, msg: string, details?: unknown) => new ApiError(503, code, msg, details);

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Forwards async rejections to the Express error handler (Express 4 does not). */
export function route(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// ---------------------------------------------------------------------------
// Structured logging — never pass secrets, tokens, signatures or request bodies.
// ---------------------------------------------------------------------------

export function log(level: "INFO" | "WARN" | "ERROR", msg: string, fields: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "test" && level === "INFO" && process.env.LOG_IN_TESTS !== "true") return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
  if (level === "ERROR") console.error(line);
  else if (level === "WARN") console.warn(line);
  else console.info(line);
}

/** Non-reversible label for an RPC endpoint (URLs frequently embed API keys). */
export function rpcLabel(chainId: number, url: string | null): string {
  if (!url) return `chain:${chainId}/unconfigured`;
  return `chain:${chainId}/rpc#${sha256Hex(url).slice(0, 10)}`;
}

export function toIso(v: Date | string | null | undefined): string | undefined {
  if (!v) return undefined;
  return new Date(v).toISOString();
}

export function unixSeconds(d: Date | string | number = Date.now()): number {
  return Math.floor(new Date(d).getTime() / 1000);
}
