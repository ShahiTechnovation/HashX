import type { InvoiceStatus } from "@/types/domain";

/** Compact UTC timestamp for dense tables and rails: "Oct 31, 14:02". */
export function formatShortUtc(iso: string | undefined, withTime = true): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : { year: "numeric" }),
  });
}

/** Human chain label for a preferred chain id. */
export function chainLabel(chainId: number): string {
  if (chainId === 133) return "HashKey Chain Testnet";
  if (chainId === 177) return "HashKey Chain Mainnet";
  return "Unknown chain";
}

/** Block span as a count, or null when the range is not a valid integer span. */
export function blockSpan(start: string, end: string): number | null {
  const s = parseInt(start, 10);
  const e = parseInt(end, 10);
  if (isNaN(s) || isNaN(e) || e < s) return null;
  return e - s;
}

export const BLOCKED_STATUSES: InvoiceStatus[] = ["REJECTED", "DELIVERY_REJECTED"];

export function sameAddress(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}
