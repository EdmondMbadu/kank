import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';

@Component({
  selector: 'app-transform-register-client',
  templateUrl: './transform-register-client.component.html',
  styleUrls: ['./transform-register-client.component.css'],
})
export class TransformRegisterClientComponent implements OnInit {
  rateDisplay: boolean = false;
  id: any = '';
  employees: Employee[] = [];
  amountToPayDisplay: boolean = false;
  debtCycleDisplay: boolean = false;
  client = new Client();

  loanAmount: string = '';
  payRange: string = '';

  interestRate: string = '';
  amountToPay: string = '';
  debtCycleStartDate: string = '';
  debtCycleEndDate: string = '';
  allClients: Client[] = [];

  applicationFeeOtherDisplay: boolean = false;
  memberShipFeeOtherDisplay: boolean = false;
  savingsOtherDisplay: boolean = false;
  loanAmountOtherDisplay: boolean = false;
  clientsWithDebts: Client[] = [];
  agentClientMap: any = {};
  maxLoanAmount: number = 0;
  maxNumberOfClients: number = 0;
  numberOfCurrentClients = 0;

  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private data: DataService,
    private router: Router,
    private time: TimeService,
    private performance: PerformanceService,
    private compute: ComputationService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClient();
    this.retrieveEmployees();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.allClients = data;
      this.client = data[Number(this.id)];
      this.maxNumberOfClients = Number(this.auth.currentUser.maxNumberOfClients)
        ? Number(this.auth.currentUser.maxNumberOfClients)
        : this.data.generalMaxNumberOfClients;
      this.clientsWithDebts = this.data.findClientsWithDebts(data);
      this.numberOfCurrentClients = this.clientsWithDebts.length;

