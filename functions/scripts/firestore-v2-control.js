#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
"use strict";

const admin = require("firebase-admin");
const {CONTROL_PATH, SCHEMA_VERSION} = require("../firestore-v2-core");

const ACK = "I_UNDERSTAND_THIS_CHANGES_MIGRATION_CONTROL";

function parseArgs(argv) {
  const result = {project: "", action: "status", ack: "", kinds: []};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") result.project = argv[++index] || "";
    else if (arg === "--action") result.action = argv[++index] || "";
    else if (arg === "--ack") result.ack = argv[++index] || "";
    else if (arg === "--kinds") {
      result.kinds = String(argv[++index] || "").split(",")
          .map((value) => value.trim()).filter(Boolean);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.project) throw new Error("--project is required.");
  if (!["status", "enable-mirror", "disable-all"].includes(args.action)) {
    throw new Error("--action must be status, enable-mirror, or disable-all.");
  }
  if (args.action !== "status" && args.ack !== ACK) {
    throw new Error(`Control writes require --ack ${ACK}`);
  }

  admin.initializeApp({projectId: args.project});
  const db = admin.firestore();
  const ref = db.doc(CONTROL_PATH);
  if (args.action === "enable-mirror") {
    await ref.set({
      schemaVersion: SCHEMA_VERSION,
      mirrorLegacyWrites: true,
      shadowReads: false,
      readFromV2: false,
      writeDirectlyToV2: false,
      killSwitch: false,
      enabledKinds: args.kinds,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  } else if (args.action === "disable-all") {
    await ref.set({
      mirrorLegacyWrites: false,
      shadowReads: false,
      readFromV2: false,
      writeDirectlyToV2: false,
      killSwitch: true,
      rollbackAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  }
  const snapshot = await ref.get();
  console.log(JSON.stringify(snapshot.exists ? snapshot.data() : {exists: false}, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  });
}

module.exports = {ACK, parseArgs};
