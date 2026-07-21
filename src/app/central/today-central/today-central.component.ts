import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { Management } from 'src/app/models/management';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { selectWinnerTeamMembers } from '../winner-team-members';

type AuditPaymentPerformanceMode = 'day' | 'week' | 'month';
type AuditPaymentPerformanceTone = 'red' | 'yellow' | 'orange' | 'green';

interface AuditPaymentPerformanceRow {
  firstName: string;
  expectedFc: number;
  expectedDollar: number;
  totalFc: number;
  totalDollar: number;
  percent: number;
  tone: AuditPaymentPerformanceTone;
  statusLabel: string;
  trackingId: string;
}

@Component({
  selector: 'app-today-central',
  templateUrl: './today-central.component.html',
  styleUrls: ['./today-central.component.css'],
})
export class TodayCentralComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService,
    private data: DataService
  ) {}

  allUsers: User[] = [];
  managementInfo?: Management = {};
  ngOnInit(): void {
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data?.[0] || {};
    });
    // if (this.auth.isAdmin) {
    this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      this.initalizeInputs();
      this.loadAuditPaymentPerformance();
    });
    // }
  }
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  dailyLending: string = '0';
  dailyPayment: string = '0';
  dailyMobileMoneyPayment: string = '0';
  dailyPaymentDollars: string = '0';
  dailyMobileMoneyPaymentDollars: string = '0';
  dailyReserve: string = '0';
  dailyReserveDollars: string = '0';
  dailyInvestement: string = '0';
  dailyEntrySortie: string = '0';
  dailyEntrySortieDollars: string = '0';
  dailySaving: string = '0';
  dailySavingReturns = '0';
  dailyRequest: string = '0';
  dailyRequestDollars: string = '0';
  dailyExpense: string = '0';
  dailyFeesReturns: string = '0';
  dailyLoss: string = '0';

  sortedReserveToday: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] = [];
  sortedPaymentToday: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] = [];
  sortedMobileMoneyToday: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] = [];
  sortedRequestedTomorrow: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] = [];
  sortedEntrySortieToday: {
    firstName: string;
    totalEntrySortie: number;
    totalEntrySortieInDollars: string;
  }[] = [];
  totalPerfomance: number = 0;
  linkPaths: Array<string | null> = [
    '/daily-payments',
    '/daily-payments',
    '/daily-lendings',
    null,
    null,
    null,
    null,
    '/add-expense',
    null,
    null,
  ];
  summary: string[] = [
    'Paiement Du Jour',
    'Paiement Mobile Money Du Jour',
    'Emprunt Du Jour',
    'Reserve Du Jour',
    'Entrée Du Jour',
    'Epargne Du Jour',
    'Retrait Epargne Du Jour',
    'Depense Du Jour',
    `Retrait Frais De Membre Du Jour`,
    'Perte Du Jour',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/return.png',
    '../../../assets/img/loss.png',
  ];

  today = this.time.todaysDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  summaryContent: string[] = [];
  copyPaymentsMessage: string | null = null;
  isCopyingPayments = false;
  auditPaymentPerformanceMode: AuditPaymentPerformanceMode = 'day';
  readonly auditPaymentPerformanceOptions: Array<{
    mode: AuditPaymentPerformanceMode;
    label: string;
  }> = [
    { mode: 'day', label: 'Jour' },
    { mode: 'week', label: 'Semaine' },
    { mode: 'month', label: 'Mois' },
  ];
  auditPaymentPerformanceRows: AuditPaymentPerformanceRow[] = [];
  auditPaymentPerformanceLoading = false;
  auditPaymentPerformanceError = '';
  auditPaymentExpectedTotalFc = 0;
  auditPaymentExpectedTotalDollar = 0;
  auditPaymentReceivedTotalFc = 0;
  auditPaymentReceivedTotalDollar = 0;
  auditPaymentTotalPercent = 0;
  auditPaymentTotalTone: AuditPaymentPerformanceTone = 'red';
  auditPaymentTotalStatusLabel = 'À faire';
  private auditClientsByUser = new Map<string, Client[]>();

  get isAuditTeamViewer(): boolean {
    return !this.auth.isAdmin && this.auth.isDistributor;
  }

  get isAuditOnlyTodayCentral(): boolean {
    return this.isAuditTeamViewer && !this.auth.isAdmin;
  }

  get reserveRevealTimeLabel(): string {
    return this.normalizeRevealTime(this.managementInfo?.reserveRevealTimeKinshasa);
  }

  get shouldHideReserveGivenAmounts(): boolean {
    if (this.auth.isAdmin) return false;

    const selected = this.parseMonthDayYearLabel(this.requestDateCorrectFormat);
    const now = this.kinshasaNowParts();
    if (!selected) return true;

    const selectedStamp = selected.y * 10_000 + selected.m * 100 + selected.d;
    const todayStamp = now.y * 10_000 + now.m * 100 + now.d;

    if (selectedStamp < todayStamp) return false;
    if (selectedStamp > todayStamp) return true;

    const currentMinutes = now.hh * 60 + now.mm;
    const { hour, minute } = this.parseRevealTime(
      this.managementInfo?.reserveRevealTimeKinshasa
    );
    const revealMinutes = hour * 60 + minute;
    return currentMinutes < revealMinutes;
  }

  get shouldHideReserveRankingForAudit(): boolean {
    return this.isAuditTeamViewer && this.shouldHideReserveGivenAmounts;
  }

  get tomorrowDayName(): string {
    const dayNames = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];
    const [month, day, year] = this.tomorrow.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return dayNames[date.getDay()];
  }

  get activeAuditPaymentPerformanceLabel(): string {
    return (
      this.auditPaymentPerformanceOptions.find(
        (option) => option.mode === this.auditPaymentPerformanceMode
      )?.label || 'Jour'
    );
  }

  get auditPaymentPeriodLabel(): string {
    if (this.auditPaymentPerformanceMode === 'day') {
      return this.time.convertDateToDayMonthYear(this.requestDateCorrectFormat);
    }

    if (this.auditPaymentPerformanceMode === 'week') {
      const { start, end } = this.getWeekBounds(this.requestDateCorrectFormat);
      return `${this.formatShortDate(start)} - ${this.formatShortDate(end)}`;
    }

    const { month, year } = this.getMonthYearFromDateKey(
      this.requestDateCorrectFormat
    );
    return `${this.time.monthFrenchNames[month - 1]} ${year}`;
  }

  get auditPaymentExpectedHeaderLabel(): string {
    return this.auditPaymentPerformanceMode === 'day'
      ? 'Attendu jour'
      : this.auditPaymentPerformanceMode === 'week'
      ? 'Attendu semaine'
      : 'Attendu mois';
  }

  get auditPaymentTotalHeaderLabel(): string {
    return this.auditPaymentPerformanceMode === 'day'
      ? 'Total jour'
      : this.auditPaymentPerformanceMode === 'week'
      ? 'Total semaine'
      : 'Total mois';
  }
  initalizeInputs() {
    this.dailyLending = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyLending',
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyPayment = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyReimbursement',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyMobileMoneyPayment = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyMobileMoneyPayment',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyReserve = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'reserve',
        this.requestDateCorrectFormat
      )
      .toString();

    // Update monthly reserve graph
    this.updateMonthlyReserveGraph();
    // Update monthly payment graph
    this.updateMonthlyPaymentGraph();
    // Update mini graphs
    this.updateMiniGraphs();
    let tomorrow = this.findNextDay(this.requestDateCorrectFormat);

    this.dailyRequest = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyMoneyRequests',
        tomorrow
      )
      .toString();
    this.dailyInvestement = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'investments',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailySaving = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailySaving',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailySavingReturns = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailySavingReturns',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyFeesReturns = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyFeesReturns',
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyExpense = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'expenses',
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyLoss = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'losses',
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyLending =
      this.dailyLending === undefined ? '0' : this.dailyLending;
    this.dailyPayment =
      this.dailyPayment === undefined ? '0' : this.dailyPayment;
    this.dailyMobileMoneyPayment =
      this.dailyMobileMoneyPayment === undefined
        ? '0'
        : this.dailyMobileMoneyPayment;
    this.dailyReserve =
      this.dailyReserve === undefined ? '0' : this.dailyReserve;
    this.dailyInvestement =
      this.dailyInvestement === undefined ? '0' : this.dailyInvestement;
    this.dailySaving = this.dailySaving === undefined ? '0' : this.dailySaving;
    this.dailyRequest =
      this.dailyRequest === undefined ? '0' : this.dailyRequest;
    this.dailyExpense =
      this.dailyExpense === undefined ? '0' : this.dailyExpense;
    this.dailyFeesReturns =
      this.dailyFeesReturns === undefined ? '0' : this.dailyFeesReturns;
    this.dailyLoss = this.dailyLoss === undefined ? '0' : this.dailyLoss;
    this.dailyReserveDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.dailyReserve)
      .toString();
    this.dailyEntrySortie = (
      Number(this.dailyReserve) - Number(this.dailyInvestement)
    ).toString();
    this.dailyEntrySortieDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.dailyEntrySortie)
      .toString();
    this.dailyPaymentDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.dailyPayment)
      .toString();
    this.dailyMobileMoneyPaymentDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.dailyMobileMoneyPayment)
      .toString();
    this.dailyRequestDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.dailyRequest)
      .toString();

    this.sortedReserveToday =
      this.compute.findTodayTotalResultsGivenFieldSortedDescending(
        this.requestDateCorrectFormat,
        this.allUsers,
        'reserve'
      );
    this.sortedPaymentToday =
      this.compute.findTodayTotalResultsGivenFieldSortedDescending(
        this.requestDateCorrectFormat,
        this.allUsers,
        'dailyReimbursement'
      );
    this.sortedMobileMoneyToday =
      this.compute.findTodayTotalResultsGivenFieldSortedDescending(
        this.requestDateCorrectFormat,
        this.allUsers,
        'dailyMobileMoneyPayment'
      );
    this.sortedRequestedTomorrow =
      this.compute.findTodayTotalResultsGivenFieldSortedDescending(
        tomorrow,
        this.allUsers,
        'dailyMoneyRequests'
      );
    this.sortedEntrySortieToday = this.buildEntrySortieTodayRanking(
      this.requestDateCorrectFormat
    );
    this.summaryContent = [
      ` ${this.dailyPayment}`,
      ` ${this.dailyMobileMoneyPayment}`,
      ` ${this.dailyLending}`,
      `${this.dailyReserve}`,
      `${this.dailyInvestement}`,
      `${this.dailySaving}`,
      `${this.dailySavingReturns}`,
      `${this.dailyExpense}`,
      `${this.dailyFeesReturns}`,
      `${this.dailyLoss}`,
    ];

    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyPayment)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailyMobileMoneyPayment
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLending)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyReserve)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyInvestement)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailySaving)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailySavingReturns
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyExpense)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyFeesReturns)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLoss)}`,
    ];
  }

  get todaySummaryCards() {
    return this.summary.map((title, index) => ({
      index,
      title,
      icon: this.imagePaths[index] ?? this.imagePaths[0],
      amountFc: this.toNum(this.summaryContent[index]),
      amountUsd: this.toNum(this.valuesConvertedToDollars[index]),
      link: this.linkPaths[index] ?? null,
    }));
  }

  get heroSnapshot() {
    return [
      {
        label: 'Paiements',
        value: this.toNum(this.dailyPayment),
        valueUsd: this.toNum(this.dailyPaymentDollars),
        icon: '💸',
      },
      {
        label: 'Réserves',
        value: this.toNum(this.dailyReserve),
        valueUsd: this.toNum(this.dailyReserveDollars),
        icon: '🏦',
      },
      {
        label: 'Demandes',
        value: this.toNum(this.dailyRequest),
        valueUsd: this.toNum(this.dailyRequestDollars),
        icon: '📅',
      },
    ];
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByLabel(_index: number, item: { label: string }): string {
    return item.label;
  }

  findDailyActivitiesCentralAmount() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );

    this.initalizeInputs();
    this.computeAuditPaymentPerformanceRows();
    // Graph will be updated in initalizeInputs via updateMonthlyReserveGraph
  }

  setAuditPaymentPerformanceMode(mode: AuditPaymentPerformanceMode): void {
    this.auditPaymentPerformanceMode = mode;
    this.computeAuditPaymentPerformanceRows();
  }

  private async loadAuditPaymentPerformance(): Promise<void> {
    if (!this.isAuditTeamViewer || !this.allUsers.length) return;

    this.auditPaymentPerformanceLoading = true;
    this.auditPaymentPerformanceError = '';

    try {
      const clientsByUser = await Promise.all(
        this.allUsers.map((user) =>
          user.uid
            ? firstValueFrom(this.auth.getClientsOfAUser(user.uid))
            : Promise.resolve([] as Client[])
        )
      );

      this.auditClientsByUser.clear();
      this.allUsers.forEach((user, index) => {
        this.auditClientsByUser.set(user.uid || '', clientsByUser[index] || []);
      });
      this.computeAuditPaymentPerformanceRows();
    } catch (error) {
      console.error('Unable to load audit payment performance', error);
      this.auditPaymentPerformanceRows = [];
      this.auditPaymentPerformanceError =
        'Impossible de charger la performance paiement.';
      this.resetAuditPaymentTotals();
    } finally {
      this.auditPaymentPerformanceLoading = false;
    }
  }

  private computeAuditPaymentPerformanceRows(): void {
    if (!this.isAuditTeamViewer || !this.allUsers.length) return;

    const rows = this.allUsers.map((user) => {
      const clients = this.auditClientsByUser.get(user.uid || '') || [];
      const expectedFc = this.computeAuditExpectedPaymentForUser(user, clients);
      const totalFc = this.computeAuditReceivedPaymentForUser(user);
      const percent = this.computeAuditProgressPercent(totalFc, expectedFc);
      const tone = this.resolveAuditProgressTone(percent);

      return {
        firstName: user.firstName || 'Sans nom',
        expectedFc,
        expectedDollar: this.fcToDollar(expectedFc),
        totalFc,
        totalDollar: this.fcToDollar(totalFc),
        percent,
        tone,
        statusLabel: this.resolveAuditProgressStatusLabel(percent),
        trackingId: user.uid || '',
      };
    });

    this.auditPaymentPerformanceRows = rows.sort((a, b) => b.totalFc - a.totalFc);
    this.auditPaymentExpectedTotalFc = rows.reduce(
      (sum, row) => sum + row.expectedFc,
      0
    );
    this.auditPaymentReceivedTotalFc = rows.reduce(
      (sum, row) => sum + row.totalFc,
      0
    );
    this.auditPaymentExpectedTotalDollar = this.fcToDollar(
      this.auditPaymentExpectedTotalFc
    );
    this.auditPaymentReceivedTotalDollar = this.fcToDollar(
      this.auditPaymentReceivedTotalFc
    );
    this.auditPaymentTotalPercent = this.computeAuditProgressPercent(
      this.auditPaymentReceivedTotalFc,
      this.auditPaymentExpectedTotalFc
    );
    this.auditPaymentTotalTone = this.resolveAuditProgressTone(
      this.auditPaymentTotalPercent
    );
    this.auditPaymentTotalStatusLabel = this.resolveAuditProgressStatusLabel(
      this.auditPaymentTotalPercent
    );
  }

  private resetAuditPaymentTotals(): void {
    this.auditPaymentExpectedTotalFc = 0;
    this.auditPaymentExpectedTotalDollar = 0;
    this.auditPaymentReceivedTotalFc = 0;
    this.auditPaymentReceivedTotalDollar = 0;
    this.auditPaymentTotalPercent = 0;
    this.auditPaymentTotalTone = 'red';
    this.auditPaymentTotalStatusLabel = 'À faire';
  }

  private computeAuditExpectedPaymentForUser(
    _user: User,
    clients: Client[]
  ): number {
    if (this.auditPaymentPerformanceMode === 'day') {
      return this.computeExpectedPaymentForDate(clients, this.requestDateCorrectFormat);
    }

    if (this.auditPaymentPerformanceMode === 'week') {
      const { start, end } = this.getWeekBounds(this.requestDateCorrectFormat);
      return this.sumExpectedPaymentBetween(clients, start, end);
    }

    const { month, year } = this.getMonthYearFromDateKey(
      this.requestDateCorrectFormat
    );
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return this.sumExpectedPaymentBetween(clients, start, end);
  }

  private computeAuditReceivedPaymentForUser(user: User): number {
    if (this.auditPaymentPerformanceMode === 'day') {
      return this.collectUserDailyFieldValue(
        user,
        'dailyReimbursement',
        this.requestDateCorrectFormat
      );
    }

    if (this.auditPaymentPerformanceMode === 'week') {
      const { start, end } = this.getWeekBounds(this.requestDateCorrectFormat);
      return this.sumUserPaymentBetween(user, start, end);
    }

    const { month, year } = this.getMonthYearFromDateKey(
      this.requestDateCorrectFormat
    );
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return this.sumUserPaymentBetween(user, start, end);
  }

  private sumExpectedPaymentBetween(
    clients: Client[],
    start: Date,
    end: Date
  ): number {
    let total = 0;
    const cursor = new Date(start);

    while (cursor <= end) {
      total += this.computeExpectedPaymentForDate(
        clients,
        this.formatDateKey(cursor)
      );
      cursor.setDate(cursor.getDate() + 1);
    }

    return total;
  }

  private computeExpectedPaymentForDate(clients: Client[], dateKey: string): number {
    const paymentDay = this.time.getDayOfWeek(dateKey);
    const expectedClients = this.data
      .findClientsWithDebts(clients)
      .filter(
        (client) =>
          Number(client.debtLeft) > 0 &&
          client.paymentDay === paymentDay &&
          this.data.didClientStartThisWeek(client)
      );

    return Number(this.compute.computeExpectedPerDate(expectedClients)) || 0;
  }

  private sumUserPaymentBetween(user: User, start: Date, end: Date): number {
    let total = 0;
    const cursor = new Date(start);

    while (cursor <= end) {
      total += this.collectUserDailyFieldValue(
        user,
        'dailyReimbursement',
        this.formatDateKey(cursor)
      );
      cursor.setDate(cursor.getDate() + 1);
    }

    return total;
  }

  private computeAuditProgressPercent(total: number, expected: number): number {
    const totalValue = Number(total) || 0;
    const expectedValue = Number(expected) || 0;
    if (expectedValue <= 0) return totalValue > 0 ? 100 : 0;
    return Math.min(100, (totalValue / expectedValue) * 100);
  }

  getAuditProgressBarClass(tone: AuditPaymentPerformanceTone): string {
    if (tone === 'green') return 'bg-emerald-500';
    if (tone === 'orange') return 'bg-orange-500';
    if (tone === 'yellow') return 'bg-amber-400';
    return 'bg-red-500';
  }

  getAuditProgressTextClass(
    tone: AuditPaymentPerformanceTone
  ): { [key: string]: boolean } {
    return {
      'text-red-600 dark:text-red-300': tone === 'red',
      'text-amber-600 dark:text-amber-300': tone === 'yellow',
      'text-orange-600 dark:text-orange-300': tone === 'orange',
      'text-emerald-600 dark:text-emerald-300': tone === 'green',
    };
  }

  private resolveAuditProgressTone(
    percent: number
  ): AuditPaymentPerformanceTone {
    const value = Number(percent) || 0;
    if (value >= 100) return 'green';
    if (value >= 80) return 'orange';
    if (value >= 50) return 'yellow';
    return 'red';
  }

  private resolveAuditProgressStatusLabel(percent: number): string {
    const value = Number(percent) || 0;
    if (value >= 100) return 'Atteint';
    if (value >= 80) return '80%+';
    if (value >= 50) return '50%+';
    return 'À faire';
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

  private getMonthYearFromDateKey(dateKey: string): {
    month: number;
    year: number;
  } {
    const [month, , year] = dateKey.split('-').map(Number);
    return {
      month: Number.isFinite(month) ? month : new Date().getMonth() + 1,
      year: Number.isFinite(year) ? year : new Date().getFullYear(),
    };
  }

  private formatShortDate(date: Date): string {
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  }

  private formatDateKey(date: Date): string {
    return `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;
  }

  private fcToDollar(amountFc: number): number {
    return Number(
      this.compute.convertCongoleseFrancToUsDollars(
        (Number(amountFc) || 0).toString()
      )
    );
  }
  async copyPaymentRanking(): Promise<void> {
    if (this.isCopyingPayments || !this.sortedPaymentToday.length) {
      return;
    }

    this.isCopyingPayments = true;
    this.copyPaymentsMessage = null;

    try {
      const winner = this.sortedPaymentToday[0];
      const winnerLines = await this.buildWinnerMembersLines(winner?.firstName);
      const dateLabel = this.buildPaymentCopyDateLabel();

      const lines: string[] = [dateLabel, '==============='];

      this.sortedPaymentToday.forEach((team, index) => {
        const rankLabel = index + 1;
        if (index === 0) {
          lines.push(`${rankLabel}. Equipe Gagnante:  ${team.firstName}`);
          if (winnerLines.length) {
            lines.push(...winnerLines);
          }
        } else {
          lines.push(`${rankLabel}. ${team.firstName}`);
        }
      });

      const textToCopy = lines.join('\n');
      await this.copyToClipboard(textToCopy);
      this.copyPaymentsMessage = 'Classement copié (montants exclus)';
    } catch (error) {
      console.error('Failed to copy payment ranking', error);
      this.copyPaymentsMessage = 'Impossible de copier le classement.';
    } finally {
      this.isCopyingPayments = false;
      if (this.copyPaymentsMessage) {
        setTimeout(() => (this.copyPaymentsMessage = null), 2200);
      }
    }
  }
  private buildPaymentCopyDateLabel(): string {
    const parts = this.requestDateCorrectFormat?.split('-') ?? [];
    if (parts.length >= 3) {
      const [monthStr, dayStr, yearStr] = parts;
      const month = Number(monthStr);
      const day = Number(dayStr);
      const year = Number(yearStr);
      const dateObj = new Date(year, month - 1, day);
      const englishDay = dateObj.toLocaleString('en-US', { weekday: 'long' });
      const dayName = this.time.englishToFrenchDay[englishDay] ?? englishDay;
      return `${dayName} ${day}/${month}/${year}`;
    }
    return this.frenchDate || '';
  }
  private async buildWinnerMembersLines(
    locationName?: string
  ): Promise<string[]> {
    if (!locationName) {
      return [];
    }

    const owner = this.allUsers.find((u) => u.firstName === locationName);
    if (!owner?.uid) {
      return [];
    }

    try {
      const employees = (await firstValueFrom(
        this.auth.getAllEmployeesGivenUser(owner)
      )) as Employee[] | null;

      if (!Array.isArray(employees) || !employees.length) {
        return [];
      }

      const working = employees.filter(
        (emp) => (emp.status ?? '').toLowerCase() === 'travaille'
      );

      const namesWorking = selectWinnerTeamMembers(working)
        .map((employee) => this.formatEmployeeName(employee))
        .filter(Boolean);

      const lines: string[] = [];

      if (namesWorking.length === 1) {
        lines.push(`Avec ${namesWorking[0]}`);
      } else if (namesWorking.length >= 2) {
        lines.push(`Avec ${namesWorking[0]} et ${namesWorking[1]}`);
      }

      return lines;
    } catch (err) {
      console.error('Failed to fetch employees for winning team', err);
      return [];
    }
  }
  private formatEmployeeName(employee?: Employee | null): string {
    if (!employee) {
      return '';
    }
    const parts = [employee.firstName, employee.lastName].filter(Boolean);
    const base = parts.join(' ').trim();
    if (base) {
      return base;
    }
    return employee.middleName ?? '';
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
  findNextDay(dateStr: string) {
    // Parse the date string into a Date object
    const [month, day, year] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    // Add one day to the date
    date.setDate(date.getDate() + 1);

    // Get the day, month, and year without leading zeros
    const nextDay = date.getDate();
    const nextMonth = date.getMonth() + 1;
    const nextYear = date.getFullYear();

    return `${nextMonth}-${nextDay}-${nextYear}`;
  }
  // Helpers: robust to string|number and flexible field names
  toNum(v: any): number {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(/\s/g, ''));
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }
  val(obj: any, ...keys: string[]): any {
    if (!obj) return 0;
    for (const k of keys) {
      const v = obj[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return 0;
  }
  percentOf(value: any, basis: any): number {
    const v = this.toNum(value);
    const b = this.toNum(basis) || 1;
    return Math.max(0, (v / b) * 100);
  }
  absPercentOf(value: any, basis: any): number {
    const v = Math.abs(this.toNum(value));
    const b = Math.abs(this.toNum(basis)) || 1;
    return Math.max(0, (v / b) * 100);
  }
  isNegativeValue(value: any): boolean {
    return this.toNum(value) < 0;
  }

  private buildMonthPickerValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private getMonthPickerSelection(): { month: number; year: number } {
    if (this.monthPickerValue) {
      const [yearStr, monthStr] = this.monthPickerValue.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      if (!Number.isNaN(year) && !Number.isNaN(month)) {
        return { month, year };
      }
    }
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }

  private isCurrentMonthSelection(month: number, year: number): boolean {
    const now = new Date();
    return month === now.getMonth() + 1 && year === now.getFullYear();
  }

  private isSameMonthYear(
    monthA: number,
    yearA: number,
    monthB: number,
    yearB: number
  ): boolean {
    return monthA === monthB && yearA === yearB;
  }

  private buildDailySeries(
    field: 'reserve' | 'dailyReimbursement',
    month: number,
    year: number,
    totalDays: number,
    dayLimit: number,
    locationUser?: User
  ): (number | null)[] {
    const series: (number | null)[] = Array(totalDays).fill(null);
    for (let day = 1; day <= totalDays; day++) {
      if (day > dayLimit) {
        series[day - 1] = null;
        continue;
      }

      const dateStr = `${month}-${day}-${year}`;
      let amountCdf = 0;

      if (locationUser) {
        amountCdf = this.collectUserFieldValue(locationUser, field, dateStr);
      } else {
        const total = this.compute.findTodayTotalResultsGivenField(
          this.allUsers,
          field,
          dateStr
        );
        amountCdf = this.toNum(total);
      }

      const usdValue = this.toNum(
        this.compute.convertCongoleseFrancToUsDollars(amountCdf.toString())
      );
      series[day - 1] = usdValue > 0 ? usdValue : null;
    }
    return series;
  }

  private collectUserFieldValue(
    user: User | undefined,
    field: 'reserve' | 'dailyReimbursement',
    dateStr: string
  ): number {
    if (!user || !user[field]) {
      return 0;
    }

    let total = 0;
    Object.entries(user[field] as Record<string, string>).forEach(
      ([dateKey, amount]) => {
        const normalizedDate = dateKey.split('-').slice(0, 3).join('-');
        if (normalizedDate === dateStr) {
          const numericAmount = String(amount).split(':')[0];
          total += parseInt(numericAmount, 10) || 0;
        }
      }
    );
    return total;
  }

  private collectUserDailyFieldValue(
    user: User | undefined,
    field: 'reserve' | 'dailyReimbursement' | 'investments',
    dateStr: string
  ): number {
    if (!user || !user[field]) {
      return 0;
    }

    let total = 0;
    Object.entries(user[field] as Record<string, string>).forEach(
      ([dateKey, amount]) => {
        const normalizedDate = dateKey.split('-').slice(0, 3).join('-');
        if (normalizedDate === dateStr) {
          const numericAmount = String(amount).split(':')[0];
          total += parseInt(numericAmount, 10) || 0;
        }
      }
    );
    return total;
  }

  private buildEntrySortieTodayRanking(
    requestDate: string
  ): {
    firstName: string;
    totalEntrySortie: number;
    totalEntrySortieInDollars: string;
  }[] {
    return this.allUsers
      .map((user) => {
        const reserve = this.collectUserDailyFieldValue(
          user,
          'reserve',
          requestDate
        );
        const investment = this.collectUserDailyFieldValue(
          user,
          'investments',
          requestDate
        );
        const totalEntrySortie = reserve - investment;

        return {
          firstName: user.firstName || '',
          totalEntrySortie,
          totalEntrySortieInDollars: `${this.compute.convertCongoleseFrancToUsDollars(
            totalEntrySortie.toString()
          ) || '0'}`,
        };
      })
      .filter((row) => row.firstName && row.totalEntrySortie !== 0)
      .sort((a, b) => b.totalEntrySortie - a.totalEntrySortie);
  }

  private getFirstDefinedValue(series: (number | null)[]): number {
    for (const value of series) {
      if (value !== null && value !== undefined) {
        return value;
      }
    }
    return 0;
  }

  private getLastDefinedValue(series: (number | null)[]): number {
    for (let i = series.length - 1; i >= 0; i--) {
      const value = series[i];
      if (value !== null && value !== undefined) {
        return value;
      }
    }
    return 0;
  }

  private normalizeRevealTime(value?: string | null): string {
    const fallback = '22:30';
    const raw = (value || '').trim();
    if (!/^\d{1,2}:\d{2}$/.test(raw)) return fallback;

    const [hourStr, minuteStr] = raw.split(':');
    const hour = Number(hourStr);
    const minute = Number(minuteStr);

    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return fallback;
    }

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  private parseRevealTime(value?: string | null): {
    hour: number;
    minute: number;
  } {
    const normalized = this.normalizeRevealTime(value);
    const [hour, minute] = normalized.split(':').map(Number);
    return { hour, minute };
  }

  private parseMonthDayYearLabel(label: string): {
    m: number;
    d: number;
    y: number;
  } | null {
    if (!label) return null;
    const parts = label.split('-').map(Number);
    if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) {
      return null;
    }
    return { m: parts[0], d: parts[1], y: parts[2] };
  }

  private kinshasaNowParts(): {
    y: number;
    m: number;
    d: number;
    hh: number;
    mm: number;
  } {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Kinshasa',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const bag: Record<string, string> = {};
    for (const part of formatter.formatToParts(new Date())) {
      if (part.type !== 'literal') {
        bag[part.type] = part.value;
      }
    }

    return {
      y: Number(bag['year']),
      m: Number(bag['month']),
      d: Number(bag['day']),
      hh: Number(bag['hour']),
      mm: Number(bag['minute']),
    };
  }

  // Baselines for today/tomorrow (bars = % of max $)
  get reserveTodayUSDMax(): number {
    const list = this.sortedReserveToday ?? [];
    const vals = list.map((s) =>
      this.toNum(
        this.val(
          s,
          'totalReserveInDollars',
          'totalPaymentInDollars',
          'amountUsd'
        )
      )
    );
    return Math.max(1, ...vals, 1);
  }
  get paymentTodayUSDMax(): number {
    const list = this.sortedPaymentToday ?? [];
    const vals = list.map((s) =>
      this.toNum(
        this.val(
          s,
          'totalPaymentInDollars',
          'totalReserveInDollars',
          'amountUsd'
        )
      )
    );
    return Math.max(1, ...vals, 1);
  }
  get mobileMoneyTodayUSDMax(): number {
    const list = this.sortedMobileMoneyToday ?? [];
    const vals = list.map((s) =>
      this.toNum(
        this.val(
          s,
          'totalMobileMoneyInDollars',
          'totalReserveInDollars',
          'amountUsd'
        )
      )
    );
    return Math.max(1, ...vals, 1);
  }
  get requestTomorrowUSDMax(): number {
    const list = this.sortedRequestedTomorrow ?? [];
    const vals = list.map((s) =>
      this.toNum(
        this.val(
          s,
          'totalRequestedInDollars',
          'totalReserveInDollars',
          'amountUsd'
        )
      )
    );
    return Math.max(1, ...vals, 1);
  }
  get entrySortieTodayUSDMax(): number {
    const list = this.sortedEntrySortieToday ?? [];
    const vals = list.map((s) =>
      Math.abs(this.toNum(s.totalEntrySortieInDollars))
    );
    return Math.max(1, ...vals, 1);
  }

  // Monthly reserve graph
  monthlyReserveGraph: { data: any[]; layout: any; config?: any } = {
    data: [],
    layout: {},
    config: { responsive: true, displayModeBar: false },
  };

  // Monthly payment graph
  monthlyPaymentGraph: { data: any[]; layout: any; config?: any } = {
    data: [],
    layout: {},
    config: { responsive: true, displayModeBar: false },
  };

  // Selected location for filtering graph
  selectedLocation: string | null = null;
  selectedPaymentLocation: string | null = null;

  // Time range filter for graph
  selectedTimeRange: '1D' | '1W' | '1M' | '6M' | '1Y' | 'MAX' = '1M';
  selectedPaymentTimeRange: '1D' | '1W' | '1M' | '6M' | '1Y' | 'MAX' = '1M';

  // Shared month-year picker (applies when either graph is on 1M)
  monthPickerValue: string = this.buildMonthPickerValue(new Date());
  get isMonthPickerEnabled(): boolean {
    return (
      this.selectedTimeRange === '1M' ||
      this.selectedPaymentTimeRange === '1M'
    );
  }
  get monthPickerMax(): string {
    return this.buildMonthPickerValue(new Date());
  }

  // Mini graph cache
  miniReserveGraphs: Map<string, { data: any[]; layout: any; config?: any }> =
    new Map();
  miniPaymentGraphs: Map<string, { data: any[]; layout: any; config?: any }> =
    new Map();

  onLocationClick(locationName: string) {
    // Toggle selection: if clicking the same location, deselect it
    if (this.selectedLocation === locationName) {
      this.selectedLocation = null;
    } else {
      this.selectedLocation = locationName;
    }
    this.updateMonthlyReserveGraph();
  }

  onPaymentLocationClick(locationName: string) {
    // Toggle selection: if clicking the same location, deselect it
    if (this.selectedPaymentLocation === locationName) {
      this.selectedPaymentLocation = null;
    } else {
      this.selectedPaymentLocation = locationName;
    }
    this.updateMonthlyPaymentGraph();
  }

  onTimeRangeChange(range: '1D' | '1W' | '1M' | '6M' | '1Y' | 'MAX') {
    this.selectedTimeRange = range;
    this.updateMonthlyReserveGraph();
  }

  onPaymentTimeRangeChange(range: '1D' | '1W' | '1M' | '6M' | '1Y' | 'MAX') {
    this.selectedPaymentTimeRange = range;
    this.updateMonthlyPaymentGraph();
  }

  onMonthPickerChange(value: string | null) {
    if (value && /^\d{4}-\d{2}$/.test(value)) {
      this.monthPickerValue = value;
    } else {
      this.monthPickerValue = this.buildMonthPickerValue(new Date());
    }

    if (this.selectedTimeRange === '1M') {
      this.updateMonthlyReserveGraph();
    }
    if (this.selectedPaymentTimeRange === '1M') {
      this.updateMonthlyPaymentGraph();
    }
  }

  resetMonthPicker() {
    this.onMonthPickerChange(this.buildMonthPickerValue(new Date()));
  }

  private updateMonthlyReserveGraph() {
    if (!this.allUsers || this.allUsers.length === 0) {
      this.monthlyReserveGraph = this.createEmptyGraph();
      return;
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const today = currentDate.getDate();

    if (this.selectedTimeRange === '1M') {
      this.monthlyReserveGraph = this.buildMonthlyComparisonGraph({
        field: 'reserve',
        title: 'Réserve',
        selectedLocation: this.selectedLocation,
        currentMonth,
        currentYear,
        today,
      });
      return;
    }

    // Calculate date range based on selected filter
    let startDate: Date;
    const endDate = new Date(currentYear, currentMonth - 1, today);

    switch (this.selectedTimeRange) {
      case '1D':
        // Compare with yesterday
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '1W':
        // Last 6 days (including today = 7 days total)
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        break;
      case '6M':
        // Last 6 months
        startDate = new Date(currentYear, currentMonth - 1, 1);
        startDate.setMonth(startDate.getMonth() - 5);
        break;
      case '1Y':
        // Last 12 months
        startDate = new Date(currentYear, currentMonth - 1, 1);
        startDate.setMonth(startDate.getMonth() - 11);
        break;
      case 'MAX':
        // Get earliest date from all users' reserve data
        let earliestDate: Date | null = null;
        this.allUsers.forEach((user) => {
          if (user.reserve) {
            Object.keys(user.reserve).forEach((dateStr) => {
              const normalizedDate = dateStr.split('-').slice(0, 3).join('-');
              const [month, day, year] = normalizedDate.split('-').map(Number);
              const date = new Date(year, month - 1, day);
              if (!earliestDate || date < earliestDate) {
                earliestDate = date;
              }
            });
          }
        });
        startDate = earliestDate || new Date(currentYear, currentMonth - 1, 1);
        break;
      default:
        startDate = new Date(currentYear, currentMonth - 1, 1);
    }

    // Generate date range
    const labels: string[] = [];
    const values: number[] = [];
    const dateArray: Date[] = [];

    // Filter users by selected location if any
    const usersToProcess = this.selectedLocation
      ? this.allUsers.filter((user) => user.firstName === this.selectedLocation)
      : this.allUsers;

    // Generate dates based on range
    if (this.selectedTimeRange === '1D' || this.selectedTimeRange === '1W') {
      // Daily data - only include dates up to today
      const todayDate = new Date(currentYear, currentMonth - 1, today);
      const actualEndDate = endDate > todayDate ? todayDate : endDate;
      for (
        let d = new Date(startDate);
        d <= actualEndDate;
        d.setDate(d.getDate() + 1)
      ) {
        dateArray.push(new Date(d));
      }
    } else {
      // Monthly data for 6M, 1Y, MAX
      const startMonth = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        1
      );
      const endMonth = new Date(currentYear, currentMonth - 1, 1);

      for (
        let d = new Date(startMonth);
        d <= endMonth;
        d.setMonth(d.getMonth() + 1)
      ) {
        dateArray.push(new Date(d));
      }
    }

    // Calculate reserve for each date in range (in dollars)
    // Store data temporarily to filter out zero values
    const tempData: { label: string; value: number }[] = [];

    dateArray.forEach((date) => {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear();

      let reserve: string = '0';

      if (
        this.selectedTimeRange === '1D' ||
        this.selectedTimeRange === '1W' ||
        this.selectedTimeRange === '1M'
      ) {
        // Daily data
        const dateStr = `${month}-${day}-${year}`;

        if (this.selectedLocation) {
          // Get reserve for specific location
          const user = usersToProcess[0];
          if (user && user.reserve) {
            let dayReserve = 0;
            Object.entries(user.reserve).forEach(([dateKey, amount]) => {
              const normalizedDate = dateKey.split('-').slice(0, 3).join('-');
              if (normalizedDate === dateStr) {
                const numericAmount = amount.split(':')[0];
                dayReserve += parseInt(numericAmount, 10);
              }
            });
            reserve = dayReserve.toString();
          }
        } else {
          // Get total reserve for all users
          reserve = this.compute.findTodayTotalResultsGivenField(
            this.allUsers,
            'reserve',
            dateStr
          );
        }
      } else {
        // Monthly data - sum all days in the month (up to today if current month)
        const isCurrentMonth = month === currentMonth && year === currentYear;
        const daysInMonth = isCurrentMonth
          ? today
          : new Date(year, month, 0).getDate();
        let monthReserve = 0;

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${month}-${d}-${year}`;
          let dayReserve: string = '0';

          if (this.selectedLocation) {
            const user = usersToProcess[0];
            if (user && user.reserve) {
              let dayReserveNum = 0;
              Object.entries(user.reserve).forEach(([dateKey, amount]) => {
                const normalizedDate = dateKey.split('-').slice(0, 3).join('-');
                if (normalizedDate === dateStr) {
                  const numericAmount = amount.split(':')[0];
                  dayReserveNum += parseInt(numericAmount, 10);
                }
              });
              dayReserve = dayReserveNum.toString();
            }
          } else {
            dayReserve = this.compute.findTodayTotalResultsGivenField(
              this.allUsers,
              'reserve',
              dateStr
            );
          }
          monthReserve += this.toNum(dayReserve);
        }
        reserve = monthReserve.toString();
      }

      const reserveNum = this.toNum(reserve);
      // Convert to dollars
      const reserveInDollars = this.toNum(
        this.compute.convertCongoleseFrancToUsDollars(reserveNum.toString())
      );

      // Only add non-zero values
      if (reserveInDollars > 0) {
        // Format label based on range
        let label: string;
        if (
          this.selectedTimeRange === '1D' ||
          this.selectedTimeRange === '1W' ||
          this.selectedTimeRange === '1M'
        ) {
          label = day.toString();
        } else {
          // Monthly labels
          const monthNames = [
            'Jan',
            'Fév',
            'Mar',
            'Avr',
            'Mai',
            'Jun',
            'Jul',
            'Aoû',
            'Sep',
            'Oct',
            'Nov',
            'Déc',
          ];
          label = `${monthNames[month - 1]} ${year}`;
        }
        tempData.push({ label, value: reserveInDollars });
      }
    });

    // Extract filtered labels and values
    tempData.forEach((item) => {
      labels.push(item.label);
      values.push(item.value);
    });

    // Get first and last reserve values (in dollars)
    const firstReserve = values[0] || 0;
    const lastReserve = values[values.length - 1] || 0;

    // Determine color: red if first > last (decreased), green if first < last (increased)
    // Stock market style: green for gains, red for losses
    const isPositive = lastReserve >= firstReserve;
    const lineColor = isPositive ? '#26a69a' : '#ef5350'; // Teal green or red
    const fillGradient = isPositive
      ? ['rgba(38, 166, 154, 0.1)', 'rgba(38, 166, 154, 0)'] // Green gradient
      : ['rgba(239, 83, 80, 0.1)', 'rgba(239, 83, 80, 0)']; // Red gradient

    // Build title with location name if selected
    const locationPrefix = this.selectedLocation
      ? `${this.selectedLocation} - `
      : '';
    const rangeLabels: { [key: string]: string } = {
      '1D': '1 Jour',
      '1W': '1 Semaine',
      '1M': '1 Mois',
      '6M': '6 Mois',
      '1Y': '1 An',
      MAX: 'Maximum',
    };
    const titleText = `${locationPrefix}Réserve - ${
      rangeLabels[this.selectedTimeRange]
    }`;

    // Calculate percentage change
    const change = lastReserve - firstReserve;
    const changePercent =
      firstReserve > 0 ? ((change / firstReserve) * 100).toFixed(2) : '0.00';
    const changeSign = change >= 0 ? '+' : '';

    this.monthlyReserveGraph = {
      data: [
        {
          x: labels,
          y: values,
          type: 'scatter',
          mode: 'lines',
          line: {
            color: lineColor,
            width: 2.5,
            shape: 'spline', // Smooth curves like stock charts
          },
          fill: 'tozeroy',
          fillcolor: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorstops: [
              { offset: 0, color: fillGradient[0] },
              { offset: 1, color: fillGradient[1] },
            ],
          },
          hovertemplate:
            '<b>Jour %{x}</b><br>' +
            'Réserve: <b>$%{y:,.2f}</b><extra></extra>',
        },
      ],
      layout: {
        title: {
          text: titleText,
          font: {
            size: 20,
            color: '#1a1a1a',
            family: 'system-ui, -apple-system, sans-serif',
          },
          x: 0.02,
          y: 0.95,
          xanchor: 'left',
          yanchor: 'top',
        },
        annotations: [
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.02,
            y: 0.85,
            xanchor: 'left',
            yanchor: 'top',
            text: `<span style="font-size: 28px; font-weight: 600; color: #1a1a1a;">$${lastReserve.toLocaleString(
              'en-US',
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}</span><br><span style="font-size: 14px; color: ${lineColor};">${changeSign}$${change.toLocaleString(
              'en-US',
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )} (${changeSign}${changePercent}%)</span>`,
            showarrow: false,
            align: 'left',
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            bordercolor: 'transparent',
            borderpad: 8,
          },
        ],
        xaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          tickfont: {
            size: 11,
            color: '#666',
          },
          title: {
            text: '',
            font: { size: 12, color: '#666' },
          },
        },
        yaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          side: 'right',
          tickfont: {
            size: 11,
            color: '#666',
          },
          tickformat: '$,.0f',
          title: {
            text: '',
            font: { size: 12, color: '#666' },
          },
        },
        height: 450,
        margin: { t: 100, r: 20, l: 20, b: 40 },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
        hovermode: 'x unified',
        showlegend: false,
        autosize: true,
      },
      config: {
        responsive: true,
        displayModeBar: false,
        staticPlot: false,
      },
    };
  }

  private updateMonthlyPaymentGraph() {
    if (!this.allUsers || this.allUsers.length === 0) {
      this.monthlyPaymentGraph = this.createEmptyPaymentGraph();
      return;
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const today = currentDate.getDate();

    if (this.selectedPaymentTimeRange === '1M') {
      this.monthlyPaymentGraph = this.buildMonthlyComparisonGraph({
        field: 'dailyReimbursement',
        title: 'Paiement',
        selectedLocation: this.selectedPaymentLocation,
        currentMonth,
        currentYear,
        today,
      });
      return;
    }

    let startDate: Date;
    const endDate = new Date(currentYear, currentMonth - 1, today);

    switch (this.selectedPaymentTimeRange) {
      case '1D':
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '1W':
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6);
        break;
      case '6M':
        startDate = new Date(currentYear, currentMonth - 1, 1);
        startDate.setMonth(startDate.getMonth() - 5);
        break;
      case '1Y':
        startDate = new Date(currentYear, currentMonth - 1, 1);
        startDate.setMonth(startDate.getMonth() - 11);
        break;
      case 'MAX':
        let earliestDate: Date | null = null;
        this.allUsers.forEach((user) => {
          if (user.dailyReimbursement) {
            Object.keys(user.dailyReimbursement).forEach((dateStr) => {
              const normalizedDate = dateStr.split('-').slice(0, 3).join('-');
              const [month, day, year] = normalizedDate.split('-').map(Number);
              const date = new Date(year, month - 1, day);
              if (!earliestDate || date < earliestDate) {
                earliestDate = date;
              }
            });
          }
        });
        startDate = earliestDate || new Date(currentYear, currentMonth - 1, 1);
        break;
      default:
        startDate = new Date(currentYear, currentMonth - 1, 1);
    }

    const labels: string[] = [];
    const values: number[] = [];
    const dateArray: Date[] = [];

    const usersToProcess = this.selectedPaymentLocation
      ? this.allUsers.filter((user) => user.firstName === this.selectedPaymentLocation)
      : this.allUsers;

    if (
      this.selectedPaymentTimeRange === '1D' ||
      this.selectedPaymentTimeRange === '1W'
    ) {
      const todayDate = new Date(currentYear, currentMonth - 1, today);
      const actualEndDate = endDate > todayDate ? todayDate : endDate;
      for (
        let d = new Date(startDate);
        d <= actualEndDate;
        d.setDate(d.getDate() + 1)
      ) {
        dateArray.push(new Date(d));
      }
    } else {
      const startMonth = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        1
      );
      const endMonth = new Date(currentYear, currentMonth - 1, 1);
      for (
        let d = new Date(startMonth);
        d <= endMonth;
        d.setMonth(d.getMonth() + 1)
      ) {
        dateArray.push(new Date(d));
      }
    }

    const tempData: { label: string; value: number }[] = [];

    dateArray.forEach((date) => {
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const year = date.getFullYear();

      let payment: string = '0';

      if (
        this.selectedPaymentTimeRange === '1D' ||
        this.selectedPaymentTimeRange === '1W' ||
        this.selectedPaymentTimeRange === '1M'
      ) {
        const dateStr = `${month}-${day}-${year}`;

        if (this.selectedPaymentLocation) {
          const user = usersToProcess[0];
          if (user && user.dailyReimbursement) {
            let dayPayment = 0;
            Object.entries(user.dailyReimbursement).forEach(([dateKey, amount]) => {
              const normalizedDate = dateKey.split('-').slice(0, 3).join('-');
              if (normalizedDate === dateStr) {
                const numericAmount = amount.split(':')[0];
                dayPayment += parseInt(numericAmount, 10);
              }
            });
            payment = dayPayment.toString();
          }
        } else {
          payment = this.compute.findTodayTotalResultsGivenField(
            this.allUsers,
            'dailyReimbursement',
            dateStr
          );
        }
      } else {
        const isCurrentMonth = month === currentMonth && year === currentYear;
        const daysInMonth = isCurrentMonth
          ? today
          : new Date(year, month, 0).getDate();
        let monthPayment = 0;

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${month}-${d}-${year}`;
          let dayPayment: string = '0';

          if (this.selectedPaymentLocation) {
            const user = usersToProcess[0];
            if (user && user.dailyReimbursement) {
              let dayPaymentNum = 0;
              Object.entries(user.dailyReimbursement).forEach(([dateKey, amount]) => {
                const normalizedDate = dateKey.split('-').slice(0, 3).join('-');
                if (normalizedDate === dateStr) {
                  const numericAmount = amount.split(':')[0];
                  dayPaymentNum += parseInt(numericAmount, 10);
                }
              });
              dayPayment = dayPaymentNum.toString();
            }
          } else {
            dayPayment = this.compute.findTodayTotalResultsGivenField(
              this.allUsers,
              'dailyReimbursement',
              dateStr
            );
          }
          monthPayment += this.toNum(dayPayment);
        }
        payment = monthPayment.toString();
      }

      const paymentNum = this.toNum(payment);
      const paymentInDollars = this.toNum(
        this.compute.convertCongoleseFrancToUsDollars(paymentNum.toString())
      );

      if (paymentInDollars > 0) {
        let label: string;
        if (
          this.selectedPaymentTimeRange === '1D' ||
          this.selectedPaymentTimeRange === '1W' ||
          this.selectedPaymentTimeRange === '1M'
        ) {
          label = day.toString();
        } else {
          const monthNames = [
            'Jan',
            'Fév',
            'Mar',
            'Avr',
            'Mai',
            'Jun',
            'Jul',
            'Aoû',
            'Sep',
            'Oct',
            'Nov',
            'Déc',
          ];
          label = `${monthNames[month - 1]} ${year}`;
        }
        tempData.push({ label, value: paymentInDollars });
      }
    });

    tempData.forEach((item) => {
      labels.push(item.label);
      values.push(item.value);
    });

    const firstPayment = values[0] || 0;
    const lastPayment = values[values.length - 1] || 0;
    const isPositive = lastPayment >= firstPayment;
    const lineColor = isPositive ? '#26a69a' : '#ef5350';
    const fillGradient = isPositive
      ? ['rgba(38, 166, 154, 0.1)', 'rgba(38, 166, 154, 0)']
      : ['rgba(239, 83, 80, 0.1)', 'rgba(239, 83, 80, 0)'];

    const locationPrefix = this.selectedPaymentLocation
      ? `${this.selectedPaymentLocation} - `
      : '';
    const rangeLabels: { [key: string]: string } = {
      '1D': '1 Jour',
      '1W': '1 Semaine',
      '1M': '1 Mois',
      '6M': '6 Mois',
      '1Y': '1 An',
      MAX: 'Maximum',
    };
    const titleText = `${locationPrefix}Paiement - ${
      rangeLabels[this.selectedPaymentTimeRange]
    }`;

    const change = lastPayment - firstPayment;
    const changePercent =
      firstPayment > 0 ? ((change / firstPayment) * 100).toFixed(2) : '0.00';
    const changeSign = change >= 0 ? '+' : '';

    this.monthlyPaymentGraph = {
      data: [
        {
          x: labels,
          y: values,
          type: 'scatter',
          mode: 'lines',
          line: {
            color: lineColor,
            width: 2.5,
            shape: 'spline',
          },
          fill: 'tozeroy',
          fillcolor: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorstops: [
              { offset: 0, color: fillGradient[0] },
              { offset: 1, color: fillGradient[1] },
            ],
          },
          hovertemplate:
            '<b>Jour %{x}</b><br>' +
            'Paiement: <b>$%{y:,.2f}</b><extra></extra>',
        },
      ],
      layout: {
        title: {
          text: titleText,
          font: {
            size: 20,
            color: '#1a1a1a',
            family: 'system-ui, -apple-system, sans-serif',
          },
          x: 0.02,
          y: 0.95,
          xanchor: 'left',
          yanchor: 'top',
        },
        annotations: [
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.02,
            y: 0.85,
            xanchor: 'left',
            yanchor: 'top',
            text: `<span style="font-size: 28px; font-weight: 600; color: #1a1a1a;">$${lastPayment.toLocaleString(
              'en-US',
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}</span><br><span style="font-size: 14px; color: ${lineColor};">${changeSign}$${change.toLocaleString(
              'en-US',
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )} (${changeSign}${changePercent}%)</span>`,
            showarrow: false,
            align: 'left',
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            bordercolor: 'transparent',
            borderpad: 8,
          },
        ],
        xaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          tickfont: {
            size: 11,
            color: '#666',
          },
          title: {
            text: '',
            font: { size: 12, color: '#666' },
          },
        },
        yaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          side: 'right',
          tickfont: {
            size: 11,
            color: '#666',
          },
          tickformat: '$,.0f',
          title: {
            text: '',
            font: { size: 12, color: '#666' },
          },
        },
        height: 450,
        margin: { t: 100, r: 20, l: 20, b: 40 },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
        hovermode: 'x unified',
        showlegend: false,
        autosize: true,
      },
      config: {
        responsive: true,
        displayModeBar: false,
        staticPlot: false,
      },
    };
  }

  private buildMonthlyComparisonGraph(options: {
    field: 'reserve' | 'dailyReimbursement';
    title: string;
    selectedLocation: string | null;
    currentMonth: number;
    currentYear: number;
    today: number;
  }): { data: any[]; layout: any; config?: any } {
    const { month: selectedMonth, year: selectedYear } =
      this.getMonthPickerSelection();
    const selectedMonthDays = new Date(selectedYear, selectedMonth, 0).getDate();
    const selectedDayLimit = this.isSameMonthYear(
      selectedMonth,
      selectedYear,
      options.currentMonth,
      options.currentYear
    )
      ? options.today
      : selectedMonthDays;
    const currentMonthDays = new Date(
      options.currentYear,
      options.currentMonth,
      0
    ).getDate();

    const locationUser = options.selectedLocation
      ? this.allUsers.find((user) => user.firstName === options.selectedLocation)
      : undefined;

    const selectedSeries = this.buildDailySeries(
      options.field,
      selectedMonth,
      selectedYear,
      selectedMonthDays,
      selectedDayLimit,
      locationUser
    );
    const currentSeries = this.buildDailySeries(
      options.field,
      options.currentMonth,
      options.currentYear,
      currentMonthDays,
      options.today,
      locationUser
    );

    const selectedX = Array.from({ length: selectedSeries.length }, (_, i) =>
      (i + 1).toString()
    );
    const currentX = Array.from({ length: currentSeries.length }, (_, i) =>
      (i + 1).toString()
    );
    const showComparison = !this.isSameMonthYear(
      selectedMonth,
      selectedYear,
      options.currentMonth,
      options.currentYear
    );

    const firstValue = this.getFirstDefinedValue(selectedSeries);
    const lastValue = this.getLastDefinedValue(selectedSeries);
    const change = lastValue - firstValue;
    const changePercent =
      firstValue > 0 ? ((change / firstValue) * 100).toFixed(2) : '0.00';
    const changeSign = change >= 0 ? '+' : '';
    const isPositive = lastValue >= firstValue;
    const lineColor = isPositive ? '#26a69a' : '#ef5350';
    const fillGradient = isPositive
      ? ['rgba(38, 166, 154, 0.1)', 'rgba(38, 166, 154, 0)']
      : ['rgba(239, 83, 80, 0.1)', 'rgba(239, 83, 80, 0)'];

    const selectedLabel = `${this.time.monthFrenchNames[selectedMonth - 1]} ${selectedYear}`;
    const currentLabel = `${this.time.monthFrenchNames[options.currentMonth - 1]} ${options.currentYear}`;

    const traces: any[] = [
      {
        x: selectedX,
        y: selectedSeries,
        name: `Sélection: ${selectedLabel}`,
        type: 'scatter',
        mode: 'lines',
        line: {
          color: lineColor,
          width: 2.5,
          shape: 'spline',
        },
        connectgaps: true,
        fill: 'tozeroy',
        fillcolor: {
          type: 'linear',
          x: 0,
          y: 0,
          x2: 0,
          y2: 1,
          colorstops: [
            { offset: 0, color: fillGradient[0] },
            { offset: 1, color: fillGradient[1] },
          ],
        },
        hovertemplate:
          `<b>Jour %{x}</b><br>${options.title}: <b>$%{y:,.2f}</b><extra>${selectedLabel}</extra>`,
      },
    ];

    if (showComparison) {
      traces.push({
        x: currentX,
        y: currentSeries,
        name: `Mois actuel: ${currentLabel}`,
        type: 'scatter',
        mode: 'lines',
        line: {
          color: '#2563eb',
          width: 2,
          shape: 'spline',
          dash: 'dot',
        },
        connectgaps: true,
        hovertemplate:
          `<b>Jour %{x}</b><br>${options.title}: <b>$%{y:,.2f}</b><extra>${currentLabel}</extra>`,
      });
    }

    const locationPrefix = options.selectedLocation
      ? `${options.selectedLocation} - `
      : '';
    const titleText = `${locationPrefix}${options.title} - Comparaison 1 Mois`;

    return {
      data: traces,
      layout: {
        title: {
          text: titleText,
          font: {
            size: 20,
            color: '#1a1a1a',
            family: 'system-ui, -apple-system, sans-serif',
          },
          x: 0.02,
          y: 0.95,
          xanchor: 'left',
          yanchor: 'top',
        },
        annotations: [
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.02,
            y: 0.85,
            xanchor: 'left',
            yanchor: 'top',
            text: `<span style=\"font-size: 28px; font-weight: 600; color: #1a1a1a;\">$${lastValue.toLocaleString(
              'en-US',
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}</span><br><span style=\"font-size: 14px; color: ${lineColor};\">${changeSign}$${change.toLocaleString(
              'en-US',
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )} (${changeSign}${changePercent}%)</span>`,
            showarrow: false,
            align: 'left',
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            bordercolor: 'transparent',
            borderpad: 8,
          },
        ],
        xaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          tickfont: {
            size: 11,
            color: '#666',
          },
          title: {
            text: '',
            font: { size: 12, color: '#666' },
          },
        },
        yaxis: {
          showgrid: true,
          gridcolor: 'rgba(0, 0, 0, 0.05)',
          gridwidth: 1,
          showline: false,
          zeroline: false,
          side: 'right',
          tickfont: {
            size: 11,
            color: '#666',
          },
          tickformat: '$,.0f',
          title: {
            text: '',
            font: { size: 12, color: '#666' },
          },
        },
        height: 450,
        margin: { t: 100, r: 20, l: 20, b: 40 },
        plot_bgcolor: '#ffffff',
        paper_bgcolor: '#ffffff',
        hovermode: 'x unified',
        showlegend: traces.length > 1,
        legend: {
          orientation: 'h',
          y: 1.15,
          x: 0,
          font: { size: 11 },
        },
        autosize: true,
      },
      config: {
        responsive: true,
        displayModeBar: false,
        staticPlot: false,
      },
    };
  }

  private createEmptyGraph(title?: string) {
    return {
      data: [],
      layout: {
        title: {
          text: title || 'Réserve Totale - Ce Mois',
          font: { size: 18, color: '#0f172a' },
        },
        xaxis: { title: 'Jour du mois' },
        yaxis: { title: 'Réserve ($)' },
        height: 400,
        margin: { t: 50, r: 20, l: 60, b: 50 },
        plot_bgcolor: 'rgba(255,255,255,0)',
        paper_bgcolor: 'rgba(255,255,255,0)',
      },
      config: { responsive: true, displayModeBar: false },
    };
  }

  private createEmptyPaymentGraph(title?: string) {
    return {
      data: [],
      layout: {
        title: {
          text: title || 'Paiement Total - Ce Mois',
          font: { size: 18, color: '#0f172a' },
        },
        xaxis: { title: 'Jour du mois' },
        yaxis: { title: 'Paiement ($)' },
        height: 400,
        margin: { t: 50, r: 20, l: 60, b: 50 },
        plot_bgcolor: 'rgba(255,255,255,0)',
        paper_bgcolor: 'rgba(255,255,255,0)',
      },
      config: { responsive: true, displayModeBar: false },
    };
  }

  private updateMiniGraphs() {
    if (!this.allUsers || this.allUsers.length === 0) {
      this.miniReserveGraphs.clear();
      this.miniPaymentGraphs.clear();
      return;
    }

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();
    const today = currentDate.getDate();

    // Clear existing graphs
    this.miniReserveGraphs.clear();
    this.miniPaymentGraphs.clear();

    // Generate mini graphs for each user
    this.allUsers.forEach((user) => {
      if (!user.firstName) return;

      // Reserve mini graph
      if (user.reserve) {
        const reserveGraph = this.createMiniGraph(
          user,
          'reserve',
          currentMonth,
          currentYear,
          today
        );
        if (reserveGraph) {
          this.miniReserveGraphs.set(user.firstName, reserveGraph);
        }
      }

      // Payment mini graph
      if (user.dailyReimbursement) {
        const paymentGraph = this.createMiniGraph(
          user,
          'dailyReimbursement',
          currentMonth,
          currentYear,
          today
        );
        if (paymentGraph) {
          this.miniPaymentGraphs.set(user.firstName, paymentGraph);
        }
      }
    });
  }

  private createMiniGraph(
    user: User,
    field: 'reserve' | 'dailyReimbursement',
    currentMonth: number,
    currentYear: number,
    today: number
  ): { data: any[]; layout: any; config?: any } | null {
    const data = user[field];
    if (!data) return null;

    const values: number[] = [];

    // Get last 4 days of data for better curve visualization
    // Only include non-zero values
    for (let i = 3; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1, today - i);
      // Allow cross-month boundaries for better data
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const dateStr = `${month}-${day}-${year}`;

      let dayValue = 0;
      try {
        Object.entries(data).forEach(([dateKey, amount]) => {
          const normalizedDate = dateKey.split('-').slice(0, 3).join('-');
          if (normalizedDate === dateStr) {
            const numericAmount = String(amount).split(':')[0];
            dayValue += parseInt(numericAmount, 10) || 0;
          }
        });
      } catch (e) {
        // Skip if error
        dayValue = 0;
      }

      const valueInDollars = this.toNum(
        this.compute.convertCongoleseFrancToUsDollars(dayValue.toString())
      );

      // Only add non-zero values
      if (valueInDollars > 0) {
        values.push(valueInDollars);
      }
    }

    if (values.length < 2) {
      return this.createEmptyMiniGraph();
    }

    // Determine color based on trend (compare first to last)
    const firstValue = values[0] || 0;
    const lastValue = values[values.length - 1] || 0;
    const isPositive = lastValue >= firstValue;
    const lineColor = isPositive ? '#26a69a' : '#ef5350';

    // Normalize values to fit nicely in the small space (0-100 scale)
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1; // Avoid division by zero
    const normalizedValues = values.map((v) => ((v - minVal) / range) * 100);

    // Create sequential x-axis indices for non-zero values
    const xIndices = values.map((_, index) => index);

    return {
      data: [
        {
          x: xIndices,
          y: normalizedValues,
          type: 'scatter',
          mode: 'lines',
          line: {
            color: lineColor,
            width: 2.5,
            shape: 'spline',
          },
          fill: 'tozeroy',
          fillcolor: lineColor + '15',
          hovertemplate: '<b>$%{customdata:,.2f}</b><extra></extra>',
          customdata: values, // Store original values for hover
        },
      ],
      layout: {
        height: 40,
        width: 100,
        margin: { t: 2, r: 2, l: 2, b: 2 },
        xaxis: {
          showgrid: false,
          showticklabels: false,
          zeroline: false,
          showline: false,
          range:
            xIndices.length > 0
              ? [xIndices[0] - 0.1, xIndices[xIndices.length - 1] + 0.1]
              : [-0.1, 2.1],
        },
        yaxis: {
          showgrid: false,
          showticklabels: false,
          zeroline: false,
          showline: false,
          range: [0, 100],
        },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
        showlegend: false,
      },
      config: {
        responsive: false,
        displayModeBar: false,
        staticPlot: true,
      },
    };
  }

  getMiniReserveGraph(locationName: string): {
    data: any[];
    layout: any;
    config?: any;
  } {
    return (
      this.miniReserveGraphs.get(locationName) || this.createEmptyMiniGraph()
    );
  }

  getMiniPaymentGraph(locationName: string): {
    data: any[];
    layout: any;
    config?: any;
  } {
    return (
      this.miniPaymentGraphs.get(locationName) || this.createEmptyMiniGraph()
    );
  }

  private createEmptyMiniGraph() {
    return {
      data: [],
      layout: {
        height: 40,
        width: 100,
        margin: { t: 0, r: 0, l: 0, b: 0 },
        xaxis: {
          showgrid: false,
          showticklabels: false,
          zeroline: false,
          showline: false,
        },
        yaxis: {
          showgrid: false,
          showticklabels: false,
          zeroline: false,
          showline: false,
        },
        plot_bgcolor: 'rgba(0,0,0,0)',
        paper_bgcolor: 'rgba(0,0,0,0)',
      },
      config: { responsive: false, displayModeBar: false, staticPlot: true },
    };
  }
}
