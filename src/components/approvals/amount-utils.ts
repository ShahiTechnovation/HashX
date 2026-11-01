/**
 * Exact string arithmetic for token amounts. No floats, no rounding.
 */

/** "1000000", 6 → "1.000000" (full precision, every decimal place shown). */
export function rawToExactDecimal(raw: string, decimals: number): string {
  const clean = (raw ?? "").trim();
  if (!/^\d+$/.test(clean)) return clean;
  if (decimals <= 0) return clean.replace(/^0+(?=\d)/, "");
  const padded = clean.padStart(decimals + 1, "0");
  const whole = padded.slice(0, padded.length - decimals).replace(/^0+(?=\d)/, "");
  const frac = padded.slice(-decimals);
  return `${whole}.${frac}`;
}

/** Splits "1,250.00 USDT" → { value: "1,250.00", unit: "USDT" }. */
export function splitHumanAmount(human: string): { value: string; unit: string } {
  const trimmed = (human ?? "").trim();
  const idx = trimmed.lastIndexOf(" ");
  if (idx <= 0) return { value: trimmed, unit: "" };
  return { value: trimmed.slice(0, idx), unit: trimmed.slice(idx + 1) };
}

function normalizeDecimal(s: string): string | null {
  const c = s.replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(c)) return null;
  const [w, f = ""] = c.split(".");
  const whole = w.replace(/^0+(?=\d)/, "");
  const frac = f.replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/**
 * True when the human-readable amount exactly equals raw / 10^decimals.
 * Returns null when the human string cannot be parsed (no claim either way).
 */
export function humanMatchesRaw(human: string, raw: string, decimals: number): boolean | null {
  const h = normalizeDecimal(splitHumanAmount(human).value);
  const r = normalizeDecimal(rawToExactDecimal(raw, decimals));
  if (h === null || r === null) return null;
  return h === r;
}
