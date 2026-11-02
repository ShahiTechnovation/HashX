require("@nomicfoundation/hardhat-toolbox");

/**
 * Networks:
 *  - hardhat / localhost: deterministic local EVM (chain 31337) used by CI.
 *  - sepolia: Ethereum Sepolia (11155111). Requires SEPOLIA_RPC_URL and DEPLOYER_PRIVATE_KEY
 *    supplied via the environment at deploy time. Keys are never committed or read from files in Git.
 */
const sepoliaAccounts = process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris" },
  },
  networks: {
    // HARDHAT_MIRROR_CHAIN=true (set by the backend test harness) mirrors real chains: failed transactions
    // are mined with status 0 instead of throwing. Contract unit tests keep Hardhat's default (throw).
    hardhat: { chainId: 31337, throwOnTransactionFailures: process.env.HARDHAT_MIRROR_CHAIN !== "true" },
    localhost: { url: process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545", chainId: 31337 },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      chainId: 11155111,
      accounts: sepoliaAccounts,
    },
  },
  etherscan: { apiKey: { sepolia: process.env.ETHERSCAN_API_KEY || "" } },
  paths: {
    sources: "./src",
    tests: "./test_hardhat",
    cache: "./cache_hardhat",
    artifacts: "./artifacts_hardhat",
  },
};
