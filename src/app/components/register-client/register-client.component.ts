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
  loanAmount: string = '';
  savings: string = '';
  requestDate: string = '';
  timeInBusiness: string = '';
  dailyIncome: string = '';
  monthlyIncome: string = '';
  debtInProcess: string = '';
  planToPayDebt: string = '';
  references: string[] = [];
  newReference: string = '';
  collateral: string = '';
  creditworthinessScore: number | null = null;

  applicationFeeOtherDisplay: boolean = false;
  loanAmountOtherDisplay: boolean = false;
  memberShipFeeOtherDisplay: boolean = false;
  savingsOtherDisplay: boolean = false;
  newReferenceName: string = '';
  newReferencePhone: string = '';

  addNewClient() {
    let date = this.time.todaysDateMonthDayYear();
    // only for testing.
    this.creditworthinessScore = this.calculateCreditworthiness();
    let checkDate = this.time.validateDateWithInOneWeekNotPastOrToday(
      this.requestDate
    );
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
      this.savings === '' ||
      this.requestDate === '' ||
      this.timeInBusiness === '' ||
      this.dailyIncome === '' ||
      this.debtInProcess === '' ||
      this.planToPayDebt === '' ||
      this.collateral === '' ||
      this.references.length === 0
    ) {
      alert('Completer tous les données');
      return;
    } else if (!inputValid) {
      alert(
        'Assurez-vous que tous les nombres sont valides et supérieurs ou égaux à 0'
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
    } else if (
      Number(this.applicactionFee) < 5000 &&
      Number(this.memberShipFee) < 5000
    ) {
      alert("Les frais d'inscription ou d'adhesion doit etre minimum 5000 FC.");
      return;
    } else if (!checkDate) {
      alert(`Assurez-vous que la date de Donner L'argent au client\n
        - Est Dans L'intervalle D'Une Semaine\n
        - N'est Pas Aujourdhui ou au Passé
        `);
      return;
    } else {
      let conf = confirm(
        `Vous allez enregistré ${this.firstName} ${this.middleName} ${this.lastName}. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      this.setNewClientValues();
      const creditworthinessScore = this.calculateCreditworthiness();
      console.log(`Creditworthiness Score: ${creditworthinessScore}%`);

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
  displayLoanOtherAmount() {
    if (this.loanAmount === 'Autre Montant') {
      this.loanAmountOtherDisplay = true;
      this.loanAmount = '';
    } else {
      this.loanAmountOtherDisplay = false;
    }
    this.calculateCreditworthiness();
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
    this.requestDate = this.time.convertDateToMonthDayYear(this.requestDate);

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
    this.client.loanAmount = this.loanAmount;
    this.client.requestAmount = this.loanAmount;
    this.client.requestDate = this.requestDate;
    this.client.dateOfRequest = this.time.todaysDate();

    // Additional fields
    this.client.timeInBusiness = this.timeInBusiness;
    this.client.monthlyIncome = (Number(this.dailyIncome) * 25).toFixed(0);
    this.client.debtInProcess = this.debtInProcess;
    this.client.planToPayDebt = this.planToPayDebt;
    this.client.references = [...this.references];
    this.client.collateral = this.collateral;

    // Payments
    this.client.savingsPayments = {
      [this.time.todaysDate()]: this.savings,
    };
    this.client.applicationFeePayments = {
      [this.time.todaysDate()]: this.applicactionFee,
    };
    this.client.membershipFeePayments = {
      [this.time.todaysDate()]: this.memberShipFee,
    };

    // New: Calculate and include creditworthiness score
    this.client.creditworthinessScore =
      this.calculateCreditworthiness().toFixed(0);
  }
  // Add a new reference with both name and phone number
  // Function to add a new reference with validation for the phone number
  addReference(): void {
    const phonePattern = /^[0-9]{10}$/; // Ensures exactly 10 digits

    if (this.references.length >= 3) {
      alert("Vous ne pouvez ajouter que jusqu'à 3 références.");
      return;
    }

    if (!this.newReferenceName.trim()) {
      alert('Veuillez entrer le nom du référent.');
      return;
    }

    if (!this.newReferencePhone.trim()) {
      alert('Veuillez entrer un numéro de téléphone.');
      return;
    }

    if (!phonePattern.test(this.newReferencePhone.trim())) {
      alert('Le numéro de téléphone doit contenir exactement 10 chiffres.');
      return;
    }

    // Concatenate name and phone number if validation passes
    const fullReference = `${this.newReferenceName.trim()} - ${this.newReferencePhone.trim()}`;
    this.references.push(fullReference);

    // Clear the input fields after adding
    this.newReferenceName = '';
    this.newReferencePhone = '';
  }

  // Handle the selection of a reference from the dropdown
  onReferenceSelect(event: Event): void {
    const selectedValue = (event.target as HTMLSelectElement).value;
    console.log('Selected Reference:', selectedValue);
  }
  calculateCreditworthiness(): number {
    let stabilityScore = 0;
    let financialStabilityScore = 0;
    let riskResilienceScore = 0;
    let reputationScore = 0;
    let collateralScore = 0;

    // Stabilité et Performance de l'Entreprise (30%)
    stabilityScore +=
      Number(this.timeInBusiness) >= 2
        ? 10
        : Number(this.timeInBusiness) === 1
        ? 5
        : 0;
    stabilityScore +=
      Number(this.dailyIncome) * 25 > Number(this.loanAmount)
        ? 10
        : Number(this.dailyIncome) * 25 === Number(this.loanAmount)
        ? 5
        : 0;
    console.log('stability score ', stabilityScore);

    stabilityScore = Math.min(stabilityScore, 10);

    // Stabilité Financière (30%)
    financialStabilityScore +=
      Number(this.debtInProcess) === 0
        ? 10
        : Number(this.debtInProcess) <= 2
        ? 5
        : 0;

    financialStabilityScore = Math.min(financialStabilityScore, 10);

    // Risque et Résilience (20%)
    riskResilienceScore +=
      Number(this.planToPayDebt) >= 2
        ? 10
        : Number(this.planToPayDebt) === 1
        ? 5
        : 0;

    riskResilienceScore = Math.min(riskResilienceScore, 10);

    // Réputation et Références (10%)
    reputationScore +=
      this.references.length >= 3 ? 10 : this.references.length >= 1 ? 5 : 0;

    reputationScore = Math.min(reputationScore, 10);

    // Garanties et Collatéral (10%)
    collateralScore +=
      Number(this.collateral) >= 2 ? 10 : Number(this.collateral) === 1 ? 5 : 0;

    collateralScore = Math.min(collateralScore, 10);

    console.log(
      'stability, financial, risk, reputation, collateral',
      stabilityScore,
      financialStabilityScore,
      riskResilienceScore,
      reputationScore,
      collateralScore
    );

    // Correct total score calculation
    const totalScore =
      (stabilityScore * 30 +
        financialStabilityScore * 30 +
        riskResilienceScore * 20 +
        reputationScore * 10 +
        collateralScore * 10) /
      10;

    console.log('The total score computed is out of 100', totalScore);
    this.creditworthinessScore = Math.round(totalScore);
    return Math.round(totalScore);
  }
}
