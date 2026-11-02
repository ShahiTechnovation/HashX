/**
 * Re-checks a recorded deployment against the chain (read-only, no keys needed).
 *
 *   SEPOLIA_RPC_URL=… npx hardhat run scripts/verify-deployment.js --network sepolia
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const { ethers, network, artifacts } = hre;
  const file = path.join(__dirname, "..", "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) throw new Error(`No deployment record at ${file} — the registry has not been deployed on ${network.name}.`);
  const rec = JSON.parse(fs.readFileSync(file, "utf8"));
  const checks = [];
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  checks.push(["chain_id", chainId === rec.chainId, `${chainId}`]);
  const receipt = await ethers.provider.getTransactionReceipt(rec.transactionHash);
  checks.push(["deployment_receipt", Boolean(receipt && receipt.status === 1 && receipt.contractAddress?.toLowerCase() === rec.address.toLowerCase()), rec.transactionHash]);
  const code = await ethers.provider.getCode(rec.address);
  const artifact = await artifacts.readArtifact("HashXEvidenceRegistry");
  checks.push(["bytecode_matches_artifact", code.toLowerCase() === artifact.deployedBytecode.toLowerCase(), ethers.keccak256(code)]);
  const reg = await ethers.getContractAt("HashXEvidenceRegistry", rec.address);
  const version = await reg.VERSION().catch(() => null);
  checks.push(["version_read", version === "2", String(version)]);
  for (const [name, ok, detail] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(28)} ${detail}`);
  if (!checks.every((c) => c[1])) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
