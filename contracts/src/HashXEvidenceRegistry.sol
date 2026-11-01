// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HashXEvidenceRegistry
 * @notice Timestamped on-chain commitment registry for HashX agent-to-agent commercial obligations.
 * 
 * SECURITY INVARIANTS (PRD Section 18-20):
 * - Non-custodial: Never holds tokens, escrow, or user funds.
 * - Append-only & write-once: No admin can alter, overwrite, or delete recorded commitments.
 * - Issuer exclusivity: Only the original invoice issuer may append delivery or receipt commitments.
 * - Non-zero & duplicate rejection: commitInvoice rejects bytes32(0) and duplicate commitments.
 */
interface IHashXEvidenceRegistry {
    struct Evidence {
        address issuer;
        bytes32 deliveryCommitment;
        bytes32 receiptCommitment;
        uint64 invoiceCommittedAt;
        uint64 deliveryCommittedAt;
        uint64 receiptCommittedAt;
    }

    event InvoiceCommitted(bytes32 indexed invoiceCommitment, address indexed issuer);
    event DeliveryCommitted(bytes32 indexed invoiceCommitment, bytes32 indexed deliveryCommitment);
    event ReceiptCommitted(bytes32 indexed invoiceCommitment, bytes32 indexed receiptCommitment);

    function commitInvoice(bytes32 invoiceCommitment) external;
    function commitDelivery(bytes32 invoiceCommitment, bytes32 deliveryCommitment) external;
    function commitReceipt(bytes32 invoiceCommitment, bytes32 receiptCommitment) external;
    function getEvidence(bytes32 invoiceCommitment) external view returns (Evidence memory);
}

contract HashXEvidenceRegistry is IHashXEvidenceRegistry {
    // invoiceCommitment => Evidence
    mapping(bytes32 => Evidence) private _evidences;

    error ZeroCommitment();
    error InvoiceAlreadyCommitted();
    error InvoiceNotFound();
    error UnauthorizedCaller();
    error DeliveryAlreadyCommitted();
    error ReceiptAlreadyCommitted();

    /**
     * @notice Registers a new signed invoice commitment.
     * @param invoiceCommitment Keccak-256 hash of the canonical signed invoice agreement.
     */
    function commitInvoice(bytes32 invoiceCommitment) external override {
        if (invoiceCommitment == bytes32(0)) revert ZeroCommitment();
        if (_evidences[invoiceCommitment].issuer != address(0)) revert InvoiceAlreadyCommitted();

        _evidences[invoiceCommitment] = Evidence({
            issuer: msg.sender,
            deliveryCommitment: bytes32(0),
            receiptCommitment: bytes32(0),
            invoiceCommittedAt: uint64(block.timestamp),
            deliveryCommittedAt: 0,
            receiptCommittedAt: 0
        });

        emit InvoiceCommitted(invoiceCommitment, msg.sender);
    }

    /**
     * @notice Attaches delivery fulfillment evidence digest to an existing invoice commitment.
     * @param invoiceCommitment The registered invoice commitment.
     * @param deliveryCommitment Keccak-256 digest of the verified fulfillment deliverable.
     */
    function commitDelivery(bytes32 invoiceCommitment, bytes32 deliveryCommitment) external override {
        if (deliveryCommitment == bytes32(0)) revert ZeroCommitment();
        Evidence storage ev = _evidences[invoiceCommitment];
        if (ev.issuer == address(0)) revert InvoiceNotFound();
        if (msg.sender != ev.issuer) revert UnauthorizedCaller();
        if (ev.deliveryCommitment != bytes32(0)) revert DeliveryAlreadyCommitted();

        ev.deliveryCommitment = deliveryCommitment;
        ev.deliveryCommittedAt = uint64(block.timestamp);

        emit DeliveryCommitted(invoiceCommitment, deliveryCommitment);
    }

    /**
     * @notice Attaches finalized settlement receipt digest to an existing invoice commitment.
     * @param invoiceCommitment The registered invoice commitment.
     * @param receiptCommitment Keccak-256 digest of the finalized settlement and receipt proof.
     */
    function commitReceipt(bytes32 invoiceCommitment, bytes32 receiptCommitment) external override {
        if (receiptCommitment == bytes32(0)) revert ZeroCommitment();
        Evidence storage ev = _evidences[invoiceCommitment];
        if (ev.issuer == address(0)) revert InvoiceNotFound();
        if (msg.sender != ev.issuer) revert UnauthorizedCaller();
        if (ev.receiptCommitment != bytes32(0)) revert ReceiptAlreadyCommitted();

        ev.receiptCommitment = receiptCommitment;
        ev.receiptCommittedAt = uint64(block.timestamp);

        emit ReceiptCommitted(invoiceCommitment, receiptCommitment);
    }

    /**
     * @notice Resolves all commitment timestamps and hashes for a given invoice.
     * @param invoiceCommitment The registered invoice commitment.
     */
    function getEvidence(bytes32 invoiceCommitment) external view override returns (Evidence memory) {
        return _evidences[invoiceCommitment];
    }
}

