import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Card } from 'src/app/models/card';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-summary-card-central',
  templateUrl: './summary-card-central.component.html',
  styleUrls: ['./summary-card-central.component.css'],
})
export class SummaryCardCentralComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}
  allUsers: User[] = [];
  allClientsCard?: Card[];
  ngOnInit(): void {
    this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      this.getAllClientsCard();
    });
  }

  getAllClientsCard() {
    // Temporary array to hold all fetched clients before filtering
    let tempClients: Card[] = [];
    this.allClientsCard = [];

    // Counter to keep track of completed requests
    let completedRequests = 0;

    this.allUsers.forEach((user) => {
      this.auth.getClientsCardOfAUser(user.uid!).subscribe((clients) => {
        // Concatenate all clients into the temporary array
        tempClients = tempClients.concat(clients);

        // Increment counter to track completed requests
        completedRequests++;

        // Once all requests are completed, proceed to filter and initialize inputs
        if (completedRequests === this.allUsers.length) {
          // Now tempClients contains all clients, but there may be duplicates
          this.filterAndInitializeClientsCard(tempClients);
        }
      });
    });
  }
  filterAndInitializeClientsCard(allClients: Card[]) {
    // Use a Map or Set to ensure uniqueness. Here, a Map is used to easily access clients by their ID.
    let uniqueClients = new Map<string, Card>();
    this.allClientsCard = [];
    allClients.forEach((client) => {
      // Assuming client.id is the unique identifier
      if (!uniqueClients.has(client.uid!)) {
        uniqueClients.set(client.uid!, client);
      }
    });

    // Convert the Map values back to an array for further processing
    this.allClientsCard = Array.from(uniqueClients.values());

    // Now, this.currentClients contains unique clients. Proceed with initialization.
    this.initalizeInputs(); // Adjust this method as needed
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
    'Carte Clients Total Central',
    'Carte Clients Actuel Central',
    // 'Argent De Carte En Main',
    'Epargne Carte Central',
  ];
  summaryContent: string[] = [];
  sContent: string[] = [];
  initalizeInputs() {
    this.currentClientsCard = [];

    let actual = this.findCurrentClientsCard();
    console;
    let total =
      this.allClientsCard?.length === undefined
        ? '0'
        : this.allClientsCard?.length;
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
    this.allClientsCard?.forEach((client) => {
      if (client.clientCardStatus !== 'ended') {
        this.currentClientsCard!.push(client);
      }
    });
    return this.currentClientsCard?.length;
  }

  findMoneyToReturnToClients() {
    let total = 0;
    this.currentClientsCard.forEach((client) => {
      total += Number(client.amountPaid) - Number(client.amountToPay);
    });
    return total;
  }
}
