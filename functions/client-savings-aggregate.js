"use strict";
/* eslint-disable require-jsdoc */

function toFiniteNumber(value) {
  if (value === null || value === undefined) return 0;
  const normalized = String(value)
      .trim()
      .replace(/,/g, "")
      .replace(/\u00a0/g, "")
      .replace(/[^0-9.-]+/g, "");
  if (!normalized || normalized === "-" || normalized === ".") return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clientSavingsContribution(client) {
  if (!client || client.transferStatus === "pending") return 0;
  return Math.max(0, toFiniteNumber(client.savings));
}

function eventVersionMillis(change, context) {
  if (change.after && change.after.exists && change.after.updateTime) {
    return change.after.updateTime.toMillis();
  }
  const contextMillis = Date.parse(context.timestamp || "");
  if (Number.isFinite(contextMillis)) return contextMillis;
  if (change.before && change.before.updateTime) {
    return change.before.updateTime.toMillis();
  }
  return Date.now();
}

function resolveAggregateUpdate({
  currentAggregate,
  previousContribution,
  desiredContribution,
  lastAppliedVersion,
  incomingVersion,
}) {
  if (
    Number.isFinite(lastAppliedVersion) &&
    incomingVersion <= lastAppliedVersion
  ) {
    return null;
  }

  const current = Math.max(0, toFiniteNumber(currentAggregate));
  const previous = Math.max(0, toFiniteNumber(previousContribution));
  const desired = Math.max(0, toFiniteNumber(desiredContribution));
  return Math.max(0, current - previous + desired);
}

async function syncClientSavingsAggregate(change, context, dependencies) {
  const {db, fieldValue} = dependencies;
  const beforeData = change.before.exists ? change.before.data() : null;
  const afterData = change.after.exists ? change.after.data() : null;
  const beforeContribution = clientSavingsContribution(beforeData);
  const desiredContribution = clientSavingsContribution(afterData);

  if (beforeContribution === desiredContribution) return null;

  const ownerUid = context.params.ownerUid;
  const clientId = context.params.clientId;
  const incomingVersion = eventVersionMillis(change, context);
  const userRef = db.doc(`users/${ownerUid}`);
  const contributionRef = db.doc(
      `users/${ownerUid}/clientSavingsContributions/${clientId}`,
  );

  return db.runTransaction(async (transaction) => {
    const [userSnapshot, contributionSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(contributionRef),
    ]);

    if (!userSnapshot.exists) return null;
    const userData = userSnapshot.data() || {};
    if (userData.mode === "testing") return null;

    const contributionData = contributionSnapshot.exists ?
      contributionSnapshot.data() || {} : {};
    const lastAppliedVersion = Number(
        contributionData.sourceUpdateTimeMs || 0,
    );
    const currentAggregate = Number.isFinite(
        Number(userData.clientsSavingsComputed),
    ) ? userData.clientsSavingsComputed : userData.clientsSavings;
    const nextAggregate = resolveAggregateUpdate({
      currentAggregate,
      previousContribution: contributionData.amount || 0,
      desiredContribution,
      lastAppliedVersion,
      incomingVersion,
    });

    if (nextAggregate === null) return null;

    transaction.set(userRef, {
      clientsSavingsComputed: nextAggregate,
      clientsSavings: String(nextAggregate),
      clientsSavingsComputedUpdatedAt: fieldValue.serverTimestamp(),
    }, {merge: true});
    transaction.set(contributionRef, {
      amount: desiredContribution,
      sourceUpdateTimeMs: incomingVersion,
      updatedAt: fieldValue.serverTimestamp(),
    }, {merge: true});

    return nextAggregate;
  });
}

module.exports = {
  clientSavingsContribution,
  eventVersionMillis,
  resolveAggregateUpdate,
  syncClientSavingsAggregate,
  toFiniteNumber,
};
