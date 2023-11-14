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
  middleName: string = '';
  interestRate: string = '';
  amountToPay: string = '';
  debtCycleStartDate: string = '';
  debtCycleEndDate: string = '';

  applicationFeeOtherDisplay: boolean = false;
  memberShipFeeOtherDisplay: boolean = false;
  savingsOtherDisplay: boolean = false;
  loanAmountOtherDisplay: boolean = false;

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

  displayApplicationFeeOtherAmount() {
    if (this.applicationFee === 'Autre Montant') {
      this.applicationFeeOtherDisplay = true;
      this.applicationFee = '';
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

  initiateClientNewDebtCycle() {
    let inputValid = this.data.numbersValid(
      this.loanAmount,
      this.savings,
      this.applicationFee,
      this.memberShipFee
    );
    if (
      this.loanAmount === '' ||
      this.applicationFee === '' ||
      this.middleName === '' ||
      this.memberShipFee === '' ||
      this.savings === '' ||
      this.amountToPay === '' ||
      this.interestRate === '' ||
      this.payRange === '' ||
      this.debtCycleStartDate === '' ||
      this.debtCycleEndDate === ''
    ) {
      alert('Completer tous les données');
      return;
    } else if (!inputValid) {
      alert(
        'Assurez-vous que tous les nombres sont valides et supérieurs ou égaux à 0'
      );
      return;
    } else {
      this.setClientNewDebtCycleValues();
      this.data.initiateNewDebtCycle(this.client).then(
        (res: any) => {
          this.router.navigate(['/client-portal/' + this.id]);
        },
        (err: any) => {
          alert(
            "Quelque chose s'est mal passé. Impossible de proceder avec le nouveau cycle!"
          );
        }
      );
      let date = this.time.todaysDateMonthDayYear();
      this.data
        .updateUserInfoForClientNewDebtCycle(this.client, this.savings, date)
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
    this.middleName = '';
  }
  setClientNewDebtCycleValues() {
    this.client.savings = (
      Number(this.client.savings) + Number(this.savings)
    ).toString();
    this.client.applicationFee = this.applicationFee;
    this.client.middleName = this.middleName;
    this.client.membershipFee = this.memberShipFee;
    this.client.amountToPay = this.amountToPay;
    this.client.loanAmount = this.loanAmount;
    this.client.paymentPeriodRange = this.payRange;
    this.client.debtCycleStartDate = this.debtCycleStartDate;
    this.client.debtCycleEndDate = this.debtCycleEndDate;
    this.client.interestRate = this.interestRate;
  }
}
