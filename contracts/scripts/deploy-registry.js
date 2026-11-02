/**
 * Deploys HashXEvidenceRegistry v2 and records VERIFIED deployment facts.
 *
 *   SEPOLIA_RPC_URL=… DEPLOYER_PRIVATE_KEY=… npx hardhat run scripts/deploy-registry.js --network sepolia
 *
 * Requires explicit human authorization: set CONFIRM_DEPLOY=yes. The private key is read from the
 * environment by Hardhat only; it is never written anywhere.
 *
 * deployments/<network>.json is written ONLY after all of the following are confirmed on-chain:
 *   successful deployment receipt, expected chain ID, non-empty runtime bytecode matching the
 *   compiled artifact, and a working VERSION() read.
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const { ethers, network, artifacts } = hre;
  const expectedChainId = { sepolia: 11155111, localhost: 31337, hardhat: 31337 }[network.name];
  if (!expectedChainId) throw new Error(`Unsupported network ${network.name}`);
  if (network.name === "sepolia" && process.env.CONFIRM_DEPLOY !== "yes") {
    throw new Error("Refusing to broadcast: set CONFIRM_DEPLOY=yes to explicitly authorize a Sepolia deployment.");
  }

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  if (chainId !== expectedChainId) throw new Error(`RPC chain ID ${chainId} != expected ${expectedChainId}`);
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No deployer account (set DEPLOYER_PRIVATE_KEY in the environment)");
  console.log(`Deploying HashXEvidenceRegistry v2 to ${network.name} (${chainId}) from ${deployer.address}`);

  const factory = await ethers.getContractFactory("HashXEvidenceRegistry");
  const contract = await factory.deploy();
  const tx = contract.deploymentTransaction();
  console.log(`Deployment tx: ${tx.hash}`);
  const receipt = await tx.wait(network.name === "sepolia" ? 2 : 1);
  if (!receipt || receipt.status !== 1) throw new Error("Deployment transaction failed");
  const address = await contract.getAddress();

  const code = await ethers.provider.getCode(address);
  const artifact = await artifacts.readArtifact("HashXEvidenceRegistry");
  if (code === "0x") throw new Error("No code at deployed address");
  if (code.toLowerCase() !== artifact.deployedBytecode.toLowerCase()) throw new Error("On-chain bytecode does not match compiled artifact");
  const version = await contract.VERSION();
  if (version !== "2") throw new Error(`VERSION() returned ${version}`);

  const explorer = network.name === "sepolia" ? `https://sepolia.etherscan.io/address/${address}` : null;
  const record = {
    contract: "HashXEvidenceRegistry",
    version,
    network: network.name,
    chainId,
    address,
    deployer: deployer.address,
    transactionHash: tx.hash,
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
    runtimeBytecodeKeccak256: ethers.keccak256(code),
    compiler: "solc 0.8.28, optimizer 200 runs, evm paris",
    verification: {
      receiptStatus: "success",
      chainIdConfirmed: true,
      bytecodeMatchesArtifact: true,
      versionRead: version,
      explorerSourceVerified: false,
    },
    explorerUrl: explorer,
    recordedAt: new Date().toISOString(),
  };
  if (network.name === "hardhat") {
    console.log(JSON.stringify(record, null, 2));
    return;
  }
  const dir = path.join(__dirname, "..", "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
  console.log(`Verified deployment recorded in ${file}`);
  console.log(`Next: set EVIDENCE_REGISTRY_ADDRESS_SEPOLIA=${address} on the backend and optionally run:`);
  console.log(`  npx hardhat verify --network ${network.name} ${address}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
