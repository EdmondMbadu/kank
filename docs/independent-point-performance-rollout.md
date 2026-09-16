# Independent habitual employee performance

Implemented locally on 2026-09-16. No production deployment, scheduler
invocation, correction, reassignment, or historical backfill was performed.

## What changes

The existing `scheduleExpectedKinshasaProd` job is extended, not duplicated.
Its planned execution moves from 08:00 to **00:05 Africa/Kinshasa,
Monday–Saturday**. During the existing client scan it freezes both the
scheduled-client point count and expected FC before daytime collections.

An eligible client is alive (blank/`vivant`), still indebted, scheduled for
that weekday, and has a cycle at least six calendar days old. The habitual
point rule still requires both `client.agent` and employee roster membership.
Pending transfer copies do not count. Broken debt/date/payment-day/minimum
data, contradictory assignments and duplicate
identities yield **unverified**, not a manufactured exact count.

Inactive employee assignments are legitimate. Their scheduled eligible clients
remain in that employee record's assignment bucket, and the manager's site
score sums **all** buckets, including inactive records. For example, 5 earned
points against 5 active plus 7 inactive-assigned expected points is 5/12 =
**41.67% before the view's existing display rounding**, not 100%.
Inactive status does not trigger “Attentes à vérifier” and
does not make former employees reappear in the active public ranking.
This retains the existing valid agent/roster requirement; unassigned clients,
deleted agents and contradictory rosters are not silently repaired by this fix.

Employee `expectedPoints[day]` is server-owned and separate from legacy
`totalDailyPoints`. Payment submissions update achieved `dailyPoints` only
after activation. An expected-only day has achieved zero, even without any
payment, page visit, or employee submission. For example, 10/10 followed by
0/10 is 10/20 = **50%**, not 100%. Employee, manager and monthly habitual
ranking calculations consume these expectations. Existing amount-based and
investigation-specific metric selection remains in place.

Zero workload is neutral, not an automatic failure. The current day is an
in-progress score, not a final disciplinary judgment. Sunday follows the
existing non-capture policy; Sunday extra earned points retain the existing
uncapped/overpayment policy. This patch deliberately does not cap habitual
performance at 100%, change bonuses, or make every existing score input
tamper-proof.

## Failure and history safety

Each site has one immutable `pointExpectationDays/{day}` snapshot. Publication
transactions preserve achieved points, actual FC totals and existing cash
ledger day/update timestamps. Repeated events
skip already-published employees; a partial failure retries the original
snapshot even after clients pay off their debts. Late first capture is refused
after 00:30; events older than 24 hours stop retrying without more scans.

An activation marker on the already-read user document detects entirely
missing captures. New missing/null expectations show an unavailable score
and “Attentes à vérifier”; they are never silently replaced by zero or a
payment-triggered denominator. An incomplete contributor also makes the
habitual global average unavailable rather than excluding it and displaying
an artificially high average. Healthy individual scores remain usable.
An inactive record's departure date does not hide a missing post-activation
capture from the manager's denominator. The scheduler explicitly publishes
zero for inactive records with no eligible workload, so those records remain
neutral when fully captured.

Historical days before activation remain legacy. We cannot reconstruct an
honest pre-payment workload from today's balances alone. Therefore this fixes
the dependency **from activation forward**, not retroactively for unrecorded
old days. Expected maps participate in the existing points archive and
hydration paths, including explicit zero and null values.

Location-specific frozen expectations are not blindly copied/merged by the
browser during employee rotations. The central logical-employee ranking
deduplicates legacy copied history and combines new workloads at their
original sites. A record created after the daily snapshot, a missing original
record, or overlapping mid-day reassignment requires review; this is not a
new event-by-event assignment ledger. The individual location page retains
its existing location-record history scope. Do not interpret those exceptional
cases as proof of misconduct or promise identical historical scope across
all views.

## Speed and cost

