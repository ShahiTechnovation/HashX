/**
 * Executable agent-to-agent golden path:
 *   seller AGENT (MCP) → invoice → seller-wallet signature → delivery → verification
 *   → buyer AGENT (MCP) requests payment → HUMAN buyer wallet: Stage 1, Stage 2, transfer
 *   → backend reconciliation → verifiable receipt.
 *
 * The buyer steps use the buyer's own wallet key here only because this script stands in for the
 * human operating their wallet in a local demo. The HashX backend never holds or uses any key, and
 * no MCP tool can perform these steps.
 *
 * Local run (three terminals):
 *   1) pnpm --prefix contracts node                      # local EVM on :8545
 *   2) configure server/.env for the local chain (see docs/END_TO_END_DEMO.md) and `pnpm --prefix server dev`
 *   3) pnpm --prefix server example:golden-path
 *
 * Env: HASHX_API_URL, RPC_URL, CHAIN_ID, SELLER_PRIVATE_KEY, BUYER_PRIVATE_KEY, SUBJECT_ADDRESS,
 *      SIWE_DOMAIN (default localhost:3000), SIWE_URI (default http://localhost:3000).
 * Never put real-funds keys in these variables.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";
import { computeAddressAnalytics, type MinimalBlock } from "../../shared/protocol.js";

export interface GoldenPathOptions {
  apiUrl: string;
  rpcUrl: string;
  chainId: number;
  sellerKey: Hex;
  buyerKey: Hex;
  subject: Hex;
  startBlock: number;
  endBlock: number;
  amountRaw: string;
  siweDomain?: string;
  siweUri?: string;
  /** Called after the transfer so local chains can mine confirmation blocks. */
  afterTransfer?: () => Promise<void>;
  log?: (msg: string) => void;
}

async function api(base: string, token: string | null, method: string, path: string, body?: unknown) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json?.code}: ${json?.error}`);
  return json;
}

async function signIn(o: GoldenPathOptions, account: PrivateKeyAccount): Promise<string> {
  const { nonce } = await api(o.apiUrl, null, "GET", "/auth/nonce");
  const message = createSiweMessage({
    address: account.address,
    chainId: o.chainId,
    domain: o.siweDomain ?? "localhost:3000",
    uri: o.siweUri ?? "http://localhost:3000",
    nonce,
    version: "1",
    issuedAt: new Date(),
    expirationTime: new Date(Date.now() + 600_000),
  });
  const signature = await account.signMessage({ message });
  return (await api(o.apiUrl, null, "POST", "/auth/verify", { message, signature })).token;
}

async function mcp(apiUrl: string, secret: string) {
  const client = new Client({ name: "hashx-example-agent", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${apiUrl}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${secret}` } } }));
  const call = async (name: string, args: Record<string, unknown>) => {
    const r: any = await client.callTool({ name, arguments: args });
    const parsed = JSON.parse(r.content[0].text);
    if (r.isError) throw new Error(`${name}: ${parsed.code} ${parsed.error}`);
    return parsed;
  };
  return { client, call };
}

const signTyped = (a: PrivateKeyAccount, td: any) =>
  a.signTypedData({ domain: td.domain, types: td.types, primaryType: td.primaryType, message: td.message });

