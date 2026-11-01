const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const srcPath = path.join(__dirname, "src", "HashXEvidenceRegistry.sol");
const outDir = path.join(__dirname, "out");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log("Compiling HashXEvidenceRegistry.sol with native solc...");
const combinedJson = execSync(
  `solc --combined-json abi,bin,bin-runtime --optimize --optimize-runs 200 "${srcPath}"`,
  { encoding: "utf8" }
);

const parsed = JSON.parse(combinedJson);
const contractKey = Object.keys(parsed.contracts).find((k) => k.endsWith(":HashXEvidenceRegistry"));

if (!contractKey) {
  throw new Error("Could not find compiled HashXEvidenceRegistry contract");
}

const contractData = parsed.contracts[contractKey];
const artifact = {
  contractName: "HashXEvidenceRegistry",
  sourceName: "contracts/src/HashXEvidenceRegistry.sol",
  abi: contractData.abi,
  bytecode: "0x" + contractData.bin,
  deployedBytecode: "0x" + contractData["bin-runtime"],
  compilerVersion: parsed.version,
  generatedAt: new Date().toISOString(),
};

const artifactPath = path.join(outDir, "HashXEvidenceRegistry.json");
fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));

console.log(`Successfully compiled to: ${artifactPath}`);
console.log(`Bytecode size: ${contractData.bin.length / 2} bytes`);
console.log(`Runtime size: ${contractData["bin-runtime"].length / 2} bytes`);

