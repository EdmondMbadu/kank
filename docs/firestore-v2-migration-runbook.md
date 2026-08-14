# Firestore v2 migration runbook

## Production state (2026-08-13)

- Project: `kank-4bbbc`
- Region: `us-central1`
- Verified pre-change export:
  `gs://kank-4bbbc.appspot.com/firestore-migrations/pre-v2-20260809T230737Z`
- Export result: `SUCCESSFUL`, 25,870 documents, 28,269,815 stored bytes.
- Shadow mirror: enabled for all supported entity kinds.
- Integrity projection writes: enabled (`projectionWrites=true`).
- Compact month projection writes: enabled (`compactProjectionWrites=true`).
- Application reads: legacy only (`readFromV2=false`).
- Direct application v2 writes: disabled (`writeDirectlyToV2=false`).
- Legacy writes: unchanged.
- Legacy deletes/pruning: not authorized and not performed.
- Reconciliation: 166,008 immutable entries and 166,008 compact projection
  values match exactly; 0 missing, 0 mismatched, 0 orphaned, 0 chunked.
- Bounded read projections: 12,853 compact month documents; largest is
  115,311 JSON bytes against a conservative 700 KiB migration guard.
- Synthetic production smoke: create, update, and delete/tombstone passed in
  the immutable, integrity-projection, and compact-projection layers;
  the synthetic source and descendants were verified removed.

The latest management benchmark (five measured iterations after one warm-up)
was:

| Read | P50 | P95 | Exact legacy match |
| --- | ---: | ---: | --- |
| Legacy management (539,381 bytes) | 436.3 ms | 468.5 ms | baseline |
| Metadata-heavy full projection | 4,692.2 ms | 5,002.7 ms | yes |
| Compact full projection | 687.9 ms | 760.8 ms | yes |
| Current-month reserve query | 179.1 ms | 227.6 ms | selected month |
| Current-month activity query | 209.7 ms | 284.9 ms | selected month |

The compact format removed most projection overhead, but full-history hydration
is still slower than legacy. Therefore `readFromV2` remains false. Month/range
queries are faster and are the required route for screen-by-screen cutover.

This is a safe shadow stage, not permission to remove or freeze legacy fields.
It removes the immediate automatic-index-entry danger and establishes a fully
reconciled bounded copy. The legacy document byte-growth risk remains until a
separately verified read cutover allows legacy growth to be stopped.

## Safety invariants

1. The control document is `migrationControls/firestoreV2`.
2. A missing control or `killSwitch=true` makes every mirror Function inert.
3. Mirror Functions never write the source document. They write only beneath
   the source in `firestoreV2Entries`, `firestoreV2Months`, and
   `firestoreV2ReadMonths`.
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
10. Compact month documents have their `maps` and `arrays` fields excluded
    from indexing and are rejected by migration tooling above 700 KiB.
11. No legacy field may be pruned without a new backup, exact reconciliation,
    read-equivalence tests, performance gates, and explicit approval.
12. Background failures retry safely for up to the platform retry window;
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
projectionWrites=false
compactProjectionWrites=false
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
missingProjectionItems=0
mismatchedProjectionItems=0
orphanProjectionItems=0
matchingCompactProjectionItems=expectedCompactProjectionItems
missingCompactProjectionDocuments=0
mismatchedCompactProjectionDocuments=0
orphanCompactProjectionDocuments=0
oversizedCompactProjectionDocuments=0
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

Apply mode requires all three writer controls to be enabled so racing writes
cannot create a gap. Compact projection backfills use source-version guarded
transactions and report any skipped newer write explicitly.

## Canary controls

Enable only management mirroring:

```bash
node scripts/firestore-v2-control.js \
  --project kank-4bbbc \
  --action enable-mirror \
  --kinds management \
  --ack I_UNDERSTAND_THIS_CHANGES_MIGRATION_CONTROL
```

Enable all supported mirror kinds by omitting `--kinds`. Read cutover always
requires an explicit non-empty `--kinds` list:

```bash
node scripts/firestore-v2-control.js \
  --project kank-4bbbc \
  --action enable-read \
  --kinds management \
  --ack I_UNDERSTAND_THIS_CHANGES_MIGRATION_CONTROL
```

Immediate read rollback keeps all writers running and returns clients to
legacy data:

```bash
node scripts/firestore-v2-control.js \
  --project kank-4bbbc \
  --action rollback-read \
  --ack I_UNDERSTAND_THIS_CHANGES_MIGRATION_CONTROL
```

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

## Read cutover gate (blocked; not enabled)

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

The 2026-08-13 full-history benchmark failed criterion 3, so no legacy field
was removed and no read flag was enabled. This is a deliberate safety stop,
not a completed source-document compaction.
