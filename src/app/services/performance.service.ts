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

    let rounded = this.roundFloorToDecimal(num);
    // this was added because if a client, paid twice the min amount,
    // it would be as if two people paid. increasing the performance of employees artificially
    rounded = Math.min(1, rounded);

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

    return isNaN(total) ? '' : total.toString();
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

    return isNaN(total) ? '' : total.toString();
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

  roundFloorToDecimal(number: number, decimals: number = 1): number {
    // Factor calculation with type assertion for clarity
    const factor = Math.pow(10, decimals);
    const multiplied = number * factor;

    // Round up using Math.floor()
    const rounded = Math.ceil(multiplied);

    // Divide by the factor to get the result with one decimal
    return rounded / factor;
  }
}
