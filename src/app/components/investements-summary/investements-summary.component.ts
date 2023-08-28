import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-investements-summary',
  templateUrl: './investements-summary.component.html',
  styleUrls: ['./investements-summary.component.css'],
})
export class InvestementsSummaryComponent {
  constructor(private router: Router) {}

  elements: number = 10;

  summary: string[] = [
    'Clients Information',
    'Amount Invested',
    'Amount Lended',
    'Clients Total Savings',
    'Amount Remaining',
    'Projected Revenue',
    'Current Revenue',
    'Current Benefits',
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
  ];

  gotoClientInfo() {
    this.router.navigate(['/client-info']);
  }
}
