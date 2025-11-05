import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

import { Client } from 'src/app/models/client';
import { AttendanceAttachment, Employee } from 'src/app/models/employee';
import { User } from 'src/app/models/user';
import { IdeaSubmission } from 'src/app/models/idea';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';
import { DataService } from 'src/app/services/data.service';
import exifr from 'exifr';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-team-ranking-month',
  templateUrl: './team-ranking-month.component.html',
  styleUrls: ['./team-ranking-month.component.css'],
})
export class TeamRankingMonthComponent implements OnDestroy {
  averagePerformancePercentage: string = '0'; // Add this line
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth() + 1;
  givenMonth: number = this.currentMonth;
  month = this.compute.getMonthNameFrench(this.currentMonth);
  year = this.currentDate.getFullYear();
  givenYear = this.year;
  monthsList: number[] = [...Array(12).keys()].map((i) => i + 1);
  day = this.currentDate.getDate();
  maxRange: number = 0;
  averagePointsMonth: string = '';
  performancePercentageMonth: string = '';
  totalPointsMonth: string = '';
  totalBonus: string = '';
  totalSalary: string = '0'; // NEW: salaries only
  showPresent: boolean = false;
  yearsList: number[] = this.time.yearsList;
  // top-level props
  paidEmployeesToday: any[] = [];
  public excludedEmployees: any[] = []; // holds NaN or ≤ 0 employees
  public showExcludedForAdmin = false; // admin toggle to include them

  // team-ranking-month.component.ts (add near top-level props)
  rankingMode: 'performance' | 'dailyPayments' | 'monthlyPayments' =
    'dailyPayments';
  loadingDaily = false;
  todayKin: string = this.time.todaysDateKinshasFormat();
  todayDayKey: string = this.time.todaysDateMonthDayYear(); // e.g. "9-15-2025"

  allEmployeesAll: Employee[] = []; // includes inactive, used for partner merge
  loadingMonthly = false;
  paidEmployeesMonth: any[] = [];
  showMonthlyAmounts = false;
  showDailyAmounts = false;
  performanceEmployees: Employee[] = [];

  // state: all closed initially
  collapse: Record<'payroll' | 'bonus' | 'loyer', boolean> = {
    payroll: false,
    bonus: false,
    loyer: false,
  };

  // Boîte à idées feed
  ideaSubmissions: IdeaSubmission[] = [];
  ideaPanelOpen = false;
  ideaLoading = false;
  private ideaSub?: Subscription;
  ideaDeletionBusyId: string | null = null;

  // single toggle function
  toggle(section: 'payroll' | 'bonus' | 'loyer') {
    this.collapse[section] = !this.collapse[section];
  }

  toggleIdeaPanel(): void {
    this.ideaPanelOpen = !this.ideaPanelOpen;
  }

  toggleMonthlyAmounts(): void {
    this.showMonthlyAmounts = !this.showMonthlyAmounts;
  }
  toggleDailyAmounts(): void {
    this.showDailyAmounts = !this.showDailyAmounts;
  }

  private listenToIdeaBox(): void {
    this.ideaLoading = true;
    this.ideaSub?.unsubscribe();
    this.ideaSub = this.auth.getIdeaSubmissions().subscribe((ideas) => {
      this.ideaSubmissions = ideas ?? [];
      this.ideaLoading = false;
    });
  }

  get visibleIdeaSubmissions(): IdeaSubmission[] {
    return this.auth.isAdmin
      ? this.ideaSubmissions
      : this.ideaSubmissions.slice(0, 2);
  }

  get hasMoreIdeas(): boolean {
    return !this.auth.isAdmin && this.ideaSubmissions.length > 2;
  }

  get totalDailyAmount(): number {
    return this.paidEmployeesToday.reduce(
      (sum, e: any) => sum + Number(e._dailyTotal || 0),
      0
    );
  }

  get totalDailyAmountUsd(): number {
    const total = this.totalDailyAmount;
    const usd = this.compute.convertCongoleseFrancToUsDollars(String(total));
    return usd === '' ? 0 : usd;
  }

  get totalMonthlyAmount(): number {
    return this.paidEmployeesMonth.reduce(
      (sum, e: any) => sum + Number(e._monthTotal || 0),
      0
    );
  }

  get totalMonthlyAmountUsd(): number {
    const total = this.totalMonthlyAmount;
    const usd = this.compute.convertCongoleseFrancToUsDollars(String(total));
    return usd === '' ? 0 : usd;
  }

