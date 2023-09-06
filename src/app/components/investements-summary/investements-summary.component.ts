import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-investements-summary',
  templateUrl: './investements-summary.component.html',
  styleUrls: ['./investements-summary.component.css'],
})
export class InvestementsSummaryComponent implements OnInit {
  constructor(private router: Router, public auth: AuthService) {}
  ngOnInit() {}

  elements: number = 10;
  paths: string[] = [
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
  ];
  summary: string[] = [
    'Number of Clients',
    'Amount Invested',
    'Amount Lended',
    'Clients Total Savings',
    'Expenses',
    'Projected Revenue',
    'Reserve',
    'Membership Fees',
    'Benefits without Expenses',
    'Benefits with Expenses',
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
  ];

  BenefitsWithExpenses(): string {
    const benefit =
      Number(this.auth.currentUser.projectedRevenue) -
      (Number(this.auth.currentUser.amountInvested) +
        Number(this.auth.currentUser.expensesAmount));
    return benefit.toString();
  }
  BenefitsWithoutExpenses(): string {
    const benefit =
      Number(this.auth.currentUser.projectedRevenue) -
      Number(this.auth.currentUser.amountInvested);

    return benefit.toString();
  }
}
