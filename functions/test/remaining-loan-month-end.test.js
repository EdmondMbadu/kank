"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildRemainingLoanMonthEndSnapshot,
  captureRemainingLoanMonthEnd,
  closingDate,
  snapshotPeriodAtRollover,
} = require("../remaining-loan-month-end");

test("builds the active contractual balance once per stable client", () => {
  const snapshot = buildRemainingLoanMonthEndSnapshot({
    year: 2026,
    month: 8,
    sites: [
      {ownerUid: "site-a", siteName: "Alpha"},
      {ownerUid: "site-b", siteName: "Beta"},
      {ownerUid: "site-c", siteName: "Gamma"},
    ],
    clients: [
      {
        uid: "client-a",
        ownerUid: "site-a",
        locationOwnerId: "site-a",
        debtLeft: "100000",
        vitalStatus: "Vivant",
        path: "users/site-a/clients/client-a",
      },
      {
        uid: "client-mort",
        ownerUid: "site-a",
        debtLeft: "900000",
        vitalStatus: "Mort",
        path: "users/site-a/clients/client-mort",
      },
      {
        uid: "client-b",
        ownerUid: "site-b",
        debtLeft: "50000",
        path: "users/site-b/clients/client-b",
      },
      {
        uid: "client-a",
        ownerUid: "site-b",
        locationOwnerId: "site-b",
        debtLeft: "200000",
        updatedAt: "2026-08-20T00:00:00.000Z",
        path: "users/site-b/clients/client-a",
      },
    ],
    previousSnapshot: {
      totalDebtLeftFc: 300000,
      sites: [
        {ownerUid: "site-a", debtLeftFc: 100000},
        {ownerUid: "site-b", debtLeftFc: 200000},
      ],
    },
  });

  assert.equal(snapshot.periodKey, "2026-08");
  assert.equal(snapshot.closingDate, "2026-08-31");
  assert.equal(snapshot.totalDebtLeftFc, 250000);
  assert.equal(snapshot.activeClientCount, 2);
  assert.equal(snapshot.duplicateClientCount, 1);
  assert.deepEqual(snapshot.sites.map((site) => ({
    ownerUid: site.ownerUid,
    debtLeftFc: site.debtLeftFc,
    activeClientCount: site.activeClientCount,
  })), [
    {ownerUid: "site-b", debtLeftFc: 250000, activeClientCount: 2},
    {ownerUid: "site-a", debtLeftFc: 0, activeClientCount: 0},
    {ownerUid: "site-c", debtLeftFc: 0, activeClientCount: 0},
  ]);
  assert.ok(Math.abs(snapshot.growthPercent - (-100 / 6)) < 0.000001);
});

test("uses Kinshasa rollover and leap-year closings", () => {
  assert.deepEqual(
      snapshotPeriodAtRollover(new Date("2027-01-01T00:00:00+01:00")),
      {year: 2026, month: 12},
  );
  assert.equal(closingDate(2028, 2), "2028-02-29");
});

test("does not rescan an existing closing", async () => {
  const requestedCollections = [];
  const db = {
    collection: (collectionName) => {
      requestedCollections.push(collectionName);
      return {
        doc: () => ({
          get: async () => ({exists: true}),
        }),
      };
    },
  };

  const result = await captureRemainingLoanMonthEnd({
    db,
    fieldValue: {serverTimestamp: () => "timestamp"},
    now: new Date("2026-09-01T00:00:00+01:00"),
  });

  assert.deepEqual(result, {
    created: false,
    periodKey: "2026-08",
    reason: "already-exists",
  });
  assert.deepEqual(requestedCollections, ["remainingLoanMonthEnds"]);
});
