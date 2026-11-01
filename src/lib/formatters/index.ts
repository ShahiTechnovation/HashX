import { HSPStatus, InvoiceStatus, PaymentAttemptState } from "@/types/domain";

/**
 * Formats minor units (cents) into human-readable USD display string.
 * Uses exact integer division and string padding to prevent floating-point bugs.
 */
export function formatMinorToUsd(amountMinor: string | number): string {
  try {
    const raw = typeof amountMinor === "number" ? Math.floor(amountMinor).toString() : amountMinor.trim();
    if (!raw || isNaN(Number(raw))) return "$0.00";

    const isNegative = raw.startsWith("-");
    const absRaw = isNegative ? raw.slice(1) : raw;

    if (absRaw.length <= 2) {
      const padded = absRaw.padStart(3, "0");
      const dollars = padded.slice(0, padded.length - 2);
      const cents = padded.slice(-2);
      return `${isNegative ? "-" : ""}$${dollars}.${cents}`;
    }

    const dollars = absRaw.slice(0, absRaw.length - 2);
    const cents = absRaw.slice(-2);
    const formattedDollars = Number(dollars).toLocaleString("en-US");
    return `${isNegative ? "-" : ""}$${formattedDollars}.${cents}`;
  } catch {
    return "$0.00";
  }
}

/**
 * Parses user input dollars (e.g. "1.50") into integer minor units ("150").
 */
export function parseUsdToMinor(usdString: string): string {
  const clean = usdString.replace(/[^0-9.]/g, "");
  if (!clean) return "0";
  const parts = clean.split(".");
  const dollars = parts[0] || "0";
  const cents = (parts[1] || "").padEnd(2, "0").slice(0, 2);
  const total = `${dollars}${cents}`.replace(/^0+/, "");
  return total === "" ? "0" : total;
}

/**
 * Formats raw token units given decimals without precision loss.
 */
export function formatRawTokenUnits(rawAmount: string, decimals = 6, symbol = "USDT"): string {
  try {
    const raw = rawAmount.trim();
    if (!raw) return `0.00 ${symbol}`;

    if (raw.length <= decimals) {
      const padded = raw.padStart(decimals + 1, "0");
      const whole = padded.slice(0, padded.length - decimals);
      const frac = padded.slice(-decimals).replace(/0+$/, "").padEnd(2, "0");
      return `${whole}.${frac} ${symbol}`;
    }

    const whole = raw.slice(0, raw.length - decimals);
    const frac = raw.slice(-decimals).replace(/0+$/, "").padEnd(2, "0");
    const formattedWhole = Number(whole).toLocaleString("en-US");
    return `${formattedWhole}.${frac} ${symbol}`;
  } catch {
    return `${rawAmount} (raw) ${symbol}`;
  }
}

/**
 * Truncates Ethereum address for compact display.
 */
