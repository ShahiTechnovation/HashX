/**
 * Authenticated client for the HashX backend (connected mode).
 * Every request carries the SIWE session bearer token; there is no unauthenticated
 * fallback and no demo-fixture substitution.
 */
import {
  LiveApiError,
  type CreateLiveInvoiceInput,
  type LiveDelivery,
  type LiveInvoice,
  type LivePayment,
  type LiveReadiness,
  type LiveReceipt,
  type LiveStats,
  type LiveVerificationRun,
  type LiveVerificationSummary,
  type PreparedDelivery,
  type TypedDataJson,
  type Hex,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_HASHX_API_URL || "http://localhost:8080").replace(/\/$/, "");

export class LiveApi {
  constructor(
    private readonly getToken: () => string | null,
    private readonly onUnauthorized?: () => void,
    readonly baseUrl: string = API_URL
  ) {}

  async request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const token = this.getToken();
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      throw new LiveApiError(0, "NETWORK_ERROR", `HashX API unreachable at ${this.baseUrl}: ${(err as Error).message}`);
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { error: text };
    }
    if (!res.ok) {
      if (res.status === 401) this.onUnauthorized?.();
      throw new LiveApiError(res.status, json?.code ?? "HTTP_ERROR", json?.error ?? res.statusText, json?.details, json?.requestId);
    }
    return json as T;
  }

  // Public ------------------------------------------------------------------
  health() {
    return this.request<{ status: string }>("GET", "/health");
  }
  async readiness(): Promise<LiveReadiness> {
    // /ready answers 503 with a full body when degraded; surface the body either way.
    const res = await fetch(`${this.baseUrl}/ready`);
    return (await res.json()) as LiveReadiness;
  }
  nonce() {
    return this.request<{ nonce: string; expiresAt: string }>("GET", "/auth/nonce");
  }
  verifySiwe(message: string, signature: Hex) {
    return this.request<{ token: string; expiresAt: string; address: Hex; counterpartyId: string; displayName: string }>(
      "POST",
      "/auth/verify",
      { message, signature }
    );
  }

  // Session -------------------------------------------------------------------
  session() {
    return this.request<{ kind: string; address: Hex; counterpartyId: string; displayName: string | null }>("GET", "/auth/session");
  }
  logout() {
    return this.request<{ revoked: boolean }>("POST", "/auth/logout");
  }
  setDisplayName(display_name: string) {
    return this.request<{ displayName: string }>("POST", "/counterparties/me", { display_name });
  }
  createAgentCredential(label: string, scopes: string[], ttl_days?: number) {
    return this.request<{ id: string; secret: string; label: string; scopes: string[]; createdAt: string; expiresAt: string | null }>(
      "POST",
      "/agent-credentials",
      { label, scopes, ttl_days }
    );
  }
  listAgentCredentials() {
    return this.request<Array<{ id: string; keyPrefix: string; label: string; scopes: string[]; createdAt: string; revokedAt: string | null; lastUsedAt: string | null }>>(
      "GET",
      "/agent-credentials"
    );
  }
  revokeAgentCredential(id: string) {
    return this.request<{ revoked: boolean }>("DELETE", `/agent-credentials/${id}`);
  }

  // Invoices ------------------------------------------------------------------
  listInvoices() {
    return this.request<LiveInvoice[]>("GET", "/invoices");
  }
  getInvoice(id: string) {
    return this.request<LiveInvoice>("GET", `/invoices/${encodeURIComponent(id)}`);
  }
  createInvoice(input: CreateLiveInvoiceInput) {
    return this.request<LiveInvoice & { typedData: TypedDataJson }>("POST", "/invoices", input);
  }
  invoiceTypedData(id: string) {
    return this.request<{ digest: Hex; typedData: TypedDataJson }>("GET", `/invoices/${encodeURIComponent(id)}/typed-data`);
  }
  signInvoice(id: string, signature: Hex) {
    return this.request<LiveInvoice>("POST", `/invoices/${encodeURIComponent(id)}/sign`, { signature });
  }
  verifyInvoice(id: string) {
    return this.request<LiveVerificationRun>("POST", `/invoices/${encodeURIComponent(id)}/verify`);
  }
  verification(id: string) {
    return this.request<LiveVerificationSummary>("GET", `/invoices/${encodeURIComponent(id)}/verification`);
  }

  // Deliveries ----------------------------------------------------------------
  listDeliveries() {
    return this.request<LiveDelivery[]>("GET", "/deliveries");
  }
  async latestDelivery(invoiceId: string): Promise<LiveDelivery | null> {
    try {
      return await this.request<LiveDelivery>("GET", `/invoices/${encodeURIComponent(invoiceId)}/delivery`);
    } catch (err) {
      if (err instanceof LiveApiError && err.status === 404) return null;
      throw err;
    }
  }
  prepareDelivery(invoiceId: string, artifact_uri: string, artifact_content: Record<string, unknown>) {
    return this.request<PreparedDelivery>("POST", `/invoices/${encodeURIComponent(invoiceId)}/delivery/prepare`, { artifact_uri, artifact_content });
  }
  submitDelivery(invoiceId: string, body: { artifact_uri: string; artifact_content: Record<string, unknown>; manifest: Record<string, unknown>; manifest_signature: Hex }) {
    return this.request<LiveDelivery>("POST", `/invoices/${encodeURIComponent(invoiceId)}/delivery`, body);
  }
  verifyDelivery(invoiceId: string) {
    return this.request<LiveVerificationRun>("POST", `/invoices/${encodeURIComponent(invoiceId)}/delivery/verify`);
  }

  // Payments ------------------------------------------------------------------
  requestPayment(invoiceId: string, idempotencyKey?: string) {
    return this.request<LivePayment>(
      "POST",
      `/invoices/${encodeURIComponent(invoiceId)}/payments`,
      {},
      idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}
    );
  }
  async paymentStatus(invoiceId: string): Promise<LivePayment | null> {
    try {
      return await this.request<LivePayment>("GET", `/invoices/${encodeURIComponent(invoiceId)}/payment-status`);
    } catch (err) {
      if (err instanceof LiveApiError && err.status === 404) return null;
      throw err;
    }
  }
  listPayments() {
    return this.request<LivePayment[]>("GET", "/payments");
  }
  getPayment(id: string) {
    return this.request<LivePayment>("GET", `/payments/${encodeURIComponent(id)}`);
  }
  approveTerms(id: string, authorization_digest: Hex) {
    return this.request<LivePayment>("POST", `/payments/${encodeURIComponent(id)}/approve-terms`, { authorization_digest });
  }
  authorize(id: string, signature: Hex) {
    return this.request<LivePayment>("POST", `/payments/${encodeURIComponent(id)}/authorize`, { signature });
  }
  reportTransaction(id: string, tx_hash: Hex) {
    return this.request<LivePayment>("POST", `/payments/${encodeURIComponent(id)}/transaction`, { tx_hash });
  }
  reconcile(id: string) {
    return this.request<LivePayment>("POST", `/payments/${encodeURIComponent(id)}/reconcile`);
  }
  cancel(id: string) {
    return this.request<LivePayment>("POST", `/payments/${encodeURIComponent(id)}/cancel`);
  }

  // Receipts & stats ------------------------------------------------------------
  listReceipts() {
    return this.request<LiveReceipt[]>("GET", "/receipts");
  }
  getReceipt(id: string) {
    return this.request<LiveReceipt>("GET", `/receipts/${encodeURIComponent(id)}`);
  }
  async receiptForInvoice(invoiceId: string): Promise<LiveReceipt | null> {
    try {
      return await this.request<LiveReceipt>("GET", `/invoices/${encodeURIComponent(invoiceId)}/receipt`);
    } catch (err) {
      if (err instanceof LiveApiError && err.status === 404) return null;
      throw err;
    }
  }
  stats() {
    return this.request<LiveStats>("GET", "/stats");
  }
}
