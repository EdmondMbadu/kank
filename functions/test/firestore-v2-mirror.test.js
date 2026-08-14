"use strict";
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */

const test = require("node:test");
const assert = require("node:assert/strict");
const {mirrorLegacyWriteWithDb} = require("../firestore-v2-mirror");

function fakeRef(path) {
  return {
    path,
    collection(name) {
      return {
        doc(id) {
          return fakeRef(`${path}/${name}/${id}`);
        },
      };
    },
  };
}

function fakeDb(control) {
  const commits = [];
  const store = new Map();
  return {
    commits,
    store,
    doc(path) {
      assert.equal(path, "migrationControls/firestoreV2");
      return {
        async get() {
          return {
            exists: control !== null,
            data() {
              return control;
            },
            get(field) {
              return control && control[field];
            },
          };
        },
      };
    },
    batch() {
      const operations = [];
      return {
        set(ref, data, options) {
          operations.push({type: "set", path: ref.path, data, options});
        },
        delete(ref) {
          operations.push({type: "delete", path: ref.path});
        },
        async commit() {
          commits.push(operations);
        },
      };
    },
    async runTransaction(callback) {
      const operations = [];
      const transaction = {
        async get(ref) {
          const data = store.get(ref.path);
          return {
            exists: data !== undefined,
            data() {
              return data;
            },
            get(field) {
              return data && data[field];
            },
          };
        },
        set(ref, data, options) {
          operations.push({type: "set", path: ref.path, data, options});
        },
        update(ref, ...args) {
          operations.push({type: "update", path: ref.path, args});
        },
      };
      const result = await callback(transaction);
      if (operations.length) {
        operations.forEach((operation) => {
          if (operation.type !== "set") return;
          store.set(operation.path, {
            ...(store.get(operation.path) || {}),
            ...operation.data,
          });
        });
        commits.push(operations);
      }
      return result;
    },
  };
}

function changeFor(path, before, after, version = 1) {
  const ref = fakeRef(path);
  const updateTime = {toMillis: () => version};
  return {
    before: {exists: before !== null, data: () => before, ref, updateTime},
    after: {exists: after !== null, data: () => after, ref, updateTime},
  };
}

test("an absent control document keeps mirroring completely inert", async () => {
  const db = fakeDb(null);
  await mirrorLegacyWriteWithDb(
      db,
      changeFor("management/main", {reserve: {}}, {reserve: {day: "1"}}),
      {eventId: "event-1"},
      "server-time",
  );
  assert.deepEqual(db.commits, []);
});

test("the kill switch overrides an enabled mirror", async () => {
  const db = fakeDb({mirrorLegacyWrites: true, killSwitch: true});
  await mirrorLegacyWriteWithDb(
      db,
      changeFor("users/u1", {}, {dailyReimbursement: {day: "1"}}),
      {eventId: "event-2"},
      "server-time",
  );
  assert.deepEqual(db.commits, []);
});

test("a kind allowlist provides a narrow production canary", async () => {
  const db = fakeDb({
    mirrorLegacyWrites: true,
    killSwitch: false,
    enabledKinds: ["management"],
  });
  await mirrorLegacyWriteWithDb(
      db,
      changeFor("users/u1", {}, {dailyReimbursement: {day: "1"}}),
      {eventId: "not-canary"},
      "server-time",
  );
  assert.deepEqual(db.commits, []);
  await mirrorLegacyWriteWithDb(
      db,
      changeFor("management/main", {}, {reserve: {day: "1"}}),
      {eventId: "canary"},
      "server-time",
  );
  assert.equal(db.commits.flat().length, 1);
});

test("enabled mirroring writes only below the source document", async () => {
  const db = fakeDb({mirrorLegacyWrites: true, killSwitch: false});
  const sourcePath = "management/main";
  await mirrorLegacyWriteWithDb(
      db,
      changeFor(sourcePath, {reserve: {old: "1"}}, {reserve: {old: "2", next: "3"}}),
      {eventId: "event-3"},
      "server-time",
  );
  const operations = db.commits.flat();
  assert.equal(operations.length, 2);
  assert.ok(operations.every((operation) =>
    operation.path.startsWith(`${sourcePath}/firestoreV2Entries/`)));
  assert.ok(operations.every((operation) => operation.path !== sourcePath));
  assert.ok(operations.every((operation) => operation.data.mirrorEventId === "event-3"));
});

