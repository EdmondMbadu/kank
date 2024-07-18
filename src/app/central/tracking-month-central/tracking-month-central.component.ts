import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
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
  month = this.compute.getMonthNameFrench(this.currentMonth);
  year = this.currentDate.getFullYear();
  givenYear = this.year;
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
  ];
  summary: string[] = [
    'Paiment Du Mois Central',
    'Emprunts Du Mois',
    'Benefice Du Mois ',
    'Depense Du Mois',
    'Reserve Du Mois',
    'Frais De Membre Du Mois',
    'Investissement Du Mois',
    'Epargne Du Mois',
    'Retrait Epargne Du Mois',
  ];
  valuesConvertedToDollars: string[] = [];
  givenMonthTotalPaymentAmount: string = '';
  givenMonthTotalSavingAmount: string = '';
  givenMonthTotalSavingReturnsAmount: string = '';
  givenMonthTotalBenefitAmount: string = '';
  givenMonthTotalLendingAmount: string = '';
  givenMonthTotalExpenseAmount: string = '';
  givenMonthTotalReserveAmount: string = '';
  givenMonthTotalFeesAmount: string = '';
  givenMonthTotalInvestmentAmount: string = '';
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
  ];
  sortedReserveMonth: {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] = [];
  today = this.time.todaysDateMonthDayYear();
  summaryContent: string[] = [];
  initalizeInputs() {
    this.givenMonthTotalPaymentAmount =
      this.compute.findTotalGivenMonthForAllUsers(
        this.allUsers,
        'dailyReimbursement',
        this.givenMonth,
        this.givenYear
      );

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

    this.sortedReserveMonth =
      this.compute.findTotalGivenMonthForAllUsersSortedDescending(
        this.allUsers,
        'reserve',
        this.givenMonth,
        this.givenYear
      );
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
    ];
  }
}
