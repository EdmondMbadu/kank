import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of, Subscription } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { User } from 'src/app/models/user';
import { Client } from 'src/app/models/client';
import { Card } from 'src/app/models/card';
import { DataService } from 'src/app/services/data.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { exportElementAsPng } from 'src/app/utils/element-png-export.util';

type WeeklyProgressTone = 'red' | 'yellow' | 'orange' | 'green';
type WeeklyPaymentHistoryPreset = '1M' | '3M' | '6M' | '1A' | 'MAX';
type WeeklyPaymentHistoryRange = WeeklyPaymentHistoryPreset | 'CUSTOM';
type WeeklyPaymentHistoryMode =
  | 'payment'
  | 'cashFlow'
  | 'paymentCashFlowCombined'
  | 'combined'
  | 'cashFlowCombined'
  | 'reserve';
type WeeklyPaymentHistoryMetric = 'payment' | 'cashFlow' | 'reserve';
type WeeklyPaymentViewMode = 'ranking' | 'detailed';
type WeeklyPaymentSourceMode = 'total' | 'cashFlow';
type GestionHeatmapMode =
  | 'paymentToday'
  | 'reserveToday'
  | 'paymentWeek'
  | 'reserveWeek';

interface WeeklyProgressMarker {
  amountFc: number;
  label: string;
  percent: number;
}

interface WeeklyPaymentHistoryPoint {
  weekStart: Date;
  totalFc: number;
  cashFlowFc: number;
  reserveFc: number;
  boundaryNote: string;
}

interface WeeklyPaymentTotalRow {
  firstName: string;
  total: number;
  totalInDollar: number;
  weeklyReserveFc: number;
  weeklyReserveDollar: number;
  weeklyReserveProgressPercent: number;
  weeklyReserveProgressTone: WeeklyProgressTone;
  weeklyReserveProgressStatusLabel: string;
  weeklyExpectedFc: number;
  weeklyExpectedDollar: number;
  weeklyExpectedProgressPercent: number;
  weeklyExpectedProgressTone: WeeklyProgressTone;
  weeklyTargetFc: number;
  weeklyProgressPercent: number;
  weeklyTargetReached: boolean;
  weeklyProgressTone: WeeklyProgressTone;
  weeklyProgressStatusLabel: string;
  weeklyProgressMarkers: WeeklyProgressMarker[];
  trackingId: string;
}

interface GestionHeatmapOption {
  mode: GestionHeatmapMode;
  label: string;
}

interface GestionHeatmapTile {
  label: string;
  shortLabel: string;
  valueFc: number;
  compactValue: string;
  valueDollar: number;
  expectedFc: number;
  percent: number;
  sharePercent: number;
  tone: WeeklyProgressTone;
  statusLabel: string;
  detailLabel: string;
  layoutStyle: { [key: string]: string };
}

interface GestionHeatmapRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UpcomingRequestDateTotal {
  dateKey: string;
  displayDate: string;
  totalFc: number;
  totalDollar: number;
}

@Component({
  selector: 'app-gestion-day',
  templateUrl: './gestion-day.component.html',
  styleUrls: ['./gestion-day.component.css'],
})
export class GestionDayComponent implements OnInit, OnDestroy {
  @ViewChild('weeklyPaymentCapture', { read: ElementRef })
  weeklyPaymentCapture?: ElementRef<HTMLElement>;

