import { Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  AuthService,
  WeeklyPaymentProjection,
} from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { Client } from 'src/app/models/client';
import { DataService } from 'src/app/services/data.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { ElementRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Card } from 'src/app/models/card';
interface Receipt {
  docId: string;
  url: string;
  ts: number;
  frenchDate: string;
  amount?: number;
}
interface WeeklyShortfall {
  start: Date;
  end: Date;
  label: string;
  totalFc: number;
  totalUsd: number;
  isComplete: boolean;
}
@Component({
  selector: 'app-today',
  templateUrl: './today.component.html',
  styleUrls: ['./today.component.css'],
})
export class TodayComponent {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  newReceiptAmount: number | null = null; // ➋ binds the upload field

  // === Simplified verification state (no Math in template) ===
  moneyInHands: string = '0';
  moneyInHandsN: number = 0; // numeric version for comparisons
  requestTotalToday: number = 0; // identical logic to "Total" in request-today
  moneyInHandsTotalN: number = 0;
  okMoney: boolean = true;
  okRequested: boolean = true;
  okCount: number = 0;

  // ── NEW: reasons (comments) completeness summary ────────────────
  reasonsMissing: number = 0; // number of clients w/o comment for the date
  reasonsTotal: number = 0; // number of clients who should have paid but didn't
  okReasons: boolean = true; // true when reasonsMissing === 0

  cards: Card[] = [];
  detailOpen = false;

  dailyCardPayments: string = '0'; // for + side (carte)
  dailyCardReturns: string = '0'; // for + side (carte)
  formulaPlus: { label: string; v: number }[] = [];
  formulaMinus: { label: string; v: number }[] = [];
  formulaPlusSumN = 0;
  formulaMinusSumN = 0;
  formulaNetN = 0;

