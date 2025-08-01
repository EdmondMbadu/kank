import { Injectable } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { Client } from '../models/client';
import { AuthService } from './auth.service';
import { TimeService } from './time.service';

import {
  AngularFirestore,
  AngularFirestoreDocument,
} from '@angular/fire/compat/firestore';
import { User } from '../models/user';
import { Employee } from '../models/employee';
import { RotationSchedule } from '../models/management';
import { map, take } from 'rxjs';
import firebase from 'firebase/compat/app';
import { arrayRemove, arrayUnion, deleteField } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class PerformanceService {
  clients?: Client[];
  currentClients?: Client[] = [];
  employees?: Employee[] = [];
  shouldPayToday: Client[] = [];
  haveNotPaidToday: Client[] = [];
  paidToday: Client[] = [];
  clientPaymentAmount: string = '0';
  today = this.time.todaysDateMonthDayYear();

  filteredItems?: Client[];
  todaysLending?: Client[] = [];
  public performance: string = '0';

  searchControl = new FormControl();

  constructor(
    public auth: AuthService,
    private time: TimeService,
    private afs: AngularFirestore
  ) {
    this.retrieveClients();
    this.retrieveEmployees();
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.clientPaymentAmount = '0';
    });
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      this.extractTodayPayments();
      this.filterPayments();
      this.findThoseWhoHaveNotPaidToday();
      this.extractTodayLendings();
      this.computePerformance();
    });
  }

  updateUserPerformance(client: Client, paymentAmount: string = '0') {
    this.retrieveClients();
    this.computePerformance();
    this.clientPaymentAmount = paymentAmount;
    this.calculateTotalClientsForEachAgent(this.shouldPayToday);

    this.updateEmployeesPointsForToday(client);

    this.callEachEmployeeToUpdatePerformancePerSubmission();
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    let date = this.time.todaysDateMonthDayYear();

    const data = {
      performances: {
        [date]: `${this.performance}`,
      },
    };

    return userRef.set(data, { merge: true });
  }

  callEachEmployeeToUpdatePerformancePerSubmission() {
    if (this.employees) {
      for (let em of this.employees!) {
        if (
          em.dailyPoints![this.today] === '0' &&
          em.currentTotalPoints === 0
        ) {
          // console.log('entering here');
        } else {
          this.UpdateEachEmployeePerformancePerSubmission(em);
        }
      }
    }
  }
  UpdateEachEmployeePerformancePerSubmission(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );
    const data = {
      totalDailyPoints: {
        [this.today]: `${employee.currentTotalPoints}`,
      },
      dailyPoints: {
        [this.today]: `${employee.dailyPoints![`${this.today}`]}`,
      },
    };
    return employeeRef.set(data, { merge: true });
  }

  updateEmployeesPointsForToday(client: Client) {
    const minpay =
      Number(client.amountToPay) / Number(client.paymentPeriodRange);
    let num = Number(this.clientPaymentAmount) / Number(minpay);

    let rounded = this.roundCeilToDecimal(num);
    // this was added because if a client, paid twice the min amount,
    // it would be as if two people paid. increasing the performance of employees artificially
    // we commented this line because it they paid twice, they should get twice the performance
    // rounded = Math.min(1, rounded);

    // actually, if a client paid twice their amount, increase the performance of employees
    // rounded = Math.max(1, rounded); // we will see if this is a good idea

    if (this.employees) {
      for (let em of this.employees!) {
        em.dailyPoints![`${this.today}`] =
          em.dailyPoints![`${this.today}`] === undefined
            ? '0'
            : em.dailyPoints![`${this.today}`];
        if (
          em.clients!.includes(client.uid!) &&
          client.debtCycleStartDate !== this.today
        ) {
          em.dailyPoints![`${this.today}`] = (
            Number(em.dailyPoints![`${this.today}`]) + rounded
          ).toString();
        }
      }
    }
  }

  calculateTotalClientsForEachAgent(clients: Client[]) {
    // console.log('clients that should pay today', clients);
    // Create a hash table for quick lookup of client-agent relationships

    let clientAgentMap = new Map();
    clients.forEach((client) => {
      clientAgentMap.set(client.uid, client.agent);
    });

    // Iterate over each agent and calculate the total
    this.employees!.forEach((agent) => {
      agent.currentTotalPoints = 0;

      agent.clients!.forEach((clientID: string) => {
        if (
          agent.currentTotalPoints !== undefined &&
          clientAgentMap.get(clientID) === agent.uid
        ) {
          agent.currentTotalPoints += 1;
        }
      });
    });
  }

  extractTodayPayments() {
    this.paidToday = [];

    if (!this.clients || this.clients.length === 0) return;

    for (let client of this.clients) {
      if (client.payments && typeof client.payments === 'object') {
        const filteredDict = Object.fromEntries(
          Object.entries(client.payments).filter(([key, value]) =>
            key.startsWith(this.today)
          )
        );
        const filteredValues = Object.values(filteredDict);
        if (filteredValues.length !== 0) {
          this.paidToday.push(client);
        }
      }
    }
  }

  findThoseWhoHaveNotPaidToday() {
    this.haveNotPaidToday = [];
    if (this.shouldPayToday) {
      for (let c of this.shouldPayToday) {
        if (
          this.paidToday.indexOf(c) === -1 &&
          Number(c.amountToPay) - Number(c.amountPaid) > 0 &&
          !c.debtCycleStartDate?.startsWith(this.today) &&
          this.clientStartedMorethanOneWeekAgo(c)
        ) {
          c.minPayment = (
            Number(c.amountToPay) / Number(c.paymentPeriodRange)
          ).toString();
          this.haveNotPaidToday.push(c);
        }
      }
    }
  }

  filterPayments() {
    this.shouldPayToday = [];
    let day = this.time.getDayOfWeek(this.today);
    if (this.clients && Array.isArray(this.clients)) {
      for (let client of this.clients) {
        const isAlive =
          client.vitalStatus === undefined ||
          client.vitalStatus === '' ||
          client.vitalStatus.toLowerCase() === 'vivant';

        if (
          client.paymentDay === day &&
          isAlive && // Ensures only alive clients or those without a vitalStatus field are included
          Number(client.debtLeft) > 0 &&
          this.clientStartedMorethanOneWeekAgo(client)
        ) {
          this.shouldPayToday.push(client);
        }
      }
    }
  }

  // this method returns true only if the client started the debt cycle more than a week ago.
  // it he/she started say yesterday ( or 2,3,4,5,6,days before), it will return false.
  clientStartedMorethanOneWeekAgo(client: Client) {
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

  extractTodayLendings() {
    this.todaysLending = [];
    if (this.clients && Array.isArray(this.clients)) {
      for (let client of this.clients!) {
        if (client.debtCycleStartDate === this.today) {
          this.todaysLending?.push(client);
        }
      }
    }
  }
  computePerformance() {
    this.performance = '0';
    // everybody paid +5
    if (this.haveNotPaidToday.length === 0 && this.shouldPayToday.length > 0) {
      this.performance = (Number(this.performance) + 5).toString();
    } // not everybody paid - the number of people who did not pay
    if (this.haveNotPaidToday.length > 0) {
      this.performance = (0 - this.haveNotPaidToday.length).toString();
    } // everybody paid, + some more. add those who have paid on top
    if (
      this.haveNotPaidToday.length === 0 &&
      this.shouldPayToday.length < this.paidToday.length
    ) {
      this.performance = (
        Number(this.performance) +
        this.paidToday.length -
        this.shouldPayToday.length
      ).toString();
    } // add the number of daily lenders each for a point
    if (this.todaysLending!.length > 0) {
      this.performance = (
        Number(this.performance) + this.todaysLending!.length
      ).toString();
    }
  }
  findAverageAndTotal(employee: Employee): [number, number] {
    let average = 0,
      total = 0;

    if (employee.dailyPoints && typeof employee.dailyPoints === 'object') {
      for (let key in employee.dailyPoints) {
        average += Number(employee.dailyPoints[key]) || 0;
      }
    }

    if (
      employee.totalDailyPoints &&
      typeof employee.totalDailyPoints === 'object'
    ) {
      for (let key in employee.totalDailyPoints) {
        total += Number(employee.totalDailyPoints[key]) || 0;
      }
    }

    return [average, total];
  }

  findAverageTotalToday(employees: Employee[]): string {
    let total = 0;

    if (employees && Array.isArray(employees)) {
      for (let e of employees) {
        if (e.dailyPoints && typeof e.dailyPoints === 'object') {
          const current = Number(e.dailyPoints[this.today]);
          if (!isNaN(current)) {
            total += current;
          }
        }
      }
    }

    return isNaN(total) ? '' : total.toFixed(2);
  }

  findTotalToday(employees: Employee[]): string {
    let total = 0;

    if (employees && Array.isArray(employees)) {
      for (let e of employees) {
        if (e.totalDailyPoints && typeof e.totalDailyPoints === 'object') {
          const current = Number(e.totalDailyPoints[this.today]);
          if (!isNaN(current)) {
            total += current;
          }
        }
      }
    }

    return isNaN(total) ? '' : total.toFixed(2);
  }

  findAverageAndTotalAllEmployee(employees: Employee[]) {
    let average = 0,
      total = 0;

    if (employees) {
      for (let e of employees) {
        for (let key in e.dailyPoints) {
          average += Number(e.dailyPoints[key]);
          total += Number(e.totalDailyPoints![key]);
        }
      }
    }

    return [average, total];
  }

  findLetterGrade(num: number) {
    if (num >= 0.9) {
      return 'A';
    } else if (num >= 0.8) {
      return 'B';
    } else if (num >= 0.7) {
      return 'C';
    } else if (num >= 0.6) {
      return 'D';
    }
    return 'F';
  }

  roundCeilToDecimal(number: number, decimals: number = 1): number {
    // Factor calculation with type assertion for clarity
    const factor = Math.pow(10, decimals);
    const multiplied = number * factor;

    // Round up using Math.floor()
    const rounded = Math.ceil(multiplied);

    // Divide by the factor to get the result with one decimal
    return rounded / factor;
  }

  private docId(loc: string, y: number, m: number) {
    return `${loc.toLowerCase()}_${y}_${m}`;
  }

  /** Get (or create empty) rotation for given location+month */
  getSchedule(loc: string, y: number, m: number) {
    const id = this.docId(loc, y, m);
    return this.afs
      .doc<RotationSchedule>(`rotations/${id}`)
      .valueChanges()
      .pipe(
        take(1),
        map(
          (data) =>
            data ||
            ({
              id,
              location: loc,
              month: m,
              year: y,
              days: {},
              createdAt: Date.now(),
              updatedAt: Date.now(),
            } as RotationSchedule)
        )
      );
  }

  // Helper: stable key for a location field path
  private slug(s: string): string {
    return (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private tfDocPath(isoWeek: string) {
    return `taskforceSchedules/${isoWeek}`;
  }

  getTaskForce(isoWeek: string) {
    return this.afs.doc<{ days?: any }>(this.tfDocPath(isoWeek)).valueChanges();
  }
  async setAssignment(
    loc: string,
    y: number,
    m: number,
    isoDay: string,
    employeeUid?: string
  ) {
    const id = this.docId(loc, y, m);
    const path = `rotations/${id}`;
    const docRef = this.afs.doc<RotationSchedule>(path).ref;

    if (employeeUid) {
      /* add / update (same as before) */
      return this.afs.firestore.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        const data: any = snap.exists
          ? snap.data()
          : {
              location: loc,
              month: m,
              year: y,
              days: {},
              createdAt: Date.now(),
            };

        data.days[isoDay] = employeeUid;
        data.updatedAt = Date.now();
        tx.set(docRef, data, { merge: true });
      });
    } else {
      /* clear → store null (works everywhere, no sentinel) */
      return this.afs.doc(path).update({
        [`days.${isoDay}`]: null,
        updatedAt: Date.now(),
      });
    }
  }

  /** Replace the whole set of (location → employees[]) for a given day.
   *  Pass `null` to clear the day entirely. */
  setTaskForceDay(
    isoWeek: string,
    isoDay: string,
    dayMap: { [locKey: string]: { loc: string; employees: string[] } } | null
  ) {
    const ref = this.afs.doc(this.tfDocPath(isoWeek));
    return ref.set(
      {
        updatedAt: Date.now(),
        days: {
          [isoDay]: dayMap ?? deleteField(), // clear when null
        },
      },
      { merge: true }
    );
  }

  /** Add one employee to a (day, location). Creates location/day if needed. */
  addTFPerson(isoWeek: string, isoDay: string, location: string, uid: string) {
    const ref = this.afs.doc(this.tfDocPath(isoWeek));
    const key = this.slug(location);
    return ref.set(
      {
        updatedAt: Date.now(),
        days: {
          [isoDay]: {
            [key]: {
              loc: location,
              // ensure employees array exists, then union
              employees: arrayUnion(uid),
            },
          },
        },
      },
      { merge: true }
    );
  }

  /** Remove one employee from a (day, location). Deletes location if empty. */
  removeTFPerson(
    isoWeek: string,
    isoDay: string,
    location: string,
    uid: string
  ) {
    const ref = this.afs.doc(this.tfDocPath(isoWeek));
    const key = this.slug(location);
    // First remove from array; optional cleanup of empty arrays can be handled in client after read.
    return ref.set(
      {
        updatedAt: Date.now(),
        days: {
          [isoDay]: {
            [key]: {
              loc: location,
              employees: arrayRemove(uid),
            },
          },
        },
      },
      { merge: true }
    );
  }

  /** Remove entire location block for a given day (but keep other locations). */
  clearTFLocation(isoWeek: string, isoDay: string, location: string) {
    const ref = this.afs.doc(this.tfDocPath(isoWeek));
    const key = this.slug(location);
    return ref.set(
      {
        updatedAt: Date.now(),
        days: {
          [isoDay]: {
            [key]: deleteField(),
          },
        },
      },
      { merge: true }
    );
  }

  /** Allow/forbid audit (distributor) edits for a given ISO week. */
  setAuditEditable(isoWeek: string, value: boolean) {
    const ref = this.afs.doc(this.tfDocPath(isoWeek));
    return ref.set(
      {
        auditEditable: value,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  }
}
