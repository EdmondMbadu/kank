import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-retrace',
  templateUrl: './retrace.component.html',
  styleUrls: ['./retrace.component.css'],
})
export class RetraceComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}
  ngOnInit() {
    this.initalizeInputs();
  }
  dailyLending: string = '0';
  dailyPayment: string = '0';

  totalPerfomance: number = 0;
  linkPaths: string[] = [
    '/pay-today',
    '/paid-date',
    '/lending-date',
    '/not-paid',
  ];
  summary: string[] = [
    'Clients & Jour De Paiement',
    'Retracer Les Paiements',
    'Retracer Les Emprunts ',
    "N'ont pas Payé",
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/calendar.png',
    '../../../assets/img/audit.png',
    '../../../assets/img/lending-date.png',
    '../../../assets/img/payment-method.png',
  ];

  today = this.time.todaysDateMonthDayYear();
  summaryContent: string[] = [];
  initalizeInputs() {}
}
