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
3. Mirror Functions write only beneath the source until an explicit cutover
   adds `_firestoreV2Archive` and enables `legacyCompactionEnabled`. After that,
   the mirror may transactionally remove only allowlisted, already-archived
   keys from the source after their v2 update commits.
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
13. The daily retention job is inert unless `compactionSources` explicitly
    names a source, its fields, and its retention window. It refuses to run
    without exact projections, active mirrors, active v2 reads, and a clear
    kill switch.
14. Retention cutoffs only move forward and archived field allowlists never
    shrink automatically. Only the verified rollback command restores fields.

## Immediate rollback

If no source has `_firestoreV2Archive`, return reads to legacy immediately:

```bash
node scripts/firestore-v2-control.js \
  --project kank-4bbbc \
  --action rollback-read \
  --ack I_UNDERSTAND_THIS_CHANGES_MIGRATION_CONTROL
```

If a source has been compacted, **do not use `disable-all` first**. Restore the
complete legacy document, verify every restored field, and only then disable
v2 reads:

```bash
cd functions
node scripts/firestore-v2-cutover.js \
  --project kank-4bbbc \
  --action rollback \
  --source management/CWGXCLYchpm95b3KjoDJ \
  --ack I_UNDERSTAND_THIS_RESTORES_LEGACY_FIELDS
```

The command first stops automatic compaction, reconstructs the full document
from the compact projections, refuses a restore above the 800 KiB safety
guard, writes it in one transaction, verifies every supported map and array,
and only then sets `readFromV2=false`. Mirror writers stay on so no writes are
lost during incident diagnosis.

`disable-all` is the emergency stop for the shadow system before source
compaction, or after the restore command above has completed:

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

## Exact source compaction and rolling retention

Read-only candidate measurement:

```bash
cd functions
node scripts/firestore-v2-cutover.js \
  --project kank-4bbbc \
  --action verify \
  --source management/CWGXCLYchpm95b3KjoDJ \
  --through 2026-06 \
  --fields moneyInHandsActivities,reserve,moneyGiven,moneyInHandsTracking,monthlyPaymentSnapshots
```

Current measured result: 539,381 JSON proxy bytes before and 213,991 after,
with an exact independent projection reconstruction. These five fields are
append/upsert histories; the historical edit/delete maps remain in the legacy
document.

The destructive command requires its acknowledgement, active management v2
reads, and a fresh verified backup:

```bash
node scripts/firestore-v2-cutover.js \
  --project kank-4bbbc \
  --action compact \
  --source management/CWGXCLYchpm95b3KjoDJ \
  --through 2026-06 \
  --retention-months 2 \
  --fields moneyInHandsActivities,reserve,moneyGiven,moneyInHandsTracking,monthlyPaymentSnapshots \
  --ack I_UNDERSTAND_THIS_COMPACTS_LEGACY_FIELDS
```

The command prints the exact rollback command. The deployed daily job keeps
the current and previous calendar months in the source and advances the cutoff
automatically. Logical history remains complete in monthly v2 documents.

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

The focused page suite covers the compatibility reconstruction plus every
management page with existing behavioral tests:

```bash
npm test -- --watch=false --browsers=ChromeHeadless \
  --include='src/app/utils/firestore-v2-compat.util.spec.ts' \
  --include='src/app/central/today-central/today-central.component.spec.ts' \
  --include='src/app/components/not-paid/not-paid.component.spec.ts' \
  --include='src/app/gestion/gestion-*/gestion-*.component.spec.ts'
```

The current focused result is 36/36 passing. The repository's broad Angular
suite still has unrelated historical failures, so Functions lint/unit tests,
the focused page suite, the production build, and emulator cutover smoke are
the migration gates.

## Read cutover gate

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

The full-history compact projection is slower as a raw isolated read, but the
management stream is now shared with `shareReplay(1)`, eliminating the prior
duplicate full-document reads from page state, role configuration, and global
management state. A live cutover still requires a fresh backup, deployed
compatibility build, exact reconciliation, production smoke, authenticated
page checks, and an empty error-log gate immediately before compaction.
