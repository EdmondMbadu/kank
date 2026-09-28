const test = require("node:test");
const assert = require("node:assert/strict");
const {cardLifecycleSmsSkipReason} = require("../card-lifecycle-sms-policy");

const belowThresholdCard = {amountToPay: 50000};
const aboveThresholdCard = {amountToPay: 400000};
const enabled = {enabled: true, minimumAmountToPayFc: 400000};
const disabled = {enabled: false, minimumAmountToPayFc: 400000};

test("payouts notify low value cards with deposit SMS paused", () => {
  for (const type of ["partial_withdrawal", "total_withdrawal"]) {
    assert.equal(
        cardLifecycleSmsSkipReason(type, belowThresholdCard, disabled), null);
    assert.equal(
        cardLifecycleSmsSkipReason(type, belowThresholdCard, enabled), null);
  }
});

test("other events keep the global switch and threshold", () => {
  for (const type of ["deposit", "card_created", "cycle_started",
    "withdrawal_requested", "credit_transfer", "manual_correction",
    "total_withdrawal_reversed"]) {
    assert.equal(
        cardLifecycleSmsSkipReason(type, belowThresholdCard, enabled),
        "below-threshold", type);
    assert.equal(
        cardLifecycleSmsSkipReason(type, aboveThresholdCard, disabled),
        "automation-disabled", type);
    assert.equal(
        cardLifecycleSmsSkipReason(type, aboveThresholdCard, enabled),
        null, type);
  }
});

test("a missing card never triggers a payout message", () => {
  assert.equal(
      cardLifecycleSmsSkipReason("partial_withdrawal", null, disabled),
      "card-not-found");
  assert.equal(
      cardLifecycleSmsSkipReason("total_withdrawal", null, enabled),
      "card-not-found");
});
