/* eslint-disable require-jsdoc */

function cardLifecycleSmsSkipReason(eventType, card, settings) {
  if (!card) return "card-not-found";

  // A payout notification is required for every card, regardless of the
  // deposit SMS switch and minimum tranche amount.
  if (eventType === "partial_withdrawal" || eventType === "total_withdrawal") {
    return null;
  }

  if (settings.enabled !== true) return "automation-disabled";

  const amountToPay = Number(card.amountToPay);
  if (!Number.isFinite(amountToPay) ||
      amountToPay < settings.minimumAmountToPayFc) {
    return "below-threshold";
  }

  return null;
}

module.exports = {cardLifecycleSmsSkipReason};
