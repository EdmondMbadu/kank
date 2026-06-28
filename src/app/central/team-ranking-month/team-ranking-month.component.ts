import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

import { Client } from 'src/app/models/client';
import {
  AttendanceAttachment,
  Employee,
  Trophy,
  WeeklyObjectiveDeduction,
} from 'src/app/models/employee';
import { User } from 'src/app/models/user';
import { IdeaSubmission } from 'src/app/models/idea';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';
import { DataService } from 'src/app/services/data.service';
import exifr from 'exifr';
import { firstValueFrom, Subscription } from 'rxjs';
import { AngularFirestore } from '@angular/fire/compat/firestore';

type AttendanceQuickCode = 'P' | 'A' | 'L' | '';
type AttendanceStateCode = '' | 'P' | 'A' | 'L' | 'V' | 'VP' | 'N' | 'F';
type MonthlySignatureEntry = {
  rawKey: string;
  date: Date;
  kind: 'paiement' | 'bonus';
  receiptIndex: number;
  receiptUrl: string | null;
};
type AttendanceMonthSummaryItem = {
  code: AttendanceStateCode | 'missing';
  label: string;
  count: number;
  classes: string;
};
type AttendanceMonthSummary = {
  monthLabel: string;
  scopeLabel: string;
  daysConsidered: number;
  recordedDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  items: AttendanceMonthSummaryItem[];
};
type PresenceCalendarCell = {
  day: number | null;
  label: string;
  dateISO: string;
  key?: string;
  status: AttendanceStateCode;
  statusLabel: string;
  timeLabel: string;
  classes: string;
  isException?: boolean;
  exceptionReason?: string;
  attachment?: any;
};
type PresenceMissedDay = {
  label: string;
  display: string;
  status: AttendanceStateCode;
  statusLabel: string;
};
type PresenceEmployeeMissSummary = {
  employee: Employee;
  name: string;
  missedDays: number;
  absentDays: number;
  unmarkedDays: number;
  anomalyDays: number;
  days: PresenceMissedDay[];
};
type PresenceStateOption = {
  code: AttendanceStateCode;
  label: string;
  hint?: string;
};
type PresenceExceptionDay = {
  dateISO: string;
  dateLabel: string;
  reason: string;
  createdAt?: any;
  createdBy?: string;
};
type EmployeePresenceWindow = {
  joinedISO: string;
  leftISO: string;
};
type TrophyModalType = 'team' | 'employee' | 'all';
type TrophyModalEntry = {
  trophy: Trophy;
  type: Exclude<TrophyModalType, 'all'>;
};
type TrophyHeatmapTile = {
  employee: Employee;
  name: string;
  initials: string;
  photoUrl: string;
  total: number;
  teamCount: number;
  employeeCount: number;
  latestLabel: string;
  latestTypeLabel: string;
  colorClass: string;
  layoutStyle: Record<string, string>;
};
type TrophyHeatmapStats = {
  totalTrophies: number;
  employeesWithTrophies: number;
  topCount: number;
};
type TrophyHistoryScope = 'employees' | 'clients' | 'teams';
type ClientTrophyRow = {
  client: Client;
  name: string;
  initials: string;
  photoUrl: string;
  locationName: string;
  phoneNumber: string;
  stars: number;
  trophyCount: number;
  latestAwardLabel: string;
  latestAwardAmount: string;
  creditScore: string;
  debtLeft: number;
  loanAmount: number;
  colorClass: string;
  layoutStyle: Record<string, string>;
};
type ClientTrophyStats = {
  totalStars: number;
  clientsWithStars: number;
  topStars: number;
};
type ClientTrophyTeamRow = {
  teamName: string;
  clients: ClientTrophyRow[];
  clientsWithStars: number;
  totalStars: number;
  topStars: number;
  topClientName: string;
  averageStars: number;
  colorClass: string;
  layoutStyle: Record<string, string>;
};
type ClientTrophyTeamStats = {
  totalStars: number;
  totalClients: number;
  teamsWithStars: number;
  topTeamStars: number;
};
type PayrollDeductionDetail = {
  kind: 'absent' | 'nothing' | 'late' | 'objective' | 'manualWithdrawal';
  label: string;
  amount: number;
  start?: string;
  end?: string;
};
type PayrollBreakdownRow = {
  employee: Employee;
  name: string;
  role: string;
  base: number;
  bankFee: number;
  experience: number;
  manualAddition: number;
  additionsTotal: number;
  absent: number;
  nothing: number;
  late: number;
  objective: number;
  manualWithdrawal: number;
  deductionsTotal: number;
  net: number;
  reasons: string[];
  configured: boolean;
  attendanceOnly: boolean;
  objectiveDeductions: WeeklyObjectiveDeduction[];
  deductionDetails: PayrollDeductionDetail[];
};
type PayrollEditDraft = {
  base: number;
  experience: number;
  bankFee: number;
  manualAddition: number;
  manualAdditionReason: string;
  absent: number;
  nothing: number;
  late: number;
  objective: number;
  manualWithdrawal: number;
  manualWithdrawalReason: string;
  paymentSignNote: string;
  objectiveDeductions: WeeklyObjectiveDeduction[];
  deductionDetails: PayrollDeductionDetail[];
  weekObjectiveStartDate: string;
  weekObjectiveEndDate: string;
  weekObjectiveEndLabel: string;
  weekObjectiveAmount: number;
  bonusAmount: number;
  bonusPercentage: number;
  bestTeamBonusAmount: number;
  bestEmployeeBonusAmount: number;
  bestManagerBonusAmount: number;
  bonusSignNote: string;
};
type TrophyHeatmapRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

@Component({
  selector: 'app-team-ranking-month',
  templateUrl: './team-ranking-month.component.html',
  styleUrls: ['./team-ranking-month.component.css'],
})
export class TeamRankingMonthComponent implements OnDestroy {
  private readonly DEFAULT_VACATION_DAYS = 7;
  averagePerformancePercentage: string = '0'; // Add this line
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth() + 1;
  givenMonth: number = this.currentMonth;
  presenceMonth: number = this.currentMonth;
  month = this.compute.getMonthNameFrench(this.currentMonth);
  year = this.currentDate.getFullYear();
  givenYear = this.year;
  presenceYear = this.year;
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
  paidEmployeesWeek: any[] = [];
  public excludedEmployees: any[] = []; // holds NaN or ≤ 0 employees
  public showExcludedForAdmin = false; // admin toggle to include them

  // team-ranking-month.component.ts (add near top-level props)
  rankingMode:
    | 'performance'
    | 'dailyPayments'
    | 'weeklyPayments'
    | 'monthlyPayments'
    | 'trophyHistory' = 'dailyPayments';
  trophyHistoryScope: TrophyHistoryScope = 'employees';
  loadingDaily = false;
  loadingWeekly = false;
  todayKin: string = this.time.todaysDateKinshasFormat()

  // ===== Trophy Modal state =====
  trophyModalVisible = false;
  trophyModalType: TrophyModalType | null = null;
  trophyModalEmployee: Employee | null = null;
  employeeModalVisible = false;
  employeeModalEmployee: Employee | null = null;
  todayDayKey: string = this.time.todaysDateMonthDayYear(); // e.g. "9-15-2025"
  
