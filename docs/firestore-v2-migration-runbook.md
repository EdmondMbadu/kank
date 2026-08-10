# Firestore v2 migration runbook

## Production state (2026-08-09)

- Project: `kank-4bbbc`
- Region: `us-central1`
- Verified pre-change export:
  `gs://kank-4bbbc.appspot.com/firestore-migrations/pre-v2-20260809T230737Z`
- Export result: `SUCCESSFUL`, 25,870 documents, 28,269,815 stored bytes.
- Shadow mirror: enabled for all supported entity kinds.
- Application reads: legacy only (`readFromV2=false`).
- Direct application v2 writes: disabled (`writeDirectlyToV2=false`).
- Legacy writes: unchanged.
- Legacy deletes/pruning: not authorized and not performed.
- Reconciliation: 165,133 expected, 165,133 matching, 0 missing,
  0 mismatched, 0 orphaned.
- Synthetic production smoke: create, update, and delete/tombstone passed;
  the synthetic source and descendants were verified removed.

Representative warm-cache Admin SDK read baselines (five measured iterations
after one warm-up) were:

| Source | Legacy full-document P95 | v2 field/month P95 |
| --- | ---: | ---: |
| Management (523,432 bytes) | 497.8 ms | reserve 198.0 ms; activity 200.8 ms |
| Largest user (157,422 bytes) | 305.0 ms | reimbursement 236.1 ms; expenses 184.9 ms |
| Largest employee (157,586 bytes) | 429.8 ms | attendance 183.4 ms; attachments 202.4 ms |
| Largest client (16,392 bytes) | 192.1 ms | empty current-month query 164.0 ms |

These results establish a promising backend baseline. They do not replace
browser, screen-level, and cold-cache performance gates before read cutover.

This is a safe shadow stage, not permission to remove or freeze legacy fields.
It removes the immediate automatic-index-entry danger and establishes a fully
reconciled bounded copy. The legacy document byte-growth risk remains until a
separately verified read cutover allows legacy growth to be stopped.

## Safety invariants

1. The control document is `migrationControls/firestoreV2`.
2. A missing control or `killSwitch=true` makes every mirror Function inert.
3. Mirror Functions never write the source document. They only write beneath
   `{sourcePath}/firestoreV2Entries/{entryId}`.
4. Entry IDs are deterministic per legacy field/key, so backfills and retries
   are idempotent.
5. Each entry stores a fingerprint. Reconciliation requires exact fingerprints,
   not just matching counts.
6. Out-of-order triggers cannot replace a newer entry because writes compare
   `sourceUpdateTimeMs` transactionally.
7. Removed legacy entries become v2 tombstones; the mirror does not delete data.
8. Inline payloads are capped at 128 KiB. Larger values are stored in UTF-8-safe
   chunks of at most 96 KiB in `firestoreV2PayloadChunks`.
9. Payload fields are excluded from automatic indexing. Month/field query
   indexes contain metadata only.
10. No legacy field may be pruned without a new backup, exact reconciliation,
    read-equivalence tests, performance gates, and explicit approval.
11. Background failures retry safely for up to the platform retry window;
    Functions are capped at 50 instances and 120 seconds per execution.

## Immediate rollback

From `functions/`:

```bash
node scripts/firestore-v2-control.js \
  --project kank-4bbbc \
  --action disable-all \
  --ack I_UNDERSTAND_THIS_CHANGES_MIGRATION_CONTROL
```

Expected control state:

```text
mirrorLegacyWrites=false
shadowReads=false
readFromV2=false
writeDirectlyToV2=false
killSwitch=true
```

This rollback is immediate and does not require a hosting deploy. Existing v2
documents stay available for investigation and do not affect the legacy app.
Do not delete v2 documents during incident response.

## Status and reconciliation

Read the control without changing it:

```bash
node scripts/firestore-v2-control.js \
  --project kank-4bbbc \
  --action status
```

Run a zero-write full reconciliation:

```bash
node scripts/firestore-v2-migrate.js --project kank-4bbbc
node scripts/firestore-v2-benchmark.js \
  --project kank-4bbbc \
  --source management/CWGXCLYchpm95b3KjoDJ \
  --month 2026-08 \
  --fields reserve,moneyInHandsActivities \
  --iterations 5
```

Success requires all of the following:

```text
missingEntries=0
mismatchedEntries=0
orphanEntries=0
expectedEntries=matchingEntries
scheduledWrites=0
```

The dry run exits non-zero when reconciliation is not exact.

## Idempotent repair/backfill

First ensure the mirror is enabled so writes that race the backfill are
captured. Then run:

```bash
node scripts/firestore-v2-migrate.js \
  --project kank-4bbbc \
  --apply \
  --ack I_UNDERSTAND_THIS_ADDS_V2_DOCUMENTS
```

The command only adds or repairs v2 entries. It does not delete source data.
Always follow it with repeated zero-write reconciliation until exact.

## Canary controls

Enable only management mirroring:

```bash
node scripts/firestore-v2-control.js \
  --project kank-4bbbc \
  --action enable-mirror \
  --kinds management \
  --ack I_UNDERSTAND_THIS_CHANGES_MIGRATION_CONTROL
```

Enable all supported kinds by omitting `--kinds`.

## Production smoke test

The smoke test uses only
`gallery/codex_firestore_v2_smoke_20260809`, refuses to overwrite it if it
exists, validates create/update/tombstone behavior, and recursively removes
only that synthetic path in `finally`:

```bash
node scripts/firestore-v2-smoke.js \
  --project kank-4bbbc \
  --ack I_UNDERSTAND_THIS_CREATES_AND_REMOVES_SYNTHETIC_DATA
```

## Backup verification and disaster restore

Verify the export operation and objects:

```bash
gcloud firestore operations list --project=kank-4bbbc --limit=5
gcloud storage du --summarize \
  gs://kank-4bbbc.appspot.com/firestore-migrations/pre-v2-20260809T230737Z
```

Import is an incident-only recovery operation. It can overwrite documents with
matching IDs and should not be run merely to disable the migration. Require
separate explicit approval and a restore rehearsal before using:

```bash
gcloud firestore import \
  gs://kank-4bbbc.appspot.com/firestore-migrations/pre-v2-20260809T230737Z \
  --project=kank-4bbbc
```

## Verification commands

```bash
cd functions
npm test
npm run lint
node --check index.js

cd ..
npm run build
firebase deploy --project kank-4bbbc \
  --only firestore:rules,firestore:indexes \
  --dry-run
```

The repository's broad Angular suite had 70 pre-existing failures before this
work. The production build, Functions lint, and focused v2 tests are the
reliable migration regression gates until that unrelated baseline is repaired.

## Read cutover gate (not yet enabled)

Do not set `readFromV2=true` or stop legacy growth until all of these are true:

1. Every history screen reads a month/range from v2 instead of hydrating all
   history at application startup.
2. Legacy-versus-v2 shadow comparisons remain exact across normal production
   writes, edits, and removals for an agreed observation window.
3. P50 and P95 latency for each migrated screen are no worse than legacy.
4. Offline/retry, old-client, and rollback tests pass.
5. A fresh export is verified immediately before freezing legacy maps.
6. Legacy writes remain mirrored for a compatibility window after read cutover.
7. Removing historical legacy fields receives separate explicit approval.

Until then, keep reads legacy-only. That preserves current behavior and speed
while the v2 copy continues to stay current.