No extra browser queries, dependency, callable request, image operation, or
blocking payment/upload step was introduced. Calculation uses employee/user
documents already loaded by the app. One minute timer compares the Kinshasa
date; only a date change recalculates, with no reads.

The backend still performs **one daily scheduled-client scan**, not a scan
per payment or per page. Server-side field selection avoids downloading large
client historical maps. Publication uses bounded concurrency (eight employee
transactions), not unrestricted fan-out. Index exemptions cover the new daily
map and snapshot employee map.
The final inactive-assignment fix adds no additional queries, reads, writes,
dependencies or blocking requests to this implementation: inactive records
were already scanned and published.

The read-only preview saw 9 production sites, 50 employee documents and 1,253
client documents. At that size, each ordinary run adds approximately:

- 50 projected employee root writes;
- day-total writes for all 50 records (some were already written by the old
  FC scheduler; zero-workload records are now explicit);
- up to two transaction reads per employee, instead of the old day-total-only
  read, plus snapshot/user-marker bookkeeping;
- site snapshot create/complete writes, and normal enabled FirestoreV2 mirror
  entry/projection work. Initial activation writes one marker per site.

At 26 scheduled days, 50 employee root updates are about 1,300 writes/month
before those additional operations. This is small at the observed scale,
**not a guarantee of a zero bill**. Capture frequency is unchanged; redundant
per-payment all-employee writes and accumulating browser listeners were
removed after activation, which can offset added background work. Measure
actual FirestoreV2 fan-out and usage after rollout before asserting a cost
reduction.

The final production build keeps the main entry bundle hash/size unchanged
from the earlier local build: 317.53 kB raw / 87.64 kB estimated transfer;
initial total 596.19 kB raw / 123.94 kB estimated transfer. Build hash:
`5b3563fba300e1a0`. Existing CSS/initial-budget warnings remain.

A clean `HEAD` baseline was also built in an isolated temporary directory
using the same installed dependencies and configuration inputs. Its initial
total was 596.20 kB / 124.01 kB estimated transfer. The 1.10 MB shared/public
chunk exists in that baseline too; it was not doubled by this change. All JS
chunks combined add approximately 6.9 kB raw / **2.3 kB gzip**. Chunk IDs/hashes
vary with the isolated build path, so small compression differences include
that effect. Added gzip bytes mainly appear in shared/public code (~1.5 kB),
the employee route (~0.6 kB), and central code (~0.2 kB). Estimated Angular
transfer sizes are not a measurement of a user's actual network connection.

Monthly gap generation is bounded to the selected month instead of growing
with every calendar day since activation. The final desktop synthetic
100-record, 16-day month with a 2020 activation marker measured **3.54 ms
median / 3.84 ms p95**. This is not a Congo mobile-network performance guarantee.

## Preflight findings requiring review

Read-only Thursday 2026-09-17 preview found these existing data issues:

| Site UID | Employee UID | Finding |
| --- | --- | --- |
| `7HUl3ew69sYfikaIr48SvAqm5N33` | `kTE9ebwRTZrBT8ygGsxj` | One scheduled record has incomplete/invalid debt |

The final read-only preview includes the two and five eligible clients assigned
to inactive employees at the two previously flagged sites with **zero issues**.
Those seven clients do not need reassignment just because their employee is
inactive. No production data was changed.
Review the remaining invalid-debt record and weekday coverage before
activation; otherwise the corresponding captures will honestly be unverified
and the global habitual average will be unavailable. The audit is a present
portfolio preview, not an authoritative historical reconstruction.

Repeat a read-only preview with authenticated Admin CLI credentials:

```sh
node functions/scripts/point-expectations-admin.js --project kank-4bbbc --day 9-17-2026
```

## Authorized rollout sequence (not executed)

1. Resolve/review preflight issues with the business owner. Verify the
   00:05 capture occurs before any normal collections and that Mon–Sat/Sunday
   policy is still intended. Do not claim a frozen midnight portfolio handles
   every mid-day schedule/assignment change automatically.
