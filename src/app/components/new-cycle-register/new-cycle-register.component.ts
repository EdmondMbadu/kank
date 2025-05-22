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
import { toAppDate, toAppDateFull } from 'src/app/utils/date-util';
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
  applicationFee: string = '0';
  memberShipFee: string = '0';
  savings: string = '';
  loanAmount: string = '';
  middleName: string = '';
  requestDate: string = '';
  maxLoanAmount: number = 0;
  allClients: Client[] = [];
  private readonly FIXED_APPLICATION_FEE = '5000'; // 5 000 FC
  private readonly FIXED_MEMBERSHIP_FEE = '0'; // 0 FC

  birthDateInput: string = ''; // yyyy-mm-dd (si saisie)
  age: number | null = null; // affichage uniquement

  code: string = '';
  userEnteredCode: string = '';
  isLoading: boolean = false;
  codeVerificationStatus: 'waiting' | 'correct' | 'incorrect' | null = null;
  blockChangeNumber: boolean = false;
  showConfirmation: boolean = false;
  isConfirmed: boolean = false;

  applicationFeeOtherDisplay: boolean = false;
  memberShipFeeOtherDisplay: boolean = false;
  savingsOtherDisplay: boolean = false;
  loanAmountOtherDisplay: boolean = false;

  maxNumberOfClients: number = 0;
  numberOfCurrentClients = 0;

  /** Normalize text so “  Élodie ” === “elodie” */
  private norm = (s: string | undefined) => (s ?? '').trim().toLowerCase();

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
      this.updateAge(); // calcule l’âge si birthDate existe déjà
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
      /* <<< NEW: pre‑select fixed fees >>> */
      this.applicationFee = this.FIXED_APPLICATION_FEE;
      this.memberShipFee = this.FIXED_MEMBERSHIP_FEE;
      this.applicationFeeOtherDisplay = false;
      this.memberShipFeeOtherDisplay = false;
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
  /** Return true if another client already has *exactly* the same names */
  private nameExists(): boolean {
    const { firstName, middleName = '', lastName, uid } = this.client;

    return this.allClients.some(
      (c) =>
        this.norm(c.firstName) === this.norm(firstName) &&
        this.norm(c.middleName) === this.norm(middleName) &&
        this.norm(c.lastName) === this.norm(lastName) &&
        c.uid !== uid // ignore the client we’re editing
    );
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
    let missingFields: string[] = [];

    if (!this.client.firstName?.trim()) missingFields.push('Prénom');
    if (!this.middleName?.trim()) missingFields.push('Post-nom');
    if (!this.client.lastName?.trim()) missingFields.push('Nom');
    if (!this.client.phoneNumber?.trim()) missingFields.push('Téléphone');
    if (!this.client.profession?.trim()) missingFields.push('Profession');
    if (!this.client.businessCapital?.toString().trim())
      missingFields.push('Capital');
    if (!this.client.homeAddress?.trim())
      missingFields.push('Adresse Domicile');
    if (!this.client.businessAddress?.trim())
      missingFields.push('Adresse Business');
    if (!this.applicationFee?.toString().trim())
      missingFields.push('Frais de dossier');
    if (!this.memberShipFee?.toString().trim())
      missingFields.push("Frais d'adhésion");
    if (!this.savings?.toString().trim()) missingFields.push('Épargne');
    if (!this.loanAmount?.toString().trim())
      missingFields.push('Montant demandé');
    if (!this.requestDate?.trim())
      missingFields.push("Date de don de l'argent");

    if (!this.client.profilePicture) missingFields.push('Photo du client');

    if (!this.client.birthDate && !this.birthDateInput?.trim()) {
      missingFields.push('Date de naissance');
    }

    if (missingFields.length > 0) {
      alert(
        '⚠️ Veuillez compléter les champs suivants :\n\n- ' +
          missingFields.join('\n- ')
      );
      return;
    }

    // if (
    //   this.loanAmount === '' ||
    //   this.applicationFee === '' ||
    //   this.middleName === '' ||
    //   this.memberShipFee === '' ||
    //   this.savings === '' ||
    //   this.requestDate === ''
    // ) {
    //   alert('Completer tous les données');
    //   return;
    // } // ---- Naissance / âge ----
    if (!this.client.birthDate && this.birthDateInput === '') {
      alert('Veuillez renseigner la date de naissance.');
      return;
    }
    if (this.age !== null && this.age < 21) {
      alert('Le client doit avoir au moins 21 ans.');
      return;
    } else if (!inputValid) {
      alert(
        'Assurez-vous que tous les nombres sont valides et supérieurs ou égaux à 0'
      );
      return;
    } else if (!checkDate) {
      alert(`Assurez-vous que la date de Donner L'argent au client\n
        - Est Dans L'intervalle D'Une Semaine\n
        - N'est Pas Aujourdhui ou au Passé\n
        - N'est Pas Demain mais au Moins Un lendemain ou dans 2+ jour\n
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
    } else if (this.nameExists()) {
      alert(
        'Un client possédant exactement le même prénom, nom et post‑nom existe déjà.'
      );
      return;
    } else if (
      Number(this.loanAmount) >
        Number(this.auth.currentUser.monthBudget) -
          Number(this.auth.currentUser.monthBudgetPending) &&
      Number(this.client.creditScore) < 70
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
    } else if (
      this.client.profilePicture === undefined ||
      this.client.profilePicture === null
    ) {
      alert('Veuillez ajouter une photo de profil du client pour continuer');
      return;
    }
    // if the client has reached the maximum number of clients allowed and the credit score is less than 70 for the given client. don't register them.
    // but if the credit score of the given client is greater than 70, then register them regardless of the  number of clients the team has.
    else if (
      this.numberOfCurrentClients >= this.maxNumberOfClients &&
      Number(this.client.creditScore) < 70
    ) {
      alert(
        `Vous avez depassez la limite de clients autorisez. La limite est de ${
          this.maxNumberOfClients
        } clients. Vous devez enlever ${
          this.numberOfCurrentClients - this.maxNumberOfClients + 1
        } clients avant d'ajouter.`
      );
      return;
    } else if (this.savingsPaidAtleast30PercentOfLoanAmount() === false) {
      return;
    } else if (this.codeVerificationStatus !== 'correct') {
      alert('Veuillez vérifier votre code de vérification');
      return;
    } else {
      // let conf = confirm(
      //   `Vous allez enregistré ${this.client.firstName} ${this.client.lastName} pour un nouveau cycle. Voulez-vous quand même continuer?`
      // );
      // if (!conf) {
      //   return;
      // }
      this.proceed();
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

  savingsPaidAtleast30PercentOfLoanAmount() {
    let savings = Number(this.savings) + Number(this.client.savings);
    let loanAmount = Number(this.loanAmount);
    let savingsToAdd = Number(loanAmount) * 0.3 - Number(this.client.savings);
    if (savings < loanAmount * 0.3) {
      alert(
        `Le montant d'épargne doit être au moins 30% du montant du prêt. Le montant minimum d'épargne pour ce nouveau cycle est de ${
          loanAmount * 0.3
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
    this.birthDateInput = '';
    this.age = null;
  }

  private setClientNewDebtCycleValues(): void {
    /* ----- DATE FIELDS (use new helper) ----- */
    this.requestDate = toAppDate(this.requestDate);
    const today = toAppDateFull(new Date());

    this.client.requestDate = this.requestDate;
    this.client.dateOfRequest = today;
    /* --- BirthDate : uniquement si elle n’existe pas déjà et a été saisie --- */
    if (!this.client.birthDate && this.birthDateInput) {
      this.client.birthDate = toAppDate(this.birthDateInput); // jj-mm-aaaa
    }

    /* ----- UNCHANGED FIELDS ↓ ---------------- */
    this.client.previousSavingsPayments = { ...this.client.savingsPayments };
    this.client.previousPayments = {
      ...this.client.previousPayments,
      ...this.client.payments,
    };
    this.client.savingsPayments = {};

    this.client.savings = (
      Number(this.client.savings) + Number(this.savings)
    ).toString();

    this.client.savingsPayments = { [today]: this.savings };
    this.client.applicationFee = this.applicationFee;
    this.client.membershipFee = this.memberShipFee;
    this.client.loanAmount = this.loanAmount;
    this.client.requestAmount = this.loanAmount;

    this.client.applicationFeePayments = { [today]: this.applicationFee };
    this.client.membershipFeePayments = { [today]: this.memberShipFee };
  }
  proceed() {
    this.toggle('showConfirmation');
  }

  // -------------------------------------------------------
  async submitNewCycleRegistration() {
    if (!this.isConfirmed) {
      alert('Veuillez confirmer que vous avez respecté toutes les règles.');
      return;
    }

    this.toggle('isLoading');
    this.setClientNewDebtCycleValues();

    try {
      await this.data.saveCurrentCycle(this.client);
      await this.data.registerNewDebtCycle(this.client);
      await this.data.updateUserInfoForRegisterClientNewDebtCycleOfflineSafe(
        this.client,
        Number(this.savings),
        toAppDate(new Date())
      );

      this.router.navigate(['/register-portal/' + this.id]);
    } catch (err) {
      console.error(err);
      alert("Quelque chose s'est mal passé.");
    } finally {
      this.toggle('isLoading');
      this.resetFields();
    }
  }
  toggle(property: 'isLoading' | 'showConfirmation') {
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
  updateAge(): void {
    const src = this.client.birthDate || this.birthDateInput;
    if (!src) {
      this.age = null;
      return;
    }

    const today = new Date();
    const dob = new Date(src);
    let a = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      a--;
    }
    this.age = a;
  }
}
