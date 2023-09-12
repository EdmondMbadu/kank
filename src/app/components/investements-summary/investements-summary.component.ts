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
  ngOnInit() {}

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
  ];
  imagePaths: string[] = [
    '../../../assets/img/people.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/lend.svg',
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
    'Argent Emprunté',
    'Epargne Clients',
    'Depenses',
    'Revenues Attendu',
    'Reserve',
    'Frais Des Membres',
    'Benefice Brute',
    'Benefice',
    'Paiment Du Jour',
    'Emprunt Du Jour',
  ];
  summaryContent: string[] = [
    this.auth.currentUser.numberOfClients,
    ` ${this.auth.currentUser.amountInvested}`,
    ` ${this.auth.currentUser.amountLended}`,
    ` ${this.auth.currentUser.clientsSavings}`,
    ` ${this.auth.currentUser.expensesAmount}`,
    `${this.auth.currentUser.projectedRevenue}`,
    ` ${this.auth.currentUser.reserveAmount}`,
    ` ${this.auth.currentUser.fees}`,
    `${this.BenefitsWithoutExpenses()}`,
    ` ${this.BenefitsWithExpenses()}`,
    ` ${
      this.auth.currentUser.dailyReimbursement[
        this.time.todaysDateMonthDayYear()
      ]
    }`,
    ` ${
      this.auth.currentUser.dailyLending[this.time.todaysDateMonthDayYear()]
    }`,
  ];

  BenefitsWithExpenses(): string {
    const benefit =
      Number(this.auth.currentUser.projectedRevenue) -
      Number(this.auth.currentUser.amountLended) -
      Number(this.auth.currentUser.expensesAmount);
    return benefit.toString();
  }
  BenefitsWithoutExpenses(): string {
    const benefit =
      Number(this.auth.currentUser.projectedRevenue) -
      Number(this.auth.currentUser.amountLended);

    return benefit.toString();
  }
}
