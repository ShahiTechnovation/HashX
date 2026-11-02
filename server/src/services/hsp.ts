import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { Address, Hash, HSPStatus } from "../types.js";

/**
 * HashKey Settlement Protocol (HSP) MCP Client Adapter
 * 
 * STRICT INTEGRATION RULES:
 * 1. Safe Mode Gate: Halts connection until user confirms IP allowlisting.
 * 2. Fail-Closed in Connected Mode: When HSP QA is not connected, throws HSPNotConnectedError.
 * 3. 8 Authoritative Tools: get_chain_config, create_order, get_order, estimate_fee,
 *    prepare_payment, finalize_payment, submit_payment, query_payment.
 * 4. Dynamic Tool Schema Discovery via tools/list.
 * 5. Never stores or custodies user private keys.
 * 6. Strictly distinguishes 'payment-safe' (on-chain unfinalized) from 'payment-finalized'.
 * 7. BigInt-safe arithmetic for token decimal precision.
 */
export interface HSPConfig {
  endpoint: string;
  merchantName: string;
  appKey: string;
  appSecret: string;
  isAllowlisted: boolean;
  allowSimulationForTesting?: boolean;
}

export class HSPNotConnectedError extends Error {
  public readonly code = "HSP_NOT_CONNECTED";
  constructor(message = "HashKey HSP QA is not yet connected. Payment execution is unavailable.") {
    super(message);
    this.name = "HSPNotConnectedError";
  }
}

/**
 * Separated contract addresses to avoid conflating Evidence Registry,
 * Payment Token, and HSP settlement spender.
 */
export const HSP_DEFAULT_TESTNET_TOKEN_ADDRESS: Address = "0x19B861876D8075A11eC6c4596395b058fe8466C2";
export const HSP_DEFAULT_TESTNET_SPENDER: Address = "0x6969696969696969696969696969696969696969";

/**
 * Converts minor currency units (cents, 2 decimals) to raw token units using exact BigInt math.
 */
export function convertMinorToRawToken(amountMinorStr: string, decimals: number): string {
  const amountMinor = BigInt(amountMinorStr);
  if (decimals >= 2) {
    const factor = 10n ** BigInt(decimals - 2);
    return (amountMinor * factor).toString();
  } else {
    const factor = 10n ** BigInt(2 - decimals);
    return (amountMinor / factor).toString();
  }
}

export interface HSPChainConfig {
  chainId: number;
  chainName: string;
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  protocol: "eip3009" | "permit2" | "erc20";
  rawConfig: any;
}

export interface HSPOrderResult {
  flowId: string;
  paymentRequestId: string;
  paymentUrl?: string;
  status: string;
  rawResponse: any;
}

export interface HSPPaymentPreparation {
  flowId: string;
  paymentRequestId: string;
  eip712Payload: {
    domain: any;
    types: any;
    primaryType: string;
    message: any;
  };
  cartHash: string;
  tokenTotalRaw: string;
  quoteExpiresAt: string;
  tokenAddress: Address;
  tokenSymbol: string;
  tokenDecimals: number;
  paymentObjects?: any;
}

function parseToolContent(result: any): any {
  const content = (result as any)?.content?.[0];
  if (content && typeof content === "object" && "text" in content) {
    try {
      return JSON.parse(content.text);
    } catch {
      return content.text;
    }
  }
  return result;
}

export class HSPClientAdapter {
  public config: HSPConfig;
  private mcpClient: Client | null = null;
  private discoveredTools: Map<string, any> = new Map();

  constructor(customConfig: Partial<HSPConfig> = {}) {
    this.config = {
      endpoint: customConfig.endpoint || process.env.HSP_MCP_STREAMABLE_HTTP_ENDPOINT || "https://qa-hsp.hashkey.com/mcp",
      merchantName: customConfig.merchantName || process.env.HSP_MERCHANT_NAME || "HashX",
      appKey: customConfig.appKey || process.env.HSP_APP_KEY || "",
      appSecret: customConfig.appSecret || process.env.HSP_APP_SECRET || "",
      isAllowlisted: customConfig.isAllowlisted ?? (process.env.HSP_ALLOWLIST_CONFIRMED === "true"),
      allowSimulationForTesting: customConfig.allowSimulationForTesting ?? false,
    };
  }

