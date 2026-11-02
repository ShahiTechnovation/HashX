/**
 * Independent HashX receipt verifier — needs no HashX backend or database.
 *
 *   pnpm --prefix server verify-receipt <receipt.json> --rpc <RPC_URL>
 *
 * Checks, using only the receipt file and a public RPC of your choice:
 *  1. receiptDigest == keccak256(canonicalJson(body))
 *  2. invoice digest recomputes from the embedded terms; seller signature recovers to the seller
 *  3. delivery manifest digest recomputes; manifest signature recovers to the seller and binds the invoice digest
 *  4. authorization digest recomputes; payer signature recovers to the payer; it binds invoice + delivery digests,
 *     token, payee, amount and chain
 *  5. on-chain: RPC chain ID matches, tx succeeded, the referenced log is a Transfer from the
 *     token contract with exactly (payer → payee, amount), and its block is canonical.
 * Exit code 0 only if every check passes.
 */
import fs from "fs";
import { createPublicClient, decodeEventLog, http } from "viem";
import {
  ERC20_ABI,
  computeAuthorizationDigest,
  computeInvoiceDigest,
  computeManifestDigest,
  computeReceiptDigest,
  recoverAuthorizationSigner,
  recoverInvoiceSigner,
  recoverManifestSigner,
  sameAddress,
  type DeliveryManifest,
  type InvoiceTerms,
  type PaymentAuthorization,
  type ReceiptBody,
} from "../../../shared/protocol.js";

type Check = { name: string; ok: boolean; detail: string };

export async function verifyReceiptDocument(doc: ReceiptBody & { receiptDigest?: string }, rpcUrl?: string): Promise<Check[]> {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });
  const { receiptDigest, ...body } = doc;

  add("receipt_digest", computeReceiptDigest(body as ReceiptBody) === receiptDigest, `declared ${receiptDigest}`);

  const terms = body.invoice.terms as unknown as InvoiceTerms;
  const invDigest = computeInvoiceDigest(terms);
  add("invoice_digest", invDigest === body.invoice.digest, invDigest);
  const seller = await recoverInvoiceSigner(terms, body.invoice.sellerSignature);
  add("invoice_signature", sameAddress(seller, terms.seller), `recovered ${seller}`);

  const manifest = body.delivery.manifest as unknown as DeliveryManifest;
  const mDigest = computeManifestDigest(manifest, terms.signingChainId);
  add("delivery_evidence_digest", mDigest === body.delivery.evidenceDigest, mDigest);
  const mSigner = await recoverManifestSigner(manifest, terms.signingChainId, body.delivery.manifestSignature);
  add("manifest_signature", sameAddress(mSigner, terms.seller), `recovered ${mSigner}`);
  add("manifest_binds_invoice", manifest.invoiceDigest === body.invoice.digest && manifest.artifactSha256 === body.delivery.artifactSha256, manifest.invoiceDigest);

  const auth = body.authorization.message as unknown as PaymentAuthorization;
  const aDigest = computeAuthorizationDigest(auth);
  add("authorization_digest", aDigest === body.authorization.digest, aDigest);
  const payer = await recoverAuthorizationSigner(auth, body.authorization.payerSignature);
  add("authorization_signature", sameAddress(payer, auth.payer), `recovered ${payer}`);
  add(
    "authorization_binds_obligation",
    auth.invoiceDigest === body.invoice.digest &&
      auth.deliveryEvidenceDigest === body.delivery.evidenceDigest &&
      sameAddress(auth.payee, terms.payee) &&
      sameAddress(auth.token, terms.token) &&
      auth.amount === terms.amount &&
      auth.chainId === terms.settlementChainId &&
      sameAddress(auth.payer, terms.buyer),
    "invoice/delivery digests, payee, token, amount, chain, payer"
  );
  const s = body.settlement;
  add(
    "settlement_matches_authorization",
    sameAddress(s.from, auth.payer) && sameAddress(s.to, auth.payee) && sameAddress(s.token, auth.token) && s.amount === auth.amount && s.chainId === auth.chainId,
    `${s.from} -> ${s.to} ${s.amount}`
  );

  if (!rpcUrl) {
    add("onchain_transfer", false, "No --rpc provided: on-chain settlement NOT checked");
    return checks;
  }
  const client = createPublicClient({ transport: http(rpcUrl, { timeout: 15000 }) });
  const chainId = await client.getChainId();
  add("rpc_chain_id", chainId === s.chainId, `rpc=${chainId} receipt=${s.chainId}`);
  const receipt = await client.getTransactionReceipt({ hash: s.txHash });
  add("tx_success", receipt.status === "success", receipt.status);
  const log = receipt.logs.find((l) => Number(l.logIndex) === s.logIndex);
  let logOk = false;
  if (log && sameAddress(log.address, s.token)) {
    try {
      const ev = decodeEventLog({ abi: ERC20_ABI, data: log.data, topics: log.topics as any });
      const a = ev.args as unknown as { from: string; to: string; value: bigint };
      logOk = ev.eventName === "Transfer" && sameAddress(a.from, s.from) && sameAddress(a.to, s.to) && a.value.toString() === s.amount;
    } catch {
      logOk = false;
    }
  }
  add("transfer_log", logOk, `log #${s.logIndex} on ${s.token}`);
  const block = await client.getBlock({ blockNumber: BigInt(s.blockNumber) });
  add("block_canonical", block.hash?.toLowerCase() === s.blockHash.toLowerCase() && receipt.blockHash.toLowerCase() === s.blockHash.toLowerCase(), s.blockHash);
  const tip = await client.getBlockNumber();
  add("confirmations_now", tip >= BigInt(s.blockNumber), `${tip - BigInt(s.blockNumber) + 1n} confirmations at verification time`);
  return checks;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const rpcIdx = args.indexOf("--rpc");
  const rpc = rpcIdx >= 0 ? args[rpcIdx + 1] : process.env.VERIFY_RPC_URL;
  if (!file) {
    console.error("usage: verify-receipt <receipt.json> --rpc <RPC_URL>");
    process.exit(2);
  }
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  const checks = await verifyReceiptDocument(doc, rpc);
  for (const c of checks) console.log(`${c.ok ? "PASS" : "FAIL"}  ${c.name.padEnd(34)} ${c.detail}`);
  const allOk = checks.every((c) => c.ok);
  console.log(allOk ? "\nRECEIPT VERIFIED" : "\nRECEIPT NOT VERIFIED");
  process.exit(allOk ? 0 : 1);
}

if (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module) {
  main().catch((err) => {
    console.error(`verification error: ${err.message}`);
    process.exit(1);
  });
}
