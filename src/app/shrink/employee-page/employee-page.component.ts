import { Component, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

import { DataService } from 'src/app/services/data.service';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { LocationCoordinates } from 'src/app/models/user';
// import heic2any from 'heic2any';

@Component({
  selector: 'app-employee-page',
  templateUrl: './employee-page.component.html',
  styleUrls: ['./employee-page.component.css'],
})
export class EmployeePageComponent implements OnInit {
  salaryPaid: string = '';
  showRequestVacation: boolean = false;

  requestDate: string = '';

  isLoading: boolean = false;
  vacation: number = 0;
  currentDownloadUrl: string = '';
  displayMakePayment: boolean = false;
  displayAttendance: boolean = false;
  attendance: string = '';
  // today = this.time.todaysDateMonthDayYear();

  limitHour: number = 9;
  limitMinutes: number = 0;
  onTime: string = '';

  locationCoordinate: LocationCoordinates = {};

  withinRadius: boolean | null = null;
  errorMessage: string | null = null;
  locationSet: boolean = false;

  currentLat: number = 0;
  currentLng: number = 0;
  radius = 1000; //Set your desired radius in meters.

  displayBonus: boolean = false;
  displayPayment: boolean = false;
  displayCode: boolean = false;
  displaySetCode: boolean = false;
  code: string = '';

  attendanceComplete: boolean = true;
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth() + 1;
  givenMonth: number = this.currentMonth;
  lastMonth: number = this.currentMonth - 1;
  month = this.compute.getMonthNameFrench(this.currentMonth);
  year = this.currentDate.getFullYear();
  givenYear = this.year;
  monthsList: number[] = [...Array(12).keys()].map((i) => i + 1);
  day = this.currentDate.getDate();
  yearsList: number[] = this.time.yearsList;
  j: number = 1;
  monthYear = `${this.month} ${this.year}`;
  id: any = '';
  invoiceNum: string = '';
  employees: Employee[] = [];
  employee: Employee = {};
  averageToday: string = '';
  totalPointsMonth: string = '';
  paymentAmounts: string[] = [];
  paymentDates: string[] = [];

  paymentNothing: number = 0;
  paymentAbsent: number = 0;
  totalPayments: number = 0;

  averagePointsMonth: string = '';
  performancePercentageMonth: string = '';
  performancePercentageTotal: string = '';
  totalToday: string = '';
  today: string = this.time.todaysDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);
  recentPerformanceDates: string[] = [];
  recentPerformanceNumbers: number[] = [];
  graphicPerformanceTimeRange: number = 5;
  maxRange: number = 0;
  bonusPercentage: number = 0;
  checkVisible: string = 'false';
  paymentCheckVisible: string = 'false';
  bonusMonth: number = 0;
  bonusAmount: number = 0;
  bestTeamBonusAmount: number = 0;
  bestEmployeeBonusAmount: number = 0;
  bestManagerBonusAmount: number = 0;
  thisMonthPaymentAmount: number = 0;
  totalBonusAmount: number = 0;
  paymentCode: string = '';

  paymentAmount: number = 0;
  preposition: string = '';

  totalPoints: string = '';
  baseSalary: string = '';
  averagePoints: string = '';
  totalBonusSalary: string = '';
  salaryThisMonth = '';
  constructor(
    private router: Router,
    private data: DataService,
    public auth: AuthService,
    public time: TimeService,
    private compute: ComputationService,
    private performance: PerformanceService,
    public activatedRoute: ActivatedRoute,
    private storage: AngularFireStorage
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
      barmode: 'bar',
    },
  };
  public graphMonthPerformance = {
    data: [
      {
        domain: { x: [0, 1], y: [0, 1] },
        value: 270,
        title: { text: 'Speed' },
        type: 'indicator',
        mode: 'gauge+number',
        gauge: {
          axis: { range: [0, 100], tickcolor: 'blue' }, // Color of the ticks (optional)
          bar: { color: 'blue' }, // Single color for the gauge bar (needle)
        },
      },
    ],
    layout: {
      margin: { t: 0, b: 0, l: 0, r: 0 }, // Adjust margins
      responsive: true, // Make the chart responsive
    },
  };

  findNumberOfVacationDaysLeft() {
    const acceptedDays =
      Number(this.employee.vacationAcceptedNumberOfDays) || 0;
    this.vacation = 7 - acceptedDays;
  }

  toggle(property: 'showRequestVacation' | 'isLoading') {
    this[property] = !this[property];
  }
  toggleBonus() {
    this.displayBonus = !this.displayBonus;
  }
  togglePayment() {
    this.displayPayment = !this.displayPayment;
  }
  toggleCode() {
    this.displayCode = !this.displayCode;
  }
  toggleSetCode() {
    this.displaySetCode = !this.displaySetCode;
  }

  setEmployeeBonusAmounts() {
    this.bonusPercentage = this.employee.bonusPercentage
      ? parseFloat(this.employee.bonusPercentage)
      : 0;
    this.bonusAmount = this.employee.bonusAmount
      ? parseFloat(this.employee.bonusAmount)
      : 0;
    this.bestTeamBonusAmount = this.employee.bestTeamBonusAmount
      ? parseFloat(this.employee.bestTeamBonusAmount)
      : 0;
    this.bestEmployeeBonusAmount = this.employee.bestEmployeeBonusAmount
      ? parseFloat(this.employee.bestEmployeeBonusAmount)
      : 0;
    this.bestManagerBonusAmount = this.employee.bestManagerBonusAmount
      ? parseFloat(this.employee.bestManagerBonusAmount)
      : 0;
    this.thisMonthPaymentAmount = this.employee.thisMonthPaymentAmount
      ? parseFloat(this.employee.thisMonthPaymentAmount)
      : 0;
    this.checkVisible = this.employee.checkVisible
      ? this.employee.checkVisible
      : 'false';
    this.paymentCheckVisible = this.employee.paymentCheckVisible
      ? this.employee.paymentCheckVisible
      : 'false';
    this.paymentCode = this.employee.paymentCode
      ? this.employee.paymentCode
      : '';
    this.paymentAmount = this.employee.paymentAmount
      ? parseFloat(this.employee.paymentAmount)
      : 0;
    this.paymentAbsent = this.employee.paymentAbsent
      ? parseFloat(this.employee.paymentAbsent)
      : 0;
    this.paymentNothing = this.employee.paymentNothing
      ? parseFloat(this.employee.paymentNothing)
      : 0;
    this.totalPayments = this.employee.totalPayments
      ? parseFloat(this.employee.totalPayments)
      : 0;
  }

  computeTotalBonusAmount() {
    this.totalBonusAmount =
      Number(this.bonusAmount) +
      Number(this.bestTeamBonusAmount) +
      Number(this.bestEmployeeBonusAmount) +
      Number(this.bestManagerBonusAmount);

    this.employee.totalPayments = this.totalBonusAmount.toString();
    this.employee.totalBonusThisMonth = this.totalBonusAmount.toString();
  }
  computeTotalPayment() {
    // the payment of the month is the total payment of the month minus the absent and nothing days
    this.totalPayments =
      this.paymentAmount - this.paymentAbsent - this.paymentNothing;
    return this.totalPayments;
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      // set location coordinates
      if (this.auth.currentUser && this.auth.currentUser.locationCoordinates) {
        this.locationCoordinate = this.auth.currentUser.locationCoordinates;
        this.currentLat = Number(this.locationCoordinate.lattitude);
        this.currentLng = Number(this.locationCoordinate.longitude);
      }
      this.employee = data[this.id];
      this.findNumberOfVacationDaysLeft();
      this.getAllPayments();
      this.setEmployeeBonusAmounts();
      this.computeTotalBonusAmount();
      this.preposition = this.time.findPrepositionStartWithVowelOrConsonant(
        this.time.monthFrenchNames[this.givenMonth - 1]
      );

      this.maxRange = Object.keys(this.employee.dailyPoints!).length;
      if (this.employee.role === 'Manager') {
        let result = this.performance.findAverageAndTotalAllEmployee(
          this.employees
        );
        this.employee.averagePoints = `${result[0]} / ${result[1]}`;
        this.performancePercentageTotal = this.computePerformancePercentage(
          result[0].toString(),
          result[1].toString()
        );
        this.averageToday = this.performance.findAverageTotalToday(
          this.employees
        );
        this.totalToday = this.performance.findTotalToday(this.employees);

        this.averagePointsMonth =
          this.compute.findTotalForMonthAllDailyPointsEmployees(
            this.employees,
            this.givenMonth.toString(),
            this.givenYear.toString()
          );

        this.totalPointsMonth =
          this.compute.findTotalForMonthAllTotalDailyPointsEmployees(
            this.employees,
            this.givenMonth.toString(),
            this.givenYear.toString()
          );
      } else {
        let result = this.performance.findAverageAndTotal(this.employee);

        this.employee.averagePoints = `${result[0]} / ${result[1]}`;
        this.performancePercentageTotal = this.computePerformancePercentage(
          result[0].toString(),
          result[1].toString()
        );

        this.averageToday = this.employee!.dailyPoints![this.today];
        this.totalToday = this.employee.totalDailyPoints![this.today];

        this.averagePointsMonth = this.compute.findTotalForMonth(
          this.employee.dailyPoints!,
          this.givenMonth.toString(),
          this.givenYear.toString()
        );

        this.totalPointsMonth = this.compute.findTotalForMonth(
          this.employee.totalDailyPoints!,
          this.givenMonth.toString(),
          this.givenYear.toString()
        );
      }
      this.employee.performancePercantage = this.computePerformancePercentage(
        this.averageToday,
        this.totalToday
      );
      this.performancePercentageMonth = this.computePerformancePercentage(
        this.averagePointsMonth,
        this.totalPointsMonth
      );

      // this.computeThisMonthSalary();
      if (
        this.employee.attendance !== undefined &&
        this.employee.attendance[this.today] !== undefined
      ) {
        // console.log('hello', this.employee.attendance[this.today]);
        this.attendanceComplete = false;
      }
      this.generateAttendanceTable(this.givenMonth, this.givenYear);

      this.updatePerformanceGraphics(this.graphicPerformanceTimeRange);
    });
  }

  toggleBonusIfCodeCorrect() {
    if (this.code === this.paymentCode && this.checkVisible === 'true') {
      this.toggleBonus();
      this.toggleCode();
    } else if (
      this.code === this.paymentCode &&
      this.paymentCheckVisible === 'true'
    ) {
      this.togglePayment();
      this.toggleCode();
    } else {
      alert('Code incorrect. Essayez encore');
    }
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
  sortKeysAndValuesPerformance(time: number) {
    const sortedKeys = Object.keys(this.employee.dailyPoints!)
      .sort((a, b) => +this.time.toDate(a) - +this.time.toDate(b))
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
  toggleMakePayment() {
    this.displayMakePayment = !this.displayMakePayment;
    this.currentDownloadUrl = '';
  }
  async setCode() {
    try {
      this.employee.paymentCode = this.code;
      await this.data.updateEmployeePaymentCode(this.employee);
      this.toggleSetCode();
    } catch (error) {
      console.error('Error setting payment code:', error);
      // You might want to show an error message to the user here
    }
  }

  getAllPayments() {
    if (this.employee.payments !== undefined) {
      let currentPayments = this.compute.sortArrayByDateDescendingOrder(
        Object.entries(this.employee.payments!)
      );
      this.paymentAmounts = currentPayments.map((entry) => entry[1]);
      this.paymentDates = currentPayments.map((entry) =>
        this.time.convertTimeFormat(entry[0])
      );
    }
  }
  togglePaymentCheckVisible() {
    this.paymentCheckVisible =
      this.paymentCheckVisible === 'true' ? 'false' : 'true';
  }
  updatePerformanceGraphics(time: number) {
    let sorted = this.sortKeysAndValuesPerformance(time);
    this.recentPerformanceDates = sorted[0];
    // console.log(' the sorted values are', sorted);
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
            shape: 'spline',
            // width: 1200,
          },
        },
      ],
      layout: {
        title: 'Performance Points',
        barmode: 'stack',
      },
    };
    let num = Number(this.performancePercentageMonth);
    let gaugeColor = this.compute.getGradientColor(Number(num));

    this.graphMonthPerformance = {
      data: [
        {
          domain: { x: [0, 1], y: [0, 1] },
          value: num,
          title: {
            text: `Performance ${
              this.time.monthFrenchNames[this.givenMonth - 1]
            } %`,
          },
          type: 'indicator',
          mode: 'gauge+number',
          gauge: {
            axis: { range: [0, 100], tickcolor: gaugeColor }, // Color of the ticks (optional)
            bar: { color: gaugeColor }, // Single color for the gauge bar (needle)
          },
        },
      ],
      layout: {
        margin: { t: 20, b: 20, l: 20, r: 20 }, // Adjust margins
        responsive: true, // Make the chart responsive
      },
    };
  }

  onImageClick(): void {
    const fileInput = document.getElementById('getFile') as HTMLInputElement;
    fileInput.click();
  }

  async startUpload(event: FileList) {
    const file = event?.item(0);
    console.log('current file data', file);

    if (file?.type.split('/')[0] !== 'image') {
      console.log('unsupported file type');
      return;
    }

    if (file?.size >= 5000000) {
      alert(
        "L'image est trop grande. La taille maximale du fichier est de 5MB"
      );
      return;
    }

    let fileToUpload = file;

    // Check if the image is HEIC format and convert it
    if (file?.type === 'image/heic') {
      try {
        const heic2any = (await import('heic2any')).default;
        const convertedBlob: any = await heic2any({
          blob: file,
          toType: 'image/png',
          quality: 0.7,
        });

        fileToUpload = new File([convertedBlob], `${file.name}.png`, {
          type: 'image/png',
        });
      } catch (error) {
        console.error('Error converting HEIC to PNG:', error);
        return;
      }
    }

    const path = `invoice/${this.employee.firstName}-${this.employee.lastName}-${this.employee.paymentsPicturePath?.length}`;
    console.log('the path', path);

    const uploadTask = await this.storage.upload(path, fileToUpload);
    let url = await uploadTask.ref.getDownloadURL();
    this.currentDownloadUrl = url;
  }

  addPayment() {
    if (this.salaryPaid === '' || this.currentDownloadUrl === '') {
      alert('Remplissez toutes les données');
      return;
    } else if (Number.isNaN(Number(this.salaryPaid))) {
      alert('Entrée incorrecte. Entrez un nombre pour le montant');
      return;
    } else if (Number(this.salaryPaid) <= 0) {
      alert('le montant de paiement doit etre positifs ou plus grand que 0');
      return;
    } else {
      let conf = confirm(
        ` Vous voulez effectué un payment de  ${this.salaryPaid} $ a ${this.employee.firstName}. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      this.employee.paymentsPicturePath?.push(this.currentDownloadUrl);
      this.employee.salaryPaid = this.salaryPaid;
      this.data.addPaymentToEmployee(this.employee);
      this.data
        .updateEmployeePaymentPictureData(this.employee)
        .then(() => {})
        .then(() => {
          alert('Employé Paiement ajoutée avec Succès');
        })
        .catch((err) => {
          alert(
            "Une erreur s'est produite lors de l'ajout de Paiment de l'employé . Essayez encore."
          );
          console.log(err);
        });
      this.toggleMakePayment();
    }
  }
  getVacationInProgressDates(): string[] {
    return Object.keys(this.employee.attendance!)
      .filter((date) => this.employee.attendance![date] === 'VP')
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }

  generateInvoice() {
    this.compute.generateInvoice(this.employee);
  }
  generateInvoiceBonus() {
    this.compute.generateInvoice(this.employee, 'Bonus');
  }
  generateAttendanceTable(month: number, year: number) {
    const dict: any = this.employee?.attendance || {}; // Use an empty object if attendance is null or undefined.
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const tableBody = document.getElementById('attendance-body');
    tableBody!.innerHTML = '';

    let date = 1;
    for (let i = 0; i < 6; i++) {
      // Maximum 6 rows to cover all days
      const row = document.createElement('tr');

      for (let j = 0; j < 7; j++) {
        const cell = document.createElement('td');
        if (i === 0 && j < firstDayIndex) {
          // Add empty cells for days before the 1st of the month
          cell.classList.add('not-filled');
          cell.innerHTML = '';
        } else if (date > daysInMonth) {
          // Add empty cells for days after the last day of the month
          cell.classList.add('bg-gray-200', 'p-16');
          cell.innerHTML = '';
        } else {
          // Build a date string that matches the beginning of the keys
          const dateStr = `${month}-${date}-${year}`;

          // Get all keys for this day
          const keysForDate = Object.keys(dict).filter((key) =>
            key.startsWith(dateStr)
          );

          // Pick the key with the latest time if available.
          // We assume the key format is: month-date-year-hour-minute-second.
          let matchedKey: string | undefined;
          if (keysForDate.length > 0) {
            matchedKey = keysForDate.reduce((prev, current) => {
              const partsPrev = prev.split('-');
              const partsCurrent = current.split('-');
              const hourPrev = parseInt(partsPrev[3] || '0', 10);
              const minutePrev = parseInt(partsPrev[4] || '0', 10);
              const secondPrev = parseInt(partsPrev[5] || '0', 10);
              const hourCurrent = parseInt(partsCurrent[3] || '0', 10);
              const minuteCurrent = parseInt(partsCurrent[4] || '0', 10);
              const secondCurrent = parseInt(partsCurrent[5] || '0', 10);
              const timePrev = hourPrev * 3600 + minutePrev * 60 + secondPrev;
              const timeCurrent =
                hourCurrent * 3600 + minuteCurrent * 60 + secondCurrent;
              return timeCurrent > timePrev ? current : prev;
            });
          }

          const attendance = matchedKey ? dict[matchedKey] : undefined;

          if (attendance) {
            // Extract hours and minutes from the matched key if available.
            const time = matchedKey!.split('-').slice(3, 5).join(':'); // e.g., "18:54" format

            if (attendance === 'P') {
              cell.classList.add(
                'bg-green-600',
                'border',
                'border-black',
                'text-white'
              );
              cell.innerHTML = `${date}<br>Present${
                time ? `<br><span class="small-time">${time}</span>` : ''
              }`;
            } else if (attendance === 'A') {
              cell.classList.add(
                'bg-red-600',
                'border',
                'border-black',
                'text-white'
              );
              cell.innerHTML = `${date}<br>Absent${
                time ? `<br><span class="small-time">${time}</span>` : ''
              }`;
            } else if (attendance === 'VP') {
              cell.classList.add(
                'bg-blue-600',
                'border',
                'border-black',
                'text-white'
              );
              cell.innerHTML = `${date}<br>Vacance En Cours...`;
            } else if (attendance === 'V') {
              cell.classList.add(
                'bg-yellow-400',
                'border',
                'border-black',
                'text-white'
              );
              cell.innerHTML = `${date}<br>Vacance`;
            } else if (attendance === 'L') {
              cell.classList.add(
                'bg-orange-600',
                'border',
                'border-black',
                'text-white'
              );
              cell.innerHTML = `${date}<br>Retard${
                time ? `<br><span class="small-time">${time}</span>` : ''
              }`;
            } else if (attendance === 'N') {
              cell.classList.add(
                'bg-gray-400',
                'border',
                'border-black',
                'text-white'
              );
              cell.innerHTML = `${date}<br>Néant${
                time ? `<br><span class="small-time">${time}</span>` : ''
              }`;
            }
          } else {
            // Default cell styling for days with no attendance data
            cell.classList.add('border', 'border-black', 'p-4');
            cell.innerHTML = date.toString();
          }
          date++;
        }
        row.appendChild(cell);
      }

      tableBody!.appendChild(row);

      if (date > daysInMonth) {
        break;
      }
    }
  }

  toggleAttendance() {
    this.displayAttendance = !this.displayAttendance;
  }
  async updateEmployeeBonusInfoAndSignCheck() {
    // Update bonus amounts
    this.employee.bonusPercentage = this.bonusPercentage.toString();
    this.employee.bonusAmount = this.bonusAmount.toString();
    this.employee.bestTeamBonusAmount = this.bestTeamBonusAmount.toString();
    this.employee.bestEmployeeBonusAmount =
      this.bestEmployeeBonusAmount.toString();
    this.employee.bestManagerBonusAmount =
      this.bestManagerBonusAmount.toString();
    this.toggle('isLoading');

    try {
      this.computeTotalBonusAmount(); // Recalculate total bonus after update
      await this.data.updateEmployeeBonusInfo(this.employee);

      await this.data.toggleEmployeeCheckVisibility(this.employee);

      // Generate the bonus check and get the Blob
      const blob: any = await this.compute.generateBonusCheck(
        this.employee,
        'Bonus'
      );

      // Upload the Blob to Firebase Storage
      await this.uploadBonusCheck(blob, this.employee);

      alert('Bonus Signé avec Succès');
    } catch (err) {
      alert(
        "Une erreur s'est produite lors de la modification de l'employé. Essayez encore."
      );
      console.error(err);
    } finally {
      this.toggleBonus();
      this.toggle('isLoading');
    }
  }
  async updateEmployeePaymentInfo() {
    this.setPaymentInfo();
    try {
      await this.data.updateEmployeePaymentInfo(this.employee);
    } catch (err) {
      alert(err);
    } finally {
      this.togglePayment();
    }
  }

  setPaymentInfo() {
    this.employee.paymentAmount = this.paymentAmount.toString();
    this.employee.paymentAbsent = this.paymentAbsent.toString();
    this.employee.paymentNothing = this.paymentNothing.toString();
    this.employee.totalPayments = this.computeTotalPayment().toString();
  }
  async updateEmployeePaymentInfoAndSignCheck() {
    this.setPaymentInfo();
    // this.employee.paymentAmount = this.paymentAmount.toString();
    this.toggle('isLoading');
    try {
      await this.data.updateEmployeePaymentInfo(this.employee);
      await this.data.toggleEmployeePaymentCheckVisibility(this.employee);
      // this.employee.totalPayments = this.employee.paymentAmount;
      this.togglePaymentCheckVisible();
      // Generate the bonus check and get the Blob
      const blob: any = await this.compute.generatePaymentCheck(
        this.employee,
        'Paiement',
        this.totalPayments.toString()
      );

      // Upload the Blob to Firebase Storage
      await this.uploadBonusCheck(blob, this.employee, 'Paiement');

      alert('Paiment Signé avec Succès');
    } catch (err) {
      alert(err);
    } finally {
      this.togglePayment();
      this.toggle('isLoading');
    }
  }
  async updateEmployeeBonusInfo() {
    // Update bonus amounts
    this.employee.bonusPercentage = this.bonusPercentage.toString();
    this.employee.bonusAmount = this.bonusAmount.toString();
    this.employee.bestTeamBonusAmount = this.bestTeamBonusAmount.toString();
    this.employee.bestEmployeeBonusAmount =
      this.bestEmployeeBonusAmount.toString();
    this.employee.bestManagerBonusAmount =
      this.bestManagerBonusAmount.toString();

    try {
      this.computeTotalBonusAmount();
      await this.data.updateEmployeeBonusInfo(this.employee);
      // this.computeTotalBonusAmount();
    } catch (err) {
      alert(
        "Une erreur s'est produite lors de la modification de l'employé. Essayez encore."
      );
      console.error(err);
    } finally {
      this.toggleBonus();
    }
  }
  async uploadBonusCheck(blob: Blob, employee: Employee, total = 'bonus') {
    const timestamp = new Date().getTime();
    const path = `invoice/${employee.firstName}-${employee.lastName}-${timestamp}.pdf`;

    try {
      // Upload the PDF blob to Firebase Storage
      const uploadTask = await this.storage.upload(path, blob);

      // Get the download URL of the uploaded PDF
      const url = await uploadTask.ref.getDownloadURL();
      console.log('Invoice uploaded successfully. Download URL:', url);

      // Initialize paymentsPicturePath if it's undefined
      if (!this.employee.paymentsPicturePath) {
        this.employee.paymentsPicturePath = [];
      }

      this.employee.paymentsPicturePath.push(url);
      console.log('the url of the bonus check is', url);
      console.log(
        'payemtnpicture path of the employee is',
        this.employee.paymentsPicturePath
      );
      await this.data.updateEmployeePaymentPictureData(this.employee);

      // I did not want to make a new function for this. so i just added a parameter to this function
      if (total === 'bonus') {
        this.employee.salaryPaid = this.totalBonusAmount.toString();
      } else {
        this.employee.salaryPaid = this.totalPayments.toString();
      }
      await this.data.addPaymentToEmployee(this.employee);

      // Optionally, update the employee's record with the invoice URL
      // await this.data.updateEmployeeBonusCheckUrl(employee, url);
    } catch (error) {
      console.error('Error uploading invoice:', error);
    }
  }

  async addAttendance(toggle = true, date = '') {
    if (this.attendance === '') {
      alert('Remplissez la presence, Réessayez');
      return;
    }
    try {
      let val: any = { [this.time.todaysDate()]: this.attendance };
      if (date !== '') {
        val = { [date]: this.attendance };
      }

      const value = await this.data.updateEmployeeAttendance(
        val,
        this.employee.uid!
      );
      // alert('Remplis avec succès!');
    } catch (err) {
      alert("Une erreur s'est produite lors de l'attendance, Réessayez");
      return;
    }
    this.attendance = '';
    if (toggle) {
      this.toggleAttendance();
    }
  }
  acceptVacation(date: string) {
    if (!this.employee.attendance || this.employee.attendance[date] !== 'VP') {
      console.error(`Date ${date} not in progress or not found.`);
      return;
    }

    // Update attendance from VP to V
    this.employee.attendance[date] = 'V';

    // Increase the number of accepted vacations
    let acceptedVacations =
      Number(this.employee.vacationAcceptedNumberOfDays) || 0;
    acceptedVacations += 1;
    this.employee.vacationAcceptedNumberOfDays = acceptedVacations.toString();

    console.log(
      'Updated attendance after acceptance:',
      this.employee.attendance
    );

    // Update the database
    this.data
      .updateEmployeeAttendance(
        { ...this.employee.attendance },
        this.employee.uid!
      )
      .then(() => {
        this.data.updateEmployeeNumberOfAcceptedVacation(
          acceptedVacations.toString(),
          this.employee.uid!
        );
        console.log('Acceptance successfully updated in the database.');
      })
      .catch((error) => {
        console.error('Error updating acceptance in the database:', error);
      });
  }

  rejectVacation(date: string) {
    if (!this.employee.attendance || !this.employee.attendance[date]) {
      console.error(`Date ${date} not found in attendance.`);
      return;
    }

    // Remove the entry from the attendance object
    delete this.employee.attendance[date];

    console.log(
      'Updated attendance after rejection:',
      this.employee.attendance
    );

    let vacationRequests =
      Number(this.employee.vacationRequestNumberOfDays) || 0;
    if (vacationRequests > 0) {
      vacationRequests -= 1;
      this.employee.vacationRequestNumberOfDays = vacationRequests.toString();
    }

    // Update the database
    this.data
      .updateEmployeeAttendanceRejection(
        { ...this.employee.attendance },
        this.employee.uid!
      )
      .then(() => {
        this.data.updateEmployeeNumberOfVacationRequest(
          vacationRequests.toString(),
          this.employee.uid!
        );
        console.log('Rejection successfully updated in the database.');
      })
      .catch((error) => {
        console.error('Error updating rejection in the database:', error);
      });
  }

  async toggleCheckVisibility() {
    try {
      await this.data.toggleEmployeeCheckVisibility(this.employee);
      // Optionally, you can add a success message here
      // console.log('Check visibility toggled successfully');
    } catch (error) {
      console.error('Error toggling check visibility:', error);
      // Optionally, you can show an alert or handle the error in some way
      alert(
        'An error occurred while toggling check visibility. Please try again.'
      );
    }
  }
  async togglePaymentCheckVisibility() {
    try {
      await this.data.toggleEmployeePaymentCheckVisibility(this.employee);
      // console.log('Payment check visibility toggled successfully');
    } catch (error) {
      console.error('Error toggling payment check visibility:', error);
      alert(
        'An error occurred while toggling payment check visibility. Please try again.'
      );
    }
  }
  // Method to set the current location as the workplace
  setLocation(): void {
    this.compute
      .getLocation()
      .then((position) => {
        this.currentLat = position.coords.latitude;
        this.currentLng = position.coords.longitude;
        this.locationSet = true;
        if (this.locationSet) {
          alert("l'emplacement a été défini!");
        }
        this.errorMessage = null; // Clear any previous error
        const loc: LocationCoordinates = {
          longitude: this.currentLng.toString(),
          lattitude: this.currentLat.toString(),
        };
        try {
          // add location to the database
          const setL = this.data.setLocation(loc);
        } catch (error) {
          alert("Une erreur s'est produite. Veuillez réessayer.");
          console.error('Error setting location:', error);
          this.errorMessage = 'Failed to set location. Please try again.';
        }
        console.log(
          `Location set: Latitude ${this.currentLat}, Longitude ${this.currentLng}`
        );
      })
      .catch((error) => {
        this.errorMessage = error.message;
        this.locationSet = false;
      });
  }
  // Method to check if the user is within the set radius
  checkPresence(): void {
    if (!this.currentLat || !this.currentLng) {
      this.errorMessage =
        "Emplacement du travail non défini. Veuillez d'abord définir l'emplacement.";
      return;
    }

    this.compute
      .getLocation()
      .then((position) => {
        const { latitude, longitude } = position.coords;
        this.withinRadius = this.compute.checkWithinRadius(
          latitude,
          longitude,
          this.currentLat,
          this.currentLng,
          this.radius
        );
        this.onTime = this.time.isEmployeeOnTime(
          this.limitHour,
          this.limitMinutes
        )
          ? "A L'heure"
          : 'En Retard';

        this.errorMessage = null; // Clear any previous error
      })
      .catch((error) => {
        this.errorMessage = error.message;
        this.withinRadius = null;
      });
  }
  async determineAttendance() {
    let conf = confirm(
      ` Etes-vous sûr de vouloir marquer votre présence pour aujourd'hui ?`
    );
    if (!conf) {
      return;
    }
    let currentAttendance = 'A';
    console.log('Entering determine attendance', this.withinRadius);
    if (this.time.isEmployeeOnTime(this.limitHour, this.limitMinutes)) {
      currentAttendance = 'P';
    } else {
      currentAttendance = 'L';
    }
    await this.compute
      .getLocation()
      .then((position) => {
        const { latitude, longitude } = position.coords;
        this.withinRadius = this.compute.checkWithinRadius(
          latitude,
          longitude,
          this.currentLat,
          this.currentLng,
          this.radius
        );

        this.errorMessage = null; // Clear any previous error
      })
      .then(() => {
        if (!this.withinRadius) {
          alert(
            "Vous n'êtes pas sur le lieu de travail. Réessayez quand vous l'êtes"
          );
          return;
        }
        if (this.withinRadius) {
          this.attendance = currentAttendance;
          this.addAttendance(false);
        }
      })
      .catch((error) => {
        this.errorMessage = error.message;
        this.withinRadius = null;
      });
  }

  requestVacation() {
    console.log('empolyee attendance', this.employee.attendance);
    if (!this.time.isValidRequestDateForVacation(this.requestDate)) {
      return;
    }
    // Vacation in process
    this.attendance = 'VP';

    const formattedDate = this.formatDate(this.requestDate);

    // Check if the date is already requested
    if (
      this.employee.attendance &&
      this.employee.attendance[formattedDate] === 'VP'
    ) {
      alert('Cette date a déjà été demandée. Veuillez en choisir une autre.');
      return;
    }

    // Add the number of requests for vacation
    let vacationRequests =
      Number(this.employee.vacationRequestNumberOfDays) || 0;
    if (vacationRequests >= 8) {
      alert(
        "Vous avez déjà utilisé toutes vos vacances. Essayez l'année prochaine"
      );
      return;
    }

    vacationRequests += 1;
    this.employee.vacationRequestNumberOfDays = vacationRequests.toString();

    this.addAttendance(false, formattedDate);
    this.data.updateEmployeeNumberOfVacationRequest(
      vacationRequests.toString(),
      this.employee.uid!
    );

    this.toggle('showRequestVacation');
  }
  private formatDate(inputDate: string): string {
    const [year, month, day] = inputDate.split('-');
    const now = new Date();
    // const hours = now.getHours();

    // Trim leading zeros
    const trimmedMonth = month.replace(/^0/, '');
    const trimmedDay = day.replace(/^0/, '');

    // Return the formatted date
    return `${trimmedMonth}-${trimmedDay}-${year}`;
  }
}
