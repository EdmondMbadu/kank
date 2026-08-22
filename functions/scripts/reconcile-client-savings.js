#!/usr/bin/env node
"use strict";
/* eslint-disable require-jsdoc */

const admin = require("firebase-admin");
const {
  clientSavingsContribution,
  toFiniteNumber,
} = require("../client-savings-aggregate");

function argumentValue(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : "";
}

function normalizeName(value) {
  return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
}

function displayName(user) {
  return [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || user.name || "Sans nom";
}

function isExcluded(user, excludedName) {
  if (user.mode === "testing" || user.mode === undefined) return true;
  if (!excludedName) return false;
  return normalizeName(displayName(user)) === normalizeName(excludedName);
}

function summarizeClients(clientSnapshots) {
  let total = 0;
  let pendingCount = 0;
  let negativeCount = 0;
  let invalidCount = 0;

  clientSnapshots.forEach((snapshot) => {
    const client = snapshot.data() || {};
    const rawSavings = client.savings;
    const parsed = toFiniteNumber(rawSavings);
    const rawText = String(
        rawSavings === null || rawSavings === undefined ? "" : rawSavings,
    ).trim();
    if (
      rawSavings !== null &&
      rawSavings !== undefined &&
      rawText &&
      !Number.isFinite(Number(
          rawText.replace(/,/g, "").replace(/[^0-9.-]+/g, ""),
      ))
    ) {
      invalidCount += 1;
    }
    if (parsed < 0) negativeCount += 1;
    if (client.transferStatus === "pending") pendingCount += 1;
    total += clientSavingsContribution(client);
  });

  return {total, pendingCount, negativeCount, invalidCount};
}

async function readPlan(db, excludedName) {
  const usersSnapshot = await db.collection("users").get();
  const rows = [];
  const excluded = [];

  for (const userSnapshot of usersSnapshot.docs) {
    const user = userSnapshot.data() || {};
    const name = displayName(user);
    if (isExcluded(user, excludedName)) {
      if (normalizeName(name) === normalizeName(excludedName)) {
        excluded.push({name, mode: user.mode || null});
      }
      continue;
    }

    const clientsSnapshot = await userSnapshot.ref.collection("clients").get();
    const summary = summarizeClients(clientsSnapshot.docs);
    const stored = toFiniteNumber(user.clientsSavings);
    rows.push({
      ref: userSnapshot.ref,
      name,
      stored,
      total: summary.total,
      adjustment: summary.total - stored,
      clients: clientsSnapshot.size,
      ...summary,
    });
  }

  rows.sort((left, right) => left.name.localeCompare(right.name, "fr"));
  return {rows, excluded};
}

async function reconcileLocation(db, userRef) {
  return db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists) throw new Error(`Missing user ${userRef.id}`);
    const user = userSnapshot.data() || {};
    if (user.mode === "testing" || user.mode === undefined) {
      return {skipped: true, total: 0, clients: 0};
    }

    const clientsSnapshot = await transaction.get(
        userRef.collection("clients"),
    );
    const summary = summarizeClients(clientsSnapshot.docs);
    const reconciledAt = admin.firestore.FieldValue.serverTimestamp();

    clientsSnapshot.docs.forEach((clientSnapshot) => {
      const contributionRef = userRef
          .collection("clientSavingsContributions")
          .doc(clientSnapshot.id);
      transaction.set(contributionRef, {
        amount: clientSavingsContribution(clientSnapshot.data() || {}),
        sourceUpdateTimeMs: clientSnapshot.updateTime.toMillis(),
        reconciledAt,
      }, {merge: true});
    });

    transaction.set(userRef, {
      clientsSavingsComputed: summary.total,
      clientsSavings: String(summary.total),
      clientsSavingsComputedUpdatedAt: reconciledAt,
      clientsSavingsReconciliationSource: "client-documents-v1",
    }, {merge: true});

    return {
      skipped: false,
      total: summary.total,
      clients: clientsSnapshot.size,
    };
  });
}

async function main() {
  const projectId = argumentValue("project");
  const excludedName = argumentValue("exclude-name");
  const expectedTotal = Number(argumentValue("confirm-total"));
  const apply = process.argv.includes("--apply");

  if (!projectId) throw new Error("Missing --project=<project-id>");
  if (!excludedName) throw new Error("Missing --exclude-name=<name>");

  admin.initializeApp({projectId});
  const db = admin.firestore();
  const plan = await readPlan(db, excludedName);
  const plannedTotal = plan.rows.reduce((sum, row) => sum + row.total, 0);

  console.table(plan.rows.map((row) => ({
    location: row.name,
    stored: row.stored,
    correct: row.total,
    adjustment: row.adjustment,
    clients: row.clients,
  })));
  console.log(JSON.stringify({
    apply,
    locations: plan.rows.length,
    plannedTotal,
    excluded: plan.excluded,
  }, null, 2));

  if (!apply) return;
  if (!Number.isFinite(expectedTotal) || expectedTotal !== plannedTotal) {
    throw new Error(
        `Refusing write: --confirm-total=${plannedTotal} is required.`,
    );
  }
  if (plan.excluded.length !== 1) {
    throw new Error(
        `Refusing write: expected exactly one excluded ${excludedName} user.`,
    );
  }

  const results = [];
  for (const row of plan.rows) {
    const result = await reconcileLocation(db, row.ref);
    results.push({location: row.name, ...result});
  }
  console.log(JSON.stringify({reconciled: results}, null, 2));
}

main()
    .catch((error) => {
      console.error(error && error.stack ? error.stack : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (admin.apps.length) await admin.app().delete();
    });