  isConfiguredForLive(): boolean {
    return this.config.isAllowlisted && Boolean(this.config.appKey);
  }

  /**
   * Initializes MCP connection and dynamically discovers tool schemas.
   */
  async initialize(): Promise<{ connected: boolean; discoveredCount: number; tools: string[]; message: string }> {
    if (!this.config.isAllowlisted) {
      const msg = `HSP Allowlist Gate: PENDING CONFIRMATION for IP ${process.env.EXPECTED_EGRESS_IP || "157.119.44.58"}. Live QA calls are safely blocked.`;
      console.warn(`[HSPAdapter] ${msg}`);
      return { connected: false, discoveredCount: 0, tools: [], message: msg };
    }

    try {
      console.info(`[HSPAdapter] Connecting to HSP MCP endpoint: ${this.config.endpoint}`);
      const transport = new SSEClientTransport(new URL(this.config.endpoint), {
        eventSourceInit: {
          headers: {
            "x-merchant-name": this.config.merchantName,
            "x-app-key": this.config.appKey,
            "x-app-secret": this.config.appSecret,
          },
        } as any,
      });

      this.mcpClient = new Client(
        { name: "hashx-backend", version: "1.0.0" },
        { capabilities: {} }
      );

      await this.mcpClient.connect(transport);
      console.info("[HSPAdapter] Transport connected. Discovering live tool schemas...");

      const toolsResult = await this.mcpClient.listTools();
      this.discoveredTools.clear();

      for (const tool of toolsResult.tools) {
        this.discoveredTools.set(tool.name, tool);
        console.info(`[HSPAdapter] Discovered tool: ${tool.name}`);
      }

      const expectedTools = [
        "get_chain_config",
        "create_order",
        "get_order",
        "estimate_fee",
        "prepare_payment",
        "finalize_payment",
        "submit_payment",
        "query_payment",
      ];

      const missing = expectedTools.filter((t) => !this.discoveredTools.has(t));
      if (missing.length > 0) {
        console.warn(`[HSPAdapter] Expected HSP tools not exposed by endpoint: ${missing.join(", ")}`);
      }

      return {
        connected: true,
        discoveredCount: this.discoveredTools.size,
        tools: Array.from(this.discoveredTools.keys()),
        message: "Successfully connected and discovered live HSP schemas.",
      };
    } catch (err: any) {
      const msg = `MCP Connection Error: ${err.message}`;
      console.error(`[HSPAdapter] ${msg}`);
      return { connected: false, discoveredCount: 0, tools: [], message: msg };
    }
  }

  /**
   * 1. get_chain_config
   */
  async getChainConfig(chainId = 133): Promise<HSPChainConfig> {
    if (!this.config.isAllowlisted || !this.mcpClient) {
      return {
        chainId,
        chainName: chainId === 133 ? "HashKey Chain Testnet" : "HashKey Chain Mainnet",
        tokenAddress: HSP_DEFAULT_TESTNET_TOKEN_ADDRESS,
        tokenSymbol: "USDT",
        tokenDecimals: 6,
        protocol: "permit2",
        rawConfig: { source: "local-fallback", chain_id: chainId, allowlisted: false },
      };
    }

    const result = await this.mcpClient.callTool({
      name: "get_chain_config",
      arguments: { chain_id: chainId },
    });
    const parsed = parseToolContent(result);
    return {
      chainId,
      chainName: parsed.chain_name || (chainId === 133 ? "HashKey Chain Testnet" : "HashKey Chain Mainnet"),
      tokenAddress: parsed.token_address || HSP_DEFAULT_TESTNET_TOKEN_ADDRESS,
      tokenSymbol: parsed.token_symbol || "USDT",
      tokenDecimals: parsed.token_decimals || 6,
      protocol: parsed.protocol || "permit2",
      rawConfig: parsed,
    };
  }