export function formatAddress(address: string, chars = 4): string {
  if (!address) return "0x00...0000";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Truncates transaction hash or digest.
 */
export function formatHash(hash: string, chars = 6): string {
  if (!hash) return "0x000...000";
  if (hash.length <= chars * 2 + 2) return hash;
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

/**
 * Formats ISO / RFC3339 timestamp to readable UTC string.
 */
export function formatTimestamp(rfc3339: string): string {
  try {
    const d = new Date(rfc3339);
    if (isNaN(d.getTime())) return rfc3339;
    return d.toLocaleString("en-US", {
      timeZone: "UTC",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }) + " UTC";
  } catch {
    return rfc3339;
  }
}

/**
 * Computes time remaining until expiration.
 */
export function formatExpiryCountdown(rfc3339: string, referenceTime = new Date()): {
  text: string;
  isExpired: boolean;
  secondsRemaining: number;
} {
  try {
    const expiry = new Date(rfc3339).getTime();
    const now = referenceTime.getTime();
    const diff = Math.floor((expiry - now) / 1000);

    if (diff <= 0) {
      return {
        text: `Expired ${Math.abs(diff)}s ago`,
        isExpired: true,
        secondsRemaining: 0,
      };
    }

    const minutes = Math.floor(diff / 60);
    const seconds = diff % 60;
    if (minutes === 0) {
      return {
        text: `${seconds}s remaining`,
        isExpired: false,
        secondsRemaining: diff,
      };
    }
    return {
      text: `${minutes}m ${seconds}s remaining`,
      isExpired: false,
      secondsRemaining: diff,
    };
  } catch {
    return { text: "Invalid date", isExpired: true, secondsRemaining: 0 };
  }
}

/**
 * Badge status configuration for invoices.
 */
export function getInvoiceStatusMeta(status: InvoiceStatus): {
  label: string;
  variant: "default" | "success" | "warning" | "danger" | "secondary";
  description: string;
} {
  switch (status) {
    case "DRAFT":
      return { label: "Draft", variant: "secondary", description: "Created by seller, awaiting EIP-712 signature" };
    case "SIGNED":
      return { label: "Signed", variant: "warning", description: "EIP-712 signed by seller wallet" };
    case "VERIFIED":
      return { label: "Verified", variant: "success", description: "Invoice terms, signer, and nonce verified" };
    case "REJECTED":
      return { label: "Rejected", variant: "danger", description: "Verification failed. Commercial terms altered or invalid" };
    case "DELIVERED":
      return { label: "Delivered", variant: "warning", description: "Fulfillment artifact and manifest submitted" };
    case "DELIVERY_ACCEPTED":
      return { label: "Fulfillment Verified", variant: "success", description: "Deterministic delivery checks passed" };
    case "DELIVERY_REJECTED":
      return { label: "Fulfillment Rejected", variant: "danger", description: "Delivery evidence mismatch or invalid" };
    case "SETTLED":
      return { label: "Settled", variant: "success", description: "HSP payment confirmed and reconciled on HashKey Chain" };
    default:
      return { label: status, variant: "secondary", description: "Unknown status" };
  }
}

/**
 * Strict HSP status mapping following PRD Section 14.
 * CRITICAL RULE: "payment-safe" is on-chain but NOT finalized. Never conflate the two.
 */
export function getHSPStatusMeta(status: HSPStatus): {
  label: string;
  category: "pending" | "safe" | "finalized" | "failed" | "recovery" | "unknown";
  variant: "default" | "success" | "warning" | "danger" | "secondary";
  description: string;
} {
  switch (status) {
    case "payment-submitted":
      return {
        label: "Submitted",
        category: "pending",
        variant: "warning",
        description: "Payment submitted to HSP rail, awaiting verification",
      };
    case "payment-verified":
      return {
        label: "Verified",
        category: "pending",
        variant: "warning",
        description: "HSP payment verified, queued for processing",
      };
    case "payment-processing":
      return {
        label: "Processing",
        category: "pending",
        variant: "warning",
        description: "Transaction being broadcast and confirmed on HashKey Chain",
      };
    case "payment-included":
      return {
        label: "Included in Block",
        category: "pending",
        variant: "warning",
        description: "Transaction included in block, waiting for safety confirmations",
      };
    case "payment-safe":
      return {
        label: "On-Chain Safe (Unfinalized)",
        category: "safe",
        variant: "warning",
        description: "Transaction on-chain with safe depth. NOT yet final.",
      };
    case "payment-finalized":
      return {
        label: "Finalized",
        category: "finalized",
        variant: "success",
        description: "Irreversible finality reached on HashKey Chain",
      };
    case "payment-timeout":
      return {
        label: "Timeout (Recovery Required)",
        category: "recovery",
        variant: "danger",
        description: "Network timeout. Do NOT recreate order; query with existing IDs.",
      };
    case "payment-failed":
      return {
        label: "Failed",
        category: "failed",
        variant: "danger",
        description: "Payment failed on HSP rail. Reason preserved in audit trail.",
      };
    default:
      return {
        label: "Unknown State",
        category: "unknown",
        variant: "secondary",
        description: "Payment status unknown. Retaining identifiers for polling.",
      };
  }
}

/**
 * Returns canonical HashKey Chain Testnet block explorer transaction URL.
 */
export function getExplorerTxUrl(txHash: string): string {
  if (!txHash) return "https://testnet-explorer.hskchain.net";
  return `https://testnet-explorer.hskchain.net/tx/${txHash}`;
}

/**
 * Returns canonical HashKey Chain Testnet block explorer address URL.
 */
export function getExplorerAddressUrl(address: string): string {
  if (!address) return "https://testnet-explorer.hskchain.net";
  return `https://testnet-explorer.hskchain.net/address/${address}`;
}


