import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
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
    private time: TimeService
  ) {}
  ngOnInit() {}
  rateDisplay: boolean = false;
  amountToPayDisplay: boolean = false;
  debtCycleDisplay: boolean = false;
  client = new Client();
  firstName: string = '';
  lastName: string = '';
  profession: string = '';
  bussinessCapital: string = '';
  homeAddress: string = '';
  businessAddress: string = '';
  phoneNumber: string = '';
  applicactionFee: string = '';
  memberShipFee: string = '';
  savings: string = '';
  loanAmount: string = '';
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
      this.profession === '' ||
      this.businessAddress === '' ||
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
      this.setNewClientValues();
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
      this.data.updateUserInfoForNewClient(this.client, date).then(
        (res: any) => {
          console.log('Informations utilisateur mises à jour avec succès');
        },
        (err: any) => {
          alert(
            "Quelque chose s'est mal passé. Impossible d'ajouter un nouveau client"
          );
        }
      );

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
  }
  setNewClientValues() {
    this.client.firstName = this.firstName;
    this.client.lastName = this.lastName;
    this.client.profession = this.profession;
    this.client.businessCapital = this.bussinessCapital;
    this.client.businessAddress = this.businessAddress;
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
    this.debtCycleEndDate = result[1];
    this.amountToPayDisplay = true;
    this.debtCycleDisplay = true;
  }
}
