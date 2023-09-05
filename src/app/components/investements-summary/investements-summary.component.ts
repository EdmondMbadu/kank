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
    `FC ${this.auth.currentUser.amountInvested}`,
    `FC ${this.auth.currentUser.amountLended}`,
    `FC ${this.auth.currentUser.clientsSavings}`,
    `FC ${this.auth.currentUser.expensesAmount}`,
    `FC ${this.auth.currentUser.projectedRevenue}`,
    `FC ${this.auth.currentUser.reserveAmount}`,
    `FC ${this.auth.currentUser.fees}`,
    `FC ${this.BenefitsWithoutExpenses()}`,
    `FC ${this.BenefitsWithExpenses()}`,
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
