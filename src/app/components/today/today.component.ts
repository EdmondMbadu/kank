import { Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
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
    this.detailOpen = new Date().getHours() >= 15;
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

  percentage: string = '0';
  perc: number = 0;
  dailyLending: string = '0';
  dailyPayment: string = '0';
  dailyPaymentDollars: string = '0';
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
  // ───── unlocking state ─────────────────────────────────────────
  codesStored: string[] = (this.auth.currentUser?.teamCode ?? '')
    .split('-')
    .map((c: any) => c.trim())
    .filter((c: any) => !!c);

  isPayUnlocked = false; // everyone starts locked
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
      ``,
      ` ${this.dailyPayment}`,
      ` ${this.dailyLending}`,
      ` ${this.dailyFees}`,
      ` ${this.dailyReserve}`,
      `${this.dailyInvestment}`,
      `${this.dailySaving}`,
      `${this.dailySavingReturns}`,
      `${this.dailyFeesReturns}`,
      '',
      '',
      `${this.dailyExpense}`,
      `${this.dailyLoss}`,
      // `${this.tomorrowMoneyRequests}`,
    ];
    this.dailyPaymentDollars = this.compute
      .convertCongoleseFrancToUsDollars(this.dailyPayment)
      .toString();
    this.valuesConvertedToDollars = [
      ``,
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
      ``,
      ``,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyExpense)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyLoss)}`,
      // `${this.compute.convertCongoleseFrancToUsDollars(
      //   this.dailyMoneyRequests
      // )}`,
      // `${this.compute.convertCongoleseFrancToUsDollars(
      //   this.tomorrowMoneyRequests
      // )}`,
    ];
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
    if (Number(this.expectedReserve) === 0) {
      this.percentage = '0.00';
    } else {
      this.percentage = (
        (Number(this.dailyPayment) / Number(this.expectedReserve)) *
        100
      ).toFixed(2);
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

    return this.auth.isAdmin ? list : list.slice(0, 2);
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
    const target = this.requestDateCorrectFormat;
    let total = 0;

    // Clients (lending/savings/rejection)
    if (this.clients?.length) {
      for (const c of this.clients) {
        if (c.requestStatus && c.requestDate === target) {
          // lending only if verified by agent (mirrors your request-today)
          if (
            c.requestType === 'lending' &&
            c.agentSubmittedVerification === 'true'
          ) {
            total += Number(c.requestAmount ?? 0);
          } else if (c.requestType === 'savings') {
            total += Number(c.requestAmount ?? 0);
          } else if (c.requestType === 'rejection') {
            total += Number(c.requestAmount ?? 0);
          }
        }
      }
    }

    // Cards
    if (this.cards?.length) {
      for (const k of this.cards) {
        if (
          k.requestStatus &&
          k.requestType === 'card' &&
          k.requestDate === target
        ) {
          total += Number(k.requestAmount ?? 0);
        }
      }
    }

    this.requestTotalToday = total;
    this.updateOkChips();
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

    this.updateOkChips();
  }
}
