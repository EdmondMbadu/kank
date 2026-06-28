import { Component } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Employee } from 'src/app/models/employee';
import { User, UserDailyField } from 'src/app/models/user';

type RangeKey = '3M' | '6M' | '9M' | '1A' | 'MAX';
type TrackingMonthCentralCard = {
  title: string;
  value: string;
  valueUsd: string;
  imagePath: string;
  subtitle?: string;
  isNegative?: boolean;
};
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-tracking-month-central',
  templateUrl: './tracking-month-central.component.html',
  styleUrls: ['./tracking-month-central.component.css'],
})
export class TrackingMonthCentralComponent {
  constructor(
    public auth: AuthService,
    public time: TimeService,
    private compute: ComputationService
  ) {}
  allUsers: User[] = [];
  ngOnInit(): void {
    if (this.auth.isAdmin) {
      this.auth.getAllUsersInfo().subscribe((data) => {
        this.allUsers = data;
        this.initalizeInputs();
      });
      this.auth.profitabilityConfig$.subscribe((config) => {
        this.profitabilityThresholdUsd = config.thresholdUsd;
        this.updateProfitabilityGraphics(
          this.rangeValueFromKey(this.profitabilityActiveRange)
        );
      });
    }
  }

  currentDate = new Date();
  currentMonth = this.currentDate.getMonth() + 1;
  givenMonth: number = this.currentMonth;
  previousMonth: number = this.givenMonth - 1;
  month = this.compute.getMonthNameFrench(this.currentMonth);
  year = this.currentDate.getFullYear();
  givenYear = this.year;
  previousYear = this.givenYear;
  givenDay: number = this.currentDate.getDate();
  yearsList: number[] = this.time.yearsList;
  monthsList: number[] = [...Array(12).keys()].map((i) => i + 1);
  monthYear = `${this.month} ${this.year}`;
  totalPerfomance: number = 0;
  rankingMode: 'month' | 'year' | 'all' = 'month';
  rankingYear: number = this.year;
  rankingComparisonYear: number = this.year - 1;

  private readonly rangeKeyMap: Record<RangeKey, number> = {
    '3M': 3,
    '6M': 6,
    '9M': 9,
    '1A': 12,
    'MAX': 0,
  };

  reserveActiveRange: RangeKey = '3M';
  paymentActiveRange: RangeKey = '3M';
  entrySortieActiveRange: RangeKey = '3M';
  lendingActiveRange: RangeKey = '3M';
  profitabilityActiveRange: RangeKey = '1A';

  reserveGraph = this.createEmptyGraph('Réserve en $');
  paymentGraph = this.createEmptyGraph('Paiement en $');
  entrySortieGraph: any = this.createEmptyGraph('Entrées / Sorties en $');
  lendingGraph = this.createEmptyGraph('Emprunts en $');
  profitabilityGraph: any = this.createEmptyGraph('Rentabilité en $');

  reserveMaxRange = 0;
  paymentMaxRange = 0;
  entrySortieMaxRange = 0;
  lendingMaxRange = 0;
  profitabilityMaxRange = 0;

  private reserveGraphLabels: string[] = [];
  private reserveGraphSeriesUsd: number[] = [];
  private paymentGraphLabels: string[] = [];
  private paymentGraphSeriesUsd: number[] = [];
  private entrySortieGraphLabels: string[] = [];
  private entrySortieGraphSeriesUsd: number[] = [];
  private lendingGraphLabels: string[] = [];
  private lendingGraphSeriesUsd: number[] = [];
  private profitabilityGraphLabels: string[] = [];
  private profitabilityEntrySortieSeriesUsd: number[] = [];
  private profitabilityDeltaSeriesUsd: number[] = [];

  givenMonthTotalPaymentAmount: string = '';
  givenMonthTotalMobileMoneyAmount: string = '';
  givenMonthTotalPaymentAmountDollars: string = '';
  givenMonthTotalSavingAmount: string = '';
  givenMonthTotalSavingReturnsAmount: string = '';
  givenMonthTotalBenefitAmount: string = '';
  givenMonthTotalLendingAmount: string = '';
  givenMonthTotalExpenseAmount: string = '';
  givenMonthTotalReserveAmount: string = '';
  givenMonthTotalReserveAmountDollars: string = '';
  givenMonthTotalFeesAmount: string = '';
  givenMonthTotalInvestmentAmount: string = '';
  givenMonthBudget: string = '';
  profitabilityThresholdUsd = 3000;
  profitabilityThresholdInput = '';
  profitabilityThresholdSaving = false;
  profitabilityThresholdSaved = false;
  
