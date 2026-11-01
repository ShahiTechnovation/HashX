import {
  HashXClient,
  Invoice,
  CreateInvoiceInput,
  SignInvoiceInput,
  VerifyInvoiceInput,
  SubmitDeliveryInput,
  VerifyDeliveryInput,
  RequestPaymentInput,
  PaymentAttempt,
  VerifiableReceipt,
  InvoiceVerificationResult,
  DeliveryVerificationResult,
  Delivery,
} from "@/types/domain";
import {
  ALL_INITIAL_INVOICES,
  ALL_INITIAL_DELIVERIES,
  ALL_INITIAL_PAYMENT_ATTEMPTS,
  ALL_INITIAL_RECEIPTS,
  MOCK_COUNTERPARTIES,
  FIXTURE_DELIVERY_FAKE_COUNT,
} from "@/mocks/fixtures";
import { verifyInvoice as runVerifyInvoice, verifyDelivery as runVerifyDelivery } from "@/lib/verification/engine";
import { computeInvoiceDigest, computeServiceTermsHash, stringToBytes32 } from "@/lib/crypto/eip712";
import { keccak256, toBytes } from "viem";

class DemoModeClient implements HashXClient {
  private invoices: Invoice[] = [...ALL_INITIAL_INVOICES];
  private deliveries: Delivery[] = [...ALL_INITIAL_DELIVERIES];
  private paymentAttempts: PaymentAttempt[] = [...ALL_INITIAL_PAYMENT_ATTEMPTS];
  private receipts: VerifiableReceipt[] = [...ALL_INITIAL_RECEIPTS];
  private usedNonces: Set<string> = new Set([
    "0x742d35Cc6634C0532925a3b844Bc454e4438f44e:1004",
  ]);

  async getInvoices(): Promise<Invoice[]> {
    return [...this.invoices];
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    return this.invoices.find((i) => i.id === id) || null;
  }

  async getDeliveries(): Promise<Delivery[]> {
    return [...this.deliveries];
  }

  async getDeliveryByInvoiceId(invoiceId: string): Promise<Delivery | null> {
    return this.deliveries.find((d) => d.invoiceId === invoiceId) || null;
  }

  async getPaymentAttempts(): Promise<PaymentAttempt[]> {
    return [...this.paymentAttempts];
  }

  async getPaymentAttemptById(id: string): Promise<PaymentAttempt | null> {
    return this.paymentAttempts.find((p) => p.id === id) || null;
  }

