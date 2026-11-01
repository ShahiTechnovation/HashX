import type {
  CheckStatus,
  Delivery,
  DeliveryCheckKey,
  DeliveryVerificationResult,
  Invoice,
  InvoiceCheckKey,
  InvoiceVerificationResult,
  VerificationCheckDetail,
  VerificationReasonCode,
} from "@/types/domain";
import { MOCK_COUNTERPARTIES, FIXTURE_DELIVERY_FAKE_COUNT } from "@/mocks/fixtures";
import { verifyInvoice as runVerifyInvoice, verifyDelivery as runVerifyDelivery } from "@/lib/verification/engine";

/**
 * Simulated RPC recomputation results keyed by delivery ID (demo dataset).
 * Scenario B: the seller claims 23 transactions; HashKey Chain RPC returns 17.
 */
export const MOCK_RPC_TX_COUNT: Record<string, number> = {
  [FIXTURE_DELIVERY_FAKE_COUNT.id]: 17,
};

export const INVOICE_CHECK_KEYS: InvoiceCheckKey[] = [
  "schema",
  "signature",
  "identity_binding",
  "expiry",
  "nonce_unused",
  "terms_consistent",
];

export const DELIVERY_CHECK_KEYS: DeliveryCheckKey[] = [
  "manifest_signature",
  "artifact_hash",
  "schema",
  "requested_address",
  "block_range",
  "transaction_count",
  "sample_transaction_proofs",
  "freshness",
];

export function runInvoiceVerification(invoice: Invoice): InvoiceVerificationResult {
  return runVerifyInvoice(invoice, MOCK_COUNTERPARTIES);
}

export function runDeliveryVerification(invoice: Invoice, delivery: Delivery): DeliveryVerificationResult {
  return runVerifyDelivery(invoice, delivery, MOCK_RPC_TX_COUNT[delivery.id]);
}

/**
 * The engine can mark a check FAIL in `checks` without rewriting its detail
 * (e.g. CHAIN_MISMATCH folds into `schema`). Treat `checks` as authoritative.
 */
export function resolveCheckDetail(
  status: CheckStatus,
  detail: VerificationCheckDetail,
  reasonCodes: VerificationReasonCode[],
  key: string
): VerificationCheckDetail {
  if (status === detail.status) return detail;
  if (status === "FAIL" && key === "schema" && reasonCodes.includes("CHAIN_MISMATCH")) {
    return {
      ...detail,
      status,
      failureCode: detail.failureCode ?? "CHAIN_MISMATCH",
      explanation: "Artifact chain_id does not match the invoice's preferred chain.",
    };
  }
  return { ...detail, status };
}

export function countChecks(checks: Record<string, CheckStatus>) {
  const values = Object.values(checks);
  return {
    total: values.length,
    passed: values.filter((c) => c === "PASS").length,
    failed: values.filter((c) => c === "FAIL").length,
    skipped: values.filter((c) => c === "SKIPPED").length,
  };
}

export function chainName(chainId: number): string {
  if (chainId === 133) return "HashKey Chain Testnet";
  if (chainId === 177) return "HashKey Chain";
  return `Chain ${chainId}`;
}
