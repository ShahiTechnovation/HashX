/**
 * LOCAL ONLY: deploys LocalTestUSDC to the local Hardhat node and mints test balances.
 *   npx hardhat run scripts/deploy-local-test-usdc.js --network localhost
 * Optional: MINT_TO=0xabc,0xdef (defaults to Hardhat accounts #1-#3), MINT_AMOUNT_RAW=1000000000
 */
const hre = require("hardhat");

async function main() {
  const { ethers, network } = hre;
  if (network.name !== "localhost" && network.name !== "hardhat") throw new Error("LocalTestUSDC must never be deployed to a public network");
  const signers = await ethers.getSigners();
  const token = await (await ethers.getContractFactory("LocalTestUSDC")).deploy();
  await token.waitForDeployment();
  const recipients = process.env.MINT_TO ? process.env.MINT_TO.split(",") : signers.slice(1, 4).map((s) => s.address);
  const amount = BigInt(process.env.MINT_AMOUNT_RAW || "1000000000");
  for (const r of recipients) await (await token.mint(r, amount)).wait();
  console.log(`LocalTestUSDC: ${await token.getAddress()}`);
  console.log(`Minted ${amount} raw units to: ${recipients.join(", ")}`);
  console.log(`Set LOCAL_SETTLEMENT_TOKEN_ADDRESS=${await token.getAddress()} in server/.env`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