  size = 220;
  strokeWidth = 16;
  avgPerf = 0; // 0..100
  gradId = 'perfGrad-' + Math.random().toString(36).slice(2);
  managementInfo?: Management = {};
  reserveRevealTimeInput = '22:30';
  isSavingReserveRevealTime = false;
  auditTablesError = '';
  private darkModeObserver?: MutationObserver;
  private weeklyPaymentTargetSubscription?: Subscription;
  private auditTablesRequestVersion = 0;
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    public compute: ComputationService,
    private data: DataService,
    private afs: AngularFirestore
  ) {}
  ngOnInit(): void {
    this.observeDarkModeChanges();

    const cachedManagementInfo = this.auth.managementInfo as Management;
    if (
      this.isAuditTeamViewer &&
      cachedManagementInfo &&
      Object.keys(cachedManagementInfo).length > 0
    ) {
      this.applyManagementInfo(cachedManagementInfo);
    }

    if (!this.isAuditTeamViewer) {
      this.weeklyPaymentTargetSubscription =
        this.auth.weeklyPaymentTarget$.subscribe(() => {
          this.refreshWeeklyPaymentTargetCells();
        });
    }

    this.auth.getManagementInfo().subscribe((data) => {
      this.applyManagementInfo(data?.[0] || {});
    });

    // get all clients to find what is needed for tomorrow
    this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      // this is really weird. maybe some apsect of angular. but it works for now
      if (
        (this.isAuditTeamViewer && this.allUsers.length > 0) ||
        (!this.isAuditTeamViewer && this.allUsers.length > 1)
      ) {
        if (this.isAuditTeamViewer) {
          this.getAuditOperationalTables();
        } else {
          this.getAllClients();
        }
        // this.getAllClientsCard();
      }
      if (this.auth.isAdmin && this.allUsers.length > 0) {
        void this.loadPurePaymentsForSelectedDay();
        this.updateWeeklyPaymentDate();
      }
    });
  }

  private applyManagementInfo(managementInfo: Management): void {
    this.managementInfo = managementInfo;
    this.reserveRevealTimeInput = this.normalizeRevealTime(
      this.managementInfo?.reserveRevealTimeKinshasa
    );
    this.initalizeInputs();

    if (this.isAuditTeamViewer) return;

    this.updateReserveGraphics(this.graphicsRange);
    this.updateServeGraphics(this.graphicsRangeServe);
    this.updateCombinedGraphics(this.graphicsRangeCombined);
  }
  ngOnDestroy(): void {
    this.weeklyPaymentTargetSubscription?.unsubscribe();
    this.darkModeObserver?.disconnect();
  }
  percentage: string = '0';
  week: number = 5;
  month: number = 20;
  day: number = 1;
  theDay: string = new Date().toLocaleString('en-US', { weekday: 'long' });
  graphicsRange: number = this.week;
  graphicsRangeServe: number = this.week;
  graphicsRangeCombined: number = this.week;
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth() + 1;
  givenMonth: number = this.currentMonth;
  year = this.currentDate.getFullYear();
  givenYear = this.year;
  maxRange = 0;
  recentReserveDates: string[] = [];
  recentReserveAmounts: number[] = [];
  recentServeDates: string[] = [];
  recentServeAmounts: number[] = [];
  dailyExpense: string = '0';
  dailyOtherExpense: string = '0';
  dailyBudgetExpense = '0';
  dailyPayment: string = '0';
  dailyBankFranc: string = '0';
  dailyBankDollar: string = '0';
  dailyServed: string = '0';
  dailyLoss: string = '0';
  dollarLoss: string = '0';
  dailyReserve: string = '0';
  dailyInvestment: string = '0';
  total: string = '';
  totalCard: string = '';
  track: number = 0;
  budgetReason = '';

  userServeTodayTotals: Array<{
    firstName: string;
    total: number;
    totalInDollar: number;
    trackingId: string;
  }> = [];

  // NEW: grand totals for “today”
  overallTotalToday: number = 0;
  overallTotalTodayInDollars: number = 0;

  // ─── add new aggregate just after paymentTotal ──────────────
  overallMoneyInHands = 0;
  overallMoneyInHandsDollar = 0;
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

  clientsRequestLending: Client[] = [];
  clientsRequestSavings: Client[] = [];
  clientsRequestCard: Card[] = [];
  cards: Card[] = [];
  public graph: any = {
    data: [{}],
    layout: {
      title: 'Reserve Journalier en $',
      barmode: 'stack',
    },
  };
  public graphServe: any = {
    data: [{}],
    layout: {
      title: 'Argent A Servir Journalier en $',
      barmode: 'stack',
    },
  };

  public graphCombined: any = {
    data: [{}],
    layout: {
      title: 'Argent A Servir Journalier en $',
      barmode: 'stack',
    },
  };

  moneyInHands: string = '0';

  totalPerfomance: number = 0;

  linkPaths: string[] = [
    '/gestion-reserve',
    '/gestion-reserve',
    '/gestion-today',
    '/gestion-expenses',
    '/gestion-served',
    '/gestion-served',
    '/gestion-bank',
    '/gestion-loss',
    '/gestion-investment',
    '/gestion-fraudes',
    '/gestion-today',
    '/gestion-money-in-hands-activity',
  ];
  summary: string[] = [
    'Pourcentage Perte Du Mois',
    'Reserve Du Jour',
    'Argent En Main',
    'Depense Du Jour',
    'Dépenses Planifiées Du Jour',
    'Argent A Servir',
    'Argent En Banque Du Jour',
    'Perte Du Jour',
    'Investissement Du Jour',
    'Suivi des fraudes du mois',
    'Autres dépenses',
    'Traçabilité Argent en main',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/loss-ratio.png',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/salary.png',
    '../../../assets/img/expense.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/serve-money.png',
    '../../../assets/img/bank.png',
    '../../../assets/img/loss.png',
    '../../../assets/img/invest.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/audit.png',
  ];

  isFetchingClients = false;
  currentClients: Array<Client[]> = [];
  currentClientsReserve: Client[] = [];
  allUsers: User[] = [];
  allClients?: Client[];
  allCurrentClients?: Client[] = [];
  allClientsCard?: Card[];
  userRequestTotals: Array<{
    firstName: string;

    total: number;
    totalInDollar: number;
    trackingId: string;
  }> = [];
  reserveTotals: Array<{
    firstName: string;
    payment?: number;
    paymentDollar?: number;
    purePayment?: number;
    purePaymentDollar?: number;
    total: number;
    totalInDollar: number;
    actual?: number;
    actualInDollar?: number;
    hasActualSubmission?: boolean;
    trackingId: string;
    // NEW
    missingReasons?: number; // # comments still absent
    totalReasons?: number; // # clients to leave a comment
    paidClientsToday?: number;
    unpaidClientsToday?: number;
    moneyInHands: number;
    moneyInHandsDollar: number;
    transportAmount?: number;
    dayExpense?: number;
    dayExpenseDollar?: number;
  }> = [];
  overallTotal: number = 0;
  overallTotalReserve: number = 0;
  overallTotalInDollars: number = 0;
  upcomingRequestTotals: UpcomingRequestDateTotal[] = [];
  overallUpcomingRequestTotal = 0;
  overallUpcomingRequestTotalInDollars = 0;
  isUpcomingRequestsExpanded = false;
  upcomingRequestsReady = false;
  private upcomingRequestsByDate = new Map<string, number>();
  paymentTotal: number = 0;
  purePaymentTotal = 0;
  purePaymentTotalDollar = 0;
  purePaymentLoading = false;
  purePaymentError = '';
  private purePaymentLoadingKey = '';
  private purePaymentRequestVersion = 0;
  private purePaymentsByTeam = new Map<string, number>();
  private readonly purePaymentCache = new Map<
    string,
    ReadonlyMap<string, number>
  >();
  overallTotalReserveInDollars: number = 0;
  overallTransportAmount: number = 0;
  overallMissingReasons: number = 0;
  overallTotalReasons: number = 0;
  overallPaidClientsToday: number = 0;
  overallUnpaidClientsToday: number = 0;
  weeklyPaymentDate: string = this.time.getTodaysDateYearMonthDay();
  weeklyPaymentDateCorrectFormat: string = this.time.todaysDateMonthDayYear();
  weeklyPaymentRangeLabel: string = '';
  isCapturingWeeklyPayment = false;
  isCapturingWeeklyPaymentRanking = false;
  weeklyPaymentViewMode: WeeklyPaymentViewMode = 'ranking';
  weeklyPaymentSourceMode: WeeklyPaymentSourceMode = 'total';
  weeklyCashFlowTotals: WeeklyPaymentTotalRow[] = [];
  weeklyCashFlowLoading = false;
  weeklyCashFlowError = '';
  private weeklyCashFlowLoadingKey = '';
  private weeklyCashFlowRequestVersion = 0;
  private readonly weeklyCashFlowCache = new Map<
    string,
    ReadonlyMap<string, number>
  >();
  weeklyPaymentCaptureMessage = '';
  weeklyPaymentCaptureError = '';
  weeklyPaymentHistoryRange: WeeklyPaymentHistoryRange = '1M';
  weeklyPaymentHistoryMode: WeeklyPaymentHistoryMode = 'payment';
  weeklyPaymentHistoryIncludesCurrentWeek = false;
  weeklyPaymentHistoryStartDate = '';
  weeklyPaymentHistoryEndDate = '';
  weeklyPaymentHistoryDateError = '';
  weeklyPaymentHistoryCashFlowLoading = false;
  weeklyPaymentHistoryCashFlowError = '';
  private weeklyPaymentHistoryCashFlowLoadingKey = '';
  private weeklyPaymentHistoryCashFlowRequestVersion = 0;
  private readonly weeklyPaymentHistoryCashFlowCache = new Map<
    string,
    ReadonlyMap<number, number>
  >();
  readonly weeklyPaymentHistoryMaxDate =
    this.time.getTodaysDateYearMonthDay();
  readonly weeklyPaymentHistoryRanges: Array<{
    value: WeeklyPaymentHistoryPreset;
    label: string;
  }> = [
    { value: '1M', label: '1M' },
    { value: '3M', label: '3M' },
    { value: '6M', label: '6M' },
    { value: '1A', label: '1A' },
    { value: 'MAX', label: 'Max' },
  ];
  readonly weeklyPaymentHistoryModes: Array<{
    value: WeeklyPaymentHistoryMode;
    label: string;
  }> = [
    { value: 'payment', label: 'Paiement' },
    { value: 'cashFlow', label: 'Paiement cash flow' },
    { value: 'paymentCashFlowCombined', label: 'Paiement + Cash flow' },
    { value: 'combined', label: 'Paiement + Réserve' },
    { value: 'cashFlowCombined', label: 'Cash flow + Réserve' },
    { value: 'reserve', label: 'Réserve' },
  ];
  public graphWeeklyPayments: any = {
    data: [],
    layout: {},
    config: {
      responsive: true,
      displayModeBar: false,
      staticPlot: false,
    },
  };

  get weeklyPaymentHistoryDateRangeLabel(): string {
    const start = this.parseIsoDateKey(this.weeklyPaymentHistoryStartDate);
    const end = this.parseIsoDateKey(this.weeklyPaymentHistoryEndDate);
    if (!start || !end) return '';
    return `${this.formatNumericDate(start)} – ${this.formatNumericDate(end)}`;
  }

  get weeklyPaymentHistoryHeading(): string {
    if (this.weeklyPaymentHistoryMode === 'paymentCashFlowCombined') {
      return 'Comparaison des Paiements et du Cash flow de la Semaine';
    }
    if (this.weeklyPaymentHistoryMode === 'cashFlowCombined') {
      return 'Évolution du Cash flow et de la Réserve de la Semaine';
    }
    if (this.weeklyPaymentHistoryMode === 'combined') {
      return 'Évolution des Paiements et de la Réserve de la Semaine';
    }
    if (this.weeklyPaymentHistoryMode === 'cashFlow') {
      return 'Évolution des Paiements cash flow de la Semaine';
    }
    if (this.weeklyPaymentHistoryMode === 'reserve') {
      return 'Évolution de la Réserve de la Semaine';
    }
    return 'Évolution des Paiements de la Semaine';
  }

  get weeklyPaymentHistoryDescription(): string {
    if (this.weeklyPaymentHistoryMode === 'paymentCashFlowCombined') {
      return 'Paiements totaux et paiements clients encaissés, transferts d’épargne exclus, comparés semaine par semaine.';
    }
    if (this.weeklyPaymentHistoryMode === 'cashFlowCombined') {
      return 'Paiements clients encaissés, transferts d’épargne exclus, et réserves de toutes les équipes, regroupés du lundi au dimanche.';
    }
    if (this.weeklyPaymentHistoryMode === 'combined') {
      return 'Paiements et réserves de toutes les équipes, regroupés du lundi au dimanche.';
    }
    if (this.weeklyPaymentHistoryMode === 'cashFlow') {
      return 'Paiements clients encaissés de toutes les équipes, transferts d’épargne exclus, regroupés du lundi au dimanche.';
    }
    if (this.weeklyPaymentHistoryMode === 'reserve') {
      return 'Réserves de toutes les équipes, regroupées du lundi au dimanche.';
    }
    return 'Paiements de toutes les équipes, regroupés du lundi au dimanche.';
  }

  weeklyPaymentTotals: WeeklyPaymentTotalRow[] = [];
  readonly weeklyWorkingDays = 6;

  weeklyDailyAverage(value: number | string | null | undefined): number {
    return (Number(value) || 0) / this.weeklyWorkingDays;
  }

  get displayedWeeklyPaymentTotals(): WeeklyPaymentTotalRow[] {
    return this.weeklyPaymentSourceMode === 'cashFlow'
      ? this.weeklyCashFlowTotals
      : this.weeklyPaymentTotals;
  }

  get displayedOverallWeeklyPaymentTotal(): number {
    return this.displayedWeeklyPaymentTotals.reduce(
      (total, row) => total + (Number(row.total) || 0),
      0
    );
  }

  get displayedOverallWeeklyPaymentTotalDollar(): number {
    return this.convertFcToDollar(this.displayedOverallWeeklyPaymentTotal);
  }

  get displayedOverallWeeklyExpectedProgressPercent(): number {
    if (this.overallWeeklyExpectedTotal <= 0) {
      return this.displayedOverallWeeklyPaymentTotal > 0 ? 100 : 0;
    }
    return Math.min(
      100,
      (this.displayedOverallWeeklyPaymentTotal /
        this.overallWeeklyExpectedTotal) *
        100
    );
  }

  get displayedOverallWeeklyExpectedProgressTone(): WeeklyProgressTone {
    return this.resolveExpectedProgressTone(
      this.displayedOverallWeeklyExpectedProgressPercent
    );
  }

  get overallWeeklyTargetTotal(): number {
    return this.weeklyPaymentTotals.reduce(
      (total, row) => total + (Number(row.weeklyTargetFc) || 0),
      0
    );
  }

  get overallWeeklyTargetProgressPercent(): number {
    const target = this.overallWeeklyTargetTotal;
    if (target <= 0) return 0;

    return Math.min(100, (this.overallWeeklyPaymentTotal / target) * 100);
  }

  get overallWeeklyTargetProgressTone(): WeeklyProgressTone {
    return this.resolveExpectedProgressTone(
      this.overallWeeklyTargetProgressPercent
    );
  }

  get displayedOverallWeeklyTargetTotal(): number {
    return this.displayedWeeklyPaymentTotals.reduce(
      (total, row) => total + (Number(row.weeklyTargetFc) || 0),
      0
    );
  }

  get displayedOverallWeeklyTargetProgressPercent(): number {
    const target = this.displayedOverallWeeklyTargetTotal;
    if (target <= 0) return 0;

    return Math.min(
      100,
      (this.displayedOverallWeeklyPaymentTotal / target) * 100
    );
  }

  get displayedOverallWeeklyTargetProgressTone(): WeeklyProgressTone {
    return this.resolveExpectedProgressTone(
      this.displayedOverallWeeklyTargetProgressPercent
    );
  }

  overallWeeklyPaymentTotal: number = 0;
  overallWeeklyPaymentTotalDollar: number = 0;
  overallWeeklyReserveTotal: number = 0;
  overallWeeklyReserveTotalDollar: number = 0;
  overallWeeklyReserveProgressPercent: number = 0;
  overallWeeklyReserveProgressTone: WeeklyProgressTone = 'red';
  overallWeeklyExpectedTotal: number = 0;
  overallWeeklyExpectedTotalDollar: number = 0;
  overallWeeklyExpectedProgressPercent: number = 0;
  overallWeeklyExpectedProgressTone: WeeklyProgressTone = 'red';
  private weeklyClientsByUser = new Map<string, Client[]>();
  private readonly weeklyFloorMilestoneFc = 600000;
  private readonly weeklyStretchMilestoneFc = 900000;
  gestionHeatmapMode: GestionHeatmapMode = 'paymentToday';
  heatmapPaymentDate: string = this.time.getTodaysDateYearMonthDay();
  heatmapPaymentDateCorrectFormat: string = this.time.todaysDateMonthDayYear();
  readonly gestionHeatmapOptions: GestionHeatmapOption[] = [
    { mode: 'paymentToday', label: 'Paiement du jour' },
    { mode: 'reserveToday', label: 'Réserve du jour' },
    { mode: 'paymentWeek', label: 'Paiement semaine' },
    { mode: 'reserveWeek', label: 'Réserve semaine' },
  ];

  get activeGestionHeatmapOption(): GestionHeatmapOption {
    return (
      this.gestionHeatmapOptions.find(
        (option) => option.mode === this.gestionHeatmapMode
      ) || this.gestionHeatmapOptions[0]
    );
  }

  get gestionHeatmapView(): {
    title: string;
    subtitle: string;
    totalValueFc: number;
    totalValueDollar: number;
    totalExpectedFc: number;
    percent: number;
    tone: WeeklyProgressTone;
    statusLabel: string;
    tiles: GestionHeatmapTile[];
  } {
    const tiles = this.buildGestionHeatmapTiles();
    const totalValueFc = tiles.reduce((sum, tile) => sum + tile.valueFc, 0);
    const totalExpectedFc = tiles.reduce((sum, tile) => sum + tile.expectedFc, 0);
    const percent =
      totalExpectedFc === 0
        ? totalValueFc > 0
          ? 100
          : 0
        : Math.min(100, (totalValueFc / totalExpectedFc) * 100);
    const tone = this.resolveExpectedProgressTone(percent);

    return {
      title: this.activeGestionHeatmapOption.label,
      subtitle:
        this.gestionHeatmapMode === 'paymentToday'
          ? this.time.convertDateToDayMonthYear(
              this.heatmapPaymentDateCorrectFormat
            )
          : this.gestionHeatmapMode === 'reserveToday'
          ? this.time.convertDateToDayMonthYear(this.requestDateCorrectFormat)
          : this.weeklyPaymentRangeLabel,
      totalValueFc,
      totalValueDollar: this.convertFcToDollar(totalValueFc),
      totalExpectedFc,
      percent,
      tone,
      statusLabel: this.resolveExpectedStatusLabel(percent),
      tiles,
    };
  }

  setGestionHeatmapMode(mode: GestionHeatmapMode): void {
    this.gestionHeatmapMode = mode;
  }

  updateHeatmapPaymentDate(): void {
    if (!this.heatmapPaymentDate) {
      this.heatmapPaymentDate = this.time.getTodaysDateYearMonthDay();
    }
    this.heatmapPaymentDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.heatmapPaymentDate
    );
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

  get isAuditTeamViewer(): boolean {
    return this.auth.isAuditTeamViewer === true;
  }

  get auditTeamsWithMoneyInHandsCount(): number {
    return this.reserveTotals.filter((row) => +(row.moneyInHands || 0) > 0).length;
  }

  get reserveSubmittedCount(): number {
    return this.reserveTotals.filter((row) => row.hasActualSubmission).length;
  }

  async saveReserveRevealTime(): Promise<void> {
    if (!this.auth.isAdmin || this.isSavingReserveRevealTime) return;

    const normalized = this.normalizeRevealTime(this.reserveRevealTimeInput);
    this.isSavingReserveRevealTime = true;
    try {
      await this.data.updateManagementReserveRevealTimeKinshasa(normalized);
      this.reserveRevealTimeInput = normalized;
      this.managementInfo = {
        ...(this.managementInfo || {}),
        reserveRevealTimeKinshasa: normalized,
      };
    } catch (error) {
      console.error('Unable to update reserve reveal time', error);
      alert("Impossible d'enregistrer l'heure de révélation.");
    } finally {
      this.isSavingReserveRevealTime = false;
    }
  }

  toggleUpcomingRequests(): void {
    if (!this.auth.isAdmin || this.upcomingRequestTotals.length === 0) return;
    this.isUpcomingRequestsExpanded = !this.isUpcomingRequestsExpanded;
  }

  private resetUpcomingRequestSummary(): void {
    if (!this.auth.isAdmin) return;

    this.upcomingRequestsByDate.clear();
    this.upcomingRequestTotals = [];
    this.overallUpcomingRequestTotal = 0;
    this.overallUpcomingRequestTotalInDollars = 0;
    this.upcomingRequestsReady = false;
  }

  private addUpcomingRequest(requestDate?: string, rawAmount?: string): void {
    if (!this.auth.isAdmin) return;

    const requestedFor = this.parsePaymentDateKey(requestDate || '');
    const today = this.parsePaymentDateKey(this.today);
    const amount = Number(rawAmount);

    if (
      !requestedFor ||
      !today ||
      requestedFor <= today ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return;
    }

    const dateKey = this.formatDateKey(requestedFor);
    this.upcomingRequestsByDate.set(
      dateKey,
      (this.upcomingRequestsByDate.get(dateKey) || 0) + amount
    );
  }

  private finalizeUpcomingRequestSummary(): void {
    if (!this.auth.isAdmin) return;

    this.upcomingRequestTotals = Array.from(
      this.upcomingRequestsByDate.entries()
    )
      .map(([dateKey, totalFc]) => {
        const date = this.parsePaymentDateKey(dateKey)!;
        return {
          dateKey,
          displayDate: this.formatWeekDate(date),
          totalFc,
          totalDollar: this.convertFcToDollar(totalFc),
        };
      })
      .filter((row) => row.totalFc > 0)
      .sort((a, b) => {
        const first = this.parsePaymentDateKey(a.dateKey)!.getTime();
        const second = this.parsePaymentDateKey(b.dateKey)!.getTime();
        return first - second;
      });

    this.overallUpcomingRequestTotal = this.upcomingRequestTotals.reduce(
      (sum, row) => sum + row.totalFc,
      0
    );
    this.overallUpcomingRequestTotalInDollars = this.convertFcToDollar(
      this.overallUpcomingRequestTotal
    );
    this.upcomingRequestsReady = true;
  }

  /**
   * Lightweight audit path. The audit tables need only today's outstanding
   * requests, today's scheduled reserve clients, and each location's existing
   * daily aggregate for tomorrow. Admin keeps the complete historical path in
   * getAllClients().
   */
  getAuditOperationalTables(): void {
    const requestVersion = ++this.auditTablesRequestVersion;
    this.isFetchingClients = true;
    this.auditTablesError = '';
    this.userRequestTotals = [];
    this.userServeTodayTotals = [];
    this.reserveTotals = [];
    this.overallTotal = 0;
    this.overallTotalToday = 0;
    this.overallTotalTodayInDollars = 0;
    this.overallTotalReserve = 0;
    this.overallTotalReserveInDollars = 0;
    this.overallMoneyInHands = 0;
    this.overallMoneyInHandsDollar = 0;

    this.input = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'investments',
        this.requestDateCorrectFormat
      )
      .toString();
    this.inputDOllars = this.compute
      .convertCongoleseFrancToUsDollars(this.input)
      .toString();

    const targetDate =
      this.requestDateRigthFormat === this.tomorrow
        ? this.effectiveTomorrowDate
        : this.requestDateRigthFormat;

    const locationRequests = this.allUsers.map((user) => {
      const userId = user.uid!;
      const clientsPath = `users/${userId}/clients`;
      const cardsPath = `users/${userId}/cards`;
      const dailyRequests = user.dailyMoneyRequests || {};
      const hasTomorrowAggregate = Object.prototype.hasOwnProperty.call(
        dailyRequests,
        targetDate
      );

      const tomorrowTotal$ = hasTomorrowAggregate
        ? of(this.auditFiniteAmount(dailyRequests[targetDate]))
        : forkJoin({
            clients: this.afs
              .collection<Client>(clientsPath, (ref) =>
                ref.where('requestDate', '==', targetDate)
              )
              .valueChanges()
              .pipe(take(1)),
            cards: this.afs
              .collection<Card>(cardsPath, (ref) =>
                ref.where('requestDate', '==', targetDate)
              )
              .valueChanges()
              .pipe(take(1)),
          }).pipe(
            map(
              ({ clients, cards }) =>
                this.sumAuditOutstandingRequests(clients, targetDate) +
                this.sumAuditOutstandingRequests(cards, targetDate)
            )
          );

      return forkJoin({
        reserveClients: this.afs
          .collection<Client>(clientsPath, (ref) =>
            ref.where('paymentDay', '==', this.theDay)
          )
          .valueChanges()
          .pipe(take(1)),
        todayClients: this.afs
          .collection<Client>(clientsPath, (ref) =>
            ref.where('requestDate', '==', this.requestDateCorrectFormat)
          )
          .valueChanges()
          .pipe(take(1)),
        todayCards: this.afs
          .collection<Card>(cardsPath, (ref) =>
            ref.where('requestDate', '==', this.requestDateCorrectFormat)
          )
          .valueChanges()
          .pipe(take(1)),
        tomorrowTotal: tomorrowTotal$,
      }).pipe(
        map(({ reserveClients, todayClients, todayCards, tomorrowTotal }) => {
          const eligibleReserveClients = this.data
            .findClientsWithDebts(reserveClients)
            .filter(
              (client) =>
                Number(client.debtLeft) > 0 &&
                client.paymentDay === this.theDay &&
                this.data.didClientStartThisWeek(client)
            );
          const reserveTotal = this.compute.computeExpectedPerDate(
            eligibleReserveClients
          );
          const todayTotal =
            this.sumAuditOutstandingRequests(
              todayClients,
              this.requestDateCorrectFormat
            ) +
            this.sumAuditOutstandingRequests(
              todayCards,
              this.requestDateCorrectFormat
            );
          const todayReserveKeys = Object.keys(user.reserve || {}).filter(
            (key) => key.startsWith(this.requestDateCorrectFormat)
          );
          const actualReserve = todayReserveKeys.reduce(
            (sum, key) => sum + this.auditFiniteAmount(user.reserve?.[key]),
            0
          );
          const moneyInHands =
            this.auditFiniteAmount(user.moneyInHands) +
            this.auditFiniteAmount(user.cardsMoney);

          return {
            firstName: user.firstName || '',
            trackingId: userId,
            todayTotal,
            tomorrowTotal,
            reserveTotal,
            actualReserve,
            hasActualSubmission: todayReserveKeys.length > 0,
            moneyInHands,
          };
        })
      );
    });

    if (locationRequests.length === 0) {
      this.isFetchingClients = false;
      return;
    }

    forkJoin(locationRequests).subscribe({
      next: (rows) => {
        if (requestVersion !== this.auditTablesRequestVersion) return;

        this.userServeTodayTotals = rows
          .filter((row) => row.todayTotal > 0)
          .map((row) => ({
            firstName: row.firstName,
            total: row.todayTotal,
            totalInDollar: this.auditFcToDollar(row.todayTotal),
            trackingId: row.trackingId,
          }))
          .sort((a, b) => b.total - a.total);

        this.userRequestTotals = rows
          .filter((row) => row.tomorrowTotal > 0)
          .map((row) => ({
            firstName: row.firstName,
            total: row.tomorrowTotal,
            totalInDollar: this.auditFcToDollar(row.tomorrowTotal),
            trackingId: row.trackingId,
          }))
          .sort((a, b) => b.total - a.total);

        this.reserveTotals = rows
          .filter(
            (row) =>
              row.reserveTotal > 0 ||
              row.actualReserve > 0 ||
              row.moneyInHands > 0
          )
          .map((row) => ({
            firstName: row.firstName,
            total: row.reserveTotal,
            totalInDollar: this.auditFcToDollar(row.reserveTotal),
            actual: row.actualReserve,
            actualInDollar: this.auditFcToDollar(row.actualReserve),
            hasActualSubmission: row.hasActualSubmission,
            trackingId: row.trackingId,
            moneyInHands: row.moneyInHands,
            moneyInHandsDollar: this.auditFcToDollar(row.moneyInHands),
          }))
          .sort((a, b) => {
            const first = Math.max(a.total || 0, a.actual || 0);
            const second = Math.max(b.total || 0, b.actual || 0);
            return second - first;
          });

        this.overallTotalToday = rows.reduce(
          (sum, row) => sum + row.todayTotal,
          0
        );
        this.overallTotal = rows.reduce(
          (sum, row) => sum + row.tomorrowTotal,
          0
        );
        this.overallTotalReserve = rows.reduce(
          (sum, row) => sum + row.reserveTotal,
          0
        );
        this.overallMoneyInHands = rows.reduce(
          (sum, row) => sum + row.moneyInHands,
          0
        );
        this.overallTotalTodayInDollars = this.auditFcToDollar(
          this.overallTotalToday
        );
        this.overallTotalInDollars = this.auditFcToDollar(this.overallTotal);
        this.overallTotalReserveInDollars = this.auditFcToDollar(
          this.overallTotalReserve
        );
        this.overallMoneyInHandsDollar = this.auditFcToDollar(
          this.overallMoneyInHands
        );
        this.percentage =
          this.overallTotalReserve > 0
            ? (
                (Number(this.dailyReserve) / this.overallTotalReserve) *
                100
              ).toFixed(2)
            : '0.00';
        this.isFetchingClients = false;
      },
      error: (error) => {
        if (requestVersion !== this.auditTablesRequestVersion) return;
        console.error('Unable to load audit operational tables', error);
        this.auditTablesError =
          'Impossible de charger les tableaux. Vérifiez la connexion et réessayez.';
        this.isFetchingClients = false;
      },
    });
  }

  private sumAuditOutstandingRequests(
    records: Array<Client | Card>,
    requestDate: string
  ): number {
    return records.reduce((sum, record) => {
      if (
        record.requestStatus === undefined ||
        record.requestDate !== requestDate
      ) {
        return sum;
      }

      const validType =
        record.requestType === 'card' ||
        record.requestType === 'savings' ||
        record.requestType === 'rejection' ||
        (record.requestType === 'lending' &&
          (record as Client).agentSubmittedVerification === 'true');
      return validType
        ? sum + this.auditFiniteAmount(record.requestAmount)
        : sum;
    }, 0);
  }

  private auditFiniteAmount(value: unknown): number {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  private auditFcToDollar(amount: number): number {
    return this.auditFiniteAmount(
      this.compute.convertCongoleseFrancToUsDollars(amount.toString())
    );
  }

  /**
   * Loads the selected day's real client collections for every location with
   * one collection-group query. Employee day totals intentionally exclude
   * savings-to-payment transfers, unlike the location reimbursement aggregate.
   */
  private async loadPurePaymentsForSelectedDay(): Promise<void> {
    if (!this.auth.isAdmin) {
      this.applyPurePaymentTotals(new Map());
      this.purePaymentLoading = false;
      this.purePaymentError = '';
      return;
    }

    const teams = (this.allUsers || []).filter((user) => !!user.uid);
    if (!teams.length) {
      this.applyPurePaymentTotals(new Map());
      this.purePaymentLoading = false;
      this.purePaymentError = '';
      return;
    }

    const dayKey = this.requestDateCorrectFormat;
    const cacheKey = this.purePaymentCacheKey(dayKey);
    const cachedTotals = this.purePaymentCache.get(cacheKey);
    if (cachedTotals) {
      this.applyPurePaymentTotals(cachedTotals);
      this.purePaymentLoading = false;
      this.purePaymentError = '';
      return;
    }
    if (
      this.purePaymentLoading &&
      this.purePaymentLoadingKey === cacheKey
    ) {
      return;
    }

    const requestVersion = ++this.purePaymentRequestVersion;
    this.purePaymentLoading = true;
    this.purePaymentLoadingKey = cacheKey;
    this.purePaymentError = '';
    this.applyPurePaymentTotals(new Map());

    try {
      const totals = await this.data.getEmployeeDayTotalsGroupedByTeam(
        dayKey,
        teams.map((team) => team.uid!)
      );
      if (
        requestVersion !== this.purePaymentRequestVersion ||
        dayKey !== this.requestDateCorrectFormat ||
        !this.auth.isAdmin
      ) {
        if (!this.auth.isAdmin) this.applyPurePaymentTotals(new Map());
        return;
      }

      const totalsByTeam = new Map(
        totals.map(
          (item) =>
            [item.ownerUid, Number(item.total) || 0] as const
        )
      );
      this.cachePurePaymentTotals(cacheKey, totalsByTeam);
      this.applyPurePaymentTotals(totalsByTeam);
    } catch (error) {
      if (requestVersion !== this.purePaymentRequestVersion) return;
      console.error('Unable to load pure payments for the selected day', error);
      this.applyPurePaymentTotals(new Map());
      this.purePaymentError = 'Impossible de charger les paiements purs.';
    } finally {
      if (requestVersion === this.purePaymentRequestVersion) {
        this.purePaymentLoading = false;
        this.purePaymentLoadingKey = '';
      }
    }
  }

  private purePaymentCacheKey(dayKey: string): string {
    const teamIds = (this.allUsers || [])
      .map((user) => user.uid || '')
      .filter(Boolean)
      .sort()
      .join(',');
    return `${dayKey}:${teamIds}`;
  }

  private cachePurePaymentTotals(
    cacheKey: string,
    totalsByTeam: ReadonlyMap<string, number>
  ): void {
    this.purePaymentCache.set(cacheKey, new Map(totalsByTeam));
    if (this.purePaymentCache.size <= 12) return;

    const oldestKey = this.purePaymentCache.keys().next().value;
    if (oldestKey) this.purePaymentCache.delete(oldestKey);
  }

  private applyPurePaymentTotals(
    totalsByTeam: ReadonlyMap<string, number>
  ): void {
    this.purePaymentsByTeam = new Map(totalsByTeam);
    this.purePaymentTotal = Array.from(totalsByTeam.values()).reduce(
      (sum, value) => sum + (Number(value) || 0),
      0
    );
    this.purePaymentTotalDollar = this.convertFcToDollar(
      this.purePaymentTotal
    );

    this.reserveTotals.forEach((row) => {
      const purePayment = Number(totalsByTeam.get(row.trackingId)) || 0;
      row.purePayment = purePayment;
      row.purePaymentDollar = this.convertFcToDollar(purePayment);
    });
  }

  getAllClients() {
    if (this.isFetchingClients) return;
    this.isFetchingClients = true;

    // Initialize userRequestTotals and overallTotal

    // Initialize userRequestTotals and overallTotal
    // 🔧  NEW – hard reset every time we start a fresh pass
    this.userRequestTotals = [];
    this.reserveTotals = [];
    this.overallTotal = 0;
    this.paymentTotal = 0;
    this.overallTotalReserve = 0;
    this.overallTransportAmount = 0;
    this.overallMissingReasons = 0;
    this.overallTotalReasons = 0;
    this.overallPaidClientsToday = 0;
    this.overallUnpaidClientsToday = 0;
    this.resetUpcomingRequestSummary();

    // NEW: reset today's structures
    this.userServeTodayTotals = [];
    this.overallTotalToday = 0;

    this.overallMoneyInHands = 0;
    this.overallMoneyInHandsDollar = 0;
    this.weeklyClientsByUser.clear();

    this.input = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'investments',
        this.requestDateCorrectFormat
      )
      .toString();
    this.inputDOllars = this.compute
      .convertCongoleseFrancToUsDollars(this.input)
      .toString();

    let completedRequests = 0;
    // Use effective date (skip Sunday if tomorrow is Sunday)
    const targetDate = this.requestDateRigthFormat === this.tomorrow 
      ? this.effectiveTomorrowDate 
      : this.requestDateRigthFormat; // freeze the value
    const { start: transportStart, end: transportEnd } =
      this.getDayRange(this.requestDateCorrectFormat);

    type TransportReceipt = { amount?: number };

    this.allUsers.forEach((user) => {
      // For each user, fetch both clients and cards
      forkJoin({
        clients: this.auth.getClientsOfAUser(user.uid!).pipe(take(1)),
        cards: this.auth.getClientsCardOfAUser(user.uid!).pipe(take(1)),
        receipts: this.afs
          .collection<TransportReceipt>(
            `users/${user.uid}/transportReceipts`,
            (ref) =>
              ref
                .where('ts', '>=', transportStart)
                .where('ts', '<=', transportEnd)
          )
          .valueChanges()
          .pipe(take(1)),
      }).subscribe(
        ({ clients, cards, receipts }) => {
          this.weeklyClientsByUser.set(user.uid!, clients);
          let userTotal = 0;
          let reserveTotal = 0;
          let userTotalToday = 0;

          // Process clients
          for (let client of clients) {
            const meetsTypeGate =
              client.requestStatus !== undefined &&
              ((client.requestType === 'lending' &&
                client.agentSubmittedVerification === 'true') ||
                client.requestType === 'savings' ||
                client.requestType === 'rejection');

            if (meetsTypeGate) {
              if (this.auth.isAdmin) {
                this.addUpcomingRequest(
                  client.requestDate,
                  client.requestAmount
                );
              }

              // existing target date (tomorrow / requestDateRigthFormat)
              if (client.requestDate === targetDate) {
                userTotal += Number(client.requestAmount);
              }
              // NEW: selected date (today or selected date)
              if (client.requestDate === this.requestDateCorrectFormat) {
                userTotalToday += Number(client.requestAmount);
              }
            }
          }

          const moneyHandsFC =
            Number(user.moneyInHands ?? 0) + Number(user.cardsMoney ?? 0);
          const moneyHandsDollar = Number(
            this.compute.convertCongoleseFrancToUsDollars(String(moneyHandsFC))
          );
          // first filter out as everyone and then add some more reasons
          this.currentClientsReserve = this.data.findClientsWithDebts(clients);
          this.currentClientsReserve = this.currentClientsReserve.filter(
            (data) => {
              return (
                Number(data.debtLeft) > 0 &&
                data.paymentDay === this.theDay &&
                data &&
                this.data.didClientStartThisWeek(data) // this condition can be confusing. it is the opposite
              );
            }
          );
          // ───── 1. Séparer ceux qui ont déjà payé aujourd’hui ───────────
          const unpaidToday: Client[] = this.currentClientsReserve.filter(
            (cl) => !this.hasClientPaidForDate(cl)
          );
          const paidClientsToday =
            this.currentClientsReserve.length - unpaidToday.length;
          const unpaidClientsToday = unpaidToday.length;

          // ───── 2. Compter les raisons manquantes ───────────────────────
          const totalReasons = unpaidToday.length;
          const missingReasons = unpaidToday.filter(
            (c) => !this.getTodaysComment(c)
          ).length;

          reserveTotal = this.compute.computeExpectedPerDate(
            this.currentClientsReserve
          );

          // Process cards
          for (let card of cards) {
            if (
              card.requestStatus !== undefined &&
              card.requestType === 'card'
            ) {
              if (this.auth.isAdmin) {
                this.addUpcomingRequest(card.requestDate, card.requestAmount);
              }

              // Use effective date for cards too (skip Sunday if tomorrow is Sunday)
              const cardTargetDate = this.requestDateRigthFormat === this.tomorrow 
                ? this.effectiveTomorrowDate 
                : this.requestDateRigthFormat;
              if (card.requestDate === cardTargetDate) {
                userTotal += Number(card.requestAmount);
              }
              // NEW: selected date (today or selected date)
              if (card.requestDate === this.requestDateCorrectFormat) {
                userTotalToday += Number(card.requestAmount);
              }
            }
          }

          // Store user data and total in the array
          this.userRequestTotals.push({
            firstName: user.firstName!,

            total: userTotal,
            totalInDollar: Number(
              this.compute.convertCongoleseFrancToUsDollars(
                userTotal.toString()
              )
            ),
            trackingId: user.uid!,
          });
          //  NEW: today row
          this.userServeTodayTotals.push({
            firstName: user.firstName!,
            total: userTotalToday,
            totalInDollar: Number(
              this.compute.convertCongoleseFrancToUsDollars(
                userTotalToday.toString()
              )
            ),
            trackingId: user.uid!,
          });
          const todayKeys = Object.keys(user.reserve || {}).filter((key) =>
            key.startsWith(this.requestDateCorrectFormat)
          );
          const paymentKeys = Object.keys(user.dailyReimbursement || {}).filter(
            (key) => key === this.requestDateCorrectFormat
          );

          // 2) Sum up raw FC payments
          const payment = paymentKeys.reduce(
            (sum, key) => sum + Number(user.dailyReimbursement?.[key] ?? 0),
            0
          );

          // 3) Sum up those same payments converted to USD
          const paymentDollar = paymentKeys.reduce(
            (sum, key) =>
              sum +
              Number(
                this.compute.convertCongoleseFrancToUsDollars(
                  String(user.dailyReimbursement?.[key] ?? 0)
                )
              ),
            0
          );
          const purePayment =
            Number(this.purePaymentsByTeam.get(user.uid!)) || 0;

          const transportReceipts: TransportReceipt[] = receipts ?? [];
          const transportAmount = transportReceipts.reduce(
            (sum: number, receipt) => {
              const amount = Number(receipt.amount ?? 0);
              return sum + (isFinite(amount) ? amount : 0);
            },
            0
          );

          const dayExpense = Number(
            this.compute.findTotalForToday(
              (user.expenses ?? {}) as { [key: string]: string },
              this.requestDateCorrectFormat
            )
          );
          const dayExpenseDollar = Number(
            this.compute.convertCongoleseFrancToUsDollars(
              (Number.isFinite(dayExpense) ? dayExpense : 0).toString()
            )
          );

          this.reserveTotals.push({
            firstName: user.firstName!,

            total: reserveTotal,
            totalInDollar: Number(
              this.compute.convertCongoleseFrancToUsDollars(
                reserveTotal.toString()
              )
            ),
            payment,
            paymentDollar,
            purePayment,
            purePaymentDollar: this.convertFcToDollar(purePayment),
            actual: todayKeys.reduce(
              (sum, key) => sum + Number(user.reserve![key]),
              0
            ),
            // Default to 0 if undefined
            actualInDollar: todayKeys.reduce(
              (sum, key) =>
                sum +
                Number(
                  this.compute.convertCongoleseFrancToUsDollars(
                    user.reserve![key].toString()
                  )
                ),
              0
            ),
            hasActualSubmission: todayKeys.length > 0,
            trackingId: user.uid!,
            /* NEW */
            missingReasons,
            totalReasons,
            paidClientsToday,
            unpaidClientsToday,
            /* NEW ↓ */
            moneyInHands: moneyHandsFC,
            moneyInHandsDollar: moneyHandsDollar,
            transportAmount,
            dayExpense: Number.isFinite(dayExpense) ? dayExpense : 0,
            dayExpenseDollar: Number.isFinite(dayExpenseDollar)
              ? dayExpenseDollar
              : 0,
          });

          // Add to the overall total
          this.overallTotal += userTotal;
          this.overallTotalToday += userTotalToday;
          this.overallTotalReserve += reserveTotal;
          this.paymentTotal += payment;
          this.overallTransportAmount += transportAmount;
          // aggregate
          this.overallMoneyInHands += moneyHandsFC;
          this.overallMoneyInHandsDollar += moneyHandsDollar;

          completedRequests++;
          if (completedRequests === this.allUsers.length) {
            // All users have been processed
            this.userRequestTotals = this.userRequestTotals.filter((client) => {
              return client.total > 0;
            });
            // NEW: keep only rows with > 0 for today and sort
            this.userServeTodayTotals = this.userServeTodayTotals
              .filter((row) => row.total > 0)
              .sort((a, b) => b.total - a.total);

            // NEW: compute today's grand total in $
            this.overallTotalTodayInDollars = Number(
              this.compute.convertCongoleseFrancToUsDollars(
                this.overallTotalToday.toString()
              )
            );

            // this.reserveTotals = this.reserveTotals.filter((client) => {
            //   return client.total > 0;
            // });
            this.reserveTotals = this.reserveTotals.filter((row) => {
              const t = row.total ?? 0;
              const a = row.actual ?? 0;
              const p = row.payment ?? 0; // optional: keep if a payment was recorded
              const pp = row.purePayment ?? 0;
              const tr = row.transportAmount ?? 0;
              return t > 0 || a > 0 || p > 0 || pp > 0 || tr > 0;
            });
            const reasonsTotals = this.reserveTotals.reduce(
              (acc, row) => {
                const total = row.totalReasons ?? 0;
                const missing = row.missingReasons ?? 0;
                if (missing > 0) {
                  acc.total += total;
                  acc.missing += missing;
                }
                return acc;
              },
              { missing: 0, total: 0 }
            );
            this.overallMissingReasons = reasonsTotals.missing;
            this.overallTotalReasons = reasonsTotals.total;
            const clientPaymentTotals = this.reserveTotals.reduce(
              (acc, row) => {
                acc.paid += row.paidClientsToday ?? 0;
                acc.unpaid += row.unpaidClientsToday ?? 0;
                return acc;
              },
              { paid: 0, unpaid: 0 }
            );
            this.overallPaidClientsToday = clientPaymentTotals.paid;
            this.overallUnpaidClientsToday = clientPaymentTotals.unpaid;
            this.userRequestTotals.sort((a, b) => {
              return b.total - a.total;
            });
            // this.reserveTotals.sort((a, b) => {
            //   return b.total - a.total;
            // });
            // Sort by the stronger of the two metrics (or sum — pick what you prefer)
            this.reserveTotals.sort((a, b) => {
              const aKey = Math.max(a.total ?? 0, a.actual ?? 0);
              const bKey = Math.max(b.total ?? 0, b.actual ?? 0);
              return bKey - aKey;
            });

            this.overallTotalInDollars = Number(
              this.compute.convertCongoleseFrancToUsDollars(
                this.overallTotal.toString()
              )
            );
            this.overallTotalReserveInDollars = Number(
              this.compute.convertCongoleseFrancToUsDollars(
                this.overallTotalReserve.toString()
              )
            );
            this.finalizeUpcomingRequestSummary();
            // ─── after overallTotalReserveInDollars computation ─────────
            this.overallMoneyInHandsDollar = Number(
              this.compute.convertCongoleseFrancToUsDollars(
                this.overallMoneyInHands.toString()
              )
            );
            this.percentage = (
              (Number(this.dailyReserve) / this.overallTotalReserve) *
              100
            ).toFixed(2);
            this.computeWeeklyPaymentTotals();

            this.isFetchingClients = false;
            // Now you can use this.userRequestTotals and this.overallTotal in your template
            this.setGraphics();
          }
        },
        (error) => {
          console.error('Error fetching data for user:', user.firstName, error);
          completedRequests++;
          if (completedRequests === this.allUsers.length) {
            this.finalizeUpcomingRequestSummary();
            this.isFetchingClients = false;
          }
        }
      );
    });
  }

  yesterday = this.time.yesterdaysDateMonthDayYear();
  today = this.time.todaysDateMonthDayYear();
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  requestDateRigthFormat: string = this.getEffectiveTomorrowDate();
  frenchDateTomorrow = this.time.convertDateToDayMonthYear(this.requestDateRigthFormat);
  
  // Initialize date picker with effective tomorrow date (YYYY-MM-DD format)
  get requestDateTomorrow(): string {
    const effectiveDate = this.getEffectiveTomorrowDate();
    const [month, day, year] = effectiveDate.split('-').map(Number);
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${year}-${mm}-${dd}`;
  }
  
  set requestDateTomorrow(value: string) {
    // Store the value - the (change) event in HTML will call otherDate()
    this._requestDateTomorrow = value;
  }
  
  private _requestDateTomorrow: string = '';
  summaryContent: string[] = [];

  get isDefaultTomorrowDate(): boolean {
    // Check if the selected date matches the default effective tomorrow date
    return this.requestDateRigthFormat === this.effectiveTomorrowDate;
  }

  get displayDateForRequests(): string {
    // If using default tomorrow date, apply Sunday skip logic
    if (this.isDefaultTomorrowDate) {
      const [month, day, year] = this.tomorrow.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      // If tomorrow is Sunday, skip to Monday
      if (date.getDay() === 0) {
        const mondayDate = new Date(date);
        mondayDate.setDate(date.getDate() + 1);
        const mondayMonth = mondayDate.getMonth() + 1;
        const mondayDay = mondayDate.getDate();
        const mondayYear = mondayDate.getFullYear();
        const mondayDateStr = `${mondayMonth}-${mondayDay}-${mondayYear}`;
        return this.time.convertDateToDayMonthYear(mondayDateStr);
      }
      
      return this.frenchDateTomorrow;
    }
    
    // For custom selected dates, use the selected date
    return this.frenchDateTomorrow;
  }

  get dayNameForRequests(): string {
    const dayNames = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];
    
    // If using default tomorrow date, apply Sunday skip logic
    if (this.isDefaultTomorrowDate) {
      const [month, day, year] = this.tomorrow.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      // If tomorrow is Sunday, skip to Monday
      if (date.getDay() === 0) {
        return 'Lundi';
      }
      
      return dayNames[date.getDay()];
    }
    
    // For custom selected dates, get the day name from the selected date
    const [month, day, year] = this.requestDateRigthFormat.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return dayNames[date.getDay()];
  }

  private getEffectiveTomorrowDate(): string {
    // Returns the date to use for fetching tomorrow's data (skips Sunday)
    const [month, day, year] = this.tomorrow.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    
    // If tomorrow is Sunday, skip to Monday
    if (date.getDay() === 0) {
      const mondayDate = new Date(date);
      mondayDate.setDate(date.getDate() + 1);
      const mondayMonth = mondayDate.getMonth() + 1;
      const mondayDay = mondayDate.getDate();
      const mondayYear = mondayDate.getFullYear();
      return `${mondayMonth}-${mondayDay}-${mondayYear}`;
    }
    
    return this.tomorrow;
  }

  get effectiveTomorrowDate(): string {
    return this.getEffectiveTomorrowDate();
  }

  get tomorrowLabel(): string {
    // Only use "demain"/"lendemain" for default tomorrow date
    if (!this.isDefaultTomorrowDate) {
      return ''; // Empty string for custom dates
    }
    
    // Check if today is Saturday (so we're skipping Sunday to Monday)
    const [month, day, year] = this.today.split('-').map(Number);
    const todayDate = new Date(year, month - 1, day);
    
    // If today is Saturday, use "lendemain", otherwise "demain"
    if (todayDate.getDay() === 6) {
      return 'lendemain';
    }
    
    return 'demain';
  }
  givenMonthTotalLossAmount: string = '';
  givenMonthTotalLossAmountDollar: string = '';
  givenMonthTotalReserveAmount: string = '';
  givenMonthTotalLossCombinedCdf: string = '0';
  givenMonthTotalLossCombinedUsd: string = '0';
  givenMonthTotalFraudAmount: string = '0';
  fraudRatioOfReserve: number = 0;
  lossRatio: number = 0;
  input: string = '0';
  inputDOllars: string = '0';
  plannedToServeToday: string = '0';
  plannedToServeTodayDollars: string = '0';
  initalizeInputs() {
    const [selectedMonth, , selectedYear] = this.requestDateCorrectFormat
      .split('-')
      .map(Number);

    // this is to compute the loss ratio of the month which will serve for bonus for rebecca
    this.givenMonthTotalReserveAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.reserve!,
      selectedMonth,
      selectedYear
    );
    this.givenMonthTotalLossAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.exchangeLoss!,
      this.givenMonth,
      this.givenYear
    );
    this.givenMonthTotalLossAmountDollar = this.compute.findTotalGiventMonth(
      this.managementInfo?.dollarTransferLoss!,
      this.givenMonth,
      this.givenYear
    );
    let totalLoss = (
      Number(this.givenMonthTotalLossAmount) +
      Number(
        this.compute.convertUsDollarsToCongoleseFranc(
          this.givenMonthTotalLossAmountDollar
        )
      )
    ).toString();
    this.givenMonthTotalLossCombinedCdf = totalLoss;
    this.givenMonthTotalLossCombinedUsd = String(
      this.compute.convertCongoleseFrancToUsDollars(totalLoss)
    );
    this.lossRatio =
      Math.ceil(
        (Number(totalLoss) / Number(this.givenMonthTotalReserveAmount)) * 10000
      ) / 100;
    this.dailyReserve = this.compute
      .findTotalForToday(
        this.managementInfo?.reserve!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyExpense = this.compute
      .findTotalForToday(
        this.managementInfo?.expenses!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyOtherExpense = this.compute
      .findTotalForToday(
        this.managementInfo?.otherExpenses!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyBudgetExpense = this.compute
      .findTotalForToday(
        this.managementInfo?.budgetedExpenses!,
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyServed = this.compute
      .findTotalForToday(
        this.managementInfo?.moneyGiven!,
        this.requestDateCorrectFormat
      )
      .toString();
    // Get the previous day of the selected date
    const previousDay = this.getPreviousDay(this.requestDateCorrectFormat);
    this.plannedToServeToday = this.compute
      .findTotalForToday(this.managementInfo?.moneyGiven!, previousDay)
      .toString();

    this.plannedToServeTodayDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.plannedToServeToday)
      .toString();
    this.dollarLoss = this.compute
      .findTotalForToday(
        this.managementInfo?.dollarTransferLoss!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyBankFranc = this.compute
      .findTotalForToday(
        this.managementInfo?.bankDepositFrancs!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyBankDollar = this.compute
      .findTotalForToday(
        this.managementInfo?.bankDepositDollars!,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyLoss = this.compute
      .findTotalForToday(
        this.managementInfo?.exchangeLoss!,
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyInvestment = this.compute
      .findTotalForToday(
        this.managementInfo?.investment!,
        this.requestDateCorrectFormat
      )
      .toString();

    this.maxRange = Object.keys(this.managementInfo?.reserve || {}).length;

    this.dailyBankFranc =
      this.dailyBankFranc === undefined ? '0' : this.dailyBankFranc;
    this.dailyInvestment =
      this.dailyInvestment === undefined ? '0' : this.dailyInvestment;
    this.dollarLoss = this.dollarLoss === undefined ? '0' : this.dollarLoss;
    this.dailyBankDollar =
      this.dailyBankDollar === undefined ? '0' : this.dailyBankDollar;
    this.dailyReserve =
      this.dailyReserve === undefined ? '0' : this.dailyReserve;
    this.dailyExpense =
      this.dailyExpense === undefined ? '0' : this.dailyExpense;
    this.dailyOtherExpense =
      this.dailyOtherExpense === undefined ? '0' : this.dailyOtherExpense;
    this.dailyBudgetExpense =
      this.dailyBudgetExpense === undefined ? '0' : this.dailyBudgetExpense;
    this.dailyLoss = this.dailyLoss === undefined ? '0' : this.dailyLoss;
    this.dailyServed = this.dailyServed === undefined ? '0' : this.dailyServed;
    this.moneyInHands =
      this.managementInfo?.moneyInHands === undefined
        ? '0'
        : this.managementInfo?.moneyInHands;
    let dloss = (
      Number(this.compute.convertUsDollarsToCongoleseFranc(this.dollarLoss)) +
      Number(this.dailyLoss)
    ).toString();

    this.givenMonthTotalFraudAmount = this.compute.findTotalGiventMonth(
      this.managementInfo?.fraudes!,
      selectedMonth,
      selectedYear
    );
    this.fraudRatioOfReserve =
      Number(this.givenMonthTotalReserveAmount) > 0
        ? Math.ceil(
            (Number(this.givenMonthTotalFraudAmount) /
              Number(this.givenMonthTotalReserveAmount)) *
              10000
          ) / 100
        : 0;

    this.summaryContent = [
      `${this.lossRatio}`,
      ` ${this.dailyReserve}`,
      `${this.moneyInHands}`,
      `${this.dailyExpense}`,
      `${this.dailyBudgetExpense}`,
      `${this.dailyServed}`,
      `${this.dailyBankFranc}`,
      `${dloss}`,
      `${this.dailyInvestment}`,
      `${this.givenMonthTotalFraudAmount}`,
      `${this.dailyOtherExpense}`,
      `${this.moneyInHands}`,
    ];

    this.valuesConvertedToDollars = [
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyReserve)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.moneyInHands)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyExpense)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailyBudgetExpense
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyServed)}`,
      `${this.dailyBankDollar}`,
      `${this.compute.convertCongoleseFrancToUsDollars(dloss)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyInvestment)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalFraudAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailyOtherExpense
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.moneyInHands)}`,
    ];
  }

  findDailyActivitiesAmount() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    console.log('date', this.requestDateCorrectFormat);
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );
    this.theDay = this.time.getDayOfWeek(this.requestDateCorrectFormat);

    this.initalizeInputs();
    if (this.isAuditTeamViewer) {
      this.getAuditOperationalTables();
    } else {
      if (this.auth.isAdmin) {
        void this.loadPurePaymentsForSelectedDay();
      }
      this.getAllClients();
    }
  }

  /**
   * Get the previous day for a given date in MM-DD-YYYY format
   */
  getPreviousDay(dateStr: string): string {
    // Parse the date string into a Date object
    const [month, day, year] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    // Subtract one day from the date
    date.setDate(date.getDate() - 1);

    // Get the day, month, and year without leading zeros
    const prevDay = date.getDate();
    const prevMonth = date.getMonth() + 1;
    const prevYear = date.getFullYear();

    return `${prevMonth}-${prevDay}-${prevYear}`;
  }

  private getDayRange(dateStr: string): { start: number; end: number } {
    const [month, day, year] = dateStr.split('-').map(Number);
    const start = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
    const end = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
    return { start, end };
  }

  updateWeeklyPaymentDate() {
    if (!this.auth.isAdmin) return;
    this.weeklyPaymentCaptureMessage = '';
    this.weeklyPaymentCaptureError = '';
    this.weeklyPaymentDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.weeklyPaymentDate
    );
    this.weeklyPaymentRangeLabel = this.computeWeeklyRangeLabel(
      this.weeklyPaymentDateCorrectFormat
    );
    this.computeWeeklyPaymentTotals();
    if (this.weeklyPaymentSourceMode === 'cashFlow') {
      void this.loadWeeklyCashFlowTotals();
    }
    this.updateWeeklyPaymentHistory(this.weeklyPaymentHistoryRange);
  }

  async setWeeklyPaymentSourceMode(
    mode: WeeklyPaymentSourceMode
  ): Promise<void> {
    if (!this.auth.isAdmin || mode === this.weeklyPaymentSourceMode) return;

    this.weeklyPaymentSourceMode = mode;
    this.weeklyPaymentCaptureMessage = '';
    this.weeklyPaymentCaptureError = '';
    this.weeklyCashFlowError = '';

    if (mode === 'cashFlow') {
      await this.loadWeeklyCashFlowTotals();
    }
  }

  async retryWeeklyCashFlow(): Promise<void> {
    if (!this.auth.isAdmin || this.weeklyCashFlowLoading) return;
    await this.loadWeeklyCashFlowTotals();
  }

  private async loadWeeklyCashFlowTotals(): Promise<void> {
    if (!this.auth.isAdmin) return;

    const teams = (this.allUsers || []).filter((user) => !!user.uid);
    if (!teams.length) {
      this.weeklyCashFlowTotals = [];
      this.weeklyCashFlowError = '';
      return;
    }

    const cacheKey = this.weeklyCashFlowCacheKey();
    const cachedTotals = this.weeklyCashFlowCache.get(cacheKey);
    if (cachedTotals) {
      this.applyWeeklyCashFlowTotals(cachedTotals);
      this.weeklyCashFlowError = '';
      return;
    }
    if (
      this.weeklyCashFlowLoading &&
      this.weeklyCashFlowLoadingKey === cacheKey
    ) {
      return;
    }

    const requestId = ++this.weeklyCashFlowRequestVersion;
    const { start, end } = this.getWeekBounds(
      this.weeklyPaymentDateCorrectFormat
    );
    this.weeklyCashFlowLoading = true;
    this.weeklyCashFlowLoadingKey = cacheKey;
    this.weeklyCashFlowError = '';
    this.weeklyCashFlowTotals = [];

    try {
      const totals = await this.data.getEmployeeWeekTotalsGroupedByTeam(
        start.getTime(),
        end.getTime(),
        teams.map((team) => team.uid!)
      );
      if (
        requestId !== this.weeklyCashFlowRequestVersion ||
        cacheKey !== this.weeklyCashFlowCacheKey()
      ) {
        return;
      }

      const totalsByTeam = new Map(
        totals.map((item) => [item.ownerUid, Number(item.total) || 0] as const)
      );
      this.cacheWeeklyCashFlowTotals(cacheKey, totalsByTeam);
      this.applyWeeklyCashFlowTotals(totalsByTeam);
    } catch (error) {
      if (requestId !== this.weeklyCashFlowRequestVersion) return;
      console.error('Unable to load weekly cash-flow payment ranking', error);
      this.weeklyCashFlowTotals = [];
      this.weeklyCashFlowError =
        'Impossible de charger les paiements cash flow de la semaine.';
    } finally {
      if (requestId === this.weeklyCashFlowRequestVersion) {
        this.weeklyCashFlowLoading = false;
        this.weeklyCashFlowLoadingKey = '';
      }
    }
  }

  private weeklyCashFlowCacheKey(): string {
    const { start, end } = this.getWeekBounds(
      this.weeklyPaymentDateCorrectFormat
    );
    const teamIds = (this.allUsers || [])
      .map((user) => user.uid || '')
      .filter(Boolean)
      .sort()
      .join(',');
    return `${this.formatDateKey(start)}:${this.formatDateKey(
      end
    )}:${teamIds}`;
  }

  private cacheWeeklyCashFlowTotals(
    cacheKey: string,
    totalsByTeam: ReadonlyMap<string, number>
  ): void {
    this.weeklyCashFlowCache.set(cacheKey, new Map(totalsByTeam));
    if (this.weeklyCashFlowCache.size <= 12) return;

    const oldestKey = this.weeklyCashFlowCache.keys().next().value;
    if (oldestKey) this.weeklyCashFlowCache.delete(oldestKey);
  }

  private applyWeeklyCashFlowTotals(
    totalsByTeam: ReadonlyMap<string, number>
  ): void {
    this.weeklyCashFlowTotals = this.weeklyPaymentTotals
      .map((row) =>
        this.withWeeklyPaymentTotal(
          row,
          Number(totalsByTeam.get(row.trackingId)) || 0
        )
      )
      .sort(
        (a, b) =>
          b.total - a.total || a.firstName.localeCompare(b.firstName, 'fr')
      );
  }

  private withWeeklyPaymentTotal(
    row: WeeklyPaymentTotalRow,
    total: number
  ): WeeklyPaymentTotalRow {
    const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
    const weeklyExpectedProgressPercent =
      row.weeklyExpectedFc === 0
        ? safeTotal > 0
          ? 100
          : 0
        : Math.min(100, (safeTotal / row.weeklyExpectedFc) * 100);
    const weeklyProgressPercent =
      row.weeklyTargetFc === 0
        ? 0
        : Math.min(100, (safeTotal / row.weeklyTargetFc) * 100);
    const weeklyProgressState = this.resolveWeeklyProgressState(
      safeTotal,
      row.weeklyTargetFc
    );

    return {
      ...row,
      total: safeTotal,
      totalInDollar: this.convertFcToDollar(safeTotal),
      weeklyExpectedProgressPercent,
      weeklyExpectedProgressTone: this.resolveExpectedProgressTone(
        weeklyExpectedProgressPercent
      ),
      weeklyTargetReached: safeTotal >= row.weeklyTargetFc,
      weeklyProgressPercent,
      weeklyProgressTone: weeklyProgressState.tone,
      weeklyProgressStatusLabel: weeklyProgressState.statusLabel,
    };
  }

  async captureWeeklyPaymentTable(): Promise<void> {
    if (
      !this.auth.isAdmin ||
      this.isCapturingWeeklyPayment ||
      this.isCapturingWeeklyPaymentRanking
    ) {
      return;
    }

    this.weeklyPaymentCaptureMessage = '';
    this.weeklyPaymentCaptureError = '';

    const source = this.weeklyPaymentCapture?.nativeElement;
    if (!source) {
      this.weeklyPaymentCaptureError =
        'La table n’est pas encore prête pour la capture.';
      return;
    }

    if (this.displayedWeeklyPaymentTotals.length === 0) {
      this.weeklyPaymentCaptureError =
        'Aucune équipe n’est disponible pour cette semaine.';
      return;
    }

    this.isCapturingWeeklyPayment = true;
    try {
      await this.exportWeeklyPaymentElement(
        source,
        this.weeklyPaymentCaptureFileName()
      );
      this.weeklyPaymentCaptureMessage =
        'Capture téléchargée avec succès.';
    } catch (error) {
      console.error('Weekly payment capture failed.', error);
      this.weeklyPaymentCaptureError =
        'Impossible de générer la capture. Veuillez réessayer.';
    } finally {
      this.isCapturingWeeklyPayment = false;
    }
  }

  captureWeeklyPaymentView(): Promise<void> {
    return this.weeklyPaymentViewMode === 'ranking'
      ? this.captureWeeklyPaymentRanking()
      : this.captureWeeklyPaymentTable();
  }

  async captureWeeklyPaymentRanking(): Promise<void> {
    if (
      !this.auth.isAdmin ||
      this.isCapturingWeeklyPayment ||
      this.isCapturingWeeklyPaymentRanking
    ) {
      return;
    }

    this.weeklyPaymentCaptureMessage = '';
    this.weeklyPaymentCaptureError = '';

    const source = this.weeklyPaymentCapture?.nativeElement;
    if (!source) {
      this.weeklyPaymentCaptureError =
        'Le classement n’est pas encore prêt pour la capture.';
      return;
    }

    if (this.displayedWeeklyPaymentTotals.length === 0) {
      this.weeklyPaymentCaptureError =
        'Aucune équipe n’est disponible pour cette semaine.';
      return;
    }

    this.isCapturingWeeklyPaymentRanking = true;
    try {
      await this.exportWeeklyPaymentRankingElement(
        source,
        this.weeklyPaymentRankingCaptureFileName()
      );
      this.weeklyPaymentCaptureMessage =
        'Capture du classement téléchargée avec succès.';
    } catch (error) {
      console.error('Weekly payment ranking capture failed.', error);
      this.weeklyPaymentCaptureError =
        'Impossible de générer la capture. Veuillez réessayer.';
    } finally {
      this.isCapturingWeeklyPaymentRanking = false;
    }
  }

  private exportWeeklyPaymentElement(
    source: HTMLElement,
    fileName: string
  ): Promise<void> {
    return exportElementAsPng(source, {
      fileName,
      captureWidth: 1320,
      preferredScale: 2,
      backgroundColor: '#ffffff',
      exportClassName: 'weekly-payment-capture--export',
      excludeSelector: '[data-capture-exclude="true"]',
    });
  }

  private exportWeeklyPaymentRankingElement(
    source: HTMLElement,
    fileName: string
  ): Promise<void> {
    return exportElementAsPng(source, {
      fileName,
      captureWidth: 940,
      preferredScale: 2,
      backgroundColor: '#ffffff',
      exportClassName: 'weekly-payment-ranking-capture--export',
      excludeSelector: '[data-capture-exclude="true"]',
    });
  }

  private weeklyPaymentCaptureFileName(): string {
    const source =
      this.weeklyPaymentSourceMode === 'cashFlow' ? 'cash-flow-' : '';
    try {
      const { start, end } = this.getWeekBounds(
        this.weeklyPaymentDateCorrectFormat
      );
      return `paiement-${source}semaine-${this.formatIsoDate(
        start
      )}-au-${this.formatIsoDate(end)}.png`;
    } catch {
      return `paiement-${source}semaine-${
        this.weeklyPaymentDate || 'selection'
      }.png`;
    }
  }

  private weeklyPaymentRankingCaptureFileName(): string {
    const source =
      this.weeklyPaymentSourceMode === 'cashFlow' ? 'cash-flow-' : '';
    try {
      const { start, end } = this.getWeekBounds(
        this.weeklyPaymentDateCorrectFormat
      );
      return `classement-paiement-${source}semaine-${this.formatIsoDate(
        start
      )}-au-${this.formatIsoDate(end)}.png`;
    } catch {
      return `classement-paiement-${source}semaine-${
        this.weeklyPaymentDate || 'selection'
      }.png`;
    }
  }

  async updateWeeklyPaymentHistory(
    range: WeeklyPaymentHistoryRange
  ): Promise<void> {
    if (!this.auth.isAdmin) return;

    this.weeklyPaymentHistoryDateError = '';
    const bounds =
      range === 'CUSTOM'
        ? this.resolveCustomWeeklyPaymentHistoryBounds()
        : this.resolvePresetWeeklyPaymentHistoryBounds(range);
    if (!bounds) return;

    this.weeklyPaymentHistoryRange = range;
    this.weeklyPaymentHistoryStartDate = this.formatIsoDate(bounds.start);
    this.weeklyPaymentHistoryEndDate = this.formatIsoDate(bounds.end);
    const points = this.buildWeeklyPaymentHistory(bounds.start, bounds.end);
    const today = this.parsePaymentDateKey(
      this.time.todaysDateMonthDayYear()
    )!;
    this.weeklyPaymentHistoryIncludesCurrentWeek =
      bounds.start <= today && bounds.end >= today;

    if (this.isWeeklyPaymentHistoryCashFlowMode()) {
      await this.loadWeeklyPaymentHistoryCashFlow(points, bounds);
      return;
    }

    this.weeklyPaymentHistoryCashFlowError = '';
    this.renderWeeklyPaymentHistory(points);
  }

  private renderWeeklyPaymentHistory(
    points: WeeklyPaymentHistoryPoint[]
  ): void {
    const metrics = this.weeklyPaymentHistoryMetrics();
    const hasSelectedData = points.some((point) =>
      metrics.some((metric) => this.weeklyPaymentHistoryValue(point, metric) !== 0)
    );
    const chartTitle = this.weeklyPaymentHistoryChartTitle();

    if (!hasSelectedData) {
      this.graphWeeklyPayments = this.createEmptyStockGraph(chartTitle);
      return;
    }

    const displayedValues = metrics.flatMap((metric) =>
      points.map((point) =>
        this.convertFcToDollar(this.weeklyPaymentHistoryValue(point, metric))
      )
    );
    const annotations =
      metrics.length > 1
        ? []
        : [this.buildWeeklyHistorySummaryAnnotation(points, metrics[0])];
    const layout: any = this.buildStockChartLayout(chartTitle, {
      annotations,
      showLegend: metrics.length > 1,
    });
    layout.xaxis = {
      ...layout.xaxis,
      type: 'date',
      tickformat: '%d/%m',
      hoverformat: '%d/%m/%Y',
    };
    const focusedYAxisRange =
      this.buildFocusedWeeklyPaymentYAxisRange(displayedValues);
    layout.yaxis = {
      ...layout.yaxis,
      autorange: focusedYAxisRange ? false : true,
      ...(focusedYAxisRange ? { range: focusedYAxisRange } : {}),
      nticks: 7,
    };

    this.graphWeeklyPayments = {
      data: metrics.map((metric) =>
        this.buildWeeklyPaymentHistoryTrace(points, metric)
      ),
      layout,
      config: {
        responsive: true,
        displayModeBar: false,
        staticPlot: false,
      },
    };
  }

  async setWeeklyPaymentHistoryMode(
    mode: WeeklyPaymentHistoryMode
  ): Promise<void> {
    if (!this.auth.isAdmin || this.weeklyPaymentHistoryMode === mode) return;
    this.weeklyPaymentHistoryMode = mode;
    await this.updateWeeklyPaymentHistory(this.weeklyPaymentHistoryRange);
  }

  async retryWeeklyPaymentHistoryCashFlow(): Promise<void> {
    if (!this.auth.isAdmin || this.weeklyPaymentHistoryCashFlowLoading) return;
    await this.updateWeeklyPaymentHistory(this.weeklyPaymentHistoryRange);
  }

  private isWeeklyPaymentHistoryCashFlowMode(): boolean {
    return (
      this.weeklyPaymentHistoryMode === 'cashFlow' ||
      this.weeklyPaymentHistoryMode === 'paymentCashFlowCombined' ||
      this.weeklyPaymentHistoryMode === 'cashFlowCombined'
    );
  }

  private weeklyPaymentHistoryMetrics(): WeeklyPaymentHistoryMetric[] {
    switch (this.weeklyPaymentHistoryMode) {
      case 'paymentCashFlowCombined':
        return ['payment', 'cashFlow'];
      case 'cashFlowCombined':
        return ['cashFlow', 'reserve'];
      case 'combined':
        return ['payment', 'reserve'];
      case 'cashFlow':
        return ['cashFlow'];
      case 'reserve':
        return ['reserve'];
      default:
        return ['payment'];
    }
  }

  private weeklyPaymentHistoryValue(
    point: WeeklyPaymentHistoryPoint,
    metric: WeeklyPaymentHistoryMetric
  ): number {
    if (metric === 'cashFlow') return point.cashFlowFc;
    return metric === 'reserve' ? point.reserveFc : point.totalFc;
  }

  private weeklyPaymentHistoryChartTitle(): string {
    if (this.weeklyPaymentHistoryMode === 'paymentCashFlowCombined') {
      return 'Paiements et cash flow par semaine (en $)';
    }
    if (this.weeklyPaymentHistoryMode === 'cashFlowCombined') {
      return 'Cash flow et réserve par semaine (en $)';
    }
    if (this.weeklyPaymentHistoryMode === 'combined') {
      return 'Paiements et réserve par semaine (en $)';
    }
    if (this.weeklyPaymentHistoryMode === 'cashFlow') {
      return 'Paiements cash flow par semaine (en $)';
    }
    if (this.weeklyPaymentHistoryMode === 'reserve') {
      return 'Réserve par semaine (en $)';
    }
    return 'Paiements par semaine (en $)';
  }

  private buildWeeklyPaymentHistoryTrace(
    points: WeeklyPaymentHistoryPoint[],
    metric: WeeklyPaymentHistoryMetric
  ): any {
    const isReserve = metric === 'reserve';
    const isCashFlow = metric === 'cashFlow';
    const color = isReserve ? '#0284c7' : isCashFlow ? '#059669' : '#4f46e5';
    const label = isReserve
      ? 'Réserve'
      : isCashFlow
      ? 'Paiements cash flow'
      : 'Paiements';

    return {
      x: points.map((point) => this.formatIsoDate(point.weekStart)),
      y: points.map((point) =>
        this.convertFcToDollar(this.weeklyPaymentHistoryValue(point, metric))
      ),
      customdata: points.map((point) => [
        this.weeklyPaymentHistoryValue(point, metric),
        this.formatWeeklyHistoryLabel(point.weekStart),
        point.boundaryNote ? `<br><i>${point.boundaryNote}</i>` : '',
      ]),
      type: 'scatter',
      mode: 'lines+markers',
      name: label,
      line: {
        color,
        width: 2.5,
        shape: 'spline',
      },
      marker: {
        color,
        size: 7,
        line: {
          color: this.isDarkModeEnabled() ? '#0f172a' : '#ffffff',
          width: 1.5,
        },
      },
      hovertemplate:
        '<b>%{customdata[1]}</b><br>' +
        `${label}: <b>%{customdata[0]:,.0f} FC</b><br>` +
        'Équivalent: <b>$%{y:,.2f}</b>%{customdata[2]}' +
        '<extra></extra>',
    };
  }

  private buildWeeklyHistorySummaryAnnotation(
    points: WeeklyPaymentHistoryPoint[],
    metric: WeeklyPaymentHistoryMetric
  ): any {
    const valuesFc = points.map((point) =>
      this.weeklyPaymentHistoryValue(point, metric)
    );
    const valuesDollar = valuesFc.map((value) => this.convertFcToDollar(value));
    const latestFc = valuesFc[valuesFc.length - 1] || 0;
    const latestDollar = valuesDollar[valuesDollar.length - 1] || 0;
    const previousDollar =
      valuesDollar.length > 1 ? valuesDollar[valuesDollar.length - 2] : 0;
    const hasPrevious = valuesDollar.length > 1;
    const changeDollar = hasPrevious ? latestDollar - previousDollar : 0;
    const changePercent =
      hasPrevious && previousDollar > 0
        ? (changeDollar / previousDollar) * 100
        : null;
    const trendColor =
      changeDollar > 0
        ? '#059669'
        : changeDollar < 0
        ? '#e11d48'
        : '#64748b';

    return this.buildWeeklyPaymentSummaryAnnotation(
      latestFc,
      latestDollar,
      changeDollar,
      changePercent,
      trendColor
    );
  }

  private async loadWeeklyPaymentHistoryCashFlow(
    points: WeeklyPaymentHistoryPoint[],
    bounds: { start: Date; end: Date }
  ): Promise<void> {
    const teams = (this.allUsers || []).filter((user) => !!user.uid);
    if (!teams.length) {
      this.weeklyPaymentHistoryCashFlowError = '';
      this.renderWeeklyPaymentHistory(points);
      return;
    }

    const cacheKey = this.weeklyPaymentHistoryCashFlowCacheKey(bounds);
    const cachedTotals = this.weeklyPaymentHistoryCashFlowCache.get(cacheKey);
    if (cachedTotals) {
      this.weeklyPaymentHistoryCashFlowError = '';
      this.renderWeeklyPaymentHistory(
        this.withWeeklyPaymentHistoryCashFlow(points, cachedTotals)
      );
      return;
    }
    if (
      this.weeklyPaymentHistoryCashFlowLoading &&
      this.weeklyPaymentHistoryCashFlowLoadingKey === cacheKey
    ) {
      return;
    }

    const requestId = ++this.weeklyPaymentHistoryCashFlowRequestVersion;
    this.weeklyPaymentHistoryCashFlowLoading = true;
    this.weeklyPaymentHistoryCashFlowLoadingKey = cacheKey;
    this.weeklyPaymentHistoryCashFlowError = '';
    this.graphWeeklyPayments = this.createEmptyStockGraph(
      this.weeklyPaymentHistoryChartTitle()
    );

    try {
      const dailyTotals = await this.data.getEmployeeCashPaymentDayTotals(
        bounds.start.getTime(),
        bounds.end.getTime(),
        teams.map((team) => team.uid!)
      );
      if (
        requestId !== this.weeklyPaymentHistoryCashFlowRequestVersion ||
        cacheKey !== this.weeklyPaymentHistoryCashFlowCacheKey(bounds)
      ) {
        return;
      }

      const totalsByWeek = new Map<number, number>();
      dailyTotals.forEach((entry) => {
        const entryDate = this.parsePaymentDateKey(entry.dayKey);
        if (!entryDate || entryDate < bounds.start || entryDate > bounds.end) {
          return;
        }

        const weekStart = this.getWeekBounds(entry.dayKey).start.getTime();
        totalsByWeek.set(
          weekStart,
          (totalsByWeek.get(weekStart) || 0) + (Number(entry.total) || 0)
        );
      });
      this.cacheWeeklyPaymentHistoryCashFlow(cacheKey, totalsByWeek);

      if (this.isWeeklyPaymentHistoryCashFlowMode()) {
        this.renderWeeklyPaymentHistory(
          this.withWeeklyPaymentHistoryCashFlow(points, totalsByWeek)
        );
      }
    } catch (error) {
      if (requestId !== this.weeklyPaymentHistoryCashFlowRequestVersion) return;
      console.error('Unable to load weekly cash-flow payment history', error);
      this.weeklyPaymentHistoryCashFlowError =
        'Impossible de charger l’historique des paiements cash flow.';
    } finally {
      if (requestId === this.weeklyPaymentHistoryCashFlowRequestVersion) {
        this.weeklyPaymentHistoryCashFlowLoading = false;
        this.weeklyPaymentHistoryCashFlowLoadingKey = '';
      }
    }
  }

  private weeklyPaymentHistoryCashFlowCacheKey(bounds: {
    start: Date;
    end: Date;
  }): string {
    const teamIds = (this.allUsers || [])
      .map((user) => user.uid || '')
      .filter(Boolean)
      .sort()
      .join(',');
    return `${this.formatIsoDate(bounds.start)}:${this.formatIsoDate(
      bounds.end
    )}:${teamIds}`;
  }

  private cacheWeeklyPaymentHistoryCashFlow(
    cacheKey: string,
    totalsByWeek: ReadonlyMap<number, number>
  ): void {
    this.weeklyPaymentHistoryCashFlowCache.set(
      cacheKey,
      new Map(totalsByWeek)
    );
    if (this.weeklyPaymentHistoryCashFlowCache.size <= 8) return;

    const oldestKey = this.weeklyPaymentHistoryCashFlowCache.keys().next().value;
    if (oldestKey) this.weeklyPaymentHistoryCashFlowCache.delete(oldestKey);
  }

  private withWeeklyPaymentHistoryCashFlow(
    points: WeeklyPaymentHistoryPoint[],
    totalsByWeek: ReadonlyMap<number, number>
  ): WeeklyPaymentHistoryPoint[] {
    return points.map((point) => ({
      ...point,
      cashFlowFc: Number(totalsByWeek.get(point.weekStart.getTime())) || 0,
    }));
  }

  private buildFocusedWeeklyPaymentYAxisRange(
    values: number[]
  ): [number, number] | undefined {
    const finiteValues = values.filter(
      (value) => Number.isFinite(value) && value >= 0
    );
    if (finiteValues.length === 0) return undefined;

    const minimum = Math.min(...finiteValues);
    const maximum = Math.max(...finiteValues);
    if (maximum <= 0) return undefined;

    // A flat or zero-containing series keeps an honest zero baseline. When all
    // displayed values are positive and vary, focus the scale on that visible
    // range so weekly differences remain legible.
    if (minimum <= 0 || minimum === maximum) {
      return [0, maximum * 1.1];
    }

    const spread = maximum - minimum;
    const padding = Math.max(spread * 0.12, maximum * 0.025);
    return [Math.max(0, minimum - padding), maximum + padding];
  }

  applyWeeklyPaymentHistoryDateRange(): void {
    this.updateWeeklyPaymentHistory('CUSTOM');
  }

  private buildWeeklyPaymentHistory(
    rangeStart: Date,
    rangeEnd: Date
  ): WeeklyPaymentHistoryPoint[] {
    if (!this.auth.isAdmin || rangeStart > rangeEnd) {
      return [];
    }

    const firstWeekStart = this.getWeekBounds(
      this.formatDateKey(rangeStart)
    ).start;
    const lastWeekStart = this.getWeekBounds(
      this.formatDateKey(rangeEnd)
    ).start;

    const paymentsByWeek = new Map<number, number>();
    const reservesByWeek = new Map<number, number>();

    const addToWeek = (
      totals: Map<number, number>,
      entryDate: Date,
      amount: number
    ) => {
      const weekStart = this.getWeekBounds(
        this.formatDateKey(entryDate)
      ).start;
      const weekStamp = weekStart.getTime();
      totals.set(weekStamp, (totals.get(weekStamp) || 0) + amount);
    };

    (this.allUsers || []).forEach((user) => {
      Object.entries(user.dailyReimbursement || {}).forEach(
        ([dateKey, rawAmount]) => {
          const paymentDate = this.parsePaymentDateKey(dateKey);
          const amount = Number(rawAmount);

          if (
            !paymentDate ||
            paymentDate < rangeStart ||
            paymentDate > rangeEnd ||
            !Number.isFinite(amount)
          ) {
            return;
          }

          addToWeek(paymentsByWeek, paymentDate, amount);
        }
      );

      Object.entries(user.reserve || {}).forEach(([dateKey, rawAmount]) => {
        const reserveDate = this.parseReserveDateKey(dateKey);
        const amount = Number(rawAmount);

        if (
          !reserveDate ||
          reserveDate < rangeStart ||
          reserveDate > rangeEnd ||
          !Number.isFinite(amount)
        ) {
          return;
        }

        addToWeek(reservesByWeek, reserveDate, amount);
      });
    });

    const points: WeeklyPaymentHistoryPoint[] = [];
    const cursor = new Date(firstWeekStart);
    const today = this.parsePaymentDateKey(
      this.time.todaysDateMonthDayYear()
    )!;
    const currentWeekStart = this.getWeekBounds(
      this.time.todaysDateMonthDayYear()
    ).start;

    while (cursor <= lastWeekStart) {
      const weekEnd = new Date(cursor);
      weekEnd.setDate(cursor.getDate() + 6);
      const boundaryNotes: string[] = [];

      if (
        cursor.getTime() === firstWeekStart.getTime() &&
        rangeStart > cursor
      ) {
        boundaryNotes.push('Début de période (semaine partielle)');
      }

      if (
        cursor.getTime() === lastWeekStart.getTime() &&
        currentWeekStart.getTime() === cursor.getTime() &&
        rangeEnd >= today
      ) {
        boundaryNotes.push('Semaine en cours (partielle)');
      } else if (
        cursor.getTime() === lastWeekStart.getTime() &&
        rangeEnd < weekEnd
      ) {
        boundaryNotes.push('Fin de période (semaine partielle)');
      }

      points.push({
        weekStart: new Date(cursor),
        totalFc: paymentsByWeek.get(cursor.getTime()) || 0,
        cashFlowFc: 0,
        reserveFc: reservesByWeek.get(cursor.getTime()) || 0,
        boundaryNote: boundaryNotes.join(' · '),
      });
      cursor.setDate(cursor.getDate() + 7);
    }

    return points;
  }

  private resolvePresetWeeklyPaymentHistoryBounds(
    range: WeeklyPaymentHistoryPreset
  ): { start: Date; end: Date } {
    const { start: selectedWeekStart, end: selectedWeekEnd } =
      this.getWeekBounds(this.weeklyPaymentDateCorrectFormat);
    const today = this.parsePaymentDateKey(
      this.time.todaysDateMonthDayYear()
    )!;
    const selectedWeekContainsToday =
      selectedWeekStart <= today && selectedWeekEnd >= today;
    const end = selectedWeekContainsToday
      ? new Date(today)
      : new Date(selectedWeekEnd);

    if (range === 'MAX') {
      return {
        start:
          this.findEarliestWeeklyHistoryDate(end) ||
          new Date(selectedWeekStart),
        end,
      };
    }

    const weeksBack: Record<
      Exclude<WeeklyPaymentHistoryPreset, 'MAX'>,
      number
    > = {
      '1M': 4,
      '3M': 13,
      '6M': 26,
      '1A': 52,
    };
    const start = new Date(selectedWeekStart);
    start.setDate(selectedWeekStart.getDate() - weeksBack[range] * 7);
    return { start, end };
  }

  private resolveCustomWeeklyPaymentHistoryBounds(): {
    start: Date;
    end: Date;
  } | null {
    const start = this.parseIsoDateKey(this.weeklyPaymentHistoryStartDate);
    const end = this.parseIsoDateKey(this.weeklyPaymentHistoryEndDate);

    if (!start || !end) {
      this.weeklyPaymentHistoryDateError =
        'Sélectionnez une date de début et une date de fin valides.';
      return null;
    }

    if (start > end) {
      this.weeklyPaymentHistoryDateError =
        'La date de début doit précéder ou être égale à la date de fin.';
      return null;
    }

    return { start, end };
  }

  private findEarliestWeeklyHistoryDate(end: Date): Date | null {
    let earliest: Date | null = null;

    const consider = (entryDate: Date | null, rawAmount: unknown) => {
      const amount = Number(rawAmount);
      if (
        !entryDate ||
        entryDate > end ||
        !Number.isFinite(amount) ||
        amount === 0
      ) {
        return;
      }

      if (!earliest || entryDate < earliest) {
        earliest = entryDate;
      }
    };

    const includedMetrics = this.weeklyPaymentHistoryMetrics();
    (this.allUsers || []).forEach((user) => {
      if (
        includedMetrics.includes('payment') ||
        includedMetrics.includes('cashFlow')
      ) {
        Object.entries(user.dailyReimbursement || {}).forEach(
          ([dateKey, rawAmount]) =>
            consider(this.parsePaymentDateKey(dateKey), rawAmount)
        );
      }
      if (includedMetrics.includes('reserve')) {
        Object.entries(user.reserve || {}).forEach(([dateKey, rawAmount]) =>
          consider(this.parseReserveDateKey(dateKey), rawAmount)
        );
      }
    });

    return earliest ? new Date(earliest) : null;
  }

  private parseIsoDateKey(dateKey: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey || '');
    if (!match) return null;
    return this.createValidatedDate(
      Number(match[1]),
      Number(match[2]),
      Number(match[3])
    );
  }

  private parsePaymentDateKey(dateKey: string): Date | null {
    const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(dateKey || '');
    if (!match) return null;
    return this.createValidatedDate(
      Number(match[3]),
      Number(match[1]),
      Number(match[2])
    );
  }

  private parseReserveDateKey(dateKey: string): Date | null {
    const match = /^(\d{1,2})-(\d{1,2})-(\d{4})(?:-|$)/.exec(dateKey || '');
    if (!match) return null;
    return this.createValidatedDate(
      Number(match[3]),
      Number(match[1]),
      Number(match[2])
    );
  }

  private createValidatedDate(
    year: number,
    month: number,
    day: number
  ): Date | null {
    const parsed = new Date(year, month - 1, day);

    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return null;
    }

    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  private formatIsoDate(date: Date): string {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  private formatWeeklyHistoryLabel(weekStart: Date): string {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `Semaine du ${this.formatNumericDate(
      weekStart
    )} au ${this.formatNumericDate(weekEnd)}`;
  }

  private formatNumericDate(date: Date): string {
    return `${`${date.getDate()}`.padStart(2, '0')}/${`${
      date.getMonth() + 1
    }`.padStart(2, '0')}/${date.getFullYear()}`;
  }

  private computeWeeklyPaymentTotals() {
    if (!this.auth.isAdmin) return;
    if (!this.allUsers || this.allUsers.length === 0) return;

    this.overallWeeklyPaymentTotal = 0;
    this.overallWeeklyReserveTotal = 0;
    this.overallWeeklyExpectedTotal = 0;
    this.weeklyPaymentTotals = this.allUsers.map((user) => {
      const weeklyTargetFc = this.resolveWeeklyTargetFcForUser(
        user,
        this.weeklyPaymentDateCorrectFormat
      );
      const weeklyExpectedFc = this.computeWeeklyExpectedTotalForUser(
        user,
        this.weeklyPaymentDateCorrectFormat
      );
      const total = this.computeWeeklyPaymentTotalForUser(
        user,
        this.weeklyPaymentDateCorrectFormat
      );
      const weeklyReserveFc = this.computeWeeklyReserveTotalForUser(
        user,
        this.weeklyPaymentDateCorrectFormat
      );
      const totalInDollar = Number(
        this.compute.convertCongoleseFrancToUsDollars(total.toString())
      );
      const weeklyReserveDollar = Number(
        this.compute.convertCongoleseFrancToUsDollars(
          weeklyReserveFc.toString()
        )
      );
      const weeklyExpectedDollar = Number(
        this.compute.convertCongoleseFrancToUsDollars(
          weeklyExpectedFc.toString()
        )
      );
      const weeklyExpectedProgressPercent =
        weeklyExpectedFc === 0
          ? total > 0
            ? 100
            : 0
          : Math.min(100, (total / weeklyExpectedFc) * 100);
      const weeklyExpectedProgressTone =
        this.resolveExpectedProgressTone(weeklyExpectedProgressPercent);
      const weeklyTargetReached = total >= weeklyTargetFc;
      const weeklyProgressPercent =
        weeklyTargetFc === 0 ? 0 : Math.min(100, (total / weeklyTargetFc) * 100);
      const weeklyProgressState = this.resolveWeeklyProgressState(
        total,
        weeklyTargetFc
      );
      const weeklyReserveProgressPercent =
        weeklyExpectedFc === 0
          ? weeklyReserveFc > 0
            ? 100
            : 0
          : Math.min(
              100,
              Math.max(0, (weeklyReserveFc / weeklyExpectedFc) * 100)
            );
      const weeklyReserveProgressTone = this.resolveExpectedProgressTone(
        weeklyReserveProgressPercent
      );

      this.overallWeeklyPaymentTotal += total;
      this.overallWeeklyReserveTotal += weeklyReserveFc;
      this.overallWeeklyExpectedTotal += weeklyExpectedFc;

      return {
        firstName: user.firstName!,
        total,
        totalInDollar,
        weeklyReserveFc,
        weeklyReserveDollar,
        weeklyReserveProgressPercent,
        weeklyReserveProgressTone,
        weeklyReserveProgressStatusLabel: this.resolveExpectedStatusLabel(
          weeklyReserveProgressPercent
        ),
        weeklyExpectedFc,
        weeklyExpectedDollar,
        weeklyExpectedProgressPercent,
        weeklyExpectedProgressTone,
        weeklyTargetFc,
        weeklyProgressPercent,
        weeklyTargetReached,
        weeklyProgressTone: weeklyProgressState.tone,
        weeklyProgressStatusLabel: weeklyProgressState.statusLabel,
        weeklyProgressMarkers: this.buildWeeklyProgressMarkers(weeklyTargetFc),
        trackingId: user.uid!,
      };
    });

    this.weeklyPaymentTotals.sort((a, b) => b.total - a.total);
    this.overallWeeklyPaymentTotalDollar = Number(
      this.compute.convertCongoleseFrancToUsDollars(
        this.overallWeeklyPaymentTotal.toString()
      )
    );
    this.overallWeeklyReserveTotalDollar = Number(
      this.compute.convertCongoleseFrancToUsDollars(
        this.overallWeeklyReserveTotal.toString()
      )
    );
    this.overallWeeklyExpectedTotalDollar = Number(
      this.compute.convertCongoleseFrancToUsDollars(
        this.overallWeeklyExpectedTotal.toString()
      )
    );
    this.overallWeeklyExpectedProgressPercent =
      this.overallWeeklyExpectedTotal === 0
        ? this.overallWeeklyPaymentTotal > 0
          ? 100
          : 0
        : Math.min(
            100,
            (this.overallWeeklyPaymentTotal / this.overallWeeklyExpectedTotal) *
              100
          );
    this.overallWeeklyExpectedProgressTone = this.resolveExpectedProgressTone(
      this.overallWeeklyExpectedProgressPercent
    );
    this.overallWeeklyReserveProgressPercent =
      this.overallWeeklyExpectedTotal === 0
        ? this.overallWeeklyReserveTotal > 0
          ? 100
          : 0
        : Math.min(
            100,
            Math.max(
              0,
              (this.overallWeeklyReserveTotal /
                this.overallWeeklyExpectedTotal) *
                100
            )
          );
    this.overallWeeklyReserveProgressTone = this.resolveExpectedProgressTone(
      this.overallWeeklyReserveProgressPercent
    );

    if (this.weeklyPaymentSourceMode === 'cashFlow') {
      const cachedTotals = this.weeklyCashFlowCache.get(
        this.weeklyCashFlowCacheKey()
      );
      if (cachedTotals) {
        this.applyWeeklyCashFlowTotals(cachedTotals);
      }
    }
  }

  /**
   * Refresh only the fields derived from the configured weekly minimum.
   * This handles the asynchronous target hydration after a hard refresh
   * without repeating payment, reserve, client, or currency calculations.
   */
  private refreshWeeklyPaymentTargetCells(): void {
    if (
      !this.auth.isAdmin ||
      !this.weeklyPaymentDateCorrectFormat ||
      this.weeklyPaymentTotals.length === 0
    ) {
      return;
    }

    const usersById = new Map(
      (this.allUsers || [])
        .filter((user) => !!user.uid)
        .map((user) => [user.uid as string, user] as const)
    );

    this.weeklyPaymentTotals = this.weeklyPaymentTotals.map((row) => {
      const user = usersById.get(row.trackingId);
      if (!user) return row;

      const weeklyTargetFc = this.resolveWeeklyTargetFcForUser(
        user,
        this.weeklyPaymentDateCorrectFormat
      );
      const weeklyProgressState = this.resolveWeeklyProgressState(
        row.total,
        weeklyTargetFc
      );

      return {
        ...row,
        weeklyTargetFc,
        weeklyTargetReached: row.total >= weeklyTargetFc,
        weeklyProgressPercent:
          weeklyTargetFc === 0
            ? 0
            : Math.min(100, (row.total / weeklyTargetFc) * 100),
        weeklyProgressTone: weeklyProgressState.tone,
        weeklyProgressStatusLabel: weeklyProgressState.statusLabel,
        weeklyProgressMarkers: this.buildWeeklyProgressMarkers(weeklyTargetFc),
      };
    });

    if (this.weeklyCashFlowTotals.length > 0) {
      this.applyWeeklyCashFlowTotals(
        new Map(
          this.weeklyCashFlowTotals.map(
            (row) => [row.trackingId, row.total] as const
          )
        )
      );
    }
  }

  private computeWeeklyPaymentTotalForUser(user: User, dateKey: string): number {
    const { start, end } = this.getWeekBounds(dateKey);
    const payments = user.dailyReimbursement || {};
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

  private resolveWeeklyTargetFcForUser(user: User, dateKey: string): number {
    const { start } = this.getWeekBounds(dateKey);
    return this.auth.resolveWeeklyPaymentTargetForDate(
      this.formatDateKey(start),
      user
    );
  }

  private computeWeeklyExpectedTotalForUser(user: User, dateKey: string): number {
    const clients = this.weeklyClientsByUser.get(user.uid || '') || [];
    if (clients.length === 0) return 0;

    const clientsWithDebts = this.data.findClientsWithDebts(clients);
    const { start, end } = this.getWeekBounds(dateKey);
    const cursor = new Date(start);
    let total = 0;

    while (cursor <= end) {
      const dayName = this.time.getDayOfWeek(this.formatDateKey(cursor));
      const clientsExpectedForDay = clientsWithDebts.filter((client) => {
        return (
          Number(client.debtLeft) > 0 &&
          client.paymentDay === dayName &&
          this.data.didClientStartThisWeek(client)
        );
      });

      total += this.compute.computeExpectedPerDate(clientsExpectedForDay);
      cursor.setDate(cursor.getDate() + 1);
    }

    return total;
  }

  private buildGestionHeatmapTiles(): GestionHeatmapTile[] {
    const baseRows = this.getGestionHeatmapBaseRows();
    const totalDone = baseRows.reduce((sum, row) => sum + Math.max(row.valueFc, 0), 0);
    const rows =
      totalDone > 0
        ? baseRows
            .filter((row) => row.valueFc > 0)
            .sort((a, b) => b.valueFc - a.valueFc)
        : [];
    const layout = this.buildGestionTreemapLayout(
      rows.map((row) => Math.max(row.valueFc, 1))
    );

    return rows.map((row, index) => {
      const percent =
        row.expectedFc === 0
          ? row.valueFc > 0
            ? 100
            : 0
          : Math.min(100, (row.valueFc / row.expectedFc) * 100);
      const tone = this.resolveExpectedProgressTone(percent);
      const rect = layout[index] || { x: 0, y: 0, width: 0, height: 0 };

      return {
        ...row,
        shortLabel: this.buildShortTeamLabel(row.label),
        compactValue: this.formatCompactFc(row.valueFc),
        percent,
        sharePercent: totalDone === 0 ? 0 : (row.valueFc / totalDone) * 100,
        tone,
        statusLabel: this.resolveExpectedStatusLabel(percent),
        layoutStyle: {
          left: `${rect.x}%`,
          top: `${rect.y}%`,
          width: `${rect.width}%`,
          height: `${rect.height}%`,
        },
      };
    });
  }

  private getGestionHeatmapBaseRows(): Array<{
    label: string;
    valueFc: number;
    valueDollar: number;
    expectedFc: number;
    detailLabel: string;
  }> {
    if (this.gestionHeatmapMode === 'paymentToday') {
      return this.buildPaymentHeatmapRowsForDate(
        this.heatmapPaymentDateCorrectFormat
      );
    }

    if (this.gestionHeatmapMode === 'reserveToday') {
      return this.reserveTotals.map((row) => {
        const valueFc = Number(row.actual || 0);

        return {
          label: row.firstName,
          valueFc,
          valueDollar: this.convertFcToDollar(valueFc),
          expectedFc: Number(row.total || 0),
          detailLabel: 'Réserve attendue',
        };
      });
    }

    return this.weeklyPaymentTotals.map((row) => {
      const valueFc =
        this.gestionHeatmapMode === 'paymentWeek'
          ? Number(row.total || 0)
          : Number(row.weeklyReserveFc || 0);

      return {
        label: row.firstName,
        valueFc,
        valueDollar: this.convertFcToDollar(valueFc),
        expectedFc: Number(row.weeklyExpectedFc || 0),
        detailLabel:
          this.gestionHeatmapMode === 'paymentWeek'
            ? 'Attendu semaine'
            : 'Réserve attendue',
      };
    });
  }

  private buildPaymentHeatmapRowsForDate(dateKey: string): Array<{
    label: string;
    valueFc: number;
    valueDollar: number;
    expectedFc: number;
    detailLabel: string;
  }> {
    return (this.allUsers || []).map((user) => {
      const valueFc = Number(user.dailyReimbursement?.[dateKey] || 0);
      const safeValueFc = Number.isFinite(valueFc) ? valueFc : 0;
      const expectedFc = this.computeExpectedPaymentTotalForUser(user, dateKey);

      return {
        label: user.firstName || 'Sans nom',
        valueFc: safeValueFc,
        valueDollar: this.convertFcToDollar(safeValueFc),
        expectedFc,
        detailLabel: 'Attendu paiement',
      };
    });
  }

  private computeExpectedPaymentTotalForUser(user: User, dateKey: string): number {
    const clients = this.weeklyClientsByUser.get(user.uid || '') || [];
    if (clients.length === 0) return 0;

    const paymentDay = this.time.getDayOfWeek(dateKey);
    const expectedClients = this.data
      .findClientsWithDebts(clients)
      .filter((client) => {
        return (
          Number(client.debtLeft) > 0 &&
          client.paymentDay === paymentDay &&
          this.data.didClientStartThisWeek(client)
        );
      });

    return this.compute.computeExpectedPerDate(expectedClients);
  }

  private computeWeeklyReserveTotalForUser(
    user: User | undefined,
    dateKey: string
  ): number {
    if (!user) return 0;

    const reserves = user.reserve || {};
    const { start, end } = this.getWeekBounds(dateKey);
    const cursor = new Date(start);
    let total = 0;

    while (cursor <= end) {
      const keyPrefix = this.formatDateKey(cursor);
      Object.keys(reserves).forEach((key) => {
        if (!key.startsWith(keyPrefix)) return;
        const amount = Number((reserves as any)[key] ?? 0);
        if (!Number.isNaN(amount)) {
          total += amount;
        }
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return total;
  }

  private buildGestionTreemapLayout(weights: number[]): GestionHeatmapRect[] {
    const rects: GestionHeatmapRect[] = [];
    const items = weights.map((weight, index) => ({
      index,
      weight: Math.max(Number(weight) || 0, 1),
    }));

    this.partitionGestionTreemap(items, { x: 0, y: 0, width: 100, height: 100 }, rects);
    return rects;
  }

  private partitionGestionTreemap(
    items: Array<{ index: number; weight: number }>,
    rect: GestionHeatmapRect,
    rects: GestionHeatmapRect[]
  ): void {
    if (items.length === 0) return;
    if (items.length === 1) {
      rects[items[0].index] = rect;
      return;
    }

    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let running = 0;
    let split = 0;

    for (let i = 0; i < items.length; i++) {
      const next = running + items[i].weight;
      if (i > 0 && Math.abs(total / 2 - running) <= Math.abs(total / 2 - next)) {
        break;
      }
      running = next;
      split = i + 1;
    }

    split = Math.max(1, Math.min(items.length - 1, split));
    const first = items.slice(0, split);
    const second = items.slice(split);
    const firstTotal = first.reduce((sum, item) => sum + item.weight, 0);

    if (rect.width >= rect.height) {
      const firstWidth = rect.width * (firstTotal / total);
      this.partitionGestionTreemap(
        first,
        { ...rect, width: firstWidth },
        rects
      );
      this.partitionGestionTreemap(
        second,
        {
          x: rect.x + firstWidth,
          y: rect.y,
          width: rect.width - firstWidth,
          height: rect.height,
        },
        rects
      );
      return;
    }

    const firstHeight = rect.height * (firstTotal / total);
    this.partitionGestionTreemap(
      first,
      { ...rect, height: firstHeight },
      rects
    );
    this.partitionGestionTreemap(
      second,
      {
        x: rect.x,
        y: rect.y + firstHeight,
        width: rect.width,
        height: rect.height - firstHeight,
      },
      rects
    );
  }

  getGestionHeatmapToneClass(tone: WeeklyProgressTone): string {
    return `gestion-heatmap-tile--${tone}`;
  }

  getGestionHeatmapTextClass(tone: WeeklyProgressTone): { [key: string]: boolean } {
    return {
      'text-red-600': tone === 'red',
      'text-amber-600': tone === 'yellow',
      'text-orange-600': tone === 'orange',
      'text-emerald-600': tone === 'green',
    };
  }

  private resolveExpectedStatusLabel(percent: number): string {
    const value = Number(percent) || 0;

    if (value >= 100) return 'Atteint';
    if (value >= 80) return '80%+';
    if (value >= 50) return '50%+';
    return 'À faire';
  }

  private convertFcToDollar(amountFc: number): number {
    return Number(
      this.compute.convertCongoleseFrancToUsDollars(
        (Number(amountFc) || 0).toString()
      )
    );
  }

  private buildShortTeamLabel(label: string): string {
    return (label || '')
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 3);
  }

  private formatCompactFc(amountFc: number): string {
    const amount = Number(amountFc) || 0;

    if (amount >= 1_000_000) {
      return `${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`;
    }
    if (amount >= 1_000) {
      return `${(amount / 1_000).toFixed(amount >= 100_000 ? 0 : 1)}K`;
    }
    return `${amount}`;
  }

  private resolveExpectedProgressTone(percent: number): WeeklyProgressTone {
    const value = Number(percent) || 0;

    if (value >= 100) return 'green';
    if (value >= 80) return 'orange';
    if (value >= 50) return 'yellow';
    return 'red';
  }

  private resolveWeeklyProgressState(
    totalFc: number,
    targetFc: number
  ): { tone: WeeklyProgressTone; statusLabel: string } {
    const total = Number(totalFc) || 0;
    const target = Number(targetFc) || 0;

    if (!Number.isFinite(target) || target <= 0) {
      return { tone: 'red', statusLabel: 'À faire' };
    }

    if (total >= target) {
      return { tone: 'green', statusLabel: 'Atteint' };
    }

    if (
      target > this.weeklyStretchMilestoneFc &&
      total >= this.weeklyStretchMilestoneFc
    ) {
      return { tone: 'orange', statusLabel: 'Palier 900K' };
    }

    if (
      target > this.weeklyFloorMilestoneFc &&
      total >= this.weeklyFloorMilestoneFc
    ) {
      return { tone: 'yellow', statusLabel: 'Palier 600K' };
    }

    return { tone: 'red', statusLabel: 'À faire' };
  }

  private buildWeeklyProgressMarkers(targetFc: number): WeeklyProgressMarker[] {
    const target = Number(targetFc) || 0;

    if (!Number.isFinite(target) || target <= 0) {
      return [];
    }

    return [
      {
        amountFc: this.weeklyFloorMilestoneFc,
        label: 'Palier 600K',
        percent: (this.weeklyFloorMilestoneFc / target) * 100,
      },
      {
        amountFc: this.weeklyStretchMilestoneFc,
        label: 'Palier 900K',
        percent: (this.weeklyStretchMilestoneFc / target) * 100,
      },
    ].filter(
      (marker) =>
        marker.amountFc < target &&
        Number.isFinite(marker.percent) &&
        marker.percent > 0 &&
        marker.percent < 100
    );
  }

  private computeWeeklyRangeLabel(dateKey: string): string {
    const { start, end } = this.getWeekBounds(dateKey);
    return `${this.formatWeekDate(start)} - ${this.formatWeekDate(end)}`;
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
  setGraphics() {
    let num = Number(this.percentage);
    if (!isFinite(num)) num = 0;
    num = Math.max(0, Math.min(100, num));
    this.avgPerf = num; // <-- feeds the SVG ring

    const gaugeColor = this.compute.getGradientColor(num);
    this.graphMonthPerformance = {
      data: [
        {
          domain: { x: [0, 1], y: [0, 1] },
          value: num,
          title: { text: `Performance Du Jour` },
          type: 'indicator',
          mode: 'gauge+number',
          gauge: {
            axis: { range: [0, 100], tickcolor: gaugeColor },
            bar: { color: gaugeColor },
          },
        },
      ],
      layout: {
        margin: { t: 20, b: 20, l: 20, r: 20 },
        responsive: true,
      },
    };
  }

  updateReserveGraphics(time: number) {
    this.graphicsRange = time;
    let sorted = this.sortKeysAndValuesReserve(time);
    this.recentReserveDates = sorted[0];
    this.recentReserveAmounts = this.compute.convertToDollarsArray(sorted[1]);
    
    if (this.recentReserveAmounts.length < 2) {
      this.graph = this.createEmptyStockGraph('Reserve en $');
      return;
    }

    const firstValue = this.recentReserveAmounts[0] || 0;
    const lastValue = this.recentReserveAmounts[this.recentReserveAmounts.length - 1] || 0;
    const isPositive = lastValue >= firstValue;
    const lineColor = isPositive ? '#26a69a' : '#ef5350';
    const fillGradient = isPositive 
      ? ['rgba(38, 166, 154, 0.1)', 'rgba(38, 166, 154, 0)']
      : ['rgba(239, 83, 80, 0.1)', 'rgba(239, 83, 80, 0)'];

    const change = lastValue - firstValue;
    const changePercent = firstValue > 0 
      ? ((change / firstValue) * 100).toFixed(2)
      : '0.00';

    // Format dates for display - include year if spanning multiple years
    const firstDate = this.recentReserveDates[0] ? this.recentReserveDates[0].split('-').map(Number) : null;
    const lastDate = this.recentReserveDates[this.recentReserveDates.length - 1] ? this.recentReserveDates[this.recentReserveDates.length - 1].split('-').map(Number) : null;
    const spansMultipleYears = firstDate && lastDate && firstDate[2] !== lastDate[2];
    
    const formattedDates = this.recentReserveDates.map((dateStr) => {
      const [month, day, year] = dateStr.split('-').map(Number);
      if (spansMultipleYears) {
        return `${day}/${month}/${year}`;
      }
      return `${day}/${month}`;
    });

    this.graph = {
      data: [
        {
          x: formattedDates,
          y: this.recentReserveAmounts,
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
              { offset: 1, color: fillGradient[1] }
            ]
          },
          hovertemplate: '<b>%{x}</b><br>Réserve: <b>$%{y:,.2f}</b><extra></extra>',
        },
      ],
      layout: this.buildStockChartLayout('Reserve en $', {
        annotations: [
          this.buildStockSummaryAnnotation(
            lastValue,
            change,
            changePercent,
            lineColor
          ),
        ],
      }),
      config: { 
        responsive: true, 
        displayModeBar: false,
        staticPlot: false,
      },
    };
  }

  updateServeGraphics(time: number) {
    this.graphicsRangeServe = time;
    let sorted = this.sortKeysAndValuesServe(time);
    this.recentServeDates = sorted[0];
    this.recentServeAmounts = this.compute.convertToDollarsArray(sorted[1]);
    
    if (this.recentServeAmounts.length < 2) {
      this.graphServe = this.createEmptyStockGraph('Argent A Servir en $');
      return;
    }

    const firstValue = this.recentServeAmounts[0] || 0;
    const lastValue = this.recentServeAmounts[this.recentServeAmounts.length - 1] || 0;
    const isPositive = lastValue >= firstValue;
    const lineColor = isPositive ? '#26a69a' : '#ef5350';
    const fillGradient = isPositive 
      ? ['rgba(38, 166, 154, 0.1)', 'rgba(38, 166, 154, 0)']
      : ['rgba(239, 83, 80, 0.1)', 'rgba(239, 83, 80, 0)'];

    const change = lastValue - firstValue;
    const changePercent = firstValue > 0 
      ? ((change / firstValue) * 100).toFixed(2)
      : '0.00';

    // Format dates for display - include year if spanning multiple years
    const firstDate = this.recentServeDates[0] ? this.recentServeDates[0].split('-').map(Number) : null;
    const lastDate = this.recentServeDates[this.recentServeDates.length - 1] ? this.recentServeDates[this.recentServeDates.length - 1].split('-').map(Number) : null;
    const spansMultipleYears = firstDate && lastDate && firstDate[2] !== lastDate[2];
    
    const formattedDates = this.recentServeDates.map((dateStr) => {
      const [month, day, year] = dateStr.split('-').map(Number);
      if (spansMultipleYears) {
        return `${day}/${month}/${year}`;
      }
      return `${day}/${month}`;
    });

    this.graphServe = {
      data: [
        {
          x: formattedDates,
          y: this.recentServeAmounts,
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
              { offset: 1, color: fillGradient[1] }
            ]
          },
          hovertemplate: '<b>%{x}</b><br>À servir: <b>$%{y:,.2f}</b><extra></extra>',
        },
      ],
      layout: this.buildStockChartLayout('Argent A Servir en $', {
        annotations: [
          this.buildStockSummaryAnnotation(
            lastValue,
            change,
            changePercent,
            lineColor
          ),
        ],
      }),
      config: { 
        responsive: true, 
        displayModeBar: false,
        staticPlot: false,
      },
    };
  }
  sortKeysAndValuesReserve(time: number): [string[], string[]] {
    const dailyReimbursement = this.managementInfo?.reserve || {};

    // Aggregating values by day
    const aggregatedData: { [key: string]: number } = {};
    for (const [key, value] of Object.entries(dailyReimbursement)) {
      const day = key.split('-').slice(0, 3).join('-'); // Extracting the date part
      const numericValue = parseFloat(value as string); // Type assertion
      if (aggregatedData[day]) {
        aggregatedData[day] += numericValue;
      } else {
        aggregatedData[day] = numericValue;
      }
    }

    // Properly parse and sort dates (MM-DD-YYYY format)
    const sortedKeys = Object.keys(aggregatedData)
      .sort((a, b) => {
        const [monthA, dayA, yearA] = a.split('-').map(Number);
        const [monthB, dayB, yearB] = b.split('-').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(-time);
    const values = sortedKeys.map((key) => aggregatedData[key].toString());

    return [sortedKeys, values];
  }

  sortKeysAndValuesServe(time: number) {
    const dailyReimbursement = this.managementInfo?.moneyGiven || {};

    // Aggregating values by day
    const aggregatedData: { [key: string]: number } = {};
    for (const [key, value] of Object.entries(dailyReimbursement)) {
      const day = key.split('-').slice(0, 3).join('-'); // Extracting the date part
      const numericValue = parseFloat(value as string); // Type assertion
      if (aggregatedData[day]) {
        aggregatedData[day] += numericValue;
      } else {
        aggregatedData[day] = numericValue;
      }
    }

    // Properly parse and sort dates (MM-DD-YYYY format)
    const sortedKeys = Object.keys(aggregatedData)
      .sort((a, b) => {
        const [monthA, dayA, yearA] = a.split('-').map(Number);
        const [monthB, dayB, yearB] = b.split('-').map(Number);
        const dateA = new Date(yearA, monthA - 1, dayA);
        const dateB = new Date(yearB, monthB - 1, dayB);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(-time);
    const values = sortedKeys.map((key) => aggregatedData[key].toString());

    return [sortedKeys, values];
  }

  otherDate() {
    // Use the stored value or get from getter if not set yet
    const dateValue = this._requestDateTomorrow || this.requestDateTomorrow;
    const selectedDate = this.time.convertDateToMonthDayYear(dateValue);
    
    // Check if user selected the default effective tomorrow date
    const effectiveTomorrow = this.getEffectiveTomorrowDate();
    
    if (selectedDate === effectiveTomorrow) {
      // User selected the default date, use effective tomorrow
      this.requestDateRigthFormat = effectiveTomorrow;
    } else {
      // User selected a custom date
      this.requestDateRigthFormat = selectedDate;
    }
    
    this.frenchDateTomorrow = this.time.convertDateToDayMonthYear(
      this.requestDateRigthFormat
    );
    if (this.isAuditTeamViewer) {
      this.getAuditOperationalTables();
    } else {
      this.getAllClients();
    }
  }

  updateCombinedGraphics(time: number) {
    this.graphicsRangeCombined = time;
    // Get Reserve data
    let [reserveDates, reserveVals] = this.sortKeysAndValuesReserve(time);
    let [serveDates, serveVals] = this.sortKeysAndValuesServe(time);

    // Convert them into sets for quick membership checks
    let reserveSet = new Set(reserveDates);
    let serveSet = new Set(serveDates);

    // Filter out any dates from Reserve if not in Serve, etc.:
    reserveDates = reserveDates.filter((d) => serveSet.has(d));
    // Do the same for the Serve side:
    serveDates = serveDates.filter((d) => reserveSet.has(d));
    let sortedReserve = this.sortKeysAndValuesReserve(time);
    let reserveAmounts = this.compute.convertToDollarsArray(sortedReserve[1]);

    let sortedServe = this.sortKeysAndValuesServe(time);
    let serveAmounts = this.compute.convertToDollarsArray(sortedServe[1]);

    if (reserveAmounts.length < 2 || serveAmounts.length < 2) {
      this.graphCombined = this.createEmptyStockGraph('Reserve & Argent A Servir (en $)');
      return;
    }

    // Format dates for display - include year if spanning multiple years
    const allDates = [...reserveDates, ...serveDates];
    const firstDate = allDates.length > 0 ? allDates[0].split('-').map(Number) : null;
    const lastDate = allDates.length > 0 ? allDates[allDates.length - 1].split('-').map(Number) : null;
    const spansMultipleYears = firstDate && lastDate && firstDate[2] !== lastDate[2];
    
    const formatDate = (dateStr: string) => {
      const [month, day, year] = dateStr.split('-').map(Number);
      if (spansMultipleYears) {
        return `${day}/${month}/${year}`;
      }
      return `${day}/${month}`;
    };

    const formattedReserveDates = reserveDates.map(formatDate);
    const formattedServeDates = serveDates.map(formatDate);

    // Determine colors based on trends
    const reserveFirst = reserveAmounts[0] || 0;
    const reserveLast = reserveAmounts[reserveAmounts.length - 1] || 0;
    const reserveIsPositive = reserveLast >= reserveFirst;
    const reserveColor = reserveIsPositive ? '#26a69a' : '#ef5350';

    const serveFirst = serveAmounts[0] || 0;
    const serveLast = serveAmounts[serveAmounts.length - 1] || 0;
    const serveIsPositive = serveLast >= serveFirst;
    const serveColor = serveIsPositive ? '#3b82f6' : '#f59e0b';

    // Create two traces
    this.graphCombined = {
      data: [
        {
          x: formattedReserveDates,
          y: reserveAmounts,
          type: 'scatter',
          mode: 'lines',
          name: 'Reserve Par Jour',
          line: {
            color: reserveColor,
            width: 2.5,
            shape: 'spline',
          },
          fill: 'tozeroy',
          fillcolor: reserveColor + '15',
          hovertemplate: '<b>%{x}</b><br>Réserve: <b>$%{y:,.2f}</b><extra></extra>',
        },
        {
          x: formattedServeDates,
          y: serveAmounts,
          type: 'scatter',
          mode: 'lines',
          name: 'Argent A Servir',
          line: {
            color: serveColor,
            width: 2.5,
            shape: 'spline',
          },
          fill: 'tozeroy',
          fillcolor: serveColor + '15',
          hovertemplate: '<b>%{x}</b><br>À servir: <b>$%{y:,.2f}</b><extra></extra>',
        },
      ],
      layout: this.buildStockChartLayout('Reserve & Argent A Servir (en $)', {
        showLegend: true,
      }),
      config: { 
        responsive: true, 
        displayModeBar: false,
        staticPlot: false,
      },
    };
  }

  private createEmptyStockGraph(title: string) {
    return {
      data: [],
      layout: this.buildStockChartLayout(title),
      config: { 
        responsive: true, 
        displayModeBar: false,
        staticPlot: false,
      },
    };
  }

  private observeDarkModeChanges() {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
      return;
    }

    const root = document.documentElement;
    this.darkModeObserver = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.attributeName === 'class')) {
        this.refreshChartVisuals();
      }
    });
    this.darkModeObserver.observe(root, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  private refreshChartVisuals() {
    this.setGraphics();
    this.updateReserveGraphics(this.graphicsRange);
    this.updateServeGraphics(this.graphicsRangeServe);
    this.updateCombinedGraphics(this.graphicsRangeCombined);
    this.updateWeeklyPaymentHistory(this.weeklyPaymentHistoryRange);
  }

  private isDarkModeEnabled(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }

    return (
      document.documentElement.classList.contains('dark') ||
      document.body.classList.contains('dark')
    );
  }

  private getStockChartTheme() {
    if (this.isDarkModeEnabled()) {
      return {
        titleColor: '#f8fafc',
        textColor: '#e2e8f0',
        mutedColor: '#cbd5e1',
        gridColor: 'rgba(148, 163, 184, 0.16)',
        paperBg: 'rgba(15, 23, 42, 0)',
        plotBg: 'rgba(15, 23, 42, 0)',
        panelBg: 'rgba(15, 23, 42, 0.82)',
        borderColor: 'rgba(148, 163, 184, 0.18)',
        hoverBg: '#0f172a',
      };
    }

    return {
      titleColor: '#1a1a1a',
      textColor: '#334155',
      mutedColor: '#64748b',
      gridColor: 'rgba(0, 0, 0, 0.05)',
      paperBg: '#ffffff',
      plotBg: '#ffffff',
      panelBg: 'rgba(255, 255, 255, 0.88)',
      borderColor: 'rgba(226, 232, 240, 0.9)',
      hoverBg: '#ffffff',
    };
  }

  private buildStockChartLayout(
    title: string,
    options: { annotations?: any[]; showLegend?: boolean } = {}
  ) {
    const theme = this.getStockChartTheme();

    return {
      title: {
        text: title,
        font: {
          size: 20,
          color: theme.titleColor,
          family: 'system-ui, -apple-system, sans-serif',
        },
        x: 0.02,
        y: 0.95,
        xanchor: 'left',
        yanchor: 'top',
      },
      font: {
        color: theme.textColor,
        family: 'system-ui, -apple-system, sans-serif',
      },
      annotations: options.annotations || [],
      xaxis: {
        showgrid: true,
        gridcolor: theme.gridColor,
        gridwidth: 1,
        showline: false,
        zeroline: false,
        tickfont: {
          size: 11,
          color: theme.mutedColor,
        },
        title: {
          text: '',
          font: { size: 12, color: theme.mutedColor },
        },
      },
      yaxis: {
        showgrid: true,
        gridcolor: theme.gridColor,
        gridwidth: 1,
        showline: false,
        zeroline: false,
        side: 'right',
        tickfont: {
          size: 11,
          color: theme.mutedColor,
        },
        tickformat: '$,.0f',
        title: {
          text: '',
          font: { size: 12, color: theme.mutedColor },
        },
      },
      height: 450,
      margin: { t: 100, r: 20, l: 20, b: 40 },
      plot_bgcolor: theme.plotBg,
      paper_bgcolor: theme.paperBg,
      hovermode: 'x unified',
      hoverlabel: {
        bgcolor: theme.hoverBg,
        bordercolor: theme.borderColor,
        font: {
          color: theme.titleColor,
        },
      },
      showlegend: options.showLegend ?? false,
      legend: {
        x: 0.02,
        y: 0.85,
        xanchor: 'left',
        yanchor: 'top',
        bgcolor: theme.panelBg,
        bordercolor: theme.borderColor,
        borderwidth: 1,
        font: {
          color: theme.textColor,
        },
      },
      autosize: true,
    };
  }

  private buildStockSummaryAnnotation(
    lastValue: number,
    change: number,
    changePercent: string,
    lineColor: string
  ) {
    const theme = this.getStockChartTheme();
    const changeSign = change >= 0 ? '+' : '';

    return {
      xref: 'paper',
      yref: 'paper',
      x: 0.02,
      y: 0.85,
      xanchor: 'left',
      yanchor: 'top',
      text: `<span style="font-size: 28px; font-weight: 600; color: ${theme.titleColor};">$${lastValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span><br><span style="font-size: 14px; color: ${lineColor};">${changeSign}$${change.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${changeSign}${changePercent}%)</span>`,
      showarrow: false,
      align: 'left',
      bgcolor: theme.panelBg,
      bordercolor: theme.borderColor,
      borderwidth: 1,
      borderpad: 8,
    };
  }

  private buildWeeklyPaymentSummaryAnnotation(
    latestFc: number,
    latestDollar: number,
    changeDollar: number,
    changePercent: number | null,
    trendColor: string
  ) {
    const theme = this.getStockChartTheme();
    const changeSign = changeDollar > 0 ? '+' : '';
    const percentLabel =
      changePercent === null
        ? '—'
        : `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}%`;

    return {
      xref: 'paper',
      yref: 'paper',
      x: 0.02,
      y: 0.85,
      xanchor: 'left',
      yanchor: 'top',
      text:
        `<span style="font-size: 28px; font-weight: 600; color: ${
          theme.titleColor
        };">$${latestDollar.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}</span>` +
        `<br><span style="font-size: 12px; color: ${
          theme.mutedColor
        };">${latestFc.toLocaleString('fr-FR')} FC</span>` +
        `<br><span style="font-size: 14px; color: ${trendColor};">` +
        `${changeSign}$${changeDollar.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} (${percentLabel}) vs semaine précédente</span>`,
      showarrow: false,
      align: 'left',
      bgcolor: theme.panelBg,
      bordercolor: theme.borderColor,
      borderwidth: 1,
      borderpad: 8,
    };
  }

  // ─── modal state ───────────────────────────────────────────────
  showMoneyInHandsModal = false;
  moneyInHandsModalInput: string | number = '0';
  isSavingMoneyInHandsModal = false;
  showBudgetModal = false;
  budgetInput: number | null = null;
  isSavingBudgetedExpense = false;
  showOtherExpenseModal = false;
  otherExpenseAmount: number | null = null;
  otherExpenseReason = '';
  isSavingOtherExpense = false;

  openMoneyInHandsModal() {
    if (!this.auth.isAdmin) return;

    this.moneyInHandsModalInput = this.moneyInHands || '0';
    this.showMoneyInHandsModal = true;
  }

  closeMoneyInHandsModal() {
    if (this.isSavingMoneyInHandsModal) return;

    this.showMoneyInHandsModal = false;
  }

  async saveMoneyInHands(): Promise<void> {
    if (!this.auth.isAdmin || this.isSavingMoneyInHandsModal) return;

    const normalized = this.normalizeMoneyInHandsInput(
      this.moneyInHandsModalInput
    );
    if (normalized === null) {
      alert('Entrez un montant entier valide en FC.');
      return;
    }

    this.isSavingMoneyInHandsModal = true;
    try {
      await this.data.setManagementMoneyInHands(normalized);
      this.managementInfo = {
        ...(this.managementInfo || {}),
        moneyInHands: normalized,
      };
      this.moneyInHands = normalized;
      this.showMoneyInHandsModal = false;
      this.initalizeInputs();
    } catch (error) {
      console.error('Unable to update moneyInHands directly', error);
      alert("Impossible d'enregistrer Argent en main.");
    } finally {
      this.isSavingMoneyInHandsModal = false;
    }
  }

  openBudgetModal() {
    this.budgetInput = null;
    this.budgetReason = '';
    this.showBudgetModal = true;
  }

  closeBudgetModal() {
    if (this.isSavingBudgetedExpense) return;

    this.showBudgetModal = false;
  }

  openOtherExpenseModal() {
    if (!this.auth.isAdmin) return;

    this.otherExpenseAmount = null;
    this.otherExpenseReason = '';
    this.showOtherExpenseModal = true;
  }

  closeOtherExpenseModal() {
    if (this.isSavingOtherExpense) return;

    this.showOtherExpenseModal = false;
  }

  async saveOtherExpense(): Promise<void> {
    if (!this.auth.isAdmin || this.isSavingOtherExpense) return;

    if (this.otherExpenseAmount === null || isNaN(this.otherExpenseAmount)) {
      alert('Montant invalide');
      return;
    }
    if (!this.otherExpenseReason.trim()) {
      alert('Veuillez indiquer la raison');
      return;
    }

    const amount = Math.trunc(Number(this.otherExpenseAmount));
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Entrez un montant positif en FC.');
      return;
    }

    this.isSavingOtherExpense = true;
    try {
      const dateKey = this.time.todaysDate();
      await this.data.addManagementOtherExpense(
        amount.toString(),
        this.otherExpenseReason,
        dateKey
      );
      this.managementInfo = {
        ...(this.managementInfo || {}),
        otherExpenses: {
          ...(this.managementInfo?.otherExpenses || {}),
          [dateKey]: `${amount}:${this.otherExpenseReason.trim()}`,
        },
      };
      this.showOtherExpenseModal = false;
      this.initalizeInputs();
      alert('Autre dépense enregistrée.');
    } catch (error) {
      console.error('Unable to save other expense', error);
      alert("Impossible d'enregistrer cette autre dépense.");
    } finally {
      this.isSavingOtherExpense = false;
    }
  }

  async saveBudgetedExpense(): Promise<void> {
    if (this.isSavingBudgetedExpense) return;

    if (this.budgetInput === null || isNaN(this.budgetInput)) {
      alert('Montant invalide');
      return;
    }
    if (!this.budgetReason.trim()) {
      alert('Veuillez indiquer la raison');
      return;
    }

    const fc = Number(
      this.compute.convertUsDollarsToCongoleseFranc(this.budgetInput.toString())
    );

    this.isSavingBudgetedExpense = true;
    try {
      await this.data.addBudgetPlannedExpense(fc, this.budgetReason);
      this.showBudgetModal = false;
      this.initalizeInputs();
      alert('Dépense planifiée enregistrée.');
    } catch (error) {
      console.error('Unable to save budgeted expense', error);
      alert("Impossible d'enregistrer cette dépense planifiée.");
    } finally {
      this.isSavingBudgetedExpense = false;
    }
  }
  /** Retourne le premier commentaire du jour ou null */
  private getTodaysComment(client: Client) {
    if (!client.comments?.length) return null;

    const [mm, dd, yyyy] = this.requestDateCorrectFormat.split('-'); // ex. 07-21-2025
    const normalised = `${Number(mm)}-${Number(dd)}-${yyyy}`;
    return client.comments.find((c) => c.time?.startsWith(normalised)) || null;
  }

  private hasClientPaidForDate(client: Client): boolean {
    return Object.entries(client.payments || {}).some(([key, value]) => {
      if (!key.startsWith(this.requestDateCorrectFormat)) {
        return false;
      }

      const amount = Number(value ?? 0);
      return Number.isFinite(amount) && amount > 0;
    });
  }

  getClientPaymentTotal(paid?: number, unpaid?: number): number {
    return Number(paid || 0) + Number(unpaid || 0);
  }

  getClientPaymentPercent(count?: number, total?: number): number {
    const numerator = Number(count || 0);
    const denominator = Number(total || 0);

    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      return 0;
    }

    return Math.min(100, Math.max(0, (numerator / denominator) * 100));
  }

  /* ───── click handler for card ───────── */
  onCardClick(i: number, ev: Event) {
    if (i === 2) {
      ev.preventDefault();
      ev.stopPropagation();

      if (this.auth.isAdmin) {
        this.openMoneyInHandsModal();
      }
      return;
    }

    if (i === 4) {
      ev.preventDefault();
      ev.stopPropagation();
      this.openBudgetModal();
      return;
    }

    if (i === 10) {
      ev.preventDefault();
      ev.stopPropagation();
      this.openOtherExpenseModal();
    }
  }

  private normalizeMoneyInHandsInput(value: string | number): string | null {
    const raw = String(value ?? '').trim();
    if (raw === '') return null;

    const amount = Number(raw);
    if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
      return null;
    }

    return amount.toString();
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

  get center(): number {
    return this.size / 2;
  }
  get radius(): number {
    return (this.size - this.strokeWidth) / 2;
  }
  get circumference(): number {
    return 2 * Math.PI * this.radius;
  }

  colorForPerf(v: number): string {
    return this.compute.getGradientColor(Number(v || 0));
  }

  progressDasharray(): string {
    const c = this.circumference;
    const p = Math.max(0, Math.min(100, Number(this.avgPerf || 0))) / 100;
    return `${p * c} ${c}`;
  }
}
