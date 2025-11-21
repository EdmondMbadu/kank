// rotation-schedule.component.ts
import {
  Component,
  Input,
  OnInit,
  ChangeDetectionStrategy,
  NgZone,
  ChangeDetectorRef,
  SimpleChanges,
  OnChanges,
} from '@angular/core';
import { combineLatest, Subscription, tap } from 'rxjs';
import { Employee } from 'src/app/models/employee';
import { LocationCred } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { PerformanceService } from 'src/app/services/performance.service';

type TFEntry = { loc: string; employees: string[] }; // keep UIDs
type TFCell = { iso: string; entries?: TFEntry[] };
type RotCell = { iso: string; employeeUids: string[]; employees: Employee[] };
// Add near the other types
type WeekRotationItem = {
  employee: Employee;
  location: string;
  daysCount: number; // how many distinct days this week
  weekdays: string[]; // e.g., ['Lun', 'Mer', 'Ven']
  dates: string[]; // ISO 'YYYY-MM-DD' for internal sort/debug
};

@Component({
  selector: 'app-rotation-schedule',
  templateUrl: './rotation-schedule.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RotationScheduleComponent implements OnInit, OnChanges {
  private schedSub?: Subscription;
  private tfSubs: Subscription[] = [];
  private tfCellByIso = new Map<string, TFCell>();

  // 🔸 Objectives store (week + employee + locationKey → bullets[])
  private objectivesSubs: Subscription[] = [];
  private objectivesByKey = new Map<string, string[]>();
  thisWeekId = '';
  nextWeekId = '';
  showLocations = false;

  pwVisible: Record<string, boolean> = {};
  liveMsg = '';

  // add "summary" to your copied state
  copied: {
    email: Record<string, boolean>;
    password: Record<string, boolean>;
    summary: Record<string, boolean>;
  } = {
    email: {},
    password: {},
    summary: {},
  };
  copiedTable = false;
  passModal = {
    visible: false,
    weekId: '',
    employee: null as Employee | null,
    location: '',
    input: '',
    error: '',
  };

  // helper to build the formatted text
  summaryText(loc: { name: string; email?: string; password?: string }) {
    return `Rotation: ${loc.name}
============
lien: https://kank-4bbbc.web.app/

email: ${loc.email ?? '—'}
mot de passe: ${loc.password ?? '—'}`;
  }

  locationsPasswords: LocationCred[] = []; // now realtime from Firestore
  editing: Record<string, boolean> = {}; // id → editing?
  drafts: Record<string, { email: string; password: string }> = {};
  savingRow: Record<string, boolean> = {};
  adding = false;
  newRow = { name: '', email: '', password: '' };

  trackByName = (_: number, item: { name: string }) => item.name;

  // add 'summary' everywhere we reference the kind
  async copy(
    text: string | undefined,
    kind: 'email' | 'password' | 'summary',
    key: string
  ) {
    if (!text) return;
    this.setCopied(kind, key);
    const write = navigator.clipboard?.writeText(text);
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 200));
    try {
      await Promise.race([write as Promise<void>, timeout]);
    } catch {}
    this.liveMsg = `${
      kind === 'summary'
        ? 'Résumé'
        : kind === 'email'
        ? 'Email'
        : 'Mot de passe'
    } copié pour ${key}`;
    setTimeout(() => (this.liveMsg = ''), 120);
  }

  private setCopied(kind: 'email' | 'password' | 'summary', key: string) {
    if (!this.copied[kind]) this.copied[kind] = {};
    this.copied[kind][key] = true;
    setTimeout(() => (this.copied[kind][key] = false), 1200);
  }

  objModal = {
    visible: false,
    weekId: '',
    employee: null as Employee | null,
    location: '',
    bullets: [] as string[],
    textarea: '',
    cred: null as LocationCred | null, // 👈 add
  };

  savingObj = false;

  taskMonthWeeks: (TFCell | null)[][] = [];
  taskWeekSummary: { day: string; entries: TFEntry[] }[] = [];
  /* ---- inputs ---- */
  @Input() employees: Employee[] = [];
  @Input() locations: string[] = [];
  public readonly weekHeaders = [
    'Dimanche',
    'Lundi',
    'Mardi',
    'Mercredi',
    'Jeudi',
    'Vendredi',
    'Samedi',
  ];
  monthWeeks: (RotCell | null)[][] = [];
  public readonly monthNames: string[] = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ];

  public readonly monthNamesShort: string[] = [
    'Jan',
    'Fév',
    'Mar',
    'Avr',
    'Mai',
    'Jui',
    'Jui',
    'Aoû',
    'Sep',
    'Oct',
    'Nov',
    'Déc',
  ];
  /* ---- state ---- */
  location = '';
  month = new Date().getMonth() + 1; // 1-12
  year = new Date().getFullYear();

  /** one entry per calendar day */
  monthDays: {
    iso: string; // '2025-06-04'
    weekday: string; // 'Mer' / 'Thu' …
    employeeUid?: string;
    employee?: Employee;
  }[] = [];

  /* ---- picker ---- */
  pickerVisible = false;
  pickerDay = ''; // iso string currently picked
  search = '';

  /* ── STATE  ─────────────────────────────────────────────── */
  taskWeekOffset = 0; // 0 = this week
  taskWeekLabel = '';
  taskDays: { date: Date; iso: string; loc?: string }[] = [];
  /* ── full‑month TaskForce grid ── */

  taskPicker = {
    visible: false,
    day: null as null | { iso: string; date: Date },
    // editable working copy for the day:
    entries: [] as { loc: string; employees: string[] }[],
    // UI inputs for adding a new location + people:
    newLoc: '',
    search: '',
    selected: new Set<string>(), // selected employee UIDs to add
  };

  /* 2️⃣ react when @Input locations or employees changes */
  ngOnChanges(changes: SimpleChanges) {
    if ('locations' in changes) {
      const list = changes['locations'].currentValue as string[] | undefined;
      if (list?.length && !this.location) {
        this.location = this.chooseDefaultLocation(list);
        this.refresh();
        this.loadAllLocationsCurrentMonth();
      }
    }
    if ('employees' in changes) {
      // Reload schedules when employees list changes to pick up new employees
      this.loadAllLocationsCurrentMonth();
    }
  }
  // ───────────────────────────────────────────────
  constructor(
    private rs: PerformanceService,
    public auth: AuthService,
    private zone: NgZone, // ① add
    private cdr: ChangeDetectorRef // ② add
  ) {} // or your renamed service

  private chooseDefaultLocation(list: string[]): string {
    const me = (this.auth.currentUser?.firstName || '').toLowerCase();
    /* try exact (case-insensitive) match */
    const match = list.find((l) => l.toLowerCase() === me);
    return match ?? list[0]; // fallback to first item
  }
  // ───────────────────────────────────────────────

  ngOnInit() {
    if (!this.location && this.locations.length) {
      this.location = this.chooseDefaultLocation(this.locations);
      this.refresh();
      this.loadAllLocationsCurrentMonth();
    }
    // this.loadTaskForceWeek();
    this.loadTaskForceMonth();
    // ⬇️ Read auditEditable (default to true if field missing)
    this.rs.getTaskForce(this.currentWeekId()).subscribe((doc: any) => {
      // if undefined => true (open) to avoid locking people out by surprise
      this.tfAuditEditable = doc?.['auditEditable'] !== false;
      this.cdr.markForCheck();
    });
    this.rs.streamLocationCreds().subscribe((rows) => {
      this.locationsPasswords = rows;
      // keep edit drafts in sync when not editing
      rows.forEach((r) => {
        if (!this.editing[r.id]) {
          this.drafts[r.id] = {
            email: r.email || '',
            password: r.password || '',
          };
        }
      });
      this.cdr.markForCheck();
    });
  }

  /* ── ISO‑WEEK utilities (no external libs) ─────────────── */
  private getISOWeek(d: Date): number {
    const t = new Date(d.getTime());
    t.setHours(0, 0, 0, 0);
    // Thursday = week anchor
    t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
    const week1 = new Date(t.getFullYear(), 0, 4);
    return (
      1 +
      Math.round(
        ((t.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7
      )
    );
  }
  private isoWeekId(d: Date) {
    return `${d.getFullYear()}-W${this.getISOWeek(d)
      .toString()
      .padStart(2, '0')}`;
  }

  /* ── navigation ─────────────────────────────────────────── */
  tfNextWeek() {
    this.taskWeekOffset++;
    this.loadTaskForceWeek();
  }
  tfPrevWeek() {
    if (this.taskWeekOffset) {
      this.taskWeekOffset--;
      this.loadTaskForceWeek();
    }
  }

  /* ── build seven days & fetch Firestore ────────────────── */
  private loadTaskForceWeek() {
    // base = Sunday of desired week
    const base = this.addDays(
      this.startOfWeek(new Date()),
      this.taskWeekOffset * 7
    );
    const end = this.addDays(base, 6);
    this.taskWeekLabel = `${base.toLocaleDateString()} – ${end.toLocaleDateString()}`;

    this.taskDays = Array.from({ length: 7 }).map((_, i) => {
      const d = this.addDays(base, i);
      return { date: d, iso: this.ymd(d) };
    });

    /* use the Monday of the same row, not the Sunday */
    const isoKey = this.isoWeekId(this.addDays(base, 1)); // Monday
    this.rs.getTaskForce(isoKey).subscribe((doc) => {
      this.taskDays.forEach((d) => (d.loc = doc?.days?.[d.iso]));
      this.zone.run(() => this.cdr.markForCheck());
    });
  }

  openTFPicker(cell: { iso: string }) {
    if (!this.tfCanEdit) return; // distributors blocked when toggle is OFF

    const dateObj = this.isoToLocal(cell.iso);
    let entries: TFEntry[] = [];
    for (const row of this.taskMonthWeeks)
      for (const c of row)
        if (c && c.iso === cell.iso) entries = c.entries ?? [];

    this.taskPicker = {
      visible: true,
      day: { iso: cell.iso, date: dateObj },
      entries: entries.map((e) => ({
        loc: e.loc,
        employees: [...(e.employees || [])],
      })),
      newLoc: '',
      search: '',
      selected: new Set<string>(),
    };
  }

  closeTFPicker() {
    this.taskPicker.visible = false;
  }

  public byUid(uid?: string) {
    return this.employees.find((e) => e.uid === uid);
  }
  public mapUids(uids: string[] = []): Employee[] {
    return uids.map((u) => this.byUid(u)).filter(Boolean) as Employee[];
  }

  async saveTF() {
    if (!this.taskPicker.day) return;

    const iso = this.taskPicker.day.iso;
    const weekId = this.isoWeekId(this.taskPicker.day.date);

    // Build the map expected by the service
    const map: { [k: string]: { loc: string; employees: string[] } } = {};
    for (const e of this.taskPicker.entries) {
      const key = e.loc
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      map[key] = { loc: e.loc, employees: e.employees };
    }

    await this.rs.setTaskForceDay(
      weekId,
      iso,
      Object.keys(map).length ? map : null
    );

    this.closeTFPicker();
    this.loadTaskForceMonth(); // refresh grid + summary
  }

  /* ─────────── state supplémentaire ─────────── */
  weekOffset = 0; // 0 = cette semaine, 1 = +1 semaine, etc.
  thisWeekLabel = ''; // pour le template

  /* ─────────── helpers ─────────── */
  private frDate(d: Date): string {
    return d.toLocaleDateString('fr-FR'); // 05/07/2025
  }

  /* ─────────── navigation semaines ─────────── */
  nextWeek() {
    this.weekOffset++;
    this.computeWeekRotations();
  }
  prevWeek() {
    if (this.weekOffset > 0) {
      // on ne recule pas avant « cette semaine »
      this.weekOffset--;
      this.computeWeekRotations();
    }
  }
  /** Build grid *then* merge any saved assignments */
  refresh() {
    if (!this.location) {
      this.monthWeeks = [];
      return;
    }

    /* build the skeleton grid (unchanged)… */
    const first = this.startOfMonth(new Date(this.year, this.month - 1));
    const last = this.endOfMonth(first);
    const weeks: typeof this.monthWeeks = [];
    let weekRow = new Array(7).fill(null);
    for (let d = first; d <= last; d = this.addDays(d, 1)) {
      const iso = this.ymd(d);
      weekRow[d.getDay()] = { iso, employeeUids: [], employees: [] };
      if (d.getDay() === 6) {
        weeks.push(weekRow);
        weekRow = new Array(7).fill(null);
      }
    }
    if (weekRow.some((c) => c)) weeks.push(weekRow);

    /* 🔑 1) close any previous listener */
    this.schedSub?.unsubscribe();

    /* 🔑 2) open a fresh one */
    this.schedSub = this.rs
      .getSchedule(this.location, this.year, this.month)
      .subscribe((s) => {
        for (const row of weeks) {
          for (const cell of row) {
            if (cell) {
              const val = s.days?.[cell.iso];
              const uids = Array.isArray(val)
                ? val.filter(Boolean)
                : val
                ? [val]
                : [];
              cell.employeeUids = uids;
              cell.employees = uids
                .map((u: string) => this.employees.find((e) => e.uid === u))
                .filter(Boolean) as Employee[];
            }
          }
        }
        this.zone.run(() => {
          this.monthWeeks = weeks; // new reference
          this.cdr.markForCheck(); // tell Angular to re-render now
        });
      });
  }

  /* good hygiene: tear-down when component is destroyed */
  ngOnDestroy() {
    this.schedSub?.unsubscribe();
    this.objectivesSubs.forEach((s) => s.unsubscribe());
    this.tfSubs.forEach((s) => s.unsubscribe());
  }

  /* month navigation — unchanged */
  prevMonth() {
    const p = this.addMonths(new Date(this.year, this.month - 1), -1);
    this.month = p.getMonth() + 1;
    this.year = p.getFullYear();
    this.refresh();
    this.loadAllLocationsCurrentMonth();
    this.loadTaskForceMonth();
  }
  nextMonth() {
    const n = this.addMonths(new Date(this.year, this.month - 1), 1);
    this.month = n.getMonth() + 1;
    this.year = n.getFullYear();
    this.refresh();
    this.loadAllLocationsCurrentMonth();
    this.loadTaskForceMonth();
  }

  /* picker helpers — unchanged except service name if you renamed it */
  openPicker(iso: string) {
    this.pickerDay = iso;
    this.search = '';
    this.pickerVisible = true;
  }
  closePicker() {
    this.pickerVisible = false;
  }
  filteredEmployees() {
    const low = this.search.toLowerCase();
    return this.employees.filter(
      (e) => {
        // Show working employees and transferred employees - no other filtering
        const status = (e.status || '').toLowerCase().trim();
        const isWorking = status === 'travaille';
        const isTransferred = status === 'transféré' || status === 'transfere';
        
        // Include if: working OR transferred
        const shouldInclude = isWorking || isTransferred;
        
        if (!shouldInclude) return false;
        
        // Then filter by search text if provided
        return !low ||
          e.firstName!.toLowerCase().includes(low) ||
          e.lastName!.toLowerCase().includes(low);
      }
    );
  }

  async select(emp: Employee) {
    if (!this.pickerDay) return;

    // 1) local optimistic append
    this.applyLocalAssignment(this.pickerDay, emp);
    this.cdr.markForCheck();

    // 2) persist (append in Firestore)
    await this.rs.setAssignment(
      this.location,
      this.year,
      this.month,
      this.pickerDay,
      emp.uid
    );
  }
  /** CLEAR from ✕ in the modal or cell */
  async clearAssignmentFromCell(iso: string, ev: Event) {
    if (!this.auth.isAdmin) return;
    ev.stopPropagation();

    /* 1️⃣ local clear */
    this.applyLocalAssignment(iso, undefined);

    /* 2️⃣ async save */
    await this.rs.setAssignment(
      this.location,
      this.year,
      this.month,
      iso,
      undefined
    );
  }
  /* helper (one place only) */
  // AFTER (append or clear-all)
  private applyLocalAssignment(iso: string, emp?: Employee) {
    for (const row of this.monthWeeks) {
      for (const cell of row) {
        if (cell && cell.iso === iso) {
          if (!emp) {
            // clear all
            cell.employeeUids = [];
            cell.employees = [];
          } else {
            // append unique
            if (!cell.employeeUids.includes(emp.uid!)) {
              cell.employeeUids = [...cell.employeeUids, emp.uid!];
              cell.employees = [...cell.employees, emp];
            }
          }
        }
      }
    }
  }
  async clearAssignment() {
    await this.rs.setAssignment(
      this.location,
      this.year,
      this.month,
      this.pickerDay,
      undefined
    );
    this.closePicker();
    this.refresh();
  }
  /** Tous les jours assignés, tous sites confondus, pour le mois affiché */
  private allSchedules: {
    iso: string;
    location: string;
    employee: Employee;
  }[] = [];

  /** Listes prêtes pour le template */

  // Replace existing fields’ types
  thisWeekRotation: WeekRotationItem[] = [];
  nextWeekRotation: WeekRotationItem[] = [];
  private loadAllLocationsCurrentMonth(): void {
    this.allSchedules = [];
    /* Fermer d’éventuelles souscriptions précédentes */
    this.schedSub?.unsubscribe();

    const month$ = this.locations.map((loc) =>
      this.rs.getSchedule(loc, this.year, this.month).pipe(
        tap((sched) => {
          Object.entries(sched.days ?? {}).forEach(
            ([iso, val]: [string, any]) => {
              const uids = Array.isArray(val)
                ? val.filter(Boolean)
                : val
                ? [val]
                : [];
              uids.forEach((uid: string) => {
                const emp = this.employees.find((e) => e.uid === uid);
                if (emp) {
                  // Include all employees that are in the schedule - no filtering
                  // If they're assigned to rotation days, they should be shown
                  this.allSchedules.push({ iso, location: loc, employee: emp });
                }
              });
            }
          );
        })
      )
    );

    /* Une seule souscription qui attend la fin de toutes */
    this.schedSub = combineLatest(month$).subscribe(() => {
      this.computeWeekRotations();
      this.refresh(); // conserve la grille existante pour le site actif
      this.cdr.markForCheck();
    });
  }
  private computeWeekRotations(): void {
    const baseStart = this.addDays(
      this.startOfWeek(new Date()),
      this.weekOffset * 7
    );
    const startThis = baseStart;
    const endThis = this.addDays(startThis, 6);

    const startNext = this.addDays(endThis, 1);
    const endNext = this.addDays(startNext, 6);

    this.thisWeekLabel = `${this.frDate(startThis)} au ${this.frDate(endThis)}`;

    // NEW: build detailed weekly lists
    this.thisWeekRotation = this.buildWeeklyAssignments(startThis, endThis);
    this.nextWeekRotation = this.buildWeeklyAssignments(startNext, endNext);

    // compute ISO-week ids (use Monday inside each span)
    const mondayThis = this.addDays(
      this.startOfWeek(new Date()),
      this.weekOffset * 7 + 1
    );
    const mondayNext = this.addDays(mondayThis, 7);
    this.thisWeekId = this.isoWeekId(mondayThis);
    this.nextWeekId = this.isoWeekId(mondayNext);

    // (re)load objectives for both weeks
    this.loadObjectivesForWeeks([this.thisWeekId, this.nextWeekId]);
  }

  private buildWeeklyAssignments(start: Date, end: Date): WeekRotationItem[] {
    // key = employeeUid|location
    const bucket = new Map<
      string,
      { emp: Employee; loc: string; dates: Set<string> }
    >();

    for (const a of this.allSchedules) {
      const d = this.isoToLocal(a.iso);
      if (d >= start && d <= end) {
        // If they're in allSchedules, they're on the rotation schedule - show them
        // No filtering by status - just show everyone who's assigned to rotation days
        const key = `${a.employee.uid}|${a.location}`;
        let rec = bucket.get(key);
        if (!rec) {
          rec = { emp: a.employee, loc: a.location, dates: new Set<string>() };
          bucket.set(key, rec);
        }
        rec.dates.add(a.iso);
      }
    }

    // order weekdays Sun..Sat for stable display
    const dayOrder = (iso: string) => this.isoToLocal(iso).getDay();

    const toShort = (iso: string) =>
      ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][
        this.isoToLocal(iso).getDay()
      ];

    const items: WeekRotationItem[] = [];
    bucket.forEach(({ emp, loc, dates }) => {
      const sorted = Array.from(dates).sort(
        (a, b) => dayOrder(a) - dayOrder(b)
      );
      items.push({
        employee: emp,
        location: loc,
        daysCount: sorted.length,
        weekdays: sorted.map(toShort),
        dates: sorted,
      });
    });

    // optional: sort by employee name then location
    items.sort((a, b) => {
      const an = (a.employee.lastName || '').localeCompare(
        b.employee.lastName || ''
      );
      if (an !== 0) return an;
      return (a.location || '').localeCompare(b.location || '');
    });

    return items;
  }

  /** Fetch TaskForce for the whole displayed month */
  /** Fetch TaskForce for the whole displayed month */
  private loadTaskForceMonth() {
    // 0) cleanup previous TF subscriptions
    this.tfSubs.forEach((s) => s.unsubscribe());
    this.tfSubs = [];
    this.tfCellByIso.clear();

    // (1) skeleton identical to rotation grid ---------------------
    const first = this.startOfMonth(new Date(this.year, this.month - 1));
    const last = this.endOfMonth(first);
    const weeks: typeof this.taskMonthWeeks = [];
    let row = new Array(7).fill(null);

    for (let d = first; d <= last; d = this.addDays(d, 1)) {
      const iso = this.ymd(d);
      row[d.getDay()] = { iso };
      if (d.getDay() === 6) {
        weeks.push(row);
        row = new Array(7).fill(null);
      }
    }
    if (row.some((c) => c)) weeks.push(row);

    // create index for fast lookups
    for (const r of weeks) {
      for (const c of r) {
        if (c) this.tfCellByIso.set(c.iso, c);
      }
    }

    this.taskMonthWeeks = weeks; // set now (empty grid visible)

    // (2) figure out the ISO‑week documents we must read ----------
    const ids = new Set<string>();
    for (let d = first; d <= last; d = this.addDays(d, 7)) {
      ids.add(this.isoWeekId(d)); // one per week
    }

    // (3) read them all and merge into the grid -------------------
    ids.forEach((id) => {
      const sub = this.rs.getTaskForce(id).subscribe((doc) => {
        const days = doc?.days ?? {};

        // A) clear only the cells that belong to THIS iso week
        for (const [iso, cell] of this.tfCellByIso) {
          if (this.isoWeekId(this.isoToLocal(iso)) === id) {
            cell.entries = [];
          }
        }

        // B) apply fresh data from this doc
        Object.entries(days).forEach(([iso, val]) => {
          const cell = this.tfCellByIso.get(iso);
          if (!cell) return;

          const dayMap =
            typeof val === 'string'
              ? { [val.toLowerCase()]: { loc: val, employees: [] } }
              : (val as Record<string, { loc: string; employees: string[] }>);

          cell.entries = Object.values(dayMap).map((d) => ({
            loc: d.loc,
            employees: Array.isArray(d.employees) ? d.employees : [],
          }));
        });

        this.recomputeTaskWeekSummary();
        this.zone.run(() => this.cdr.markForCheck());
      });

      this.tfSubs.push(sub);
    });
  }

  /* Petit util pour retirer d’éventuels doublons */
  private dedupe(arr: { employee: Employee; location: string }[]) {
    return Array.from(
      new Map(arr.map((o) => [`${o.employee.uid}-${o.location}`, o])).values()
    );
  }

  /* Helpers déjà présents ; ajoutez : */
  private startOfWeek(d: Date) {
    const s = new Date(d);
    s.setDate(s.getDate() - s.getDay()); // dimanche
    s.setHours(0, 0, 0, 0);
    return s;
  }

  /** Turn 'YYYY‑MM‑DD' into a local Date (no TZ shift) */
  private isoToLocal(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d); // month is 0‑based
  }

  /* ---------- tiny date helpers (same as before) ---------- */
  addMonths(d: Date, n: number) {
    const r = new Date(d);
    r.setMonth(r.getMonth() + n);
    return r;
  }
  addDays(d: Date, n: number) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
  }
  startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  endOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth() + 1, 0);
  }
  ymd(d: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  weekday(d: Date) {
    return ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d.getDay()];
  }

  private recomputeTaskWeekSummary(): void {
    const base = this.startOfWeek(new Date()); // Sunday
    const names = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];

    this.taskWeekSummary = Array.from({ length: 7 }).map((_, i) => {
      const d = this.addDays(base, i);
      const iso = this.ymd(d);

      // find the cell and read entries
      let entries: TFEntry[] = [];
      for (const row of this.taskMonthWeeks)
        for (const c of row) if (c && c.iso === iso) entries = c.entries ?? [];

      return { day: names[i], entries };
    });
  }

  // toggle a candidate selection while searching
  toggleSelect(uid: string) {
    if (this.taskPicker.selected.has(uid)) this.taskPicker.selected.delete(uid);
    else this.taskPicker.selected.add(uid);
    this.cdr.markForCheck();
  }

  // add selected people to a given location (create or merge)
  addSelectedToLocation(targetLoc: string) {
    const loc = (targetLoc || '').trim();
    if (!loc || this.taskPicker.selected.size === 0) return;

    // find or create
    const found = this.taskPicker.entries.find(
      (e) => e.loc.toLowerCase() === loc.toLowerCase()
    );
    const toAdd = Array.from(this.taskPicker.selected);

    if (found) {
      const set = new Set(found.employees);
      toAdd.forEach((u) => set.add(u));
      found.employees = Array.from(set);
    } else {
      this.taskPicker.entries.push({ loc, employees: toAdd });
    }

    // reset input state
    this.taskPicker.newLoc = '';
    this.taskPicker.selected.clear();
    this.taskPicker.search = '';
    this.cdr.markForCheck();
  }

  removeUidFromLoc(loc: string, uid: string) {
    const e = this.taskPicker.entries.find((x) => x.loc === loc);
    if (!e || !this.taskPicker.day) return;

    // 1) local update
    e.employees = e.employees.filter((u) => u !== uid);

    // 2) persist immediately
    const weekId = this.isoWeekId(this.taskPicker.day.date);
    this.rs.removeTFPerson(weekId, this.taskPicker.day.iso, loc, uid);

    // optional: if no one left at that location, remove the location entirely
    if (e.employees.length === 0) {
      this.taskPicker.entries = this.taskPicker.entries.filter(
        (x) => x.loc !== loc
      );
      this.rs.clearTFLocation(weekId, this.taskPicker.day.iso, loc);
    }

    this.cdr.markForCheck();
  }

  removeLocation(loc: string) {
    if (!this.taskPicker.day) return;

    // 1) local update
    this.taskPicker.entries = this.taskPicker.entries.filter(
      (e) => e.loc !== loc
    );

    // 2) persist immediately
    const weekId = this.isoWeekId(this.taskPicker.day.date);
    this.rs.clearTFLocation(weekId, this.taskPicker.day.iso, loc);

    this.cdr.markForCheck();
  }

  /** Whether audit (distributor) can edit the current week. Default: true (open). */
  tfAuditEditable = true;

  /** Current week id (Sunday within week is OK; the helper computes ISO week). */
  private currentWeekId(): string {
    return this.isoWeekId(new Date());
  }

  /** Who can open the TF editor right now? */
  get tfCanEdit(): boolean {
    return (
      this.auth.isAdmin || (this.auth.isDistributor && this.tfAuditEditable)
    );
  }

  /** Admin changes the flag */
  setTfAuditEditable(v: boolean) {
    this.tfAuditEditable = v;
    this.rs.setAuditEditable(this.currentWeekId(), v);
  }

  currentPickerEmployees(): Employee[] {
    const iso = this.pickerDay;
    if (!iso) return [];
    for (const row of this.monthWeeks) {
      for (const cell of row) {
        if (cell && cell.iso === iso) return cell.employees || [];
      }
    }
    return [];
  }

  async removeUidFromRotationDay(uid: string) {
    if (!this.pickerDay) return;
    // 1) local update
    for (const row of this.monthWeeks) {
      for (const cell of row) {
        if (cell && cell.iso === this.pickerDay) {
          cell.employeeUids = cell.employeeUids.filter((u) => u !== uid);
          cell.employees = cell.employees.filter((e) => e.uid !== uid);
        }
      }
    }
    this.cdr.markForCheck();

    // 2) persist
    await this.rs.removeRotationUid(
      this.location,
      this.year,
      this.month,
      this.pickerDay,
      uid
    );
  }

  private slugify(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  private objKey(weekId: string, uid?: string, loc?: string): string {
    return `${weekId}::${uid || ''}::${this.slugify(loc || '')}`;
  }

  hasObjectives(weekId: string, uid?: string, loc?: string): boolean {
    return this.objectivesByKey.has(this.objKey(weekId, uid, loc));
  }
  openObjectives(weekId: string, employee: Employee, location: string) {
    const key = this.objKey(weekId, employee?.uid, location);
    const bullets = this.objectivesByKey.get(key) || [];
    this.objModal = {
      visible: true,
      weekId,
      employee,
      location,
      bullets: [...bullets],
      textarea: bullets.join('\n'),
      cred: this.findCredByLocation(location), // 👈 add
    };
    this.cdr.markForCheck();
  }

  closeObjectives() {
    this.objModal.visible = false;
    this.cdr.markForCheck();
  }

  // sanitize: only bullet points (non-empty lines)
  previewBullets(src: string): string[] {
    return (src || '')
      .split('\n')
      .map((s) => s.replace(/^\s*[-•]\s*/, '').trim())
      .filter(Boolean);
  }

  async saveObjectives() {
    if (!this.auth.isAdmin || !this.objModal.visible || !this.objModal.employee)
      return;

    const bullets = this.previewBullets(this.objModal.textarea);
    const key = this.objKey(
      this.objModal.weekId,
      this.objModal.employee.uid,
      this.objModal.location
    );
    this.savingObj = true;
    this.cdr.markForCheck();
    try {
      await this.rs.setRotationObjectives(
        this.objModal.weekId,
        key,
        bullets.length ? bullets : null
      );
      // local cache update (optimistic)
      if (bullets.length) this.objectivesByKey.set(key, bullets);
      else this.objectivesByKey.delete(key);
      this.closeObjectives();
    } finally {
      this.savingObj = false;
      this.cdr.markForCheck();
    }
  }

  private loadObjectivesForWeeks(weekIds: string[]) {
    // clear previous subs for objectives
    this.objectivesSubs.forEach((s) => s.unsubscribe());
    this.objectivesSubs = [];

    weekIds.forEach((weekId) => {
      const sub = this.rs.getRotationObjectives(weekId).subscribe((map) => {
        // remove any existing keys for this week
        const prefix = `${weekId}::`;
        for (const k of Array.from(this.objectivesByKey.keys())) {
          if (k.startsWith(prefix)) this.objectivesByKey.delete(k);
        }
        // merge fresh
        Object.entries(map || {}).forEach(([key, val]) => {
          const arr = Array.isArray(val)
            ? (val as string[]).filter(Boolean)
            : [];
          if (arr.length) this.objectivesByKey.set(key, arr);
        });
        this.cdr.markForCheck();
      });
      this.objectivesSubs.push(sub);
    });
  }

  // Begin editing a row
  startEdit(row: LocationCred) {
    this.editing[row.id] = true;
    this.drafts[row.id] = {
      email: row.email || '',
      password: row.password || '',
    };
    this.cdr.markForCheck();
  }

  // Cancel editing
  cancelEdit(row: LocationCred) {
    this.editing[row.id] = false;
    // reset draft to live data
    this.drafts[row.id] = {
      email: row.email || '',
      password: row.password || '',
    };
    this.cdr.markForCheck();
  }

  // Save a row (admin only)
  async saveRow(row: LocationCred) {
    if (!this.auth.isAdmin) return;
    const draft = this.drafts[row.id] || { email: '', password: '' };
    this.savingRow[row.id] = true;
    this.cdr.markForCheck();
    try {
      await this.rs.setLocationCred(
        row.id,
        {
          email: (draft.email || '').trim(),
          password: (draft.password || '').trim(),
        },
        this.auth.currentUser?.uid || ''
      );
      this.editing[row.id] = false; // realtime listener will refresh row
    } finally {
      this.savingRow[row.id] = false;
      this.cdr.markForCheck();
    }
  }

  // Add a new location (admin only)
  async addNewLocation() {
    if (!this.auth.isAdmin) return;
    const name = (this.newRow.name || '').trim();
    if (!name) return;
    const id = this.slugify(name);
    this.adding = true;
    this.cdr.markForCheck();
    try {
      await this.rs.setLocationCred(
        id,
        {
          name,
          email: (this.newRow.email || '').trim(),
          password: (this.newRow.password || '').trim(),
        },
        this.auth.currentUser?.uid || ''
      );
      this.newRow = { name: '', email: '', password: '' };
    } finally {
      this.adding = false;
      this.cdr.markForCheck();
    }
  }

  // Delete (optional)
  async deleteLocation(row: LocationCred) {
    if (!this.auth.isAdmin) return;
    await this.rs.deleteLocationCred(row.id);
  }

  private findCredByLocation(name: string): LocationCred | null {
    const key = this.slugify(name || '');
    // Prefer matching id; fallback to slugified display name
    return (
      this.locationsPasswords.find(
        (r) => r.id === key || this.slugify(r.name || '') === key
      ) || null
    );
  }

  requestObjectivesWithPass(
    weekId: string,
    employee: Employee,
    location: string
  ) {
    if (this.auth.isAdmin) {
      this.openObjectives(weekId, employee, location);
      return;
    }

    this.passModal = {
      visible: true,
      weekId,
      employee,
      location,
      input: '',
      error: '',
    };
    this.cdr.markForCheck();
  }
  submitPass() {
    const emp = this.passModal.employee;
    const entered = (this.passModal.input || '').trim();

    // Guard: if no employee or no code configured
    if (!emp || !emp.paymentCode) {
      this.passModal.error = "Aucun code n'est configuré pour cet employé.";
      this.cdr.markForCheck();
      return;
    }

    if (entered === emp.paymentCode) {
      // success → close pass modal, open objectifs
      const { weekId, location } = this.passModal;
      this.passModal.visible = false;
      this.cdr.markForCheck();
      this.openObjectives(weekId, emp, location);
    } else {
      this.passModal.error = 'Mot de passe incorrect. Veuillez réessayer.';
      this.cdr.markForCheck();
    }
  }

  closePass() {
    this.passModal.visible = false;
    this.cdr.markForCheck();
  }

  // Generate and copy a beautiful table with all locations
  async copyAllLocationsTable() {
    if (!this.locationsPasswords.length) {
      this.liveMsg = 'Aucun site disponible';
      setTimeout(() => (this.liveMsg = ''), 2000);
      return;
    }

    const link = 'https://kank-4bbbc.web.app/';
    
    // Create a beautiful table format
    const tableLines: string[] = [];
    
    // Calculate column widths dynamically
    const maxNameLen = Math.max(8, ...this.locationsPasswords.map(l => (l.name || '—').length));
    const maxEmailLen = Math.max(5, ...this.locationsPasswords.map(l => (l.email || '—').length));
    const maxPwLen = Math.max(8, ...this.locationsPasswords.map(l => (l.password || '—').length));
    const linkLen = link.length;
    
    const nameWidth = Math.max(maxNameLen, 8);
    const emailWidth = Math.max(maxEmailLen, 5);
    const pwWidth = Math.max(maxPwLen, 8);
    const totalWidth = nameWidth + linkLen + emailWidth + pwWidth + 15; // +15 for borders and separators
    
    // Header
    tableLines.push('┌' + '─'.repeat(totalWidth - 2) + '┐');
    tableLines.push('│' + ' LISTE DES SITES - ACCÈS COMPLETS '.padEnd(totalWidth - 2, ' ') + '│');
    tableLines.push('├' + '─'.repeat(nameWidth + 2) + '┬' + '─'.repeat(linkLen + 2) + '┬' + '─'.repeat(emailWidth + 2) + '┬' + '─'.repeat(pwWidth + 2) + '┤');
    tableLines.push('│ ' + 'Location'.padEnd(nameWidth) + ' │ ' + 'Lien'.padEnd(linkLen) + ' │ ' + 'Email'.padEnd(emailWidth) + ' │ ' + 'Password'.padEnd(pwWidth) + ' │');
    tableLines.push('├' + '─'.repeat(nameWidth + 2) + '┼' + '─'.repeat(linkLen + 2) + '┼' + '─'.repeat(emailWidth + 2) + '┼' + '─'.repeat(pwWidth + 2) + '┤');
    
    // Data rows
    this.locationsPasswords.forEach((loc) => {
      const name = (loc.name || '—').padEnd(nameWidth);
      const email = (loc.email || '—').padEnd(emailWidth);
      const password = (loc.password || '—').padEnd(pwWidth);
      
      tableLines.push(`│ ${name} │ ${link.padEnd(linkLen)} │ ${email} │ ${password} │`);
    });
    
    // Footer
    tableLines.push('└' + '─'.repeat(nameWidth + 2) + '┴' + '─'.repeat(linkLen + 2) + '┴' + '─'.repeat(emailWidth + 2) + '┴' + '─'.repeat(pwWidth + 2) + '┘');
    
    const tableText = tableLines.join('\n');
    
    try {
      await navigator.clipboard.writeText(tableText);
      this.copiedTable = true;
      this.liveMsg = `Tableau de ${this.locationsPasswords.length} site(s) copié !`;
      setTimeout(() => {
        this.copiedTable = false;
        this.liveMsg = '';
      }, 2000);
    } catch (err) {
      this.liveMsg = 'Erreur lors de la copie';
      setTimeout(() => (this.liveMsg = ''), 2000);
    }
  }
}
