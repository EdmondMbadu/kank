import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-today-card-central',
  templateUrl: './today-card-central.component.html',
  styleUrls: ['./today-card-central.component.css'],
})
export class TodayCardCentralComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
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
  dailyCardPayments: string = '0';
  dailyCardReturns: string = '0';
  dailyCardBenefits: string = '0';

  linkPaths: string[] = ['/client-info-card', '/client-info-card'];
  summary: string[] = [
    'Paiement Carte Du Jour',
    'Retrait Carte Du Jour',
    'Benefice Carte Du Jour',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
    '../../../assets/img/daily-reimbursement.png',
  ];

  today: string = this.time.todaysDateMonthDayYear();
  summaryContent: string[] = [];
  initalizeInputs() {
    this.dailyCardPayments = this.compute
      .findTodayTotalResultsGivenField(this.allUsers, 'dailyCardPayments')
      .toString();
    this.dailyCardReturns = this.compute
      .findTodayTotalResultsGivenField(this.allUsers, 'dailyCardReturns')
      .toString();
    this.dailyCardBenefits = this.compute
      .findTodayTotalResultsGivenField(this.allUsers, 'dailyCardBenefits')
      .toString();
    this.dailyCardPayments =
      this.dailyCardPayments === undefined ? '0' : this.dailyCardPayments;
    this.dailyCardReturns =
      this.dailyCardReturns === undefined ? '0' : this.dailyCardReturns;
    this.dailyCardBenefits =
      this.dailyCardBenefits === undefined ? '0' : this.dailyCardBenefits;
    this.summaryContent = [
      ` ${this.dailyCardPayments}`,
      ` ${this.dailyCardReturns}`,
      ` ${this.dailyCardBenefits}`,
    ];

    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailyCardPayments
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyCardReturns)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailyCardBenefits
      )}`,
    ];
  }
}
