const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HashXEvidenceRegistry v2", function () {
  let registry, issuer, attacker, other;
  const inv = ethers.keccak256(ethers.toUtf8Bytes("invoice-digest-1"));
  const del = ethers.keccak256(ethers.toUtf8Bytes("delivery-digest-1"));
  const rcpt = ethers.keccak256(ethers.toUtf8Bytes("receipt-digest-1"));

  beforeEach(async function () {
    [issuer, attacker, other] = await ethers.getSigners();
    registry = await (await ethers.getContractFactory("HashXEvidenceRegistry")).deploy();
    await registry.waitForDeployment();
  });

  it("exposes VERSION 2 and has code", async function () {
    expect(await registry.VERSION()).to.equal("2");
    expect(await ethers.provider.getCode(await registry.getAddress())).to.not.equal("0x");
  });

  it("records the full lifecycle in order with timestamps and indexed events", async function () {
    await expect(registry.connect(issuer).commitInvoice(inv))
      .to.emit(registry, "InvoiceCommitted")
      .withArgs(issuer.address, inv, (t) => t > 0n);
    await expect(registry.connect(issuer).commitDelivery(inv, del))
      .to.emit(registry, "DeliveryCommitted")
      .withArgs(issuer.address, inv, del, (t) => t > 0n);
    await expect(registry.connect(issuer).commitReceipt(inv, rcpt))
      .to.emit(registry, "ReceiptCommitted")
      .withArgs(issuer.address, inv, rcpt, (t) => t > 0n);
    const ev = await registry.getEvidence(issuer.address, inv);
    expect(ev.deliveryCommitment).to.equal(del);
    expect(ev.receiptCommitment).to.equal(rcpt);
    expect(ev.invoiceCommittedAt).to.be.greaterThan(0n);
    expect(ev.receiptCommittedAt).to.be.greaterThanOrEqual(ev.deliveryCommittedAt);
    expect(await registry.isInvoiceCommitted(issuer.address, inv)).to.equal(true);
  });

  it("rejects zero commitments", async function () {
    await expect(registry.commitInvoice(ethers.ZeroHash)).to.be.revertedWithCustomError(registry, "ZeroCommitment");
    await registry.commitInvoice(inv);
    await expect(registry.commitDelivery(inv, ethers.ZeroHash)).to.be.revertedWithCustomError(registry, "ZeroCommitment");
    await expect(registry.commitReceipt(inv, ethers.ZeroHash)).to.be.revertedWithCustomError(registry, "ZeroCommitment");
  });

  it("is write-once for every commitment", async function () {
    await registry.commitInvoice(inv);
    await expect(registry.commitInvoice(inv)).to.be.revertedWithCustomError(registry, "InvoiceAlreadyCommitted");
    await registry.commitDelivery(inv, del);
    await expect(registry.commitDelivery(inv, rcpt)).to.be.revertedWithCustomError(registry, "DeliveryAlreadyCommitted");
    await registry.commitReceipt(inv, rcpt);
    await expect(registry.commitReceipt(inv, del)).to.be.revertedWithCustomError(registry, "ReceiptAlreadyCommitted");
  });

  it("enforces ordering: delivery needs invoice, receipt needs delivery", async function () {
    await expect(registry.commitDelivery(inv, del)).to.be.revertedWithCustomError(registry, "InvoiceNotFound");
    await expect(registry.commitReceipt(inv, rcpt)).to.be.revertedWithCustomError(registry, "InvoiceNotFound");
    await registry.commitInvoice(inv);
    await expect(registry.commitReceipt(inv, rcpt)).to.be.revertedWithCustomError(registry, "DeliveryRequired");
  });

  it("front-running a public invoice digest cannot block or hijack the real issuer", async function () {
    // Attacker observes the digest and commits first.
    await registry.connect(attacker).commitInvoice(inv);
    // Real issuer still commits successfully into their own namespace.
    await expect(registry.connect(issuer).commitInvoice(inv)).to.not.be.reverted;
    await registry.connect(issuer).commitDelivery(inv, del);
    // Attacker cannot write into the issuer's record...
    expect((await registry.getEvidence(issuer.address, inv)).deliveryCommitment).to.equal(del);
    // ...and the attacker's record stays separate.
    expect((await registry.getEvidence(attacker.address, inv)).deliveryCommitment).to.equal(ethers.ZeroHash);
  });

  it("other accounts cannot append to an issuer's record", async function () {
    await registry.connect(issuer).commitInvoice(inv);
    await expect(registry.connect(other).commitDelivery(inv, del)).to.be.revertedWithCustomError(registry, "InvoiceNotFound");
  });

  it("is non-custodial: rejects ETH transfers", async function () {
    await expect(issuer.sendTransaction({ to: await registry.getAddress(), value: 1n })).to.be.reverted;
    expect(await ethers.provider.getBalance(await registry.getAddress())).to.equal(0n);
  });

  it("stays within gas bounds", async function () {
    const r1 = await (await registry.commitInvoice(inv)).wait();
    const r2 = await (await registry.commitDelivery(inv, del)).wait();
    const r3 = await (await registry.commitReceipt(inv, rcpt)).wait();
    expect(r1.gasUsed).to.be.lessThan(80000n);
    expect(r2.gasUsed).to.be.lessThan(80000n);
    expect(r3.gasUsed).to.be.lessThan(80000n);
  });
});

describe("LocalTestUSDC (local CI only)", function () {
  it("has 6 decimals and emits Transfer logs", async function () {
    const [minter, a, b] = await ethers.getSigners();
    const t = await (await ethers.getContractFactory("LocalTestUSDC")).deploy();
    expect(await t.decimals()).to.equal(6n);
    await t.mint(a.address, 5_000_000n);
    await expect(t.connect(a).transfer(b.address, 1_250_000n)).to.emit(t, "Transfer").withArgs(a.address, b.address, 1_250_000n);
    await expect(t.connect(b).transfer(a.address, 10_000_000n)).to.be.revertedWithCustomError(t, "InsufficientBalance");
    await expect(t.connect(a).mint(a.address, 1n)).to.be.revertedWithCustomError(t, "NotMinter");
    expect(await t.balanceOf(minter.address)).to.equal(0n);
  });
});
