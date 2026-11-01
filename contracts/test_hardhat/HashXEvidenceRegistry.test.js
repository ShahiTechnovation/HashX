const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HashXEvidenceRegistry — EVM Execution Tests", function () {
  let registry;
  let owner, issuer, buyer, attacker;

  const invoiceHash1 = ethers.keccak256(ethers.toUtf8Bytes("invoice_commercial_agreement_v1_001"));
  const invoiceHash2 = ethers.keccak256(ethers.toUtf8Bytes("invoice_commercial_agreement_v1_002"));
  const deliveryHash1 = ethers.keccak256(ethers.toUtf8Bytes("delivery_hsk_analytics_v1_block_1200000_1200500"));
  const receiptHash1 = ethers.keccak256(ethers.toUtf8Bytes("receipt_hsp_settlement_order_hsp_987654321"));

  beforeEach(async function () {
    [owner, issuer, buyer, attacker] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("HashXEvidenceRegistry");
    registry = await Factory.deploy();
    await registry.waitForDeployment();
  });

  describe("1. Successful Contract Deployment", function () {
    it("deploys successfully with non-empty bytecode and valid address", async function () {
      const address = await registry.getAddress();
      expect(address).to.be.properAddress;

      const code = await ethers.provider.getCode(address);
      expect(code).to.not.equal("0x");
      expect(code.length).to.be.greaterThan(100);
    });

    it("measures deployment gas usage", async function () {
      const deployTx = registry.deploymentTransaction();
      const receipt = await deployTx.wait();
      expect(receipt.gasUsed).to.be.lessThan(600000n);
      console.log(`      ⛽ Deployment Gas Used: ${receipt.gasUsed.toString()}`);
    });
  });

  describe("2. Invoice Commitment", function () {
    it("allows issuer to register a new invoice commitment", async function () {
      const tx = await registry.connect(issuer).commitInvoice(invoiceHash1);
      const receipt = await tx.wait();
      console.log(`      ⛽ commitInvoice Gas Used: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lessThan(100000n);

      const ev = await registry.getEvidence(invoiceHash1);
      expect(ev.issuer).to.equal(issuer.address);
      expect(ev.deliveryCommitment).to.equal(ethers.ZeroHash);
      expect(ev.receiptCommitment).to.equal(ethers.ZeroHash);
      expect(ev.invoiceCommittedAt).to.be.greaterThan(0);
      expect(ev.deliveryCommittedAt).to.equal(0);
      expect(ev.receiptCommittedAt).to.equal(0);
    });
  });

  describe("3. Duplicate Invoice Rejection", function () {
    it("reverts with InvoiceAlreadyCommitted if the same invoice is committed twice", async function () {
      await registry.connect(issuer).commitInvoice(invoiceHash1);
      await expect(
        registry.connect(issuer).commitInvoice(invoiceHash1)
      ).to.be.revertedWithCustomError(registry, "InvoiceAlreadyCommitted");

      // Even if another caller tries to re-register the same hash
      await expect(
        registry.connect(attacker).commitInvoice(invoiceHash1)
      ).to.be.revertedWithCustomError(registry, "InvoiceAlreadyCommitted");
    });
  });

  describe("4. Zero Commitment Rejection", function () {
    it("reverts commitInvoice if invoiceCommitment is zero", async function () {
      await expect(
        registry.connect(issuer).commitInvoice(ethers.ZeroHash)
      ).to.be.revertedWithCustomError(registry, "ZeroCommitment");
    });

    it("reverts commitDelivery if deliveryCommitment is zero", async function () {
      await registry.connect(issuer).commitInvoice(invoiceHash1);
      await expect(
        registry.connect(issuer).commitDelivery(invoiceHash1, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(registry, "ZeroCommitment");
    });

    it("reverts commitReceipt if receiptCommitment is zero", async function () {
      await registry.connect(issuer).commitInvoice(invoiceHash1);
      await expect(
        registry.connect(issuer).commitReceipt(invoiceHash1, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(registry, "ZeroCommitment");
    });
  });

  describe("5. Delivery Commitment", function () {
    it("allows the original issuer to commit verified delivery evidence", async function () {
      await registry.connect(issuer).commitInvoice(invoiceHash1);
      const tx = await registry.connect(issuer).commitDelivery(invoiceHash1, deliveryHash1);
      const receipt = await tx.wait();
      console.log(`      ⛽ commitDelivery Gas Used: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lessThan(70000n);

      const ev = await registry.getEvidence(invoiceHash1);
      expect(ev.deliveryCommitment).to.equal(deliveryHash1);
      expect(ev.deliveryCommittedAt).to.be.greaterThan(0);
      expect(ev.deliveryCommittedAt).to.be.greaterThanOrEqual(ev.invoiceCommittedAt);
    });
  });

  describe("6. Unauthorized Delivery Rejection", function () {
    it("reverts with UnauthorizedCaller if caller is not the invoice issuer", async function () {
      await registry.connect(issuer).commitInvoice(invoiceHash1);

      await expect(
        registry.connect(attacker).commitDelivery(invoiceHash1, deliveryHash1)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedCaller");

      // Verify delivery commitment remained untouched
      const ev = await registry.getEvidence(invoiceHash1);
      expect(ev.deliveryCommitment).to.equal(ethers.ZeroHash);
    });
  });

  describe("7. Receipt Commitment", function () {
    it("allows the original issuer to commit settlement receipt proof", async function () {
      await registry.connect(issuer).commitInvoice(invoiceHash1);
      await registry.connect(issuer).commitDelivery(invoiceHash1, deliveryHash1);
      const tx = await registry.connect(issuer).commitReceipt(invoiceHash1, receiptHash1);
      const receipt = await tx.wait();
      console.log(`      ⛽ commitReceipt Gas Used: ${receipt.gasUsed.toString()}`);
      expect(receipt.gasUsed).to.be.lessThan(70000n);

      const ev = await registry.getEvidence(invoiceHash1);
      expect(ev.receiptCommitment).to.equal(receiptHash1);
      expect(ev.receiptCommittedAt).to.be.greaterThan(0);
      expect(ev.receiptCommittedAt).to.be.greaterThanOrEqual(ev.deliveryCommittedAt);
    });
  });

  describe("8. Unauthorized Receipt Rejection", function () {
    it("reverts with UnauthorizedCaller if caller is not the invoice issuer", async function () {
      await registry.connect(issuer).commitInvoice(invoiceHash1);
      await registry.connect(issuer).commitDelivery(invoiceHash1, deliveryHash1);

      await expect(
        registry.connect(attacker).commitReceipt(invoiceHash1, receiptHash1)
      ).to.be.revertedWithCustomError(registry, "UnauthorizedCaller");

      // Verify receipt commitment remained untouched
      const ev = await registry.getEvidence(invoiceHash1);
      expect(ev.receiptCommitment).to.equal(ethers.ZeroHash);
    });
  });

  describe("9. Duplicate Commitment Rejection (Write-Once)", function () {
    it("reverts with DeliveryAlreadyCommitted if delivery is submitted twice", async function () {
      await registry.connect(issuer).commitInvoice(invoiceHash1);
      await registry.connect(issuer).commitDelivery(invoiceHash1, deliveryHash1);

      const mutatedDelivery = ethers.keccak256(ethers.toUtf8Bytes("mutated_delivery"));
      await expect(
        registry.connect(issuer).commitDelivery(invoiceHash1, mutatedDelivery)
      ).to.be.revertedWithCustomError(registry, "DeliveryAlreadyCommitted");

      // Confirm original delivery hash is preserved
      const ev = await registry.getEvidence(invoiceHash1);
      expect(ev.deliveryCommitment).to.equal(deliveryHash1);
    });

    it("reverts with ReceiptAlreadyCommitted if receipt is submitted twice", async function () {
      await registry.connect(issuer).commitInvoice(invoiceHash1);
      await registry.connect(issuer).commitDelivery(invoiceHash1, deliveryHash1);
      await registry.connect(issuer).commitReceipt(invoiceHash1, receiptHash1);

      const mutatedReceipt = ethers.keccak256(ethers.toUtf8Bytes("mutated_receipt"));
      await expect(
        registry.connect(issuer).commitReceipt(invoiceHash1, mutatedReceipt)
      ).to.be.revertedWithCustomError(registry, "ReceiptAlreadyCommitted");

      // Confirm original receipt hash is preserved
      const ev = await registry.getEvidence(invoiceHash1);
      expect(ev.receiptCommitment).to.equal(receiptHash1);
    });
  });

  describe("10. Invalid State Transition Rejection", function () {
    it("reverts with InvoiceNotFound when committing delivery for an uncommitted invoice", async function () {
      const nonExistentInvoice = ethers.keccak256(ethers.toUtf8Bytes("non_existent_invoice"));
      await expect(
        registry.connect(issuer).commitDelivery(nonExistentInvoice, deliveryHash1)
      ).to.be.revertedWithCustomError(registry, "InvoiceNotFound");
    });

    it("reverts with InvoiceNotFound when committing receipt for an uncommitted invoice", async function () {
      const nonExistentInvoice = ethers.keccak256(ethers.toUtf8Bytes("non_existent_invoice"));
      await expect(
        registry.connect(issuer).commitReceipt(nonExistentInvoice, receiptHash1)
      ).to.be.revertedWithCustomError(registry, "InvoiceNotFound");
    });
  });

  describe("11. Evidence Retrieval", function () {
    it("returns zero fields for an uncommitted invoice", async function () {
      const nonExistentInvoice = ethers.keccak256(ethers.toUtf8Bytes("unregistered_invoice"));
      const ev = await registry.getEvidence(nonExistentInvoice);
      expect(ev.issuer).to.equal(ethers.ZeroAddress);
      expect(ev.deliveryCommitment).to.equal(ethers.ZeroHash);
      expect(ev.receiptCommitment).to.equal(ethers.ZeroHash);
      expect(ev.invoiceCommittedAt).to.equal(0);
      expect(ev.deliveryCommittedAt).to.equal(0);
      expect(ev.receiptCommittedAt).to.equal(0);
    });

    it("accurately returns all evidence fields across the commercial lifecycle", async function () {
      // Step A: Invoice
      await registry.connect(issuer).commitInvoice(invoiceHash2);
      let ev = await registry.getEvidence(invoiceHash2);
      expect(ev.issuer).to.equal(issuer.address);
      expect(ev.deliveryCommitment).to.equal(ethers.ZeroHash);

      // Step B: Delivery
      await registry.connect(issuer).commitDelivery(invoiceHash2, deliveryHash1);
      ev = await registry.getEvidence(invoiceHash2);
      expect(ev.deliveryCommitment).to.equal(deliveryHash1);
      expect(ev.receiptCommitment).to.equal(ethers.ZeroHash);

      // Step C: Receipt
      await registry.connect(issuer).commitReceipt(invoiceHash2, receiptHash1);
      ev = await registry.getEvidence(invoiceHash2);
      expect(ev.issuer).to.equal(issuer.address);
      expect(ev.deliveryCommitment).to.equal(deliveryHash1);
      expect(ev.receiptCommitment).to.equal(receiptHash1);
      expect(ev.invoiceCommittedAt).to.be.greaterThan(0);
      expect(ev.deliveryCommittedAt).to.be.greaterThan(0);
      expect(ev.receiptCommittedAt).to.be.greaterThan(0);
    });
  });

  describe("12. Event Verification", function () {
    it("emits InvoiceCommitted event with indexed invoiceCommitment and issuer", async function () {
      await expect(registry.connect(issuer).commitInvoice(invoiceHash1))
        .to.emit(registry, "InvoiceCommitted")
        .withArgs(invoiceHash1, issuer.address);
    });

    it("emits DeliveryCommitted event with indexed invoiceCommitment and deliveryCommitment", async function () {
      await registry.connect(issuer).commitInvoice(invoiceHash1);
      await expect(registry.connect(issuer).commitDelivery(invoiceHash1, deliveryHash1))
        .to.emit(registry, "DeliveryCommitted")
        .withArgs(invoiceHash1, deliveryHash1);
    });

    it("emits ReceiptCommitted event with indexed invoiceCommitment and receiptCommitment", async function () {
      await registry.connect(issuer).commitInvoice(invoiceHash1);
      await registry.connect(issuer).commitDelivery(invoiceHash1, deliveryHash1);
      await expect(registry.connect(issuer).commitReceipt(invoiceHash1, receiptHash1))
        .to.emit(registry, "ReceiptCommitted")
        .withArgs(invoiceHash1, receiptHash1);
    });
  });

  describe("13. Immutability & Access Invariants", function () {
    it("guarantees write-once immutability for all commitments", async function () {
      await registry.connect(issuer).commitInvoice(invoiceHash1);
      await registry.connect(issuer).commitDelivery(invoiceHash1, deliveryHash1);
      await registry.connect(issuer).commitReceipt(invoiceHash1, receiptHash1);

      const evBefore = await registry.getEvidence(invoiceHash1);

      // Re-attempts fail
      await expect(
        registry.connect(issuer).commitInvoice(invoiceHash1)
      ).to.be.revertedWithCustomError(registry, "InvoiceAlreadyCommitted");

      await expect(
        registry.connect(issuer).commitDelivery(invoiceHash1, deliveryHash1)
      ).to.be.revertedWithCustomError(registry, "DeliveryAlreadyCommitted");

      await expect(
        registry.connect(issuer).commitReceipt(invoiceHash1, receiptHash1)
      ).to.be.revertedWithCustomError(registry, "ReceiptAlreadyCommitted");

      const evAfter = await registry.getEvidence(invoiceHash1);
      expect(evAfter.issuer).to.equal(evBefore.issuer);
      expect(evAfter.deliveryCommitment).to.equal(evBefore.deliveryCommitment);
      expect(evAfter.receiptCommitment).to.equal(evBefore.receiptCommitment);
      expect(evAfter.invoiceCommittedAt).to.equal(evBefore.invoiceCommittedAt);
      expect(evAfter.deliveryCommittedAt).to.equal(evBefore.deliveryCommittedAt);
      expect(evAfter.receiptCommittedAt).to.equal(evBefore.receiptCommittedAt);
    });
  });

  describe("14. Contract Gas Profile & Efficiency", function () {
    it("confirms all operations execute comfortably under target gas bounds", async function () {
      // 1. commitInvoice gas
      const tx1 = await registry.connect(issuer).commitInvoice(invoiceHash1);
      const r1 = await tx1.wait();
      expect(r1.gasUsed).to.be.lessThan(100000n);

      // 2. commitDelivery gas
      const tx2 = await registry.connect(issuer).commitDelivery(invoiceHash1, deliveryHash1);
      const r2 = await tx2.wait();
      expect(r2.gasUsed).to.be.lessThan(70000n);

      // 3. commitReceipt gas
      const tx3 = await registry.connect(issuer).commitReceipt(invoiceHash1, receiptHash1);
      const r3 = await tx3.wait();
      expect(r3.gasUsed).to.be.lessThan(70000n);

      console.log(`      📊 Lifecycle Gas Profile:`);
      console.log(`         • commitInvoice:  ${r1.gasUsed.toString()} gas`);
      console.log(`         • commitDelivery: ${r2.gasUsed.toString()} gas`);
      console.log(`         • commitReceipt:  ${r3.gasUsed.toString()} gas`);
      console.log(`         • Total Lifecycle: ${(r1.gasUsed + r2.gasUsed + r3.gasUsed).toString()} gas`);
    });
  });
});
