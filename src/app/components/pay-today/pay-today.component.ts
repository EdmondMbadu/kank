import { Component, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-pay-today',
  templateUrl: './pay-today.component.html',
  styleUrls: ['./pay-today.component.css'],
})
export class PayTodayComponent implements OnInit {
  clients?: Client[] = [];
  clientsWithDebts: Client[] = [];
  employees: Employee[] = [];
  selectedField: string = 'paymentDay';
  totalGivenDate: number = 0;
  numberOfPeople: number = 0;
  searchControl = new FormControl();
  frenchPaymentDays: { [key: string]: string } = {
    Monday: 'Lundi',
    Tuesday: 'Mardi',
    Wednesday: 'Mercredi',
    Thursday: 'Jeudi',
    Friday: 'Vendredi',
    Saturday: 'Samedi',
  };
  today = this.time.todaysDateMonthDayYear();
  filteredItems?: Client[];
  trackingIds: string[] = [];
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {
    this.retrieveClients();
  }
  searchCriteria: string = 'paymentDay';

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((value) => this.search(value))
      )
      .subscribe((results) => {
        this.filteredItems = results;
      });
  }

  retrieveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      this.findClientsWithDebts();
      this.retrieveEmployees();
      this.filteredItems = data;
    });
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      console.log('employees', this.employees);
      this.addIds();
    });
  }
  findClientsWithDebts() {
    this.clientsWithDebts = this.clients!.filter((data) => {
      return Number(data.debtLeft) > 0;
    });
  }
  getButtonClasses(field: string): string {
    const baseClasses =
      'px-4 py-2 text-sm  bg-white border border-gray-200 hover:bg-gray-100 focus:z-10 focus:ring-2 focus:ring-blue-700 dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:hover:text-white dark:hover:bg-gray-700 dark:focus:ring-blue-500';

    const selectedClasses =
      field === this.selectedField
        ? 'text-blue-700 dark:text-blue-700 font-bold'
        : 'text-gray-900 dark:text-white';

    return `${baseClasses} ${selectedClasses}`;
  }
  addIds() {
    for (let i = 0; i < this.clients!.length; i++) {
      this.clients![i].trackingId = `${i}`;
      this.clients![i].frenchPaymentDay =
        this.frenchPaymentDays[`${this.clients![i].paymentDay}`];
      let emp = this.employees.find(
        (element) => element.uid === this.clients![i].agent
      );
      this.clients![i].employee = emp;
    }
  }

  setSerachCriteria(criteria: string) {
    this.searchCriteria = criteria;
    this.selectedField = criteria;
  }
  getAgentUidByName(name: string) {
    name = name.toLowerCase();
    const foundAgent = this.employees.find(
      (employee) =>
        employee.firstName?.toLowerCase().includes(name) ||
        employee.lastName?.toLowerCase().includes(name) ||
        employee.middleName?.toLowerCase().includes(name)
    );
    return foundAgent ? foundAgent.uid : null;
  }

  // search(value: string, field: string = this.searchCriteria) {
  //   if (value) {
  //     const lowerCaseValue = value.toLowerCase();

  //     let current = this.clientsWithDebts!.filter((client) => {
  //       // Switch to handle different fields for filtering
  //       switch (field) {
  //         case 'paymentDay':
  //           return (
  //             client.paymentDay?.toLowerCase().includes(lowerCaseValue) ||
  //             client.frenchPaymentDay?.toLowerCase().includes(lowerCaseValue)
  //           );
  //         case 'creditScore':
  //           return client.creditScore?.toString() === lowerCaseValue;
  //         case 'loanAmount':
  //           return client.loanAmount?.toString() === lowerCaseValue;
  //         case 'loanAmountMore':
  //           return (
  //             Number(client.loanAmount?.toString()) >= Number(lowerCaseValue)
  //           );
  //         case 'debtCycle':
  //           return client.debtCycle?.toString() === lowerCaseValue;
  //         case 'debtLeft':
  //           return client.debtLeft?.toString() === lowerCaseValue;
  //         case 'debtLeftMore':
  //           return (
  //             Number(client.debtLeft?.toString()) >= Number(lowerCaseValue)
  //           );
  //         case 'amountPaid':
  //           return client.amountPaid?.toString().includes(lowerCaseValue);
  //         // Add more cases for other fields as needed
  //         case 'agent':
  //           // Get the agent uid using the helper function
  //           const agentUid = this.getAgentUidByName(value);
  //           return client.agent?.toString().includes(agentUid!);
  //         case 'debtCycleStartDate':
  //           if (client.debtCycleStartDate) {
  //             const [month, , year] = client.debtCycleStartDate.split('-');
  //             const [searchMonth, searchYear] = lowerCaseValue.split('-');
  //             return month === searchMonth && year === searchYear;
  //           }
  //           return false;
  //         case '3+weeks':
  //           const THREE_WEEKS_IN_MS = 21 * 24 * 60 * 60 * 1000; // 3 weeks in milliseconds
  //           const now = new Date();

  //           return client.debtCycleStartDate && client.payments
  //             ? (() => {
  //                 // Check if the debt cycle start date is at least 3 weeks ago
  //                 const [startMonth, startDay, startYear] =
  //                   client.debtCycleStartDate.split('-').map(Number);
  //                 const debtCycleStartDate = new Date(
  //                   startYear,
  //                   startMonth - 1,
  //                   startDay
  //                 );

  //                 if (
  //                   now.getTime() - debtCycleStartDate.getTime() <
  //                   THREE_WEEKS_IN_MS
  //                 ) {
  //                   return false; // Client's debt cycle is too recent
  //                 }

  //                 // Check if there are any payments made in the last 3 weeks
  //                 const recentPaymentExists = Object.keys(client.payments).some(
  //                   (paymentDate) => {
  //                     const [payMonth, payDay, payYear] = paymentDate
  //                       .split('-')
  //                       .map(Number);
  //                     const paymentDateObj = new Date(
  //                       payYear,
  //                       payMonth - 1,
  //                       payDay
  //                     );
  //                     return (
  //                       now.getTime() - paymentDateObj.getTime() <
  //                       THREE_WEEKS_IN_MS
  //                     );
  //                   }
  //                 );

  //                 return !recentPaymentExists; // Client has not made recent payments
  //               })()
  //             : false; // Skip if no debtCycleStartDate or payments data exists
  //         default:
  //           return false;
  //       }
  //     });

  //     this.totalGivenDate = this.compute.computeExpectedPerDate(current);
  //     this.numberOfPeople = current.length;
  //     return of(current);
  //   } else {
  //     this.totalGivenDate = this.compute.computeExpectedPerDate([]);
  //     this.numberOfPeople = 0;
  //     return of(this.clients);
  //   }
  // }
  search(value: string, field: string = this.searchCriteria) {
    if (value) {
      const lowerCaseValue = value.toLowerCase();

      let current;

      if (field === 'creditScore') {
        // Search among all clients when filtering by creditScore
        current = this.clients!.filter(
          (client) => client.creditScore?.toString() === lowerCaseValue
        );
      } else {
        // Search only among clients with debts for other fields
        current = this.clientsWithDebts!.filter((client) => {
          switch (field) {
            case 'paymentDay':
              return (
                client.paymentDay?.toLowerCase().includes(lowerCaseValue) ||
                client.frenchPaymentDay?.toLowerCase().includes(lowerCaseValue)
              );
            case 'loanAmount':
              return client.loanAmount?.toString() === lowerCaseValue;
            case 'loanAmountMore':
              return (
                Number(client.loanAmount?.toString()) >= Number(lowerCaseValue)
              );
            case 'debtCycle':
              return client.debtCycle?.toString() === lowerCaseValue;
            case 'debtLeft':
              return client.debtLeft?.toString() === lowerCaseValue;
            case 'debtLeftMore':
              return (
                Number(client.debtLeft?.toString()) >= Number(lowerCaseValue)
              );
            case 'amountPaid':
              return client.amountPaid?.toString().includes(lowerCaseValue);
            case 'agent':
              const agentUid = this.getAgentUidByName(value);
              return client.agent?.toString().includes(agentUid!);
            case 'debtCycleStartDate':
              if (client.debtCycleStartDate) {
                const [month, , year] = client.debtCycleStartDate.split('-');
                const [searchMonth, searchYear] = lowerCaseValue.split('-');
                return month === searchMonth && year === searchYear;
              }
              return false;
            case '3+weeks':
              const THREE_WEEKS_IN_MS = 21 * 24 * 60 * 60 * 1000;
              const now = new Date();
              return client.debtCycleStartDate && client.payments
                ? (() => {
                    const [startMonth, startDay, startYear] =
                      client.debtCycleStartDate.split('-').map(Number);
                    const debtCycleStartDate = new Date(
                      startYear,
                      startMonth - 1,
                      startDay
                    );

                    if (
                      now.getTime() - debtCycleStartDate.getTime() <
                      THREE_WEEKS_IN_MS
                    ) {
                      return false;
                    }

                    const recentPaymentExists = Object.keys(
                      client.payments
                    ).some((paymentDate) => {
                      const [payMonth, payDay, payYear] = paymentDate
                        .split('-')
                        .map(Number);
                      const paymentDateObj = new Date(
                        payYear,
                        payMonth - 1,
                        payDay
                      );
                      return (
                        now.getTime() - paymentDateObj.getTime() <
                        THREE_WEEKS_IN_MS
                      );
                    });

                    return !recentPaymentExists;
                  })()
                : false;
            default:
              return false;
          }
        });
      }

      this.totalGivenDate = this.compute.computeExpectedPerDate(current);
      this.numberOfPeople = current.length;
      return of(current);
    } else {
      this.totalGivenDate = this.compute.computeExpectedPerDate([]);
      this.numberOfPeople = 0;
      return of(this.clients);
    }
  }
}
