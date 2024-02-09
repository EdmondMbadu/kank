import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-new-client',
  templateUrl: './new-client.component.html',
  styleUrls: ['./new-client.component.css'],
})
export class NewClientComponent implements OnInit {
  constructor(
    private router: Router,
    public auth: AuthService,
    public data: DataService,
    private time: TimeService,
    private performance: PerformanceService
  ) {}
  ngOnInit() {
    this.retrieveEmployees();
  }
  employees: Employee[] = [];
  rateDisplay: boolean = false;
  amountToPayDisplay: boolean = false;
  debtCycleDisplay: boolean = false;
  client = new Client();
  firstName: string = '';
  lastName: string = '';
  middleName: string = '';
  profession: string = '';
  bussinessCapital: string = '';
  homeAddress: string = '';
  businessAddress: string = '';
  phoneNumber: string = '';
  applicactionFee: string = '';
  memberShipFee: string = '';
  savings: string = '';
  loanAmount: string = '';
  agent: string = '';
  payRange: string = '';
  interestRate: string = '';
  amountToPay: string = '';
  debtCycleStartDate: string = '';
  debtCycleEndDate: string = '';
  paymentDay: string = '';

  applicationFeeOtherDisplay: boolean = false;
  memberShipFeeOtherDisplay: boolean = false;
  savingsOtherDisplay: boolean = false;
  loanAmountOtherDisplay: boolean = false;

  addNewClient() {
    let date = this.time.todaysDateMonthDayYear();
    let inputValid = this.data.numbersValid(
      this.loanAmount,
      this.savings,
      this.applicactionFee,
      this.memberShipFee
    );
    if (
      this.firstName === '' ||
      this.lastName === '' ||
      this.middleName === '' ||
      this.profession === '' ||
      this.businessAddress === '' ||
      this.agent === '' ||
      this.bussinessCapital === '' ||
      this.homeAddress === '' ||
      this.phoneNumber === '' ||
      this.applicactionFee === '' ||
      this.memberShipFee === '' ||
      this.savings === '' ||
      this.loanAmount === '' ||
      this.payRange === '' ||
      this.debtCycleStartDate === '' ||
      this.debtCycleEndDate === '' ||
      this.interestRate === '' ||
      this.amountToPay === '' ||
      this.paymentDay === ''
    ) {
      alert('Completer tous les données');
      return;
    } else if (!inputValid) {
      alert(
        'Assurez-vous que tous les nombres sont valides et supérieurs ou égaux à 0'
      );
      return;
    } else {
      let conf = confirm(
        `Vous allez emprunté ${this.loanAmount} FC a ${this.firstName} ${this.middleName} ${this.lastName}. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      this.setNewClientValues();
      let employee = this.findAgentWithId(this.client.agent!);
      this.auth.addNewClient(this.client).then(
        (res: any) => {
          this.router.navigate(['client-info']);
        },
        (err: any) => {
          alert(
            "Quelque chose s'est mal passé. Impossible d'ajouter un nouveau client!"
          );
        }
      );
      this.data
        .updateUserInfoForNewClient(this.client, date)
        .then(
          (res: any) => {
            console.log('Informations utilisateur mises à jour avec succès');
          },
          (err: any) => {
            alert(
              "Quelque chose s'est mal passé. Impossible d'ajouter un nouveau client"
            );
          }
        )
        .then(() => {
          if (this.auth.clientId !== undefined) {
            employee?.clients?.push(this.auth.clientId);
            console.log(
              'entering here, agent clients after update',
              employee!.clients
            );
          }
          this.data.updateEmployeeInfoForClientAgentAssignment(employee!);
        })
        .then(() => {
          this.performance.updateUserPerformance(this.client);
        });

      this.resetFields();
      return;
    }
  }
  findAgentWithId(id: string) {
    for (let em of this.employees) {
      if (em.uid === id) {
        return em;
      }
    }
    return null;
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
    });
  }
  updateAgentClients(agent: Employee) {
    console.log('printing it here', agent.clients!.includes(this.client.uid!));
    console.log('here is the client', this.client);
    if (this.client!.agent !== undefined) {
      agent?.clients?.push(this.client.uid!);
      console.log('entering here, agent clients now', agent.clients);
    }
    return agent;
  }
  displayApplicationFeeOtherAmount() {
    if (this.applicactionFee === 'Autre Montant') {
      this.applicationFeeOtherDisplay = true;
      this.applicactionFee = '';
    } else {
      this.applicationFeeOtherDisplay = false;
    }
  }
  displaymemberShipFeeOtherAmount() {
    if (this.memberShipFee === 'Autre Montant') {
      this.memberShipFeeOtherDisplay = true;
      this.memberShipFee = '';
    } else {
      this.memberShipFeeOtherDisplay = false;
    }
  }
  displaySavingsOtherAmount() {
    if (this.savings === 'Autre Montant') {
      this.savingsOtherDisplay = true;
      this.savings = '';
    } else {
      this.savingsOtherDisplay = false;
    }
  }

  displayLoanOtherAmount() {
    if (this.loanAmount === 'Autre Montant') {
      this.loanAmountOtherDisplay = true;
      this.loanAmount = '';
    } else {
      this.loanAmountOtherDisplay = false;
    }
  }

  resetFields() {
    this.client = new Client();
    this.firstName = '';
    this.lastName = '';
    this.middleName = '';
    this.profession = '';
    this.bussinessCapital = '';
    this.homeAddress = '';
    this.businessAddress = '';
    this.phoneNumber = '';
    this.applicactionFee = '';
    this.memberShipFee = '';
    this.savings = '';
    this.loanAmount = '';
    this.payRange = '';
    this.debtCycleStartDate = '';
    this.debtCycleEndDate = '';
    this.interestRate = '';
    this.amountToPay = '';
    this.paymentDay = '';
    this.agent = '';
  }
  setNewClientValues() {
    this.client.firstName = this.firstName;
    this.client.lastName = this.lastName;
    this.client.middleName = this.middleName;
    this.client.profession = this.profession;
    this.client.businessCapital = this.bussinessCapital;
    this.client.businessAddress = this.businessAddress;
    this.client.agent = this.agent;
    this.client.phoneNumber = this.phoneNumber;
    this.client.homeAddress = this.homeAddress;
    this.client.applicationFee = this.applicactionFee;
    this.client.membershipFee = this.memberShipFee;
    this.client.savings = this.savings;
    this.client.savingsPayments = { [this.time.todaysDate()]: this.savings };
    this.client.loanAmount = this.loanAmount;
    this.client.amountToPay = this.amountToPay;
    this.client.interestRate = this.interestRate;
    this.client.paymentPeriodRange = this.payRange;
    this.client.debtCycleStartDate = this.debtCycleStartDate;
    this.client.debtCycleEndDate = this.debtCycleEndDate;
    this.client.debtLeft = this.amountToPay;
    this.client.paymentDay = this.paymentDay;
  }
  displayRate() {
    let result = this.time.computeDateRange();
    if (this.payRange === '' || this.loanAmount === '') {
      return;
    }
    this.rateDisplay = true;
    if (this.payRange == '8') {
      result = this.time.computeDateRange2Months();
      this.interestRate = '40';
    } else {
      this.interestRate = '20';
    }
    this.amountToPay = this.data.computeAmountToPay(
      this.interestRate,
      this.loanAmount
    );

    this.debtCycleStartDate = result[0];
    this.debtCycleEndDate = result[1];
    this.amountToPayDisplay = true;
    this.debtCycleDisplay = true;
  }
}
