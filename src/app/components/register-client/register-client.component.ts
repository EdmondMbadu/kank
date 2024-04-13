import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-register-client',
  templateUrl: './register-client.component.html',
  styleUrls: ['./register-client.component.css'],
})
export class RegisterClientComponent implements OnInit {
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
  memberShipFee: string = '';
  savings: string = '';

  applicationFeeOtherDisplay: boolean = false;
  memberShipFeeOtherDisplay: boolean = false;
  savingsOtherDisplay: boolean = false;

  addNewClient() {
    let date = this.time.todaysDateMonthDayYear();
    let inputValid = this.data.numbersValid(
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
      this.savings === ''
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
        `Vous allez enregistré ${this.firstName} ${this.middleName} ${this.lastName}. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      this.setNewClientValues();
      // let employee = this.findAgentWithId(this.client.agent!);
      this.auth.registerNewClient(this.client).then(
        (res: any) => {
          this.router.navigate(['info-register']);
        },
        (err: any) => {
          alert(
            "Quelque chose s'est mal passé. Impossible d'ajouter un nouveau client!"
          );
        }
      );
      this.data.updateUserInfoForRegisterClient(this.client, date).then(
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
  }
  setNewClientValues() {
    this.client.firstName = this.firstName;
    this.client.lastName = this.lastName;
    this.client.middleName = this.middleName;
    this.client.profession = this.profession;
    this.client.businessCapital = this.bussinessCapital;
    this.client.businessAddress = this.businessAddress;
    this.client.phoneNumber = this.phoneNumber;
    this.client.homeAddress = this.homeAddress;
    this.client.applicationFee = this.applicactionFee;
    this.client.membershipFee = this.memberShipFee;
    this.client.savings = this.savings;
    this.client.savingsPayments = { [this.time.todaysDate()]: this.savings };
  }
}