  formatIdeaDate(idea: IdeaSubmission): string {
    if (idea?.createdAtISO) {
      const date = new Date(idea.createdAtISO);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }
    return idea?.createdAt ?? '';
  }

  displayIdeaText(idea: IdeaSubmission): string {
    return idea?.ideaText?.trim() ?? '';
  }

  canViewIdeaDetails(): boolean {
    return this.auth.isAdmin;
  }

  async deleteIdea(idea: IdeaSubmission): Promise<void> {
    if (!this.auth.isAdmin || !idea?.id) {
      return;
    }
    if (!confirm('Supprimer définitivement cette idée ?')) {
      return;
    }
    this.ideaDeletionBusyId = idea.id;
    try {
      await this.auth.deleteIdeaSubmission(idea.id);
    } catch (error) {
      console.error("Erreur lors de la suppression de l'idée :", error);
      alert("Impossible de supprimer cette idée pour l'instant.");
    } finally {
      this.ideaDeletionBusyId = null;
    }
  }

  allLocations: any[] = [];
  constructor(
    private router: Router,
    public auth: AuthService,
    public time: TimeService,
    private performance: PerformanceService,
    private compute: ComputationService,
    private data: DataService
  ) {}
  isFetchingClients = false;
  currentEmployees: any = [];
  currentClients: Client[] = [];
  total: string = '0';
  totalHouse: string = '0';
  allUsers: User[] = [];
  ngOnInit(): void {
    this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      // this is really weird. maybe some apsect of angular. but it works for now
      if (this.allUsers.length > 1) this.getAllEmployees();
    });
    this.listenToIdeaBox();
  }

  ngOnDestroy(): void {
    this.ideaSub?.unsubscribe();
  }
  // --- Performance ring geometry ---
  size = 220; // svg canvas
  strokeWidth = 14; // arc thickness
  center = this.size / 2;
  radius = this.center - this.strokeWidth - 6; // a bit of padding
  gradId = 'gradPerf-' + Math.random().toString(36).slice(2, 8);

  get circumference(): number {
    return 2 * Math.PI * this.radius;
  }

  // clamp + parse the avg string you already compute
  get avgPerf(): number {
    const n = parseFloat(this.averagePerformancePercentage || '0');
    return Math.min(100, Math.max(0, isNaN(n) ? 0 : n));
  }

  // stroke offset for the arc
  progressOffset(): number {
    const pct = this.avgPerf / 100;
    return this.circumference * (1 - pct);
  }

  // use your existing gradient color logic to tint chips/accents

  allEmployees: Employee[] = [];
  public graphMonthPerformance = {
    data: [
      {
        domain: { x: [0, 1], y: [0, 1] },
        value: 270,
        title: { text: 'Speed' },
        type: 'indicator',
        mode: 'gauge+number',
        gauge: {
          axis: { range: [0, 100], tickcolor: 'blue' }, // Color of the ticks (optional)
          bar: { color: 'blue' }, // Single color for the gauge bar (needle)
        },
      },
    ],
    layout: {
      margin: { t: 0, b: 0, l: 0, r: 0 }, // Adjust margins
      responsive: true, // Make the chart responsive
    },
  };

  valuesConvertedToDollars: string[] = [];

  // toggle property in general
  getAllEmployees() {
    if (this.isFetchingClients) return;
    this.isFetchingClients = true;

    let tempEmployees: Employee[] = [];
    this.allEmployees = [];
    let completedRequests = 0;

    // reset
    this.total = '0';
    this.totalSalary = '0';
    this.totalHouse = '0';
    this.totalBonus = '0';

    // 1) sum loyer
    (this.allUsers ?? []).forEach((user) => {
      if (user?.housePayment) {
        this.totalHouse = (
          Number(this.totalHouse) + Number(user.housePayment)
        ).toString();
      }
    });

    // 2) fetch employees and sum salaries/bonus
    (this.allUsers ?? []).forEach((user) => {
      this.currentClients = [];
      this.currentEmployees = [];

      this.auth.getAllEmployeesGivenUser(user).subscribe((employees) => {
        tempEmployees = tempEmployees.concat(employees);
        this.currentEmployees = employees;

        this.currentEmployees.forEach((em: any) => {
          this.computePerformances(employees, em);

          // NOTE: do NOT accumulate `totalSalary` here. We defer computing
          // the salary total until we've deduped and filtered employees
          // (see `filterAndInitializeEmployees`) so the UI total only
          // reflects the employees actually displayed.

          if (em?.totalBonusThisMonth) {
            this.totalBonus = (
              Number(this.totalBonus) + Number(em.totalBonusThisMonth)
            ).toString();
          }

          // attach location + UI flags
          em.tempUser = user;
          em.tempLocationHolder = user.firstName;
          em.showAttendance = false;
        });

        completedRequests++;
        if (completedRequests === this.allUsers.length) {
          this.allEmployeesAll = tempEmployees;
          this.filterAndInitializeEmployees(tempEmployees, this.currentClients);
          this.isFetchingClients = false;

          if (this.rankingMode === 'dailyPayments')
            this.loadDailyTotalsForEmployees();
          else if (this.rankingMode === 'monthlyPayments')
            this.loadMonthlyTotalsForEmployees();
          else this.sortEmployeesByPerformance();

          this.setGraphics();

          // 3) compute Actual totals. Compute `totalSalary` from the
          // deduped/filtered `allEmployees` array so it matches the
          // employees that are actually displayed in the payroll table.
          this.totalSalary = this.allEmployees
            .map((e: any) => Number(e.paymentAmount || 0))
            .reduce((s: number, v: number) => s + v, 0)
            .toString();

          // Global total = salaries + house payments
          this.total = (
            Number(this.totalSalary) + Number(this.totalHouse)
          ).toString();
        }
      });
    });
  }
  filterAndInitializeEmployees(
    allEmployees: Employee[],
    currentClients: Client[]
  ) {
    // Use a Map or Set to ensure uniqueness. Here, a Map is used to easily
    // track employees by their uid.
    const uniqueEmployees = new Map<string, Employee>();
    this.allEmployees = [];

    allEmployees.forEach((employee) => {
      // Filter out clients without debt for each employee
      employee.currentClients =
        this.compute.filterClientsWithoutDebtFollowedByEmployee(
          currentClients,
          employee
        );
      // ────────────── NEW: did they get paid this month? ──────────────
      const now = new Date();
      const targetMonth = now.getMonth() + 1; // 1–12
      const targetYear = now.getFullYear(); // e.g. 2025
      const payments = employee.payments || {}; // might be undefined

      employee.paidThisMonth = Object.keys(payments).some((key) => {
        // split "M-D-YYYY-HH-mm-ss" into ["M","D","YYYY"]
        const [mStr, dStr, yStr] = key.split('-', 3);
        const m = Number(mStr),
          d = Number(dStr),
          y = Number(yStr);

        return (
          m === targetMonth && y === targetYear && d > 15 // ← only count payments after the 15th
        );
      });
      // ────────────────────────────────────────────────────────────────

      // If the employee isn't already in the Map, add them
      if (!uniqueEmployees.has(employee.uid!)) {
        uniqueEmployees.set(employee.uid!, employee);
      }
    });

    // Convert the Map values back to an array
    this.allEmployees = Array.from(uniqueEmployees.values());

    // Filter employees who are currently "Travaille" (working)
    this.allEmployees = this.allEmployees.filter((data) => {
      return data.status === 'Travaille';
    });

    this.sortEmployeesByPerformance();

    // Recalculate or update any relevant average performance
    this.calculateAveragePerformancePercentage();

    this.allLocations = Array.from(
      new Set(this.allEmployees!.map((e) => e.tempLocationHolder))
    );
  }

  // Add this method to calculate the average performance percentage
  calculateAveragePerformancePercentage() {
    if (!this.allEmployees || this.allEmployees.length === 0) {
      this.averagePerformancePercentage = '0';
      return;
    }

    // Filter employees with valid percentages (> 0)
    const validEmployees = this.allEmployees.filter((employee) => {
      const percentage = parseFloat(employee.performancePercentageMonth || '0');
      return percentage > 0;
    });

    // If no valid employees, set average to 0
    if (validEmployees.length === 0) {
      this.averagePerformancePercentage = '0';
      return;
    }

    // Calculate the total percentage for valid employees
    const totalPercentage = validEmployees.reduce((sum, employee) => {
      const percentage = parseFloat(employee.performancePercentageMonth || '0');
      return sum + percentage;
    }, 0);

    // Calculate the average
    const average = totalPercentage / validEmployees.length;
    this.averagePerformancePercentage = this.compute
      .roundNumber(average)
      .toString();
  }

  getBackgroundColor(value: string): string {
    return this.compute.getGradientColorLite(Number(value)).background;
  }
  setGraphics() {
    let num = Number(this.averagePerformancePercentage);
    let gaugeColor = this.compute.getGradientColor(Number(num));
    this.graphMonthPerformance = {
      data: [
        {
          domain: { x: [0, 1], y: [0, 1] },
          value: num,
          title: {
            text: `Performance Moyenne`,
          },
          type: 'indicator',
          mode: 'gauge+number',
          gauge: {
            axis: { range: [0, 100], tickcolor: gaugeColor }, // Color of the ticks (optional)
            bar: { color: gaugeColor }, // Single color for the gauge bar (needle)
          },
        },
      ],
      layout: {
        margin: { t: 20, b: 20, l: 20, r: 20 }, // Adjust margins
        responsive: true, // Make the chart responsive
      },
    };
  }

  computePerformances(employees: any, employee: Employee) {
    this.maxRange = Object.keys(employee.dailyPoints!).length;
    if (employee.role === 'Manager') {
      this.averagePointsMonth =
        this.compute.findTotalForMonthAllDailyPointsEmployees(
          employees,
          this.givenMonth.toString(),
          this.givenYear.toString()
        );

      this.totalPointsMonth =
        this.compute.findTotalForMonthAllTotalDailyPointsEmployees(
          employees,
          this.givenMonth.toString(),
          this.givenYear.toString()
        );
    } else {
      this.averagePointsMonth = this.compute.findTotalForMonth(
        employee.dailyPoints!,
        this.givenMonth.toString(),
        this.givenYear.toString()
      );

      this.totalPointsMonth = this.compute.findTotalForMonth(
        employee.totalDailyPoints!,
        this.givenMonth.toString(),
        this.givenYear.toString()
      );
    }

    this.performancePercentageMonth = this.computePerformancePercentage(
      this.averagePointsMonth,
      this.totalPointsMonth
    );
    employee.performancePercentageMonth = this.performancePercentageMonth;

    return this.performancePercentageMonth;

    // this.computeThisMonthSalary();
  }
  computePerformancePercentage(average: string, total: string) {
    let result = '';
    if (
      (average === '0' || average === undefined || average === '') &&
      (total === '0' || total === undefined || total === '')
    ) {
    } else {
      let rounded = this.compute.roundNumber(
        (Number(average) * 100) / Number(total)
      );
      result = rounded.toString();
    }
    return result;
  }
  getVacationInProgressDates(employee: Employee): string[] {
    return Object.keys(employee.attendance!)
      .filter((date) => employee.attendance![date] === 'VP')
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }
  sortKeysAndValuesPerformance(time: number, employee: Employee) {
    const sortedKeys = Object.keys(employee.dailyPoints!)
      .sort((a, b) => +this.time.toDate(a) - +this.time.toDate(b))
      .slice(-time);

    // to allow for infinity ( when the totalpoint is 0, yet the dailypoint is not zero), add one where the value of total is zero
    for (let key in employee.dailyPoints) {
      if (employee.totalDailyPoints![key] === '0') {
        employee.dailyPoints[key] = (
          Number(employee.dailyPoints[key]) + 1
        ).toString();
        employee.totalDailyPoints![key] = '1';
      }
    }
    const values = sortedKeys.map((key) =>
      (
        (Number(employee.dailyPoints![key]) * 100) /
        Number(employee.totalDailyPoints![key])
      ).toString()
    );
    return [sortedKeys, values];
  }

  // In team-ranking-month.component.ts
  // async addAttendanceForEmployee(
  //   employee: Employee,
  //   attendanceValue: string,
  //   date: string = ''
  // ) {
  //   if (!attendanceValue || attendanceValue === '') {
  //     alert('Remplissez la présence, Réessayez');
  //     return;
  //   }
  //   try {
  //     // Build the attendance record object
  //     let attendanceRecord: any = { [this.time.todaysDate()]: attendanceValue };
  //     if (date !== '') {
  //       attendanceRecord = { [date]: attendanceValue };
  //     }

  //     if (!employee.tempUser || !employee.tempUser.uid) {
  //       alert('Aucun utilisateur associé à cet employé.');
  //       return;
  //     }

  //     await this.data.updateEmployeeAttendanceForUser(
  //       attendanceRecord,
  //       employee.uid!,
  //       employee.tempUser.uid
  //     );
  //     // add a success message here
  //     alert('Présence ajoutée avec succès');

  //     // Optionally show a success message here
  //   } catch (err) {
  //     alert("Une erreur s'est produite lors de l'attendance, Réessayez");
  //     return;
  //   }
  //   // Optionally clear inputs or do other post-submission tasks here
  // }

  onAttachmentSelected(em: any, evt: Event) {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];

    em._attachmentError = '';
    em._attachmentFile = null;
    em._attachmentPreview = null;
    em._attachmentType = null;
    em._attachmentSize = null;

    // NEW: init preview date fields
    em._attachmentTakenAt = null;
    em._attachmentTakenAtSource = '';

    if (!file) return;

    const isOkType =
      file.type.startsWith('image/') || file.type.startsWith('video/');
    const maxBytes = 10 * 1024 * 1024;
    if (!isOkType) {
      em._attachmentError = 'Seuls les fichiers image ou vidéo sont autorisés.';
      return;
    }
    if (file.size > maxBytes) {
      em._attachmentError = 'Fichier trop volumineux (max 10 Mo).';
      return;
    }

    em._attachmentFile = file;
    em._attachmentType = file.type;
    em._attachmentSize = file.size;

    const reader = new FileReader();
    reader.onload = () => (em._attachmentPreview = reader.result as string);
    reader.readAsDataURL(file);

    // 🔵 NEW: figure out the original capture date, for display
    this.readFirstCreated(file).then((info) => {
      em._attachmentTakenAt = info.date;
      em._attachmentTakenAtSource = info.source; // optional if you want to surface the source
    });
  }

  clearAttachment(em: any) {
    em._attachmentError = '';
    em._attachmentFile = null;
    em._attachmentPreview = null;
    em._attachmentType = null;
    em._attachmentSize = null;
  }

  async addAttendanceForEmployee(
    employee: any,
    attendanceValue: string,
    dateLabel: string = ''
  ) {
    if (!attendanceValue) {
      alert('Remplissez la présence, Réessayez');
      return;
    }

    try {
      const label =
        dateLabel && dateLabel.trim() ? dateLabel : this.time.todaysDate();
      const now = new Date();
      const dateISO = now.toISOString().slice(0, 10);

      if (!employee.tempUser?.uid) {
        alert('Aucun utilisateur associé à cet employé.');
        return;
      }

      // 1) legacy map (keeps current UI working)
      await this.data.updateEmployeeAttendanceForUser(
        { [label]: attendanceValue },
        employee.uid!,
        employee.tempUser.uid
      );

      // 2) scalable day doc
      await this.data.setAttendanceEntry(
        employee.tempUser.uid,
        employee.uid!,
        dateISO,
        attendanceValue as any,
        label,
        this.auth.currentUser?.uid || 'unknown'
      );

      // 3) optional attachment
      if (employee._attachmentFile) {
        employee._uploading = true;

        // 🔵 NEW: read original capture date BEFORE upload
        const when = await this.readFirstCreated(employee._attachmentFile);

        const att = await this.data.uploadAttendanceAttachment(
          employee._attachmentFile,
          employee.uid!,
          employee.tempUser.uid,
          dateISO,
          this.auth.currentUser?.uid || 'unknown',
          label
        );

        // 🔵 NEW: persist takenAt (+ source) alongside your existing metadata
        let attMeta: any = { ...att };
        if (when.date) {
          attMeta.takenAt = when.date.getTime();
          attMeta.takenAtSource = when.source; // 'exif' | 'fileLastModified' | 'unknown'
        }

        await this.data.addAttendanceAttachmentDoc(
          employee.tempUser.uid,
          employee.uid!,
          dateISO,
          attMeta
        );

        employee._uploading = false;
        this.clearAttachment(employee);
      }

      alert('Présence ajoutée avec succès');
    } catch (e) {
      console.error(e);
      alert("Une erreur s'est produite lors de l'attendance, Réessayez");
    }
  }

  /** Read original capture/creation date for image/video.
   *  Falls back to file.lastModified when metadata isn't present. */
  private async readFirstCreated(file: File): Promise<{
    date: Date | null;
    source: 'exif' | 'fileLastModified' | 'unknown';
  }> {
    try {
      const tags: any = await exifr.parse(file);
      const candidates: (Date | undefined)[] = [
        tags?.DateTimeOriginal, // photos
        tags?.CreateDate, // photos/videos
        tags?.MediaCreateDate, // videos (QuickTime/MP4)
        tags?.TrackCreateDate, // videos
        tags?.ModifyDate,
      ];
      const valid = candidates.filter(
        (d): d is Date => d instanceof Date && !isNaN(d.getTime())
      );
      if (valid.length) {
        const earliest = valid.reduce((a, b) =>
          a.getTime() <= b.getTime() ? a : b
        );
        return { date: earliest, source: 'exif' };
      }
    } catch {
      /* ignore */
    }

    if (file.lastModified) {
      return { date: new Date(file.lastModified), source: 'fileLastModified' };
    }
    return { date: null, source: 'unknown' };
  }

  // team-ranking-month.component.ts (add these methods inside the class)
  setRankingMode(mode: 'performance' | 'dailyPayments' | 'monthlyPayments') {
    if (this.rankingMode === mode) return;
    this.rankingMode = mode;

    if (mode === 'dailyPayments') {
      this.loadDailyTotalsForEmployees();
    } else if (mode === 'monthlyPayments') {
      this.loadMonthlyTotalsForEmployees();
    } else {
      this.sortEmployeesByPerformance();
    }
  }

  private async loadDailyTotalsForEmployees() {
    if (!this.allEmployees?.length) return; // visible list = actives
    this.loadingDaily = true;

    try {
      // Use the full set (active + inactive) to fetch day totals
      const everyone = (
        this.allEmployeesAll?.length ? this.allEmployeesAll : this.allEmployees
      ) as any[];

      // 1) Fetch day totals for ALL employees (by owner/location)
      const totalsById = new Map<
        string,
        { total: number; count: number; ownerUid: string; status: string }
      >();
      await Promise.all(
        everyone.map(async (e) => {
          if (!e?.uid) return;
          const ownerUid = e?.tempUser?.uid || this.auth.currentUser.uid;
          const { total, count } = await this.data.getEmployeeDayTotalsForDay(
            ownerUid,
            e.uid,
            this.todayDayKey
          );
          totalsById.set(e.uid, {
            total,
            count,
            ownerUid,
            status: e.status || 'Travaille',
          });
        })
      );

      // 2) Seed adjusted map with each ACTIVE employee’s own totals
      const adjusted = new Map<string, { total: number; count: number }>();
      for (const e of this.allEmployees) {
        const base = totalsById.get(e.uid!) || {
          total: 0,
          count: 0,
          ownerUid: e?.tempUser?.uid,
          status: e.status,
        };
        adjusted.set(e.uid!, { total: base.total, count: base.count });
      }

      // 3) For every INACTIVE employee, add their totals to the first ACTIVE coworker at the same location
      for (const donor of everyone) {
        const meta = totalsById.get(donor.uid!);
        if (!meta) continue;

        const isInactive = (donor.status || '') !== 'Travaille';
        if (!isInactive) continue;

        const ownerUid = meta.ownerUid;
        const recipient = this.findRecipientForTotals(ownerUid);
        if (!recipient) continue; // nobody active at this location → skip

        const rec = adjusted.get(recipient.uid!) || { total: 0, count: 0 };
        rec.total += meta.total;
        rec.count += meta.count;
        adjusted.set(recipient.uid!, rec);
      }

      // 4) Write the adjusted totals back to the ACTIVE employees and sort
      this.allEmployees.forEach((e: any) => {
        const a = adjusted.get(e.uid!) || { total: 0, count: 0 };
        e._dailyTotal = a.total;
        e._dailyCount = a.count;
        const usd = this.compute.convertCongoleseFrancToUsDollars(
          String(a.total ?? 0)
        );
        e._dailyTotalUsd = usd === '' ? 0 : usd;
      });

      // Sort by adjusted totals: total desc, then count desc, then name asc
      this.allEmployees.sort((a: any, b: any) => {
        const ta = Number(a._dailyTotal || 0),
          tb = Number(b._dailyTotal || 0);
        const ca = Number(a._dailyCount || 0),
          cb = Number(b._dailyCount || 0);
        if (tb !== ta) return tb - ta;
        if (cb !== ca) return cb - ca;
        const an = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();
        const bn = `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim();
        return an.localeCompare(bn);
      });
      // keep only employees with > 0 for today's payments
      this.paidEmployeesToday = this.allEmployees.filter(
        (e: any) => Number(e._dailyTotal || 0) > 0
      );
    } finally {
      this.loadingDaily = false;
    }
  }

  // Keep your existing performance sorting, but factor it out for reuse
  // private sortEmployeesByPerformance() {
  //   if (!Array.isArray(this.allEmployees)) {
  //     this.performanceEmployees = [];
  //     return;
  //   }

  //   this.allEmployees.sort((a, b) => {
  //     const aVal = parseFloat(a.performancePercentageMonth ?? '0');
  //     const bVal = parseFloat(b.performancePercentageMonth ?? '0');
  //     const aPerf = isNaN(aVal) ? 0 : aVal;
  //     const bPerf = isNaN(bVal) ? 0 : bVal;
  //     return bPerf - aPerf;
  //   });

  //   this.performanceEmployees = this.allEmployees.filter((employee) => {
  //     const value = parseFloat(employee.performancePercentageMonth ?? '0');
  //     return !isNaN(value) && value > 0;
  //   });
  // }
  public sortEmployeesByPerformance() {
    if (!Array.isArray(this.allEmployees)) {
      this.performanceEmployees = [];
      this.excludedEmployees = [];
      return;
    }

    this.allEmployees.sort((a, b) => {
      const aVal = parseFloat(a.performancePercentageMonth ?? '0');
      const bVal = parseFloat(b.performancePercentageMonth ?? '0');
      const aPerf = isNaN(aVal) ? -Infinity : aVal; // NaN goes last
      const bPerf = isNaN(bVal) ? -Infinity : bVal;
      return bPerf - aPerf;
    });

    const valid: any[] = [];
    const excluded: any[] = [];

    for (const employee of this.allEmployees) {
      const v = parseFloat(employee.performancePercentageMonth ?? '0');
      if (!isNaN(v) && v > 0) valid.push(employee);
      else excluded.push(employee);
    }

    this.excludedEmployees = excluded;

    // If admin enabled the toggle, merge excluded back into the displayed list
    if (this.auth?.isAdmin && this.showExcludedForAdmin) {
      this.performanceEmployees = [...valid, ...excluded];
    } else {
      this.performanceEmployees = valid;
    }
  }

  trophyMeta(rank: number) {
    // 1 = Gold (Or), 2 = Bronze, 3 = Silver (Argent)
    if (rank === 1) {
      return {
        emoji: '🥇',
        label: 'OR',
        cardClass: 'bg-gradient-to-br from-amber-50 to-white ring-amber-200',
        ringClass: 'ring-amber-400',
        labelClass: 'text-amber-700',
        avatarClass: 'bg-amber-500',
        badgeClass: 'bg-amber-500',
      };
    }
    if (rank === 2) {
      return {
        emoji: '🥉',
        label: 'BRONZE',
        cardClass: 'bg-gradient-to-br from-orange-50 to-white ring-orange-200',
        ringClass: 'ring-orange-400',
        labelClass: 'text-orange-700',
        avatarClass: 'bg-orange-500',
        badgeClass: 'bg-orange-500',
      };
    }
    return {
      emoji: '🥈',
      label: 'ARGENT',
      cardClass: 'bg-gradient-to-br from-slate-50 to-white ring-slate-200',
      ringClass: 'ring-slate-400',
      labelClass: 'text-slate-700',
      avatarClass: 'bg-slate-500',
      badgeClass: 'bg-slate-500',
    };
  }
  // Returns a safe number (0–100-ish) from any string/number
  toNum(v: any): number {
    const n = parseFloat(v ?? '0');
    return isNaN(n) ? 0 : n;
  }

  // Use your gradient color for borders (single color based on %)
  colorForPerf(p: any): string {
    return this.compute.getGradientColor(Number(p || 0)); // e.g. "#22c55e"
  }

  // Subtle podium highlight for top 3 (different from daily podium)
  perfPodiumClass(rank: number): string {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-br from-amber-50 to-white ring-amber-200';
      case 2:
        return 'bg-gradient-to-br from-slate-50 to-white ring-slate-200';
      case 3:
        return 'bg-gradient-to-br from-orange-50 to-white ring-orange-200';
      default:
        return 'bg-white ring-gray-200';
    }
  }

  // Badge color for the rank number chip
  perfBadgeClass(rank: number): string {
    switch (rank) {
      case 1:
        return 'bg-amber-500';
      case 2:
        return 'bg-slate-500';
      case 3:
        return 'bg-orange-500';
      default:
        return 'bg-gray-400';
    }
  }
  // Replace the old offset method with this:
  progressDasharray(): string {
    // clamp and compute the lengths
    const pct = Math.max(0, Math.min(100, this.avgPerf)) / 100;
    let filled = pct * this.circumference;
    let empty = this.circumference - filled;

    // tiny nudge so round linecap looks nice at 0% / 100%
    if (pct > 0 && pct < 1) {
      filled = Math.max(filled, 0.001);
      empty = Math.max(empty, 0.001);
    }

    return `${filled} ${empty}`;
  }
  private dayKeysForMonth(month: number, year: number): string[] {
    // month is 1–12
    const daysInMonth = new Date(year, month, 0).getDate();
    const keys: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      keys.push(`${month}-${d}-${year}`); // matches your dayKey format "M-D-YYYY"
    }
    return keys;
  }

  private readonly allowedRecipientRoles = [
    'manager',
    'agent marketing',
    'agent',
  ];

  private normalizeRole(role?: string | null): string {
    return (role || '').trim().toLowerCase();
  }

  private findRecipientForTotals(ownerUid: string): Employee | undefined {
    const eligible = this.allEmployees.filter((r: any) => {
      const sameOwner =
        (r?.tempUser?.uid || this.auth.currentUser.uid) === ownerUid;
      const working = (r.status || '') === 'Travaille';
      const roleOk = this.allowedRecipientRoles.includes(
        this.normalizeRole(r.role)
      );
      return sameOwner && working && roleOk;
    });

    const manager = eligible.find(
      (e) => this.normalizeRole(e.role) === 'manager'
    );
    if (manager) return manager;

    const agentMarketing = eligible.find(
      (e) => this.normalizeRole(e.role) === 'agent marketing'
    );
    if (agentMarketing) return agentMarketing;

    return eligible.find((e) => this.normalizeRole(e.role) === 'agent');
  }

  private async loadMonthlyTotalsForEmployees() {
    if (!this.allEmployees?.length) return;
    this.loadingMonthly = true;

    try {
      const everyone = (
        this.allEmployeesAll?.length ? this.allEmployeesAll : this.allEmployees
      ) as any[];
      const monthKeys = this.dayKeysForMonth(this.givenMonth, this.givenYear);

      // 1) collect raw per-employee monthly totals
      const monthTotalsById = new Map<
        string,
        { total: number; count: number; ownerUid: string; status: string }
      >();

      await Promise.all(
        everyone.map(async (e) => {
          if (!e?.uid) return;
          const ownerUid = e?.tempUser?.uid || this.auth.currentUser.uid;

          let sumTotal = 0;
          let sumCount = 0;
          await Promise.all(
            monthKeys.map(async (k) => {
              const { total, count } =
                await this.data.getEmployeeDayTotalsForDay(ownerUid, e.uid, k);
              sumTotal += Number(total || 0);
              sumCount += Number(count || 0);
            })
          );

          monthTotalsById.set(e.uid, {
            total: sumTotal,
            count: sumCount,
            ownerUid,
            status: e.status || 'Travaille',
          });
        })
      );

      // 2) seed active employees with their own totals
      const adjusted = new Map<string, { total: number; count: number }>();
      for (const e of this.allEmployees) {
        const base = monthTotalsById.get(e.uid!) || {
          total: 0,
          count: 0,
          ownerUid: e?.tempUser?.uid,
          status: e.status,
        };
        adjusted.set(e.uid!, { total: base.total, count: base.count });
      }

      // 3) add INACTIVE employees’ totals to the first ACTIVE coworker at same owner/location
      for (const donor of everyone) {
        const meta = monthTotalsById.get(donor.uid!);
        if (!meta) continue;

        const isInactive = (donor.status || '') !== 'Travaille';
        if (!isInactive) continue;

        const recipient = this.findRecipientForTotals(meta.ownerUid);
        if (!recipient) continue;

        const rec = adjusted.get(recipient.uid!) || { total: 0, count: 0 };
        rec.total += meta.total;
        rec.count += meta.count;
        adjusted.set(recipient.uid!, rec);
      }

      // 4) write back to ACTIVE employees and sort
      this.allEmployees.forEach((e: any) => {
        const a = adjusted.get(e.uid!) || { total: 0, count: 0 };
        e._monthTotal = a.total;
        e._monthCount = a.count;
        const usd = this.compute.convertCongoleseFrancToUsDollars(
          String(a.total ?? 0)
        );
        e._monthTotalUsd = usd === '' ? 0 : usd;
      });

      this.allEmployees.sort((a: any, b: any) => {
        const ta = Number(a._monthTotal || 0),
          tb = Number(b._monthTotal || 0);
        if (tb !== ta) return tb - ta;
        const ca = Number(a._monthCount || 0),
          cb = Number(b._monthCount || 0);
        if (cb !== ca) return cb - ca;
        const an = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();
        const bn = `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim();
        return an.localeCompare(bn);
      });

      // 5) show only those who actually have > 0 this month
      this.paidEmployeesMonth = this.allEmployees.filter(
        (e: any) => Number(e._monthTotal || 0) > 0
      );
    } finally {
      this.loadingMonthly = false;
    }
  }
}
