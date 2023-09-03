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
    'Clients Information',
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
    '60',
    'FC 50,000',
    'FC 50,000',
    'FC 50,000',
    'FC 50,000',
    'FC 50,000',
    'FC 50,000',
    'FC 50,000',
    'FC 50,000',
    'FC 50,000',
  ];

  gotoClientInfo() {
    this.router.navigate(['/client-info']);
  }
}