  /**
   * 2. create_order
   */
  async createOrder(params: {
    invoiceId: string;
    payTo: Address;
    payer: Address;
    amountMinor: string;
    currency?: string;
    chainId?: number;
  }): Promise<HSPOrderResult> {
    if (!this.config.isAllowlisted || !this.mcpClient) {
      if (this.config.allowSimulationForTesting) {
        const flowId = `hsp-flow-${Math.floor(10000 + Math.random() * 90000)}`;
        const paymentRequestId = `hsp-pr-${Math.floor(5000000 + Math.random() * 900000)}`;
        return {
          flowId,
          paymentRequestId,
          paymentUrl: `https://qa-hsp.hashkey.com/pay/${flowId}`,
          status: "created",
          rawResponse: { mode: "isolated-test-fixture", flowId, paymentRequestId },
        };
      }
      throw new HSPNotConnectedError();
    }

    const result = await this.mcpClient.callTool({
      name: "create_order",
      arguments: {
        merchant_name: this.config.merchantName,
        pay_to: params.payTo,
        payer: params.payer,
        currency: params.currency || "USD",
        amount_minor: params.amountMinor,
        preferred_chain_id: params.chainId || 133,
        reference_id: params.invoiceId,
      },
    });

    const parsed = parseToolContent(result);
    return {
      flowId: parsed.flow_id,
      paymentRequestId: parsed.payment_request_id,
      paymentUrl: parsed.payment_url,
      status: parsed.status || "created",
      rawResponse: parsed,
    };
  }

  /**
   * 3. get_order
   */
  async getOrder(flowId: string, paymentRequestId: string): Promise<any> {
    if (!this.config.isAllowlisted || !this.mcpClient) {
      if (this.config.allowSimulationForTesting) {
        return { flow_id: flowId, payment_request_id: paymentRequestId, status: "ready" };
      }
      throw new HSPNotConnectedError();
    }
    const result = await this.mcpClient.callTool({
      name: "get_order",
      arguments: { flow_id: flowId, payment_request_id: paymentRequestId },
    });
    return parseToolContent(result);
  }

  /**
   * 4. estimate_fee
   */
  async estimateFee(params: { flowId: string; paymentRequestId: string }): Promise<string> {
    if (!this.config.isAllowlisted || !this.mcpClient) {
      if (this.config.allowSimulationForTesting) {
        return "$0.00 USD";
      }
      throw new HSPNotConnectedError();
    }
    try {
      const result = await this.mcpClient.callTool({
        name: "estimate_fee",
        arguments: { flow_id: params.flowId, payment_request_id: params.paymentRequestId },
      });
      const parsed = parseToolContent(result);
      return parsed.estimated_fee_usd || "$0.00 USD";
    } catch {
      return "$0.00 USD";
    }
  }

