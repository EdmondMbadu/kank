import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-team-ranking-month',
  templateUrl: './team-ranking-month.component.html',
  styleUrls: ['./team-ranking-month.component.css'],
})
export class TeamRankingMonthComponent {
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth() + 1;
  givenMonth: number = this.currentMonth;
  month = this.compute.getMonthNameFrench(this.currentMonth);
  year = this.currentDate.getFullYear();
  givenYear = this.year;
  monthsList: number[] = [...Array(12).keys()].map((i) => i + 1);
  day = this.currentDate.getDate();
  maxRange: number = 0;
  averagePointsMonth: string = '';
  performancePercentageMonth: string = '';
  totalPointsMonth: string = '';
  totalBonus: string = '';
  yearsList: number[] = this.time.yearsList;
  constructor(
    private router: Router,
    public auth: AuthService,
    public time: TimeService,
    private performance: PerformanceService,
    private compute: ComputationService
  ) {}
  isFetchingClients = false;
  currentEmployees: any = [];
  currentClients: Client[] = [];
  total: string = '0';
  totalHouse: string = '0';
  allUsers: User[] = [];
  ngOnInit(): void {
    this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data;
      // this is really weird. maybe some apsect of angular. but it works for now
      if (this.allUsers.length > 1) this.getAllEmployees();
    });
  }

  allEmployees?: Employee[];

  valuesConvertedToDollars: string[] = [];

  getAllEmployees() {
    if (this.isFetchingClients) return;
    this.isFetchingClients = true;

    let tempEmployees: Employee[] = [];
    this.allEmployees = [];
    let completedRequests = 0;
    this.total = '0';
    this.totalHouse = '0';
    this.totalBonus = '0';
    this.allUsers.forEach((user) => {
      if (user.housePayment)
        this.totalHouse = (
          Number(user.housePayment) + Number(this.totalHouse)
        ).toString();
    });

    console.log('sum for house paumeyts', this.totalHouse);
    this.allUsers.forEach((user) => {
      this.currentClients = [];

      this.currentEmployees = [];

      this.auth.getAllEmployeesGivenUser(user).subscribe((employees) => {
        tempEmployees = tempEmployees.concat(employees);
        this.currentEmployees = employees;

        this.currentEmployees.forEach((em: any) => {
          this.computePerformances(employees, em);
          if (em.paymentAmount) {
            this.total = (
              Number(em.paymentAmount) + Number(this.total)
            ).toString();
          }
          if (em.totalBonusThisMonth) {
            this.totalBonus = (
              Number(em.totalBonusThisMonth) + Number(this.totalBonus)
            ).toString();
          }

          // Assign location
          em.tempLocationHolder = user.firstName;
        });

        // this.currentEmployees = employees;
        completedRequests++;
        if (completedRequests === this.allUsers.length) {
          this.filterAndInitializeEmployees(tempEmployees, this.currentClients);
          this.isFetchingClients = false;
        }
      });
    });
    this.total = (Number(this.total) + Number(this.totalHouse)).toString();
  }
  filterAndInitializeEmployees(
    allEmployees: Employee[],
    currentClients: Client[]
  ) {
    // Use a Map or Set to ensure uniqueness. Here, a Map is used to easily access clients by their ID.
    let uniqueEmployees = new Map<string, Client>();
    this.allEmployees = [];
    allEmployees.forEach((employee) => {
      employee.currentClients =
        this.compute.filterClientsWithoutDebtFollowedByEmployee(
          currentClients,
          employee
        );
      // Assuming client.id is the unique identifier
      if (!uniqueEmployees.has(employee.uid!)) {
        uniqueEmployees.set(employee.uid!, employee);
      }
    });

    // Convert the Map values back to an array for further processing
    this.allEmployees = Array.from(uniqueEmployees.values());
    this.allEmployees.sort((a, b) => {
      const aPerformance = a.performancePercentageMonth
        ? parseFloat(a.performancePercentageMonth)
        : 0;
      const bPerformance = b.performancePercentageMonth
        ? parseFloat(b.performancePercentageMonth)
        : 0;
      return bPerformance - aPerformance;
    });
    this.allEmployees = this.allEmployees.filter((data) => {
      return data.status === 'Travaille';
    });
  }

  computePerformances(employees: any, employee: Employee) {
    this.maxRange = Object.keys(employee.dailyPoints!).length;
    if (employee.role === 'Manager') {
      this.averagePointsMonth =
        this.compute.findTotalForMonthAllDailyPointsEmployees(
          employees,
          this.givenMonth.toString(),
          this.givenYear.toString()
        );

      this.totalPointsMonth =
        this.compute.findTotalForMonthAllTotalDailyPointsEmployees(
          employees,
          this.givenMonth.toString(),
          this.givenYear.toString()
        );
    } else {
      this.averagePointsMonth = this.compute.findTotalForMonth(
        employee.dailyPoints!,
        this.givenMonth.toString(),
        this.givenYear.toString()
      );

      this.totalPointsMonth = this.compute.findTotalForMonth(
        employee.totalDailyPoints!,
        this.givenMonth.toString(),
        this.givenYear.toString()
      );
    }

    this.performancePercentageMonth = this.computePerformancePercentage(
      this.averagePointsMonth,
      this.totalPointsMonth
    );
    employee.performancePercentageMonth = this.performancePercentageMonth;

    return this.performancePercentageMonth;

    // this.computeThisMonthSalary();
  }
  computePerformancePercentage(average: string, total: string) {
    let result = '';
    if (
      (average === '0' || average === undefined || average === '') &&
      (total === '0' || total === undefined || total === '')
    ) {
    } else {
      let rounded = this.compute.roundNumber(
        (Number(average) * 100) / Number(total)
      );
      result = rounded.toString();
    }
    return result;
  }
  getVacationInProgressDates(employee: Employee): string[] {
    return Object.keys(employee.attendance!)
      .filter((date) => employee.attendance![date] === 'VP')
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }
  sortKeysAndValuesPerformance(time: number, employee: Employee) {
    const sortedKeys = Object.keys(employee.dailyPoints!)
      .sort((a, b) => +this.time.toDate(a) - +this.time.toDate(b))
      .slice(-time);

    // to allow for infinity ( when the totalpoint is 0, yet the dailypoint is not zero), add one where the value of total is zero
    for (let key in employee.dailyPoints) {
      if (employee.totalDailyPoints![key] === '0') {
        employee.dailyPoints[key] = (
          Number(employee.dailyPoints[key]) + 1
        ).toString();
        employee.totalDailyPoints![key] = '1';
      }
    }
    const values = sortedKeys.map((key) =>
      (
        (Number(employee.dailyPoints![key]) * 100) /
        Number(employee.totalDailyPoints![key])
      ).toString()
    );
    return [sortedKeys, values];
  }
}
