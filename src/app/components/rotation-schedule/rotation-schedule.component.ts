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
import { AuthService } from 'src/app/services/auth.service';
import { PerformanceService } from 'src/app/services/performance.service';
@Component({
  selector: 'app-rotation-schedule',
  templateUrl: './rotation-schedule.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RotationScheduleComponent implements OnInit, OnChanges {
  private schedSub?: Subscription;
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
  monthWeeks: ({
    iso: string;
    employeeUid?: string;
    employee?: Employee;
  } | null)[][] = [];
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
  taskMonthWeeks: ({
    iso: string; // '2025‑07‑21'
    loc?: string; // location or undefined
  } | null)[][] = [];

  taskPicker = { visible: false, day: null as any, loc: '' };
  /* 2️⃣ react when @Input locations changes */
  ngOnChanges(changes: SimpleChanges) {
    if ('locations' in changes) {
      const list = changes['locations'].currentValue as string[] | undefined;
      if (list?.length && !this.location) {
        this.location = this.chooseDefaultLocation(list);
        this.refresh();
        this.loadAllLocationsCurrentMonth();
      }
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
  openTFPicker(day: any) {
    this.taskPicker = { visible: true, day, loc: day.loc || '' };
  }
  closeTFPicker() {
    this.taskPicker.visible = false;
  }
  async saveTF() {
    /* local optimistic update */
    this.taskPicker.day.loc = this.taskPicker.loc.trim() || undefined;
    this.cdr.markForCheck();

    const d = this.taskPicker.day.date;
    await this.rs.setTaskForce(
      this.isoWeekId(d),
      this.taskPicker.day.iso,
      this.taskPicker.loc.trim() || undefined
    );
    this.closeTFPicker();
    this.loadTaskForceMonth();
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
      weekRow[d.getDay()] = { iso };
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
              const uid = s.days?.[cell.iso];
              cell.employeeUid = uid;
              cell.employee = this.employees.find((e) => e.uid === uid);
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
  }

  /* month navigation — unchanged */
  prevMonth() {
    const p = this.addMonths(new Date(this.year, this.month - 1), -1);
    this.month = p.getMonth() + 1;
    this.year = p.getFullYear();
    this.refresh();
    this.loadAllLocationsCurrentMonth();
  }
  nextMonth() {
    const n = this.addMonths(new Date(this.year, this.month - 1), 1);
    this.month = n.getMonth() + 1;
    this.year = n.getFullYear();
    this.refresh();
    this.loadAllLocationsCurrentMonth();
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
      (e) =>
        !low ||
        e.firstName!.toLowerCase().includes(low) ||
        e.lastName!.toLowerCase().includes(low)
    );
  }

  // async select(emp: Employee) {
  //   await this.rs.setAssignment(
  //     this.location,
  //     this.year,
  //     this.month,
  //     this.pickerDay,
  //     emp.uid
  //   );
  //   this.closePicker();
  //   this.refresh();
  // }
  async select(emp: Employee) {
    /* 1️⃣ local optimistic update */
    this.applyLocalAssignment(this.pickerDay, emp);

    this.closePicker(); // close instantly
    /* 2️⃣ async save to Firestore */
    await this.rs.setAssignment(
      this.location,
      this.year,
      this.month,
      this.pickerDay,
      emp.uid
    );
    // optional: this.refresh(); // Firestore listener will sync anyway
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
  private applyLocalAssignment(iso: string, emp?: Employee) {
    for (const row of this.monthWeeks) {
      for (const cell of row) {
        if (cell && cell.iso === iso) {
          cell.employee = emp;
          cell.employeeUid = emp?.uid;
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
  thisWeekRotation: { employee: Employee; location: string }[] = [];
  nextWeekRotation: { employee: Employee; location: string }[] = [];
  private loadAllLocationsCurrentMonth(): void {
    this.allSchedules = [];
    /* Fermer d’éventuelles souscriptions précédentes */
    this.schedSub?.unsubscribe();

    const month$ = this.locations.map((loc) =>
      this.rs.getSchedule(loc, this.year, this.month).pipe(
        tap((sched) => {
          Object.entries(sched.days ?? {}).forEach(([iso, uid]) => {
            const emp = this.employees.find((e) => e.uid === uid);
            if (emp)
              this.allSchedules.push({ iso, location: loc, employee: emp });
          });
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
      this.startOfWeek(new Date()), // dimanche de la semaine courante
      this.weekOffset * 7 // décale selon l’offset
    );
    const startThis = baseStart;
    const endThis = this.addDays(startThis, 6);

    const startNext = this.addDays(endThis, 1);
    const endNext = this.addDays(startNext, 6);

    /* MàJ du label à afficher */
    this.thisWeekLabel = `${this.frDate(startThis)} au ${this.frDate(endThis)}`;
    const uniq = new Map<string, { employee: Employee; location: string }>();

    const inSpan = (d: Date, a: Date, b: Date) => d >= a && d <= b;

    const thisW: typeof this.thisWeekRotation = [];
    const nextW: typeof this.nextWeekRotation = [];

    for (const a of this.allSchedules) {
      const d = new Date(a.iso);
      const key = `${a.employee.uid}-${a.location}`; // dé-doublonnage

      if (!uniq.has(key)) {
        if (inSpan(d, startThis, endThis)) thisW.push(a);
        else if (inSpan(d, startNext, endNext)) nextW.push(a);

        uniq.set(key, a);
      }
    }
    this.thisWeekRotation = this.dedupe(thisW);
    this.nextWeekRotation = this.dedupe(nextW);
  }
  /** Fetch TaskForce for the whole displayed month */
  private loadTaskForceMonth() {
    /* (1) skeleton identical to rotation grid --------------------- */
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
    this.taskMonthWeeks = weeks; // set now (empty)

    /* (2) figure out the ISO‑week documents we must read ---------- */
    const ids = new Set<string>();
    for (let d = first; d <= last; d = this.addDays(d, 7))
      ids.add(this.isoWeekId(d)); // one per week

    /* (3) read them all and merge into the grid ------------------- */
    ids.forEach((id) => {
      this.rs.getTaskForce(id).subscribe((doc) => {
        Object.entries(doc?.days ?? {}).forEach(([iso, loc]) => {
          for (const r of this.taskMonthWeeks)
            for (const c of r) if (c && c.iso === iso) c.loc = loc;
        });
        /* trigger change detection */
        this.zone.run(() => this.cdr.markForCheck());
      });
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
}
