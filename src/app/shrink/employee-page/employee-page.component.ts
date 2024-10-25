import { Component, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

import { DataService } from 'src/app/services/data.service';
import { AngularFireStorage } from '@angular/fire/compat/storage';
// import heic2any from 'heic2any';

@Component({
  selector: 'app-employee-page',
  templateUrl: './employee-page.component.html',
  styleUrls: ['./employee-page.component.css'],
})
export class EmployeePageComponent implements OnInit {
  salaryPaid: string = '';
  currentDownloadUrl: string = '';
  displayMakePayment: boolean = false;
  displayAttendance: boolean = false;
  attendance: string = '';
  // today = this.time.todaysDateMonthDayYear();

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
  }

  computeTotalBonusAmount() {
    this.totalBonusAmount =
      this.bonusAmount +
      this.bestTeamBonusAmount +
      this.bestEmployeeBonusAmount +
      this.bestManagerBonusAmount;
    this.employee.totalPayments = this.totalBonusAmount.toString();
  }
  computeTotalPayment() {
    this.employee.totalPayments = this.employee.paymentAmount;
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;
      this.employee = data[this.id];
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

  generateInvoice() {
    this.compute.generateInvoice(this.employee);
  }
  generateInvoiceBonus() {
    this.compute.generateInvoice(this.employee, 'Bonus');
  }

  generateAttendanceTable(month: number, year: number) {
    const dict = this.employee.attendance;
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const tableBody = document.getElementById('attendance-body');
    tableBody!.innerHTML = '';

    let date = 1;
    for (let i = 0; i < 6; i++) {
      // maximum 6 rows to cover all days
      const row = document.createElement('tr');

      for (let j = 0; j < 7; j++) {
        const cell = document.createElement('td');
        if (i === 0 && j < firstDayIndex) {
          cell.classList.add('not-filled');
          cell.innerHTML = '';
        } else if (date > daysInMonth) {
          cell.classList.add('bg-gray-200');
          cell.classList.add('p-16');
          // cell.classList.add('not-filled');

          cell.innerHTML = '';
        } else {
          const dateStr = `${month}-${date}-${year}`;
          if (dict !== undefined && dict![dateStr] === 'P') {
            cell.classList.add('bg-green-600');
            cell.classList.add('border');
            cell.classList.add('border-black');
            cell.classList.add('text-white');
            cell.innerHTML = `${date}<br>Present`;
          } else if (dict !== undefined && dict![dateStr] === 'A') {
            cell.classList.add('bg-red-600');
            cell.classList.add('border');
            cell.classList.add('border-black');
            cell.classList.add('text-white');
            cell.innerHTML = `${date}<br>Absent`;
          } else {
            cell.classList.add('border');
            cell.classList.add('border-black');
            cell.classList.add('p-4');
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

    try {
      await this.data.updateEmployeeBonusInfo(this.employee);
      this.computeTotalBonusAmount(); // Recalculate total bonus after update
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
    }
  }
  async updateEmployeePaymentInfo() {
    this.employee.paymentAmount = this.paymentAmount.toString();
    try {
      await this.data.updateEmployeePaymentInfo(this.employee);
    } catch (err) {
      alert(err);
    } finally {
      this.togglePayment();
    }
  }
  async updateEmployeePaymentInfoAndSignCheck() {
    this.employee.paymentAmount = this.paymentAmount.toString();
    try {
      await this.data.updateEmployeePaymentInfo(this.employee);
      await this.data.toggleEmployeePaymentCheckVisibility(this.employee);
      this.employee.totalPayments = this.employee.paymentAmount;
      this.togglePaymentCheckVisible();
      // Generate the bonus check and get the Blob
      const blob: any = await this.compute.generatePaymentCheck(
        this.employee,
        'Paiement',
        this.paymentAmount.toString()
      );

      // Upload the Blob to Firebase Storage
      await this.uploadBonusCheck(blob, this.employee, 'Paiement');

      alert('Paiment Signé avec Succès');
    } catch (err) {
      alert(err);
    } finally {
      this.togglePayment();
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
      await this.data.updateEmployeeBonusInfo(this.employee);
      this.computeTotalBonusAmount();
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
        this.employee.salaryPaid = this.paymentAmount.toString();
      }
      await this.data.addPaymentToEmployee(this.employee);

      // Optionally, update the employee's record with the invoice URL
      // await this.data.updateEmployeeBonusCheckUrl(employee, url);
    } catch (error) {
      console.error('Error uploading invoice:', error);
    }
  }

  async addAttendance() {
    if (this.attendance === '') {
      alert('Remplissez la presence, Réessayez');
      return;
    }
    try {
      let val: any = { [this.time.todaysDateMonthDayYear()]: this.attendance };
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
    this.toggleAttendance();
  }

  async toggleCheckVisibility() {
    try {
      await this.data.toggleEmployeeCheckVisibility(this.employee);
      // Optionally, you can add a success message here
      console.log('Check visibility toggled successfully');
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
      console.log('Payment check visibility toggled successfully');
    } catch (error) {
      console.error('Error toggling payment check visibility:', error);
      alert(
        'An error occurred while toggling payment check visibility. Please try again.'
      );
    }
  }
}