test("a removal creates a tombstone and does not delete either schema", async () => {
  const db = fakeDb({mirrorLegacyWrites: true, killSwitch: false});
  await mirrorLegacyWriteWithDb(
      db,
      changeFor("users/u1/clients/c1", {payments: {p1: "50"}}, {payments: {}}),
      {eventId: "event-4"},
      "server-time",
  );
  const operations = db.commits.flat();
  assert.equal(operations.length, 1);
  assert.equal(operations[0].type, "set");
  assert.equal(operations[0].data.deleted, true);
});

test("an older out-of-order trigger cannot overwrite newer v2 state", async () => {
  const db = fakeDb({mirrorLegacyWrites: true, killSwitch: false});
  const path = "management/main";
  await mirrorLegacyWriteWithDb(
      db,
      changeFor(path, {reserve: {day: "1"}}, {reserve: {day: "new"}}, 200),
      {eventId: "newer"},
      "server-time",
  );
  await mirrorLegacyWriteWithDb(
      db,
      changeFor(path, {reserve: {day: "0"}}, {reserve: {day: "old"}}, 100),
      {eventId: "older"},
      "server-time",
  );
  const entry = [...db.store.entries()].find(([entryPath]) =>
    entryPath.includes("/firestoreV2Entries/"));
  assert.ok(entry);
  assert.equal(entry[1].value, "new");
  assert.equal(entry[1].mirrorEventId, "newer");
  assert.equal(entry[1].sourceUpdateTimeMs, 200);
});

test("a delayed update cannot resurrect an entry after a delete tombstone", async () => {
  const db = fakeDb({mirrorLegacyWrites: true, killSwitch: false});
  const path = "management/main";
  await mirrorLegacyWriteWithDb(
      db,
      changeFor(path, {reserve: {day: "old"}}, null, 200),
      {eventId: "delete", timestamp: "1970-01-01T00:00:00.300Z"},
      "server-time",
  );
  await mirrorLegacyWriteWithDb(
      db,
      changeFor(path, {reserve: {}}, {reserve: {day: "late-update"}}, 250),
      {eventId: "late-update"},
      "server-time",
  );
  const entry = [...db.store.entries()].find(([entryPath]) =>
    entryPath.includes("/firestoreV2Entries/"));
  assert.ok(entry);
  assert.equal(entry[1].deleted, true);
  assert.equal(entry[1].mirrorEventId, "delete");
  assert.equal(entry[1].sourceUpdateTimeMs, 300);
});

test("projection writes are independently controlled and month bounded", async () => {
  const db = fakeDb({
    mirrorLegacyWrites: true,
    killSwitch: false,
    projectionWrites: true,
  });
  await mirrorLegacyWriteWithDb(
      db,
      changeFor("management/main", {}, {reserve: {"08-13-2026": "25"}}, 400),
      {eventId: "projection"},
      "server-time",
  );
  const operations = db.commits.flat();
  assert.equal(operations.length, 2);
  const monthWrite = operations.find((operation) =>
    operation.path === "management/main/firestoreV2Months/2026-08");
  assert.ok(monthWrite);
  const item = Object.values(monthWrite.data.items)[0];
  assert.equal(item.field, "reserve");
  assert.equal(item.value, "25");
  assert.equal(item.sourceUpdateTimeMs, 400);
});

test("compact read projections upsert and remove raw compatibility values", async () => {
  const db = fakeDb({
    mirrorLegacyWrites: true,
    killSwitch: false,
    projectionWrites: true,
    compactProjectionWrites: true,
  });
  const path = "management/main";
  await mirrorLegacyWriteWithDb(
      db,
      changeFor(path, {}, {reserve: {"08-13-2026": "25"}}, 500),
      {eventId: "compact-create"},
      "server-time",
  );
  let operations = db.commits.flat();
  const compactWrite = operations.find((operation) =>
    operation.path === `${path}/firestoreV2ReadMonths/2026-08`);
  assert.ok(compactWrite);
  assert.equal(compactWrite.data.maps.reserve["08-13-2026"], "25");

  await mirrorLegacyWriteWithDb(
      db,
      changeFor(path, {reserve: {"08-13-2026": "25"}}, {reserve: {}}, 600),
      {eventId: "compact-delete"},
      "server-time",
  );
  operations = db.commits.flat();
  assert.ok(operations.some((operation) =>
    operation.type === "update" &&
    operation.path === `${path}/firestoreV2ReadMonths/2026-08`));
});