      this.client.debtCycle =
        this.client.debtCycle === undefined || this.client.debtCycle === '0'
          ? '1'
          : this.client.debtCycle;
      this.findClientsWithDebts();
      if (this.client.loanAmount != undefined) {
        this.loanAmount = this.client.loanAmount;
      }
      // get credit score to find maxLoanAmount
      if (this.client && this.client.creditScore !== undefined) {
        this.maxLoanAmount = this.compute.getMaxLendAmount(
          Number(this.client.creditScore)
        );
      } else {
        this.maxLoanAmount = 400000;
        console.error('Client or credit score is undefined');
      }
    });
  }

  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
    });
  }

  displayLoanOtherAmount() {
    if (this.loanAmount === 'Autre Montant') {
      this.loanAmountOtherDisplay = true;
      this.loanAmount = '';
    } else {
      this.loanAmountOtherDisplay = false;
    }
  }

  initiateClientNewDebtCycle() {
    let inputValid = this.data.numbersValid(this.loanAmount);
    if (
      this.loanAmount === '' ||
      this.amountToPay === '' ||
      this.interestRate === '' ||
      this.payRange === '' ||
      this.debtCycleStartDate === '' ||
      this.debtCycleEndDate === '' ||
      this.client.agent === ''
    ) {
      alert('Completer tous les données');
      return;
    } else if (!inputValid) {
      alert(
        'Assurez-vous que tous les nombres sont valides et supérieurs ou égaux à 0'
      );
      return;
    } else if (this.client.agent === 'Choose') {
      alert('Assurez-vous que vous avez choisis un Agent.');
      return;
    } else if (
      Number(this.loanAmount) > Number(this.auth.currentUser.monthBudget) &&
      Number(this.client.creditScore) < 70
    ) {
      alert(
        `vous n'avez pas assez d'argent dans votre budget mensuel de prêt pour effectuer cette transaction. Votre budget restant est de ${this.auth.currentUser.monthBudget} FC`
      );
      return;
    } else if (
      this.client.profilePicture === undefined ||
      this.client.profilePicture === null
    ) {
      alert('Veuillez ajouter une photo de profil du client pour continuer');
      return;
    } else if (this.maxLoanAmount < Number(this.loanAmount)) {
      alert(
        `Le montant maximum que vous pouvez emprunter est de ${this.maxLoanAmount} FC par rapport avec votre score credit. Reduisez votre montant de prêt`
      );
      return;
    } else if (this.numberOfCurrentClients >= this.maxNumberOfClients) {
      alert(
        `Vous avez depassez la limite de clients autorisez. La limite est de ${
          this.maxNumberOfClients
        } clients. Vous devez enlever ${
          this.numberOfCurrentClients - this.maxNumberOfClients + 1
        } clients avant d'ajouter.`
      );
      return;
    } else {
      let conf = confirm(
        `Vous allez emprunté ${this.loanAmount} FC a ${this.client.firstName} ${this.client.middleName} ${this.client.lastName}. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      this.setClientNewDebtCycleValues();
      let employee = this.findAgentWithId(this.client.agent!);

      this.data
        .transformRegisterClientToFullClient(this.client)

        .then(
          (res: any) => {
            this.router.navigate(['/client-portal/' + this.id]);
          },
          (err: any) => {
            alert(
              "Quelque chose s'est mal passé. Impossible de proceder avec le nouveau cycle!"
            );
          }
        )
        .then(() => {
          if (this.client.uid !== undefined && employee !== null) {
            employee?.clients?.push(this.client.uid);
            employee.clients = employee?.clients!.filter(
              (item, index) => employee!.clients!.indexOf(item) === index
            );
          }
          this.data.updateEmployeeInfoForClientAgentAssignment(employee!);
        });
      // this probably redundant, but it works. I did not want to reqwrite the logic clean.
      // It probably needs to be rewrritten for a clean flow.
      // .then(() => {
      //   try {
      //     this.findClientsWithDebts();
      //     this.resetClientsAndEmployees();
      //   } catch (error) {
      //     console.log(
      //       'An error ocurred while resetting the data for employees',
      //       error
      //     );
      //   }
      // });

      let date = this.time.todaysDateMonthDayYear();
      this.data
        .updateUserInforForRegisterClientToFullClient(this.client, date)
        .then(
          (res: any) => {
            console.log('Informations utilisateur mises à jour avec succès');
          },

          (err: any) => {
            alert(
              "Quelque chose s'est mal passé. Impossible de proceder avec le nouveau cycle!"
            );
          }
        );

      this.resetFields();
      return;
    }
  }

  findClientsWithDebts() {
    this.clientsWithDebts = this.data.findClientsWithDebts(this.allClients);
    this.agentClientMap = this.getAgentsWithClients();
    // console.log(' all clients with debts', this.clientsWithDebts);
    console.log('agent with clients table', this.agentClientMap);
  }

  async resetClientsAndEmployees() {
    try {
      let reset = await this.data.updateEmployeeInfoBulk(this.agentClientMap);
    } catch (error) {
      console.log(
        'An error occured while reseting employees info in bulk',
        error
      );
    }
  }
  getAgentsWithClients() {
    const agentClientMap: any = {};

    this.clientsWithDebts.forEach((client) => {
      const agent = client.agent;
      const uid = client.uid;

      // If the agent is not in the dictionary, add it with an empty array
      if (!agentClientMap[agent!]) {
        agentClientMap[agent!] = [];
      }

      // Add the client's UID to the agent's list
      agentClientMap[agent!].push(uid);
    });

    return agentClientMap;
  }

  findAgentWithId(id: string) {
    for (let em of this.employees) {
      if (em.uid === id) {
        return em;
      }
    }
    return null;
  }
  displayRate() {
    if (this.payRange === '' || this.loanAmount === '') {
      return;
    }
    this.rateDisplay = true;
    if (this.payRange == '8') {
      this.interestRate = '40';
    } else {
      this.interestRate = '20';
    }
    this.amountToPay = this.data.computeAmountToPay(
      this.interestRate,
      this.loanAmount
    );

    let result = this.time.computeDateRange();
    this.debtCycleStartDate = result[0];
    if (this.payRange == '4') {
      this.debtCycleEndDate = this.time.getDateInFiveWeeks(result[0]);
    } else if (this.payRange == '8') {
      this.debtCycleEndDate = this.time.getDateInNineWeeks(result[0]);
    }

    // this.debtCycleStartDate = result[0];
    // this.debtCycleEndDate = this.time.getDateInNineWeeks(result[0]);
    this.amountToPayDisplay = true;
    this.debtCycleDisplay = true;
  }

  resetFields() {
    this.payRange = '';
    this.debtCycleStartDate = '';
    this.debtCycleEndDate = '';

    this.loanAmount = '';
    this.amountToPay = '';
    this.interestRate = '';
  }
  setClientNewDebtCycleValues() {
    this.client.debtCycle =
      this.client.debtCycle === undefined ? '1' : this.client.debtCycle;
    this.client.amountToPay = this.amountToPay;
    this.client.loanAmount = this.loanAmount;
    this.client.paymentPeriodRange = this.payRange;
    this.client.debtCycleStartDate = this.debtCycleStartDate;
    this.client.debtCycleEndDate = this.debtCycleEndDate;
    this.client.interestRate = this.interestRate;
  }
}
