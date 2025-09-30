import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/models/user';
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
  growthRateTotal: string = '';

  // Add next to your other fields

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

  previousMonthTotalPayment: string = '';
  growthRateTotalPayments: string = '';

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
    this.previousMonthTotalReserve =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'reserve',
        this.previousMonth,
        this.previousYear
      );

    this.previousMonthTotalPayment =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'dailyReimbursement',
        this.previousMonth,
        this.previousYear
      );

    this.growthRateTotal = (
      ((Number(this.givenMonthTotalReserveAmount) -
        Number(this.previousMonthTotalReserve)) /
        Number(this.previousMonthTotalReserve)) *
      100
    ).toString();
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

    this.sortedReserveMonth =
      this.compute.findTotalGivenMonthForAllUsersSortedDescending(
        this.allUsers,
        'reserve',
        this.givenMonth,
        this.givenYear
      );
    const paymentCurrentRaw =
      this.compute.findTotalGivenMonthForAllUsersSortedDescending(
        this.allUsers,
        'dailyReimbursement',
        this.givenMonth,
        this.givenYear
      );

    this.sortedPaymentMonth = paymentCurrentRaw.map((x: any) => ({
      firstName: x.firstName,
      totalPayment: x.totalReserve,
      totalPaymentInDollars: x.totalReserveInDollars,
    }));

    const paymentPrevRaw =
      this.compute.findTotalGivenMonthForAllUsersSortedDescending(
        this.allUsers,
        'dailyReimbursement',
        this.previousMonth,
        this.previousYear
      );
    this.sortedReservePreviousMonth =
      this.compute.findTotalGivenMonthForAllUsersSortedDescending(
        this.allUsers,
        'reserve',
        this.previousMonth,
        this.previousYear
      );
    this.sortedPaymentPreviousMonth = paymentPrevRaw.map((x: any) => ({
      firstName: x.firstName,
      totalPayment: x.totalReserve,
      totalPaymentInDollars: x.totalReserveInDollars,
    }));

    // (C) Compute per-user growth rate for Payments
    this.sortedGrowthRatePaymentMonth = this.sortedPaymentMonth.map((curr) => {
      const prev = this.sortedPaymentPreviousMonth.find(
        (p) => p.firstName === curr.firstName
      );
      const prevVal = prev ? Number(prev.totalPayment) : 0;
      const currVal = Number(curr.totalPayment);

      // Avoid divide-by-zero; choose behavior you prefer:
      // - If prev is 0 and current > 0 → 100 (or use 0 if you prefer)
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
    const prevTotal = Number(this.previousMonthTotalPayment || 0);
    const currTotal = Number(this.givenMonthTotalPaymentAmount || 0);
    this.growthRateTotalPayments =
      prevTotal > 0
        ? (((currTotal - prevTotal) / prevTotal) * 100).toString()
        : currTotal > 0
        ? '100'
        : '0';

    // Initialize sortedGrowthRateMonth
    this.sortedGrowthRateMonth = this.sortedReserveMonth.map((currentMonth) => {
      // Find the matching entry for the previous month by firstName
      const previousMonth = this.sortedReservePreviousMonth.find(
        (prev) => prev.firstName === currentMonth.firstName
      );

      // Calculate the growth rate if previousMonth data is available
      const growthRate =
        previousMonth && currentMonth.totalReserve !== 0
          ? ((currentMonth.totalReserve - previousMonth.totalReserve) /
              previousMonth.totalReserve) *
            100
          : 0; // If there's no previous month data or reserve is zero, set growth rate to 0
      return {
        firstName: currentMonth.firstName,
        totalReserve: currentMonth.totalReserve,
        totalReserveInDollars: currentMonth.totalReserveInDollars,
        growthRate: growthRate.toString(),
      };
    });

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

    console.log('given month total reserve', this.sortedReserveMonth);
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
  }
  // tracking-month-central.component.ts (inside the class)
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
