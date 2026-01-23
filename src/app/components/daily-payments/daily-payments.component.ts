import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
interface DayTotalsDoc {
  dayKey: string;
  total?: number;
  count?: number;
  expected?: number;
  dayStartMs?: number;
  expectedSetMs?: number;
  monthKey?: string;
  updatedAtMs?: number;
}

@Component({
  selector: 'app-daily-payments',
  templateUrl: './daily-payments.component.html',
  styleUrls: ['./daily-payments.component.css'],
})
export class DailyPaymentsComponent implements OnInit {
  // ADMIN state
  adminSelectedEmployeeUid: string = '';
  adminDate: string = this.time.getTodaysDateYearMonthDay(); // "YYYY-MM-DD"
  adminDayKey: string = this.time.convertDateToMonthDayYear(this.adminDate); // "MM-DD-YYYY"
  adminLoaded?: DayTotalsDoc | null;

  adminTotalInput: number | null = null;
  adminExpectedInput: number | null = null;
  adminCountInput: number | null = null;

  adminBusy = false;
  adminMsg = '';
  adminMsgType: 'ok' | 'err' | '' = '';

  clients?: Client[];
  employees: Employee[] = [];
  today = this.time.todaysDateMonthDayYear();
  todayFrench = this.time.convertDateToDayMonthYear(this.today);
  dailyPayments?: Filtered[] = [];
  dailyPaymentsCopy?: Filtered[] = [];
  dailyPaymentsNames: string[] = [];
  dailyPamentsAmount: string[] = [];
  trackingIds: string[] = [];
  searchControl = new FormControl();
  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  numberOfPeople: string = '0';
  totalGivenDate: string = '0';
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  agentRanking: AgentRank[] = [];
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private data: DataService,
    private afs: AngularFirestore // <-- inject
  ) {
    this.retrieveClients();
  }
  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => this.search(value))
      )
      .subscribe((results) => {
        this.dailyPayments = results;
      });
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = Array.isArray(data) ? data : [];
      this.assignTrackingIds();
      this.retrieveEmployees();
    });
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = Array.isArray(data) ? data : [];
      this.addIdToFilterItems();
      this.extractTodayPayments();
    });
  }
  addIdToFilterItems() {
    if (!this.clients?.length) return;
    for (let i = 0; i < this.clients.length; i++) {
      this.clients![i].trackingId = `${i}`;
      let emp = this.employees.find(
        (element) => element.uid === this.clients![i].agent
      );
      this.clients![i].employee = emp;
    }
  }

  private assignTrackingIds(): void {
    if (!this.clients?.length) return;
    this.clients.forEach((client, index) => {
      client.trackingId = `${index}`;
    });
  }

  extractTodayPayments() {
    this.dailyPamentsAmount = [];
    this.dailyPaymentsNames = [];
    this.totalGivenDate = '0';
    this.numberOfPeople = '0';
    this.trackingIds = [];
    this.dailyPayments = [];
    this.dailyPaymentsCopy = [];

    if (!this.clients?.length) {
      this.computeAgentRanking();
      return;
    }

    for (let client of this.clients!) {
      const paymentsEntries = client.payments
        ? Object.entries(client.payments)
        : [];
      const previousPaymentsEntries = client.previousPayments
        ? Object.entries(client.previousPayments)
        : [];
      const combinedEntries = [...paymentsEntries, ...previousPaymentsEntries];

      const filteredDict = Object.fromEntries(
        combinedEntries.filter(([key]) =>
          key.startsWith(this.requestDateCorrectFormat)
        )
      );

      const filteredValues = Object.values(filteredDict); // strings
      const filteredKeys = Object.keys(filteredDict);

      if (filteredValues.length !== 0) {
        // sum paid today for this client
        const paidToday = filteredValues.reduce((acc, v) => acc + this.n(v), 0);
        const expectedToday = this.computeExpectedMin(client);
        const progressPct =
          expectedToday > 0
            ? Math.min((paidToday / expectedToday) * 100, 100)
            : 100;

        this.fillDailyPayment(
          client,
          filteredValues,
          filteredKeys,
          paidToday,
          expectedToday,
          progressPct
        );
      }
    }

    this.computeAgentRanking();
  }

  fillDailyPayment(
    client: Client,
    values: string[],
    keys: string[],
    paidToday: number,
    expectedToday: number,
    progressPct: number
  ) {
    let i = 0;

    for (let v of values) {
      const middleName =
        client.middleName === undefined ? '' : client.middleName;

      const filt: Filtered = {
        firstName: client.firstName,
        lastName: client.lastName,
        middleName,
        amount: this.n(v), // store as number for formatting
        time: keys[i++],
        timeFormatted: this.time.convertDateToDesiredFormat(keys[i - 1]),
        employee: client.employee,
        trackingId: client.trackingId,
        // NEW: progress context for the client (same on each of today’s rows)
        expectedToday,
        paidToday,
        progressPct,
        delta: paidToday - expectedToday,
      };

      if (this.n(v) !== 0) {
        this.dailyPayments!.push(filt);
        this.totalGivenDate = (
          this.n(v) + this.n(this.totalGivenDate)
        ).toString();
        this.dailyPaymentsCopy!.push(filt);
      }
    }

    // Dedup + counts
    this.dailyPayments = this.data.removeDuplicates(this.dailyPayments!);
    this.dailyPaymentsCopy = this.data.removeDuplicates(
      this.dailyPaymentsCopy!
    );
    this.numberOfPeople = this.dailyPayments!.length.toString();

    // Sort by time desc
    this.dailyPayments!.sort(
      (a, b) =>
        this.time.parseDate(b.time!).getTime() -
        this.time.parseDate(a.time!).getTime()
    );
    this.dailyPaymentsCopy!.sort(
      (a, b) =>
        this.time.parseDate(b.time!).getTime() -
        this.time.parseDate(a.time!).getTime()
    );
  }

  search(value: string) {
    if (value) {
      const lowerCaseValue = value.toLowerCase();
      return of(
        this.dailyPaymentsCopy!.filter(
          (client) =>
            client.firstName?.toLowerCase().includes(lowerCaseValue) ||
            client.lastName?.toLowerCase().includes(lowerCaseValue) ||
            client.middleName?.toLowerCase().includes(lowerCaseValue)
        )
      );
    } else {
      return of(this.dailyPaymentsCopy);
    }
  }
  findDailyPayments() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );
    // Reinitialize daily payments and related properties
    this.dailyPayments = [];
    this.dailyPaymentsCopy = [];
    this.totalGivenDate = '0'; // Assuming it's a string representation of the total amount
    this.numberOfPeople = '0';

    this.extractTodayPayments();
    // this.initalizeInputs();
  }

  // Add these helpers inside the component class
  private isWorkingStatus(status?: string | null): boolean {
    const s = (status ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
    // tolerate variations: "travail", "travaille", "working", "actif"
    return (
      s === 'travail' ||
      s === 'travaille' ||
      s === 'working' ||
      s === 'actif' ||
      s.includes('travail')
    );
  }

  private getCurrentWorkingEmployee(): Employee | undefined {
    const working = (this.employees ?? []).filter((e) =>
      this.isWorkingStatus(e.status)
    );
    if (working.length === 1) return working[0];

    // tie-breaker: prefer the logged-in employee if they’re marked working
    const meUid = (this.auth?.currentUser as any)?.uid;
    if (meUid) {
      const me = working.find((e) => e.uid === meUid);
      if (me) return me;
    }
    // otherwise, just pick the first working employee (stable/fallback)
    return working[0];
  }

  // Replace your computeAgentRanking with this
  private computeAgentRanking(): void {
    const agg = new Map<string, AgentRank>();

    const currentWorking = this.getCurrentWorkingEmployee(); // may be undefined

    for (const p of this.dailyPaymentsCopy || []) {
      const assigned = p.employee;
      const assignedIsWorking = this.isWorkingStatus(assigned?.status);

      // choose the target employee for aggregation
      let target: Employee | undefined;
      if (assignedIsWorking) {
        target = assigned!;
      } else if (currentWorking) {
        // re-route to the currently working employee
        target = currentWorking;
      } else {
        // no one marked working -> keep original (but never bucket as "Other")
        target = assigned;
      }

      const id = target?.uid || 'no-agent';
      const name = target
        ? `${target.firstName ?? ''} ${target.lastName ?? ''}`.trim() ||
          'Sans agent'
        : 'Sans agent';

      const amount = Number(p.amount || 0);

      if (!agg.has(id)) {
        agg.set(id, {
          id,
          name,
          total: 0,
          count: 0,
          inactive: target ? !this.isWorkingStatus(target.status) : false,
        });
      }
      const curr = agg.get(id)!;
      curr.total += amount;
      curr.count += 1;
    }

    this.agentRanking = Array.from(agg.values()).sort(
      (a, b) =>
        b.total - a.total || b.count - a.count || a.name.localeCompare(b.name)
    );
  }
  private n(v: any): number {
    const num = Number(v);
    return isNaN(num) ? 0 : num;
  }

  /** Min due today: min( amountToPay / paymentPeriodRange, debtLeft ) */
  private computeExpectedMin(client: Client): number {
    const amountToPay = this.n(client.amountToPay);
    const period = Math.max(this.n(client.paymentPeriodRange), 1); // avoid /0
    const perPeriod = amountToPay / period;
    const debtLeft = Math.max(this.n((client as any).debtLeft), 0); // tolerate missing field
    return Math.min(perPeriod, debtLeft);
  }

  // --- Admin helpers ---
  onAdminSelectionChanged(): void {
    // keep dayKey in your existing system's format (sample shows "10-13-2025")
    this.adminDayKey = this.time.convertDateToMonthDayYear(this.adminDate);
    this.adminMsg = '';
    this.adminMsgType = '';
    // Optionally auto-load
    // if (this.adminSelectedEmployeeUid) this.loadAdminDayTotals();
  }

  resetAdminInputs(): void {
    this.adminTotalInput = null;
    this.adminExpectedInput = null;
    this.adminCountInput = null;
    this.adminMsg = '';
    this.adminMsgType = '';
  }

  private startOfDayMsFromISO(iso: string): number {
    const d = new Date(iso);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }

  private monthKeyFromISO(iso: string): string {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private buildDayTotalsPath(
    ownerUid: string,
    employeeUid: string,
    dayKey: string
  ): string {
    return `users/${ownerUid}/employees/${employeeUid}/dayTotals/${dayKey}`;
  }

  async loadAdminDayTotals(): Promise<void> {
    if (!this.adminSelectedEmployeeUid) return;
    this.adminBusy = true;
    this.adminMsg = '';
    this.adminMsgType = '';

    try {
      const ownerUid = this.auth.currentUser?.uid;
      if (!ownerUid) throw new Error('Owner UID manquant');

      const path = this.buildDayTotalsPath(
        ownerUid,
        this.adminSelectedEmployeeUid,
        this.adminDayKey
      );
      const snap = await this.afs.doc(path).ref.get();

      if (snap.exists) {
        const data = (snap.data() as any) || {};
        this.adminLoaded = {
          dayKey: data?.dayKey ?? this.adminDayKey,
          total: Number(data?.total ?? 0),
          count: Number(data?.count ?? 0),
          expected: Number(data?.expected ?? 0),
          dayStartMs: Number(data?.dayStartMs ?? 0),
          expectedSetMs: Number(data?.expectedSetMs ?? 0),
          monthKey: data?.monthKey ?? this.monthKeyFromISO(this.adminDate),
          updatedAtMs: Number(data?.updatedAtMs ?? 0),
        };

        // Pre-fill inputs only if empty (keeps admin’s manual edits)
        if (this.adminTotalInput == null)
          this.adminTotalInput = this.adminLoaded.total ?? null;
        if (this.adminExpectedInput == null)
          this.adminExpectedInput = this.adminLoaded.expected ?? null;
        if (this.adminCountInput == null)
          this.adminCountInput = this.adminLoaded.count ?? null;

        this.adminMsg = 'Données chargées.';
        this.adminMsgType = 'ok';
      } else {
        this.adminLoaded = { dayKey: this.adminDayKey };
        this.adminMsg = 'Aucune donnée pour ce jour — nouveau document.';
        this.adminMsgType = 'ok';
      }
    } catch (e: any) {
      this.adminMsg = e?.message || 'Erreur lors du chargement.';
      this.adminMsgType = 'err';
    } finally {
      this.adminBusy = false;
    }
  }

  async saveAdminDayTotals(): Promise<void> {
    if (!this.adminSelectedEmployeeUid) return;
    this.adminBusy = true;
    this.adminMsg = '';
    this.adminMsgType = '';

    try {
      const ownerUid = this.auth.currentUser?.uid;
      if (!ownerUid) throw new Error('Owner UID manquant');

      const nowMs = Date.now();
      const payload: any = {
        dayKey: this.adminDayKey,
        dayStartMs: this.startOfDayMsFromISO(this.adminDate),
        monthKey: this.monthKeyFromISO(this.adminDate),
        updatedAtMs: nowMs,
      };

      // Only set fields the admin provided (so we don’t clobber unintentionally)
      if (this.adminTotalInput != null && !isNaN(this.adminTotalInput)) {
        payload.total = Number(this.adminTotalInput);
      }

      if (this.adminExpectedInput != null && !isNaN(this.adminExpectedInput)) {
        payload.expected = Number(this.adminExpectedInput);
        payload.expectedSetMs = nowMs;
      }

      if (this.adminCountInput != null && !isNaN(this.adminCountInput)) {
        payload.count = Number(this.adminCountInput);
      }

      const path = this.buildDayTotalsPath(
        ownerUid,
        this.adminSelectedEmployeeUid,
        this.adminDayKey
      );
      await this.afs.doc(path).set(payload, { merge: true });

      // Refresh view
      await this.loadAdminDayTotals();

      this.adminMsg = 'Enregistré avec succès.';
      this.adminMsgType = 'ok';
    } catch (e: any) {
      this.adminMsg = e?.message || 'Erreur lors de l’enregistrement.';
      this.adminMsgType = 'err';
    } finally {
      this.adminBusy = false;
    }
  }
}

export class Filtered {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  date?: string;
  amount?: number; // ← numeric now for easy formatting
  time?: string;
  timeFormatted?: string;
  employee?: Employee;
  trackingId?: string;

  // NEW
  expectedToday?: number; // min due today
  paidToday?: number; // sum of today's payments for this client
  progressPct?: number; // 0..100
  delta?: number; // paidToday - expectedToday
}

// Add this interface near your other interfaces/classes
interface AgentRank {
  id: string; // employee uid or special bucket id
  name: string; // display name ("Autre" for inactive bucket)
  total: number; // total FC
  count: number; // number of payments
  inactive?: boolean;
}
