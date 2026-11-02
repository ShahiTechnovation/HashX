// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title HashXEvidenceRegistry (v2)
 * @notice Append-only, non-custodial, timestamped commitments for HashX agent-to-agent obligations.
 *
 * Commitment format (see docs/SECURITY_MODEL.md):
 *   invoiceCommitment  = EIP-712 digest of HashXInvoice v2 (domain {name:"HashX",version:"2",chainId})
 *   deliveryCommitment = EIP-712 digest of HashXDeliveryManifest v2
 *   receiptCommitment  = keccak256(canonical JSON of the hashx.receipt.v2 body)
 *
 * Security model:
 *  - Issuer-namespaced storage: evidence is keyed by (msg.sender, invoiceCommitment). Observing a
 *    pending commitInvoice() in the mempool and front-running it only creates an entry under the
 *    attacker's own address; it can never block or impersonate the real issuer's record.
 *  - Write-once: every commitment can be set exactly once; no admin, no upgrade, no deletion.
 *  - Ordering: delivery requires the invoice; receipt requires the delivery.
 *  - Non-custodial: no payable functions, no receive/fallback; the contract cannot hold funds.
 *  - Versioning: the invoice version is part of the EIP-712 digest, so a new version is a new commitment.
 *  - The registry attests WHO committed WHAT and WHEN. It does not prove the truth of the committed
 *    content; settlement truth comes from the ERC-20 Transfer log referenced by the receipt.
 */
contract HashXEvidenceRegistry {
    string public constant VERSION = "2";

    struct Evidence {
        bytes32 deliveryCommitment;
        bytes32 receiptCommitment;
        uint64 invoiceCommittedAt;
        uint64 deliveryCommittedAt;
        uint64 receiptCommittedAt;
    }

    mapping(address issuer => mapping(bytes32 invoiceCommitment => Evidence)) private _evidence;

    event InvoiceCommitted(address indexed issuer, bytes32 indexed invoiceCommitment, uint64 timestamp);
    event DeliveryCommitted(
        address indexed issuer, bytes32 indexed invoiceCommitment, bytes32 indexed deliveryCommitment, uint64 timestamp
    );
    event ReceiptCommitted(
        address indexed issuer, bytes32 indexed invoiceCommitment, bytes32 indexed receiptCommitment, uint64 timestamp
    );

    error ZeroCommitment();
    error InvoiceAlreadyCommitted();
    error InvoiceNotFound();
    error DeliveryAlreadyCommitted();
    error DeliveryRequired();
    error ReceiptAlreadyCommitted();

    function commitInvoice(bytes32 invoiceCommitment) external {
        if (invoiceCommitment == bytes32(0)) revert ZeroCommitment();
        Evidence storage ev = _evidence[msg.sender][invoiceCommitment];
        if (ev.invoiceCommittedAt != 0) revert InvoiceAlreadyCommitted();
        ev.invoiceCommittedAt = uint64(block.timestamp);
        emit InvoiceCommitted(msg.sender, invoiceCommitment, uint64(block.timestamp));
    }

    function commitDelivery(bytes32 invoiceCommitment, bytes32 deliveryCommitment) external {
        if (deliveryCommitment == bytes32(0)) revert ZeroCommitment();
        Evidence storage ev = _evidence[msg.sender][invoiceCommitment];
        if (ev.invoiceCommittedAt == 0) revert InvoiceNotFound();
        if (ev.deliveryCommitment != bytes32(0)) revert DeliveryAlreadyCommitted();
        ev.deliveryCommitment = deliveryCommitment;
        ev.deliveryCommittedAt = uint64(block.timestamp);
        emit DeliveryCommitted(msg.sender, invoiceCommitment, deliveryCommitment, uint64(block.timestamp));
    }

    function commitReceipt(bytes32 invoiceCommitment, bytes32 receiptCommitment) external {
        if (receiptCommitment == bytes32(0)) revert ZeroCommitment();
        Evidence storage ev = _evidence[msg.sender][invoiceCommitment];
        if (ev.invoiceCommittedAt == 0) revert InvoiceNotFound();
        if (ev.deliveryCommitment == bytes32(0)) revert DeliveryRequired();
        if (ev.receiptCommitment != bytes32(0)) revert ReceiptAlreadyCommitted();
        ev.receiptCommitment = receiptCommitment;
        ev.receiptCommittedAt = uint64(block.timestamp);
        emit ReceiptCommitted(msg.sender, invoiceCommitment, receiptCommitment, uint64(block.timestamp));
    }

    function getEvidence(address issuer, bytes32 invoiceCommitment) external view returns (Evidence memory) {
        return _evidence[issuer][invoiceCommitment];
    }

    function isInvoiceCommitted(address issuer, bytes32 invoiceCommitment) external view returns (bool) {
        return _evidence[issuer][invoiceCommitment].invoiceCommittedAt != 0;
    }
}