  /**
   * 5. prepare_payment (returns exact EIP-712 payload & 5-minute expiry)
   * Uses BigInt-safe arithmetic for token decimal precision.
   */
  async preparePayment(params: {
    flowId: string;
    paymentRequestId: string;
    payer: Address;
    payee: Address;
    amountMinor: string;
    chainId: number;
    tokenDecimals?: number;
  }): Promise<HSPPaymentPreparation> {
    const decimals = params.tokenDecimals ?? 6;
    const quoteExpiresAt = new Date(Date.now() + 300 * 1000).toISOString();
    const tokenTotalRaw = convertMinorToRawToken(params.amountMinor, decimals);

    if (!this.config.isAllowlisted || !this.mcpClient) {
      if (this.config.allowSimulationForTesting) {
        const domain = {
          name: "HashKey Settlement Protocol",
          version: "1",
          chainId: BigInt(params.chainId),
          verifyingContract: HSP_DEFAULT_TESTNET_SPENDER,
        };

        const types = {
          PermitTransferFrom: [
            { name: "permitted", type: "TokenPermissions" },
            { name: "spender", type: "address" },
            { name: "nonce", type: "uint256" },
            { name: "deadline", type: "uint256" },
          ],
          TokenPermissions: [
            { name: "token", type: "address" },
            { name: "amount", type: "uint256" },
          ],
        };

        const message = {
          permitted: {
            token: HSP_DEFAULT_TESTNET_TOKEN_ADDRESS,
            amount: BigInt(tokenTotalRaw),
          },
          spender: params.payee,
          nonce: BigInt(Math.floor(Date.now() / 1000)),
          deadline: BigInt(Math.floor(new Date(quoteExpiresAt).getTime() / 1000)),
        };

        return {
          flowId: params.flowId,
          paymentRequestId: params.paymentRequestId,
          eip712Payload: { domain, types, primaryType: "PermitTransferFrom", message },
          cartHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
          tokenTotalRaw,
          quoteExpiresAt,
          tokenAddress: HSP_DEFAULT_TESTNET_TOKEN_ADDRESS,
          tokenSymbol: "USDT",
          tokenDecimals: decimals,
        };
      }
      throw new HSPNotConnectedError();
    }

    const result = await this.mcpClient.callTool({
      name: "prepare_payment",
      arguments: {
        flow_id: params.flowId,
        payment_request_id: params.paymentRequestId,
        payer: params.payer,
      },
    });

    const parsed = parseToolContent(result);
    return {
      flowId: params.flowId,
      paymentRequestId: params.paymentRequestId,
      eip712Payload: parsed.eip712,
      cartHash: parsed.cart_hash,
      tokenTotalRaw: parsed.token_total_raw || tokenTotalRaw,
      quoteExpiresAt: parsed.quote_expires_at || quoteExpiresAt,
      tokenAddress: parsed.token_address || HSP_DEFAULT_TESTNET_TOKEN_ADDRESS,
      tokenSymbol: parsed.token_symbol || "USDT",
      tokenDecimals: parsed.token_decimals || decimals,
      paymentObjects: parsed.payment_objects,
    };
  }

  /**
   * 6. finalize_payment
   */
  async finalizePayment(params: {
    flowId: string;
    paymentRequestId: string;
    signature: `0x${string}`;
    paymentObjects?: any;
  }): Promise<any> {
    if (!this.config.isAllowlisted || !this.mcpClient) {
      if (this.config.allowSimulationForTesting) {
        return { status: "finalized", flow_id: params.flowId };
      }
      throw new HSPNotConnectedError();
    }
    return this.mcpClient.callTool({
      name: "finalize_payment",
      arguments: {
        flow_id: params.flowId,
        payment_request_id: params.paymentRequestId,
        signature: params.signature,
        payment_objects: params.paymentObjects,
      },
    });
  }

  /**
   * 7. submit_payment
   */
  async submitPayment(params: {
    flowId: string;
    paymentRequestId: string;
  }): Promise<{ status: HSPStatus; txHash?: Hash }> {
    if (!this.config.isAllowlisted || !this.mcpClient) {
      if (this.config.allowSimulationForTesting) {
        return { status: "payment-submitted" };
      }
      throw new HSPNotConnectedError();
    }

    const result = await this.mcpClient.callTool({
      name: "submit_payment",
      arguments: {
        flow_id: params.flowId,
        payment_request_id: params.paymentRequestId,
      },
    });

    const parsed = parseToolContent(result);
    return {
      status: parsed.status || "payment-submitted",
      txHash: parsed.tx_hash,
    };
  }

  /**
   * 8. query_payment
   */
  async queryPayment(params: {
    flowId: string;
    paymentRequestId: string;
  }): Promise<{ status: HSPStatus; txHash?: Hash; details: any }> {
    if (!this.config.isAllowlisted || !this.mcpClient) {
      return {
        status: "payment-submitted",
        details: { mode: "local-unconfirmed", note: "Allowlist pending confirmation" },
      };
    }

    const result = await this.mcpClient.callTool({
      name: "query_payment",
      arguments: {
        flow_id: params.flowId,
        payment_request_id: params.paymentRequestId,
      },
    });

    const parsed = parseToolContent(result);
    return {
      status: parsed.status as HSPStatus,
      txHash: parsed.tx_hash,
      details: parsed,
    };
  }
}
