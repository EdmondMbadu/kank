import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Card } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-summary-card',
  templateUrl: './summary-card.component.html',
  styleUrls: ['./summary-card.component.css'],
})
export class SummaryCardComponent implements OnInit {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}
  ngOnInit() {
    this.retrieveClientsCard();
  }
  valuesConvertedToDollars: string[] = [];

  clientsCard: Card[] = [];
  currentClientsCard: Card[] = [];

  elements: number = 10;

  linkPath: string[] = [
    '/client-info-card',
    '/client-info-card',
    // '/client-info-card',
    '/client-info-card',
  ];
  imagePaths: string[] = [
    '../../../assets/img/people.svg',
    '../../../assets/img/people.svg',
    // '../../../assets/img/invest.svg',
    '../../../assets/img/debt.png',
  ];

  summary: string[] = [
    'Carte Clients Total',
    'Carte Clients Actuel',
    // 'Argent De Carte En Main',
    'Epargne Carte',
  ];
  summaryContent: string[] = [];
  sContent: string[] = [];
  initalizeInputs() {
    this.currentClientsCard = [];

    let actual = this.findCurrentClientsCard();
    let total =
      this.auth.currentUser.numberOfCardClients === undefined
        ? '0'
        : this.auth.currentUser.numberOfCardClients;
    let clientCardSavings = this.findMoneyToReturnToClients();

    this.summaryContent = [`${total}`, `${actual}`, `${clientCardSavings}`];

    this.valuesConvertedToDollars = [
      ``,
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(
        clientCardSavings.toString()
      )}`,
    ];
  }
  findCurrentClientsCard() {
    this.clientsCard?.forEach((client) => {
      if (client.clientCardStatus !== 'ended') {
        this.currentClientsCard!.push(client);
      }
    });
    return this.currentClientsCard?.length;
  }

  retrieveClientsCard(): void {
    this.auth.getAllClientsCard().subscribe((data: any) => {
      this.clientsCard = data;
      this.initalizeInputs();
    });
  }

  findMoneyToReturnToClients() {
    let total = 0;
    this.currentClientsCard.forEach((client) => {
      total += Number(client.amountPaid) - Number(client.amountToPay);
    });
    return total;
  }
}
