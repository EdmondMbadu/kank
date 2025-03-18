import { Component, OnInit } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { __generator } from 'tslib';

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
  maxLoanAmount: number = 0;
  allClients: Client[] = [];

  code: string = '';
  userEnteredCode: string = '';
  isLoading: boolean = false;
  codeVerificationStatus: 'waiting' | 'correct' | 'incorrect' | null = null;
  blockChangeNumber: boolean = false;

  applicationFeeOtherDisplay: boolean = false;
  memberShipFeeOtherDisplay: boolean = false;
  savingsOtherDisplay: boolean = false;
  loanAmountOtherDisplay: boolean = false;

  maxNumberOfClients: number = 0;
  numberOfCurrentClients = 0;

  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private data: DataService,
    private router: Router,
    private time: TimeService,
    private performance: PerformanceService,
    private compute: ComputationService,
    private fns: AngularFireFunctions
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
      this.numberOfCurrentClients = this.data.findClientsWithDebts(data).length; // clients with debt number
      this.middleName =
        this.client.middleName !== undefined ? this.client.middleName : '';
      this.maxNumberOfClients = Number(this.auth.currentUser.maxNumberOfClients)
        ? Number(this.auth.currentUser.maxNumberOfClients)
        : this.data.generalMaxNumberOfClients;

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
      Number(this.applicationFee) < 5000 &&
      Number(this.memberShipFee) < 5000
    ) {
      alert(
        "Les frais d'inscription ou d'adhesion doit etre minimum 5000 FC pour le nouveau cycle."
      );
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
    } else if (this.maxLoanAmount < Number(this.loanAmount)) {
      alert(
        `Le montant maximum que vous pouvez emprunter est de ${this.maxLoanAmount} FC par rapport avec votre score credit. Reduisez votre montant de prêt`
      );
      return;
    } else if (this.codeVerificationStatus !== 'correct') {
      alert('Veuillez vérifier votre code de vérification');
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
    } else if (this.savingsPaidAtleast10PercentOfLoanAmount() === false) {
      return;
    } else {
      let conf = confirm(
        `Vous allez enregistré ${this.client.firstName} ${this.client.lastName} pour un nouveau cycle. Voulez-vous quand même continuer?`
      );
      if (!conf) {
        return;
      }
      this.setClientNewDebtCycleValues();

      // Save the current cycle to the 'cycles' subcollection
      this.data
        .saveCurrentCycle(this.client)
        .then(() => {
          // Register the new debt cycle
          this.data.registerNewDebtCycle(this.client).then(
            (res: any) => {
              this.router.navigate(['/register-portal/' + this.id]);
            },
            (err: any) => {
              alert(
                "Quelque chose s'est mal passé. Impossible de proceder avec le nouveau cycle!"
              );
            }
          );

          // Update user info
          const date = this.time.todaysDateMonthDayYear();
          this.data
            .updateUserInfoForRegisterClientNewDebtCycle(
              this.client,
              this.savings,
              date
            )
            .then(
              (res: any) => {
                console.log(
                  'Informations utilisateur mises à jour avec succès'
                );
              },
              (err: any) => {
                alert(
                  "Quelque chose s'est mal passé. Impossible de proceder avec le nouveau cycle!"
                );
              }
            );

          this.resetFields();
        })
        .catch((error: any) => {
          console.error('Error saving current cycle:', error);
          alert('Erreur lors de la sauvegarde du cycle actuel.');
        });
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

  savingsPaidAtleast10PercentOfLoanAmount() {
    let savings = Number(this.savings) + Number(this.client.savings);
    let loanAmount = Number(this.loanAmount);
    let savingsToAdd = Number(loanAmount) * 0.1 - Number(this.client.savings);
    if (savings < loanAmount * 0.1) {
      alert(
        `Le montant d'épargne doit être au moins 10% du montant du prêt. Le montant minimum d'épargne pour ce nouveau cycle est de ${
          loanAmount * 0.1
        } FC. Vous devez ajouter au moins ${savingsToAdd} FC d'épargne pour continuer.`
      );
      return false;
    }
    return true;
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
    this.client.dateOfRequest = this.time.todaysDate();
    this.client.applicationFeePayments = {
      [this.time.todaysDate()]: this.applicationFee,
    };
    this.client.membershipFeePayments = {
      [this.time.todaysDate()]: this.memberShipFee,
    };
  }

  toggle(property: 'isLoading') {
    this[property] = !this[property];
  }
  sendMyVerificationCode() {
    const { phoneNumber, uid } = this.client;

    if (
      this.allClients.some(
        (cl) => cl.phoneNumber === phoneNumber && cl.uid !== uid
      )
    ) {
      alert(
        'Ce numéro de téléphone est déjà utilisé par un autre client. Veuillez utiliser un autre numéro de téléphone.'
      );
      return;
    }

    this.toggle('isLoading');

    const callable = this.fns.httpsCallable('sendVerificationCode');
    callable({ phoneNumber, name }).subscribe({
      next: (result) => {
        // console.log('Verification code sent:', result.code);
        this.code = result.code;
        this.blockChangeNumber = true;
        // You can store result.code if you want local verification
        alert('Code de vérification envoyé avec succès');
        this.toggle('isLoading');
      },
      error: (err) => {
        console.error('Error sending verification code:', err);
        alert('Erreur lors de l envoi du code de vérification. Essayez encore');
        this.toggle('isLoading');
      },
    });
    // this.toggle('isLoading');
  }
  verifyMyCode() {
    const enteredCode = this.userEnteredCode?.toString() || '';

    // Wait until user enters at least 4 digits before checking
    if (enteredCode.length < 4) {
      this.codeVerificationStatus = 'waiting';
      return;
    }

    // Validate code correctness
    if (parseInt(enteredCode, 10) === parseInt(this.code, 10)) {
      this.codeVerificationStatus = 'correct';
    } else {
      this.codeVerificationStatus = 'incorrect';
    }
  }
}
