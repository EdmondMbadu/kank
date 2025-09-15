import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { Client } from 'src/app/models/client';
import { AttendanceAttachment, Employee } from 'src/app/models/employee';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';
import { DataService } from 'src/app/services/data.service';
import exifr from 'exifr';

@Component({
  selector: 'app-team-ranking-month',
  templateUrl: './team-ranking-month.component.html',
  styleUrls: ['./team-ranking-month.component.css'],
})
export class TeamRankingMonthComponent {
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
  showPresent: boolean = false;
  yearsList: number[] = this.time.yearsList;

  // team-ranking-month.component.ts (add near top-level props)
  rankingMode: 'performance' | 'dailyPayments' = 'performance';
  loadingDaily = false;
  todayDayKey: string = this.time.todaysDateMonthDayYear(); // e.g. "9-15-2025"

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
  }

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
    this.total = '0';
    this.totalHouse = '0';
    this.totalBonus = '0';
    this.allUsers.forEach((user) => {
      if (user.housePayment)
        this.totalHouse = (
          Number(user.housePayment) + Number(this.totalHouse)
        ).toString();
    });

    this.allUsers.forEach((user) => {
      this.currentClients = [];

      this.currentEmployees = [];

      this.auth.getAllEmployeesGivenUser(user).subscribe((employees) => {
        tempEmployees = tempEmployees.concat(employees);
        this.currentEmployees = employees;

        this.currentEmployees.forEach((em: any) => {
          this.computePerformances(employees, em);
          if (em.paymentAmount) {
            this.total = (
              Number(em.paymentAmount) + Number(this.total)
            ).toString();
          }
          if (em.totalBonusThisMonth) {
            this.totalBonus = (
              Number(em.totalBonusThisMonth) + Number(this.totalBonus)
            ).toString();
          }

          // Assign location
          em.tempUser = user; // attach the user info to the employee
          em.tempLocationHolder = user.firstName;
          // Initialize the toggle property
          em.showAttendance = false;
        });

        // this.currentEmployees = employees;
        completedRequests++;
        if (completedRequests === this.allUsers.length) {
          this.filterAndInitializeEmployees(tempEmployees, this.currentClients);
          this.isFetchingClients = false;
          // after this.filterAndInitializeEmployees(...);
          if (this.rankingMode === 'dailyPayments') {
            this.loadDailyTotalsForEmployees();
          } else {
            this.sortEmployeesByPerformance();
          }
        }
        this.setGraphics();
      });
    });
    this.total = (Number(this.total) + Number(this.totalHouse)).toString();
  }
  // filterAndInitializeEmployees(
  //   allEmployees: Employee[],
  //   currentClients: Client[]
  // ) {
  //   // Use a Map or Set to ensure uniqueness. Here, a Map is used to easily access clients by their ID.
  //   let uniqueEmployees = new Map<string, Client>();
  //   this.allEmployees = [];
  //   allEmployees.forEach((employee) => {
  //     employee.currentClients =
  //       this.compute.filterClientsWithoutDebtFollowedByEmployee(
  //         currentClients,
  //         employee
  //       );
  //     // Assuming client.id is the unique identifier
  //     if (!uniqueEmployees.has(employee.uid!)) {
  //       uniqueEmployees.set(employee.uid!, employee);
  //     }
  //   });

  //   // Convert the Map values back to an array for further processing
  //   this.allEmployees = Array.from(uniqueEmployees.values());
  //   this.allEmployees.sort((a, b) => {
  //     const aPerformance = a.performancePercentageMonth
  //       ? parseFloat(a.performancePercentageMonth)
  //       : 0;
  //     const bPerformance = b.performancePercentageMonth
  //       ? parseFloat(b.performancePercentageMonth)
  //       : 0;
  //     return bPerformance - aPerformance;
  //   });
  //   this.allEmployees = this.allEmployees.filter((data) => {
  //     return data.status === 'Travaille';
  //   });
  //   this.calculateAveragePerformancePercentage();
  // }
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
    console.log('all employees', allEmployees);

    // Sort by performancePercentageMonth descending,
    // converting any NaN to 0 so that NaNs don't cause sorting problems
    this.allEmployees.sort((a, b) => {
      const aVal = parseFloat(a.performancePercentageMonth ?? '0');
      const bVal = parseFloat(b.performancePercentageMonth ?? '0');

      const aPerformance = isNaN(aVal) ? 0 : aVal;
      const bPerformance = isNaN(bVal) ? 0 : bVal;

      // Descending order
      return bPerformance - aPerformance;
    });

    // Filter employees who are currently "Travaille" (working)
    this.allEmployees = this.allEmployees.filter((data) => {
      return data.status === 'Travaille';
    });

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
  setRankingMode(mode: 'performance' | 'dailyPayments') {
    if (this.rankingMode === mode) return;
    this.rankingMode = mode;

    if (mode === 'dailyPayments') {
      this.loadDailyTotalsForEmployees();
    } else {
      // restore performance ordering
      this.sortEmployeesByPerformance();
    }
  }

  private async loadDailyTotalsForEmployees() {
    if (!this.allEmployees?.length) return;
    this.loadingDaily = true;

    try {
      const promises = this.allEmployees.map(async (em: any) => {
        if (!em?.uid) return;
        const ownerUid = em?.tempUser?.uid || this.auth.currentUser.uid; // <<< use the employee’s owner
        const { total, count } = await this.data.getEmployeeDayTotalsForDay(
          ownerUid,
          em.uid,
          this.todayDayKey
        );
        em._dailyTotal = total;
        em._dailyCount = count;
      });
      await Promise.all(promises);

      // sort after values loaded
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
    } finally {
      this.loadingDaily = false;
    }
  }

  // Keep your existing performance sorting, but factor it out for reuse
  private sortEmployeesByPerformance() {
    this.allEmployees.sort((a, b) => {
      const aVal = parseFloat(a.performancePercentageMonth ?? '0');
      const bVal = parseFloat(b.performancePercentageMonth ?? '0');
      const aPerf = isNaN(aVal) ? 0 : aVal;
      const bPerf = isNaN(bVal) ? 0 : bVal;
      return bPerf - aPerf;
    });
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
}
