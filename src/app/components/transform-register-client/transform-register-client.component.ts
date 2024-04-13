import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

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
    } else {
      let conf = confirm(
        `Vous allez emprunté ${this.loanAmount} FC a ${this.client.firstName} ${this.client.middleName} ${this.client.lastName}. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      this.setClientNewDebtCycleValues();
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
          this.performance
            .updateUserPerformance(this.client)
            .then((res: any) => {
              console.log('updated user info performance');
            })
            .catch((err: any) => {
              console.log('error while updating performance');
            });
        });

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
    this.debtCycleEndDate = result[1];
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
    this.client.amountToPay = this.amountToPay;
    this.client.loanAmount = this.loanAmount;
    this.client.paymentPeriodRange = this.payRange;
    this.client.debtCycleStartDate = this.debtCycleStartDate;
    this.client.debtCycleEndDate = this.debtCycleEndDate;
    this.client.interestRate = this.interestRate;
  }
}
