// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { HashXEvidenceRegistry } from "../src/HashXEvidenceRegistry.sol";

/**
 * @title DeployEvidenceRegistryScript
 * @notice Deployment script for HashKey Chain Testnet (Chain ID 133) / Mainnet (Chain ID 177).
 *
 * USAGE (REQUIRES USER EXPLICIT APPROVAL AND PRIVATE KEY):
 * forge script script/Deploy.s.sol:DeployEvidenceRegistryScript \
 *   --rpc-url https://testnet.hsk.xyz \
 *   --broadcast \
 *   --verify
 */
contract DeployEvidenceRegistryScript {
    function run() external returns (address deployedAddress) {
        // Do not broadcast transactions without explicit user approval
        HashXEvidenceRegistry registry = new HashXEvidenceRegistry();
        return address(registry);
    }
}

