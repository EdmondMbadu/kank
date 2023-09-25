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

  applicationFeeOtherDisplay: boolean = false;
  memberShipFeeOtherDisplay: boolean = false;
  savingsOtherDisplay: boolean = false;
  loanAmountOtherDisplay: boolean = false;

  addNewClient() {
    let date = this.time.todaysDateMonthDayYear();
    console.log('firstnmae, loan amount', this.firstName, this.loanAmount);
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
      this.amountToPay === ''
    ) {
      alert('All fields are required');
      return;
    } else {
      this.setNewClientValues();
      this.auth.addNewClient(this.client).then(
        (res: any) => {
          this.router.navigate(['client-info']);
        },
        (err: any) => {
          alert('Something went wrong. Unable to add New client');
        }
      );
      this.data.updateUserInfoForNewClient(this.client, date).then(
        (res: any) => {
          console.log('Updated user info successfully');
        },
        (err: any) => {
          alert('Something went wrong. Unable to add New client');
        }
      );

      this.resetFields();
      return;
    }
  }

  displayApplicationFeeOtherAmount() {
    if (this.applicactionFee === 'Other Amount') {
      this.applicationFeeOtherDisplay = true;
      this.applicactionFee = '';
    } else {
      this.applicationFeeOtherDisplay = false;
    }
  }
  displaymemberShipFeeOtherAmount() {
    if (this.memberShipFee === 'Other Amount') {
      this.memberShipFeeOtherDisplay = true;
      this.memberShipFee = '';
    } else {
      this.memberShipFeeOtherDisplay = false;
    }
  }
  displaySavingsOtherAmount() {
    if (this.savings === 'Other Amount') {
      this.savingsOtherDisplay = true;
      this.savings = '';
    } else {
      this.savingsOtherDisplay = false;
    }
  }

  displayLoanOtherAmount() {
    if (this.loanAmount === 'Other Amount') {
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
