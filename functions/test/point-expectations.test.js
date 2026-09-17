"use strict";
/* eslint-disable max-len */
const test = require("node:test");
const assert = require("node:assert/strict");
const {businessDay, buildExpectations, capturePointExpectations} = require("../point-expectations");
const {parseArgs, ACK} = require("../scripts/point-expectations-admin");

const day = businessDay(new Date("2026-09-16T23:05:00Z"));
const employee = {id: "agent", status: "Travaille", clients: ["client"]};
const client = {id: "client", agent: "agent", debtLeft: "50000", amountToPay: "10000", paymentPeriodRange: "10", paymentDay: "Jeudi", debtCycleStartDate: "9-10-2026"};

test("business date and midnight are Kinshasa, independent of host timezone", () => {
  assert.equal(day.dayKey, "9-17-2026");
  assert.equal(day.dayStartMs, Date.parse("2026-09-16T23:00:00Z"));
  assert.equal(day.dayIndex, 4);
});

test("counts scheduled clients even with no payments and records zero workload", () => {
  assert.deepEqual(buildExpectations([employee, {id: "empty"}], [client], day), {
    agent: {points: 1, expectedFc: 1000, issues: 0}, empty: {points: 0, expectedFc: 0, issues: 0},
  });
});

test("six-day eligibility, French/English days, life status and unpaid debt", () => {
  for (const paymentDay of ["Jeudi", "Thursday", "thu", " jeu "]) {
    assert.equal(buildExpectations([employee], [{...client, paymentDay, debtCycleStartDate: "9-11-2026"}], day).agent.points, 1);
  }
  for (const change of [{debtCycleStartDate: "9-12-2026"}, {debtCycleStartDate: "9-17-2026"}, {vitalStatus: "Décédé"}, {debtLeft: "0"}, {paymentDay: "Vendredi"}, {transferStatus: "pending"}]) {
    assert.equal(buildExpectations([employee], [{...client, ...change}], day).agent.points, 0);
  }
});

test("missing/malformed cycle, invalid minimum or stale assignments are unverified, not guessed", () => {
  for (const change of [{debtCycleStartDate: ""}, {debtCycleStartDate: "2-31-2026"}, {paymentPeriodRange: "0"}, {amountToPay: "bad"}, {paymentDay: ""}, {paymentDay: "not-a-day"}, {paymentDay: "Thursday-garbage"}]) {
    const value = buildExpectations([employee], [{...client, ...change}], day).agent;
    assert.equal(value.points, null);
    assert.equal(value.issues, 1);
  }
  assert.equal(buildExpectations([{...employee, clients: []}], [client], day).agent.points, null);
  assert.equal(buildExpectations([employee], [{...client, paymentDay: "Friday", debtLeft: "bad"}], day).agent.points, 0);
  assert.equal(buildExpectations([employee], [{...client, amountToPay: "-1000", paymentPeriodRange: "-10"}], day).agent.points, null);
});

test("clients without valid positive debt are discarded without invalidating the agent or team workload", () => {
  for (const debtLeft of [undefined, null, "", "   ", 0, "0", -1, "-100", "bad", NaN, Infinity]) {
    // Deliberately omit all other eligibility fields, like a partial client
    // record in production. It must be excluded before schedule validation.
    const ignored = {id: "ignored", agent: "agent", debtLeft};
    for (const clients of [[ignored, client], [client, ignored]]) {
      const values = buildExpectations([employee, {id: "manager", clients: []}], clients, day);
      assert.deepEqual(values.agent, {points: 1, expectedFc: 1000, issues: 0});
      assert.deepEqual(values.manager, {points: 0, expectedFc: 0, issues: 0});
      assert.equal(Object.values(values).reduce((sum, value) => sum + value.points, 0), 1);
    }
    assert.deepEqual(buildExpectations([employee], [ignored], day).agent,
        {points: 0, expectedFc: 0, issues: 0});
  }
});

test("inactive assignments remain legitimate workload for the manager, without any payment", () => {
  for (const status of ["Quitté", "Quitte", "Inactif", "Inactive", "Transféré", "Travaille"]) {
    const values = buildExpectations([{...employee, status}, {id: "manager", clients: []}], [client], day);
    assert.deepEqual(values.agent, {points: 1, expectedFc: 1000, issues: 0});
    assert.equal(Object.values(values).reduce((sum, value) => sum + value.points, 0), 1);
  }
});

test("shared global client identity cannot silently double the expectation", () => {
  const other = {...client, id: "copy", globalClientId: "global"};
  assert.equal(buildExpectations([{...employee, clients: ["client", "copy"]}], [{...client, globalClientId: "global"}, other], day).agent.points, null);
  const crossAgent = buildExpectations([employee, {id: "other", clients: ["copy"]}],
      [{...client, globalClientId: "global"}, {...other, agent: "other"}], day);
  assert.equal(crossAgent.agent.points, null);
  assert.equal(crossAgent.other.points, null);
});

test("admin audit is read-only, corrections default to dry-run and require reason and acknowledgement", () => {
  assert.equal(parseArgs(["--project", "test-project"]).apply, false);
  const args = ["--project", "test-project", "--action", "correct", "--owner", "site", "--employee", "agent", "--day", "9-17-2026", "--expected-points", "10", "--reason", "Verified portfolio correction"];
  assert.equal(parseArgs(args).apply, false);
  assert.throws(() => parseArgs([...args, "--apply"]), /ack/);
  assert.equal(parseArgs([...args, "--apply", "--ack", ACK]).apply, true);
  assert.throws(() => parseArgs(["--project", "test-project", "--day", "2-31-2026"]), /calendar/);
});

test("expired scheduler messages stop retrying without scans or writes", async () => {
  const result = await capturePointExpectations({db: {}, now: new Date("2026-09-18T10:00:00Z"), scheduledAt: new Date("2026-09-16T23:05:00Z")});
  assert.equal(result.expiredRetry, true);
});
