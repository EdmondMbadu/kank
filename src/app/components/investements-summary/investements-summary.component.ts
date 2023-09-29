import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-investements-summary',
  templateUrl: './investements-summary.component.html',
  styleUrls: ['./investements-summary.component.css'],
})
export class InvestementsSummaryComponent implements OnInit {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService
  ) {}
  ngOnInit() {
    this.initalizeInputs();
  }
  dailyLending: string = '0';
  dailyPayment: string = '0';
  elements: number = 10;
  linkPath: string[] = [
    '/client-info',
    '/add-investment',
    '/client-info',
    '/client-info',
    '/add-expense',
    '/client-info',
    '/add-reserve',
    '/client-info',
    '/client-info',
    '/client-info',
    '/daily-payments',
    '/daily-lendings',
  ];
  imagePaths: string[] = [
    '../../../assets/img/people.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/debt.png',
    '../../../assets/img/saving.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/revenue.svg',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/member.svg',
    '../../../assets/img/benefit.svg',
    '../../../assets/img/benefit.svg',
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
  ];
  summary: string[] = [
    'Nombres des Clients',
    'Argent Investi',
    'Prêt Restant',
    'Epargne Clients',
    'Depenses',
    'Benefice Réel',
    'Reserve',
    'Frais Des Membres',
    'Benefice Brute',
    'Benefice',
    'Paiment Du Jour',
    'Emprunt Du Jour',
  ];
  summaryContent: string[] = [];

  initalizeInputs() {
    let realBenefit = (
      Number(this.auth.currentUser.totalDebtLeft) -
      Number(this.auth.currentUser.amountInvested)
    ).toString();
    this.dailyLending =
      this.auth.currentUser.dailyLending[this.time.todaysDateMonthDayYear()];
    this.dailyPayment =
      this.auth.currentUser.dailyReimbursement[
        this.time.todaysDateMonthDayYear()
      ];
    this.dailyLending =
      this.dailyLending === undefined ? '0' : this.dailyLending;
    this.dailyPayment =
      this.dailyPayment === undefined ? '0' : this.dailyPayment;

    this.summaryContent = [
      this.auth.currentUser.numberOfClients,
      ` ${this.auth.currentUser.amountInvested}`,
      ` ${this.auth.currentUser.totalDebtLeft}`,
      ` ${this.auth.currentUser.clientsSavings}`,
      ` ${this.auth.currentUser.expensesAmount}`,
      `${realBenefit}`,
      ` ${this.auth.currentUser.reserveAmount}`,
      ` ${this.auth.currentUser.fees}`,
      `${this.BenefitsWithoutExpenses()}`,
      ` ${this.BenefitsWithExpenses()}`,
      ` ${this.dailyPayment}`,
      ` ${this.dailyLending}`,
    ];
  }
  BenefitsWithExpenses(): string {
    const benefit =
      Number(this.auth.currentUser.projectedRevenue) -
      Number(this.auth.currentUser.amountLended) -
      Number(this.auth.currentUser.expensesAmount) -
      Number(this.auth.currentUser.reserveAmount);
    return benefit.toString();
  }
  BenefitsWithoutExpenses(): string {
    const benefit =
      Number(this.auth.currentUser.projectedRevenue) -
      Number(this.auth.currentUser.amountLended);

    return benefit.toString();
  }
}
