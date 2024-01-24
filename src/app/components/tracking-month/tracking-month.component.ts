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
    private time: TimeService,
    private compute: ComputationService
  ) {}
  ngOnInit() {
    this.initalizeInputs();
  }
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth() + 1;
  month = this.compute.getMonthNameFrench(this.currentMonth);
  year = this.currentDate.getFullYear();
  monthYear = `${this.month} ${this.year}`;
  totalPerfomance: number = 0;
  linkPaths: string[] = [
    '/paid-date',
    '/lending-date',
    '/client-info',
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
  currentMonthTotalPaymentAmount: string = '';
  currentMonthTotalBenefitAmount: string = '';
  currentMonthTotalLendingAmount: string = '';
  currentMonthTotalExpenseAmount: string = '';
  currentMonthTotalReserveAmount: string = '';
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
    this.currentMonthTotalPaymentAmount = this.compute.findTotalCurrentMonth(
      this.auth.currentUser.dailyReimbursement
    );
    this.currentMonthTotalBenefitAmount = Math.ceil(
      Number(this.currentMonthTotalPaymentAmount) * 0.285
    ).toString();
    this.currentMonthTotalLendingAmount = this.compute.findTotalCurrentMonth(
      this.auth.currentUser.dailyLending
    );
    this.currentMonthTotalExpenseAmount = this.compute.findTotalCurrentMonth(
      this.auth.currentUser.expenses
    );
    this.currentMonthTotalReserveAmount = this.compute.findTotalCurrentMonth(
      this.auth.currentUser.reserve
    );
    this.summaryContent = [
      `${this.currentMonthTotalPaymentAmount}`,
      `${this.currentMonthTotalLendingAmount}`,
      `${this.currentMonthTotalBenefitAmount}`,
      `${this.currentMonthTotalExpenseAmount}`,
      `${this.currentMonthTotalReserveAmount}`,
    ];
    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.currentMonthTotalPaymentAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.currentMonthTotalLendingAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.currentMonthTotalBenefitAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.currentMonthTotalExpenseAmount
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.currentMonthTotalReserveAmount
      )}`,
    ];
  }
}
