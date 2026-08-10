#!/usr/bin/env node
/* eslint-disable max-len */
/* eslint-disable no-console */
/* eslint-disable require-jsdoc */
"use strict";

const admin = require("firebase-admin");
const {ENTRY_COLLECTION, materializeEntries} = require("../firestore-v2-core");

const ACK = "I_UNDERSTAND_THIS_CREATES_AND_REMOVES_SYNTHETIC_DATA";
const SOURCE_PATH = "gallery/codex_firestore_v2_smoke_20260809";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(description, callback, timeoutMs = 60000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await callback();
    if (result) return result;
    await delay(1000);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function main() {
  const args = process.argv.slice(2);
  const projectIndex = args.indexOf("--project");
  const ackIndex = args.indexOf("--ack");
  const project = projectIndex >= 0 ? args[projectIndex + 1] : "";
  const ack = ackIndex >= 0 ? args[ackIndex + 1] : "";
  if (!project) throw new Error("--project is required.");
  if (ack !== ACK) throw new Error(`Smoke test requires --ack ${ACK}`);

  admin.initializeApp({projectId: project});
  const db = admin.firestore();
  const sourceRef = db.doc(SOURCE_PATH);
  const existing = await sourceRef.get();
  if (existing.exists) {
    throw new Error(`Refusing to overwrite existing synthetic path ${SOURCE_PATH}`);
  }

  const firstData = {
    smokeTest: true,
    galleryPictures: {
      smoke: {id: "smoke", url: "https://invalid.example/first", uploadedAt: "2026-08-09T00:00:00Z"},
    },
  };
  const secondData = {
    smokeTest: true,
    galleryPictures: {
      smoke: {id: "smoke", url: "https://invalid.example/second", uploadedAt: "2026-08-09T00:00:01Z"},
    },
  };
  const firstEntry = materializeEntries(SOURCE_PATH, firstData)[0].entry;
  const secondEntry = materializeEntries(SOURCE_PATH, secondData)[0].entry;

  try {
    await sourceRef.set(firstData);
    await waitFor("create mirror", async () => {
      const snapshot = await sourceRef.collection(ENTRY_COLLECTION).doc(firstEntry.id).get();
      return snapshot.exists && snapshot.get("fingerprint") === firstEntry.fingerprint;
    });

    await sourceRef.set(secondData);
    await waitFor("update mirror", async () => {
      const snapshot = await sourceRef.collection(ENTRY_COLLECTION).doc(secondEntry.id).get();
      return snapshot.exists && snapshot.get("fingerprint") === secondEntry.fingerprint &&
        snapshot.get("value.url") === "https://invalid.example/second";
    });

    await sourceRef.delete();
    await waitFor("delete tombstone", async () => {
      const snapshot = await sourceRef.collection(ENTRY_COLLECTION).doc(secondEntry.id).get();
      return snapshot.exists && snapshot.get("deleted") === true;
    });
    console.log(JSON.stringify({
      success: true,
      sourcePath: SOURCE_PATH,
      createMirrored: true,
      updateMirrored: true,
      deleteTombstoned: true,
    }, null, 2));
  } finally {
    await db.recursiveDelete(sourceRef);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
}

module.exports = {ACK, SOURCE_PATH, waitFor};
