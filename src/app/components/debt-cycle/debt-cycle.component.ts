import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-debt-cycle',
  templateUrl: './debt-cycle.component.html',
  styleUrls: ['./debt-cycle.component.css'],
})
export class DebtCycleComponent implements OnInit {
  rateDisplay: boolean = false;
  id: any = '';
  amountToPayDisplay: boolean = false;
  debtCycleDisplay: boolean = false;
  client = new Client();
  applicationFee: string = '';
  memberShipFee: string = '';
  savings: string = '';
  loanAmount: string = '';
  payRange: string = '';
  interestRate: string = '';
  amountToPay: string = '';
  debtCycleStartDate: string = '';
  debtCycleEndDate: string = '';

  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private data: DataService,
    private router: Router,
    private time: TimeService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
    console.log('current id', this.id);
  }
  ngOnInit(): void {
    this.retrieveClient();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
    });
  }

  initiateClientNewDebtCycle() {
    console.log(
      'fees m a, loan amount, savings',
      this.client.membershipFee,
      this.client.applicationFee,
      this.client.savings
    );
    if (
      this.loanAmount === '' ||
      this.applicationFee === '' ||
      this.memberShipFee === '' ||
      this.savings === '' ||
      this.amountToPay === '' ||
      this.interestRate === '' ||
      this.payRange === '' ||
      this.debtCycleStartDate === '' ||
      this.debtCycleEndDate === ''
    ) {
      alert('All fields are required');
      return;
    } else {
      this.setClientNewDebtCycleValues();
      this.data.initiateNewDebtCycle(this.client).then(
        (res: any) => {
          this.router.navigate(['/client-portal/' + this.id]);
        },
        (err: any) => {
          alert('Something went wrong. Unable to add New client');
        }
      );
      let date = this.time.todaysDateMonthDayYear();
      this.data
        .updateUserInfoForClientNewDebtCycle(this.client, this.savings, date)
        .then(
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

  resetFields() {
    this.payRange = '';
    this.debtCycleStartDate = '';
    this.debtCycleEndDate = '';
    this.applicationFee = '';
    this.memberShipFee = '';
    this.savings = '';
    this.loanAmount = '';
    this.amountToPay = '';
    this.interestRate = '';
  }
  setClientNewDebtCycleValues() {
    this.client.savings = (
      Number(this.client.savings) + Number(this.savings)
    ).toString();
    this.client.applicationFee = this.applicationFee;
    this.client.membershipFee = this.memberShipFee;
    this.client.amountToPay = this.amountToPay;
    this.client.loanAmount = this.loanAmount;
    this.client.paymentPeriodRange = this.payRange;
    this.client.debtCycleStartDate = this.debtCycleStartDate;
    this.client.debtCycleEndDate = this.debtCycleEndDate;
    this.client.interestRate = this.interestRate;
  }
}
