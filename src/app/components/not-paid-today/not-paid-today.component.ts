import { Component, Pipe, PipeTransform } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { min } from 'rxjs';
import { DataService } from 'src/app/services/data.service';

@Component({
  selector: 'app-not-paid-today',
  templateUrl: './not-paid-today.component.html',
  styleUrls: ['./not-paid-today.component.css'],
})
export class NotPaidTodayComponent {
  clients?: Client[];
  shouldPayToday: Client[] = [];
  employees: Employee[] = [];
  haveNotPaidToday: Client[] = [];
  totalGivenDate: number = 0;
  paidToday: Client[] = [];
  numberOfPeople: number = 0;
  today = this.time.todaysDateMonthDayYear();
  filteredItems?: Client[];
  dailyPaymentsNames: string[] = [];
  dailyPamentsAmount: string[] = [];
  trackingIds: string[] = [];
  searchControl = new FormControl();

  requestDate: string = this.time.getTodaysDateYearMonthDay();
  requestDateCorrectFormat = this.today;
  frenchDate = this.time.convertDateToDayMonthYear(this.today);

  /** NEW: summary counters */
  missingCount = 0;
  totalReasons = 0;

  sendingAgents = false; // NEW
  // NEW
  view: 'current' | 'away' = 'current';
  haveNotPaidCurrent: Client[] = [];
  haveNotPaidAway: Client[] = [];
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService,
    private fns: AngularFireFunctions,
    private data: DataService
  ) {
    this.retrieveClients();
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      this.retrieveEmployees();
      this.filteredItems = data;

      this.extractTodayPayments();
      this.filterPayments();
      this.findThoseWhoHaveNotPaidToday();
      // this.totalGivenDate = this.compute.computeExpectedPerDate(
      //   this.haveNotPaidToday
      // );
      // this.numberOfPeople = this.haveNotPaidToday.length;
    });
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.addIdToFilterItems();
    });
  }

  addIdToFilterItems() {
    for (let i = 0; i < this.filteredItems!.length; i++) {
      this.filteredItems![i].trackingId = `${i}`;
      let emp = this.employees.find(
        (element) => element.uid === this.filteredItems![i].agent
      );
      this.filteredItems![i].employee = emp;
    }
  }

  extractTodayPayments() {
    this.dailyPamentsAmount = [];
    this.dailyPaymentsNames = [];
    this.paidToday = [];
    this.trackingIds = [];
    if (this.clients) {
      for (let client of this.clients!) {
        const filteredDict = client.payments
          ? Object.fromEntries(
              Object.entries(client.payments).filter(([key, value]) =>
                key.startsWith(this.requestDateCorrectFormat)
              )
            )
          : {};
        const filteredValues = Object.values(filteredDict);
        if (filteredValues.length !== 0) {
          this.paidToday.push(client);
          this.fillDailyPayment(client, filteredValues);
        }
      }
    }
  }
  // findThoseWhoHaveNotPaidToday() {
  //   this.haveNotPaidToday = [];
  //   if (this.shouldPayToday) {
  //     for (let c of this.shouldPayToday) {
  //       const isAlive =
  //         c.vitalStatus === undefined ||
  //         c.vitalStatus === '' ||
  //         c.vitalStatus.toLowerCase() === 'vivant';
  //       // return isAlive && Number(c.debtLeft) > 0;
  //       if (
  //         this.paidToday.indexOf(c) === -1 &&
  //         isAlive &&
  //         Number(c.debtLeft) > 0 &&
  //         !c.debtCycleStartDate?.startsWith(this.requestDateCorrectFormat) &&
  //         this.didClientStartThisWeek(c)
  //       ) {
  //         c.minPayment = (
  //           Number(c.amountToPay) / Number(c.paymentPeriodRange)
  //         ).toString();
  //         this.haveNotPaidToday.push(c);
  //       }
  //     }
  //   }
  //   console.log('have not paid today', this.haveNotPaidToday);
  // }
  // ─────────────────────────── FIND WHO HASN’T PAID
  findThoseWhoHaveNotPaidToday() {
    this.haveNotPaidCurrent = [];
    this.haveNotPaidAway = [];

    if (!this.shouldPayToday) return;

    for (const c of this.shouldPayToday) {
      const isAlive =
        !c.vitalStatus || c.vitalStatus.toLowerCase() === 'vivant';

      const commonCriteria =
        this.paidToday.indexOf(c) === -1 &&
        Number(c.debtLeft) > 0 &&
        !c.debtCycleStartDate?.startsWith(this.requestDateCorrectFormat) &&
        this.didClientStartThisWeek(c);

      if (commonCriteria && isAlive) {
        c.minPayment = (
          Number(c.amountToPay) / Number(c.paymentPeriodRange)
        ).toString();
        this.haveNotPaidCurrent.push(c);
      } else if (commonCriteria && !isAlive) {
        c.minPayment = (
          Number(c.amountToPay) / Number(c.paymentPeriodRange)
        ).toString();
        this.haveNotPaidAway.push(c);
      }
    }

    this.updateSummary();
  }

  // ─────────────────────────── UPDATE HEADER NUMBERS
  updateSummary() {
    const activeArray =
      this.view === 'current' ? this.haveNotPaidCurrent : this.haveNotPaidAway;

    this.totalGivenDate = this.compute.computeExpectedPerDate(activeArray);
    this.numberOfPeople = activeArray.length;

    /* NEW ↓ count comments */
    this.totalReasons = activeArray.length;
    this.missingCount = activeArray.filter(
      (c) => !this.getTodaysComment(c)
    ).length;
  }
  // ─────────────────────────── BUTTON HANDLER
  switchView(mode: 'current' | 'away') {
    if (this.view === mode) return;
    this.view = mode;
    this.updateSummary();
  }

  fillDailyPayment(client: Client, values: string[]) {
    for (let v of values) {
      this.dailyPaymentsNames.push(`${client.firstName} ${client.lastName}`);
      this.dailyPamentsAmount.push(v);
      this.trackingIds.push(client.trackingId!);
    }
  }
  filterPayments() {
    this.shouldPayToday = [];
    let day = this.time.getDayOfWeek(this.requestDateCorrectFormat);
    for (let client of this.clients!) {
      if (client.paymentDay === day) {
        this.shouldPayToday.push(client);
      }
    }
  }

  didClientStartThisWeek(client: Client) {
    const convertToDateCompatibleFormat = (dateStr: string) => {
      const [month, day, year] = dateStr.split('-');
      return `${year}/${month}/${day}`;
    };

    const oneWeekAgo = new Date();
    // watch out for this one. I am not sure. whether it is 7 so I put 6 just in case.
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);

    const formattedDebtCycleStartDate = convertToDateCompatibleFormat(
      client.debtCycleStartDate!
    );
    const debtCycleStartDate = new Date(formattedDebtCycleStartDate);

    if (debtCycleStartDate > oneWeekAgo) {
      return false;
    }

    return true;
  }
  findDailyDidNotPay() {
    this.requestDateCorrectFormat = this.time.convertDateToMonthDayYear(
      this.requestDate
    );
    this.frenchDate = this.time.convertDateToDayMonthYear(
      this.requestDateCorrectFormat
    );
    this.totalGivenDate = 0; // Assuming it's a string representation of the total amount
    this.numberOfPeople = 0;

    this.retrieveClients();
  }

  // 3) Method to call the Cloud Function
  sendReminders() {
    if (!this.haveNotPaidToday || this.haveNotPaidToday.length === 0) {
      console.log('No clients to remind.');
      return;
    }

    // We only send the fields necessary for the SMS
    const clientsPayload = this.haveNotPaidToday.map((c) => {
      const min = this.data.minimumPayment(c);
      return {
        firstName: c.firstName,
        lastName: c.lastName,
        phoneNumber: c.phoneNumber,
        minPayment: min,
        debtLeft: c.debtLeft,
        savings: c.savings,
      };
    });

    const callable = this.fns.httpsCallable('sendPaymentReminders');
    callable({ clients: clientsPayload }).subscribe({
      next: (result: any) => {
        console.log('Reminder SMS function result:', result);
        alert('Reminders sent successfully!');
      },
      error: (err: any) => {
        console.error('Error calling reminder function', err);
        alert('Error sending reminders. Please try again.');
      },
    });
  }

  /** Return the first comment that matches `requestDate`, or `null` */
  getTodaysComment(client: Client) {
    if (!client.comments?.length) {
      return null;
    }

    // Normalise the requested date (remove any leading-zeros)
    const [mm, dd, yyyy] = this.requestDateCorrectFormat.split('-');
    const normalisedReq = `${Number(mm)}-${Number(dd)}-${yyyy}`; // e.g. 7-16-2025

    // Find the first comment whose time starts with that normalised date
    return (
      client.comments.find((c) => c.time!.startsWith(normalisedReq)) || null
    );
  }

  /** Truncate comment text like before (<= 40 chars) */
  commentSnippet(com: any): string {
    const text = (com?.comment ?? '').toString().trim();
    return text.length > 40 ? text.slice(0, 40) + '…' : text;
  }

  /** Media flags (safe for undefined) */
  hasImage(com: any): boolean {
    const a = Array.isArray(com?.attachments) ? com.attachments : [];
    return a.some((x: any) => x?.type === 'image');
  }
  hasVideo(com: any): boolean {
    const a = Array.isArray(com?.attachments) ? com.attachments : [];
    return a.some((x: any) => x?.type === 'video');
  }
  hasAudio(com: any): boolean {
    return !!com?.audioUrl;
  }
  hasText(com: any): boolean {
    return !!(com?.comment && com.comment.toString().trim().length);
  }
  getInitials(name?: string): string {
    if (!name) return '•';
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] || '' + (parts[1]?.[0] || ''))
      .slice(0, 2)
      .toUpperCase();
  }

  // ⬇️ returns "Firstname Lastname — 099 12 34 567 (min: 12 345 FC, dette: 67 890 FC)"
  private formatClientLine(c: Client): string {
    const min = this.data.minimumPayment(c);
    const debt = Number(c.debtLeft || 0);
    const fmt = (n: number | string) =>
      Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 });

    const phone = this.displayPhone(c.phoneNumber);

    return `${c.firstName} ${c.lastName} — ${phone} (min: ${fmt(
      min
    )} FC, dette: ${fmt(debt)} FC)`;
  }

  /** Safe phone display for messages */
  private displayPhone(p?: string): string {
    const raw = (p ?? '').toString().trim();
    return raw.length ? raw : 'numéro indisponible';
  }

  /**
   * Build per-agent lists for TODAY.
   * Includes both "En cours" and "À l’écart" buckets so agents see everything at a glance.
   */
  private buildAgentFollowups() {
    // Map agentUid -> { employee, current[], away[] }
    const map = new Map<
      string,
      {
        employee: Employee;
        current: Client[];
        away: Client[];
      }
    >();

    const push = (bucket: 'current' | 'away', c: Client) => {
      const emp = c.employee; // you assigned this in addIdToFilterItems()
      if (!emp || !emp.uid) return; // skip if missing
      if (!map.has(emp.uid))
        map.set(emp.uid, { employee: emp, current: [], away: [] });
      map.get(emp.uid)![bucket].push(c);
    };

    for (const c of this.haveNotPaidCurrent) push('current', c);
    for (const c of this.haveNotPaidAway) push('away', c);

    return map;
  }

  /**
   * NEW: Send follow-up lists to each agent (admin-only).
   * Uses your `sendCustomSMS` callable so no new Cloud Function is required.
   */
  async sendFollowupsToAgents(): Promise<void> {
    if (!this.auth.isAdmin) return;

    this.sendingAgents = true;

    try {
      this.updateSummary();

      // Build buckets from today's clients, but we'll still loop over *all* employees
      const byAgent = this.buildAgentFollowups();
      const callable = this.fns.httpsCallable('sendCustomSMS');

      // Counters & jobs
      let sent = 0;
      let skippedNoWork = 0;
      let skippedNoPhone = 0;

      const jobs: Promise<unknown>[] = [];

      // ── Loop over *all* employees so those with zero clients are handled
      for (const emp of this.employees) {
        if (!emp?.uid) continue;

        // 1) Status check
        if (!this.isWorkingEmployee(emp)) {
          skippedNoWork++;
          continue;
        }

        // 2) Phone check
        const phone = (emp as any).phoneNumber || (emp as any).telephone || '';
        if (!phone) {
          skippedNoPhone++;
          continue;
        }

        // 3) Retrieve buckets (may be empty if this employee has no clients today)
        const buckets = byAgent.get(emp.uid) ?? {
          employee: emp,
          current: [],
          away: [],
        };
        const linesCurrent = buckets.current.map(
          (c) => `• ${this.formatClientLine(c)}`
        );
        const linesAway = buckets.away.map(
          (c) => `• ${this.formatClientLine(c)}`
        );

        // 4) If no clients today → send recruitment prompt
        if (!linesCurrent.length && !linesAway.length) {
          const message = this.buildRecruitmentMessage(emp);
          jobs.push(
            callable({
              phoneNumber: phone,
              message,
              metadata: {
                kind: 'agent-recruitment',
                date: this.requestDateCorrectFormat,
              },
            }).toPromise()
          );
          sent++;
          continue;
        }

        // 5) Otherwise send normal follow-up list
        const header = `Bonjour ${emp.firstName || ''}, voici les suivis du ${
          this.frenchDate
        } :`;
        const bodyParts: string[] = [header];
        if (linesCurrent.length)
          bodyParts.push(
            '',
            `En cours (${linesCurrent.length}) :`,
            ...linesCurrent
          );
        if (linesAway.length)
          bodyParts.push('', `À l’écart (${linesAway.length}) :`, ...linesAway);
        bodyParts.push('', 'Merci pour la confiance à la FONDATION GERVAIS.');
        const message = bodyParts.join('\n');

        jobs.push(
          callable({
            phoneNumber: phone,
            message,
            metadata: {
              kind: 'agent-followups',
              date: this.requestDateCorrectFormat,
            },
          }).toPromise()
        );
        sent++;
      }

      // If no jobs, still show a meaningful summary
      if (!jobs.length) {
        alert(`Aucun envoi effectué.
Ignorés — Non actifs: ${skippedNoWork}, Sans numéro: ${skippedNoPhone}.`);
        return;
      }

      // Wait & compute failures
      const results = await Promise.allSettled(jobs);
      const failed = results.filter((r) => r.status === 'rejected').length;
      const succeeded = sent - failed;

      alert(`Messages envoyés: ${succeeded} (échecs: ${failed}).
Ignorés — Non actifs: ${skippedNoWork}, Sans numéro: ${skippedNoPhone}.`);
    } catch (err) {
      console.error('sendFollowupsToAgents error:', err);
      alert('Erreur lors de l’envoi des listes aux agents.');
    } finally {
      this.sendingAgents = false;
    }
  }

  /** Returns true iff the employee is currently working ("Travaille"). */
  /** Returns true iff the employee is currently working ("Travaille"). */
  private isWorkingEmployee(e?: Employee): boolean {
    if (!e) return false;
    const raw =
      (e as any).status ??
      (e as any).workStatus ??
      (e as any).employmentStatus ??
      '';
    const val = String(raw).trim().toLowerCase();
    // Accept common variants / typos
    return ['travaille', 'tavaille', 'en travail', 'working', 'work'].includes(
      val
    );
  }

  /** Message if agent is working but has no clients to follow today */
  private buildRecruitmentMessage(emp: Employee): string {
    return [
      `Bonjour ${emp.firstName || ''},`,
      `Ozali na client programmé te lelo.`,
      `Profitez pona Marketting pe kolouka ba clients ya sika pe kotala ba clients oyo bafutaki te lobi.`,
      ``,
      `Merci pour la confiance à la FONDATION GERVAIS.`,
    ].join('\n');
  }
}
