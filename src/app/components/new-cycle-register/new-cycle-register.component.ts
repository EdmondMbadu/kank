import { Component, OnInit } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { ActivatedRoute, Router } from '@angular/router';
import { max } from 'rxjs';
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

  /** phone the client had when this page loaded */
  private originalPhoneNumberAtLoad: string = '';
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
  maxNumberOfDaysToLend: Number = 0;
  numberOfCurrentClients = 0;
  references: string[] = [];
  newReference: string = '';
  newReferenceName: string = '';
  newReferencePhone: string = '';

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
  phonePattern = /^[0-9]{10}$/;

  canAddRef(): boolean {
    return (
      this.newReferenceName?.trim().length > 1 &&
      this.phonePattern.test((this.newReferencePhone || '').trim())
    );
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.allClients = data;
      this.client = data[Number(this.id)];
      this.originalPhoneNumberAtLoad = this.client?.phoneNumber || '';
      // Guarantee the array exists so later merges are predictable
      if (!Array.isArray(this.client.previousPhoneNumbers)) {
        this.client.previousPhoneNumbers = [];
      }
      this.updateAge(); // calcule l’âge si birthDate existe déjà
      this.numberOfCurrentClients = this.data.findClientsWithDebts(data).length; // clients with debt number
      this.middleName =
        this.client.middleName !== undefined ? this.client.middleName : '';
      this.maxNumberOfClients = Number(this.auth.currentUser.maxNumberOfClients)
        ? Number(this.auth.currentUser.maxNumberOfClients)
        : this.data.generalMaxNumberOfClients;
      this.maxNumberOfDaysToLend = Number(
        this.auth.currentUser.maxNumberOfDaysToLend
      )
        ? Number(this.auth.currentUser.maxNumberOfDaysToLend)
        : this.data.generalMaxNumberOfDaysToLend;
      // ✅ NEW: six-month grace reset for score ≤ 0
      this.maybeResetCreditScoreFromDormancy();
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
    // Just before you compute missingFields, add:
    this.tryAutoAdd();

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
    if (!this.references || this.references.length === 0)
      missingFields.push('Références');

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

    const today = new Date(); // current computer date
    if (today.getDate() > Number(this.maxNumberOfDaysToLend)) {
      alert(
        `Les enregistrements de clients ne peuvent qu' être effectués du 1ᵉʳ au ${this.maxNumberOfDaysToLend} de ce mois.
          '\nVeuillez attendre le début du mois prochain.`
      );
      return; // 💥 abort immediately
    }
    // ---- Naissance / âge ----
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
    const percent = this.getRequiredSavingsPercent();
    const requiredSavings = loanAmount * (percent / 100);
    let savingsToAdd = requiredSavings - Number(this.client.savings);
    if (savings < requiredSavings) {
      alert(
        `Le montant d'épargne doit être au moins ${percent}% du montant du prêt. Le montant minimum d'épargne pour ce nouveau cycle est de ${Math.round(
          requiredSavings
        )} FC. Vous devez ajouter au moins ${Math.round(
          savingsToAdd
        )} FC d'épargne pour continuer.`
      );
      return false;
    }
    return true;
  }

  private getRequiredSavingsPercent(): number {
    const raw = Number(this.auth.currentUser?.savingsRequiredPercent);
    return Number.isFinite(raw) && raw > 0 ? raw : 30;
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
    this.client.references = [...this.references];

    this.client.applicationFeePayments = { [today]: this.applicationFee };
    this.client.membershipFeePayments = { [today]: this.memberShipFee };
    this.client.comments = [];
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

    try {
      await this.data.saveCurrentCycle(this.client);

      // Make sure we capture the old phone into history if it changed in this form
      this.ensurePhoneHistoryIfChanged();

      this.setClientNewDebtCycleValues();
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

  addReference(): void {
    if (this.references.length >= 3) {
      alert("Vous ne pouvez ajouter que jusqu'à 3 références.");
      return;
    }

    const name = (this.newReferenceName || '').trim();
    const phone = (this.newReferencePhone || '').trim();

    if (!name) {
      alert('Veuillez entrer le nom du référent.');
      return;
    }
    if (!phone) {
      alert('Veuillez entrer un numéro de téléphone.');
      return;
    }
    if (!this.phonePattern.test(phone)) {
      alert('Le numéro de téléphone doit contenir exactement 10 chiffres.');
      return;
    }

    // Empêche les doublons exacts
    const formatted = `${name} - ${phone}`;
    if (this.references.includes(formatted)) {
      alert('Cette référence a déjà été ajoutée.');
      return;
    }

    this.references.push(formatted);
    this.newReferenceName = '';
    this.newReferencePhone = '';
  }
  tryAutoAdd(): void {
    // Ajoute automatiquement si les deux champs sont valides
    if (this.references.length < 3 && this.canAddRef()) {
      this.addReference();
    }
  }
  removeReference(index: number): void {
    this.references.splice(index, 1);
  }

  /** Parse payment key "M-D-YYYY-HH-mm-ss" (no leading zeros needed) into Date */
  private parsePaymentKey(key: string): Date | null {
    const parts = key.split('-').map((n) => Number(n));
    if (parts.length !== 6 || parts.some((n) => !Number.isFinite(n)))
      return null;
    const [M, D, Y, h, m, s] = parts;
    const d = new Date(Y, M - 1, D, h, m, s);
    return Number.isNaN(+d) ? null : d;
  }

  /** Find the most recent payment date from client.payments keys */
  private getLastPaymentDate(
    payments: Record<string, any> | undefined
  ): Date | null {
    if (!payments || typeof payments !== 'object') return null;
    let latest: Date | null = null;
    for (const k of Object.keys(payments)) {
      const d = this.parsePaymentKey(k);
      if (d && (!latest || d > latest)) latest = d;
    }
    return latest;
  }

  /** Returns true if at least 6 calendar months have passed since `since` */
  private sixMonthsHavePassed(since: Date): boolean {
    const plus6 = new Date(since);
    plus6.setMonth(plus6.getMonth() + 6);
    return new Date() >= plus6;
  }

  /**
   * If creditScore ≤ 0 and the last payment is ≥ 6 months ago, set score to 50 (once).
   * This updates `this.client.creditScore` so later validations & save calls persist it.
   */
  private maybeResetCreditScoreFromDormancy(): void {
    const score = Number(this.client?.creditScore ?? 0);
    if (score <= 0) {
      const last = this.getLastPaymentDate(this.client?.payments);
      if (last && this.sixMonthsHavePassed(last)) {
        this.client.creditScore = '50';
      }
    }
  }

  /** compare numbers without spaces/dashes/etc. */
  private normalizePhone(p?: string): string {
    return (p || '').replace(/\D+/g, '');
  }

  /** If phone changed vs when the page loaded, push old phone into history (no dups) */
  private ensurePhoneHistoryIfChanged(): void {
    const oldNorm = this.normalizePhone(this.originalPhoneNumberAtLoad);
    const newNorm = this.normalizePhone(this.client?.phoneNumber);

    if (!oldNorm || !newNorm || oldNorm === newNorm) return;

    const list = Array.isArray(this.client.previousPhoneNumbers)
      ? [...this.client.previousPhoneNumbers]
      : [];

    const alreadyInList = list.some((p) => this.normalizePhone(p) === oldNorm);

    if (!alreadyInList && this.originalPhoneNumberAtLoad) {
      // store the exact old formatting
      list.push(this.originalPhoneNumberAtLoad);
    }

    this.client.previousPhoneNumbers = list;
  }
}