2. Deploy the updated browser app **before** activation; it remains compatible
   with legacy expectations until server markers exist. Cached old payment
   writes remain allowed, but old ranking code must be refreshed to display
   the corrected metric. Test employee transfer/merge administration with the
   new browser version before restricting server-owned fields.
3. Deploy scoped Firestore rules/index exemptions and both changed backend
   exports. Do not deploy all unrelated functions or invoke the scheduler
   manually mid-day. Example targeted commands, subject to production approval:

   ```sh
   npm run build
   firebase deploy --project kank-4bbbc --only hosting
   firebase deploy --project kank-4bbbc --only firestore:rules,firestore:indexes
   firebase deploy --project kank-4bbbc --only functions:mirrorEmployeeFirestoreV2,functions:scheduleExpectedKinshasaProd
   ```

4. Verify the scheduler is enabled, its timezone/cron is correct, and the next
   natural early execution logs completion. Inspect each site's snapshot
   `status: complete`, explicit zero/null counts, and unchanged actual totals.
   Check employee and manager pages plus central ranking with an expected-only
   day and a throttled network. Emulators do not prove production deployment
   configuration or mobile UX.
5. Monitor missing/null coverage, execution failures/retries, trigger fan-out,
   billed reads/writes and function time. A pause stops future captures, not
   silently resumes the old payment-triggered denominator. Once activated,
   missed days remain unverified until a verified recovery/business decision;
   do not remove activation markers to conceal them. Keep old snapshots and
   correction audit trails. A full code rollback after activation needs a
   separate reviewed data/metric rollback plan.

## Explicit audited corrections

The Admin script defaults to a dry run and requires a reason. It only corrects
an employee with an **original frozen snapshot**; it will not invent missing
historical days. Original snapshots and actual earned points are preserved.
An explicit correction updates both projected counts atomically and appends
an immutable correction audit document. This tool's actor label identifies
the admin CLI, not a separately validated human identity; restrict credentials.

```sh
node functions/scripts/point-expectations-admin.js --project kank-4bbbc --action correct --owner SITE_UID --employee EMPLOYEE_UID --day 9-17-2026 --expected-points 10 --reason "Verified original roster correction"
```

Applying requires the additional flags `--apply --ack
I_APPROVE_THIS_EXPECTED_POINTS_CORRECTION` and explicit business approval.

## Verification

```sh
npx tsc -p tsconfig.spec.json --noEmit
npm run test:functions
npm run test:performance-points
npm run test:critical
npm run test:point-expectations
npm run test:storage-rules
npm run build
git diff --check
```

Browser runs on this machine use a temporary Karma configuration with
`client.clearContext: true` to work around the existing Chrome 153 iframe
reload issue. No assertions were disabled and no application dependency or
repository Karma configuration was changed.

Final results: TypeScript check passed; functions 85/85; focused browser
performance regressions 92/92; critical browser flows 188/188; capture/rules
emulator integration 9/9; existing storage/Firestore rules 12/12. These suites
overlap; do not add the counts as unique tests. Production build, scoped
new-backend-file ESLint checks (ECMAScript 2022 parser, matching the modern
runtime syntax) and `git diff --check` passed. `test:stability` now includes the
new browser and emulator regression scripts. No live production mobile smoke
test or natural scheduled capture was performed by this local implementation.

Final inactive-assignment checks cover status variants, valid no-payment
captures, inactive zero-workload neutrality, manager today/month denominators,
global aggregation without double-counting the manager, public-list exclusion,
earned points on inactive-assigned clients, frozen retry after payoff, and
missing capture after a recorded departure date. Legacy days without an
activation marker retain their old scope and are not backfilled.

Rules tests explicitly exercise owner/admin/portal/public access, setting,
removing and type-changing protected fields, snapshot forgery, nested owner
wildcards and archive tampering, alongside legitimate legacy/payment and
attendance writes. These are scoped prototype guards, not a full security
audit of existing role permissions, PII reads, achieved-point writes,
assignment/deletion permissions or payment concurrency.
