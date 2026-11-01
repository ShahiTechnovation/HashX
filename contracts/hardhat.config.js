require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "paris",
    },
  },
  paths: {
    sources: "./src",
    tests: "./test_hardhat",
    cache: "./cache_hardhat",
    artifacts: "./artifacts_hardhat"
  }
};
