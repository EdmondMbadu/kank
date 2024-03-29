import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-home-central',
  templateUrl: './home-central.component.html',
  styleUrls: ['./home-central.component.css'],
})
export class HomeCentralComponent implements OnInit {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}

  currentClients: Array<Client[]> = [];
  allUsers: User[] = [];
  ngOnInit(): void {
    this.allClients = [];
    if (this.auth.isAdmin) {
      this.auth.getAllUsersInfo().subscribe((data) => {
        this.allUsers = data;
        this.getAllClients();
      });
    }
  }
  allClients?: Client[];
  allCurrentClients?: Client[] = [];
  valuesConvertedToDollars: string[] = [];

  elements: number = 10;

  getAllClients() {
    // Temporary array to hold all fetched clients before filtering
    let tempClients: Client[] = [];
    this.allClients = [];

    // Counter to keep track of completed requests
    let completedRequests = 0;

    this.allUsers.forEach((user) => {
      this.auth.getClientsOfAUser(user.uid!).subscribe((clients) => {
        // Concatenate all clients into the temporary array
        tempClients = tempClients.concat(clients);

        // Increment counter to track completed requests
        completedRequests++;

        // Once all requests are completed, proceed to filter and initialize inputs
        if (completedRequests === this.allUsers.length) {
          // Now tempClients contains all clients, but there may be duplicates
          this.filterAndInitializeClients(tempClients);
        }
      });
    });
  }
  filterAndInitializeClients(allClients: Client[]) {
    // Use a Map or Set to ensure uniqueness. Here, a Map is used to easily access clients by their ID.
    let uniqueClients = new Map<string, Client>();
    this.allClients = [];
    allClients.forEach((client) => {
      // Assuming client.id is the unique identifier
      if (!uniqueClients.has(client.uid!)) {
        uniqueClients.set(client.uid!, client);
      }
    });

    // Convert the Map values back to an array for further processing
    this.allClients = Array.from(uniqueClients.values());

    // Now, this.currentClients contains unique clients. Proceed with initialization.
    this.initalizeInputs(); // Adjust this method as needed
  }

  linkPath: string[] = [
    '/client-info',
    '/client-info-current',
    '/add-investment',
    '/client-info-current',
    '/client-info-current',
  ];
  imagePaths: string[] = [
    '../../../assets/img/people.svg',
    '../../../assets/img/people.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/debt.png',
    '../../../assets/img/total-income.png',
  ];

  summary: string[] = [
    'Nombres des Clients Total',
    'Nombres des Clients Actuel',
    'Argent Investi',
    'Prêt Restant',

    "Chiffre D'Affaire",
  ];
  summaryContent: string[] = [];
  sContent: string[] = [];

  initalizeInputs() {
    let reserve = this.compute
      .findTotalAllUsersGivenField(this.allUsers, 'reserveAmount')
      .toString();
    let moneyHand = this.compute
      .findTotalAllUsersGivenField(this.allUsers, 'moneyInHands')
      .toString();
    let invested = this.compute
      .findTotalAllUsersGivenField(this.allUsers, 'amountInvested')
      .toString();
    let debtTotal = this.compute
      .findTotalAllUsersGivenField(this.allUsers, 'totalDebtLeft')
      .toString();
    let cardM = this.compute
      .findTotalAllUsersGivenField(this.allUsers, 'cardsMoney')
      .toString();
    // this.currentClients = [];
    let realBenefit = (Number(debtTotal) - Number(invested)).toString();
    let totalIncome = (
      Number(reserve) +
      Number(moneyHand) +
      Number(debtTotal) +
      Number(cardM)
    ).toString();
    this.summaryContent = [
      `${this.findNumberOfAllClients()}`,
      `${this.findClientsWithDebts()}`,
      ` ${invested}`,
      ` ${debtTotal}`,

      `${totalIncome}`,
    ];

    this.valuesConvertedToDollars = [
      ``,
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(invested)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(debtTotal)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(totalIncome)}`,
    ];
  }
  findNumberOfAllClients() {
    let total = 0;
    this.allUsers.forEach((user) => {
      total += Number(user.numberOfClients);
    });

    return total;
  }

  findClientsWithDebts() {
    this.allClients?.forEach((client) => {
      if (Number(client.debtLeft) > 0) {
        this.allCurrentClients!.push(client);
      }
    });
    return this.allCurrentClients?.length;
  }
}
