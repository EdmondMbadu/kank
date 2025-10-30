import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { User, UserDailyField } from 'src/app/models/user';

type RangeKey = '3M' | '6M' | '9M' | '1A' | 'MAX';
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
    private router: Router,
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
  yearsList: number[] = [2023, 2024];
  monthsList: number[] = [...Array(12).keys()].map((i) => i + 1);
  monthYear = `${this.month} ${this.year}`;
  totalPerfomance: number = 0;
  linkPaths: string[] = [
    '/paid-date',
    '/lending-date',
    '/client-info-current',
    '/add-expense',
    '/add-reserve',
    '/add-invest',
    '/',
    '/',
  ];
  summary: string[] = [
    'Paiment Du Mois ',
    'Emprunts Du Mois',
    'Benefice Du Mois ',
    'Depense Du Mois',
    'Reserve Du Mois',
    'Frais De Membre Du Mois',
    'Investissement Du Mois',
    'Epargne Du Mois',
    'Retrait Epargne Du Mois',
    'Perte Du Mois',
    'Budget Emprunts Du Mois',
  ];
  valuesConvertedToDollars: string[] = [];

  private readonly rangeKeyMap: Record<RangeKey, number> = {
    '3M': 3,
    '6M': 6,
    '9M': 9,
    '1A': 12,
    'MAX': 0,
  };

  reserveActiveRange: RangeKey = '3M';
  paymentActiveRange: RangeKey = '3M';

  reserveGraph = this.createEmptyGraph('Réserve en $');
  paymentGraph = this.createEmptyGraph('Paiement en $');

  reserveMaxRange = 0;
  paymentMaxRange = 0;

  private reserveGraphLabels: string[] = [];
  private reserveGraphSeriesUsd: number[] = [];
  private paymentGraphLabels: string[] = [];
  private paymentGraphSeriesUsd: number[] = [];

  givenMonthTotalPaymentAmount: string = '';
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
  givenMonthTotalLoss: string = '';
  previousMonthTotalReserve: string = '';
  imagePaths: string[] = [
    '../../../assets/img/audit.png',
    '../../../assets/img/lending-date.png',
    '../../../assets/img/benefit.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/member.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/loss.png',
    '../../../assets/img/budget.png',
  ];
  sortedReserveMonth: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] = [];
  sortedPaymentMonth: {
    firstName: string;
    totalPayment: number;
    totalPaymentInDollars: string;
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
  summaryContent: string[] = [];
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
  reserveCurrentTotalAmount: string = '0';
  reserveCurrentTotalAmountDollars: string = '0';
  paymentCurrentTotalAmount: string = '0';
  paymentCurrentTotalAmountDollars: string = '0';

  sortedPaymentPreviousMonth: {
    firstName: string;
    totalPayment: number;
    totalPaymentInDollars: string;
  }[] = [];

  sortedGrowthRatePaymentMonth: {
    firstName: string;
    totalPayment: number;
    totalPaymentInDollars: string;
    growthRate: string;
  }[] = [];

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

    this.summaryContent = [
      `${this.givenMonthTotalPaymentAmount}`,
      `${this.givenMonthTotalLendingAmount}`,
      `${this.givenMonthTotalBenefitAmount}`,
      `${this.givenMonthTotalExpenseAmount}`,
      `${this.givenMonthTotalReserveAmount}`,
      `${this.givenMonthTotalFeesAmount}`,
      `${this.givenMonthTotalInvestmentAmount}`,
      `${this.givenMonthTotalSavingAmount}`,
      `${this.givenMonthTotalSavingReturnsAmount}`,
      `${this.givenMonthTotalLoss}`,
      `${this.givenMonthBudget}`,
    ];
    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalPaymentAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalLendingAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalBenefitAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalExpenseAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalReserveAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalFeesAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalInvestmentAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalSavingAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalSavingReturnsAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.givenMonthTotalLoss
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.givenMonthBudget)}`,
    ];

    this.reserveCurrentMonth = this.givenMonth;
    this.reserveCurrentYear = this.givenYear;
    this.reserveComparisonMonth = this.previousMonth;
    this.reserveComparisonYear = this.previousYear;
    this.paymentCurrentMonth = this.givenMonth;
    this.paymentCurrentYear = this.givenYear;
    this.paymentComparisonMonth = this.previousMonth;
    this.paymentComparisonYear = this.previousYear;

    this.updateReserveTableData();
    this.updatePaymentTableData();

    this.updateReserveGraphics(this.rangeValueFromKey(this.reserveActiveRange));
    this.updatePaymentGraphics(this.rangeValueFromKey(this.paymentActiveRange));
  }

  updateReserveTableData(): void {
    if (!this.allUsers || this.allUsers.length === 0) {
      this.sortedReserveMonth = [];
      this.sortedReservePreviousMonth = [];
      this.sortedGrowthRateMonth = [];
      this.reserveCurrentTotalAmount = '0';
      this.reserveCurrentTotalAmountDollars = '0';
      this.reserveGrowthRateTotal = '0';
      return;
    }

    this.sortedReserveMonth =
      this.compute.findTotalGivenMonthForAllUsersSortedDescending(
        this.allUsers,
        'reserve',
        this.reserveCurrentMonth,
        this.reserveCurrentYear
      );

    this.sortedReservePreviousMonth =
      this.compute.findTotalGivenMonthForAllUsersSortedDescending(
        this.allUsers,
        'reserve',
        this.reserveComparisonMonth,
        this.reserveComparisonYear
      );

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

    const reserveCurrentTotal =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'reserve',
        this.reserveCurrentMonth,
        this.reserveCurrentYear
      ) ?? 0;
    const reserveComparisonTotal =
      this.compute.findTotalGivenMonthForAllUsers(
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
  }

  updatePaymentTableData(): void {
    if (!this.allUsers || this.allUsers.length === 0) {
      this.sortedPaymentMonth = [];
      this.sortedPaymentPreviousMonth = [];
      this.sortedGrowthRatePaymentMonth = [];
      this.paymentCurrentTotalAmount = '0';
      this.paymentCurrentTotalAmountDollars = '0';
      this.paymentGrowthRateTotal = '0';
      return;
    }

    const paymentCurrentRaw =
      this.compute.findTotalGivenMonthForAllUsersSortedDescending(
        this.allUsers,
        'dailyReimbursement',
        this.paymentCurrentMonth,
        this.paymentCurrentYear
      );

    const paymentPrevRaw =
      this.compute.findTotalGivenMonthForAllUsersSortedDescending(
        this.allUsers,
        'dailyReimbursement',
        this.paymentComparisonMonth,
        this.paymentComparisonYear
      );

    this.sortedPaymentMonth = paymentCurrentRaw.map((x: any) => ({
      firstName: x.firstName,
      totalPayment: x.totalReserve,
      totalPaymentInDollars: x.totalReserveInDollars,
    }));

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

    const paymentCurrentTotal =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'dailyReimbursement',
        this.paymentCurrentMonth,
        this.paymentCurrentYear
      ) ?? 0;
    const paymentComparisonTotal =
      this.compute.findTotalGivenMonthForAllUsers(
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
  }

  setReserveRange(key: RangeKey): void {
    this.reserveActiveRange = key;
    this.updateReserveGraphics(this.rangeValueFromKey(key));
  }

  setPaymentRange(key: RangeKey): void {
    this.paymentActiveRange = key;
    this.updatePaymentGraphics(this.rangeValueFromKey(key));
  }

  updateReserveGraphics(range: number): void {
    const [labels, values] = this.aggregateMonthlyField('reserve');
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
      layout: this.createGraphLayout('Réserve en $'),
    };
  }

  updatePaymentGraphics(range: number): void {
    const [labels, values] = this.aggregateMonthlyField('dailyReimbursement');
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
      layout: this.createGraphLayout('Paiement en $'),
    };
  }

  private aggregateMonthlyField(field: UserDailyField): [string[], string[]] {
    if (!this.allUsers || this.allUsers.length === 0) {
      return [[], []];
    }

    const aggregated = new Map<string, number>();

    for (const user of this.allUsers) {
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
}
