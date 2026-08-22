"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  clientSavingsContribution,
  resolveAggregateUpdate,
  syncClientSavingsAggregate,
  toFiniteNumber,
} = require("../client-savings-aggregate");

test("normalizes legacy savings values without allowing invalid totals", () => {
  assert.equal(toFiniteNumber("1,250,000 FC"), 1250000);
  assert.equal(toFiniteNumber(undefined), 0);
  assert.equal(toFiniteNumber("NaN"), 0);
  assert.equal(clientSavingsContribution({savings: "-11500"}), 0);
  assert.equal(clientSavingsContribution({savings: "25000"}), 25000);
});

test("pending transfers contribute zero until they are accepted", () => {
  assert.equal(clientSavingsContribution({
    savings: "11500",
    transferStatus: "pending",
  }), 0);
  assert.equal(clientSavingsContribution({
    savings: "11500",
    transferStatus: "accepted",
  }), 11500);
});

test("updates the aggregate from the last applied client contribution", () => {
  assert.equal(resolveAggregateUpdate({
    currentAggregate: 100000,
    previousContribution: 15000,
    desiredContribution: 25000,
    lastAppliedVersion: 100,
    incomingVersion: 200,
  }), 110000);

  assert.equal(resolveAggregateUpdate({
    currentAggregate: 110000,
    previousContribution: 25000,
    desiredContribution: 0,
    lastAppliedVersion: 200,
    incomingVersion: 300,
  }), 85000);
});

test("ignores retried and out-of-order events", () => {
  assert.equal(resolveAggregateUpdate({
    currentAggregate: 110000,
    previousContribution: 25000,
    desiredContribution: 25000,
    lastAppliedVersion: 200,
    incomingVersion: 200,
  }), null);

  assert.equal(resolveAggregateUpdate({
    currentAggregate: 110000,
    previousContribution: 25000,
    desiredContribution: 15000,
    lastAppliedVersion: 300,
    incomingVersion: 250,
  }), null);
});

test("skips testing locations without writing an aggregate", async () => {
  const writes = [];
  const db = {
    doc: (path) => ({path}),
    runTransaction: async (callback) => callback({
      get: async (ref) => ref.path === "users/test-user" ? {
        exists: true,
        data: () => ({mode: "testing"}),
      } : {exists: false},
      set: (...args) => writes.push(args),
    }),
  };
  const change = {
    before: {exists: true, data: () => ({savings: "0"})},
    after: {
      exists: true,
      data: () => ({savings: "10000"}),
      updateTime: {toMillis: () => 200},
    },
  };

  await syncClientSavingsAggregate(change, {
    params: {ownerUid: "test-user", clientId: "client-1"},
    timestamp: "2026-08-22T00:00:00.000Z",
  }, {
    db,
    fieldValue: {serverTimestamp: () => "timestamp"},
  });

  assert.equal(writes.length, 0);
});
