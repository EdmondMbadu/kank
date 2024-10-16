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
  ngOnInit() {}
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
  memberShipFee: string = '0';
  savings: string = '0';
  loanAmount: string = '0';
  agent: string = '';
  payRange: string = '';
  interestRate: string = '';
  amountToPay: string = '0';
  debtCycleStartDate: string = '';
  debtCycleEndDate: string = '';
  paymentDay: string = '';

  applicationFeeOtherDisplay: boolean = false;
  memberShipFeeOtherDisplay: boolean = false;
  savingsOtherDisplay: boolean = false;
  loanAmountOtherDisplay: boolean = false;

  async addNewClient() {
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
      this.bussinessCapital === '' ||
      this.homeAddress === '' ||
      this.phoneNumber === '' ||
      this.applicactionFee === '' ||
      this.memberShipFee === '' ||
      this.savings === '' ||
      this.loanAmount === ''
      // this.payRange === '' ||
      // this.debtCycleStartDate === '' ||
      // this.debtCycleEndDate === '' ||
      // this.interestRate === '' ||
      // this.amountToPay === '' ||
      // this.paymentDay === '' ||
      // this.agent === ''
    ) {
      alert('Completer tous les données');
      return;
    } else if (!inputValid) {
      alert(
        'Assurez-vous que tous les nombres sont valides et supérieurs ou égaux à 0'
      );
      return;
    } else if (Number(this.applicactionFee) < 5000) {
      alert(
        'Assurez-vous que le montant du dossier est supérieur ou égal à 5000 FC'
      );
      return;
    } else if (Number(this.savings) <= 0) {
      alert(
        "Assurez-vous que le montant de l'epargnes est plus grand que 0 FC"
      );
      return;
    } else {
      let conf = confirm(
        `Vous allez enrgistré  ${this.firstName} ${this.middleName} ${this.lastName} avec un epargne de ${this.savings} FC. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      this.setNewClientValues();

      try {
        await this.auth.addNewClient(this.client);
        await this.data.updateUserInfoForNewClient(this.client, date);
        console.log('Informations utilisateur mises à jour avec succès');
        this.router.navigate(['client-info-savings']);
      } catch (error) {
        console.error('Error:', error);
        alert("Quelque chose s'est mal passé. Reessayez");
      }
      // .then(() => {
      //   if (this.auth.clientId !== undefined) {
      //     employee?.clients?.push(this.auth.clientId);
      //     console.log(
      //       'entering here, agent clients after update',
      //       employee!.clients
      //     );
      //   }
      //   this.data.updateEmployeeInfoForClientAgentAssignment(employee!);
      // })
      // .then(() => {
      //   this.performance.updateUserPerformance(this.client);
      // });

      this.resetFields();
      return;
    }
  }

  displayApplicationFeeOtherAmount() {
    if (this.applicactionFee === 'Autre Montant') {
      this.applicationFeeOtherDisplay = true;
      this.applicactionFee = '';
    } else {
      this.applicationFeeOtherDisplay = false;
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
    this.client.applicationFeePayments = {
      [this.time.todaysDate()]: this.applicactionFee,
    };
    this.client.membershipFeePayments = {
      [this.time.todaysDate()]: this.memberShipFee,
    };
  }
}