  async getReceipts(): Promise<VerifiableReceipt[]> {
    return [...this.receipts];
  }

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const counterparty = MOCK_COUNTERPARTIES.find((c) => c.id === input.seller_counterparty_id) || MOCK_COUNTERPARTIES[0];
    const newId = `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const termsHash = computeServiceTermsHash(
      input.service.parameters.address,
      input.service.parameters.start_block,
      input.service.parameters.end_block,
      input.service.acceptance_policy
    );
    const buyerRefHash = keccak256(toBytes(input.buyer_ref));
    const nonce = Math.floor(1000 + Math.random() * 9000).toString();

    const newInvoice: Invoice = {
      id: newId,
      version: 1,
      clientRequestId: input.client_request_id || `req-${Date.now()}`,
      sellerId: counterparty.id,
      sellerDisplayName: counterparty.displayName,
      sellerWallet: counterparty.walletAddress,
      buyerRef: input.buyer_ref,
      buyerRefHash,
      service: input.service,
      serviceTermsHash: termsHash,
      payment: input.payment,
      issuedAt: new Date().toISOString(),
      expiresAt: input.expires_at,
      nonce,
      status: "DRAFT",
      createdAt: new Date().toISOString(),
    };

    newInvoice.digest = computeInvoiceDigest(newInvoice, input.payment.preferred_chain_id);
    this.invoices.unshift(newInvoice);
    return newInvoice;
  }

  async signInvoice(input: SignInvoiceInput): Promise<Invoice> {
    const inv = this.invoices.find((i) => i.id === input.invoice_id);
    if (!inv) throw new Error(`Invoice not found: ${input.invoice_id}`);

    // If signature not provided, generate deterministic simulated signature
    const signature =
      input.signature ||
      (`0xsimulated_eip712_${Date.now()}_` + Math.random().toString(16).slice(2).padStart(64, "0")).slice(0, 132) as `0x${string}`;

    inv.signature = signature;
    inv.signer = input.signer || inv.sellerWallet;
    inv.signatureValid = true;
    inv.status = "SIGNED";
    return { ...inv };
  }

  async verifyInvoice(input: VerifyInvoiceInput): Promise<InvoiceVerificationResult> {
    const inv = this.invoices.find((i) => i.id === input.invoice_id);
    if (!inv) throw new Error(`Invoice not found: ${input.invoice_id}`);

    const result = runVerifyInvoice(inv, MOCK_COUNTERPARTIES, this.usedNonces);
    if (result.decision === "PASS" && inv.status === "SIGNED") {
      inv.status = "VERIFIED";
    } else if (result.decision === "FAIL") {
      inv.status = "REJECTED";
    }
    return result;
  }

  async submitDelivery(input: SubmitDeliveryInput): Promise<Delivery> {
    const inv = this.invoices.find((i) => i.id === input.invoice_id);
    if (!inv) throw new Error(`Invoice not found: ${input.invoice_id}`);

    const newDelivery: Delivery = {
      id: `del-${Date.now().toString(36)}`,
      invoiceId: input.invoice_id,
      version: 1,
      artifactUri: input.artifact_uri,
      artifactSha256: input.artifact_sha256,
      manifest: input.manifest,
      manifestSignature: input.manifest_signature,
      status: "PENDING_VERIFICATION",
      submittedAt: new Date().toISOString(),
      artifactContent: input.artifact_content,
    };

    inv.status = "DELIVERED";
    this.deliveries.unshift(newDelivery);
    return newDelivery;
  }

  async verifyDelivery(input: VerifyDeliveryInput): Promise<DeliveryVerificationResult> {
    const inv = this.invoices.find((i) => i.id === input.invoice_id);
    if (!inv) throw new Error(`Invoice not found: ${input.invoice_id}`);

    const del = input.delivery_id
      ? this.deliveries.find((d) => d.id === input.delivery_id)
      : this.deliveries.find((d) => d.invoiceId === input.invoice_id);

    if (!del) throw new Error(`Delivery not found for invoice ${input.invoice_id}`);

    // If this is Scenario B (fixture fake delivery), simulate the RPC recomputation failing at 17 txs vs 23 claimed
    const mockExpected = del.id === FIXTURE_DELIVERY_FAKE_COUNT.id ? 17 : undefined;

    const result = runVerifyDelivery(inv, del, mockExpected);
    if (result.decision === "PASS") {
      del.status = "ACCEPTED";
      inv.status = "DELIVERY_ACCEPTED";
    } else {
      del.status = "REJECTED";
      inv.status = "DELIVERY_REJECTED";
    }
    return result;
  }

  async requestPayment(input: RequestPaymentInput): Promise<PaymentAttempt> {
    const inv = this.invoices.find((i) => i.id === input.invoice_id);
    if (!inv) throw new Error(`Invoice not found: ${input.invoice_id}`);

    // Idempotency check: if an active non-terminal attempt already exists, return it!
    const existing = this.paymentAttempts.find(
      (p) => p.invoiceId === input.invoice_id && p.state !== "FAILED"
    );
    if (existing) {
      return existing;
    }

    const newAttempt: PaymentAttempt = {
      id: `pay-${Date.now().toString(36)}`,
      invoiceId: inv.id,
      flowId: `hsp-flow-${Math.floor(10000 + Math.random() * 90000)}`,
      paymentRequestId: `hsp-pr-${Math.floor(5000000 + Math.random() * 900000)}`,
      merchantName: input.merchant_name || "HashX Global",
      attributionVerified: true,
      payer: input.payer,
      payee: inv.payment.payee,
      tokenAddress: "0x19B861876D8075A11eC6c4596395b058fe8466C2",
      tokenTotalRaw: (parseInt(inv.payment.amount_minor, 10) * 10000).toString(),
      quoteExpiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
      hspStatus: "payment-submitted",
      state: "AWAITING_SIGNATURE_APPROVAL",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      approvalSummary: {
        merchantName: "HashX Global",
        attributionVerified: true,
        payer: input.payer,
        payee: inv.payment.payee,
        tokenAddress: "0x19B861876D8075A11eC6c4596395b058fe8466C2",
        tokenSymbol: "USDT",
        tokenDecimals: 6,
        tokenTotalRaw: (parseInt(inv.payment.amount_minor, 10) * 10000).toString(),
        humanAmount: `${(parseInt(inv.payment.amount_minor, 10) / 100).toFixed(2)} USDT`,
        invoiceValueUsd: `$${(parseInt(inv.payment.amount_minor, 10) / 100).toFixed(2)} USD`,
        paymentFeeEstimateUsd: "$0.00 USD",
        chain: "HashKey Chain Testnet",
        chainId: inv.payment.preferred_chain_id,
        quoteExpiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
      },
    };

    this.paymentAttempts.unshift(newAttempt);
    return newAttempt;
  }

  async approveSigning(paymentAttemptId: string): Promise<PaymentAttempt> {
    const attempt = this.paymentAttempts.find((p) => p.id === paymentAttemptId);
    if (!attempt) throw new Error("Payment attempt not found");

    attempt.state = "AWAITING_SUBMISSION_APPROVAL";
    attempt.updatedAt = new Date().toISOString();
    return { ...attempt };
  }

  async approveSubmission(paymentAttemptId: string): Promise<PaymentAttempt> {
    const attempt = this.paymentAttempts.find((p) => p.id === paymentAttemptId);
    if (!attempt) throw new Error("Payment attempt not found");

    attempt.state = "SUBMITTED";
    attempt.hspStatus = "payment-processing";
    attempt.updatedAt = new Date().toISOString();

    // In demo mode, transition after 2 seconds to finalized
    setTimeout(() => {
      attempt.hspStatus = "payment-finalized";
      attempt.state = "FINALIZED";
      attempt.txHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}` as `0x${string}`;
      attempt.evidenceRegistryTx = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}` as `0x${string}`;

      // Update invoice to settled
      const inv = this.invoices.find((i) => i.id === attempt.invoiceId);
      if (inv) inv.status = "SETTLED";

      // Create verifiable receipt
      const receipt: VerifiableReceipt = {
        id: `rcpt-${Date.now().toString(36)}`,
        invoiceId: attempt.invoiceId,
        receiptVersion: "1",
        invoiceDigest: inv?.digest || "0x00",
        seller: inv?.sellerWallet || "0x00",
        sellerDisplayName: inv?.sellerDisplayName,
        buyerRef: inv?.buyerRef || "buyer-ref",
        deliveryEvidenceDigest: "0x8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b",
        payment: {
          hspStatus: "payment-finalized",
          flowId: attempt.flowId,
          paymentRequestId: attempt.paymentRequestId,
          txHash: attempt.txHash,
          payer: attempt.payer,
          payee: attempt.payee,
          tokenTotalRaw: attempt.tokenTotalRaw,
          tokenSymbol: "USDT",
          humanAmount: attempt.approvalSummary.humanAmount,
          finalizedAt: new Date().toISOString(),
        },
        evidenceRegistryTx: attempt.evidenceRegistryTx,
        issuedAt: new Date().toISOString(),
        rawPayloadJson: JSON.stringify(
          {
            receipt_version: "1",
            invoice_id: attempt.invoiceId,
            flow_id: attempt.flowId,
            payment_request_id: attempt.paymentRequestId,
            tx_hash: attempt.txHash,
            status: "payment-finalized",
            timestamp: new Date().toISOString(),
          },
          null,
          2
        ),
      };
      this.receipts.unshift(receipt);
    }, 1500);

    return { ...attempt };
  }

  async getPaymentStatus(invoiceId: string): Promise<PaymentAttempt> {
    const attempt = this.paymentAttempts.find((p) => p.invoiceId === invoiceId);
    if (!attempt) throw new Error(`No payment attempt found for invoice ${invoiceId}`);
    return { ...attempt };
  }

  async getReceipt(invoiceId: string): Promise<VerifiableReceipt> {
    const receipt = this.receipts.find((r) => r.invoiceId === invoiceId);
    if (!receipt) throw new Error(`No receipt found for invoice ${invoiceId}`);
    return receipt;
  }
}

class ConnectedModeClient implements HashXClient {
  private baseUrl = process.env.NEXT_PUBLIC_HASHX_API_URL || "https://api.hashx.global/v1";

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`HashX API Error (${res.status}): ${errorText || res.statusText}`);
      }

      return res.json();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error";
      throw new Error(`Connected Backend Unavailable: ${message}. Ensure persistent backend with allowlisted egress IP is active.`);
    }
  }

  async getInvoices(): Promise<Invoice[]> {
    return this.request<Invoice[]>("/invoices");
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    return this.request<Invoice | null>(`/invoices/${id}`);
  }

  async getDeliveries(): Promise<Delivery[]> {
    return this.request<Delivery[]>("/deliveries");
  }

  async getDeliveryByInvoiceId(invoiceId: string): Promise<Delivery | null> {
    return this.request<Delivery | null>(`/invoices/${invoiceId}/delivery`);
  }

  async getPaymentAttempts(): Promise<PaymentAttempt[]> {
    return this.request<PaymentAttempt[]>("/payments");
  }

  async getPaymentAttemptById(id: string): Promise<PaymentAttempt | null> {
    return this.request<PaymentAttempt | null>(`/payments/${id}`);
  }

  async getReceipts(): Promise<VerifiableReceipt[]> {
    return this.request<VerifiableReceipt[]>("/receipts");
  }

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    return this.request<Invoice>("/invoices", { method: "POST", body: JSON.stringify(input) });
  }

  async signInvoice(input: SignInvoiceInput): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${input.invoice_id}/sign`, { method: "POST", body: JSON.stringify(input) });
  }

  async verifyInvoice(input: VerifyInvoiceInput): Promise<InvoiceVerificationResult> {
    return this.request<InvoiceVerificationResult>(`/invoices/${input.invoice_id}/verify`, { method: "POST", body: JSON.stringify(input) });
  }

  async submitDelivery(input: SubmitDeliveryInput): Promise<Delivery> {
    return this.request<Delivery>(`/invoices/${input.invoice_id}/delivery`, { method: "POST", body: JSON.stringify(input) });
  }

  async verifyDelivery(input: VerifyDeliveryInput): Promise<DeliveryVerificationResult> {
    return this.request<DeliveryVerificationResult>(`/invoices/${input.invoice_id}/delivery/verify`, { method: "POST", body: JSON.stringify(input) });
  }

  async requestPayment(input: RequestPaymentInput): Promise<PaymentAttempt> {
    return this.request<PaymentAttempt>(`/invoices/${input.invoice_id}/pay`, { method: "POST", body: JSON.stringify(input) });
  }

  async getPaymentStatus(invoiceId: string): Promise<PaymentAttempt> {
    return this.request<PaymentAttempt>(`/invoices/${invoiceId}/payment-status`);
  }

  async getReceipt(invoiceId: string): Promise<VerifiableReceipt> {
    return this.request<VerifiableReceipt>(`/invoices/${invoiceId}/receipt`);
  }
}

// Singleton instances
export const demoClient = new DemoModeClient();
export const connectedClient = new ConnectedModeClient();

export function getClient(mode: "demo" | "connected" = "demo"): HashXClient {
  return mode === "connected" ? connectedClient : demoClient;
}
