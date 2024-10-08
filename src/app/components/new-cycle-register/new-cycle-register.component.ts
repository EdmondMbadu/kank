import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-new-cycle-register',
  templateUrl: './new-cycle-register.component.html',
  styleUrls: ['./new-cycle-register.component.css'],
})
export class NewCycleRegisterComponent implements OnInit {
  rateDisplay: boolean = false;
  id: any = '';
  employees: Employee[] = [];
  amountToPayDisplay: boolean = false;
  debtCycleDisplay: boolean = false;
  client = new Client();
  applicationFee: string = '';
  memberShipFee: string = '';
  savings: string = '';
  loanAmount: string = '';
  middleName: string = '';
  requestDate: string = '';

  applicationFeeOtherDisplay: boolean = false;
  memberShipFeeOtherDisplay: boolean = false;
  savingsOtherDisplay: boolean = false;
  loanAmountOtherDisplay: boolean = false;

  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private data: DataService,
    private router: Router,
    private time: TimeService,
    private performance: PerformanceService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClient();
    this.retrieveEmployees();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
      this.middleName =
        this.client.middleName !== undefined ? this.client.middleName : '';
    });
  }

  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
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

  registerClientNewDebtCycle() {
    let inputValid = this.data.numbersValid(
      this.loanAmount,
      this.savings,
      this.applicationFee,
      this.memberShipFee
    );
    let checkDate = this.time.validateDateWithInOneWeekNotPastOrToday(
      this.requestDate
    );
    if (
      this.loanAmount === '' ||
      this.applicationFee === '' ||
      this.middleName === '' ||
      this.memberShipFee === '' ||
      this.savings === '' ||
      this.client.agent === '' ||
      this.requestDate === ''
    ) {
      alert('Completer tous les données');
      return;
    } else if (!inputValid) {
      alert(
        'Assurez-vous que tous les nombres sont valides et supérieurs ou égaux à 0'
      );
      return;
    } else if (!checkDate) {
      alert(`Assurez-vous que la date de Donner L'argent au client\n
        - Est Dans L'intervalle D'Une Semaine\n
        - N'est Pas Aujourdhui ou au Passé
        `);
      return;
    } else if (
      Number(this.loanAmount) >
      Number(this.auth.currentUser.monthBudget) -
        Number(this.auth.currentUser.monthBudgetPending)
    ) {
      let diff =
        Number(this.auth.currentUser.monthBudget) -
        Number(this.auth.currentUser.monthBudgetPending);
      alert(
        `vous n'avez pas assez d'argent dans votre budget mensuel de prêt pour effectuer cette transaction. Votre budget restant est de ${diff} FC`
      );
      return;
    } else {
      let conf = confirm(
        `Vous allez enregistré ${this.client.firstName} ${this.client.lastName} pour un nouveau cycle. Voulez-vous quand même continuer?`
      );
      if (!conf) {
        return;
      }
      this.setClientNewDebtCycleValues();

      this.data
        .registerNewDebtCycle(this.client)

        .then(
          (res: any) => {
            this.router.navigate(['/register-portal/' + this.id]);
          },
          (err: any) => {
            alert(
              "Quelque chose s'est mal passé. Impossible de proceder avec le nouveau cycle!"
            );
          }
        );
      // .then(() => {
      //   this.performance
      //     .updateUserPerformance(this.client)
      //     .then((res: any) => {
      //       console.log('updated user info performance');
      //     })
      //     .catch((err: any) => {
      //       console.log('error while updating performance');
      //     });
      // });

      let date = this.time.todaysDateMonthDayYear();
      this.data
        .updateUserInfoForRegisterClientNewDebtCycle(
          this.client,
          this.savings,
          date
        )
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
  findAgentWithId(id: string) {
    for (let em of this.employees) {
      if (em.uid === id) {
        return em;
      }
    }
    return null;
  }

  resetFields() {
    this.applicationFee = '';
    this.memberShipFee = '';
    this.savings = '';
    this.loanAmount = '';
    this.middleName = '';
  }
  setClientNewDebtCycleValues() {
    this.requestDate = this.time.convertDateToMonthDayYear(this.requestDate);
    this.client.previousSavingsPayments = { ...this.client.savingsPayments };
    // I want to keep the whole history of payments.
    this.client.previousPayments = {
      ...this.client.previousPayments,
      ...this.client.payments,
    };
    this.client.savingsPayments = {};

    this.client.savings = (
      Number(this.client.savings) + Number(this.savings)
    ).toString();
    this.client.savingsPayments = { [this.time.todaysDate()]: this.savings };
    this.client.applicationFee = this.applicationFee;
    this.client.middleName = this.middleName;
    this.client.membershipFee = this.memberShipFee;
    this.client.loanAmount = this.loanAmount;
    this.client.requestAmount = this.loanAmount;
    this.client.requestDate = this.requestDate;
    this.client.applicationFeePayments = {
      [this.time.todaysDate()]: this.applicationFee,
    };
    this.client.membershipFeePayments = {
      [this.time.todaysDate()]: this.memberShipFee,
    };
  }
}
