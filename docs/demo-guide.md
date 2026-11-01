# HashX Global V1 — Demo Guide & Judge Walkthrough

This guide details how to reproduce and inspect the four core demonstration journeys in HashX Global.

All scenarios can be directly accessed and verified interactively in the web application at `/app/demo`.

---

## Scenario A — Tampered Invoice Payee
- **Objective**: Prove that an in-flight alteration to a signed commercial invoice is detected and permanently blocked from payment.
- **Setup**:
  - The seller signed a $1.00 USD agreement (`inv-tampered-scenario-a`) committing to payee wallet `0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7`.
  - In flight, the payee field was mutated to attacker wallet `0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe`.
- **How to verify**:
  1. Navigate to `/app/demo` and select **Scenario A**.
  2. Click **Open in Trust Inspector** (or navigate to `/app/trust/inv-tampered-scenario-a`).
  3. Observe the prominent red banner: `VERDICT: FAIL — PAYMENT BLOCKED`.
  4. Expand the **Signature** check: Diagnosis indicates `SIGNATURE_INVALID`.
  5. Check the bottom action bar: The payment action is disabled and gated by policy.

---

## Scenario B — Fraudulent Fulfillment Delivery (Transaction Count Mismatch)
- **Objective**: Prove that a seller cannot claim payment for digital work simply because it delivered an artifact.
- **Setup**:
  - Seller submits deliverable `del-fake-scenario-b` claiming 23 transactions on HashKey Chain for blocks 1201000..1201500.
  - HashX independent RPC recomputation verifies that only 17 transactions occurred in that range.
- **How to verify**:
  1. Navigate to `/app/demo` and select **Scenario B**.
  2. Click **Open in Trust Inspector** (or navigate to `/app/trust/inv-fake-fulfillment-scenario-b`).
  3. Notice the red banner: `VERDICT: FAIL — PAYMENT BLOCKED`.
  4. Under Delivery Checks, expand **Transaction Count**:
     - Expected: `17 transactions confirmed on-chain`
     - Actual: `23 claimed by seller`
     - Failure code: `TX_COUNT_MISMATCH`
  5. Confirm payment actions are blocked.

---

## Scenario C — Concurrent Duplicate Payment Request Race
- **Objective**: Prove that repeated or concurrent `request_payment` calls do not create multiple HSP orders or duplicate commercial obligations.
- **Setup**:
  - Invoice `inv-replay-scenario-c` already has an active, nonterminal payment attempt (`pay-attempt-c-active`).
- **How to verify**:
  1. Navigate to `/app/demo` and select **Scenario C**.
  2. Click the **Call request_payment** button multiple times.
  3. Observe that the returned payment attempt ID and HSP Flow ID (`hsp-flow-89912`) remain unchanged. Zero duplicate orders are spawned.

---

## Scenario D — Complete Golden Path
- **Objective**: Experience the complete, verified agent-to-agent procurement lifecycle.
- **Steps**:
  1. Open `/app/demo` and select **Scenario D**.
  2. Follow the 14-step verified workflow from initial inquiry to final settlement.
  3. Click **Inspect Golden Receipt** (or visit `/app/receipts/rcpt-golden-001`).
  4. View the cryptographic proof linking the original invoice digest, fulfillment digest, human authorization hash, and finalized HashKey Chain transaction.
  5. Test **Download JSON** or **Print Document** to inspect the verifiable proof artifact.