export async function runGoldenPath(o: GoldenPathOptions) {
  const log = o.log ?? ((m: string) => console.log(m));
  const seller = privateKeyToAccount(o.sellerKey);
  const buyer = privateKeyToAccount(o.buyerKey);
  const pub = createPublicClient({ transport: http(o.rpcUrl) });

  // Humans sign in once and mint scoped agent credentials.
  const sellerSession = await signIn(o, seller);
  const buyerSession = await signIn(o, buyer);
  const sellerCred = await api(o.apiUrl, sellerSession, "POST", "/agent-credentials", {
    label: "seller analytics agent",
    scopes: ["invoices:read", "invoices:write", "deliveries:write", "verification:run"],
  });
  const buyerCred = await api(o.apiUrl, buyerSession, "POST", "/agent-credentials", {
    label: "buyer procurement agent",
    scopes: ["invoices:read", "verification:run", "payments:request", "payments:read"],
  });
  const sellerAgent = await mcp(o.apiUrl, sellerCred.secret);
  const buyerAgent = await mcp(o.apiUrl, buyerCred.secret);

  // 1–3. Seller agent creates the invoice; the seller wallet signs; HashX verifies.
  const created = await sellerAgent.call("create_invoice", {
    client_request_id: `example-${Date.now()}`,
    buyer_wallet: buyer.address,
    buyer_ref: "procurement-agent/PO-42",
    service: {
      type: "evm_address_analytics_v1",
      delivery_chain_id: o.chainId,
      parameters: { address: o.subject, start_block: String(o.startBlock), end_block: String(o.endBlock) },
      acceptance_policy: "exact_recompute_v1",
    },
    payment: { rail: "sepolia-usdc", settlement_chain_id: o.chainId, amount_raw: o.amountRaw, payee: seller.address },
  });
  const invoiceId: string = created.invoice.id;
  log(`invoice created: ${invoiceId} digest=${created.invoice.digest}`);
  await sellerAgent.call("sign_invoice", { invoice_id: invoiceId, signature: await signTyped(seller, created.typedData) });
  const iv = await sellerAgent.call("verify_invoice", { invoice_id: invoiceId });
  log(`invoice verification: ${iv.decision}`);

  // 4–5. Seller agent computes the artifact, the seller wallet signs the manifest, HashX recomputes independently.
  const blocks: MinimalBlock[] = [];
  for (let b = o.startBlock; b <= o.endBlock; b++) {
    const blk = await pub.getBlock({ blockNumber: BigInt(b), includeTransactions: true });
    blocks.push({ number: blk.number!, transactions: blk.transactions.map((t) => ({ hash: t.hash, from: t.from, to: t.to ?? null, value: t.value })) });
  }
  const artifact = computeAddressAnalytics({ chainId: o.chainId, address: o.subject, startBlock: o.startBlock, endBlock: o.endBlock, blocks, maxSamples: 10 }).artifact;
  const prep = await sellerAgent.call("prepare_delivery", { invoice_id: invoiceId, artifact_uri: "example://artifact.json", artifact_content: artifact });
  await sellerAgent.call("submit_delivery", {
    invoice_id: invoiceId,
    artifact_uri: "example://artifact.json",
    artifact_content: artifact,
    manifest: prep.manifest,
    manifest_signature: await signTyped(seller, prep.typedData),
  });
  const dv = await buyerAgent.call("verify_delivery", { invoice_id: invoiceId });
  log(`delivery verification (independent RPC recomputation): ${dv.decision}`);
  if (dv.decision !== "PASS") throw new Error(`delivery not verified: ${dv.reasonCodes.join(",")}`);

  // 6. Buyer agent may only REQUEST payment.
  const req = await buyerAgent.call("request_payment", { invoice_id: invoiceId });
  const attempt = req.attempt;
  log(`payment requested: ${attempt.id} (humanApprovalRequired=${req.humanApprovalRequired})`);

  // 7–9. HUMAN buyer: Stage 1 (exact terms), Stage 2 (wallet EIP-712), wallet broadcast.
  await api(o.apiUrl, buyerSession, "POST", `/payments/${attempt.id}/approve-terms`, { authorization_digest: attempt.authorization.digest });
  const authorized = await api(o.apiUrl, buyerSession, "POST", `/payments/${attempt.id}/authorize`, {
    signature: await signTyped(buyer, attempt.authorizationTypedData),
  });
  const ins = authorized.transferInstructions;
  const wallet = createWalletClient({ account: buyer, transport: http(o.rpcUrl) });
  const txHash = await wallet.sendTransaction({ account: buyer, chain: null, to: ins.to, data: ins.data, value: 0n });
  await pub.waitForTransactionReceipt({ hash: txHash });
  log(`buyer wallet broadcast transfer: ${txHash}`);
  await api(o.apiUrl, buyerSession, "POST", `/payments/${attempt.id}/transaction`, { tx_hash: txHash });
  await o.afterTransfer?.();

  // 10–13. Backend independently verifies and reconciles; receipt issued only after confirmation policy.
  let state = "";
  for (let i = 0; i < 60; i++) {
    const p = await api(o.apiUrl, buyerSession, "POST", `/payments/${attempt.id}/reconcile`);
    state = p.state;
    log(`reconciliation: ${state} (${p.confirmations} confirmations, policy ${p.finalityPolicy})`);
    if (["CONFIRMED", "FINALIZED", "FAILED", "DROPPED"].includes(state)) break;
    await new Promise((r) => setTimeout(r, o.afterTransfer ? 50 : 12_000));
    await o.afterTransfer?.();
  }
  if (!["CONFIRMED", "FINALIZED"].includes(state)) throw new Error(`settlement not confirmed (state ${state})`);
  const receipt = await buyerAgent.call("get_receipt", { invoice_id: invoiceId });
  log(`receipt ${receipt.id} digest=${receipt.receiptDigest} tx=${receipt.document.settlement.txHash}`);
  await sellerAgent.client.close();
  await buyerAgent.client.close();
  return { invoiceId, attemptId: attempt.id, txHash, receipt };
}

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  const env = process.env;
  const need = (k: string) => {
    if (!env[k]) throw new Error(`Missing env ${k}`);
    return env[k]!;
  };
  runGoldenPath({
    apiUrl: env.HASHX_API_URL ?? "http://127.0.0.1:8080",
    rpcUrl: env.RPC_URL ?? "http://127.0.0.1:8545",
    chainId: Number(env.CHAIN_ID ?? 31337),
    sellerKey: need("SELLER_PRIVATE_KEY") as Hex,
    buyerKey: need("BUYER_PRIVATE_KEY") as Hex,
    subject: need("SUBJECT_ADDRESS") as Hex,
    startBlock: Number(need("START_BLOCK")),
    endBlock: Number(need("END_BLOCK")),
    amountRaw: env.AMOUNT_RAW ?? "1000000",
    siweDomain: env.SIWE_DOMAIN,
    siweUri: env.SIWE_URI,
  })
    .then((r) => console.log(`\nGOLDEN PATH COMPLETE: invoice=${r.invoiceId} tx=${r.txHash} receipt=${r.receipt.id}`))
    .catch((err) => {
      console.error(`golden path failed: ${err.message}`);
      process.exit(1);
    });
}
