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
import { Subscription } from 'rxjs';
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
  /* 2️⃣ react when @Input locations changes */
  ngOnChanges(changes: SimpleChanges) {
    if ('locations' in changes) {
      const list = changes['locations'].currentValue as string[] | undefined;
      if (list?.length && !this.location) {
        this.location = this.chooseDefaultLocation(list);
        this.refresh();
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
  }
  nextMonth() {
    const n = this.addMonths(new Date(this.year, this.month - 1), 1);
    this.month = n.getMonth() + 1;
    this.year = n.getFullYear();
    this.refresh();
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
