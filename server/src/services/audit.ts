import { keccakCanonical } from "../../../shared/protocol.js";
import { query } from "../db/client.js";
import type { Actor } from "../auth/auth.js";
import { actorLabel } from "../auth/auth.js";
import { log } from "../lib/core.js";

/** Append-only audit trail. Details must not contain secrets, tokens or raw signatures. */
export async function recordAudit(aggregateType: string, aggregateId: string, actor: Actor | string, event: string, details: Record<string, unknown>) {
  const actorStr = typeof actor === "string" ? actor : actorLabel(actor);
  const safe = JSON.parse(JSON.stringify(details, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
  try {
    await query(
      `INSERT INTO audit_events (aggregate_type, aggregate_id, actor, event, payload_digest, details) VALUES ($1,$2,$3,$4,$5,$6)`,
      [aggregateType, aggregateId, actorStr.slice(0, 128), event, keccakCanonical(safe), JSON.stringify(safe)]
    );
  } catch (err) {
    log("WARN", "audit_append_failed", { aggregateType, aggregateId, event, error: (err as Error).message });
  }
}