  // Date picker for daily payments (visible to everyone)
  selectedPaymentDate: string = this.time.getTodaysDateYearMonthDay(); // yyyy-MM-dd format for input
  selectedWeekStartDate: string = this.time.getTodaysDateYearMonthDay();
  weekPickerStartLabel: string = '';
  weekPickerEndLabel: string = '';
  weekPickerRangeLabel: string = '';
  weeklyTargetFc: number = 300000;
  attendanceQuickOptions: Array<{
    code: AttendanceQuickCode;
    label: string;
    classes: string;
  }> = [
    {
      code: 'P',
      label: 'Présent',
      classes:
        'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    },
    {
      code: 'A',
      label: 'Absent',
      classes: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100',
    },
    {
      code: 'L',
      label: 'Retard',
      classes:
        'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    },
    {
      code: '',
      label: 'Non marqué',
      classes:
        'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
    },
  ];

  allEmployeesAll: Employee[] = []; // includes inactive, used for partner merge
  presenceCalendarOpen = false;
  selectedPresenceEmployeeId = '';
  presenceEmployeeSearch = '';
  presenceEmployeeSearchOpen = false;
  presenceSummaryIncludeSaturday = false;
  presenceSummaryIncludeAbsent = false;
  presenceSummaryIncludeAnomaly = false;
  presenceAttachmentsByLabel: Record<string, any[]> = {};
  presenceAttachmentsLoading = false;
  private presenceAttachmentsCacheKey = '';
  presenceExceptionDays: Record<string, PresenceExceptionDay> = {};
  presenceExceptionsLoading = false;
  presenceExceptionSaving = false;
  presenceExceptionDate = this.time.getTodaysDateYearMonthDay();
  presenceExceptionReason = '';
  presenceExceptionMessage = '';
  private presenceExceptionsCacheKey = '';
  presenceBulkIncludeSaturday = false;
  presenceBulkStatus: AttendanceStateCode = 'A';
  presenceBulkDeductVacation = true;
  presenceBulkModalOpen = false;
  presenceBulkSaving = false;
  presenceBulkMessage = '';
  private presenceCacheVersion = 0;
  private presenceMissSummaryCacheKey = '';
  private presenceMissSummaryCache: PresenceEmployeeMissSummary[] = [];
  private presenceMonthSummaryCacheKey = '';
  private presenceMonthSummaryCache: AttendanceMonthSummary | null = null;
  private presenceCalendarWeeksCacheKey = '';
  private presenceCalendarWeeksCache: PresenceCalendarCell[][] = [];
  private presenceBulkUnassignedCacheKey = '';
  private presenceBulkUnassignedCache: PresenceMissedDay[] = [];
  private presenceEmploymentDateCache = new Map<string, EmployeePresenceWindow>();
  private trophyHeatmapCacheKey = '';
  private trophyHeatmapCache: TrophyHeatmapTile[] = [];
  clientTrophyLoading = false;
  clientTrophyError = '';
  private clientTrophyRowsCacheKey = '';
  private clientTrophyRowsCache: ClientTrophyRow[] = [];
  private clientTrophyTeamRowsCache: ClientTrophyTeamRow[] = [];
  private clientTrophyLoadKey = '';
  private clientTrophyLoaded = false;
  selectedClientTrophyRow: ClientTrophyRow | null = null;
  selectedClientTrophyTeamRow: ClientTrophyTeamRow | null = null;
  presenceStateOptions: PresenceStateOption[] = [
    { code: '', label: 'Aucun', hint: 'Effacer la valeur' },
    { code: 'P', label: 'Présent' },
    { code: 'A', label: 'Absent' },
    { code: 'L', label: 'Retard' },
    { code: 'V', label: 'Vacances' },
    { code: 'VP', label: 'Vacances en cours' },
    { code: 'N', label: 'Néant' },
    { code: 'F', label: 'Anomalie' },
  ];
  presenceDayEditor = {
    open: false,
    employeeId: '',
    employeeName: '',
    dateLabel: '',
    dateISO: '',
    status: '' as AttendanceStateCode,
    selectedStatus: '' as AttendanceStateCode,
    saving: false,
    error: '',
  };
  presenceAttachmentViewer = {
    open: false,
    url: '',
    kind: '' as 'image' | 'video' | '',
    dateLabel: '',
    takenAt: null as Date | null,
    takenAtSource: '' as string,
  };
  loadingMonthly = false;
  paidEmployeesMonth: any[] = [];
  payrollRows: PayrollBreakdownRow[] = [];
  payrollControlRowKey = '';
  payrollVisibilitySavingKey = '';
  payrollEditRowKey = '';
  payrollEditDraft: PayrollEditDraft | null = null;
  payrollEditSaving = false;
  showMonthlyAmounts = false;
  showDailyAmounts = false;
  showWeeklyAmounts = false;
  isCopyingMonthlyRanking = false;
  copyMonthlyRankingMessage: string | null = null;
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

  // Employee Management section state
  showEmployeeManagementSection = false;

  // Global Compte Fondation attendance rule state
  globalFoundationRuleRequiredDays: number | null = 20;
  globalFoundationRuleStartMonth: number | null = null;
  globalFoundationRuleStartYear: number | null = null;
  globalFoundationRuleSaving = false;
  globalFoundationRuleMessage = '';
  private globalFoundationRuleInitialized = false;

  // Team monthly budget state
  budgetSectionOpen = false;
  budgetViewMode: 'selected' | 'all' = 'all';
  selectedBudgetTeamId = '';
  selectedBudgetInput = '';
  selectedBudgetSaving = false;
  selectedBudgetMessage = '';
  budgetFormulaOverrideHigherBudgets = false;
  budgetFormulaSaving = false;
  budgetFormulaMessage = '';
  
  // Employee transfer feature state
  showEmployeeCopySection = false;
  allEmployeesForCopy: Array<{
    employee: Employee;
    sourceUserId: string;
    sourceUserLabel: string;
  }> = [];
  selectedSourceEmployee: {
    employee: Employee;
    sourceUserId: string;
    sourceUserLabel: string;
  } | null = null;
  selectedTargetLocationUserId: string | null = null;
  transferType: 'rotation' | 'affectation' | null = null;
  employeeCopyInProgress = false;
  employeeCopySuccess = false;
  employeeCopyError = '';
  private employeeCopySubs: Subscription[] = [];

  // Employee merge feature state
  showEmployeeMergeSection = false;
  allEmployeesForMerge: Array<{
    employee: Employee;
    sourceUserId: string;
    sourceUserLabel: string;
  }> = [];
  selectedEmployeeA: {
    employee: Employee;
    sourceUserId: string;
    sourceUserLabel: string;
  } | null = null;
  selectedEmployeeB: {
    employee: Employee;
    sourceUserId: string;
    sourceUserLabel: string;
  } | null = null;
  employeeMergeInProgress = false;
  employeeMergeSuccess = false;
  employeeMergeError = '';
  private employeeMergeSubs: Subscription[] = [];

  // single toggle function
  toggle(section: 'payroll' | 'bonus' | 'loyer') {
    this.collapse[section] = !this.collapse[section];
  }
  /** Small helper so all logs share same prefix */
  private logDebug(message: string, extra?: any): void {
    if (extra !== undefined) {
      console.log('[TeamRankingMonth]', message, extra);
    } else {
      console.log('[TeamRankingMonth]', message);
    }
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
  toggleWeeklyAmounts(): void {
    this.showWeeklyAmounts = !this.showWeeklyAmounts;
  }

  weeklyProgressPercent(total: number): number {
    if (this.weeklyTargetFc === 0) return 0;
    return Math.min(100, (total / this.weeklyTargetFc) * 100);
  }

  onDailyPaymentDateChange(): void {
    // Convert yyyy-MM-dd to MM-DD-YYYY format
    this.todayDayKey = this.time.convertDateToMonthDayYear(this.selectedPaymentDate);
    // Update display format
    this.todayKin = this.time.convertDateToDayMonthYear(this.todayDayKey);
    // Reload daily totals for the selected date
    if (this.rankingMode === 'dailyPayments') {
      this.loadDailyTotalsForEmployees();
    }
  }

  normalizeAttendanceCode(raw: unknown): AttendanceStateCode {
    const value = (raw ?? '').toString().trim().toUpperCase();
    if (!value) return '';
    if (value === 'P' || value === 'PRESENT' || value === 'PRÉSENT') return 'P';
    if (value === 'A' || value === 'ABSENT') return 'A';
    if (value === 'L' || value === 'LATE' || value === 'RETARD') return 'L';
    if (value === 'N' || value === 'NEANT' || value === 'NÉANT') return 'N';
    if (value === 'F' || value === 'ANOMALIE') return 'F';
    if (value === 'VP') return 'VP';
    if (value === 'V' || value === 'VACANCES' || value === 'VACANCE') return 'V';
    return '';
  }

  attendanceCodeForDate(employee: Employee): AttendanceStateCode {
    const dayKey = this.todayDayKey || this.time.todaysDateMonthDayYear();
    const fullEmployee =
      this.allEmployeesAll?.find((e) => e?.uid && e.uid === employee?.uid) ||
      employee;
    const attendanceMap = fullEmployee?.attendance || {};

    if (attendanceMap[dayKey] !== undefined) {
      return this.normalizeAttendanceCode(attendanceMap[dayKey]);
    }

    const keysForDay = Object.keys(attendanceMap).filter(
      (key) => this.normalizeAttendanceDayKey(key) === dayKey
    );
    if (!keysForDay.length) return '';

    const latestKey = keysForDay.reduce((prev, current) =>
      this.attendanceKeyTimeValue(current) > this.attendanceKeyTimeValue(prev)
        ? current
        : prev
    );
    return this.normalizeAttendanceCode(attendanceMap[latestKey]);
  }

  private normalizeAttendanceDayKey(rawKey: string): string {
    const parts = (rawKey || '').split('-');
    if (parts.length < 3) return '';
    const month = Number(parts[0]);
    const day = Number(parts[1]);
    const year = Number(parts[2]);
    if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
      return '';
    }
    return `${month}-${day}-${year}`;
  }

  private attendanceKeyTimeValue(rawKey: string): number {
    const parts = (rawKey || '').split('-');
    const h = Number(parts[3] || 0);
    const m = Number(parts[4] || 0);
    const s = Number(parts[5] || 0);
    const hh = Number.isFinite(h) ? h : 0;
    const mm = Number.isFinite(m) ? m : 0;
    const ss = Number.isFinite(s) ? s : 0;
    return hh * 3600 + mm * 60 + ss;
  }

  attendanceLabelForCode(code: string): string {
    switch (code) {
      case 'P':
        return 'Présent';
      case 'A':
        return 'Absent';
      case 'L':
        return 'Retard';
      case 'V':
        return 'Vacances';
      case 'VP':
        return 'Vacances en cours';
      case 'F':
        return 'Anomalie';
      case 'N':
      case '':
      default:
        return 'Non marqué';
    }
  }

  attendanceBadgeClass(code: string): string {
    switch (code) {
      case 'P':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'A':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'L':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'V':
      case 'VP':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'N':
      case '':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  isAttendanceSelected(employee: Employee, code: AttendanceQuickCode): boolean {
    const current = this.attendanceCodeForDate(employee);
    if (code === '') {
      return current === '' || current === 'N';
    }
    return current === code;
  }

  get selectedPresenceEmployee(): Employee | null {
    if (!this.selectedPresenceEmployeeId) return this.allEmployees?.[0] || null;
    return (
      this.allEmployees?.find((employee) => employee.uid === this.selectedPresenceEmployeeId) ||
      null
    );
  }

  get selectedPresenceEmployeeName(): string {
    return this.formatRankingEmployeeName(this.selectedPresenceEmployee);
  }

  get selectedPresenceVacationTotalDays(): number {
    return this.vacationDaysValue(
      this.selectedPresenceEmployee?.vacationTotalDays,
      this.DEFAULT_VACATION_DAYS
    );
  }

  get selectedPresenceVacationAcceptedDays(): number {
    return this.vacationDaysValue(
      this.selectedPresenceEmployee?.vacationAcceptedNumberOfDays
    );
  }

  get selectedPresenceVacationRequestedDays(): number {
    return this.vacationDaysValue(
      this.selectedPresenceEmployee?.vacationRequestNumberOfDays
    );
  }

  get selectedPresenceVacationRemainingDays(): number {
    return Math.max(
      0,
      this.selectedPresenceVacationTotalDays -
        this.selectedPresenceVacationAcceptedDays
    );
  }

  get filteredPresenceEmployees(): Employee[] {
    const query = this.presenceEmployeeSearch.trim().toLowerCase();
    const employees = this.allEmployees || [];
    if (!query) return employees.slice(0, 8);
    return employees
      .filter((employee) =>
        this.formatRankingEmployeeName(employee).toLowerCase().includes(query)
      )
      .slice(0, 10);
  }

  private vacationDaysValue(value?: string | number | null, fallback = 0): number {
    if (value === undefined || value === null || value === '') return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  get presenceMonthLabel(): string {
    return (
      this.time.monthFrenchNames?.[Number(this.presenceMonth) - 1] ||
      `Mois ${this.presenceMonth}`
    );
  }

  get presenceMonthSummary(): AttendanceMonthSummary | null {
    const employee = this.selectedPresenceEmployee;
    if (!employee) return null;
    const key = this.presenceSelectedCacheKey('monthSummary');
    if (this.presenceMonthSummaryCacheKey !== key) {
      this.presenceMonthSummaryCache = this.buildPresenceMonthSummary(
        employee,
        this.presenceMonth,
        this.presenceYear
      );
      this.presenceMonthSummaryCacheKey = key;
    }
    return this.presenceMonthSummaryCache;
  }

  get presenceCalendarWeeks(): PresenceCalendarCell[][] {
    const employee = this.selectedPresenceEmployee;
    if (!employee) return [];
    const key = this.presenceSelectedCacheKey('calendar');
    if (this.presenceCalendarWeeksCacheKey !== key) {
      this.presenceCalendarWeeksCache = this.buildPresenceCalendarWeeks(
        employee,
        this.presenceMonth,
        this.presenceYear
      );
      this.presenceCalendarWeeksCacheKey = key;
    }
    return this.presenceCalendarWeeksCache;
  }

  get presenceMissSummaryScopeLabel(): string {
    const today = this.presenceCutoffParts(new Date());
    const monthDelta =
      this.presenceYear * 12 +
      this.presenceMonth -
      (today.y * 12 + today.m);
    if (monthDelta === 0) {
      return `Jusqu'au ${today.d} ${this.presenceMonthLabel}`;
    }
    if (monthDelta < 0) return 'Mois complet';
    return 'Aucun jour à résumer pour le moment';
  }

  get presenceMissSummaryEmployees(): PresenceEmployeeMissSummary[] {
    const key = this.presenceCollectionCacheKey('missSummary');
    if (this.presenceMissSummaryCacheKey !== key) {
      const employees = this.allEmployees || [];
      const summaries = employees
        .map((employee) => this.buildPresenceMissSummaryForEmployee(employee))
        .filter((summary) => summary.missedDays > 0);
      summaries.sort((a, b) => b.missedDays - a.missedDays || a.name.localeCompare(b.name));
      this.presenceMissSummaryCache = summaries;
      this.presenceMissSummaryCacheKey = key;
    }
    return this.presenceMissSummaryCache;
  }

  get presenceMissSummaryTotal(): number {
    return this.presenceMissSummaryEmployees.reduce(
      (total, item) => total + item.missedDays,
      0
    );
  }

  get presenceBulkStatusOptions(): PresenceStateOption[] {
    return this.presenceStateOptions.filter((option) => !!option.code);
  }

  get presenceBulkVacationDeductionApplies(): boolean {
    return this.presenceBulkStatus === 'V' && this.presenceBulkDeductVacation;
  }

  get presenceBulkVacationDeductionDays(): number {
    if (!this.presenceBulkVacationDeductionApplies) return 0;
    return Math.min(
      this.presenceBulkUnassignedDays.length,
      this.selectedPresenceVacationRemainingDays
    );
  }

  get presenceBulkVacationRemainingAfterFill(): number {
    if (!this.presenceBulkVacationDeductionApplies) {
      return this.selectedPresenceVacationRemainingDays;
    }
    return Math.max(
      0,
      this.selectedPresenceVacationRemainingDays -
        this.presenceBulkUnassignedDays.length
    );
  }

  get presenceBulkUnassignedDays(): PresenceMissedDay[] {
    const employee = this.selectedPresenceEmployee;
    if (!employee) return [];
    const key = this.presenceSelectedCacheKey(
      `bulk:${this.presenceBulkIncludeSaturday}`
    );
    if (this.presenceBulkUnassignedCacheKey !== key) {
      this.presenceBulkUnassignedCache = this.presenceEligibleDayLabels(
        this.presenceMonth,
        this.presenceYear,
        this.presenceBulkIncludeSaturday
      )
        .filter((label) => this.isPresenceDayInsideEmployment(employee, label))
        .filter(
          (label) => !this.getLatestAttendanceForEmployeeDay(employee, label).status
        )
        .map((label) => ({
          label,
          display: this.presenceDayDisplay(label),
          status: '',
          statusLabel: 'Sans statut',
        }));
      this.presenceBulkUnassignedCacheKey = key;
    }
    return this.presenceBulkUnassignedCache;
  }

  get presenceExceptionList(): PresenceExceptionDay[] {
    return Object.values(this.presenceExceptionDays).sort((a, b) =>
      a.dateISO.localeCompare(b.dateISO)
    );
  }

  get trophyHeatmapTiles(): TrophyHeatmapTile[] {
    const employees = this.trophyHeatmapSourceEmployees();
    const key = employees
      .map((employee) =>
        [
          employee.uid || '',
          employee.status || '',
          this.trophyListSignature(employee.bestTeamTrophies),
          this.trophyListSignature(employee.bestEmployeeTrophies),
        ].join(':')
      )
      .join('|');

    if (this.trophyHeatmapCacheKey !== key) {
      this.trophyHeatmapCache = this.buildTrophyHeatmapTiles(employees);
      this.trophyHeatmapCacheKey = key;
    }

    return this.trophyHeatmapCache;
  }

  get trophyHeatmapStats(): TrophyHeatmapStats {
    const tiles = this.trophyHeatmapTiles;
    return {
      totalTrophies: tiles.reduce((total, tile) => total + tile.total, 0),
      employeesWithTrophies: tiles.length,
      topCount: tiles[0]?.total || 0,
    };
  }

  get clientTrophyRows(): ClientTrophyRow[] {
    return this.clientTrophyRowsCache;
  }

  get clientTrophyStats(): ClientTrophyStats {
    const rows = this.clientTrophyRows;
    return {
      totalStars: rows.reduce((total, row) => total + row.stars, 0),
      clientsWithStars: rows.length,
      topStars: rows[0]?.stars || 0,
    };
  }

  get clientTrophyTeamRows(): ClientTrophyTeamRow[] {
    return this.clientTrophyTeamRowsCache;
  }

  get clientTrophyTeamStats(): ClientTrophyTeamStats {
    const rows = this.clientTrophyTeamRows;
    return {
      totalStars: rows.reduce((total, row) => total + row.totalStars, 0),
      totalClients: rows.reduce((total, row) => total + row.clientsWithStars, 0),
      teamsWithStars: rows.length,
      topTeamStars: rows[0]?.totalStars || 0,
    };
  }

  private buildClientTrophyTeamRows(
    clientRows: ClientTrophyRow[]
  ): ClientTrophyTeamRow[] {
    const teams = new Map<string, ClientTrophyRow[]>();
    clientRows.forEach((row) => {
      const teamName = row.locationName || 'Site non défini';
      teams.set(teamName, [...(teams.get(teamName) || []), row]);
    });

    const sortedRows = Array.from(teams.entries())
      .map(([teamName, rows]) => {
        const sortedClients = [...rows].sort(
          (a, b) =>
            b.stars - a.stars ||
            (b.creditScore || '').localeCompare(a.creditScore || '') ||
            a.name.localeCompare(b.name)
        );
        const totalStars = rows.reduce((total, row) => total + row.stars, 0);
        const topRow = sortedClients[0];
        return {
          teamName,
          clients: sortedClients,
          clientsWithStars: rows.length,
          totalStars,
          topStars: topRow?.stars || 0,
          topClientName: topRow?.name || '—',
          averageStars: rows.length ? totalStars / rows.length : 0,
          colorClass: '',
        };
      })
      .sort(
        (a, b) =>
          b.totalStars - a.totalStars ||
          b.clientsWithStars - a.clientsWithStars ||
          a.teamName.localeCompare(b.teamName)
      );

    const rects = this.buildTrophyTreemapRects(
      sortedRows.map((row) => Math.max(row.clientsWithStars, 1))
    );

    return sortedRows.map((row, index) => ({
      ...row,
      colorClass: this.clientTrophyTeamColorClass(index),
      layoutStyle: this.trophyRectStyle(rects[index]),
    }));
  }

  get presenceMonthStartISO(): string {
    return this.monthIsoRange(this.presenceMonth, this.presenceYear).startISO;
  }

  get presenceMonthEndISO(): string {
    return this.monthIsoRange(this.presenceMonth, this.presenceYear).endISO;
  }

  private invalidatePresenceCache(): void {
    this.presenceCacheVersion += 1;
  }

  private presenceExceptionCacheSignature(): string {
    return Object.keys(this.presenceExceptionDays).sort().join(',');
  }

  private presenceSelectedCacheKey(scope: string): string {
    return [
      scope,
      this.presenceCacheVersion,
      this.selectedPresenceEmployeeId,
      this.presenceMonth,
      this.presenceYear,
      this.presenceExceptionCacheSignature(),
    ].join('|');
  }

  private presenceCollectionCacheKey(scope: string): string {
    return [
      scope,
      this.presenceCacheVersion,
      this.allEmployees?.length || 0,
      this.presenceMonth,
      this.presenceYear,
      this.presenceSummaryIncludeSaturday,
      this.presenceSummaryIncludeAbsent,
      this.presenceSummaryIncludeAnomaly,
      this.presenceExceptionCacheSignature(),
    ].join('|');
  }

  togglePresenceCalendar(): void {
    this.presenceCalendarOpen = !this.presenceCalendarOpen;
    if (this.presenceCalendarOpen) {
      this.ensurePresenceEmployeeSelection();
      this.ensurePresenceExceptionDate();
      this.loadPresenceExceptionDaysForSelection();
      this.loadPresenceAttachmentsForSelection();
    }
  }

  onPresenceEmployeeSearchChange(): void {
    this.presenceEmployeeSearchOpen = true;
  }

  selectPresenceEmployee(employee: Employee): void {
    this.selectedPresenceEmployeeId = employee?.uid || '';
    this.presenceEmployeeSearch = this.formatRankingEmployeeName(employee);
    this.presenceEmployeeSearchOpen = false;
    this.presenceBulkMessage = '';
    this.invalidatePresenceCache();
    this.loadPresenceAttachmentsForSelection();
  }

  onPresencePeriodChange(): void {
    this.presenceBulkMessage = '';
    this.ensurePresenceExceptionDate();
    this.invalidatePresenceCache();
    this.loadPresenceExceptionDaysForSelection();
    this.loadPresenceAttachmentsForSelection();
  }

  onPresenceSummarySaturdayChange(): void {
    this.invalidatePresenceCache();
  }

  onPresenceSummaryFilterChange(): void {
    this.invalidatePresenceCache();
  }

  onPresenceBulkSaturdayChange(): void {
    this.presenceBulkMessage = '';
    this.invalidatePresenceCache();
  }

  openPresenceBulkModal(): void {
    this.presenceBulkMessage = '';
    this.presenceBulkDeductVacation = true;
    this.presenceBulkModalOpen = true;
  }

  closePresenceBulkModal(): void {
    if (this.presenceBulkSaving) return;
    this.presenceBulkModalOpen = false;
  }

  async applyPresenceBulkFill(): Promise<void> {
    if (!this.auth.isAdmin) return;
    const employee = this.selectedPresenceEmployee;
    if (!employee?.uid || !this.presenceBulkStatus) return;

    const ownerUid = employee.tempUser?.uid || this.auth.currentUser?.uid;
    if (!ownerUid) {
      this.presenceBulkMessage = "Impossible d'identifier le propriétaire.";
      return;
    }

    const targetDays = this.presenceBulkUnassignedDays;
    if (!targetDays.length) {
      this.presenceBulkMessage = 'Aucun jour non assigné à remplir.';
      return;
    }

    const confirmed = confirm(
      `Marquer ${targetDays.length} jour${
        targetDays.length > 1 ? 's' : ''
      } non assigné${
        targetDays.length > 1 ? 's' : ''
      } comme ${this.attendanceLabelForCode(this.presenceBulkStatus)} pour ${this.selectedPresenceEmployeeName} ?`
    );
    if (!confirmed) return;

    const nextAttendance = { ...(employee.attendance || {}) };
    targetDays.forEach((day) => {
      nextAttendance[day.label] = this.presenceBulkStatus;
    });
    const shouldDeductVacation = this.presenceBulkVacationDeductionApplies;
    const vacationDeductionDays = this.presenceBulkVacationDeductionDays;
    const vacationAcceptedAfterBulk = shouldDeductVacation
      ? this.selectedPresenceVacationAcceptedDays +
        vacationDeductionDays
      : this.selectedPresenceVacationAcceptedDays;
    const employeeUpdates: Partial<Employee> = {
      attendance: nextAttendance,
    };
    if (shouldDeductVacation) {
      employeeUpdates.vacationAcceptedNumberOfDays =
        vacationAcceptedAfterBulk.toString();
    }

    this.presenceBulkSaving = true;
    this.presenceBulkMessage = '';
    try {
      await this.data.updateEmployeeTopLevelFieldsForUser(
        ownerUid,
        employee.uid,
        employeeUpdates
      );

      employee.attendance = nextAttendance;
      if (shouldDeductVacation) {
        employee.vacationAcceptedNumberOfDays =
          vacationAcceptedAfterBulk.toString();
      }
      const fullEmployee = this.allEmployeesAll.find((item) => item.uid === employee.uid);
      if (fullEmployee) {
        fullEmployee.attendance = nextAttendance;
        if (shouldDeductVacation) {
          fullEmployee.vacationAcceptedNumberOfDays =
            vacationAcceptedAfterBulk.toString();
        }
      }
      this.invalidatePresenceCache();
      this.presenceBulkMessage = `${targetDays.length} jour${
        targetDays.length > 1 ? 's' : ''
      } mis à jour.${
        shouldDeductVacation
          ? ` ${vacationDeductionDays} jour${
              vacationDeductionDays > 1 ? 's' : ''
            } de vacances déduit${
              vacationDeductionDays > 1 ? 's' : ''
            }.`
          : ''
      }`;
      this.presenceBulkModalOpen = false;

      Promise.allSettled(
        targetDays.map((day) =>
          this.afs
            .doc(
              `users/${ownerUid}/employees/${employee.uid}/attendance/${this.dateIsoFromLabel(day.label)}`
            )
            .set(
              {
                status: this.presenceBulkStatus,
                dateISO: this.dateIsoFromLabel(day.label),
                dateLabel: day.label,
                updatedAt: new Date(),
                updatedBy: this.auth.currentUser?.uid || 'unknown',
                source: 'admin_bulk_fill',
              },
              { merge: true }
            )
        )
      ).then((results) => {
        const failed = results.filter((result) => result.status === 'rejected');
        if (failed.length) {
          console.warn('Some attendance day documents failed to sync', failed);
        }
      });
    } catch (error) {
      console.error('Failed to bulk fill presence days', error);
      this.presenceBulkMessage =
        'Impossible de remplir les jours non assignés.';
    } finally {
      this.presenceBulkSaving = false;
    }
  }

  async addPresenceExceptionDay(): Promise<void> {
    if (!this.auth.isAdmin || !this.presenceExceptionDate) return;
    if (
      this.presenceExceptionDate < this.presenceMonthStartISO ||
      this.presenceExceptionDate > this.presenceMonthEndISO
    ) {
      this.presenceExceptionMessage =
        'Choisissez une date dans le mois sélectionné.';
      return;
    }

    const dateLabel = this.normalizeAttendanceLabelFromInputs(
      '',
      this.presenceExceptionDate
    );
    if (!dateLabel) return;

    const nextDays = {
      ...this.presenceExceptionDays,
      [this.presenceExceptionDate]: {
        dateISO: this.presenceExceptionDate,
        dateLabel,
        reason: this.presenceExceptionReason.trim() || 'Exception',
        createdAt: new Date(),
        createdBy: this.auth.currentUser?.uid || 'unknown',
      },
    };

    await this.savePresenceExceptionDays(nextDays, 'Jour exception ajouté.');
    this.presenceExceptionReason = '';
  }

  async deletePresenceExceptionDay(dateISO: string): Promise<void> {
    if (!this.auth.isAdmin || !dateISO) return;
    const nextDays = { ...this.presenceExceptionDays };
    delete nextDays[dateISO];
    await this.savePresenceExceptionDays(nextDays, 'Jour exception supprimé.');
  }

  openPresenceDayEditor(cell: PresenceCalendarCell): void {
    const employee = this.selectedPresenceEmployee;
    if (!this.auth.isAdmin || !employee || !cell.day) return;
    this.presenceDayEditor = {
      open: true,
      employeeId: employee.uid || '',
      employeeName: this.formatRankingEmployeeName(employee),
      dateLabel: cell.label,
      dateISO: cell.dateISO,
      status: cell.status,
      selectedStatus: cell.status,
      saving: false,
      error: '',
    };
  }

  closePresenceDayEditor(): void {
    this.presenceDayEditor = {
      open: false,
      employeeId: '',
      employeeName: '',
      dateLabel: '',
      dateISO: '',
      status: '',
      selectedStatus: '',
      saving: false,
      error: '',
    };
  }

  async applyPresenceDayEditor(): Promise<void> {
    if (!this.auth.isAdmin || !this.presenceDayEditor.open) return;
    const employee = this.allEmployees.find(
      (item) => item.uid === this.presenceDayEditor.employeeId
    );
    if (!employee?.uid) return;

    const ownerUid = employee.tempUser?.uid || this.auth.currentUser?.uid;
    if (!ownerUid) {
      this.presenceDayEditor.error = "Impossible d'identifier le propriétaire.";
      return;
    }

    const label = this.normalizeAttendanceLabel(this.presenceDayEditor.dateLabel);
    const nextStatus = this.presenceDayEditor.selectedStatus;
    const nextAttendance = { ...(employee.attendance || {}) };
    Object.keys(nextAttendance).forEach((key) => {
      if (this.normalizeAttendanceLabel(key) === label) {
        delete nextAttendance[key];
      }
    });
    if (nextStatus) {
      nextAttendance[label] = nextStatus;
    }

    this.presenceDayEditor.saving = true;
    this.presenceDayEditor.error = '';
    try {
      await this.data.updateEmployeeTopLevelFieldsForUser(ownerUid, employee.uid, {
        attendance: nextAttendance,
      });

      const attendanceDoc = this.afs.doc(
        `users/${ownerUid}/employees/${employee.uid}/attendance/${this.presenceDayEditor.dateISO}`
      );
      await attendanceDoc.set(
        {
          status: nextStatus || '',
          dateISO: this.presenceDayEditor.dateISO,
          dateLabel: label,
          updatedAt: new Date(),
          updatedBy: this.auth.currentUser?.uid || 'unknown',
        },
        { merge: true }
      );

      employee.attendance = nextAttendance;
      const fullEmployee = this.allEmployeesAll.find((item) => item.uid === employee.uid);
      if (fullEmployee) {
        fullEmployee.attendance = nextAttendance;
      }
      this.invalidatePresenceCache();
      this.closePresenceDayEditor();
    } catch (error) {
      console.error('Failed to update presence day', error);
      this.presenceDayEditor.error = 'Impossible de mettre à jour cette journée.';
    } finally {
      if (this.presenceDayEditor.open) {
        this.presenceDayEditor.saving = false;
      }
    }
  }

  private ensurePresenceEmployeeSelection(): void {
    if (!this.allEmployees?.length) {
      this.selectedPresenceEmployeeId = '';
      this.presenceEmployeeSearch = '';
      return;
    }

    const stillExists = this.allEmployees.some(
      (employee) => employee.uid === this.selectedPresenceEmployeeId
    );
    if (!stillExists) {
      this.selectedPresenceEmployeeId = this.allEmployees[0].uid || '';
    }
  }

  private buildPresenceMonthSummary(
    employee: Employee,
    month: number,
    year: number
  ): AttendanceMonthSummary {
    const today = this.presenceCutoffParts(new Date());
    const monthDelta = year * 12 + month - (today.y * 12 + today.m);
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysConsidered =
      monthDelta < 0 ? daysInMonth : monthDelta === 0 ? today.d : 0;

    const counts: Record<AttendanceStateCode, number> = {
      '': 0,
      P: 0,
      A: 0,
      L: 0,
      V: 0,
      VP: 0,
      N: 0,
      F: 0,
    };

    let eligibleDays = 0;
    for (let day = 1; day <= daysConsidered; day++) {
      if (this.isSunday(month, day, year)) continue;
      const label = `${month}-${day}-${year}`;
      if (this.isPresenceExceptionLabel(label)) continue;
      if (!this.isPresenceDayInsideEmployment(employee, label)) continue;
      eligibleDays += 1;
      const status = this.getLatestAttendanceForEmployeeDay(
        employee,
        label
      ).status;
      if (!status) continue;
      counts[status] += 1;
    }

    const recordedDays =
      counts.P + counts.A + counts.L + counts.V + counts.VP + counts.N + counts.F;
    const monthLabel = this.time.monthFrenchNames?.[month - 1] || `Mois ${month}`;

    return {
      monthLabel,
      scopeLabel:
        monthDelta === 0
          ? `Jusqu'au ${today.d} ${monthLabel}`
          : monthDelta < 0
          ? 'Mois complet'
          : 'Aucun jour à résumer pour le moment',
      daysConsidered: eligibleDays,
      recordedDays,
      presentDays: counts.P,
      lateDays: counts.L,
      absentDays: counts.A,
      items: [
        { code: 'L', label: 'Retard', count: counts.L, classes: this.presenceSummaryClasses('L') },
        { code: 'A', label: 'Absent', count: counts.A, classes: this.presenceSummaryClasses('A') },
        { code: 'N', label: 'Néant', count: counts.N, classes: this.presenceSummaryClasses('N') },
        { code: 'V', label: 'Vacance', count: counts.V, classes: this.presenceSummaryClasses('V') },
        { code: 'VP', label: 'Vacance en cours', count: counts.VP, classes: this.presenceSummaryClasses('VP') },
        { code: 'F', label: 'Anomalie', count: counts.F, classes: this.presenceSummaryClasses('F') },
        {
          code: 'missing',
          label: 'Sans statut',
          count: Math.max(eligibleDays - recordedDays, 0),
          classes: 'bg-white text-slate-700 ring-slate-200',
        },
      ],
    };
  }

  private buildPresenceCalendarWeeks(
    employee: Employee,
    month: number,
    year: number
  ): PresenceCalendarCell[][] {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const weeks: PresenceCalendarCell[][] = [];
    let day = 1;

    for (let rowIndex = 0; rowIndex < 6; rowIndex++) {
      const week: PresenceCalendarCell[] = [];
      for (let columnIndex = 0; columnIndex < 7; columnIndex++) {
        if ((rowIndex === 0 && columnIndex < firstDayIndex) || day > daysInMonth) {
          week.push(this.emptyPresenceCell());
          continue;
        }

        const label = `${month}-${day}-${year}`;
        const dateISO = this.dateIsoFromParts(month, day, year);
        const exception = this.presenceExceptionDays[dateISO];
        const latest = this.getLatestAttendanceForEmployeeDay(employee, label);
        const timeLabel = latest.key ? latest.key.split('-').slice(3, 5).join(':') : '';
        week.push({
          day,
          label,
          dateISO,
          key: latest.key,
          status: latest.status,
          statusLabel: this.attendanceLabelForCode(latest.status),
          timeLabel,
          classes: this.presenceCellClasses(latest.status),
          isException: !!exception,
          exceptionReason: exception?.reason || '',
          attachment: this.findPresenceAttachmentForDay(employee, label),
        });
        day += 1;
      }
      weeks.push(week);
      if (day > daysInMonth) break;
    }

    return weeks;
  }

  private emptyPresenceCell(): PresenceCalendarCell {
    return {
      day: null,
      label: '',
      dateISO: '',
      status: '',
      statusLabel: '',
      timeLabel: '',
      classes: 'bg-slate-50 text-slate-300',
    };
  }

  private buildPresenceMissSummaryForEmployee(
    employee: Employee
  ): PresenceEmployeeMissSummary {
    const days = this.presenceEligibleDayLabels(
      this.presenceMonth,
      this.presenceYear,
      this.presenceSummaryIncludeSaturday
    );
    const missed = days
      .filter((label) => this.isPresenceDayInsideEmployment(employee, label))
      .map((label) => {
        const status = this.getLatestAttendanceForEmployeeDay(employee, label).status;
        if (!this.isPresenceSummaryIncludedStatus(status)) return null;
        return {
          label,
          display: this.presenceDayDisplay(label),
          status,
          statusLabel: status ? this.attendanceLabelForCode(status) : 'Sans statut',
        } as PresenceMissedDay;
      })
      .filter((item): item is PresenceMissedDay => !!item);

    return {
      employee,
      name: this.formatRankingEmployeeName(employee),
      missedDays: missed.length,
      absentDays: missed.filter((item) => item.status === 'A').length,
      unmarkedDays: missed.filter((item) => !item.status).length,
      anomalyDays: missed.filter((item) => item.status === 'F').length,
      days: missed,
    };
  }

  private presenceEligibleDayLabels(
    month: number,
    year: number,
    includeSaturday: boolean
  ): string[] {
    const today = this.presenceCutoffParts(new Date());
    const monthDelta = year * 12 + month - (today.y * 12 + today.m);
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysConsidered =
      monthDelta < 0 ? daysInMonth : monthDelta === 0 ? today.d : 0;
    const labels: string[] = [];

    for (let day = 1; day <= daysConsidered; day++) {
      const dayOfWeek = new Date(year, month - 1, day).getDay();
      if (dayOfWeek === 0) continue;
      if (!includeSaturday && dayOfWeek === 6) continue;
      const label = `${month}-${day}-${year}`;
      if (this.isPresenceExceptionLabel(label)) continue;
      labels.push(label);
    }

    return labels;
  }

  private isPresenceSummaryIncludedStatus(status: AttendanceStateCode): boolean {
    if (!status) return true;
    if (status === 'A') return this.presenceSummaryIncludeAbsent;
    if (status === 'F') return this.presenceSummaryIncludeAnomaly;
    return false;
  }

  private presenceDayDisplay(label: string): string {
    const [month, day, year] = label.split('-').map(Number);
    if (!month || !day || !year) return label;
    const monthName = this.time.monthFrenchNames?.[month - 1] || `Mois ${month}`;
    return `${day} ${monthName}`;
  }

  private isPresenceExceptionLabel(label: string): boolean {
    const dateISO = this.dateIsoFromLabel(label);
    return !!dateISO && !!this.presenceExceptionDays[dateISO];
  }

  private dateIsoFromLabel(label: string): string {
    const [month, day, year] = label.split('-').map(Number);
    if (!month || !day || !year) return '';
    return this.dateIsoFromParts(month, day, year);
  }

  private isPresenceDayInsideEmployment(
    employee: Employee,
    label: string
  ): boolean {
    const dateISO = this.dateIsoFromLabel(label);
    if (!dateISO) return true;

    const { joinedISO, leftISO } = this.presenceEmploymentWindow(employee);
    if (joinedISO && dateISO < joinedISO) return false;
    if (leftISO && dateISO > leftISO) return false;
    return true;
  }

  private presenceEmploymentWindow(employee: Employee): EmployeePresenceWindow {
    const cacheKey = [
      employee?.uid || '',
      employee?.dateJoined || '',
      employee?.dateLeft || '',
    ].join('|');
    const cached = this.presenceEmploymentDateCache.get(cacheKey);
    if (cached) return cached;

    const window = {
      joinedISO: this.parsePresenceEmploymentDateISO(employee?.dateJoined),
      leftISO: this.parsePresenceEmploymentDateISO(employee?.dateLeft),
    };
    this.presenceEmploymentDateCache.set(cacheKey, window);
    return window;
  }

  private parsePresenceEmploymentDateISO(rawDate?: unknown): string {
    if (!rawDate) return '';

    if (rawDate instanceof Date) {
      return this.isoFromDateObject(rawDate);
    }

    const timestampLike = rawDate as { toDate?: () => Date; seconds?: number };
    if (typeof timestampLike.toDate === 'function') {
      return this.isoFromDateObject(timestampLike.toDate());
    }
    if (typeof timestampLike.seconds === 'number') {
      return this.isoFromDateObject(new Date(timestampLike.seconds * 1000));
    }

    if (typeof rawDate !== 'string') return '';
    const trimmed = rawDate.trim();
    if (!trimmed) return '';

    const parts = trimmed.split(/[-/]/).map((part) => part.trim());
    if (parts.length === 3) {
      const yearFirst = parts[0].length === 4;
      const year = Number(yearFirst ? parts[0] : parts[2]);
      const month = Number(yearFirst ? parts[1] : parts[0]);
      const day = Number(yearFirst ? parts[2] : parts[1]);
      const parsed = new Date(year, month - 1, day);

      if (
        Number.isFinite(year) &&
        Number.isFinite(month) &&
        Number.isFinite(day) &&
        !Number.isNaN(parsed.getTime()) &&
        parsed.getFullYear() === year &&
        parsed.getMonth() === month - 1 &&
        parsed.getDate() === day
      ) {
        return this.isoFromDateObject(parsed);
      }
    }

    const fallback = new Date(trimmed);
    if (Number.isNaN(fallback.getTime())) return '';
    return this.isoFromDateObject(fallback);
  }

  private isoFromDateObject(date: Date): string {
    if (Number.isNaN(date.getTime())) return '';
    return this.dateIsoFromParts(
      date.getMonth() + 1,
      date.getDate(),
      date.getFullYear()
    );
  }

  private presenceExceptionMonthKey(): string {
    return `${this.presenceYear}-${String(this.presenceMonth).padStart(2, '0')}`;
  }

  private presenceExceptionDocPath(): string {
    return `presenceExceptionMonths/${this.presenceExceptionMonthKey()}`;
  }

  private legacyPresenceExceptionDocPath(): string {
    const uid = this.auth.currentUser?.uid || '';
    return uid
      ? `users/${uid}/presenceExceptionMonths/${this.presenceExceptionMonthKey()}`
      : '';
  }

  private ensurePresenceExceptionDate(): void {
    const { startISO, endISO } = this.monthIsoRange(
      this.presenceMonth,
      this.presenceYear
    );
    if (
      !this.presenceExceptionDate ||
      this.presenceExceptionDate < startISO ||
      this.presenceExceptionDate > endISO
    ) {
      this.presenceExceptionDate = startISO;
    }
  }

  private async loadPresenceExceptionDaysForSelection(): Promise<void> {
    const path = this.presenceExceptionDocPath();
    const legacyPath = this.legacyPresenceExceptionDocPath();
    const cacheKey = [path, legacyPath].filter(Boolean).join('|');
    if (this.presenceExceptionsCacheKey === cacheKey) return;

    this.presenceExceptionsCacheKey = cacheKey;
    this.presenceExceptionsLoading = true;
    this.presenceExceptionMessage = '';
    try {
      const [snapshot, legacySnapshot] = await Promise.all([
        firstValueFrom(this.afs.doc(path).get()),
        legacyPath
          ? firstValueFrom(this.afs.doc(legacyPath).get())
          : Promise.resolve(null),
      ]);
      const data = snapshot.data() as any;
      const legacyData = legacySnapshot?.data() as any;
      const globalDays = data?.days || {};
      const legacyDays = legacyData?.days || {};
      this.presenceExceptionDays = {
        ...legacyDays,
        ...globalDays,
      };
      if (
        this.auth.isAdmin &&
        Object.keys(legacyDays).some((dateISO) => !globalDays[dateISO])
      ) {
        this.promoteLegacyPresenceExceptionDays(path, this.presenceExceptionDays);
      }
      this.invalidatePresenceCache();
    } catch (error) {
      console.error('Failed to load presence exception days', error);
      this.presenceExceptionDays = {};
      this.invalidatePresenceCache();
      this.presenceExceptionMessage =
        'Impossible de charger les jours exception.';
    } finally {
      this.presenceExceptionsLoading = false;
    }
  }

  private promoteLegacyPresenceExceptionDays(
    path: string,
    days: Record<string, PresenceExceptionDay>
  ): void {
    this.afs
      .doc(path)
      .set(
        {
          monthKey: this.presenceExceptionMonthKey(),
          days,
          updatedAt: new Date(),
          updatedBy: this.auth.currentUser?.uid || 'unknown',
          migratedFrom: 'legacy_user_presenceExceptionMonths',
        },
        { merge: true }
      )
      .catch((error) => {
        console.warn('Failed to promote legacy presence exception days', error);
      });
  }

  private async savePresenceExceptionDays(
    days: Record<string, PresenceExceptionDay>,
    successMessage: string
  ): Promise<void> {
    const path = this.presenceExceptionDocPath();
    if (!path) {
      this.presenceExceptionMessage = "Impossible d'identifier le calendrier.";
      return;
    }

    this.presenceExceptionSaving = true;
    this.presenceExceptionMessage = '';
    try {
      await this.afs.doc(path).set(
        {
          monthKey: this.presenceExceptionMonthKey(),
          days,
          updatedAt: new Date(),
          updatedBy: this.auth.currentUser?.uid || 'unknown',
        },
        { merge: true }
      );
      this.presenceExceptionDays = days;
      this.presenceExceptionsCacheKey = path;
      this.presenceExceptionMessage = successMessage;
      this.invalidatePresenceCache();
    } catch (error) {
      console.error('Failed to save presence exception days', error);
      this.presenceExceptionMessage =
        "Impossible d'enregistrer les jours exception.";
    } finally {
      this.presenceExceptionSaving = false;
    }
  }

  private getLatestAttendanceForEmployeeDay(
    employee: Employee,
    baseLabel: string
  ): { key?: string; status: AttendanceStateCode } {
    const attendance = employee?.attendance || {};
    const matches = Object.keys(attendance)
      .filter((key) => this.normalizeAttendanceLabel(key) === baseLabel)
      .map((key) => ({
        key,
        status: this.normalizeAttendanceCode(attendance[key]) as AttendanceStateCode,
        seconds: this.attendanceKeySeconds(key),
      }));

    if (!matches.length) return { status: '' };
    matches.sort((a, b) => b.seconds - a.seconds);
    return { key: matches[0].key, status: matches[0].status };
  }

  private async loadPresenceAttachmentsForSelection(): Promise<void> {
    const employee = this.selectedPresenceEmployee;
    const ownerUid = employee?.tempUser?.uid || this.auth.currentUser?.uid;
    const employeeId = employee?.uid;
    if (!ownerUid || !employeeId) {
      this.presenceAttachmentsByLabel = {};
      this.presenceAttachmentsCacheKey = '';
      return;
    }

    const cacheKey = `${ownerUid}:${employeeId}:${this.presenceYear}-${this.presenceMonth}`;
    if (this.presenceAttachmentsCacheKey === cacheKey) return;

    this.presenceAttachmentsCacheKey = cacheKey;
    this.presenceAttachmentsByLabel = {};
    this.presenceAttachmentsLoading = true;

    try {
      const { startISO, endISO } = this.monthIsoRange(
        this.presenceMonth,
        this.presenceYear
      );
      const attendanceColl = this.afs.collection(
        `users/${ownerUid}/employees/${employeeId}/attendance`,
        (ref) =>
          ref.where('dateISO', '>=', startISO).where('dateISO', '<=', endISO)
      );
      const monthSnap = await firstValueFrom(attendanceColl.get());
      const tasks = monthSnap.docs.map(async (dayDoc) => {
        const data = dayDoc.data() as any;
        const label = this.normalizeAttendanceLabelFromInputs(
          data?.dateLabel,
          data?.dateISO
        );
        if (!label) return;

        const attColl = this.afs.collection(
          `users/${ownerUid}/employees/${employeeId}/attendance/${dayDoc.id}/attachments`,
          (ref) => ref.orderBy('uploadedAt', 'desc')
        );
        const attSnap = await firstValueFrom(attColl.get());
        const attachments = attSnap.docs
          .map((snapshot) => snapshot.data() as any)
          .sort((a, b) => this.attachmentSortTime(b) - this.attachmentSortTime(a));
        if (!attachments.length) return;
        this.presenceAttachmentsByLabel[label] = [
          ...(this.presenceAttachmentsByLabel[label] || []),
          ...attachments,
        ];
      });

      await Promise.all(tasks);
      this.invalidatePresenceCache();
    } catch (error) {
      console.error('Failed to load presence attachments', error);
    } finally {
      this.presenceAttachmentsLoading = false;
    }
  }

  private monthIsoRange(month: number, year: number): {
    startISO: string;
    endISO: string;
  } {
    const m = String(month).padStart(2, '0');
    const daysInMonth = new Date(year, month, 0).getDate();
    return {
      startISO: `${year}-${m}-01`,
      endISO: `${year}-${m}-${String(daysInMonth).padStart(2, '0')}`,
    };
  }

  private dateIsoFromParts(month: number, day: number, year: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(
      2,
      '0'
    )}`;
  }

  private normalizeAttendanceLabelFromInputs(
    dateLabel?: string,
    dateISO?: string
  ): string {
    if (dateLabel) return this.normalizeAttendanceLabel(dateLabel);
    if (dateISO) {
      const [year, month, day] = dateISO.split('-').map(Number);
      if (year && month && day) return `${month}-${day}-${year}`;
    }
    return '';
  }

  private findPresenceAttachmentForDay(employee: Employee, dateLabel: string) {
    const normalized = this.normalizeAttendanceLabel(dateLabel);
    const attachments =
      this.presenceAttachmentsByLabel[normalized] ||
      this.presenceAttachmentsByLabel[dateLabel];
    if (attachments?.length) return this.pickLatestPresenceAttachment(attachments);

    const legacy = (employee as any)?.attendanceAttachments || {};
    const keys = Object.keys(legacy).filter(
      (key) =>
        key.startsWith(dateLabel) ||
        this.normalizeAttendanceLabel(key) === normalized
    );
    if (!keys.length) return null;
    const bestKey = keys.reduce((previous, current) =>
      this.attendanceKeySeconds(current) > this.attendanceKeySeconds(previous)
        ? current
        : previous
    );
    return legacy[bestKey];
  }

  private pickLatestPresenceAttachment(attachments: any[]): any {
    return [...attachments].sort(
      (a, b) => this.attachmentSortTime(b) - this.attachmentSortTime(a)
    )[0];
  }

  private attachmentSortTime(att: any): number {
    const takenAt = typeof att?.takenAt === 'number' ? att.takenAt : -Infinity;
    if (takenAt !== -Infinity) return takenAt;
    return this.toTimestamp(att?.uploadedAt);
  }

  private toTimestamp(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    if (value?.toMillis) return value.toMillis();
    if (value?.seconds) return value.seconds * 1000;
    return 0;
  }

  attachmentUrl(att: any): string {
    return (
      att?.url ||
      att?.downloadURL ||
      att?.downloadUrl ||
      att?.secureUrl ||
      ''
    )
      .toString()
      .trim();
  }

  attachmentKind(att: any): 'image' | 'video' | '' {
    const contentType = (
      att?.contentType ||
      att?.type ||
      att?.mimeType ||
      att?.metadata?.contentType ||
      ''
    )
      .toString()
      .toLowerCase();

    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';

    const url = this.attachmentUrl(att).toLowerCase();
    if (/\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)(\?|$)/.test(url)) {
      return 'image';
    }
    if (/\.(mp4|mov|webm|ogg|m4v)(\?|$)/.test(url)) {
      return 'video';
    }
    return '';
  }

  openPresenceAttachment(att: any, dateLabel: string): void {
    const kind = this.attachmentKind(att);
    const url = this.attachmentUrl(att);
    if (!kind || !url) return;
    this.presenceAttachmentViewer = {
      open: true,
      url,
      kind,
      dateLabel,
      takenAt:
        this.coerceToDate(att?.takenAt) ||
        this.coerceToDate(att?.createdAt) ||
        this.coerceToDate(att?.uploadedAt) ||
        null,
      takenAtSource:
        att?.takenAtSource || (att?.uploadedAt ? 'storageUploadedAt' : 'unknown'),
    };
  }

  closePresenceAttachment(): void {
    this.presenceAttachmentViewer.open = false;
  }

  private coerceToDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }
    if (value?.toDate) return value.toDate();
    if (value?.seconds) return new Date(value.seconds * 1000);
    return null;
  }

  formatKinshasa(date: Date): string {
    return new Intl.DateTimeFormat('fr-CD', {
      timeZone: 'Africa/Kinshasa',
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  }

  private presenceCutoffParts(date: Date): { y: number; m: number; d: number } {
    return {
      y: date.getFullYear(),
      m: date.getMonth() + 1,
      d: date.getDate(),
    };
  }

  private normalizeAttendanceLabel(key?: string): string {
    if (!key) return '';
    const parts = key.split('-');
    if (parts.length < 3) return '';
    return `${Number(parts[0])}-${Number(parts[1])}-${parts[2]}`;
  }

  private attendanceKeySeconds(key: string): number {
    const parts = key.split('-');
    const hh = Number(parts[3] || 0);
    const mm = Number(parts[4] || 0);
    const ss = Number(parts[5] || 0);
    return hh * 3600 + mm * 60 + ss;
  }

  private kinParts(date: Date): { y: number; m: number; d: number } {
    const parts = new Intl.DateTimeFormat('fr-CD', {
      timeZone: 'Africa/Kinshasa',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const map: Record<string, string> = {};
    parts.forEach((part) => {
      map[part.type] = part.value;
    });
    return {
      y: Number(map['year']),
      m: Number(map['month']),
      d: Number(map['day']),
    };
  }

  private isSunday(month: number, day: number, year: number): boolean {
    return new Date(year, month - 1, day).getDay() === 0;
  }

  presenceCellClasses(code: string): string {
    switch (code) {
      case 'P':
        return 'bg-emerald-600 text-white ring-emerald-700';
      case 'A':
        return 'bg-rose-600 text-white ring-rose-700';
      case 'L':
        return 'bg-amber-500 text-white ring-amber-600';
      case 'V':
        return 'bg-yellow-400 text-slate-900 ring-yellow-500';
      case 'VP':
        return 'bg-sky-600 text-white ring-sky-700';
      case 'F':
        return 'bg-fuchsia-700 text-white ring-fuchsia-800';
      case 'N':
        return 'bg-slate-400 text-white ring-slate-500';
      case '':
      default:
        return 'bg-white text-slate-700 ring-slate-200';
    }
  }

  private presenceSummaryClasses(code: AttendanceStateCode): string {
    switch (code) {
      case 'L':
        return 'bg-amber-50 text-amber-700 ring-amber-200';
      case 'A':
        return 'bg-rose-50 text-rose-700 ring-rose-200';
      case 'V':
        return 'bg-yellow-50 text-yellow-700 ring-yellow-200';
      case 'VP':
        return 'bg-sky-50 text-sky-700 ring-sky-200';
      case 'F':
        return 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200';
      case 'N':
      case '':
      default:
        return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }

  async setAttendanceForSelectedDate(
    employee: Employee,
    code: AttendanceQuickCode
  ): Promise<void> {
    if (!this.auth.isAdmin) return;
    if (!employee?.uid) return;
    const ownerUid = employee?.tempUser?.uid || this.auth.currentUser?.uid;
    if (!ownerUid) return;
    const e: any = employee;
    if (e._attendanceSaving) return;

    e._attendanceSaving = true;
    const label = this.time.todaysDateMonthDayYear();
    const dateISO = this.time.getTodaysDateYearMonthDay();

    try {
      if (code === '') {
        await this.data.clearAttendanceKey(ownerUid, employee.uid, label);
        if (!employee.attendance) employee.attendance = {};
        delete employee.attendance[label];
        return;
      }

      await this.data.updateAttendanceKey(ownerUid, employee.uid, label, code);
      await this.data.setAttendanceEntry(
        ownerUid,
        employee.uid,
        dateISO,
        code,
        label,
        this.auth.currentUser?.uid || 'unknown'
      );

      if (!employee.attendance) employee.attendance = {};
      employee.attendance[label] = code;
    } catch (error) {
      console.error('Failed to set attendance status for selected date', error);
      alert("Impossible d'enregistrer la présence pour cette date.");
    } finally {
      e._attendanceSaving = false;
    }
  }

  onWeeklyPaymentDateChange(): void {
    this.updateWeekPickerLabels();
    if (this.rankingMode === 'weeklyPayments') {
      this.loadWeeklyTotalsForEmployees();
    }
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

  get totalWeeklyAmount(): number {
    return this.paidEmployeesWeek.reduce(
      (sum, e: any) => sum + Number(e._weekTotal || 0),
      0
    );
  }

  get totalWeeklyAmountUsd(): number {
    const total = this.totalWeeklyAmount;
    const usd = this.compute.convertCongoleseFrancToUsDollars(String(total));
    return usd === '' ? 0 : usd;
  }

  get totalPayrollBase(): number {
    return this.payrollRows.reduce((sum, row) => sum + row.base, 0);
  }

  get totalPayrollAdditions(): number {
    return this.payrollRows.reduce((sum, row) => sum + row.additionsTotal, 0);
  }

  get totalPayrollDeductions(): number {
    return this.payrollRows.reduce((sum, row) => sum + row.deductionsTotal, 0);
  }

  payrollEmployeeInitials(employee: Employee): string {
    const first = (employee.firstName || '?').charAt(0);
    const last = (employee.lastName || '').charAt(0);
    return `${first}${last}`.toUpperCase();
  }

  payrollRowIsOpen(row: PayrollBreakdownRow): boolean {
    return this.payrollControlRowKey === this.payrollRowKey(row);
  }

  togglePayrollControl(row: PayrollBreakdownRow): void {
    const key = this.payrollRowKey(row);
    this.payrollControlRowKey =
      this.payrollControlRowKey === key ? '' : key;
  }

  payrollVisibilitySaving(row: PayrollBreakdownRow, field: 'payment' | 'bonus'): boolean {
    return this.payrollVisibilitySavingKey === `${this.payrollRowKey(row)}:${field}`;
  }

  payrollRowIsEditing(row: PayrollBreakdownRow): boolean {
    return this.payrollEditRowKey === this.payrollRowKey(row);
  }

  openPayrollEdit(row: PayrollBreakdownRow): void {
    const key = this.payrollRowKey(row);
    if (this.payrollEditRowKey === key) {
      this.closePayrollEdit();
      return;
    }

    this.payrollEditRowKey = key;
    this.payrollEditDraft = this.buildPayrollEditDraft(row);
  }

  closePayrollEdit(): void {
    if (this.payrollEditSaving) return;
    this.payrollEditRowKey = '';
    this.payrollEditDraft = null;
  }

  payrollEditNetPreview(): number {
    const draft = this.payrollEditDraft;
    if (!draft) return 0;
    return (
      this.numberFrom(draft.base) +
      this.numberFrom(draft.experience) +
      this.numberFrom(draft.bankFee) +
      Math.max(this.numberFrom(draft.manualAddition), 0) -
      this.numberFrom(draft.absent) -
      this.numberFrom(draft.nothing) -
      this.numberFrom(draft.late) -
      this.numberFrom(draft.objective) -
      Math.max(this.numberFrom(draft.manualWithdrawal), 0)
    );
  }

  payrollEditBonusPreview(): number {
    const draft = this.payrollEditDraft;
    if (!draft) return 0;
    return (
      this.numberFrom(draft.bonusAmount) +
      this.numberFrom(draft.bestTeamBonusAmount) +
      this.numberFrom(draft.bestEmployeeBonusAmount) +
      this.numberFrom(draft.bestManagerBonusAmount)
    );
  }

  removePayrollDraftDeduction(index: number): void {
    const draft = this.payrollEditDraft;
    const detail = draft?.deductionDetails?.[index];
    if (!draft || !detail) return;

    if (detail.kind === 'absent') {
      draft.absent = Math.max(0, this.numberFrom(draft.absent) - detail.amount);
    } else if (detail.kind === 'nothing') {
      draft.nothing = Math.max(0, this.numberFrom(draft.nothing) - detail.amount);
    } else if (detail.kind === 'late') {
      draft.late = Math.max(0, this.numberFrom(draft.late) - detail.amount);
    } else if (detail.kind === 'objective') {
      draft.objective = Math.max(
        0,
        this.numberFrom(draft.objective) - detail.amount
      );
      draft.objectiveDeductions = draft.objectiveDeductions.filter(
        (item) => item.start !== detail.start || item.end !== detail.end
      );
    } else if (detail.kind === 'manualWithdrawal') {
      draft.manualWithdrawal = 0;
      draft.manualWithdrawalReason = '';
    }

    draft.deductionDetails.splice(index, 1);
  }

  onPayrollWeekObjectiveStartChange(row: PayrollBreakdownRow): void {
    this.updatePayrollWeekObjectivePreview(row);
  }

  addPayrollDraftObjectiveDeduction(row: PayrollBreakdownRow): void {
    const draft = this.payrollEditDraft;
    if (!draft || row.attendanceOnly) return;

    this.updatePayrollWeekObjectivePreview(row);
    const amount = this.numberFrom(draft.weekObjectiveAmount);
    if (!draft.weekObjectiveStartDate || !draft.weekObjectiveEndDate || amount <= 0) {
      return;
    }

    const entry: WeeklyObjectiveDeduction = {
      start: draft.weekObjectiveStartDate,
      end: draft.weekObjectiveEndDate,
      amount,
    };
    const existingIndex = draft.objectiveDeductions.findIndex(
      (item) => item.start === entry.start && item.end === entry.end
    );

    if (existingIndex >= 0) {
      draft.objectiveDeductions[existingIndex] = entry;
    } else {
      draft.objectiveDeductions.push(entry);
    }

    this.recomputePayrollDraftObjectiveDeductions();
  }

  async savePayrollEdit(row: PayrollBreakdownRow): Promise<void> {
    const draft = this.payrollEditDraft;
    if (!this.auth.isAdmninistrator || !draft || !row?.employee?.uid) return;

    const ownerUid = row.employee.tempUser?.uid || this.auth.currentUser?.uid;
    if (!ownerUid) {
      alert("Impossible d'identifier la localisation de cet employé.");
      return;
    }

    const net = this.payrollEditNetPreview();
    const bonusTotal = this.payrollEditBonusPreview();
    const paymentDeductions = row.attendanceOnly
      ? []
      : draft.objectiveDeductions.map((item) => ({
          start: item.start,
          end: item.end,
          amount: Number(item.amount) || 0,
        }));
    const fields: Partial<Employee> = {
      paymentAmount: this.numberFrom(draft.base).toString(),
      paymentIncreaseYears: this.numberFrom(draft.experience).toString(),
      paymentBankFee: this.numberFrom(draft.bankFee).toString(),
      paymentManualAddition: Math.max(
        this.numberFrom(draft.manualAddition),
        0
      ).toString(),
      paymentManualAdditionReason: (draft.manualAdditionReason || '').trim(),
      paymentAbsent: this.numberFrom(draft.absent).toString(),
      paymentNothing: this.numberFrom(draft.nothing).toString(),
      paymentLate: this.numberFrom(draft.late).toString(),
      paymentObjectiveWeekDeductionTotal: row.attendanceOnly
        ? '0'
        : this.numberFrom(draft.objective).toString(),
      paymentObjectiveWeekDeductions: paymentDeductions,
      paymentManualWithdrawal: Math.max(
        this.numberFrom(draft.manualWithdrawal),
        0
      ).toString(),
      paymentManualWithdrawalReason: (
        draft.manualWithdrawalReason || ''
      ).trim(),
      paymentSignNote: (draft.paymentSignNote || '').trim(),
      paymentConfiguredMonthKey: this.payrollPaymentMonthKey(),
      totalPayments: net.toString(),
      bonusAmount: this.numberFrom(draft.bonusAmount).toString(),
      bonusPercentage: this.numberFrom(draft.bonusPercentage).toString(),
      bestTeamBonusAmount: this.numberFrom(
        draft.bestTeamBonusAmount
      ).toString(),
      bestEmployeeBonusAmount: this.numberFrom(
        draft.bestEmployeeBonusAmount
      ).toString(),
      bestManagerBonusAmount: this.numberFrom(
        draft.bestManagerBonusAmount
      ).toString(),
      bonusSignNote: (draft.bonusSignNote || '').trim(),
      totalBonusThisMonth: bonusTotal.toString(),
    };

    this.payrollEditSaving = true;
    try {
      await this.data.updateEmployeeFieldsForUser(
        ownerUid,
        row.employee.uid,
        fields
      );
      Object.assign(row.employee, fields);
      this.recomputePayrollRowsForAdmin();
      this.payrollEditDraft = this.buildPayrollEditDraft(
        this.payrollRows.find(
          (candidate) => this.payrollRowKey(candidate) === this.payrollEditRowKey
        ) || row
      );
    } catch (error) {
      console.error('Failed to save payroll details', error);
      alert("Impossible d'enregistrer les valeurs de paiement.");
    } finally {
      this.payrollEditSaving = false;
    }
  }

  payrollPaymentVisible(employee: Employee): boolean {
    return employee.paymentCheckVisible === 'true';
  }

  payrollBonusVisible(employee: Employee): boolean {
    return employee.checkVisible === 'true';
  }

  async setPayrollPaymentVisible(
    row: PayrollBreakdownRow,
    visible: boolean
  ): Promise<void> {
    await this.setPayrollVisibility(row, 'paymentCheckVisible', visible);
  }

  async setPayrollBonusVisible(
    row: PayrollBreakdownRow,
    visible: boolean
  ): Promise<void> {
    await this.setPayrollVisibility(row, 'checkVisible', visible);
  }

  private recomputePayrollRowsForAdmin(): void {
    if (!this.auth.isAdmninistrator) {
      this.payrollRows = [];
      this.totalSalary = '0';
      this.total = String(Number(this.totalHouse || 0));
      return;
    }

    this.payrollRows = this.allEmployees.map((employee) =>
      this.buildPayrollBreakdownRow(employee)
    );

    const netSalaryTotal = this.payrollRows.reduce(
      (sum, row) => sum + row.net,
      0
    );
    this.totalSalary = netSalaryTotal.toString();
    this.total = (netSalaryTotal + Number(this.totalHouse || 0)).toString();
  }

  private async setPayrollVisibility(
    row: PayrollBreakdownRow,
    field: 'paymentCheckVisible' | 'checkVisible',
    visible: boolean
  ): Promise<void> {
    if (!this.auth.isAdmninistrator || !row?.employee?.uid) return;

    const ownerUid = row.employee.tempUser?.uid || this.auth.currentUser?.uid;
    if (!ownerUid) {
      alert("Impossible d'identifier la localisation de cet employé.");
      return;
    }

    const savingType = field === 'paymentCheckVisible' ? 'payment' : 'bonus';
    this.payrollVisibilitySavingKey = `${this.payrollRowKey(row)}:${savingType}`;
    const previousValue = row.employee[field];
    const nextValue = visible ? 'true' : 'false';
    row.employee[field] = nextValue;

    try {
      await this.data.updateEmployeeFieldsForUser(ownerUid, row.employee.uid, {
        [field]: nextValue,
      } as Partial<Employee>);
    } catch (error) {
      row.employee[field] = previousValue;
      console.error('Failed to update payroll visibility', error);
      alert("Impossible de changer la visibilité pour cet employé.");
    } finally {
      this.payrollVisibilitySavingKey = '';
    }
  }

  private payrollRowKey(row: PayrollBreakdownRow): string {
    return `${row.employee.tempUser?.uid || this.auth.currentUser?.uid || 'local'}:${
      row.employee.uid || row.name
    }`;
  }

  private buildPayrollEditDraft(row: PayrollBreakdownRow): PayrollEditDraft {
    const employee = row.employee;
    const draft: PayrollEditDraft = {
      base: row.base,
      experience: row.experience,
      bankFee: row.bankFee,
      manualAddition: row.manualAddition,
      manualAdditionReason: employee.paymentManualAdditionReason || '',
      absent: row.absent,
      nothing: row.nothing,
      late: row.late,
      objective: row.objective,
      manualWithdrawal: row.manualWithdrawal,
      manualWithdrawalReason: employee.paymentManualWithdrawalReason || '',
      paymentSignNote: employee.paymentSignNote || '',
      objectiveDeductions: row.objectiveDeductions.map((item) => ({
        start: item.start,
        end: item.end,
        amount: Number(item.amount) || 0,
      })),
      deductionDetails: row.deductionDetails.map((item) => ({ ...item })),
      weekObjectiveStartDate: this.time.getTodaysDateYearMonthDay(),
      weekObjectiveEndDate: '',
      weekObjectiveEndLabel: '',
      weekObjectiveAmount: 0,
      bonusAmount: this.numberFrom(employee.bonusAmount),
      bonusPercentage: this.numberFrom(employee.bonusPercentage),
      bestTeamBonusAmount: this.numberFrom(employee.bestTeamBonusAmount),
      bestEmployeeBonusAmount: this.numberFrom(
        employee.bestEmployeeBonusAmount
      ),
      bestManagerBonusAmount: this.numberFrom(
        employee.bestManagerBonusAmount
      ),
      bonusSignNote: employee.bonusSignNote || '',
    };
    this.updatePayrollWeekObjectivePreview(row, draft);
    return draft;
  }

  private updatePayrollWeekObjectivePreview(
    row: PayrollBreakdownRow,
    targetDraft: PayrollEditDraft | null = this.payrollEditDraft
  ): void {
    const draft = targetDraft;
    if (!draft || row.attendanceOnly || !draft.weekObjectiveStartDate) {
      if (draft) {
        draft.weekObjectiveEndDate = '';
        draft.weekObjectiveEndLabel = '';
        draft.weekObjectiveAmount = 0;
      }
      return;
    }

    const start = this.parseIsoDate(draft.weekObjectiveStartDate);
    if (start.getTime() === 0) {
      draft.weekObjectiveEndDate = '';
      draft.weekObjectiveEndLabel = '';
      draft.weekObjectiveAmount = 0;
      return;
    }

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    draft.weekObjectiveEndDate = this.formatIsoDate(end);
    draft.weekObjectiveEndLabel = this.formatWeekDate(end);

    const owner = row.employee.tempUser || this.auth.currentUser;
    if (!owner) {
      draft.weekObjectiveAmount = 0;
      return;
    }

    const dateKey = this.formatDateKey(start);
    const weeklyTotalFc = this.computeWeeklyPaymentTotalForPayroll(owner, dateKey);
    const weeklyTargetFc = this.resolvePayrollWeeklyTargetFc(owner, dateKey);
    draft.weekObjectiveAmount =
      this.compute.computeWeeklyObjectiveDeductionUsd(
        weeklyTotalFc,
        weeklyTargetFc
      );
  }

  private recomputePayrollDraftObjectiveDeductions(): void {
    const draft = this.payrollEditDraft;
    if (!draft) return;

    draft.objectiveDeductions = draft.objectiveDeductions
      .map((item) => ({
        start: item.start,
        end: item.end,
        amount: Number(item.amount) || 0,
      }))
      .filter((item) => item.start && item.end && item.amount > 0)
      .sort((a, b) => a.start.localeCompare(b.start));
    draft.objective = draft.objectiveDeductions.reduce(
      (sum, item) => sum + this.numberFrom(item.amount),
      0
    );
    draft.deductionDetails = draft.deductionDetails.filter(
      (detail) => detail.kind !== 'objective'
    );
    draft.objectiveDeductions.forEach((item) => {
      draft.deductionDetails.push({
        kind: 'objective',
        label: this.formatPayrollObjectiveLabel(item),
        amount: Number(item.amount) || 0,
        start: item.start,
        end: item.end,
      });
    });
  }

  private payrollPaymentMonthKey(): string {
    return `${this.givenYear}-${String(this.givenMonth).padStart(2, '0')}`;
  }

  private buildPayrollBreakdownRow(employee: Employee): PayrollBreakdownRow {
    const base = this.numberFrom(employee.paymentAmount);
    const bankFee = this.numberFrom(employee.paymentBankFee);
    const experience = this.numberFrom(employee.paymentIncreaseYears);
    const configured = this.employeePaymentConfiguredForSelectedMonth(employee);
    const attendanceOnly = this.employeeUsesAttendanceOnlyPayroll(employee);

    const attendanceDeductions = configured
      ? {
          absent: this.numberFrom(employee.paymentAbsent),
          nothing: this.numberFrom(employee.paymentNothing),
          late: this.numberFrom(employee.paymentLate),
        }
      : this.computeAttendanceDeductionsForPayroll(employee);

    const manualAddition = configured
      ? Math.max(this.numberFrom(employee.paymentManualAddition), 0)
      : 0;
    const manualWithdrawal = configured
      ? Math.max(this.numberFrom(employee.paymentManualWithdrawal), 0)
      : 0;
    const objectiveDeductions = attendanceOnly
      ? []
      : configured
      ? this.filterPayrollObjectiveDeductionsForSelectedMonth(
          employee.paymentObjectiveWeekDeductions || []
        )
      : this.computePayrollWeeklyShortfallDeductions(employee);
    const savedObjectiveTotal = this.numberFrom(
      employee.paymentObjectiveWeekDeductionTotal
    );
    const objective = attendanceOnly
      ? 0
      : configured && savedObjectiveTotal > 0
        ? savedObjectiveTotal
        : objectiveDeductions.reduce(
            (sum, item) => sum + this.numberFrom(item.amount),
            0
          );
    const additionsTotal = bankFee + experience + manualAddition;
    const deductionsTotal =
      attendanceDeductions.absent +
      attendanceDeductions.nothing +
      attendanceDeductions.late +
      objective +
      manualWithdrawal;
    const net = base + additionsTotal - deductionsTotal;
    const deductionDetails = this.buildPayrollDeductionDetails({
      employee,
      absent: attendanceDeductions.absent,
      nothing: attendanceDeductions.nothing,
      late: attendanceDeductions.late,
      objectiveDeductions,
      objective,
      manualWithdrawal,
    });

    return {
      employee,
      name: `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim(),
      role: employee.role || 'Employé',
      base,
      bankFee,
      experience,
      manualAddition,
      additionsTotal,
      absent: attendanceDeductions.absent,
      nothing: attendanceDeductions.nothing,
      late: attendanceDeductions.late,
      objective,
      manualWithdrawal,
      deductionsTotal,
      net,
      reasons: this.buildPayrollReasonLabels({
        employee,
        absent: attendanceDeductions.absent,
        nothing: attendanceDeductions.nothing,
        late: attendanceDeductions.late,
        objective,
        manualWithdrawal,
        attendanceOnly,
      }),
      configured,
      attendanceOnly,
      objectiveDeductions,
      deductionDetails,
    };
  }

  private buildPayrollDeductionDetails(input: {
    employee: Employee;
    absent: number;
    nothing: number;
    late: number;
    objectiveDeductions: WeeklyObjectiveDeduction[];
    objective: number;
    manualWithdrawal: number;
  }): PayrollDeductionDetail[] {
    const details: PayrollDeductionDetail[] = [];
    const attendanceDetails = this.computeAttendanceDeductionDetailsForPayroll(
      input.employee
    );
    const pushWithinTotal = (
      kind: PayrollDeductionDetail['kind'],
      targetTotal: number
    ) => {
      let remaining = this.numberFrom(targetTotal);
      for (const detail of attendanceDetails.filter((item) => item.kind === kind)) {
        if (remaining <= 0) break;
        const amount = Math.min(detail.amount, remaining);
        details.push({ ...detail, amount });
        remaining -= amount;
      }
      if (remaining > 0) {
        details.push({
          kind,
          label:
            kind === 'absent'
              ? 'Absent manuel'
              : kind === 'nothing'
              ? 'Néant manuel'
              : 'Retard manuel',
          amount: remaining,
        });
      }
    };

    pushWithinTotal('absent', input.absent);
    pushWithinTotal('nothing', input.nothing);
    pushWithinTotal('late', input.late);

    if (input.objective > 0) {
      let remainingObjective = this.numberFrom(input.objective);
      for (const item of input.objectiveDeductions) {
        if (remainingObjective <= 0) break;
        const amount = Math.min(this.numberFrom(item.amount), remainingObjective);
        details.push({
          kind: 'objective',
          label: this.formatPayrollObjectiveLabel(item),
          amount,
          start: item.start,
          end: item.end,
        });
        remainingObjective -= amount;
      }
      if (remainingObjective > 0) {
        details.push({
          kind: 'objective',
          label: 'Objectif semaine manuel',
          amount: remainingObjective,
        });
      }
    }

    if (input.manualWithdrawal > 0) {
      const reason = (input.employee.paymentManualWithdrawalReason || '').trim();
      details.push({
        kind: 'manualWithdrawal',
        label: reason ? `Retrait manuel: ${reason}` : 'Retrait manuel',
        amount: input.manualWithdrawal,
      });
    }

    return details;
  }

  private buildPayrollReasonLabels(input: {
    employee: Employee;
    absent: number;
    nothing: number;
    late: number;
    objective: number;
    manualWithdrawal: number;
    attendanceOnly: boolean;
  }): string[] {
    const reasons: string[] = [];
    if (input.absent > 0) reasons.push(`Absent -${input.absent}$`);
    if (input.nothing > 0) reasons.push(`Néant -${input.nothing}$`);
    if (input.late > 0) reasons.push(`Retard -${input.late}$`);
    if (input.objective > 0) reasons.push(`Semaines -${input.objective}$`);
    if (input.manualWithdrawal > 0) {
      const reason = (input.employee.paymentManualWithdrawalReason || '').trim();
      reasons.push(
        reason
          ? `Retrait -${input.manualWithdrawal}$ (${reason})`
          : `Retrait -${input.manualWithdrawal}$`
      );
    }
    if (input.attendanceOnly && input.objective <= 0) {
      reasons.push('Règles: présence seulement');
    }
    return reasons;
  }

  private computeAttendanceDeductionsForPayroll(employee: Employee): {
    absent: number;
    nothing: number;
    late: number;
  } {
    const attendance = employee.attendance || {};
    const byDate = new Map<string, string>();
    Object.entries(attendance).forEach(([key, value]) => {
      const label = this.normalizeAttendanceLabel(key);
      if (label) byDate.set(label, String(value));
    });

    let absentCount = 0;
    let nothingCount = 0;
    let lateCount = 0;

    for (const [label, value] of byDate.entries()) {
      const parts = this.attendanceLabelDateParts(label);
      if (!parts) continue;
      if (parts.month !== Number(this.givenMonth)) continue;
      if (parts.year !== Number(this.givenYear)) continue;
      if (value === 'A') absentCount += 1;
      if (value === 'N') nothingCount += 1;
      if (value === 'L') lateCount += 1;
    }

    return {
      absent: absentCount * 3,
      nothing: nothingCount * 3,
      late: lateCount,
    };
  }

  private computeAttendanceDeductionDetailsForPayroll(
    employee: Employee
  ): PayrollDeductionDetail[] {
    const attendance = employee.attendance || {};
    const byDate = new Map<string, string>();
    Object.entries(attendance).forEach(([key, value]) => {
      const label = this.normalizeAttendanceLabel(key);
      if (label) byDate.set(label, String(value));
    });

    return Array.from(byDate.entries())
      .map(([label, value]) => ({ label, value, parts: this.attendanceLabelDateParts(label) }))
      .filter(
        (item) =>
          !!item.parts &&
          item.parts.month === Number(this.givenMonth) &&
          item.parts.year === Number(this.givenYear)
      )
      .sort((a, b) => (a.parts?.day || 0) - (b.parts?.day || 0))
      .flatMap((item): PayrollDeductionDetail[] => {
        const display = this.presenceDayDisplay(item.label);
        if (item.value === 'A') {
          return [{ kind: 'absent', label: `Absent - ${display}`, amount: 3 }];
        }
        if (item.value === 'N') {
          return [{ kind: 'nothing', label: `Néant - ${display}`, amount: 3 }];
        }
        if (item.value === 'L') {
          return [{ kind: 'late', label: `Retard - ${display}`, amount: 1 }];
        }
        return [];
      });
  }

  private computePayrollWeeklyShortfallDeductions(
    employee: Employee
  ): WeeklyObjectiveDeduction[] {
    const owner = employee.tempUser || this.auth.currentUser;
    if (!owner) return [];

    const month = Number(this.givenMonth);
    const year = Number(this.givenYear);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastDay = new Date(year, month, 0);
    const deductions: WeeklyObjectiveDeduction[] = [];

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const end = new Date(year, month - 1, day);
      if (end.getDay() !== 0) continue;

      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      if (!this.payrollWeekIsReadyForDeduction(start, end, today)) continue;
      if (this.isSundayOnlyCarryoverWeek(start, end)) continue;

      const startKey = this.formatDateKey(start);
      const weeklyTargetFc = this.resolvePayrollWeeklyTargetFc(owner, startKey);
      const totalFc = this.computeWeeklyPaymentTotalForPayroll(owner, startKey);
      if (totalFc >= weeklyTargetFc) continue;

      const amount = this.compute.computeWeeklyObjectiveDeductionUsd(
        totalFc,
        weeklyTargetFc
      );
      if (amount <= 0) continue;

      deductions.push({
        start: this.formatIsoDate(start),
        end: this.formatIsoDate(end),
        amount,
      });
    }

    return deductions;
  }

  private payrollWeekIsReadyForDeduction(
    start: Date,
    end: Date,
    today: Date
  ): boolean {
    if (today > end) return true;
    if (today < start) return false;

    const saturday = new Date(end);
    saturday.setDate(end.getDate() - 1);
    saturday.setHours(0, 0, 0, 0);

    return today >= saturday;
  }

  private filterPayrollObjectiveDeductionsForSelectedMonth(
    deductions: WeeklyObjectiveDeduction[]
  ): WeeklyObjectiveDeduction[] {
    const month = Number(this.givenMonth);
    const year = Number(this.givenYear);
    return (deductions || [])
      .map((item) => this.normalizePayrollObjectiveDeduction(item))
      .filter((item) => {
        const end = this.parseIsoDate(item.end);
        return end.getMonth() + 1 === month && end.getFullYear() === year;
      });
  }

  private normalizePayrollObjectiveDeduction(
    deduction: WeeklyObjectiveDeduction
  ): WeeklyObjectiveDeduction {
    return {
      start: deduction?.start || '',
      end: deduction?.end || deduction?.start || '',
      amount: this.numberFrom(deduction?.amount),
    };
  }

  private formatPayrollObjectiveLabel(deduction: WeeklyObjectiveDeduction): string {
    const start = this.parseIsoDate(deduction.start);
    const end = this.parseIsoDate(deduction.end);
    if (start.getTime() === 0 || end.getTime() === 0) {
      return 'Objectif semaine';
    }
    return `Semaine ${this.formatWeekDate(start)} - ${this.formatWeekDate(end)}`;
  }

  private computeWeeklyPaymentTotalForPayroll(owner: User, dateKey: string): number {
    const { start, end } = this.getWeekBounds(dateKey);
    const payments = owner.dailyReimbursement || {};
    let total = 0;
    const cursor = new Date(start);

    while (cursor <= end) {
      const key = this.formatDateKey(cursor);
      const amount = Number((payments as any)[key] ?? 0);
      if (!Number.isNaN(amount)) {
        total += amount;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return total;
  }

  private resolvePayrollWeeklyTargetFc(owner: User, dateKey: string): number {
    const { start } = this.getWeekBounds(dateKey);
    return this.auth.resolveWeeklyPaymentTargetForDate(
      this.formatDateKey(start),
      owner
    );
  }

  private employeePaymentConfiguredForSelectedMonth(employee: Employee): boolean {
    return (
      (employee.paymentConfiguredMonthKey || '') ===
      `${this.givenYear}-${String(this.givenMonth).padStart(2, '0')}`
    );
  }

  private employeeUsesAttendanceOnlyPayroll(employee: Employee): boolean {
    const role = this.normalizeRole(employee.role);
    return (
      role.includes('auditr') ||
      role.includes('investig') ||
      role.includes('region')
    );
  }

  private attendanceLabelDateParts(
    label: string
  ): { month: number; day: number; year: number } | null {
    const [month, day, year] = label.split('-').map(Number);
    if (!month || !day || !year) return null;
    return { month, day, year };
  }

  private isSundayOnlyCarryoverWeek(start: Date, end: Date): boolean {
    return (
      start.getFullYear() !== end.getFullYear() ||
      start.getMonth() !== end.getMonth()
    )
      ? end.getDate() === 1
      : false;
  }

  private parseIsoDate(value: string): Date {
    const [year, month, day] = (value || '').split('-').map(Number);
    if (!year || !month || !day) return new Date(0);
    return new Date(year, month - 1, day);
  }

  private formatIsoDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private numberFrom(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  async copyMonthlyPaymentsRanking(): Promise<void> {
    if (
      !this.auth.isAdmin ||
      this.isCopyingMonthlyRanking ||
      !this.paidEmployeesMonth.length
    ) {
      return;
    }

    this.isCopyingMonthlyRanking = true;
    this.copyMonthlyRankingMessage = null;

    try {
      const monthName = this.time.monthFrenchNames[this.givenMonth - 1] ?? '';
      const lines: string[] = [
        `Classement Individiuel ${monthName} ${this.givenYear}`,
        '=============================================',
        '',
      ];

      this.paidEmployeesMonth.forEach((employee, index) => {
        lines.push(`${index + 1}. ${this.formatRankingEmployeeName(employee)}`);
      });

      await this.copyToClipboard(lines.join('\n'));
      this.copyMonthlyRankingMessage = 'Classement copié';
    } catch (error) {
      console.error('Failed to copy monthly payment ranking', error);
      this.copyMonthlyRankingMessage = 'Impossible de copier le classement.';
    } finally {
      this.isCopyingMonthlyRanking = false;
      if (this.copyMonthlyRankingMessage) {
        setTimeout(() => (this.copyMonthlyRankingMessage = null), 2200);
      }
    }
  }

  private formatRankingEmployeeName(employee?: Employee | null): string {
    if (!employee) return '';
    const parts = [employee.firstName, employee.lastName]
      .map((value) => (value || '').trim())
      .filter(Boolean);
    return parts.join(' ') || employee.middleName || 'Employé';
  }

  private buildClientTrophyRows(clients: Client[]): ClientTrophyRow[] {
    const unique = new Map<string, Client>();
    clients.forEach((client) => {
      const key = this.clientUniqueKey(client);
      if (!unique.has(key)) unique.set(key, client);
    });

    const rows = Array.from(unique.values())
      .map((client) => {
        const latestAward = this.latestClientTrophyAward(client);
        const stars = this.getStarsCount(client);
        return {
          client,
          name: this.formatClientName(client),
          initials: this.clientInitials(client),
          photoUrl: this.clientPhotoUrl(client),
          locationName: client.locationName || '',
          phoneNumber: this.formatClientPhone(client.phoneNumber),
          stars,
          trophyCount: Object.keys(client.trophyAwards || {}).length,
          latestAwardLabel: latestAward
            ? this.formatClientTrophyAwardDate(latestAward)
            : '',
          latestAwardAmount: latestAward?.amountUsd || '',
          creditScore: client.creditScore || '',
          debtLeft: this.safeNumber(client.debtLeft),
          loanAmount: this.safeNumber(client.loanAmount),
          colorClass: this.clientTrophyColorClass(stars),
          layoutStyle: {},
        };
      })
      .filter((row) => row.stars > 0)
      .sort(
        (a, b) =>
          b.stars - a.stars ||
          b.trophyCount - a.trophyCount ||
          a.name.localeCompare(b.name)
      );

    const rects = this.buildTrophyTreemapRects(
      rows.map((row) => Math.max(row.stars, 1))
    );
    return rows.map((row, index) => ({
      ...row,
      layoutStyle: this.trophyRectStyle(rects[index]),
    }));
  }

  private clientTrophyColorClass(stars: number): string {
    if (stars >= 5) return 'client-trophy-tile--legend';
    if (stars === 4) return 'client-trophy-tile--elite';
    if (stars === 3) return 'client-trophy-tile--strong';
    if (stars === 2) return 'client-trophy-tile--special';
    return 'client-trophy-tile--one';
  }

  private clientPhotoUrl(client?: Client | null): string {
    const picture = client?.profilePicture as
      | { downloadURL?: string }
      | string
      | undefined;
    if (!picture) return '';
    return typeof picture === 'string' ? picture : picture.downloadURL || '';
  }

  getStarsCount(client: Client | null | undefined): number {
    if (!client || client.stars === undefined || client.stars === null) return 0;
    const count = Number(client.stars);
    return Number.isFinite(count) && count > 0 ? count : 0;
  }

  private clientUniqueKey(client: Client): string {
    return (
      client.uid ||
      client.trackingId ||
      [
        client.locationOwnerId || '',
        client.firstName || '',
        client.lastName || '',
        client.phoneNumber || '',
      ].join('|')
    );
  }

  formatClientName(client?: Client | null): string {
    if (!client) return '';
    const parts = [client.firstName, client.lastName, client.middleName]
      .map((value) => (value || '').trim())
      .filter(Boolean);
    return parts.join(' ') || client.name || 'Client';
  }

  clientInitials(client?: Client | null): string {
    const first = (client?.firstName || client?.name || '').trim();
    const last = (client?.lastName || '').trim();
    const a = first ? first[0] : '';
    const b = last ? last[0] : '';
    return (a + b || 'C').toUpperCase();
  }

  formatClientPhone(raw?: string | null): string {
    if (!raw) return '—';
    const digits = `${raw}`.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return raw;
  }

  private latestClientTrophyAward(client: Client): any | null {
    const awards = Object.values(client.trophyAwards || {});
    if (!awards.length) return null;
    return awards.sort(
      (a: any, b: any) =>
        this.clientTrophyAwardSortValue(b) - this.clientTrophyAwardSortValue(a)
    )[0];
  }

  private clientTrophyAwardSortValue(award: any): number {
    const raw = award?.awardedOn || award?.createdAt || '';
    const parsed = raw ? new Date(raw) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
  }

  private formatClientTrophyAwardDate(award: any): string {
    const raw = award?.awardedOn || award?.createdAt || '';
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private safeNumber(value?: string | number | null): number {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private async copyToClipboard(text: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    if (typeof document === 'undefined') {
      throw new Error('Clipboard API not available');
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
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
    private data: DataService,
    private afs: AngularFirestore
  ) {}
  isFetchingClients = false;
  currentEmployees: any = [];
  currentClients: Client[] = [];
  total: string = '0';
  totalHouse: string = '0';
  allUsers: User[] = [];
  ngOnInit(): void {
    if (this.auth.isInvestigator) {
      this.rankingMode = 'performance';
    }
    this.updateWeekPickerLabels();
    this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      this.initializeBudgetTeamSelection();
      this.logDebug('Locations fetched', {
        count: this.allUsers?.length ?? 0,
        ids: this.allUsers?.map((u) => u.uid) ?? [],
      });
      if (!this.allUsers?.length) {
        this.logDebug(
          'No locations returned from Firestore; the ranking page will stay empty until data arrives.'
        );
      }
      // this is really weird. maybe some apsect of angular. but it works for now
      if (this.allUsers.length > 0) {
        this.getAllEmployees();
      } else {
        this.logDebug(
          'Still waiting for at least one location before fetching employees.'
        );
      }
    });
    this.logDebug('Initializing idea listener');
    this.listenToIdeaBox();
  }

  ngOnDestroy(): void {
    this.ideaSub?.unsubscribe();
    this.employeeCopySubs.forEach((sub) => sub.unsubscribe());
    this.employeeCopySubs = [];
    this.employeeMergeSubs.forEach((sub) => sub.unsubscribe());
    this.employeeMergeSubs = [];
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
  performanceFallbackActive = false;
  performanceFallbackReason = '';
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

    const owners =
      Array.isArray(this.allUsers) && this.allUsers.length > 0
        ? this.allUsers.filter((u) => !!u?.uid)
        : this.auth.currentUser
        ? [this.auth.currentUser as User]
        : [];

    if (
      Array.isArray(this.allUsers) &&
      this.allUsers.length > 0 &&
      owners.length < this.allUsers.length
    ) {
      this.logDebug('Certaines localisations ont été ignorées (UID manquant).', {
        totalLocations: this.allUsers.length,
        validLocations: owners.length,
      });
    }

    if (!owners.length) {
      this.logDebug(
        'Cannot fetch employees because no locations or fallback user are available yet.'
      );
      this.isFetchingClients = false;
      return;
    }

    if (!this.allUsers?.length) {
      this.logDebug(
        'No additional locations returned; falling back to current user only.'
      );
    }

    this.logDebug('Starting employee aggregation', {
      locationCount: owners.length,
    });

    let tempEmployees: Employee[] = [];
    this.allEmployees = [];
    let completedRequests = 0;
    const ownerCount = owners.length;

    // reset
    this.total = '0';
    this.totalSalary = '0';
    this.totalHouse = '0';
    this.totalBonus = '0';
    this.payrollRows = [];

    // 1) sum loyer
    owners.forEach((user) => {
      if (user?.housePayment) {
        this.totalHouse = (
          Number(this.totalHouse) + Number(user.housePayment)
        ).toString();
      }
    });

    // 2) fetch employees and sum salaries/bonus
    owners.forEach((user) => {
      this.currentClients = [];
      this.currentEmployees = [];
      this.logDebug('Requesting employees for location', {
        ownerUid: user?.uid,
        locationName: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
      });

      this.auth.getAllEmployeesGivenUser(user).subscribe((employees) => {
        if (!Array.isArray(employees) || !employees.length) {
          this.logDebug('No employees returned for location', {
            ownerUid: user?.uid,
          });
          completedRequests++;
          if (completedRequests === ownerCount) {
            this.afterEmployeesAggregated(tempEmployees);
          }
          return;
        }
        const employeeList: Employee[] = Array.isArray(employees)
          ? (employees as Employee[])
          : [];
        this.logDebug('Employees received for location', {
          ownerUid: user?.uid,
          count: employeeList.length,
        });
        this.mergeOwnerEmployees(user, employeeList, tempEmployees);
        completedRequests++;
        if (completedRequests === ownerCount) {
          this.afterEmployeesAggregated(tempEmployees);
        }
      });
    });
  }

  private resolvePaymentKind(rawKey: string): 'paiement' | 'bonus' {
    const lower = (rawKey || '').toLowerCase();
    if (lower.includes('bonus')) return 'bonus';
    if (lower.includes('paiement') || lower.includes('payment')) {
      return 'paiement';
    }
    return 'paiement';
  }

  private formatSignatureLabel(rawKey: string, parsedDate: Date): string {
    const parts = (rawKey || '').split('-');
    if (parts.length >= 6) {
      return this.time.convertTimeFormat(parts.slice(0, 6).join('-'));
    }
    return parsedDate.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private getSignatureTargetMonthYear(): { month: number; year: number } {
    const month = Number(this.givenMonth);
    const year = Number(this.givenYear);
    if (
      Number.isFinite(month) &&
      Number.isFinite(year) &&
      month >= 1 &&
      month <= 12 &&
      year >= 1900
    ) {
      return { month, year };
    }

    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }

  private getEffectiveSignatureMonthYear(
    date: Date,
    kind: 'paiement' | 'bonus'
  ): { month: number; year: number } {
    let month = date.getMonth() + 1;
    let year = date.getFullYear();

    // Edge case: payroll signed from day 1..5 counts toward previous month.
    if (kind === 'paiement' && date.getDate() >= 1 && date.getDate() <= 5) {
      month -= 1;
      if (month === 0) {
        month = 12;
        year -= 1;
      }
    }

    return { month, year };
  }

  private buildMonthlySignatureEntries(
    employee: Employee
  ): MonthlySignatureEntry[] {
    const payments = employee?.payments;
    if (!payments || typeof payments !== 'object') return [];

    const parsed = Object.keys(payments)
      .map((rawKey) => {
        const date = this.time.parseFlexibleDateTime(rawKey);
        if (Number.isNaN(date.getTime())) return null;
        return {
          rawKey,
          date,
          kind: this.resolvePaymentKind(rawKey),
        };
      })
      .filter(
        (
          entry
        ): entry is { rawKey: string; date: Date; kind: 'paiement' | 'bonus' } =>
          !!entry
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    const receipts = Array.isArray(employee?.receipts) ? employee.receipts : [];
    const total = parsed.length;

    return parsed.map((entry, sortedIndex) => {
      const receiptIndex = total - 1 - sortedIndex;
      const rawReceipt = receipts[receiptIndex];
      const receiptUrl =
        typeof rawReceipt === 'string' && rawReceipt.trim().length > 0
          ? rawReceipt.trim()
          : null;

      return {
        ...entry,
        receiptIndex,
        receiptUrl,
      };
    });
  }

  private getLatestSignatureThisMonth(
    employee: Employee,
    kind: 'paiement' | 'bonus'
  ): MonthlySignatureEntry | null {
    const target = this.getSignatureTargetMonthYear();
    let latest: MonthlySignatureEntry | null = null;
    const entries = this.buildMonthlySignatureEntries(employee);

    entries.forEach((entry) => {
      if (entry.kind !== kind) return;
      const effective = this.getEffectiveSignatureMonthYear(entry.date, kind);
      if (
        effective.month !== target.month ||
        effective.year !== target.year
      ) {
        return;
      }

      if (!latest || entry.date.getTime() > latest.date.getTime()) {
        latest = entry;
      }
    });

    return latest;
  }

  private decorateMonthlySignatureState(employee: Employee): void {
    const latestPayment = this.getLatestSignatureThisMonth(employee, 'paiement');
    const latestBonus = this.getLatestSignatureThisMonth(employee, 'bonus');
    const paymentPaid = !!latestPayment?.receiptUrl;
    const bonusPaid = !!latestBonus?.receiptUrl;

    employee.signedPaymentThisMonth = !!latestPayment;
    employee.signedBonusThisMonth = !!latestBonus;
    employee.paidPaymentThisMonth = paymentPaid;
    employee.paidBonusThisMonth = bonusPaid;
    employee.lastPaymentSignatureLabelThisMonth = latestPayment
      ? this.formatSignatureLabel(latestPayment.rawKey, latestPayment.date)
      : undefined;
    employee.lastBonusSignatureLabelThisMonth = latestBonus
      ? this.formatSignatureLabel(latestBonus.rawKey, latestBonus.date)
      : undefined;
    employee.lastPaymentPaidLabelThisMonth =
      latestPayment && paymentPaid
        ? this.formatSignatureLabel(latestPayment.rawKey, latestPayment.date)
        : undefined;
    employee.lastBonusPaidLabelThisMonth =
      latestBonus && bonusPaid
        ? this.formatSignatureLabel(latestBonus.rawKey, latestBonus.date)
        : undefined;

    // Keep legacy flag aligned with real payment state.
    employee.paidThisMonth = paymentPaid;
  }

  filterAndInitializeEmployees(
    allEmployees: Employee[],
    currentClients: Client[]
  ) {
    this.logDebug('filterAndInitializeEmployees()', {
      incoming: allEmployees?.length ?? 0,
    });
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
      if (!employee.uid) {
        this.logDebug('Employee without uid skipped during filtering', {
          name: `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim(),
        });
        return;
      }

      this.decorateMonthlySignatureState(employee);

      // If the employee isn't already in the Map, add them
      if (!uniqueEmployees.has(employee.uid!)) {
        uniqueEmployees.set(employee.uid!, employee);
      }
    });

    // Convert the Map values back to an array
    this.allEmployees = Array.from(uniqueEmployees.values()).filter(
      (emp) => !!emp?.uid
    );
    this.logDebug('Unique employees after dedupe', {
      uniqueCount: this.allEmployees.length,
    });

    // Filter employees who are currently "Travaille" (working) or "Transféré" (transferred)
    // Include both working and transferred employees for rotation schedule
    this.allEmployees = this.allEmployees.filter((data) => {
      const status = (data.status || '').toLowerCase().trim();
      return status === 'travaille' || status === 'transféré' || status === 'transfere';
    });
    this.logDebug('Employees after status filter', {
      activeCount: this.allEmployees.length,
    });

    this.sortEmployeesByPerformance();

    // Recalculate or update any relevant average performance
    this.calculateAveragePerformancePercentage();

    this.allLocations = Array.from(
      new Set(this.allEmployees!.map((e) => e.tempLocationHolder))
    );
    if (!this.allEmployees.length) {
      this.logDebug(
        'No employees left after filtering; the ranking list will be empty for now.'
      );
    }
  }

  // Add this method to calculate the average performance percentage
  calculateAveragePerformancePercentage() {
    if (!this.allEmployees || this.allEmployees.length === 0) {
      this.averagePerformancePercentage = '0';
      this.logDebug(
        'Average performance reset to 0 because there are no employees.'
      );
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
       this.logDebug(
        'Average performance reset to 0 because no employees have a positive percentage.'
      );
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
    this.logDebug('Average performance recalculated', {
      employeeCount: validEmployees.length,
      value: this.averagePerformancePercentage,
    });
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
  setRankingMode(
    mode:
      | 'performance'
      | 'dailyPayments'
      | 'weeklyPayments'
      | 'monthlyPayments'
      | 'trophyHistory'
  ) {
    if (this.rankingMode === mode) return;
    this.logDebug('Switching ranking mode', { from: this.rankingMode, to: mode });
    this.rankingMode = mode;

    if (mode === 'dailyPayments') {
      this.loadDailyTotalsForEmployees();
    } else if (mode === 'weeklyPayments') {
      this.loadWeeklyTotalsForEmployees();
    } else if (mode === 'monthlyPayments') {
      this.loadMonthlyTotalsForEmployees();
    } else if (mode === 'performance') {
      this.sortEmployeesByPerformance();
    } else if (
      mode === 'trophyHistory' &&
      (this.trophyHistoryScope === 'clients' || this.trophyHistoryScope === 'teams')
    ) {
      this.loadClientTrophyRows();
    }
  }

  setTrophyHistoryScope(scope: TrophyHistoryScope): void {
    if (this.trophyHistoryScope === scope) return;
    this.trophyHistoryScope = scope;
    if (scope === 'clients' || scope === 'teams') {
      this.loadClientTrophyRows();
    }
  }

  openClientTrophyModal(row: ClientTrophyRow): void {
    this.selectedClientTrophyRow = row;
  }

  closeClientTrophyModal(): void {
    this.selectedClientTrophyRow = null;
  }

  openClientTrophyTeamModal(row: ClientTrophyTeamRow): void {
    this.selectedClientTrophyTeamRow = row;
  }

  closeClientTrophyTeamModal(): void {
    this.selectedClientTrophyTeamRow = null;
  }

  private clientTrophyTeamColorClass(index: number): string {
    if (index === 0) return 'client-trophy-tile--legend';
    if (index === 1) return 'client-trophy-tile--elite';
    if (index === 2) return 'client-trophy-tile--strong';
    return 'client-trophy-tile--one';
  }

  private clientTrophyOwnerUsers(): User[] {
    const owners =
      Array.isArray(this.allUsers) && this.allUsers.length > 0
        ? this.allUsers.filter((user) => !!user?.uid)
        : this.auth.currentUser?.uid
        ? [this.auth.currentUser as User]
        : [];
    return owners;
  }

  private clientTrophyOwnerKey(): string {
    return this.clientTrophyOwnerUsers()
      .map((user) => user.uid || '')
      .sort()
      .join('|');
  }

  private async loadClientTrophyRows(): Promise<void> {
    const owners = this.clientTrophyOwnerUsers();
    const loadKey = this.clientTrophyOwnerKey();
    if (!owners.length) {
      this.clientTrophyRowsCache = [];
      this.clientTrophyTeamRowsCache = [];
      this.clientTrophyRowsCacheKey = '';
      this.clientTrophyLoaded = false;
      this.selectedClientTrophyRow = null;
      this.selectedClientTrophyTeamRow = null;
      this.clientTrophyError = 'Aucun site disponible pour charger les clients.';
      return;
    }
    if (this.clientTrophyLoaded && this.clientTrophyLoadKey === loadKey) return;
    if (this.clientTrophyLoading) return;

    this.clientTrophyLoading = true;
    this.clientTrophyError = '';
    try {
      const snapshots = await Promise.all(
        owners.map(async (owner) => {
          const snapshot = await firstValueFrom(
            this.afs
              .collection<Client>(`users/${owner.uid}/clients`, (ref) =>
                ref.where('stars', '>', '0')
              )
              .get()
          );
          return { owner, snapshot };
        })
      );

      const clients: Client[] = [];
      snapshots.forEach(({ owner, snapshot }) => {
        snapshot.docs.forEach((doc) => {
          const data = doc.data() as Client;
          clients.push({
            ...data,
            uid: data.uid || doc.id,
            locationName: data.locationName || owner.firstName || '',
            locationOwnerId: data.locationOwnerId || owner.uid,
          });
        });
      });

      const key = clients
        .map((client) =>
          [
            this.clientUniqueKey(client),
            client.stars || '',
            Object.keys(client.trophyAwards || {}).join(','),
          ].join(':')
        )
        .sort()
        .join('|');
      if (this.clientTrophyRowsCacheKey !== key) {
        this.clientTrophyRowsCache = this.buildClientTrophyRows(clients);
        this.clientTrophyTeamRowsCache = this.buildClientTrophyTeamRows(
          this.clientTrophyRowsCache
        );
        this.clientTrophyRowsCacheKey = key;
        if (this.selectedClientTrophyRow) {
          const selectedKey = this.clientUniqueKey(
            this.selectedClientTrophyRow.client
          );
          if (
            !this.clientTrophyRowsCache.some(
              (row) => this.clientUniqueKey(row.client) === selectedKey
            )
          ) {
            this.selectedClientTrophyRow = null;
          }
        }
        if (this.selectedClientTrophyTeamRow) {
          const selectedTeam = this.selectedClientTrophyTeamRow.teamName;
          this.selectedClientTrophyTeamRow =
            this.clientTrophyTeamRowsCache.find(
              (row) => row.teamName === selectedTeam
            ) || null;
        }
      }
      this.clientTrophyLoadKey = loadKey;
      this.clientTrophyLoaded = true;
    } catch (error) {
      console.error('Failed to load starred clients', error);
      this.clientTrophyError = 'Impossible de charger les clients étoilés.';
    } finally {
      this.clientTrophyLoading = false;
    }
  }

  private async loadDailyTotalsForEmployees() {
    if (!this.allEmployees?.length) {
      this.logDebug(
        'loadDailyTotalsForEmployees() skipped because no active employees are available.'
      );
      return; // visible list = actives
    }
    this.logDebug('loadDailyTotalsForEmployees() triggered', {
      activeCount: this.allEmployees.length,
      allKnownCount: this.allEmployeesAll?.length ?? 0,
      dayKey: this.todayDayKey,
    });
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
      this.logDebug('Daily totals fetched', {
        employees: totalsById.size,
      });

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
        const recipient = this.resolveRecipientForTotals(donor, ownerUid);
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
      this.logDebug('Daily totals computed', {
        paidCount: this.paidEmployeesToday.length,
      });
    } catch (error) {
      console.error('Failed to load daily totals', error);
      this.paidEmployeesToday = [];
    } finally {
      this.loadingDaily = false;
    }
  }

  private updateWeekPickerLabels(): void {
    const baseIsoDate =
      this.selectedWeekStartDate || this.time.getTodaysDateYearMonthDay();
    const dateKey = this.time.convertDateToMonthDayYear(baseIsoDate);
    const { start, end } = this.getWeekBounds(dateKey);
    this.weekPickerStartLabel = this.formatWeekDate(start);
    this.weekPickerEndLabel = this.formatWeekDate(end);
    this.weekPickerRangeLabel = `${this.weekPickerStartLabel} - ${this.weekPickerEndLabel}`;
  }

  private weekKeysForDate(dateKey: string): string[] {
    const { start, end } = this.getWeekBounds(dateKey);
    const keys: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      keys.push(this.formatDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
  }

  private getWeekBounds(dateKey: string): { start: Date; end: Date } {
    const dateObj = this.time.toDate(dateKey);
    const dayIndex = dateObj.getDay();
    const daysSinceMonday = (dayIndex + 6) % 7;
    const start = new Date(dateObj);
    start.setDate(dateObj.getDate() - daysSinceMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(0, 0, 0, 0);

    return { start, end };
  }

  private formatWeekDate(date: Date): string {
    const days = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];
    const months = [
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
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    return `${dayName} ${date.getDate()} ${monthName} ${date.getFullYear()}`;
  }

  private formatDateKey(date: Date): string {
    return `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;
  }

  private async loadWeeklyTotalsForEmployees() {
    if (!this.allEmployees?.length) {
      this.logDebug(
        'loadWeeklyTotalsForEmployees() skipped because no active employees are available.'
      );
      return;
    }
    this.updateWeekPickerLabels();
    const dateKey = this.time.convertDateToMonthDayYear(
      this.selectedWeekStartDate || this.time.getTodaysDateYearMonthDay()
    );
    const weekKeys = this.weekKeysForDate(dateKey);
    this.logDebug('loadWeeklyTotalsForEmployees() triggered', {
      activeCount: this.allEmployees.length,
      allKnownCount: this.allEmployeesAll?.length ?? 0,
      weekKeys,
    });
    this.loadingWeekly = true;

    try {
      const everyone = (
        this.allEmployeesAll?.length ? this.allEmployeesAll : this.allEmployees
      ) as any[];

      const weekTotalsById = new Map<
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
            weekKeys.map(async (k) => {
              const { total, count } =
                await this.data.getEmployeeDayTotalsForDay(ownerUid, e.uid, k);
              sumTotal += Number(total || 0);
              sumCount += Number(count || 0);
            })
          );

          weekTotalsById.set(e.uid, {
            total: sumTotal,
            count: sumCount,
            ownerUid,
            status: e.status || 'Travaille',
          });
        })
      );
      this.logDebug('Weekly totals fetched', {
        employees: weekTotalsById.size,
        daysCount: weekKeys.length,
      });

      const adjusted = new Map<string, { total: number; count: number }>();
      for (const e of this.allEmployees) {
        const base = weekTotalsById.get(e.uid!) || {
          total: 0,
          count: 0,
          ownerUid: e?.tempUser?.uid,
          status: e.status,
        };
        adjusted.set(e.uid!, { total: base.total, count: base.count });
      }

      for (const donor of everyone) {
        const meta = weekTotalsById.get(donor.uid!);
        if (!meta) continue;

        const isInactive = (donor.status || '') !== 'Travaille';
        if (!isInactive) continue;

        const recipient = this.resolveRecipientForTotals(donor, meta.ownerUid);
        if (!recipient) continue;

        const rec = adjusted.get(recipient.uid!) || { total: 0, count: 0 };
        rec.total += meta.total;
        rec.count += meta.count;
        adjusted.set(recipient.uid!, rec);
      }

      this.allEmployees.forEach((e: any) => {
        const a = adjusted.get(e.uid!) || { total: 0, count: 0 };
        e._weekTotal = a.total;
        e._weekCount = a.count;
        const usd = this.compute.convertCongoleseFrancToUsDollars(
          String(a.total ?? 0)
        );
        e._weekTotalUsd = usd === '' ? 0 : usd;
      });

      this.allEmployees.sort((a: any, b: any) => {
        const ta = Number(a._weekTotal || 0),
          tb = Number(b._weekTotal || 0);
        if (tb !== ta) return tb - ta;
        const ca = Number(a._weekCount || 0),
          cb = Number(b._weekCount || 0);
        if (cb !== ca) return cb - ca;
        const an = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();
        const bn = `${b.firstName ?? ''} ${b.lastName ?? ''}`.trim();
        return an.localeCompare(bn);
      });

      this.paidEmployeesWeek = this.allEmployees.filter(
        (e: any) => Number(e._weekTotal || 0) > 0
      );
      this.logDebug('Weekly totals computed', {
        paidCount: this.paidEmployeesWeek.length,
      });
    } catch (error) {
      console.error('Failed to load weekly totals', error);
      this.paidEmployeesWeek = [];
    } finally {
      this.loadingWeekly = false;
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
      this.performanceFallbackActive = false;
      this.performanceFallbackReason = '';
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
    this.performanceFallbackActive = false;
    this.performanceFallbackReason = '';

    for (const employee of this.allEmployees) {
      const v = parseFloat(employee.performancePercentageMonth ?? '0');
      if (!isNaN(v) && v > 0) valid.push(employee);
      else excluded.push(employee);
    }

    this.excludedEmployees = excluded;

    // If admin enabled the toggle, merge excluded back into the displayed list
    if (this.auth?.isAdmin && this.showExcludedForAdmin) {
      this.performanceEmployees = [...valid, ...excluded];
      if (!valid.length && excluded.length) {
        this.performanceFallbackActive = true;
        this.performanceFallbackReason =
          'Tous les employés ont 0% ou des données manquantes — affichage complet forcé (admin).';
        this.logDebug('Performance fallback (admin toggle)', {
          excludedCount: excluded.length,
        });
      }
    } else {
      if (valid.length) {
        this.performanceEmployees = valid;
      } else if (excluded.length) {
        this.performanceEmployees = excluded;
        this.performanceFallbackActive = true;
        this.performanceFallbackReason =
          "Aucun pourcentage n'a pu être calculé pour ce mois. Tous les employés sont affichés avec des valeurs brutes.";
        this.logDebug('Performance fallback triggered', {
          reason: 'No valid percentages',
          excludedCount: excluded.length,
        });
      } else {
        this.performanceEmployees = [];
      }
    }

    if (!this.performanceEmployees.length) {
      this.logDebug(
        "Aucun employé disponible après tri — vérifier les permissions ou l'état des données."
      );
    } else {
      this.logDebug('Performance list ready', {
        displayed: this.performanceEmployees.length,
        fallback: this.performanceFallbackActive,
      });
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

  private normalizePhone(value?: string | null): string {
    return String(value || '').replace(/\D/g, '');
  }

  private normalizeEmployeeName(employee?: Employee | null): string {
    return [employee?.firstName, employee?.middleName, employee?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim()
      .toLowerCase();
  }

  private isSameEmployeeIdentity(
    first?: Employee | null,
    second?: Employee | null
  ): boolean {
    if (!first || !second) return false;

    const firstPaymentCode = String(first.paymentCode || '').trim();
    const secondPaymentCode = String(second.paymentCode || '').trim();
    if (
      firstPaymentCode &&
      secondPaymentCode &&
      firstPaymentCode === secondPaymentCode
    ) {
      return true;
    }

    const firstPhone = this.normalizePhone(first.phoneNumber);
    const secondPhone = this.normalizePhone(second.phoneNumber);
    if (firstPhone && secondPhone && firstPhone === secondPhone) {
      return true;
    }

    const firstName = this.normalizeEmployeeName(first);
    const secondName = this.normalizeEmployeeName(second);
    return !!firstName && !!secondName && firstName === secondName;
  }

  private findRotationRecipientForTotals(
    donor: Employee,
    ownerUid: string
  ): Employee | undefined {
    return this.allEmployees.find((candidate: any) => {
      if (!candidate?.uid || candidate.uid === donor?.uid) {
        return false;
      }

      const candidateOwnerUid =
        candidate?.tempUser?.uid || this.auth.currentUser.uid;
      if (candidateOwnerUid === ownerUid) {
        return false;
      }

      const candidateStatus = String(candidate.status || '')
        .trim()
        .toLowerCase();
      const candidateEligible =
        candidateStatus === 'travaille' ||
        candidateStatus === 'transféré' ||
        candidateStatus === 'transfere';
      if (!candidateEligible) {
        return false;
      }

      if (!candidate.isRotation || candidate.rotationSourceLocationId !== ownerUid) {
        return false;
      }

      return this.isSameEmployeeIdentity(donor, candidate);
    });
  }

  private resolveRecipientForTotals(
    donor: Employee,
    ownerUid: string
  ): Employee | undefined {
    return (
      this.findRotationRecipientForTotals(donor, ownerUid) ||
      this.findRecipientForTotals(ownerUid)
    );
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
    if (!this.allEmployees?.length) {
      this.logDebug(
        'loadMonthlyTotalsForEmployees() skipped because no active employees are available.'
      );
      return;
    }
    this.logDebug('loadMonthlyTotalsForEmployees() triggered', {
      activeCount: this.allEmployees.length,
      allKnownCount: this.allEmployeesAll?.length ?? 0,
      month: this.givenMonth,
      year: this.givenYear,
    });
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
      this.logDebug('Monthly totals fetched', {
        employees: monthTotalsById.size,
        daysCount: monthKeys.length,
      });

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

        const recipient = this.resolveRecipientForTotals(donor, meta.ownerUid);
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
      this.logDebug('Monthly totals computed', {
        paidCount: this.paidEmployeesMonth.length,
      });
    } catch (error) {
      console.error('Failed to load monthly totals', error);
      this.paidEmployeesMonth = [];
    } finally {
      this.loadingMonthly = false;
    }
  }

  /**
   * Check if employee has best team trophies
   */
  hasBestTeamTrophy(employee: Employee): boolean {
    return !!(employee.bestTeamTrophies && employee.bestTeamTrophies.length > 0);
  }

  /**
   * Check if employee has best employee trophies
   */
  hasBestEmployeeTrophy(employee: Employee): boolean {
    return !!(employee.bestEmployeeTrophies && employee.bestEmployeeTrophies.length > 0);
  }

  /**
   * Get formatted trophy date string
   */
  getTrophyDate(trophy: Trophy): string {
    if (!trophy || !trophy.month || !trophy.year) return '';
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const monthIndex = parseInt(trophy.month, 10) - 1;
    const monthName = monthIndex >= 0 && monthIndex < 12 ? monthNames[monthIndex] : trophy.month;
    return `${monthName} ${trophy.year}`;
  }

  /**
   * Get all team trophies for an employee
   */
  getTeamTrophies(employee: Employee): Trophy[] {
    return employee.bestTeamTrophies || [];
  }

  /**
   * Get all employee trophies for an employee
   */
  getEmployeeTrophies(employee: Employee): Trophy[] {
    return employee.bestEmployeeTrophies || [];
  }

  /**
   * Open trophy modal
   */
  openTrophyModal(employee: Employee, type: TrophyModalType): void {
    this.trophyModalEmployee = employee;
    this.trophyModalType = type;
    this.trophyModalVisible = true;
  }

  /**
   * Close trophy modal
   */
  closeTrophyModal(): void {
    this.trophyModalVisible = false;
    this.trophyModalType = null;
    this.trophyModalEmployee = null;
  }

  openEmployeeModal(employee: Employee): void {
    this.employeeModalEmployee = employee;
    this.employeeModalVisible = true;
  }

  closeEmployeeModal(): void {
    this.employeeModalVisible = false;
    this.employeeModalEmployee = null;
  }

  employeeInitials(employee?: Employee | null): string {
    const first = (employee?.firstName || '').trim();
    const last = (employee?.lastName || '').trim();
    const a = first ? first[0] : '';
    const b = last ? last[0] : '';
    return (a + b || '•').toUpperCase();
  }

  /**
   * Get trophies for modal display
   */
  getModalTrophies(): Trophy[] {
    if (!this.trophyModalType || !this.trophyModalEmployee) return [];
    return this.getModalTrophyEntries().map((entry) => entry.trophy);
  }

  get modalTotalTrophyCount(): number {
    return this.modalTeamTrophyCount + this.modalEmployeeTrophyCount;
  }

  get modalTeamTrophyCount(): number {
    return this.trophyModalEmployee?.bestTeamTrophies?.length || 0;
  }

  get modalEmployeeTrophyCount(): number {
    return this.trophyModalEmployee?.bestEmployeeTrophies?.length || 0;
  }

  get selectedTrophyModalEmployeeName(): string {
    return this.formatRankingEmployeeName(this.trophyModalEmployee);
  }

  getModalTrophyEntries(): TrophyModalEntry[] {
    if (!this.trophyModalType || !this.trophyModalEmployee) return [];

    const teamEntries = (this.trophyModalEmployee.bestTeamTrophies || []).map(
      (trophy) => ({ trophy, type: 'team' as const })
    );
    const employeeEntries = (
      this.trophyModalEmployee.bestEmployeeTrophies || []
    ).map((trophy) => ({ trophy, type: 'employee' as const }));

    const entries =
      this.trophyModalType === 'team'
        ? teamEntries
        : this.trophyModalType === 'employee'
        ? employeeEntries
        : [...teamEntries, ...employeeEntries];

    return entries.sort(
      (a, b) => this.trophySortValue(b.trophy) - this.trophySortValue(a.trophy)
    );
  }

  /**
   * Get modal title
   */
  getModalTitle(): string {
    if (!this.trophyModalType) return '';
    if (this.trophyModalType === 'all') return 'Historique des trophées';
    return this.trophyModalType === 'team'
      ? 'Trophées Meilleure Équipe'
      : 'Trophées Meilleur Employé';
  }

  getTrophyEntryLabel(type: Exclude<TrophyModalType, 'all'>): string {
    return type === 'team' ? 'Meilleure Équipe' : 'Meilleur Employé';
  }

  getTrophyEntryClasses(type: Exclude<TrophyModalType, 'all'>): string {
    return type === 'team'
      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
      : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20';
  }

  getTrophyEntryBadgeClasses(type: Exclude<TrophyModalType, 'all'>): string {
    return type === 'team'
      ? 'bg-gradient-to-br from-emerald-500 to-teal-700'
      : 'bg-gradient-to-br from-amber-400 to-yellow-600';
  }

  private trophyHeatmapSourceEmployees(): Employee[] {
    const source = this.allEmployeesAll?.length
      ? this.allEmployeesAll
      : this.allEmployees || [];
    const seen = new Set<string>();
    return source.filter((employee) => {
      if (!this.isTrophyHeatmapWorkingEmployee(employee)) return false;
      const key =
        employee.uid ||
        `${employee.firstName || ''}|${employee.lastName || ''}|${
          employee.trackingId || ''
        }`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private isTrophyHeatmapWorkingEmployee(employee: Employee): boolean {
    return (employee?.status || '').toLowerCase().trim() === 'travaille';
  }

  employeePhotoUrl(employee?: Employee | null): string {
    return employee?.profilePicture?.downloadURL || '';
  }

  private buildTrophyHeatmapTiles(employees: Employee[]): TrophyHeatmapTile[] {
    const tiles = employees
      .map((employee) => {
        const teamCount = employee.bestTeamTrophies?.length || 0;
        const employeeCount = employee.bestEmployeeTrophies?.length || 0;
        const total = teamCount + employeeCount;
        const latest = this.latestTrophyEntry(employee);
        return {
          employee,
          name: this.formatRankingEmployeeName(employee),
          initials: this.employeeInitials(employee),
          photoUrl: this.employeePhotoUrl(employee),
          total,
          teamCount,
          employeeCount,
          latestLabel: latest ? this.getTrophyDate(latest.trophy) : '',
          latestTypeLabel: latest ? this.getTrophyEntryLabel(latest.type) : '',
          colorClass: this.trophyHeatmapColorClass(teamCount, employeeCount, total),
          layoutStyle: {},
        };
      })
      .filter((tile) => tile.total > 0)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    const rects = this.buildTrophyTreemapRects(
      tiles.map((tile) => tile.total)
    );
    return tiles.map((tile, index) => ({
      ...tile,
      layoutStyle: this.trophyRectStyle(rects[index]),
    }));
  }

  private trophyHeatmapColorClass(
    teamCount: number,
    employeeCount: number,
    total: number
  ): string {
    if (total >= 10) return 'trophy-tile--elite';
    if (employeeCount > teamCount) return 'trophy-tile--employee';
    if (teamCount > employeeCount) return 'trophy-tile--team';
    return 'trophy-tile--balanced';
  }

  private latestTrophyEntry(employee: Employee): TrophyModalEntry | null {
    const entries: TrophyModalEntry[] = [
      ...(employee.bestTeamTrophies || []).map((trophy) => ({
        trophy,
        type: 'team' as const,
      })),
      ...(employee.bestEmployeeTrophies || []).map((trophy) => ({
        trophy,
        type: 'employee' as const,
      })),
    ];
    if (!entries.length) return null;
    return entries.sort(
      (a, b) => this.trophySortValue(b.trophy) - this.trophySortValue(a.trophy)
    )[0];
  }

  private trophyListSignature(trophies?: Trophy[]): string {
    return (trophies || [])
      .map((trophy) => `${trophy.month || ''}-${trophy.year || ''}`)
      .sort()
      .join(',');
  }

  private buildTrophyTreemapRects(weights: number[]): TrophyHeatmapRect[] {
    const rects: TrophyHeatmapRect[] = weights.map(() => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }));
    const items = weights.map((weight, index) => ({
      index,
      weight: Math.max(weight, 1),
    }));

    this.partitionTrophyTreemap(items, { x: 0, y: 0, width: 100, height: 100 }, rects);
    return rects;
  }

  private partitionTrophyTreemap(
    items: Array<{ index: number; weight: number }>,
    rect: TrophyHeatmapRect,
    output: TrophyHeatmapRect[]
  ): void {
    if (!items.length) return;
    if (items.length === 1) {
      output[items[0].index] = rect;
      return;
    }

    const total = items.reduce((sum, item) => sum + item.weight, 0);
    const target = total / 2;
    let splitIndex = 1;
    let running = items[0].weight;

    for (let index = 1; index < items.length - 1; index++) {
      const next = running + items[index].weight;
      if (Math.abs(target - next) > Math.abs(target - running)) break;
      running = next;
      splitIndex = index + 1;
    }

    const first = items.slice(0, splitIndex);
    const second = items.slice(splitIndex);
    const firstWeight = first.reduce((sum, item) => sum + item.weight, 0);
    const ratio = total > 0 ? firstWeight / total : 0.5;

    if (rect.width >= rect.height) {
      const firstWidth = rect.width * ratio;
      this.partitionTrophyTreemap(
        first,
        { ...rect, width: firstWidth },
        output
      );
      this.partitionTrophyTreemap(
        second,
        {
          x: rect.x + firstWidth,
          y: rect.y,
          width: rect.width - firstWidth,
          height: rect.height,
        },
        output
      );
    } else {
      const firstHeight = rect.height * ratio;
      this.partitionTrophyTreemap(
        first,
        { ...rect, height: firstHeight },
        output
      );
      this.partitionTrophyTreemap(
        second,
        {
          x: rect.x,
          y: rect.y + firstHeight,
          width: rect.width,
          height: rect.height - firstHeight,
        },
        output
      );
    }
  }

  private trophyRectStyle(rect: TrophyHeatmapRect): Record<string, string> {
    return {
      left: `${rect.x}%`,
      top: `${rect.y}%`,
      width: `${rect.width}%`,
      height: `${rect.height}%`,
    };
  }

  private trophySortValue(trophy: Trophy): number {
    const year = Number(trophy?.year || 0);
    const month = Number(trophy?.month || 0);
    return year * 100 + month;
  }

  /** ---------- Employee Management Section ---------- */
  toggleEmployeeManagementSection(): void {
    this.showEmployeeManagementSection = !this.showEmployeeManagementSection;
  }

  private initializeGlobalFoundationRuleDefaults(employees: Employee[]): void {
    if (this.globalFoundationRuleInitialized) {
      return;
    }

    const currentUser = this.auth.currentUser || {};
    const source =
      this.hasCompleteFoundationRule(currentUser) &&
      Number.isFinite(Number(currentUser.foundationAttendanceRequiredDays))
        ? currentUser
        : employees.find((employee) => this.hasCompleteFoundationRule(employee));

    if (source) {
      this.globalFoundationRuleRequiredDays = Number(
        (source as any).foundationAttendanceRequiredDays
      );
      this.globalFoundationRuleStartMonth = Number(
        (source as any).foundationAttendanceRuleStartMonth
      );
      this.globalFoundationRuleStartYear = Number(
        (source as any).foundationAttendanceRuleStartYear
      );
    } else {
      this.globalFoundationRuleRequiredDays = 20;
      this.globalFoundationRuleStartMonth = this.currentMonth;
      this.globalFoundationRuleStartYear = this.year;
    }

    this.globalFoundationRuleInitialized = true;
  }

  private hasCompleteFoundationRule(source: any): boolean {
    const requiredDays = Number(source?.foundationAttendanceRequiredDays);
    const month = Number(source?.foundationAttendanceRuleStartMonth);
    const year = Number(source?.foundationAttendanceRuleStartYear);
    return (
      Number.isInteger(requiredDays) &&
      requiredDays >= 1 &&
      requiredDays <= 31 &&
      Number.isInteger(month) &&
      month >= 1 &&
      month <= 12 &&
      Number.isInteger(year) &&
      year >= 2000 &&
      year <= 2100
    );
  }

  get globalFoundationRuleYearOptions(): number[] {
    const years = new Set<number>([
      this.year - 1,
      this.year,
      this.year + 1,
      this.year + 2,
      ...this.yearsList,
    ]);

    const selectedYear = Number(this.globalFoundationRuleStartYear);
    if (Number.isInteger(selectedYear)) {
      years.add(selectedYear);
    }

    return Array.from(years)
      .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100)
      .sort((a, b) => b - a);
  }

  get globalFoundationRuleStartLabel(): string {
    const month = Number(this.globalFoundationRuleStartMonth);
    const year = Number(this.globalFoundationRuleStartYear);
    if (
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100
    ) {
      return 'Non configuré';
    }

    return `${this.time.monthFrenchNames?.[month - 1] || `Mois ${month}`} ${year}`;
  }

  get globalFoundationRuleEmployeeCount(): number {
    return this.uniqueFoundationRuleTargets().length;
  }

  get sortedBudgetTeams(): User[] {
    return [...(this.allUsers || [])].sort((a, b) =>
      this.getBudgetTeamLabel(a).localeCompare(this.getBudgetTeamLabel(b))
    );
  }

  get selectedBudgetTeam(): User | undefined {
    return (this.allUsers || []).find(
      (user) => user.uid === this.selectedBudgetTeamId
    );
  }

  get selectedBudgetAmount(): number {
    return this.getBudgetAmount(this.selectedBudgetTeam);
  }

  get averageBudgetManagerPerformance(): number {
    const performances = this.sortedBudgetTeams
      .map((team) => this.getTeamManagerPerformance(team))
      .filter((value) => value > 0);
    if (!performances.length) return 0;
    const total = performances.reduce((sum, value) => sum + value, 0);
    return this.compute.roundNumber(total / performances.length);
  }

  get totalBudgetAmount(): number {
    return this.sortedBudgetTeams.reduce(
      (sum, team) => sum + this.getBudgetAmount(team),
      0
    );
  }

  get totalProjectedBudgetAmount(): number {
    return this.sortedBudgetTeams.reduce(
      (sum, team) => sum + this.getProjectedBudgetAmount(team),
      0
    );
  }

  get totalRecommendedBudgetAmount(): number {
    return this.sortedBudgetTeams.reduce(
      (sum, team) => sum + this.getRecommendedBudgetAmount(team),
      0
    );
  }

  get budgetFormulaTeamsToUpdateCount(): number {
    return this.getBudgetFormulaUpdates().length;
  }

  get budgetFormulaTeamsSkippedCount(): number {
    return this.sortedBudgetTeams.length - this.budgetFormulaTeamsToUpdateCount;
  }

  toggleBudgetSection(): void {
    this.budgetSectionOpen = !this.budgetSectionOpen;
    if (this.budgetSectionOpen) {
      this.budgetViewMode = 'all';
    }
  }

  private initializeBudgetTeamSelection(): void {
    if (!this.allUsers?.length) {
      this.selectedBudgetTeamId = '';
      return;
    }

    const selectedStillExists = this.allUsers.some(
      (user) => user.uid === this.selectedBudgetTeamId
    );
    if (selectedStillExists) {
      return;
    }

    const currentUserId = this.auth.currentUser?.uid;
    const currentTeam = this.allUsers.find((user) => user.uid === currentUserId);
    this.selectedBudgetTeamId = currentTeam?.uid || this.allUsers[0]?.uid || '';
  }

  setBudgetViewMode(mode: 'selected' | 'all'): void {
    this.budgetViewMode = mode;
    this.selectedBudgetMessage = '';
    if (mode === 'selected') {
      this.initializeBudgetTeamSelection();
    }
  }

  onBudgetTeamChange(): void {
    this.selectedBudgetMessage = '';
    this.selectedBudgetInput = '';
  }

  selectBudgetTeam(userId?: string): void {
    if (!userId) return;
    this.selectedBudgetTeamId = userId;
    this.budgetViewMode = 'selected';
    this.onBudgetTeamChange();
  }

  getBudgetTeamLabel(user?: User): string {
    if (!user) return 'Equipe inconnue';
    return (
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.email ||
      user.uid ||
      'Equipe inconnue'
    );
  }

  getBudgetAmount(user?: User): number {
    const value = Number(user?.monthBudget);
    return Number.isFinite(value) ? value : 0;
  }

  getTeamManager(team?: User): Employee | undefined {
    if (!team?.uid) return undefined;

    const managers = (this.allEmployeesAll || []).filter((employee) => {
      const ownerUid = employee?.tempUser?.uid || this.auth.currentUser?.uid;
      return (
        ownerUid === team.uid &&
        this.normalizeRole(employee?.role).includes('manager')
      );
    });

    const activeManager = managers.find((employee) => {
      const status = this.normalizeRole(employee?.status);
      return (
        status === 'travaille' ||
        status === 'transféré' ||
        status === 'transfere'
      );
    });

    return activeManager || managers[0];
  }

  getTeamManagerName(team?: User): string {
    const manager = this.getTeamManager(team);
    const name = [manager?.firstName, manager?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return name || 'Manager non trouvé';
  }

  getTeamManagerPerformance(team?: User): number {
    const manager = this.getTeamManager(team);
    const value = Number(manager?.performancePercentageMonth);
    return Number.isFinite(value) ? value : 0;
  }

  getProjectedBudgetAmount(team?: User): number {
    return this.getTeamManagerPerformance(team) * 100000;
  }

  getRecommendedBudgetAmount(team?: User): number {
    const projected = this.getProjectedBudgetAmount(team);
    if (this.budgetFormulaOverrideHigherBudgets) {
      return projected;
    }
    return Math.max(this.getBudgetAmount(team), projected);
  }

  getBudgetFormulaStatus(team?: User): string {
    const current = this.getBudgetAmount(team);
    const projected = this.getProjectedBudgetAmount(team);
    if (this.budgetFormulaOverrideHigherBudgets) {
      return current === projected ? 'Déjà aligné' : 'Sera remplacé';
    }
    if (current > projected) return 'Conservé';
    if (current === projected) return 'Déjà aligné';
    return 'À augmenter';
  }

  getBudgetFormulaStatusClass(team?: User): string {
    const status = this.getBudgetFormulaStatus(team);
    if (status === 'À augmenter' || status === 'Sera remplacé') {
      return 'text-emerald-700 dark:text-emerald-300';
    }
    if (status === 'Conservé') {
      return 'text-amber-700 dark:text-amber-300';
    }
    return 'text-slate-500 dark:text-slate-400';
  }

  getTeamManagerPerformanceClass(team?: User): string {
    const value = this.getTeamManagerPerformance(team);
    if (value >= 80) {
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
    }
    if (value >= 50) {
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    }
    if (value > 0) {
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
    }
    return 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400';
  }

  trackBudgetTeamByUid(_index: number, team: User): string {
    return team.uid || `${team.email || 'team'}-${_index}`;
  }

  private getBudgetFormulaUpdates(): Array<{ userId: string; budget: number }> {
    return this.sortedBudgetTeams
      .map((team) => {
        const userId = team.uid || '';
        const projected = this.getProjectedBudgetAmount(team);
        const current = this.getBudgetAmount(team);
        const nextBudget = this.budgetFormulaOverrideHigherBudgets
          ? projected
          : Math.max(current, projected);
        return { userId, budget: nextBudget, current };
      })
      .filter(
        (item) =>
          !!item.userId &&
          Number.isFinite(item.budget) &&
          item.budget !== item.current
      )
      .map(({ userId, budget }) => ({ userId, budget }));
  }

  async applyBudgetFormulaToTeams(): Promise<void> {
    if (this.budgetFormulaSaving) return;

    const updates = this.getBudgetFormulaUpdates();
    if (!updates.length) {
      this.budgetFormulaMessage = 'Aucun budget à modifier.';
      return;
    }

    const confirmed = confirm(
      `Appliquer la formule Performance manager x 100 000 à ${updates.length} équipe${
        updates.length > 1 ? 's' : ''
      } ?`
    );
    if (!confirmed) return;

    this.budgetFormulaSaving = true;
    this.budgetFormulaMessage = '';
    try {
      await Promise.all(
        updates.map((update) =>
          this.auth.updateUserFieldForUserId(
            update.userId,
            'monthBudget',
            update.budget.toString()
          )
        )
      );

      const budgetByUserId = new Map(
        updates.map((update) => [update.userId, update.budget.toString()])
      );
      this.allUsers = this.allUsers.map((user) =>
        user.uid && budgetByUserId.has(user.uid)
          ? { ...user, monthBudget: budgetByUserId.get(user.uid) }
          : user
      );

      if (
        this.auth.currentUser?.uid &&
        budgetByUserId.has(this.auth.currentUser.uid)
      ) {
        this.auth.currentUser = {
          ...(this.auth.currentUser || {}),
          monthBudget: budgetByUserId.get(this.auth.currentUser.uid),
        };
      }

      this.budgetFormulaMessage = `Formule appliquée à ${updates.length} équipe${
        updates.length > 1 ? 's' : ''
      }.`;
    } catch (error) {
      console.error("Erreur lors de l'application de la formule budget", error);
      this.budgetFormulaMessage =
        "Impossible d'appliquer la formule à toutes les équipes.";
    } finally {
      this.budgetFormulaSaving = false;
    }
  }

  async saveSelectedTeamBudget(): Promise<void> {
    if (this.selectedBudgetSaving) return;
    if (!this.selectedBudgetTeamId) {
      alert('Choisissez une équipe.');
      return;
    }

    const value = Number(this.selectedBudgetInput);
    if (!Number.isFinite(value) || value < 0) {
      alert('Entrez un budget valide.');
      return;
    }

    const payload = value.toString();
    this.selectedBudgetSaving = true;
    this.selectedBudgetMessage = '';
    try {
      await this.auth.updateUserFieldForUserId(
        this.selectedBudgetTeamId,
        'monthBudget',
        payload
      );
      this.allUsers = this.allUsers.map((user) =>
        user.uid === this.selectedBudgetTeamId
          ? { ...user, monthBudget: payload }
          : user
      );
      if (this.auth.currentUser?.uid === this.selectedBudgetTeamId) {
        this.auth.currentUser = {
          ...(this.auth.currentUser || {}),
          monthBudget: payload,
        };
      }
      this.selectedBudgetInput = '';
      this.selectedBudgetMessage = 'Budget mis à jour.';
    } catch (error) {
      console.error("Erreur lors de la mise à jour du budget d'équipe", error);
      this.selectedBudgetMessage =
        "Impossible d'enregistrer le budget de cette équipe.";
    } finally {
      this.selectedBudgetSaving = false;
    }
  }

  private uniqueFoundationRuleTargets(): Array<{
    ownerUid: string;
    employee: Employee;
  }> {
    const map = new Map<string, { ownerUid: string; employee: Employee }>();
    (this.allEmployeesAll || []).forEach((employee) => {
      const ownerUid = employee?.tempUser?.uid || this.auth.currentUser?.uid;
      if (!ownerUid || !employee?.uid) {
        return;
      }
      map.set(`${ownerUid}-${employee.uid}`, { ownerUid, employee });
    });
    return Array.from(map.values());
  }

  async saveGlobalFoundationAttendanceRule(): Promise<void> {
    if (this.globalFoundationRuleSaving) {
      return;
    }

    const requiredDays = Number(this.globalFoundationRuleRequiredDays);
    const startMonth = Number(this.globalFoundationRuleStartMonth);
    const startYear = Number(this.globalFoundationRuleStartYear);

    if (!Number.isInteger(requiredDays) || requiredDays < 1 || requiredDays > 31) {
      alert('Entrez un nombre de jours présents entre 1 et 31.');
      return;
    }

    if (
      !Number.isInteger(startMonth) ||
      startMonth < 1 ||
      startMonth > 12 ||
      !Number.isInteger(startYear) ||
      startYear < 2000 ||
      startYear > 2100
    ) {
      alert('Choisissez le mois et l’année de début.');
      return;
    }

    const targets = this.uniqueFoundationRuleTargets();
    if (!targets.length) {
      alert('Aucun employé chargé pour appliquer cette règle.');
      return;
    }

    const confirmed = confirm(
      `Appliquer cette règle Compte Fondation à ${targets.length} employé${
        targets.length > 1 ? 's' : ''
      } ?\n\n${requiredDays} jours Présent à partir de ${this.globalFoundationRuleStartLabel}.`
    );
    if (!confirmed) {
      return;
    }

    const fields: Partial<Employee> = {
      foundationAttendanceRequiredDays: requiredDays,
      foundationAttendanceRuleStartMonth: startMonth,
      foundationAttendanceRuleStartYear: startYear,
    };
    const ownerIds = Array.from(
      new Set([
        ...targets.map((target) => target.ownerUid),
        this.auth.currentUser?.uid,
      ].filter((id): id is string => !!id))
    );

    this.globalFoundationRuleSaving = true;
    this.globalFoundationRuleMessage = '';
    try {
      await Promise.all([
        this.auth.updateUsersFieldBulk(
          ownerIds,
          'foundationAttendanceRequiredDays',
          requiredDays
        ),
        this.auth.updateUsersFieldBulk(
          ownerIds,
          'foundationAttendanceRuleStartMonth',
          startMonth
        ),
        this.auth.updateUsersFieldBulk(
          ownerIds,
          'foundationAttendanceRuleStartYear',
          startYear
        ),
        ...targets.map((target) =>
          this.data.updateEmployeeFieldsForUser(
            target.ownerUid,
            target.employee.uid!,
            fields
          )
        ),
      ]);

      this.auth.currentUser = {
        ...(this.auth.currentUser || {}),
        foundationAttendanceRequiredDays: requiredDays,
        foundationAttendanceRuleStartMonth: startMonth,
        foundationAttendanceRuleStartYear: startYear,
      };

      targets.forEach(({ employee }) => {
        employee.foundationAttendanceRequiredDays = requiredDays;
        employee.foundationAttendanceRuleStartMonth = startMonth;
        employee.foundationAttendanceRuleStartYear = startYear;
      });

      this.globalFoundationRuleMessage = `Règle appliquée à ${targets.length} employé${
        targets.length > 1 ? 's' : ''
      }.`;
    } catch (error) {
      console.error(
        'Erreur lors de la mise à jour globale de la règle Compte Fondation',
        error
      );
      this.globalFoundationRuleMessage =
        "Impossible d'appliquer la règle à tous les employés.";
    } finally {
      this.globalFoundationRuleSaving = false;
    }
  }

  /** ---------- Employee Transfer Feature ---------- */
  toggleEmployeeCopySection(): void {
    this.showEmployeeCopySection = !this.showEmployeeCopySection;
    if (this.showEmployeeCopySection && this.allEmployeesForCopy.length === 0) {
      this.loadAllEmployeesForCopy();
    }
  }

  private loadAllEmployeesForCopy(): void {
    this.allEmployeesForCopy = [];
    if (!this.allUsers?.length) {
      return;
    }

    let completedRequests = 0;
    const totalRequests = this.allUsers.length;

    this.allUsers.forEach((user) => {
      const sub = this.auth.getAllEmployeesGivenUser(user).subscribe(
        (employees) => {
          const employeeList: Employee[] = Array.isArray(employees)
            ? (employees as Employee[])
            : [];

          employeeList.forEach((employee) => {
            if (!employee?.uid) {
              return;
            }

            // Only include active employees
            const normalizedStatus = (employee.status || '')
              .toString()
              .trim()
              .toLowerCase();
            if (normalizedStatus !== 'travaille') {
              return;
            }

            const userLabel =
              user.firstName || user.lastName || user.email || 'Unknown';

            this.allEmployeesForCopy.push({
              employee,
              sourceUserId: user.uid!,
              sourceUserLabel: userLabel,
            });
          });

          // Sort by employee name
          this.allEmployeesForCopy.sort((a, b) => {
            const nameA = `${(a.employee.firstName || '').trim()} ${(
              a.employee.lastName || ''
            ).trim()}`
              .trim()
              .toLowerCase();
            const nameB = `${(b.employee.firstName || '').trim()} ${(
              b.employee.lastName || ''
            ).trim()}`
              .trim()
              .toLowerCase();
            return nameA.localeCompare(nameB);
          });

          completedRequests++;
          if (completedRequests === totalRequests) {
            sub.unsubscribe();
          }
        },
        (err) => {
          console.error('Error loading employees for copy:', err);
          completedRequests++;
          if (completedRequests === totalRequests) {
            sub.unsubscribe();
          }
        }
      );
      this.employeeCopySubs.push(sub);
    });
  }

  getEmployeeCopyDisplayLabel(item: {
    employee: Employee;
    sourceUserId: string;
    sourceUserLabel: string;
  }): string {
    const name = [
      item.employee.firstName,
      item.employee.lastName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    return name
      ? `${name} – ${item.sourceUserLabel}`
      : `${item.sourceUserLabel} (${item.employee.uid})`;
  }

  async copyEmployeeToLocation(): Promise<void> {
    if (!this.selectedSourceEmployee) {
      alert('Veuillez sélectionner un employé à copier.');
      return;
    }

    if (!this.selectedTargetLocationUserId) {
      alert('Veuillez sélectionner une localisation de destination.');
      return;
    }

    if (
      this.selectedSourceEmployee.sourceUserId ===
      this.selectedTargetLocationUserId
    ) {
      alert(
        "L'employé est déjà dans cette localisation. Veuillez sélectionner une autre localisation."
      );
      return;
    }

    if (!this.transferType) {
      alert('Veuillez sélectionner le type de transfert (Rotation ou Affectation).');
      return;
    }

    const transferTypeLabel =
      this.transferType === 'rotation' ? 'Rotation' : 'Affectation';
    const transferTypeDescription =
      this.transferType === 'rotation'
        ? 'temporaire (rotation)'
        : 'définitive (affectation)';

    if (
      !confirm(
        `Êtes-vous sûr de vouloir transférer cet employé vers la nouvelle localisation ?\n\nType: ${transferTypeLabel} (${transferTypeDescription})\n\nLes clients ne seront pas copiés (spécifiques à la localisation).`
      )
    ) {
      return;
    }

    this.employeeCopyInProgress = true;
    this.employeeCopySuccess = false;
    this.employeeCopyError = '';

    try {
      await this.auth.copyEmployeeToLocation(
        this.selectedSourceEmployee.sourceUserId,
        this.selectedSourceEmployee.employee.uid!,
        this.selectedTargetLocationUserId,
        this.transferType === 'rotation'
      );

      this.employeeCopySuccess = true;
      this.employeeCopyError = '';

      // Reset selections
      this.selectedSourceEmployee = null;
      this.selectedTargetLocationUserId = null;
      this.transferType = null;

      // Reload employees list
      this.allEmployeesForCopy = [];
      this.loadAllEmployeesForCopy();

      setTimeout(() => {
        this.employeeCopySuccess = false;
      }, 5000);
    } catch (error: any) {
      console.error('Error copying employee:', error);
      this.employeeCopyError =
        error?.message ||
        "Une erreur s'est produite lors de la copie de l'employé.";
      this.employeeCopySuccess = false;
    } finally {
      this.employeeCopyInProgress = false;
    }
  }

  /** ---------- Employee Merge Feature ---------- */
  toggleEmployeeMergeSection(): void {
    this.showEmployeeMergeSection = !this.showEmployeeMergeSection;
    if (this.showEmployeeMergeSection && this.allEmployeesForMerge.length === 0) {
      this.loadAllEmployeesForMerge();
    }
  }

  private loadAllEmployeesForMerge(): void {
    this.allEmployeesForMerge = [];
    if (!this.allUsers?.length) {
      return;
    }

    // Use a Map to track employees by UID to avoid duplicates
    const employeeMap = new Map<
      string,
      {
        employee: Employee;
        sourceUserId: string;
        sourceUserLabel: string;
      }
    >();

    let completedRequests = 0;
    const totalRequests = this.allUsers.length;

    this.allUsers.forEach((user) => {
      const sub = this.auth.getAllEmployeesGivenUser(user).subscribe(
        (employees) => {
          const employeeList: Employee[] = Array.isArray(employees)
            ? (employees as Employee[])
            : [];

          employeeList.forEach((employee) => {
            if (!employee?.uid) {
              return;
            }

            // Only add if we haven't seen this UID before
            // If we have, keep the existing one (first occurrence wins)
            if (!employeeMap.has(employee.uid)) {
              const userLabel =
                user.firstName || user.lastName || user.email || 'Unknown';

              employeeMap.set(employee.uid, {
                employee,
                sourceUserId: user.uid!,
                sourceUserLabel: userLabel,
              });
            }
          });

          // Convert map to array and sort by employee name
          this.allEmployeesForMerge = Array.from(employeeMap.values()).sort(
            (a, b) => {
              const nameA = `${(a.employee.firstName || '').trim()} ${(
                a.employee.lastName || ''
              ).trim()}`
                .trim()
                .toLowerCase();
              const nameB = `${(b.employee.firstName || '').trim()} ${(
                b.employee.lastName || ''
              ).trim()}`
                .trim()
                .toLowerCase();
              return nameA.localeCompare(nameB);
            }
          );

          completedRequests++;
          if (completedRequests === totalRequests) {
            sub.unsubscribe();
          }
        },
        (err) => {
          console.error('Error loading employees for merge:', err);
          completedRequests++;
          if (completedRequests === totalRequests) {
            sub.unsubscribe();
          }
        }
      );
      this.employeeMergeSubs.push(sub);
    });
  }

  getEmployeeMergeDisplayLabel(item: {
    employee: Employee;
    sourceUserId: string;
    sourceUserLabel: string;
  }): string {
    const name = [
      item.employee.firstName,
      item.employee.lastName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    
    const status = (item.employee.status || '')
      .toString()
      .trim()
      .toLowerCase();
    const statusLabel = status === 'travaille' ? '✓' : `[${status}]`;
    
    return name
      ? `${name} ${statusLabel} – ${item.sourceUserLabel}`
      : `${item.sourceUserLabel} (${item.employee.uid}) ${statusLabel}`;
  }

  async mergeEmployees(): Promise<void> {
    if (!this.selectedEmployeeA) {
      alert('Veuillez sélectionner l\'employé A (cible).');
      return;
    }

    if (!this.selectedEmployeeB) {
      alert('Veuillez sélectionner l\'employé B (source).');
      return;
    }

    if (this.selectedEmployeeA === this.selectedEmployeeB) {
      alert('Vous ne pouvez pas fusionner un employé avec lui-même.');
      return;
    }

    const employeeAName = [
      this.selectedEmployeeA.employee.firstName,
      this.selectedEmployeeA.employee.lastName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || `Employé ${this.selectedEmployeeA.employee.uid}`;

    const employeeBName = [
      this.selectedEmployeeB.employee.firstName,
      this.selectedEmployeeB.employee.lastName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || `Employé ${this.selectedEmployeeB.employee.uid}`;

    if (
      !confirm(
        `Êtes-vous sûr de vouloir fusionner les informations de l'employé B dans l'employé A ?\n\n` +
        `Employé A (cible): ${employeeAName}\n` +
        `Employé B (source): ${employeeBName}\n\n` +
        `Les informations de l'employé B seront fusionnées dans l'employé A.\n` +
        `Les clients ne seront pas fusionnés.\n` +
        `L'employé B sera conservé dans le système.`
      )
    ) {
      return;
    }

    this.employeeMergeInProgress = true;
    this.employeeMergeSuccess = false;
    this.employeeMergeError = '';

    try {
      await this.auth.mergeEmployeeData(
        this.selectedEmployeeA.sourceUserId,
        this.selectedEmployeeA.employee.uid!,
        this.selectedEmployeeB.sourceUserId,
        this.selectedEmployeeB.employee.uid!
      );

      this.employeeMergeSuccess = true;
      this.employeeMergeError = '';

      // Reset selections
      this.selectedEmployeeA = null;
      this.selectedEmployeeB = null;

      // Reload employees list
      this.allEmployeesForMerge = [];
      this.loadAllEmployeesForMerge();

      setTimeout(() => {
        this.employeeMergeSuccess = false;
      }, 5000);
    } catch (error: any) {
      console.error('Error merging employees:', error);
      this.employeeMergeError =
        error?.message ||
        "Une erreur s'est produite lors de la fusion des employés.";
      this.employeeMergeSuccess = false;
    } finally {
      this.employeeMergeInProgress = false;
    }
  }

  private mergeOwnerEmployees(
    owner: User,
    employees: Employee[],
    accumulator: Employee[]
  ): void {
    employees.forEach((em: any) => {
      if (!em?.uid) {
        this.logDebug('Discarded employee without uid', {
          ownerUid: owner?.uid,
          name: `${em?.firstName ?? ''} ${em?.lastName ?? ''}`.trim(),
        });
        return;
      }

      try {
        this.computePerformances(employees, em);
      } catch (err) {
        console.error('computePerformances failed for employee', {
          uid: em?.uid,
          ownerUid: owner?.uid,
          error: err,
        });
        em.performancePercentageMonth = '0';
      }

      if (em?.totalBonusThisMonth) {
        this.totalBonus = (
          Number(this.totalBonus) + Number(em.totalBonusThisMonth)
        ).toString();
      }

      em.tempUser = owner;
      em.tempLocationHolder = owner.firstName;
      em.showAttendance = false;
      accumulator.push(em);
    });
  }

  private afterEmployeesAggregated(allEmployees: Employee[]): void {
    this.allEmployeesAll = allEmployees;
    this.initializeGlobalFoundationRuleDefaults(allEmployees);
    this.filterAndInitializeEmployees(allEmployees, this.currentClients);
    this.ensurePresenceEmployeeSelection();
    this.invalidatePresenceCache();
    this.logDebug('Finished aggregating employees', {
      totalRaw: allEmployees.length,
      totalDisplay: this.allEmployees.length,
    });
    this.isFetchingClients = false;

    if (this.rankingMode === 'dailyPayments') {
      this.loadDailyTotalsForEmployees();
    } else if (this.rankingMode === 'weeklyPayments') {
      this.loadWeeklyTotalsForEmployees();
    } else if (this.rankingMode === 'monthlyPayments') {
      this.loadMonthlyTotalsForEmployees();
    } else {
      this.sortEmployeesByPerformance();
    }

    this.setGraphics();

    this.recomputePayrollRowsForAdmin();
  }

}