  // Average Reserve and Payment properties
  averageDailyReserve: number = 0;
  averageDailyPayment: number = 0;
  averageDailyReserveUsd: number = 0;
  averageDailyPaymentUsd: number = 0;
  workingDaysInMonth: number = 0;
  givenMonthTotalLoss: string = '';
  previousMonthTotalReserve: string = '';
  monthlyCards: TrackingMonthCentralCard[] = [];
  sortedReserveMonth: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
    averageReserve: number;
    averageReserveUsd: number;
  }[] = [];
  sortedPaymentMonth: {
    firstName: string;
    totalPayment: number;
    totalPaymentInDollars: string;
    averagePayment: number;
    averagePaymentUsd: number;
  }[] = [];
  sortedLendingMonth: {
    firstName: string;
    totalLending: number;
    totalLendingInDollars: string;
    averageLending: number;
    averageLendingUsd: number;
  }[] = [];
  sortedEntrySortieMonth: {
    firstName: string;
    totalEntrySortie: number;
    totalEntrySortieInDollars: string;
    averageEntrySortie: number;
    averageEntrySortieUsd: number;
    growthRate: string;
  }[] = [];
  sortedReservePreviousMonth: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] = [];
  sortedGrowthRateMonth: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
    growthRate: string;
  }[] = [];
  today = this.time.todaysDateMonthDayYear();
  reserveGrowthRateTotal: string = '';
  paymentGrowthRateTotal: string = '';
  reserveCurrentMonth!: number;
  reserveCurrentYear!: number;
  reserveComparisonMonth!: number;
  reserveComparisonYear!: number;
  paymentCurrentMonth!: number;
  paymentCurrentYear!: number;
  paymentComparisonMonth!: number;
  paymentComparisonYear!: number;
  lendingCurrentMonth!: number;
  lendingCurrentYear!: number;
  lendingComparisonMonth!: number;
  lendingComparisonYear!: number;
  reserveCurrentTotalAmount: string = '0';
  reserveCurrentTotalAmountDollars: string = '0';
  entrySortieCurrentTotalAmount: string = '0';
  entrySortieCurrentTotalAmountDollars: string = '0';
  entrySortieCurrentAverageAmount = 0;
  entrySortieCurrentAverageAmountDollars = 0;
  entrySortieGrowthRateTotal = '0';
  paymentCurrentTotalAmount: string = '0';
  paymentCurrentTotalAmountDollars: string = '0';
  lendingCurrentTotalAmount: string = '0';
  lendingCurrentTotalAmountDollars: string = '0';
  lendingGrowthRateTotal: string = '0';
  lendingCurrentAverageAmount = 0;
  lendingCurrentAverageAmountDollars = 0;
  copyPaymentsMessage: string | null = null;
  isCopyingPayments = false;

  sortedPaymentPreviousMonth: {
    firstName: string;
    totalPayment: number;
    totalPaymentInDollars: string;
  }[] = [];
  sortedLendingPreviousMonth: {
    firstName: string;
    totalLending: number;
    totalLendingInDollars: string;
  }[] = [];

  sortedGrowthRatePaymentMonth: {
    firstName: string;
    totalPayment: number;
    totalPaymentInDollars: string;
    growthRate: string;
  }[] = [];
  sortedGrowthRateLendingMonth: {
    firstName: string;
    totalLending: number;
    totalLendingInDollars: string;
    growthRate: string;
  }[] = [];

  // Mini graph cache for table sparklines
  miniReserveGraphs: Map<string, { data: any[]; layout: any; config?: any }> = new Map();
  miniPaymentGraphs: Map<string, { data: any[]; layout: any; config?: any }> = new Map();

  // Selected location for filtering graphs
  selectedReserveLocation: string | null = null;
  selectedPaymentLocation: string | null = null;
  selectedEntrySortieLocation: string | null = null;
  selectedLendingLocation: string | null = null;

  setPreviousMonth() {
    if (this.givenMonth === 1) {
      // January
      this.previousMonth = 12; // Set to December
      this.previousYear = this.givenYear - 1; // Set to the previous year
    } else {
      this.previousMonth = this.givenMonth - 1;
      this.previousYear = this.givenYear;
    }
  }
  initalizeInputs() {
    this.setPreviousMonth();
    this.givenMonthTotalPaymentAmount =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'dailyReimbursement',
        this.givenMonth,
        this.givenYear
      );
    this.givenMonthTotalMobileMoneyAmount =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'dailyMobileMoneyPayment',
        this.givenMonth,
        this.givenYear
      );
    this.givenMonthBudget = this.allUsers
      .reduce((acc, user) => Number(acc) + Number(user.monthBudget), 0)
      .toString();

    this.givenMonthTotalBenefitAmount = Math.ceil(
      Number(this.givenMonthTotalPaymentAmount) * 0.285
    ).toString();

    this.givenMonthTotalLendingAmount =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'dailyLending',
        this.givenMonth,
        this.givenYear
      );
    this.givenMonthTotalExpenseAmount =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'expenses',
        this.givenMonth,
        this.givenYear
      );

    this.givenMonthTotalReserveAmount =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'reserve',
        this.givenMonth,
        this.givenYear
      );
    this.givenMonthTotalInvestmentAmount =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'investments',
        this.givenMonth,
        this.givenYear
      );
    this.givenMonthTotalFeesAmount =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'feesData',
        this.givenMonth,
        this.givenYear
      );
    this.givenMonthTotalSavingAmount =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'dailySaving',
        this.givenMonth,
        this.givenYear
      );
    this.givenMonthTotalSavingReturnsAmount =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'dailySavingReturns',
        this.givenMonth,
        this.givenYear
      );

    this.givenMonthTotalLoss = this.compute.findTotalGivenMonthForAllUsers(
      this.allUsers,
      'losses',
      this.givenMonth,
      this.givenYear
    );

    this.givenMonthTotalReserveAmountDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.givenMonthTotalReserveAmount)
      .toString();
    this.givenMonthTotalPaymentAmountDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.givenMonthTotalPaymentAmount)
      .toString();

    const entryExitAmount = (
      Number(this.givenMonthTotalReserveAmount) -
      Number(this.givenMonthTotalInvestmentAmount)
    ).toString();

    this.monthlyCards = [
      {
        title: 'Paiment Du Mois ',
        value: this.givenMonthTotalPaymentAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalPaymentAmount
        )}`,
        imagePath: '../../../assets/img/audit.png',
      },
      {
        title: 'Paiement Mobile Money Du Mois',
        value: this.givenMonthTotalMobileMoneyAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalMobileMoneyAmount
        )}`,
        imagePath: '../../../assets/img/daily-reimbursement.png',
      },
      {
        title: 'Emprunts Du Mois',
        value: this.givenMonthTotalLendingAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalLendingAmount
        )}`,
        imagePath: '../../../assets/img/lending-date.png',
      },
      {
        title: 'Benefice Du Mois ',
        value: this.givenMonthTotalBenefitAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalBenefitAmount
        )}`,
        imagePath: '../../../assets/img/benefit.svg',
      },
      {
        title: 'Depense Du Mois',
        value: this.givenMonthTotalExpenseAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalExpenseAmount
        )}`,
        imagePath: '../../../assets/img/expense.svg',
      },
      {
        title: 'Reserve Du Mois',
        value: this.givenMonthTotalReserveAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalReserveAmount
        )}`,
        imagePath: '../../../assets/img/reserve.svg',
      },
      {
        title: 'Frais De Membre Du Mois',
        value: this.givenMonthTotalFeesAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalFeesAmount
        )}`,
        imagePath: '../../../assets/img/member.svg',
      },
      {
        title: 'Investissement Du Mois',
        value: this.givenMonthTotalInvestmentAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalInvestmentAmount
        )}`,
        imagePath: '../../../assets/img/invest.svg',
      },
      {
        title: 'Epargne Du Mois',
        value: this.givenMonthTotalSavingAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalSavingAmount
        )}`,
        imagePath: '../../../assets/img/saving.svg',
      },
      {
        title: 'Retrait Epargne Du Mois',
        value: this.givenMonthTotalSavingReturnsAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalSavingReturnsAmount
        )}`,
        imagePath: '../../../assets/img/saving.svg',
      },
      {
        title: 'Perte Du Mois',
        value: this.givenMonthTotalLoss,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthTotalLoss
        )}`,
        imagePath: '../../../assets/img/loss.png',
      },
      {
        title: 'Budget Emprunts Du Mois',
        value: this.givenMonthBudget,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          this.givenMonthBudget
        )}`,
        imagePath: '../../../assets/img/budget.png',
      },
      {
        title: 'Entrées / Sorties',
        subtitle: 'Reserve Du Mois - Investissement Du Mois',
        value: entryExitAmount,
        valueUsd: `${this.compute.convertCongoleseFrancToUsDollars(
          entryExitAmount
        )}`,
        imagePath: '../../../assets/img/reserve.svg',
        isNegative: Number(entryExitAmount) < 0,
      },
    ];

    this.reserveCurrentMonth = this.givenMonth;
    this.reserveCurrentYear = this.givenYear;
    this.reserveComparisonMonth = this.previousMonth;
    this.reserveComparisonYear = this.previousYear;
    this.paymentCurrentMonth = this.givenMonth;
    this.paymentCurrentYear = this.givenYear;
    this.paymentComparisonMonth = this.previousMonth;
    this.paymentComparisonYear = this.previousYear;
    this.lendingCurrentMonth = this.givenMonth;
    this.lendingCurrentYear = this.givenYear;
    this.lendingComparisonMonth = this.previousMonth;
    this.lendingComparisonYear = this.previousYear;

    this.updateReserveTableData();
    this.updatePaymentTableData();
    this.updateLendingTableData();

    this.updateReserveGraphics(this.rangeValueFromKey(this.reserveActiveRange));
    this.updatePaymentGraphics(this.rangeValueFromKey(this.paymentActiveRange));
    this.updateEntrySortieGraphics(this.rangeValueFromKey(this.entrySortieActiveRange));
    this.updateLendingGraphics(this.rangeValueFromKey(this.lendingActiveRange));
    this.updateProfitabilityGraphics(
      this.rangeValueFromKey(this.profitabilityActiveRange)
    );
    
    // Calculate average daily Reserve and Payment
    this.calculateAverageReserveAndPayment();
    
    // Update mini graphs for tables
    this.updateMiniGraphs();
  }

  onRankingModeChange(mode: 'month' | 'year' | 'all'): void {
    this.rankingMode = mode;
    this.rankingYear = this.givenYear;
    this.rankingComparisonYear = this.rankingYear - 1;
    this.updateReserveTableData();
    this.updatePaymentTableData();
    this.updateLendingTableData();
  }

  onRankingYearChange(year: number): void {
    this.rankingYear = year;
    this.rankingComparisonYear = Math.max(
      this.yearsList[0],
      (this.rankingYear || this.year) - 1
    );
    this.updateReserveTableData();
    this.updatePaymentTableData();
    this.updateLendingTableData();
  }

  onRankingComparisonYearChange(year: number): void {
    this.rankingComparisonYear = year;
    this.updateReserveTableData();
    this.updatePaymentTableData();
    this.updateLendingTableData();
  }

  updateReserveTableData(): void {
    if (!this.allUsers || this.allUsers.length === 0) {
      this.sortedReserveMonth = [];
      this.sortedReservePreviousMonth = [];
      this.sortedGrowthRateMonth = [];
      this.sortedEntrySortieMonth = [];
      this.reserveCurrentTotalAmount = '0';
      this.reserveCurrentTotalAmountDollars = '0';
      this.entrySortieCurrentTotalAmount = '0';
      this.entrySortieCurrentTotalAmountDollars = '0';
      this.entrySortieCurrentAverageAmount = 0;
      this.entrySortieCurrentAverageAmountDollars = 0;
      this.entrySortieGrowthRateTotal = '0';
      this.reserveGrowthRateTotal = '0';
      this.updateMiniGraphs();
      return;
    }

    const isYearMode = this.rankingMode === 'year';
    const isAllMode = this.rankingMode === 'all';
    const reserveMonthRaw = isAllMode
      ? this.compute.findTotalAllTimeForAllUsersSortedDescending(
          this.allUsers,
          'reserve'
        )
      : isYearMode
      ? this.compute.findTotalGivenYearForAllUsersSortedDescending(
          this.allUsers,
          'reserve',
          this.rankingYear
        )
      : this.compute.findTotalGivenMonthForAllUsersSortedDescending(
          this.allUsers,
          'reserve',
          this.reserveCurrentMonth,
          this.reserveCurrentYear
        );

    this.sortedReservePreviousMonth = isAllMode
      ? this.compute.findTotalGivenYearForAllUsersSortedDescending(
          this.allUsers,
          'reserve',
          this.rankingComparisonYear
        )
      : isYearMode
      ? this.compute.findTotalGivenYearForAllUsersSortedDescending(
          this.allUsers,
          'reserve',
          this.rankingComparisonYear
        )
      : this.compute.findTotalGivenMonthForAllUsersSortedDescending(
          this.allUsers,
          'reserve',
          this.reserveComparisonMonth,
          this.reserveComparisonYear
        );

    // Calculate working days for average calculation
    const currentDate = new Date();
    const workingDays = isAllMode
      ? this.calculateWorkingDaysAllTime()
      : isYearMode
      ? this.calculateWorkingDaysForYear(
          this.rankingYear,
          this.isCurrentYear(this.rankingYear)
        )
      : this.calculateWorkingDays(
          this.reserveCurrentMonth,
          this.reserveCurrentYear,
          this.reserveCurrentMonth === currentDate.getMonth() + 1 &&
            this.reserveCurrentYear === currentDate.getFullYear()
        );

    // Add averages to sortedReserveMonth
    this.sortedReserveMonth = reserveMonthRaw.map((x: any) => {
      const totalReserve = x.totalReserve;
      // Calculate average for this location
      const averageReserve = workingDays > 0 ? totalReserve / workingDays : 0;
      const averageReserveUsdStr = this.compute.convertCongoleseFrancToUsDollars(
        String(averageReserve)
      );
      const averageReserveUsd = averageReserveUsdStr === '' ? 0 : Number(averageReserveUsdStr);

      return {
        firstName: x.firstName,
        totalReserve: totalReserve,
        totalReserveInDollars: x.totalReserveInDollars,
        averageReserve,
        averageReserveUsd,
      };
    });

    this.sortedGrowthRateMonth = this.sortedReserveMonth.map((current) => {
      const previous = this.sortedReservePreviousMonth.find(
        (prev) => prev.firstName === current.firstName
      );

      const prevVal = previous ? this.toNum(previous.totalReserve) : 0;
      const currVal = this.toNum(current.totalReserve);
      const growth =
        prevVal > 0
          ? ((currVal - prevVal) / prevVal) * 100
          : currVal > 0
          ? 100
          : 0;

      return {
        ...current,
        growthRate: growth.toString(),
      };
    });

    const reserveCurrentTotal = isAllMode
      ? this.compute.findTotalAllTimeForAllUsers(
          this.allUsers,
          'reserve'
        ) ?? 0
      : isYearMode
      ? this.compute.findTotalGivenYearForAllUsers(
          this.allUsers,
          'reserve',
          this.rankingYear
        ) ?? 0
      : this.compute.findTotalGivenMonthForAllUsers(
          this.allUsers,
          'reserve',
          this.reserveCurrentMonth,
          this.reserveCurrentYear
        ) ?? 0;
    const reserveComparisonTotal = isAllMode
      ? this.compute.findTotalGivenYearForAllUsers(
          this.allUsers,
          'reserve',
          this.rankingComparisonYear
        ) ?? 0
      : isYearMode
      ? this.compute.findTotalGivenYearForAllUsers(
          this.allUsers,
          'reserve',
          this.rankingComparisonYear
        ) ?? 0
      : this.compute.findTotalGivenMonthForAllUsers(
          this.allUsers,
          'reserve',
          this.reserveComparisonMonth,
          this.reserveComparisonYear
        ) ?? 0;

    this.reserveCurrentTotalAmount = `${reserveCurrentTotal}`;
    this.reserveCurrentTotalAmountDollars = `${this.compute.convertCongoleseFrancToUsDollars(
      this.reserveCurrentTotalAmount
    )}`;

    const prevTotalNum = this.toNum(reserveComparisonTotal);
    const currTotalNum = this.toNum(reserveCurrentTotal);
    this.reserveGrowthRateTotal =
      prevTotalNum > 0
        ? (((currTotalNum - prevTotalNum) / prevTotalNum) * 100).toString()
        : currTotalNum > 0
        ? '100'
        : '0';

    this.updateEntrySortieTableData(isYearMode, isAllMode);

    // Update mini graphs after table data is updated
    this.updateMiniGraphs();
  }

  updatePaymentTableData(): void {
    if (!this.allUsers || this.allUsers.length === 0) {
      this.sortedPaymentMonth = [];
      this.sortedPaymentPreviousMonth = [];
      this.sortedGrowthRatePaymentMonth = [];
      this.paymentCurrentTotalAmount = '0';
      this.paymentCurrentTotalAmountDollars = '0';
      this.paymentGrowthRateTotal = '0';
      this.updateMiniGraphs();
      return;
    }

    const isYearMode = this.rankingMode === 'year';
    const isAllMode = this.rankingMode === 'all';
    const paymentCurrentRaw = isAllMode
      ? this.compute.findTotalAllTimeForAllUsersSortedDescending(
          this.allUsers,
          'dailyReimbursement'
        )
      : isYearMode
      ? this.compute.findTotalGivenYearForAllUsersSortedDescending(
          this.allUsers,
          'dailyReimbursement',
          this.rankingYear
        )
      : this.compute.findTotalGivenMonthForAllUsersSortedDescending(
          this.allUsers,
          'dailyReimbursement',
          this.paymentCurrentMonth,
          this.paymentCurrentYear
        );

    const paymentPrevRaw = isAllMode
      ? this.compute.findTotalGivenYearForAllUsersSortedDescending(
          this.allUsers,
          'dailyReimbursement',
          this.rankingComparisonYear
        )
      : isYearMode
      ? this.compute.findTotalGivenYearForAllUsersSortedDescending(
          this.allUsers,
          'dailyReimbursement',
          this.rankingComparisonYear
        )
      : this.compute.findTotalGivenMonthForAllUsersSortedDescending(
          this.allUsers,
          'dailyReimbursement',
          this.paymentComparisonMonth,
          this.paymentComparisonYear
        );

    // Calculate working days for average calculation
    const currentDate = new Date();
    const paymentWorkingDays = isAllMode
      ? this.calculateWorkingDaysAllTime()
      : isYearMode
      ? this.calculateWorkingDaysForYear(
          this.rankingYear,
          this.isCurrentYear(this.rankingYear)
        )
      : this.calculateWorkingDays(
          this.paymentCurrentMonth,
          this.paymentCurrentYear,
          this.paymentCurrentMonth === currentDate.getMonth() + 1 &&
            this.paymentCurrentYear === currentDate.getFullYear()
        );

    this.sortedPaymentMonth = paymentCurrentRaw.map((x: any) => {
      const totalPayment = x.totalReserve;
      // Calculate average for this location
      const averagePayment = paymentWorkingDays > 0 ? totalPayment / paymentWorkingDays : 0;
      const averagePaymentUsdStr = this.compute.convertCongoleseFrancToUsDollars(
        String(averagePayment)
      );
      const averagePaymentUsd = averagePaymentUsdStr === '' ? 0 : Number(averagePaymentUsdStr);

      return {
        firstName: x.firstName,
        totalPayment: totalPayment,
        totalPaymentInDollars: x.totalReserveInDollars,
        averagePayment,
        averagePaymentUsd,
      };
    });

    this.sortedPaymentPreviousMonth = paymentPrevRaw.map((x: any) => ({
      firstName: x.firstName,
      totalPayment: x.totalReserve,
      totalPaymentInDollars: x.totalReserveInDollars,
    }));

    this.sortedGrowthRatePaymentMonth = this.sortedPaymentMonth.map((curr) => {
      const prev = this.sortedPaymentPreviousMonth.find(
        (p) => p.firstName === curr.firstName
      );
      const prevVal = prev ? this.toNum(prev.totalPayment) : 0;
      const currVal = this.toNum(curr.totalPayment);

      const growth =
        prevVal > 0
          ? ((currVal - prevVal) / prevVal) * 100
          : currVal > 0
          ? 100
          : 0;

      return {
        ...curr,
        growthRate: growth.toString(),
      };
    });

    const paymentCurrentTotal = isAllMode
      ? this.compute.findTotalAllTimeForAllUsers(
          this.allUsers,
          'dailyReimbursement'
        ) ?? 0
      : isYearMode
      ? this.compute.findTotalGivenYearForAllUsers(
          this.allUsers,
          'dailyReimbursement',
          this.rankingYear
        ) ?? 0
      : this.compute.findTotalGivenMonthForAllUsers(
          this.allUsers,
          'dailyReimbursement',
          this.paymentCurrentMonth,
          this.paymentCurrentYear
        ) ?? 0;
    const paymentComparisonTotal = isAllMode
      ? this.compute.findTotalGivenYearForAllUsers(
          this.allUsers,
          'dailyReimbursement',
          this.rankingComparisonYear
        ) ?? 0
      : isYearMode
      ? this.compute.findTotalGivenYearForAllUsers(
          this.allUsers,
          'dailyReimbursement',
          this.rankingComparisonYear
        ) ?? 0
      : this.compute.findTotalGivenMonthForAllUsers(
          this.allUsers,
          'dailyReimbursement',
          this.paymentComparisonMonth,
          this.paymentComparisonYear
        ) ?? 0;

    this.paymentCurrentTotalAmount = `${paymentCurrentTotal}`;
    this.paymentCurrentTotalAmountDollars = `${this.compute.convertCongoleseFrancToUsDollars(
      this.paymentCurrentTotalAmount
    )}`;

    const prevTotal = this.toNum(paymentComparisonTotal);
    const currTotal = this.toNum(paymentCurrentTotal);
    this.paymentGrowthRateTotal =
      prevTotal > 0
        ? (((currTotal - prevTotal) / prevTotal) * 100).toString()
        : currTotal > 0
        ? '100'
        : '0';
    
    // Update mini graphs after table data is updated
    this.updateMiniGraphs();
  }

  updateLendingTableData(): void {
    if (!this.allUsers || this.allUsers.length === 0) {
      this.sortedLendingMonth = [];
      this.sortedLendingPreviousMonth = [];
      this.sortedGrowthRateLendingMonth = [];
      this.lendingCurrentTotalAmount = '0';
      this.lendingCurrentTotalAmountDollars = '0';
      this.lendingGrowthRateTotal = '0';
      this.lendingCurrentAverageAmount = 0;
      this.lendingCurrentAverageAmountDollars = 0;
      return;
    }

    const isYearMode = this.rankingMode === 'year';
    const isAllMode = this.rankingMode === 'all';
    const lendingCurrentRaw = isAllMode
      ? this.compute.findTotalAllTimeForAllUsersSortedDescending(
          this.allUsers,
          'dailyLending'
        )
      : isYearMode
      ? this.compute.findTotalGivenYearForAllUsersSortedDescending(
          this.allUsers,
          'dailyLending',
          this.rankingYear
        )
      : this.compute.findTotalGivenMonthForAllUsersSortedDescending(
          this.allUsers,
          'dailyLending',
          this.lendingCurrentMonth,
          this.lendingCurrentYear
        );

    const lendingPreviousRaw = isAllMode
      ? this.compute.findTotalGivenYearForAllUsersSortedDescending(
          this.allUsers,
          'dailyLending',
          this.rankingComparisonYear
        )
      : isYearMode
      ? this.compute.findTotalGivenYearForAllUsersSortedDescending(
          this.allUsers,
          'dailyLending',
          this.rankingComparisonYear
        )
      : this.compute.findTotalGivenMonthForAllUsersSortedDescending(
          this.allUsers,
          'dailyLending',
          this.lendingComparisonMonth,
          this.lendingComparisonYear
        );

    const currentDate = new Date();
    const workingDays = isAllMode
      ? this.calculateWorkingDaysAllTime()
      : isYearMode
      ? this.calculateWorkingDaysForYear(
          this.rankingYear,
          this.isCurrentYear(this.rankingYear)
        )
      : this.calculateWorkingDays(
          this.lendingCurrentMonth,
          this.lendingCurrentYear,
          this.lendingCurrentMonth === currentDate.getMonth() + 1 &&
            this.lendingCurrentYear === currentDate.getFullYear()
        );

    this.sortedLendingMonth = lendingCurrentRaw.map((x: any) => {
      const totalLending = x.totalReserve;
      const averageLending = workingDays > 0 ? totalLending / workingDays : 0;
      const averageLendingUsdStr =
        this.compute.convertCongoleseFrancToUsDollars(
          String(averageLending)
        );
      const averageLendingUsd =
        averageLendingUsdStr === '' ? 0 : Number(averageLendingUsdStr);

      return {
        firstName: x.firstName,
        totalLending,
        totalLendingInDollars: x.totalReserveInDollars,
        averageLending,
        averageLendingUsd,
      };
    });

    this.sortedLendingPreviousMonth = lendingPreviousRaw.map((x: any) => ({
      firstName: x.firstName,
      totalLending: x.totalReserve,
      totalLendingInDollars: x.totalReserveInDollars,
    }));

    this.sortedGrowthRateLendingMonth = this.sortedLendingMonth.map((curr) => {
      const prev = this.sortedLendingPreviousMonth.find(
        (p) => p.firstName === curr.firstName
      );
      const prevVal = prev ? this.toNum(prev.totalLending) : 0;
      const currVal = this.toNum(curr.totalLending);
      const growth =
        prevVal > 0
          ? ((currVal - prevVal) / prevVal) * 100
          : currVal > 0
          ? 100
          : 0;

      return {
        ...curr,
        growthRate: growth.toString(),
      };
    });

    const lendingCurrentTotal = isAllMode
      ? this.compute.findTotalAllTimeForAllUsers(
          this.allUsers,
          'dailyLending'
        ) ?? 0
      : isYearMode
      ? this.compute.findTotalGivenYearForAllUsers(
          this.allUsers,
          'dailyLending',
          this.rankingYear
        ) ?? 0
      : this.compute.findTotalGivenMonthForAllUsers(
          this.allUsers,
          'dailyLending',
          this.lendingCurrentMonth,
          this.lendingCurrentYear
        ) ?? 0;

    const lendingComparisonTotal = isAllMode
      ? this.compute.findTotalGivenYearForAllUsers(
          this.allUsers,
          'dailyLending',
          this.rankingComparisonYear
        ) ?? 0
      : isYearMode
      ? this.compute.findTotalGivenYearForAllUsers(
          this.allUsers,
          'dailyLending',
          this.rankingComparisonYear
        ) ?? 0
      : this.compute.findTotalGivenMonthForAllUsers(
          this.allUsers,
          'dailyLending',
          this.lendingComparisonMonth,
          this.lendingComparisonYear
        ) ?? 0;

    this.lendingCurrentTotalAmount = `${lendingCurrentTotal}`;
    this.lendingCurrentTotalAmountDollars = `${this.compute.convertCongoleseFrancToUsDollars(
      this.lendingCurrentTotalAmount
    )}`;

    const totalAverage =
      workingDays > 0 ? this.toNum(lendingCurrentTotal) / workingDays : 0;
    const totalAverageUsd =
      this.compute.convertCongoleseFrancToUsDollars(String(totalAverage));
    this.lendingCurrentAverageAmount = totalAverage;
    this.lendingCurrentAverageAmountDollars =
      totalAverageUsd === '' ? 0 : Number(totalAverageUsd);

    const prevTotal = this.toNum(lendingComparisonTotal);
    const currTotal = this.toNum(lendingCurrentTotal);
    this.lendingGrowthRateTotal =
      prevTotal > 0
        ? (((currTotal - prevTotal) / prevTotal) * 100).toString()
        : currTotal > 0
        ? '100'
        : '0';
  }

  private updateEntrySortieTableData(
    isYearMode: boolean = this.rankingMode === 'year',
    isAllMode: boolean = this.rankingMode === 'all'
  ): void {
    const currentDate = new Date();
    const workingDays = isAllMode
      ? this.calculateWorkingDaysAllTime()
      : isYearMode
      ? this.calculateWorkingDaysForYear(
          this.rankingYear,
          this.isCurrentYear(this.rankingYear)
        )
      : this.calculateWorkingDays(
          this.reserveCurrentMonth,
          this.reserveCurrentYear,
          this.reserveCurrentMonth === currentDate.getMonth() + 1 &&
            this.reserveCurrentYear === currentDate.getFullYear()
        );

    const previousRows = this.allUsers.map((user) => {
      const reserveTotal = this.sumUserFieldForEntrySortiePeriod(
        user,
        'reserve',
        false,
        isYearMode,
        isAllMode
      );
      const investmentTotal = this.sumUserFieldForEntrySortiePeriod(
        user,
        'investments',
        false,
        isYearMode,
        isAllMode
      );

      return {
        firstName: user.firstName || '',
        totalEntrySortie: reserveTotal - investmentTotal,
      };
    });

    const rows = this.allUsers
      .map((user) => {
        const reserveTotal = this.sumUserFieldForEntrySortiePeriod(
          user,
          'reserve',
          true,
          isYearMode,
          isAllMode
        );
        const investmentTotal = this.sumUserFieldForEntrySortiePeriod(
          user,
          'investments',
          true,
          isYearMode,
          isAllMode
        );
        const totalEntrySortie = reserveTotal - investmentTotal;
        const averageEntrySortie =
          workingDays > 0 ? totalEntrySortie / workingDays : 0;
        const averageEntrySortieUsdStr =
          this.compute.convertCongoleseFrancToUsDollars(
            averageEntrySortie.toString()
          );
        const previous = previousRows.find(
          (row) => row.firstName === user.firstName
        );
        const growthRate = this.calculateEntrySortieGrowthRate(
          totalEntrySortie,
          previous?.totalEntrySortie ?? 0
        );

        return {
          firstName: user.firstName || '',
          totalEntrySortie,
          totalEntrySortieInDollars: `${this.compute.convertCongoleseFrancToUsDollars(
            totalEntrySortie.toString()
          ) || '0'}`,
          averageEntrySortie,
          averageEntrySortieUsd:
            averageEntrySortieUsdStr === ''
              ? 0
              : Number(averageEntrySortieUsdStr),
          growthRate: growthRate.toString(),
        };
      })
      .filter((row) => row.firstName && row.totalEntrySortie !== 0)
      .sort((a, b) => b.totalEntrySortie - a.totalEntrySortie);

    this.sortedEntrySortieMonth = rows;

    const reserveCurrentTotal = this.toNum(this.reserveCurrentTotalAmount);
    const investmentCurrentTotal = isAllMode
      ? this.toNum(
          this.compute.findTotalAllTimeForAllUsers(this.allUsers, 'investments')
        )
      : isYearMode
      ? this.toNum(
          this.compute.findTotalGivenYearForAllUsers(
            this.allUsers,
            'investments',
            this.rankingYear
          )
        )
      : this.toNum(
          this.compute.findTotalGivenMonthForAllUsers(
            this.allUsers,
            'investments',
            this.reserveCurrentMonth,
            this.reserveCurrentYear
          )
        );

    const currentTotal = reserveCurrentTotal - investmentCurrentTotal;
    this.entrySortieCurrentTotalAmount = `${currentTotal}`;
    this.entrySortieCurrentTotalAmountDollars = `${this.compute.convertCongoleseFrancToUsDollars(
      this.entrySortieCurrentTotalAmount
    ) || '0'}`;

    const reserveComparisonTotal = isAllMode
      ? this.toNum(
          this.compute.findTotalGivenYearForAllUsers(
            this.allUsers,
            'reserve',
            this.rankingComparisonYear
          )
        )
      : isYearMode
      ? this.toNum(
          this.compute.findTotalGivenYearForAllUsers(
            this.allUsers,
            'reserve',
            this.rankingComparisonYear
          )
        )
      : this.toNum(
          this.compute.findTotalGivenMonthForAllUsers(
            this.allUsers,
            'reserve',
            this.reserveComparisonMonth,
            this.reserveComparisonYear
          )
        );
    const investmentComparisonTotal = isAllMode
      ? this.toNum(
          this.compute.findTotalGivenYearForAllUsers(
            this.allUsers,
            'investments',
            this.rankingComparisonYear
          )
        )
      : isYearMode
      ? this.toNum(
          this.compute.findTotalGivenYearForAllUsers(
            this.allUsers,
            'investments',
            this.rankingComparisonYear
          )
        )
      : this.toNum(
          this.compute.findTotalGivenMonthForAllUsers(
            this.allUsers,
            'investments',
            this.reserveComparisonMonth,
            this.reserveComparisonYear
          )
        );

    const comparisonTotal = reserveComparisonTotal - investmentComparisonTotal;
    const totalAverage = workingDays > 0 ? currentTotal / workingDays : 0;
    const totalAverageUsd =
      this.compute.convertCongoleseFrancToUsDollars(totalAverage.toString());
    this.entrySortieCurrentAverageAmount = totalAverage;
    this.entrySortieCurrentAverageAmountDollars =
      totalAverageUsd === '' ? 0 : Number(totalAverageUsd);
    this.entrySortieGrowthRateTotal = this.calculateEntrySortieGrowthRate(
      currentTotal,
      comparisonTotal
    ).toString();
  }

  private sumUserFieldForEntrySortiePeriod(
    user: User,
    field: 'reserve' | 'investments',
    isCurrentPeriod: boolean,
    isYearMode: boolean,
    isAllMode: boolean
  ): number {
    const values = user[field] || {};

    return Object.entries(values).reduce((sum, [date, amount]) => {
      const [month, , year] = date.split('-').map(Number);
      const numericAmount = parseInt(String(amount).split(':')[0], 10) || 0;

      if (this.rankingMode === 'all') {
        return isCurrentPeriod || year === this.rankingComparisonYear
          ? sum + numericAmount
          : sum;
      }

      if (isYearMode) {
        const targetYear = isCurrentPeriod
          ? this.rankingYear
          : this.rankingComparisonYear;
        return year === targetYear ? sum + numericAmount : sum;
      }

      const targetMonth = isCurrentPeriod
        ? this.reserveCurrentMonth
        : this.reserveComparisonMonth;
      const targetYear = isCurrentPeriod
        ? this.reserveCurrentYear
        : this.reserveComparisonYear;

      return month === targetMonth && year === targetYear
        ? sum + numericAmount
        : sum;
    }, 0);
  }

  private calculateEntrySortieGrowthRate(current: number, previous: number): number {
    const currVal = this.toNum(current);
    const prevVal = this.toNum(previous);

    if (prevVal !== 0) {
      return ((currVal - prevVal) / Math.abs(prevVal)) * 100;
    }

    if (currVal > 0) {
      return 100;
    }

    if (currVal < 0) {
      return -100;
    }

    return 0;
  }

  setReserveRange(key: RangeKey): void {
    this.reserveActiveRange = key;
    this.updateReserveGraphics(this.rangeValueFromKey(key));
  }

  setPaymentRange(key: RangeKey): void {
    this.paymentActiveRange = key;
    this.updatePaymentGraphics(this.rangeValueFromKey(key));
  }

  setEntrySortieRange(key: RangeKey): void {
    this.entrySortieActiveRange = key;
    this.updateEntrySortieGraphics(this.rangeValueFromKey(key));
  }

  setLendingRange(key: RangeKey): void {
    this.lendingActiveRange = key;
    this.updateLendingGraphics(this.rangeValueFromKey(key));
  }

  setProfitabilityRange(key: RangeKey): void {
    this.profitabilityActiveRange = key;
    this.updateProfitabilityGraphics(this.rangeValueFromKey(key));
  }

  onReserveLocationClick(locationName: string): void {
    // If empty string, reset to all locations
    if (locationName === '') {
      this.selectedReserveLocation = null;
    } else {
      // Toggle selection: if clicking the same location, deselect it (show all)
      if (this.selectedReserveLocation === locationName) {
        this.selectedReserveLocation = null;
      } else {
        this.selectedReserveLocation = locationName;
      }
    }
    this.updateReserveGraphics(this.rangeValueFromKey(this.reserveActiveRange));
  }

  onPaymentLocationClick(locationName: string): void {
    // If empty string, reset to all locations
    if (locationName === '') {
      this.selectedPaymentLocation = null;
    } else {
      // Toggle selection: if clicking the same location, deselect it (show all)
      if (this.selectedPaymentLocation === locationName) {
        this.selectedPaymentLocation = null;
      } else {
        this.selectedPaymentLocation = locationName;
      }
    }
    this.updatePaymentGraphics(this.rangeValueFromKey(this.paymentActiveRange));
  }

  onEntrySortieLocationClick(locationName: string): void {
    if (locationName === '') {
      this.selectedEntrySortieLocation = null;
    } else if (this.selectedEntrySortieLocation === locationName) {
      this.selectedEntrySortieLocation = null;
    } else {
      this.selectedEntrySortieLocation = locationName;
    }

    this.updateEntrySortieGraphics(
      this.rangeValueFromKey(this.entrySortieActiveRange)
    );
  }

  onLendingLocationClick(locationName: string): void {
    if (locationName === '') {
      this.selectedLendingLocation = null;
    } else if (this.selectedLendingLocation === locationName) {
      this.selectedLendingLocation = null;
    } else {
      this.selectedLendingLocation = locationName;
    }

    this.updateLendingGraphics(this.rangeValueFromKey(this.lendingActiveRange));
  }

  async copyPaymentRanking(): Promise<void> {
    if (this.isCopyingPayments || !this.sortedPaymentMonth.length) {
      return;
    }

    this.isCopyingPayments = true;
    this.copyPaymentsMessage = null;

    try {
      const winner = this.sortedPaymentMonth[0];
      const winnerLines = await this.buildWinnerMembersLines(winner?.firstName);
      const dateLabel = this.buildPaymentCopyDateLabel();

      const lines: string[] = [dateLabel, '==============='];

      this.sortedPaymentMonth.forEach((team, index) => {
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
    if (this.rankingMode === 'all') {
      return 'Resultats Tout le temps';
    }
    if (this.rankingMode === 'year') {
      return `Resultats Année ${this.rankingYear}`;
    }
    const monthName =
      this.time.monthFrenchNames[this.paymentCurrentMonth - 1] ?? '';
    return `Resultats ${monthName} ${this.paymentCurrentYear}`;
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

      const manager = this.pickManager(working) ?? working[0];
      const partner = this.pickPartner(working, manager);

      const namesWorking = [
        this.formatEmployeeName(manager),
        this.formatEmployeeName(partner),
      ].filter(Boolean);

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

  private pickManager(employees: Employee[]): Employee | undefined {
    return employees.find((emp) =>
      (emp.role || '').toLowerCase().includes('manager')
    );
  }

  private pickPartner(
    employees: Employee[],
    manager?: Employee
  ): Employee | undefined {
    return employees.find((emp) => {
      if (manager?.uid && emp.uid) {
        return emp.uid !== manager.uid;
      }
      return emp !== manager;
    });
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

  updateReserveGraphics(range: number): void {
    const [labels, values] = this.aggregateMonthlyField('reserve', this.selectedReserveLocation);
    this.reserveMaxRange = labels.length;

    const [selectedLabels, selectedValues] = this.sliceForRange(
      labels,
      values,
      range
    );

    this.reserveGraphLabels = selectedLabels.map((label) =>
      this.formatMonthYearLabel(label)
    );
    this.reserveGraphSeriesUsd = this.compute.convertToDollarsArray(
      selectedValues
    );

    const color = selectedValues.length
      ? this.compute.findColor(selectedValues)
      : this.compute.colorPositive;

    // Build title with location name if selected
    const locationPrefix = this.selectedReserveLocation ? `${this.selectedReserveLocation} - ` : '';
    const titleText = `${locationPrefix}Réserve en $`;

    this.reserveGraph = {
      data: [
        {
          x: this.reserveGraphLabels,
          y: this.reserveGraphSeriesUsd,
          type: 'bar',
          mode: 'lines',
          marker: { color },
          line: { color: 'rgb(34, 139, 34)' },
        },
      ],
      layout: this.createGraphLayout(titleText),
    };
  }

  updatePaymentGraphics(range: number): void {
    const [labels, values] = this.aggregateMonthlyField('dailyReimbursement', this.selectedPaymentLocation);
    this.paymentMaxRange = labels.length;

    const [selectedLabels, selectedValues] = this.sliceForRange(
      labels,
      values,
      range
    );

    this.paymentGraphLabels = selectedLabels.map((label) =>
      this.formatMonthYearLabel(label)
    );
    this.paymentGraphSeriesUsd = this.compute.convertToDollarsArray(
      selectedValues
    );

    const color = selectedValues.length
      ? this.compute.findColor(selectedValues)
      : '#0ea5e9';

    // Build title with location name if selected
    const locationPrefix = this.selectedPaymentLocation ? `${this.selectedPaymentLocation} - ` : '';
    const titleText = `${locationPrefix}Paiement en $`;

    this.paymentGraph = {
      data: [
        {
          x: this.paymentGraphLabels,
          y: this.paymentGraphSeriesUsd,
          type: 'bar',
          mode: 'lines',
          marker: { color },
          line: { color: 'rgb(14, 165, 233)' },
        },
      ],
      layout: this.createGraphLayout(titleText),
    };
  }

  updateEntrySortieGraphics(range: number): void {
    const [labels, values] = this.aggregateMonthlyEntrySortie(
      this.selectedEntrySortieLocation
    );
    this.entrySortieMaxRange = labels.length;

    const [selectedLabels, selectedValues] = this.sliceForRange(
      labels,
      values,
      range
    );

    this.entrySortieGraphLabels = selectedLabels.map((label) =>
      this.formatMonthYearLabel(label)
    );
    this.entrySortieGraphSeriesUsd = this.compute.convertToDollarsArray(
      selectedValues
    );

    const locationPrefix = this.selectedEntrySortieLocation
      ? `${this.selectedEntrySortieLocation} - `
      : '';
    const titleText = `${locationPrefix}Entrées / Sorties en $`;

    this.entrySortieGraph = {
      data: [
        {
          x: this.entrySortieGraphLabels,
          y: this.entrySortieGraphSeriesUsd,
          type: 'bar',
          marker: {
            color: this.entrySortieGraphSeriesUsd.map((value) =>
              value < 0 ? '#ef4444' : '#10b981'
            ),
          },
          hovertemplate: '<b>%{x}</b><br>$%{y:,.0f}<extra></extra>',
        },
      ],
      layout: this.createEntrySortieGraphLayout(titleText),
    };
  }

  updateLendingGraphics(range: number): void {
    const [labels, values] = this.aggregateMonthlyField(
      'dailyLending',
      this.selectedLendingLocation
    );
    this.lendingMaxRange = labels.length;

    const [selectedLabels, selectedValues] = this.sliceForRange(
      labels,
      values,
      range
    );

    this.lendingGraphLabels = selectedLabels.map((label) =>
      this.formatMonthYearLabel(label)
    );
    this.lendingGraphSeriesUsd = this.compute.convertToDollarsArray(
      selectedValues
    );

    const color = selectedValues.length
      ? this.compute.findColor(selectedValues)
      : '#f59e0b';
    const locationPrefix = this.selectedLendingLocation
      ? `${this.selectedLendingLocation} - `
      : '';
    const titleText = `${locationPrefix}Emprunts en $`;

    this.lendingGraph = {
      data: [
        {
          x: this.lendingGraphLabels,
          y: this.lendingGraphSeriesUsd,
          type: 'bar',
          mode: 'lines',
          marker: { color },
          line: { color: '#f59e0b' },
        },
      ],
      layout: this.createGraphLayout(titleText),
    };
  }

  updateProfitabilityGraphics(range: number): void {
    const [labels, values] = this.aggregateMonthlyEntrySortieUsd();
    this.profitabilityMaxRange = labels.length;

    const [selectedLabels, selectedValues] = this.sliceForRange(
      labels,
      values,
      range
    );

    this.profitabilityGraphLabels = selectedLabels.map((label) =>
      this.formatMonthYearLabel(label)
    );
    this.profitabilityEntrySortieSeriesUsd = selectedValues.map((value) =>
      this.toNum(value)
    );
    this.profitabilityDeltaSeriesUsd =
      this.profitabilityEntrySortieSeriesUsd.map(
        (value) => value - this.profitabilityThresholdUsd
      );

    this.profitabilityGraph = {
      data: [
        {
          x: this.profitabilityGraphLabels,
          y: this.profitabilityDeltaSeriesUsd,
          type: 'bar',
          marker: {
            color: this.profitabilityDeltaSeriesUsd.map((value) =>
              value < 0 ? '#ef4444' : '#10b981'
            ),
          },
          customdata: this.profitabilityEntrySortieSeriesUsd,
          hovertemplate:
            '<b>%{x}</b><br>Entrées / Sorties: %{customdata:$,.0f}<br>Écart: %{y:$,.0f}<extra></extra>',
        },
      ],
      layout: this.createProfitabilityGraphLayout('Rentabilité vs seuil'),
      config: {
        responsive: true,
        displayModeBar: false,
      },
    };
  }

  private aggregateMonthlyField(field: UserDailyField, selectedLocation: string | null = null): [string[], string[]] {
    if (!this.allUsers || this.allUsers.length === 0) {
      return [[], []];
    }

    const aggregated = new Map<string, number>();

    // Filter users by selected location if any
    const usersToProcess = selectedLocation
      ? this.allUsers.filter((user) => user.firstName === selectedLocation)
      : this.allUsers;

    for (const user of usersToProcess) {
      const dailyData = user[field];
      if (!dailyData) continue;

      for (const [rawDate, rawValue] of Object.entries(dailyData)) {
        const parts = rawDate.split('-');
        if (parts.length < 3) continue;

        const month = parts[0];
        const year = parts[2];
        if (!month || !year) continue;

        const numericValue = this.sanitizeNumeric(rawValue);
        if (!Number.isFinite(numericValue)) continue;

        const monthYearKey = `${month}-${year}`;
        aggregated.set(
          monthYearKey,
          (aggregated.get(monthYearKey) ?? 0) + numericValue
        );
      }
    }

    const sortedEntries = Array.from(aggregated.entries()).sort(
      ([keyA], [keyB]) => {
        const [monthA, yearA] = keyA.split('-').map((part) => Number(part));
        const [monthB, yearB] = keyB.split('-').map((part) => Number(part));

        const dateA = new Date(yearA || 0, (monthA || 1) - 1).getTime();
        const dateB = new Date(yearB || 0, (monthB || 1) - 1).getTime();

        return dateA - dateB;
      }
    );

    const labels = sortedEntries.map(([key]) => key);
    const values = sortedEntries.map(([, value]) => value.toString());

    return [labels, values];
  }

  private aggregateMonthlyEntrySortieUsd(): [string[], string[]] {
    const [labels, entrySortieValues] = this.aggregateMonthlyEntrySortie();

    const entrySortieValuesUsd = entrySortieValues.map((entrySortieValue) => {
      const entrySortieFc = this.toNum(entrySortieValue);
      return `${this.toNum(
        this.compute.convertCongoleseFrancToUsDollars(entrySortieFc.toString())
      )}`;
    });

    return [labels, entrySortieValuesUsd];
  }

  private aggregateMonthlyEntrySortie(
    selectedLocation: string | null = null
  ): [string[], string[]] {
    if (!this.allUsers || this.allUsers.length === 0) {
      return [[], []];
    }

    const aggregated = new Map<string, { reserve: number; investment: number }>();
    const usersToProcess = selectedLocation
      ? this.allUsers.filter((user) => user.firstName === selectedLocation)
      : this.allUsers;

    const addField = (field: 'reserve' | 'investments') => {
      for (const user of usersToProcess) {
        const dailyData = user[field];
        if (!dailyData) continue;

        for (const [rawDate, rawValue] of Object.entries(dailyData)) {
          const parts = rawDate.split('-');
          if (parts.length < 3) continue;

          const month = parts[0];
          const year = parts[2];
          if (!month || !year) continue;

          const numericValue = this.sanitizeNumeric(rawValue);
          if (!Number.isFinite(numericValue)) continue;

          const monthYearKey = `${month}-${year}`;
          const current =
            aggregated.get(monthYearKey) ?? { reserve: 0, investment: 0 };

          if (field === 'reserve') {
            current.reserve += numericValue;
          } else {
            current.investment += numericValue;
          }

          aggregated.set(monthYearKey, current);
        }
      }
    };

    addField('reserve');
    addField('investments');

    const sortedEntries = Array.from(aggregated.entries()).sort(
      ([keyA], [keyB]) => {
        const [monthA, yearA] = keyA.split('-').map((part) => Number(part));
        const [monthB, yearB] = keyB.split('-').map((part) => Number(part));

        const dateA = new Date(yearA || 0, (monthA || 1) - 1).getTime();
        const dateB = new Date(yearB || 0, (monthB || 1) - 1).getTime();

        return dateA - dateB;
      }
    );

    const labels = sortedEntries.map(([key]) => key);
    const values = sortedEntries.map(
      ([, value]) => (value.reserve - value.investment).toString()
    );

    return [labels, values];
  }

  private sliceForRange<T>(
    labels: T[],
    values: string[],
    range: number
  ): [T[], string[]] {
    if (!labels.length) {
      return [[], []];
    }

    const targetRange = range > 0 ? Math.min(range, labels.length) : labels.length;
    const startIndex = Math.max(labels.length - targetRange, 0);

    return [labels.slice(startIndex), values.slice(startIndex)];
  }

  private formatMonthYearLabel(monthYear: string): string {
    const [month, year] = monthYear.split('-');
    const monthIndex = Number(month) - 1;
    const monthName =
      this.time.monthFrenchNames?.[monthIndex] ??
      this.time.monthFrenchNames?.[((monthIndex % 12) + 12) % 12] ??
      month;
    return `${monthName} ${year}`.trim();
  }

  private sanitizeNumeric(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.replace(/[\s,]/g, '');
      const parsed = parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
  }

  private rangeValueFromKey(key: RangeKey): number {
    return this.rangeKeyMap[key] ?? 0;
  }

  private createGraphLayout(title: string) {
    return {
      title,
      barmode: 'stack',
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      font: { color: '#0f172a' },
      margin: { t: 48, r: 24, l: 48, b: 64 },
    };
  }

  private createEntrySortieGraphLayout(title: string) {
    const values = this.entrySortieGraphSeriesUsd;
    const minValue = Math.min(0, ...values);
    const maxValue = Math.max(0, ...values);
    const padding = Math.max(1, (maxValue - minValue) * 0.12);

    return {
      ...this.createGraphLayout(title),
      yaxis: {
        zeroline: true,
        zerolinecolor: '#64748b',
        zerolinewidth: 2,
        gridcolor: '#e2e8f0',
        range: [minValue - padding, maxValue + padding],
      },
    };
  }

  private createProfitabilityGraphLayout(title: string) {
    const values = this.profitabilityDeltaSeriesUsd;
    const minValue = Math.min(0, ...values);
    const maxValue = Math.max(0, ...values);
    const padding = Math.max(250, (maxValue - minValue) * 0.18);

    return {
      ...this.createGraphLayout(title),
      height: 420,
      margin: { t: 56, r: 24, l: 64, b: 72 },
      yaxis: {
        title: 'Écart au seuil ($)',
        zeroline: true,
        zerolinecolor: '#0f172a',
        zerolinewidth: 3,
        gridcolor: '#e2e8f0',
        range: [minValue - padding, maxValue + padding],
      },
      shapes: [
        {
          type: 'line',
          xref: 'paper',
          x0: 0,
          x1: 1,
          y0: 0,
          y1: 0,
          line: {
            color: '#0f172a',
            width: 2,
          },
        },
      ],
      annotations: [
        {
          xref: 'paper',
          x: 1,
          y: 0,
          xanchor: 'right',
          yanchor: 'bottom',
          text: `Seuil: $${this.profitabilityThresholdUsd.toLocaleString(
            'en-US',
            { maximumFractionDigits: 0 }
          )}`,
          showarrow: false,
          bgcolor: '#f8fafc',
          bordercolor: '#cbd5e1',
          borderpad: 4,
          font: { color: '#0f172a', size: 12 },
        },
      ],
    };
  }

  private createEmptyGraph(title: string) {
    return {
      data: [
        {
          x: [] as string[],
          y: [] as number[],
          type: 'bar',
          mode: 'lines',
          marker: { color: this.compute.colorPositive },
          line: { color: 'rgb(34, 139, 34)' },
        },
      ],
      layout: this.createGraphLayout(title),
    };
  }

  toNum(v: any): number {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const n = parseFloat(v.replace(/\s/g, ''));
      return isNaN(n) ? 0 : n;
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

  absNumber(value: any): number {
    return Math.abs(this.toNum(value));
  }

  saveProfitabilityThreshold(): void {
    if (!this.auth.isAdmin || this.profitabilityThresholdSaving) {
      return;
    }

    const value = Number(this.profitabilityThresholdInput);
    if (!Number.isFinite(value) || value <= 0) {
      alert('Entrez un seuil de profit valide.');
      return;
    }

    this.profitabilityThresholdSaving = true;
    this.profitabilityThresholdSaved = false;

    this.auth
      .updateProfitabilityThresholdGlobal(value)
      .then(() => {
        this.profitabilityThresholdSaved = true;
        this.profitabilityThresholdInput = '';
      })
      .catch((err) => {
        console.error('Failed to update profitability threshold:', err);
        alert("Impossible d'enregistrer le seuil de profit.");
      })
      .finally(() => {
        this.profitabilityThresholdSaving = false;
      });
  }

  get currentEntrySortieUsd(): number {
    return this.toNum(this.entrySortieCurrentTotalAmountDollars);
  }

  get currentProfitabilityDeltaUsd(): number {
    return this.currentEntrySortieUsd - this.profitabilityThresholdUsd;
  }

  nonNegColor(rate: any): string {
    const r = this.toNum(rate);
    return r >= 0
      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200'
      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200';
  }

  // Compute baselines safely every change detection (cheap enough for small lists)
  get maxReserveUSD(): number {
    const arr = (this.sortedReserveMonth ?? []).map((s) =>
      this.toNum(s?.totalReserveInDollars)
    );
    return Math.max(1, ...arr, 1);
  }

  get maxPaymentUSD(): number {
    const arr = (this.sortedPaymentMonth ?? []).map((s) =>
      this.toNum(s?.totalPaymentInDollars)
    );
    return Math.max(1, ...arr, 1);
  }

  get maxLendingUSD(): number {
    const arr = (this.sortedLendingMonth ?? []).map((s) =>
      this.toNum(s?.totalLendingInDollars)
    );
    return Math.max(1, ...arr, 1);
  }

  get maxEntrySortieUSD(): number {
    const arr = (this.sortedEntrySortieMonth ?? []).map((s) =>
      Math.abs(this.toNum(s?.totalEntrySortieInDollars))
    );
    return Math.max(1, ...arr, 1);
  }

  /**
   * Calculate the number of working days (excluding Sundays) for a given month
   * @param month 1-12
   * @param year e.g. 2025
   * @param isCurrentMonth if true, only count days up to today
   * @returns number of working days
   */
  private calculateWorkingDays(month: number, year: number, isCurrentMonth: boolean): number {
    const daysInMonth = new Date(year, month, 0).getDate();
    const currentDate = new Date();
    const isCurrent = isCurrentMonth && 
                      month === currentDate.getMonth() + 1 && 
                      year === currentDate.getFullYear();
    
    const endDay = isCurrent ? currentDate.getDate() : daysInMonth;
    let workingDays = 0;
    
    for (let day = 1; day <= endDay; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      // Sunday is 0, so exclude it
      if (dayOfWeek !== 0) {
        workingDays++;
      }
    }
    
    return workingDays;
  }

  private isCurrentYear(year: number): boolean {
    const currentDate = new Date();
    return year === currentDate.getFullYear();
  }

  /**
   * Calculate working days (excl. Sundays) for a full year.
   * If current year, only count up to the current month/day.
   */
  private calculateWorkingDaysForYear(
    year: number,
    isCurrentYear: boolean
  ): number {
    const currentDate = new Date();
    const endMonth = isCurrentYear ? currentDate.getMonth() + 1 : 12;
    let totalWorkingDays = 0;

    for (let month = 1; month <= endMonth; month++) {
      const isCurrentMonth =
        isCurrentYear &&
        month === endMonth &&
        year === currentDate.getFullYear();
      totalWorkingDays += this.calculateWorkingDays(
        month,
        year,
        isCurrentMonth
      );
    }

    return totalWorkingDays;
  }

  /**
   * Calculate working days across all available yearsList up to current year.
   */
  private calculateWorkingDaysAllTime(): number {
    const currentYear = new Date().getFullYear();
    const minYear = this.yearsList.length ? Math.min(...this.yearsList) : currentYear;
    let total = 0;
    for (let year = minYear; year <= currentYear; year++) {
      total += this.calculateWorkingDaysForYear(
        year,
        this.isCurrentYear(year)
      );
    }
    return total;
  }

  /**
   * Calculate average daily Reserve and Payment for the selected month
   */
  calculateAverageReserveAndPayment(): void {
    if (!this.allUsers || this.allUsers.length === 0) {
      this.averageDailyReserve = 0;
      this.averageDailyPayment = 0;
      this.averageDailyReserveUsd = 0;
      this.averageDailyPaymentUsd = 0;
      this.workingDaysInMonth = 0;
      return;
    }

    const totalReserve = Number(this.givenMonthTotalReserveAmount) || 0;
    const totalPayment = Number(this.givenMonthTotalPaymentAmount) || 0;

    // Check if this is the current month
    const currentDate = new Date();
    const isCurrentMonth = 
      this.givenMonth === currentDate.getMonth() + 1 && 
      this.givenYear === currentDate.getFullYear();

    // Calculate working days
    this.workingDaysInMonth = this.calculateWorkingDays(
      this.givenMonth,
      this.givenYear,
      isCurrentMonth
    );

    // Calculate averages
    if (this.workingDaysInMonth > 0) {
      this.averageDailyReserve = totalReserve / this.workingDaysInMonth;
      this.averageDailyPayment = totalPayment / this.workingDaysInMonth;
      
      // Convert to USD
      const reserveUsd = this.compute.convertCongoleseFrancToUsDollars(
        String(this.averageDailyReserve)
      );
      const paymentUsd = this.compute.convertCongoleseFrancToUsDollars(
        String(this.averageDailyPayment)
      );
      
      this.averageDailyReserveUsd = reserveUsd === '' ? 0 : Number(reserveUsd);
      this.averageDailyPaymentUsd = paymentUsd === '' ? 0 : Number(paymentUsd);
    } else {
      this.averageDailyReserve = 0;
      this.averageDailyPayment = 0;
      this.averageDailyReserveUsd = 0;
      this.averageDailyPaymentUsd = 0;
    }
  }

  /**
   * Update mini graphs for all users in the tables
   * Shows last 3-4 months of data as sparklines
   */
  private updateMiniGraphs(): void {
    if (!this.allUsers || this.allUsers.length === 0) {
      this.miniReserveGraphs.clear();
      this.miniPaymentGraphs.clear();
      return;
    }

    // Clear existing graphs
    this.miniReserveGraphs.clear();
    this.miniPaymentGraphs.clear();

    // Generate mini graphs for each user in the sorted tables
    this.sortedReserveMonth.forEach((item) => {
      const user = this.allUsers.find((u) => u.firstName === item.firstName);
      if (user && user.firstName) {
        const reserveGraph = this.createMiniMonthlyGraph(
          user,
          'reserve',
          this.reserveCurrentMonth,
          this.reserveCurrentYear
        );
        if (reserveGraph) {
          this.miniReserveGraphs.set(user.firstName, reserveGraph);
        }
      }
    });

    this.sortedPaymentMonth.forEach((item) => {
      const user = this.allUsers.find((u) => u.firstName === item.firstName);
      if (user && user.firstName) {
        const paymentGraph = this.createMiniMonthlyGraph(
          user,
          'dailyReimbursement',
          this.paymentCurrentMonth,
          this.paymentCurrentYear
        );
        if (paymentGraph) {
          this.miniPaymentGraphs.set(user.firstName, paymentGraph);
        }
      }
    });

  }

  /**
   * Create a mini monthly graph for a specific user and field
   * Shows last 3-4 months of monthly totals
   */
  private createMiniMonthlyGraph(
    user: User,
    field: 'reserve' | 'dailyReimbursement',
    currentMonth: number,
    currentYear: number
  ): { data: any[]; layout: any; config?: any } | null {
    const data = user[field];
    if (!data) return null;

    const values: number[] = [];
    const labels: string[] = [];

    // Get last 4 months of data (including current month)
    for (let i = 3; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - 1 - i, 1);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();

      // Calculate total for this month
      let monthTotal = 0;
      const daysInMonth = new Date(year, month, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
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

        monthTotal += dayValue;
      }

      // Convert to dollars
      const valueInDollars = this.toNum(
        this.compute.convertCongoleseFrancToUsDollars(monthTotal.toString())
      );

      // Only add non-zero values
      if (valueInDollars > 0 || i === 0) {
        // Always include current month even if zero
        values.push(valueInDollars);
        // Use abbreviated month name
        const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        labels.push(`${monthNames[month - 1]}`);
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

    // Create sequential x-axis indices
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
          hovertemplate: '<b>%{text}</b><br>$%{customdata:,.2f}<extra></extra>',
          text: labels,
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

  /**
   * Get mini reserve graph for a location
   */
  getMiniReserveGraph(locationName: string): { data: any[]; layout: any; config?: any } {
    return this.miniReserveGraphs.get(locationName) || this.createEmptyMiniGraph();
  }

  /**
   * Get mini payment graph for a location
   */
  getMiniPaymentGraph(locationName: string): { data: any[]; layout: any; config?: any } {
    return this.miniPaymentGraphs.get(locationName) || this.createEmptyMiniGraph();
  }

  /**
   * Create an empty mini graph placeholder
   */
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
      config: {
        responsive: false,
        displayModeBar: false,
        staticPlot: true,
      },
    };
  }
}
