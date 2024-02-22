import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-tracking-month',
  templateUrl: './tracking-month.component.html',
  styleUrls: ['./tracking-month.component.css'],
})
export class TrackingMonthComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    public time: TimeService,
    private compute: ComputationService
  ) {}
  ngOnInit() {
    this.initalizeInputs();
  }

  currentDate = new Date();
  currentMonth = this.currentDate.getMonth() + 1;
  givenMonth: number = this.currentMonth;
  month = this.compute.getMonthNameFrench(this.currentMonth);
  year = this.currentDate.getFullYear();
  givenYear = this.year;
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
  ];
  summary: string[] = [
    'Paiment Du Mois',
    'Emprunts Du Mois',
    'Benefice Du Mois ',
    'Depense Du Mois',
    'Reserve Du Mois',
  ];
  valuesConvertedToDollars: string[] = [];
  givenMonthTotalPaymentAmount: string = '';
  givenMonthTotalBenefitAmount: string = '';
  givenMonthTotalLendingAmount: string = '';
  givenMonthTotalExpenseAmount: string = '';
  givenMonthTotalReserveAmount: string = '';
  imagePaths: string[] = [
    '../../../assets/img/audit.png',
    '../../../assets/img/lending-date.png',
    '../../../assets/img/benefit.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/reserve.svg',
  ];

  today = this.time.todaysDateMonthDayYear();
  summaryContent: string[] = [];
  initalizeInputs() {
    this.givenMonthTotalPaymentAmount = this.compute.findTotalGiventMonth(
      this.auth.currentUser.dailyReimbursement,
      this.givenMonth,
      this.givenYear
    );

    this.givenMonthTotalBenefitAmount = Math.ceil(
      Number(this.givenMonthTotalPaymentAmount) * 0.285
    ).toString();

    this.givenMonthTotalLendingAmount = this.compute.findTotalGiventMonth(
      this.auth.currentUser.dailyLending,
      this.givenMonth,
      this.givenYear
    );

    this.givenMonthTotalExpenseAmount = this.compute.findTotalGiventMonth(
      this.auth.currentUser.expenses,
      this.givenMonth,
      this.givenYear
    );

    this.givenMonthTotalReserveAmount = this.compute.findTotalGiventMonth(
      this.auth.currentUser.reserve,
      this.givenMonth,
      this.givenYear
    );
    this.summaryContent = [
      `${this.givenMonthTotalPaymentAmount}`,
      `${this.givenMonthTotalLendingAmount}`,
      `${this.givenMonthTotalBenefitAmount}`,
      `${this.givenMonthTotalExpenseAmount}`,
      `${this.givenMonthTotalReserveAmount}`,
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
    ];
  }
}