  notPaidAmountTodayN: number = 0;
  requestTotalTomorrow: number = 0;

  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    public compute: ComputationService,
    private data: DataService,
    private afs: AngularFirestore,
    private storage: AngularFireStorage
  ) {}
  ngOnInit() {
    this.initalizeInputs();
    this.detailOpen = new Date().getHours() >= 16; // 4pm works better
    this.weekPickerStartDate = this.requestDate;
    this.selectedShortfallMonth = this.currentMonthKey();
    this.updateWeekPickerTotals();
    this.auth.weeklyPaymentTarget$.subscribe(() => {
      this.syncWeeklyTargetFc();
    });
    this.auth.weeklyPaymentProjection$.subscribe(
      (projection: WeeklyPaymentProjection) => {
        this.projectedWeeklyTargetFc = projection.projectedTargetFc;
        this.projectedWeeklyTargetEffectiveDate = projection.effectiveDateIso;
      }
    );
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;

      this.recomputeHeaderReasons();

      this.findClientsWithDebts();
      this.computeRequestTotalSameAsRequestToday(); // NEW
    });

    this.auth.getAllClientsCard().subscribe((cards: any) => {
      this.cards = cards;
      this.computeRequestTotalSameAsRequestToday(); // NEW
    });
    this.loadReceipts();
  }
  clients?: Client[] = [];
  clientsWithDebts: Client[] = [];
  receipts: Receipt[] = [];
  selectedTs = 0; //  ←  add this line
  showAllReceipts = false; // For admin to expand and see all receipts

  percentage: string = '0';
  perc: number = 0;
  dailyLending: string = '0';
  dailyPayment: string = '0';
  dailyPaymentDollars: string = '0';
  weeklyPaymentTotalN: number = 0;
  weeklyPaymentTotalDollars: string = '0';
  weeklyTargetFc: number = 600000;
  projectedWeeklyTargetFc: number | null = null;
  projectedWeeklyTargetEffectiveDate = '';
  weeklyTargetInput: string = '';
  weeklyProgressPercent: number = 0;
  weeklyTargetReached: boolean = false;
  weeklyRangeLabel: string = '';
  weekPickerStartDate: string = '';
  weekPickerRangeLabel: string = '';
  weekPickerStartLabel: string = '';
  weekPickerEndLabel: string = '';
  weekPickerTotalN: number = 0;
  weekPickerTotalDollars: string = '0';
  weekPickerTargetReached: boolean = false;
  weekPickerProgressPercent: number = 0;
  weeklyShortfalls: WeeklyShortfall[] = [];
  selectedShortfallMonth = '';
  dailyFees: string = '0';
  dailyReserve: string = '0';
  dailyInvestment: string = '0';
  dailySaving: string = '0';
  dailySavingReturns: string = '0';
  dailyFeesReturns: string = '0';
  dailyMoneyRequests: string = '0';
  tomorrowMoneyRequests: string = '0';
  dailyExpense: string = '0';
  dailyLoss: string = '0';
  expectedReserve: string = '0';
  expectedReserveInDollars: string = '0';
  // ➊ clef de date déjà au bon format « MM-DD-YYYY »
  todayKey = '';

  // ➋ configuration des champs à éditer
  dailyFieldConfigs = [
    { key: 'dailyReimbursement', label: 'Paiement du Jour', input: '' },
    { key: 'dailyLending', label: 'Emprunt du Jour', input: '' },
    { key: 'dailySaving', label: 'Épargne du Jour', input: '' },
    { key: 'dailySavingReturns', label: 'Retrait Épargne Du Jour', input: '' },
    { key: 'dailyFeesReturns', label: 'Retrait Frais', input: '' },
    { key: 'feesData', label: 'Frais Du Jour', input: '' },
    { key: 'dailyCardPayments', label: 'Paiement Carte Du Jour', input: '' },
    { key: 'dailyCardReturns', label: 'Retrait Carte Du Jour', input: '' },
    { key: 'dailyCardBenefits', label: 'Carte Benefice Du Jour', input: '' },
  ];

  totalPerfomance: number = 0;

  linkPaths: string[] = [
    '/not-paid-today',
    '/daily-payments',
    '/daily-lendings',
    '/daily-fees',
    '/add-reserve',
    '/add-investment',
    '/daily-savings',
    '/daily-savings-returns',
    '/daily-returns',
    '/request-today',
    '/request-tomorrow',
    '/add-expense',
    '/add-loss',
  ];
  summary: string[] = [
    "N'ont pas Payé Aujourdhui",
    'Paiement Du Jour',
    'Emprunt Du Jour',
    'Frais De Membre Du Jour',
    'Reserve Du Jour',
    'Entrée Du Jour',
    'Epargne Du Jour',
    'Retrait Epargne Du Jour',
    `Retrait Frais De Membre Du Jour`,
    'Argent Demandé Pour Aujourdhui',
    'Argent Demandé Pour Demain',
    'Depense Du Jour',
    'Perte Du Jour',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/late-payment.png',
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
    '../../../assets/img/member.svg',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/invest.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/saving.svg',
    '../../../assets/img/return.png',
    '../../../assets/img/request-money.png',
    '../../../assets/img/request-money.png',
    '../../../assets/img/expense.svg',
    '../../../assets/img/loss.png',
  ];

  today = this.time.todaysDateMonthDayYear();
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  day: string = new Date().toLocaleString('en-US', { weekday: 'long' });
  summaryContent: string[] = [];
  selectedDocId: string | null = null;
  searchText = '';
  isSunday = new Date().getDay() === 0;

  // ───── unlocking state ─────────────────────────────────────────
  codesStored: string[] = (this.auth.currentUser?.teamCode ?? '')
    .split('-')
    .map((c: any) => c.trim())
    .filter((c: any) => !!c);

  isPayUnlocked = false; // everyone starts locked
  isSavingUnlocked = false; // everyone starts locked
  isPercentageUnlocked = false; // percentage display starts locked for non-admin
  showCodeModal = false; // controls the modal visibility
  payCodeInput = new FormControl('');
  payErrMsg = '';

  openCodeModal() {
    this.showCodeModal = true;
  }
  closeCodeModal() {
    this.showCodeModal = false;
  }

  unlockPayment() {
    const entered = this.payCodeInput.value?.trim() || '';
    if (this.codesStored.includes(entered)) {
      this.isPayUnlocked = true;
      this.isSavingUnlocked = true;
      this.isPercentageUnlocked = true; // also unlock percentage display
      this.closeCodeModal();
      this.payErrMsg = '';
    } else {
      this.payErrMsg = 'Code incorrect – réessayez !';
      this.payCodeInput.setValue('');
    }
  }
  onDetailsToggle(evt: Event) {
    this.detailOpen = (evt.target as HTMLDetailsElement).open;
  }
  initalizeInputs() {
    // ➊ clef de date déjà au bon format « MM-DD-YYYY »
    this.todayKey = this.requestDateCorrectFormat;

    this.dailyCardPayments =
      this.auth.currentUser?.dailyCardPayments?.[
        this.requestDateCorrectFormat
      ] ?? '0';
    this.dailyCardReturns =
      this.auth.currentUser?.dailyCardReturns?.[
        this.requestDateCorrectFormat
      ] ?? '0';

    // ✅ Argent en main = moneyInHands + cardsMoney (both can be string or undefined)
    const moneyInHandsStr = this.auth.currentUser?.moneyInHands ?? '0';
    const cardsMoneyStr = this.auth.currentUser?.cardsMoney ?? '0';
    this.moneyInHandsTotalN =
      (Number(moneyInHandsStr) || 0) + (Number(cardsMoneyStr) || 0);

    this.updateOkChips(); // reflect any immediate change
    this.dailyLending =
      this.auth.currentUser?.dailyLending?.[this.requestDateCorrectFormat] ??
      '0';
    this.dailySaving =
      this.auth.currentUser?.dailySaving?.[this.requestDateCorrectFormat] ??
      '0';
    this.dailySavingReturns =
      this.auth.currentUser?.dailySavingReturns?.[
        this.requestDateCorrectFormat
      ] ?? '0';
    this.dailyFeesReturns =
      this.auth.currentUser?.dailyFeesReturns?.[
        this.requestDateCorrectFormat
      ] ?? '0';

    console.log('fees returns', this.dailyFeesReturns);
    this.dailyMoneyRequests =
      this.auth.currentUser?.dailyMoneyRequests?.[
        this.requestDateCorrectFormat
      ] ?? '0';
    this.tomorrowMoneyRequests =
      this.auth.currentUser?.dailyMoneyRequests?.[this.tomorrow] ?? '0';
    this.dailyPayment =
      this.auth.currentUser?.dailyReimbursement?.[
        this.requestDateCorrectFormat
      ] ?? '0';
    this.dailyFees =
      this.auth.currentUser?.feesData?.[this.requestDateCorrectFormat] ?? '0';
    this.dailyReserve = this.compute
      .findTotalForToday(
        this.auth.currentUser.reserve,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyExpense = this.compute
      .findTotalForToday(
        this.auth.currentUser.expenses,
        this.requestDateCorrectFormat
      )
      .toString();
    this.dailyLoss = this.compute
      .findTotalForToday(
        this.auth.currentUser.losses,
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyInvestment = this.compute
      .findTotalForToday(
        this.auth.currentUser.investments,
        this.requestDateCorrectFormat
      )
      .toString();

    this.dailyMoneyRequests =
      this.dailyMoneyRequests === undefined ? '0' : this.dailyMoneyRequests;
    this.tomorrowMoneyRequests =
      this.tomorrowMoneyRequests === undefined
        ? '0'
        : this.tomorrowMoneyRequests;
    this.summaryContent = [
      `${this.notPaidAmountTodayN}`, // was ``
      ` ${this.dailyPayment}`,
      ` ${this.dailyLending}`,
      ` ${this.dailyFees}`,
      ` ${this.dailyReserve}`,
      `${this.dailyInvestment}`,
      `${this.dailySaving}`,
      `${this.dailySavingReturns}`,
      `${this.dailyFeesReturns}`,
      `${this.requestTotalToday}`, // was ''
      `${this.requestTotalTomorrow}`, // was ''
      `${this.dailyExpense}`,
      `${this.dailyLoss}`,
    ];
    this.dailyPaymentDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.dailyPayment)
      .toString();
    this.weeklyPaymentTotalN = this.computeWeeklyPaymentTotal(
      this.requestDateCorrectFormat
    );
    this.weeklyPaymentTotalDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.weeklyPaymentTotalN.toString())
      .toString();
    this.weeklyRangeLabel = this.computeWeeklyRangeLabel(
      this.requestDateCorrectFormat
    );
    this.syncWeeklyTargetFc();
    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.notPaidAmountTodayN.toString()
      )}`, // was ``
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyPayment)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLending)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyFees)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyReserve)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyInvestment)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailySaving)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailySavingReturns
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyFeesReturns)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.requestTotalToday.toString()
      )}`, // was ``
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.requestTotalTomorrow.toString()
      )}`, // was ``
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyExpense)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLoss)}`,
    ];
    this.recomputeMoneyInHandsTrace();
  }

  private computeWeeklyPaymentTotal(dateKey: string): number {
    const { start, end } = this.getWeekBounds(dateKey);
    const payments = this.auth.currentUser?.dailyReimbursement || {};
    let total = 0;
    const cursor = new Date(start);

    while (cursor <= end) {
      const key = this.formatDateKey(cursor);
      const amount = Number((payments as any)[key] ?? 0);
      if (!Number.isNaN(amount)) {
        total += amount;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return total;
  }

  private computeWeeklyRangeLabel(dateKey: string): string {
    const { start, end } = this.getWeekBounds(dateKey);
    return `${this.formatWeekDate(start)} - ${this.formatWeekDate(end)}`;
  }

  updateWeekPickerTotals() {
    const baseIsoDate = this.weekPickerStartDate || this.requestDate;
    const dateKey = this.time.convertDateToMonthDayYear(baseIsoDate);
    const { start, end } = this.getWeekBounds(dateKey);
    this.weekPickerStartLabel = this.formatWeekDate(start);
    this.weekPickerEndLabel = this.formatWeekDate(end);
    this.weekPickerRangeLabel = `${this.weekPickerStartLabel} - ${this.weekPickerEndLabel}`;
    this.weekPickerTotalN = this.computeWeeklyPaymentTotal(dateKey);
    this.weekPickerTotalDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.weekPickerTotalN.toString())
      .toString();
    this.weekPickerTargetReached =
      this.weekPickerTotalN >= this.weeklyTargetFc;
    this.weekPickerProgressPercent =
      this.weeklyTargetFc === 0
        ? 0
        : Math.min(100, (this.weekPickerTotalN / this.weeklyTargetFc) * 100);
  }

  private getWeekBounds(dateKey: string): { start: Date; end: Date } {
    const dateObj = this.time.toDate(dateKey);
    const dayIndex = dateObj.getDay();
    const daysSinceMonday = (dayIndex + 6) % 7;
    const start = new Date(dateObj);
    start.setDate(dateObj.getDate() - daysSinceMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(0, 0, 0, 0);

    return { start, end };
  }

  private formatWeekDate(date: Date): string {
    const days = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];
    const months = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];
    const dayName = days[date.getDay()];
    const monthName = months[date.getMonth()];
    return `${dayName} ${date.getDate()} ${monthName} ${date.getFullYear()}`;
  }

  private formatDateKey(date: Date): string {
    return `${date.getMonth() + 1}-${date.getDate()}-${date.getFullYear()}`;
  }

  private formatWeekShortLabel(start: Date, end: Date): string {
    const months = [
      'Janvier',
      'Fevrier',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Aout',
      'Septembre',
      'Octobre',
      'Novembre',
      'Decembre',
    ];
    const monthName = months[start.getMonth()];
    return `${start.getDate()}-${end.getDate()} ${monthName} ${start.getFullYear()}`;
  }

  private computeMonthlyWeeklyShortfalls() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { year, month } = this.resolveShortfallMonth();
    const lastDay = new Date(year, month + 1, 0);
    const shortfalls: WeeklyShortfall[] = [];

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const start = new Date(year, month, day);
      if (start.getDay() !== 1) continue; // Monday only

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      if (end.getMonth() !== month) continue; // skip weeks crossing months
      if (start > today) continue; // skip future weeks

      const totalFc = this.computeWeeklyPaymentTotal(
        this.formatDateKey(start)
      );
      if (totalFc >= this.weeklyTargetFc) continue;

      const totalUsd = Number(
        this.compute.convertCongoleseFrancToUsDollars(totalFc.toString())
      );
      const isComplete = today > end;
      if (!isComplete) continue; // current week isn't deducted yet

      shortfalls.push({
        start,
        end,
        label: this.formatWeekShortLabel(start, end),
        totalFc,
        totalUsd: Number.isNaN(totalUsd) ? 0 : totalUsd,
        isComplete,
      });
    }

    this.weeklyShortfalls = shortfalls;
  }

  onShortfallMonthChange(): void {
    if (!this.auth.isAdmin) return;
    if (!this.selectedShortfallMonth) {
      this.selectedShortfallMonth = this.currentMonthKey();
    }
    this.computeMonthlyWeeklyShortfalls();
  }

  private currentMonthKey(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  }

  private resolveShortfallMonth(): { year: number; month: number } {
    if (!this.auth.isAdmin || !this.selectedShortfallMonth) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() };
    }
    const [y, m] = this.selectedShortfallMonth.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() };
    }
    return { year: y, month: m - 1 };
  }

  private recomputeMoneyInHandsTrace() {
    const n = (x: any) => Number(x) || 0;

    const plusRaw = [
      { label: 'Paiement', v: n(this.dailyPayment) },
      { label: 'Frais', v: n(this.dailyFees) },
      { label: 'Entrée', v: n(this.dailyInvestment) },
      { label: 'Épargne', v: n(this.dailySaving) },
      { label: 'Paiement carte', v: n(this.dailyCardPayments) },
    ];

    const minusRaw = [
      { label: 'Emprunts', v: n(this.dailyLending) },
      { label: 'Retrait épargne', v: n(this.dailySavingReturns) },
      { label: 'Retrait frais', v: n(this.dailyFeesReturns) },
      { label: 'Dépenses', v: n(this.dailyExpense) },
      { label: 'Pertes', v: n(this.dailyLoss) },
      { label: 'Retrait carte', v: n(this.dailyCardReturns) },
      { label: 'Reserve', v: n(this.dailyReserve) },
    ];

    // keep only non-zero entries (trace stays compact)
    this.formulaPlus = plusRaw.filter((i) => i.v > 0);
    this.formulaMinus = minusRaw.filter((i) => i.v > 0);

    this.formulaPlusSumN = this.formulaPlus.reduce((a, b) => a + b.v, 0);
    this.formulaMinusSumN = this.formulaMinus.reduce((a, b) => a + b.v, 0);
    this.formulaNetN = this.formulaPlusSumN - this.formulaMinusSumN;
  }

  findDailyActivitiesAmount() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );

    this.day = this.time.getDayOfWeek(this.requestDateCorrectFormat); // ✅ same as good page

    this.initalizeInputs();
    this.recomputeHeaderReasons(); // ⬅ use new function
    this.computeRequestTotalSameAsRequestToday();
  }

  findClientsWithDebts() {
    let total = 0;

    // Filter clients who have debt and whose payment day matches today
    if (this.clients) {
      this.clientsWithDebts = this.data.findClientsWithDebts(this.clients);
    }
    this.clientsWithDebts = this.clientsWithDebts!.filter((data) => {
      return (
        data.paymentDay === this.day && this.data.didClientStartThisWeek(data)
      );
    });

    // Calculate the total debt for these clients
    this.expectedReserve = this.compute
      .computeExpectedPerDate(this.clientsWithDebts)
      .toString();
    this.expectedReserveInDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.expectedReserve)
      .toString();
    const expected = Number(this.expectedReserve);
    const actual = Number(this.dailyPayment);

    if (expected === 0) {
      this.percentage = actual > 0 ? '100.00' : '0.00';
    } else {
      this.percentage = ((actual / expected) * 100).toFixed(2);
    }
    this.perc = Number(this.percentage);
  }
  async setDailyField(mapField: string, value: any) {
    if (!this.compute.isNumber(value)) {
      alert('Entrez un nombre valide');
      return;
    }

    try {
      await this.auth.updateNestedUserField(
        mapField,
        this.requestDateCorrectFormat, // ex. "5-17-2025"
        `${value}` // ex. value
      );
      alert('Montant changé avec succès');
      this.initalizeInputs(); // rafraîchit l’écran
    } catch (err) {
      alert('Erreur lors de la mise à jour, réessayez');
    }
  }

  private parseIsoDate(dateIso: string): Date | null {
    const value = (dateIso || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }
    const [y, m, d] = value.split('-').map((v) => Number(v));
    const parsed = new Date(y, m - 1, d);
    if (
      parsed.getFullYear() !== y ||
      parsed.getMonth() + 1 !== m ||
      parsed.getDate() !== d
    ) {
      return null;
    }
    return parsed;
  }

  get hasProjectedWeeklyTarget(): boolean {
    return (
      this.projectedWeeklyTargetFc != null &&
      Number.isFinite(this.projectedWeeklyTargetFc) &&
      this.projectedWeeklyTargetFc > 0 &&
      !!this.projectedWeeklyTargetEffectiveDate
    );
  }

  get projectedWeeklyTargetDeltaFc(): number {
    if (this.projectedWeeklyTargetFc == null) return 0;
    return this.projectedWeeklyTargetFc - this.weeklyTargetFc;
  }

  get projectedWeeklyTargetEffectiveDateLabel(): string {
    const parsed = this.parseIsoDate(this.projectedWeeklyTargetEffectiveDate);
    if (!parsed) {
      return this.projectedWeeklyTargetEffectiveDate || 'date non définie';
    }
    return parsed.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private resolveWeeklyTargetFc(): number {
    const userOverride = Number(this.auth.currentUser?.weeklyPaymentTargetFc);
    if (Number.isFinite(userOverride) && userOverride > 0) {
      return userOverride;
    }

    const globalTarget = Number(this.auth.weeklyPaymentTargetFc);
    if (Number.isFinite(globalTarget) && globalTarget > 0) {
      return globalTarget;
    }

    return 600000;
  }

  private syncWeeklyTargetFc() {
    this.weeklyTargetFc = this.resolveWeeklyTargetFc();
    this.weeklyTargetReached = this.weeklyPaymentTotalN >= this.weeklyTargetFc;
    this.weeklyProgressPercent =
      this.weeklyTargetFc === 0
        ? 0
        : Math.min(
            100,
            (this.weeklyPaymentTotalN / this.weeklyTargetFc) * 100
          );
    this.updateWeekPickerTotals();
    this.computeMonthlyWeeklyShortfalls();
  }

  async setWeeklyTargetForUser() {
    if (!this.auth.isAdmin) return;
    const value = Number(this.weeklyTargetInput);
    if (!Number.isFinite(value) || value <= 0) {
      alert('Entrez un nombre valide');
      return;
    }

    try {
      await this.auth.setUserField('weeklyPaymentTargetFc', value.toString());
      this.auth.currentUser.weeklyPaymentTargetFc = value.toString();
      this.weeklyTargetInput = '';
      this.syncWeeklyTargetFc();
      alert('Objectif mis à jour');
    } catch (err) {
      alert('Erreur lors de la mise à jour, réessayez');
    }
  }

  // ③  snapshotChanges to capture docId
  private loadReceipts() {
    const limit = this.auth.isAdmin ? 50 : 2;
    this.afs
      .collection(
        `users/${this.auth.currentUser.uid}/transportReceipts`,
        (ref) => ref.orderBy('ts', 'desc').limit(limit)
      )
      .snapshotChanges()
      .subscribe((snaps) => {
        this.receipts = snaps.map((s) => {
          const data = s.payload.doc.data() as any;
          const id = s.payload.doc.id;
          return {
            docId: id,
            url: data.url,
            ts: data.ts,
            frenchDate: this.time.formatEpochLongFr(data.ts),
            // inside map()
            amount: data.amount ?? 0,
            type: data.type ?? 'image/*',
          };
        });
      });
  }

  // ④  helper used by *ngFor to apply search & admin-limit
  filteredReceipts() {
    const list = this.receipts.filter(
      (r) =>
        !this.searchText ||
        r.frenchDate.toLowerCase().includes(this.searchText.toLowerCase())
    );

    // Non-admin always sees only 2
    if (!this.auth.isAdmin) {
      return list.slice(0, 2);
    }
    // Admin sees 2 initially, all if expanded
    return this.showAllReceipts ? list : list.slice(0, 2);
  }

  // ⑤  when admin clicks “Changer”
  prepareUpdate(r: Receipt) {
    this.selectedDocId = r.docId;
    this.selectedTs = r.ts; //  ←  remember current timestamp
    this.fileInput.nativeElement.click();
  }

  // ⑥  upload & overwrite the existing document
  async replaceReceipt(files: FileList | null) {
    if (!files?.length || !this.selectedDocId) return;

    const file = files.item(0)!;
    const type = file.type;
    /* … same size/type/HEIC checks … */
    try {
      const path = `transportReceipts/${this.auth.currentUser.uid}/${this.selectedDocId}`;
      const upload = await this.storage.upload(path, file);
      const url = await upload.ref.getDownloadURL();

      // ⚠️  update the document WITHOUT touching ts
      await this.afs
        .doc(
          `users/${this.auth.currentUser.uid}/transportReceipts/${this.selectedDocId}`
        )
        .update({ url, type });
      alert('✅ Reçu mis à jour');
      this.loadReceipts();
    } catch (e) {
      alert('❌ Impossible de remplacer le reçu — réessayez.');
    }

    this.selectedDocId = '';
    this.fileInput.nativeElement.value = '';
  }

  async uploadReceipt(files: FileList | null) {
    if (!this.auth.isAdmin || !files?.length) return;
    if (this.newReceiptAmount == null || this.newReceiptAmount <= 0) {
      alert('Entrez un montant valide avant d’envoyer le reçu');
      return;
    }

    const file = files.item(0)!;
    const id = this.afs.createId();
    const path = `transportReceipts/${this.auth.currentUser.uid}/${id}`;

    try {
      const task = await this.storage.upload(path, file);
      const url = await task.ref.getDownloadURL();
      const amount = Number(this.newReceiptAmount);
      const type = file.type; // NEW

      await this.afs
        .doc(`users/${this.auth.currentUser.uid}/transportReceipts/${id}`)
        .set({ url, ts: Date.now(), amount, type });

      alert('📸 Reçu ajouté avec succès');
      this.newReceiptAmount = null; // reset the field
      this.loadReceipts();
    } catch (e) {
      alert('❌ Échec de l’envoi — réessayez.');
    }
  }
  async updateAmount(r: Receipt) {
    if (r.amount == null || r.amount <= 0) {
      alert('Montant invalide');
      return;
    }
    try {
      await this.afs
        .doc(`users/${this.auth.currentUser.uid}/transportReceipts/${r.docId}`)
        .update({ amount: Number(r.amount) });
    } catch {
      alert('Erreur lors de la mise à jour du montant');
    }
  }

  private computeRequestTotalSameAsRequestToday() {
    const todayKey = this.requestDateCorrectFormat;
    const tomorrowKey = this.addDaysToKey(todayKey, 1);

    // today
    this.requestTotalToday = this.sumRequestTotalForDate(todayKey);

    // tomorrow (relative to currently selected date)
    this.requestTotalTomorrow = this.sumRequestTotalForDate(tomorrowKey);

    // push into tiles
    this.summaryContent[9] = `${this.requestTotalToday}`;
    this.valuesConvertedToDollars[9] = `${this.compute.convertCongoleseFrancToUsDollars(
      this.requestTotalToday.toString()
    )}`;

    this.summaryContent[10] = `${this.requestTotalTomorrow}`;
    this.valuesConvertedToDollars[10] = `${this.compute.convertCongoleseFrancToUsDollars(
      this.requestTotalTomorrow.toString()
    )}`;

    this.updateOkChips(); // keeps your header status logic in sync
  }

  private updateOkChips() {
    this.okMoney = this.moneyInHandsTotalN === 0;
    this.okRequested = this.requestTotalToday === 0;

    // include the new reasons criterion
    this.okCount =
      (this.okMoney ? 1 : 0) +
      (this.okRequested ? 1 : 0) +
      (this.okReasons ? 1 : 0);
  }

  /** Did this client register any payment on the selected date? */
  private hasPaidOnDate(c: Client, dateKey: string): boolean {
    const req = this.normDateOnly(dateKey);
    const keys = Object.keys(c?.payments || {});
    return keys.some((k) => {
      const nk = this.normDateOnly(k);
      // accept exact normalized match, OR literal startsWith to match your older pattern
      return nk === req || k.startsWith(dateKey);
    });
  }

  private getTodaysComment(client: Client) {
    if (!client?.comments?.length) return null;
    const req = this.normDateOnly(this.requestDateCorrectFormat);
    return (
      client.comments.find((c: any) => {
        const t = (c?.time || c?.date || '').toString();
        const nt = this.normDateOnly(t);
        return nt === req || t.startsWith(this.requestDateCorrectFormat);
      }) || null
    );
  }

  /** Normalise a "MM-DD-YYYY" string to "M-D-YYYY" (no leading zeros). */
  /** Normalize any date-ish string (MM-DD-YYYY, M/D/YYYY, YYYY-MM-DD, with or without time) to "M-D-YYYY". */
  private normDateOnly(s?: string): string {
    if (!s) return '';
    const nums = (s.match(/\d+/g) || []).map(Number);
    if (nums.length < 3) return '';
    let y: number, m: number, d: number;
    if (String(nums[0]).length === 4) {
      // YYYY-...
      y = nums[0];
      m = nums[1];
      d = nums[2];
    } else {
      // M-D-YYYY ...
      m = nums[0];
      d = nums[1];
      y = nums[2];
    }
    if (!y || !m || !d) return '';
    return `${m}-${d}-${y}`;
  }

  /** True if client’s debt cycle started >6 days before the selected date. */
  private startedBeforeSelectedWeek(c: Client): boolean {
    const s = this.normDateOnly((c as any).debtCycleStartDate || '');
    if (!s) return true;
    const [sm, sd, sy] = s.split('-').map(Number);

    const [tm, td, ty] = this.normDateOnly(this.requestDateCorrectFormat)
      .split('-')
      .map(Number);
    const ref = new Date(ty, tm - 1, td); // selected day
    ref.setDate(ref.getDate() - 6); // a week window

    const start = new Date(sy, sm - 1, sd);
    return start <= ref;
  }

  private buildShouldPayToday(): Client[] {
    const dayName = this.time.getDayOfWeek(this.requestDateCorrectFormat);
    return (this.clients || []).filter((c) => c.paymentDay === dayName);
  }
  /** Mirror NotPaidToday's pipeline to drive Δ Raisons in the header */
  private recomputeHeaderReasons() {
    if (!this.clients?.length) {
      this.reasonsMissing = 0;
      this.reasonsTotal = 0;
      this.okReasons = true;
      this.updateOkChips();
      return;
    }

    // 1) who should pay today
    const shouldPay = this.buildShouldPayToday();

    // 2) who already paid today
    const paidTodaySet = new Set(
      shouldPay
        .filter((c) => this.hasPaidOnDate(c, this.requestDateCorrectFormat))
        .map((c) => c.uid || c.trackingId || `${c.firstName}|${c.lastName}`)
    );

    const idOf = (c: Client) =>
      c.uid || c.trackingId || `${c.firstName}|${c.lastName}`;
    const isAlive = (c: Client) =>
      !c.vitalStatus || c.vitalStatus.toLowerCase() === 'vivant';

    // 3) common criteria (same spirit as NotPaidToday)
    const notStartedToday = (c: Client) =>
      this.normDateOnly((c as any).debtCycleStartDate || '') !==
      this.normDateOnly(this.requestDateCorrectFormat);

    const common = (c: Client) =>
      !paidTodaySet.has(idOf(c)) &&
      Number(c.debtLeft ?? 0) > 0 &&
      notStartedToday(c) &&
      this.startedBeforeSelectedWeek(c);
    // 4) split like the good page (current vs away), then merge for global check
    const notPaidCurrent = shouldPay.filter((c) => common(c) && isAlive(c));
    // const notPaidAway = shouldPay.filter((c) => common(c) && !isAlive(c));
    const notPaidAll = [...notPaidCurrent];

    // 5) header numbers
    this.reasonsTotal = notPaidAll.length;
    this.reasonsMissing = notPaidAll.filter(
      (c) => !this.getTodaysComment(c)
    ).length;
    this.okReasons = this.reasonsMissing === 0;

    // NEW: amount outstanding for those who did not pay today
    this.notPaidAmountTodayN = this.compute.computeExpectedPerDate(notPaidAll);

    // push into tile #0 (FC + $)
    this.summaryContent[0] = `${this.notPaidAmountTodayN}`;
    this.valuesConvertedToDollars[0] = `${this.compute.convertCongoleseFrancToUsDollars(
      this.notPaidAmountTodayN.toString()
    )}`;

    this.updateOkChips();
  }

  get isMoneyLocked(): boolean {
    return !this.auth.isAdmin && !this.isPayUnlocked;
  }

  get canShowPercentage(): boolean {
    return this.auth.isAdmin || this.isPercentageUnlocked;
  }

  /** Pour sécuriser l’affichage de la jauge et des classes */
  get clampedPerc(): number {
    const p = Number(this.perc || 0);
    return Math.max(0, Math.min(100, isFinite(p) ? p : 0));
  }

  /** Add (or subtract) days to a "M-D-YYYY" or "MM-DD-YYYY" key and return "M-D-YYYY". */
  private addDaysToKey(mdY: string, days: number): string {
    const [m, d, y] = this.normDateOnly(mdY).split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    return `${dt.getMonth() + 1}-${dt.getDate()}-${dt.getFullYear()}`;
  }

  /** Sum request amounts for a target date (mirrors your request-today logic). */
  private sumRequestTotalForDate(target: string): number {
    let total = 0;

    // Clients (lending/savings/rejection)
    for (const c of this.clients || []) {
      if (c.requestStatus && c.requestDate === target) {
        if (
          c.requestType === 'lending' &&
          c.agentSubmittedVerification === 'true'
        ) {
          total += Number(c.requestAmount ?? 0);
        } else if (
          c.requestType === 'savings' ||
          c.requestType === 'rejection'
        ) {
          total += Number(c.requestAmount ?? 0);
        }
      }
    }

    // Cards
    for (const k of this.cards || []) {
      if (
        k.requestStatus &&
        k.requestType === 'card' &&
        k.requestDate === target
      ) {
        total += Number(k.requestAmount ?? 0);
      }
    }

    return total;
  }
}
