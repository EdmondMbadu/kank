import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, take } from 'rxjs';
import { Client } from 'src/app/models/client';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { DataService } from 'src/app/services/data.service';

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
    private compute: ComputationService,
    private data: DataService
  ) {}
  isFetchingClients = false;
  currentClients: Array<Client[]> = [];
  allUsers: User[] = [];
  ngOnInit(): void {
    this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      // this is really weird. maybe some apsect of angular. but it works for now
      if (this.allUsers.length > 1) this.getAllClients();
    });
  }

  allClients?: Client[];
  allCurrentClients?: Client[] = [];
  allClientsWithoutDebtsButWithSavings?: Client[] = [];
  savingsWithoutDebtsButWithSavings: number = 0;
  valuesConvertedToDollars: string[] = [];

  getAllClients() {
    if (this.isFetchingClients) return;
    this.isFetchingClients = true;

    let tempClients: Client[] = [];
    this.allClients = [];
    let completedRequests = 0;
    this.allUsers.forEach((user) => {
      this.auth.getClientsOfAUser(user.uid!).subscribe((clients) => {
        tempClients = tempClients.concat(clients);
        completedRequests++;
        if (completedRequests === this.allUsers.length) {
          this.filterAndInitializeClients(tempClients);
          this.isFetchingClients = false;
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
    '/client-info-current',
  ];
  imagePaths: string[] = [
    '../../../assets/img/people.svg',
    '../../../assets/img/people.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/debt.png',
    '../../../assets/img/total-income.png',
    '../../../assets/img/saving.svg',
  ];

  summary: string[] = [
    'Nombres des Clients Total',
    'Nombres des Clients Actuel',
    'Clients Epargnes Sans Credit',
    'Argent Investi',
    'Prêt Restant',

    "Chiffre D'Affaire",
    'Montant Epargnes Sans Credit',
  ];
  summaryContent: string[] = [];
  sContent: string[] = [];

  initalizeInputs() {
    this.findClientsWithoutDebtsButWithSavings();
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
      `${this.findClientsWithoutDebtsButWithSavings()}`,
      ` ${invested}`,
      ` ${debtTotal}`,

      `${totalIncome}`,
      `${this.savingsWithoutDebtsButWithSavings.toString()}`,
    ];

    this.valuesConvertedToDollars = [
      ``,
      ``,
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(invested)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(debtTotal)}`,

      `${this.compute.convertCongoleseFrancToUsDollars(totalIncome)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.savingsWithoutDebtsButWithSavings!.toString()
      )}`,
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
    this.allCurrentClients = this.data.findClientsWithDebts(this.allClients!);
    return this.allCurrentClients?.length;
  }

  // find clients with debts =0 and savings > 10
  findClientsWithoutDebtsButWithSavings() {
    this.savingsWithoutDebtsButWithSavings = 0;
    let total = 0;
    this.allClientsWithoutDebtsButWithSavings = [];
    this.allClients?.forEach((client) => {
      if (Number(client.debtLeft) === 0 && Number(client.savings) > 0) {
        total += Number(client.savings);
        this.allClientsWithoutDebtsButWithSavings!.push(client);
      }
    });
    this.savingsWithoutDebtsButWithSavings = total;
    return this.allClientsWithoutDebtsButWithSavings?.length;
  }
}
