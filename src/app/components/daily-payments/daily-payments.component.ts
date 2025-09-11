import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-daily-payments',
  templateUrl: './daily-payments.component.html',
  styleUrls: ['./daily-payments.component.css'],
})
export class DailyPaymentsComponent implements OnInit {
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
    private data: DataService
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
      this.clients = data;
      this.retrieveEmployees();
    });
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.addIdToFilterItems();
      this.extractTodayPayments();
    });
  }
  addIdToFilterItems() {
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
      let emp = this.employees.find(
        (element) => element.uid === this.clients![i].agent
      );
      this.clients![i].employee = emp;
    }
  }

  extractTodayPayments() {
    this.dailyPamentsAmount = [];
    this.dailyPaymentsNames = [];
    this.totalGivenDate = '0';
    this.numberOfPeople = '0';
    this.trackingIds = [];
    for (let client of this.clients!) {
      // Ensure client.payments and client.previousPayments are not undefined or null
      const paymentsEntries = client.payments
        ? Object.entries(client.payments)
        : [];
      const previousPaymentsEntries = client.previousPayments
        ? Object.entries(client.previousPayments)
        : [];

      // Combine entries from both payments and previousPayments
      const combinedEntries = [...paymentsEntries, ...previousPaymentsEntries];

      // Filter the combined entries
      const filteredDict = Object.fromEntries(
        combinedEntries.filter(([key, value]) =>
          key.startsWith(this.requestDateCorrectFormat)
        )
      );

      const filteredValues = Object.values(filteredDict);
      const filteredKeys = Object.keys(filteredDict);
      if (filteredValues.length !== 0) {
        this.fillDailyPayment(client, filteredValues, filteredKeys);
      }
    }
    this.computeAgentRanking();
  }

  fillDailyPayment(client: Client, values: string[], keys: string[]) {
    let i = 0;

    for (let v of values) {
      let middleName = client.middleName === undefined ? '' : client.middleName;
      let filt = {
        firstName: client.firstName,
        lastName: client.lastName,
        middleName: middleName,
        amount: v,
        time: keys[i++],
        timeFormatted: this.time.convertDateToDesiredFormat(keys[i - 1]),
        employee: client.employee,
        trackingId: client.trackingId,
      };

      if (Number(v) != 0) {
        this.dailyPayments?.push(filt);
        this.totalGivenDate = (
          Number(v) + Number(this.totalGivenDate)
        ).toString();

        this.dailyPaymentsCopy?.push(filt);
      }
    }

    // Remove duplicates
    this.dailyPayments = this.data.removeDuplicates(this.dailyPayments!);
    this.dailyPaymentsCopy = this.data.removeDuplicates(
      this.dailyPaymentsCopy!
    );
    this.numberOfPeople = this.dailyPayments!.length.toString();

    // Sort them
    this.dailyPayments!.sort(
      (a, b) =>
        this.time.parseDate(b.time).getTime() -
        this.time.parseDate(a.time).getTime()
    );
    this.dailyPaymentsCopy!.sort(
      (a, b) =>
        this.time.parseDate(b.time).getTime() -
        this.time.parseDate(a.time).getTime()
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
}

export class Filtered {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  date?: string;
  amount?: string;
  time?: string;
  timeFormatted?: string;
  employee?: Employee;
  trackingId?: string;
}
// Add this interface near your other interfaces/classes
interface AgentRank {
  id: string; // employee uid or special bucket id
  name: string; // display name ("Autre" for inactive bucket)
  total: number; // total FC
  count: number; // number of payments
  inactive?: boolean;
}
