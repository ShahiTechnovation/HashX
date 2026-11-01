import React from "react";
import { cn } from "@/lib/utils";
import type { VerificationReasonCode } from "@/types/domain";

/** Plain-language meaning of each verifier reason code. */
export const REASON_CODE_COPY: Record<VerificationReasonCode, string> = {
  SIGNATURE_INVALID:
    "The recovered EIP-712 signer does not match the seller. A signed field was changed after signing.",
  SUBJECT_MISMATCH: "The delivered artifact reports on a different address than the invoice requested.",
  BLOCK_RANGE_MISMATCH: "The artifact covers a different block range than the one agreed in the invoice.",
  TX_COUNT_MISMATCH:
    "The transaction count claimed by the seller differs from HashKey Chain RPC recomputation.",
  ARTIFACT_TAMPERED: "The artifact bytes do not hash to the SHA-256 committed in the signed manifest.",
  MANIFEST_SIGNATURE_INVALID: "The delivery manifest is not signed by the invoice seller.",
  DELIVERY_SCHEMA_INVALID: "The document does not conform to its required schema.",
  CHAIN_MISMATCH: "The artifact was produced for a different chain than the invoice specifies.",
  EVIDENCE_INVALID: "Sample transaction proofs fall outside the requested block range.",
  DELIVERY_STALE: "The artifact was generated before the requested range reached finality.",
  DELIVERY_INCOMPLETE: "Required delivery fields or proofs are missing.",
  INVOICE_EXPIRED: "The invoice validity window has closed. Terms must be re-issued and re-signed.",
  REPLAY_NONCE_REUSED: "The seller nonce was already consumed by a prior settlement. This is a replay.",
  SELLER_UNBOUND: "The signing wallet is not bound to an active registered counterparty.",
  TERMS_MUTATED: "The service terms do not hash to the declared serviceTermsHash.",
};

export function describeReasonCode(code: string): string {
  return REASON_CODE_COPY[code as VerificationReasonCode] ?? "Verifier policy violation.";
}

/** Compact mono chip for a reason code. Danger tone: a reason code always means a failed check. */
export const ReasonCodeChip: React.FC<{ code: string; className?: string; size?: "sm" | "md" }> = ({
  code,
  className,
  size = "sm",
}) => (
  <span
    title={describeReasonCode(code)}
    className={cn(
      "inline-flex items-center rounded font-mono font-medium bg-danger/10 text-danger ring-1 ring-inset ring-danger/25 whitespace-nowrap",
      size === "sm" ? "h-[18px] px-1.5 text-[10px]" : "h-[22px] px-2 text-2xs",
      className
    )}
  >
    {code}
  </span>
);
