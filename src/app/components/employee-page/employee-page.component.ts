import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-employee-page',
  templateUrl: './employee-page.component.html',
  styleUrls: ['./employee-page.component.css'],
})
export class EmployeePageComponent implements OnInit {
  id: any = '';
  employees: Employee[] = [];
  employee: Employee = {};
  averageToday: string = '';
  totalToday: string = '';
  today: string = this.time.todaysDateMonthDayYear();
  recentPerformanceDates: string[] = [];
  recentPerformanceNumbers: number[] = [];
  graphicPerformanceTimeRange: number = 5;
  maxRange: number = 30;
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService,
    private performance: PerformanceService,
    public activatedRoute: ActivatedRoute
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveEmployees();
  }
  public graphPerformance = {
    data: [{}],
    layout: {
      title: 'Performance Points',
      barmode: 'stack',
    },
  };
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.employee = data[this.id];
      this.updatePerformanceGraphics();
      let result = this.performance.findAverageAndTotal(this.employee);
      this.employee.averagePoints = `${result[0]} / ${result[1]}`;
      this.maxRange = Object.keys(this.employee.dailyPoints!).length;
      this.employee.letterGrade = this.performance.findLetterGrade(
        result[0] / result[1]
      );
      this.averageToday = this.employee!.dailyPoints![this.today];
      this.totalToday = this.employee.totalDailyPoints![this.today];
    });
  }
  sortKeysAndValuesPerformance(time: number) {
    const sortedKeys = Object.keys(this.employee.dailyPoints!)
      .sort((a, b) => +this.toDate(a) - +this.toDate(b))
      .slice(-time);

    // to allow for infinity ( when the totalpoint is 0, yet the dailypoint is not zero), add one where the value of total is zero
    for (let key in this.employee.dailyPoints) {
      if (this.employee.totalDailyPoints![key] === '0') {
        this.employee.dailyPoints[key] = (
          Number(this.employee.dailyPoints[key]) + 1
        ).toString();
        this.employee.totalDailyPoints![key] = '1';
      }
    }
    const values = sortedKeys.map((key) =>
      (
        (Number(this.employee.dailyPoints![key]) * 100) /
        Number(this.employee.totalDailyPoints![key])
      ).toString()
    );
    return [sortedKeys, values];
  }
  toDate(dateString: string) {
    const [month, day, year] = dateString
      .split('-')
      .map((part: any) => parseInt(part, 10));
    return new Date(year, month - 1, day);
  }
  updatePerformanceGraphics() {
    let sorted = this.sortKeysAndValuesPerformance(5);
    this.recentPerformanceDates = sorted[0];
    console.log(' the sorted values are', sorted);
    this.recentPerformanceNumbers = this.compute.convertToNumbers(sorted[1]);
    const color = this.compute.findColor(sorted[1]);

    this.graphPerformance = {
      data: [
        {
          x: this.recentPerformanceDates,
          y: this.recentPerformanceNumbers,
          type: 'scatter',
          mode: 'lines',
          marker: { color: 'rgb(0,76,153)' },
          line: {
            color: color,
            // width: 1200,
          },
        },
      ],
      layout: {
        title: 'Performance Points',
        barmode: 'stack',
      },
    };
  }
}
