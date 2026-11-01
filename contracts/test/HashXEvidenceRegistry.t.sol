// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { HashXEvidenceRegistry, IHashXEvidenceRegistry } from "../src/HashXEvidenceRegistry.sol";

// Minimal forge-std interface for compatibility
abstract contract Test {
    address internal constant HEVM_ADDRESS = address(uint160(uint256(keccak256("hevm cheat code"))));
    function vmPrank(address newSender) internal {
        (bool s,) = HEVM_ADDRESS.call(abi.encodeWithSignature("prank(address)", newSender));
        require(s, "prank failed");
    }
}

contract HashXEvidenceRegistryTest {
    HashXEvidenceRegistry registry;
    address seller = address(0x1111111111111111111111111111111111111111);
    address attacker = address(0x9999999999999999999999999999999999999999);

    bytes32 dummyInvoiceCommitment = keccak256("invoice_agreement_v1_001");
    bytes32 dummyDeliveryCommitment = keccak256("delivery_analytics_v1_001");
    bytes32 dummyReceiptCommitment = keccak256("receipt_settlement_v1_001");

    function setUp() public {
        registry = new HashXEvidenceRegistry();
    }

    function test_CommitInvoice_Success() public {
        registry.commitInvoice(dummyInvoiceCommitment);
        IHashXEvidenceRegistry.Evidence memory ev = registry.getEvidence(dummyInvoiceCommitment);
        require(ev.issuer == address(this), "Issuer mismatch");
        require(ev.deliveryCommitment == bytes32(0), "Delivery should be zero");
        require(ev.receiptCommitment == bytes32(0), "Receipt should be zero");
        require(ev.invoiceCommittedAt > 0, "Timestamp must be recorded");
    }

    function test_CommitInvoice_RevertIfZero() public {
        try registry.commitInvoice(bytes32(0)) {
            revert("Expected revert on zero commitment");
        } catch {}
    }

    function test_CommitInvoice_RevertIfDuplicate() public {
        registry.commitInvoice(dummyInvoiceCommitment);
        try registry.commitInvoice(dummyInvoiceCommitment) {
            revert("Expected revert on duplicate commitment");
        } catch {}
    }

    function test_CommitDelivery_Success() public {
        registry.commitInvoice(dummyInvoiceCommitment);
        registry.commitDelivery(dummyInvoiceCommitment, dummyDeliveryCommitment);
        IHashXEvidenceRegistry.Evidence memory ev = registry.getEvidence(dummyInvoiceCommitment);
        require(ev.deliveryCommitment == dummyDeliveryCommitment, "Delivery mismatch");
        require(ev.deliveryCommittedAt > 0, "Delivery timestamp must be set");
    }

    function test_CommitDelivery_RevertIfDeliveryWriteTwice() public {
        registry.commitInvoice(dummyInvoiceCommitment);
        registry.commitDelivery(dummyInvoiceCommitment, dummyDeliveryCommitment);
        try registry.commitDelivery(dummyInvoiceCommitment, keccak256("delivery_mutated")) {
            revert("Expected revert: delivery commitment is write-once");
        } catch {}
    }

    function test_CommitReceipt_Success() public {
        registry.commitInvoice(dummyInvoiceCommitment);
        registry.commitDelivery(dummyInvoiceCommitment, dummyDeliveryCommitment);
        registry.commitReceipt(dummyInvoiceCommitment, dummyReceiptCommitment);
        IHashXEvidenceRegistry.Evidence memory ev = registry.getEvidence(dummyInvoiceCommitment);
        require(ev.receiptCommitment == dummyReceiptCommitment, "Receipt mismatch");
        require(ev.receiptCommittedAt > 0, "Receipt timestamp must be set");
    }

    function test_CommitReceipt_RevertIfReceiptWriteTwice() public {
        registry.commitInvoice(dummyInvoiceCommitment);
        registry.commitReceipt(dummyInvoiceCommitment, dummyReceiptCommitment);
        try registry.commitReceipt(dummyInvoiceCommitment, keccak256("receipt_mutated")) {
            revert("Expected revert: receipt commitment is write-once");
        } catch {}
    }
}

