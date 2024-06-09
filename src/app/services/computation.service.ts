import { Injectable } from '@angular/core';
import { Client } from '../models/client';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { TimeService } from './time.service';
import { Employee } from '../models/employee';
import { User, UserDailyField } from '../models/user';
import { AuthService } from './auth.service';
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;
@Injectable({
  providedIn: 'root',
})
export class ComputationService {
  constructor(private time: TimeService) {}
  colorPositive: string = '#008080';
  colorNegative: string = '#ff0000';
  today = this.time.todaysDateMonthDayYear();
  convertCongoleseFrancToUsDollars(value: string) {
    let input = Number(value);
    if (isNaN(input)) return '';

    let dollars = Math.ceil(input * 0.00036);

    return dollars;
  }
  convertUsDollarsToCongoleseFranc(value: string) {
    let input = Number(value);
    if (isNaN(input)) return '';

    let dollars = Math.floor(input * 2800);

    return dollars;
  }
  minimumPayment(client: Client) {
    const pay = Number(client.amountToPay) / Number(client.paymentPeriodRange);
    return pay.toString();
  }
  computeExpectedPerDate(clients: Client[]) {
    let total = 0;

    for (let client of clients) {
      if (Number(client.amountToPay) - Number(client.amountPaid) >= 0) {
        const pay =
          Number(client.amountToPay) / Number(client.paymentPeriodRange);

        total += pay;
      }
    }
    return total;
  }
  computeTotalLoanPerDate(clients: Client[]) {
    let total = 0;
    for (let client of clients) {
      total += Number(client.loanAmount);
    }
    return total;
  }
  calculateTotalPayments(payments: any, dateToCheck: string) {
    // Initialize total amount
    let total = 0;

    // Iterate over the payments map
    for (let [dateTime, amount] of Object.entries(payments)) {
      // Extract date by ignoring time
      let dateParts = dateTime.split('-').slice(0, 3);
      let date = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`;
      // Check if the date matches the specified date
      if (date === dateToCheck) {
        total += Number(amount);
      }
    }

    return total;
  }
  convertToNumbers(array: any) {
    let result: number[] = [];
    for (let a of array) {
      result.push(Number(a));
    }
    return result;
  }

  sortArrayByDateDescendingOrder(array: [string, string][]) {
    // Sort the array by date in descending order
    array.sort((a, b) => {
      // Convert date strings to Date objects
      const dateA = new Date(
        a[0].replace(/(\d+)-(\d+)-(\d+)-(\d+)-(\d+)-(\d+)/, '$1/$2/$3 $4:$5:$6')
      );
      const dateB = new Date(
        b[0].replace(/(\d+)-(\d+)-(\d+)-(\d+)-(\d+)-(\d+)/, '$1/$2/$3 $4:$5:$6')
      );
      return dateB.getTime() - dateA.getTime(); // Sort in descending order
    });

    return array;
  }

  findColor(array: string[]) {
    let start = Number(array[0]);
    let end = Number(array[array.length - 1]);
    return end - start >= 0 ? this.colorPositive : this.colorNegative;
  }
  findSum(array: string[]) {
    let total = 0;
    for (let a of array) {
      total += Number(a);
    }
    return total;
  }
  roundNumber(num: any) {
    let rounded: any = Math.round(num * 10) / 10;
    return rounded;
  }

  filterClientsWithoutDebtFollowedByEmployee(
    allclients: Client[],
    employee: Employee
  ) {
    // Filter clients with debt left from the entire client list
    const clientsWithDebt = allclients.filter(
      (client: any) => client.debtLeft > 0
    );

    // Filter employees who have clients with debt left
    const filteredClients = employee.clients!.filter((uid: string) => {
      const client = clientsWithDebt.find((client) => client.uid === uid);
      return client !== undefined;
    });

    return filteredClients;
  }

  findTotalForMonth(
    dailyReimbursement: { [key: string]: string },
    month: string,
    year: string
  ) {
    const targetMonth = parseInt(month, 10);
    const targetYear = parseInt(year, 10);

    let total = 0;
    for (const [date, amount] of Object.entries(dailyReimbursement)) {
      const [month, day, year] = date.split('-').map(Number);
      if (month === targetMonth && year === targetYear) {
        total += parseInt(amount as string, 10);
      }
    }
    return total.toString();
  }
  findTotalForToday(reserve: { [key: string]: string }) {
    // Compute today's date in "M-D-YYYY" format without leading zeros
    const today = new Date();
    const dateString = `${
      today.getMonth() + 1
    }-${today.getDate()}-${today.getFullYear()}`;

    let totalForToday = 0;

    // Iterate over each entry in the 'reserve' field
    Object.entries(reserve).forEach(([key, value]) => {
      // Extract the date part of the key (assuming format is M-D-YYYY-HH-MM-SS)
      const keyDate = key.split('-').slice(0, 3).join('-');
      // Check if the date part matches today's date
      if (keyDate === dateString) {
        // Sum the values for today's date
        totalForToday += parseInt(value, 10);
      }
    });

    return totalForToday;
  }

  findTotalGiventMonth(
    dailyReimbursement: { [key: string]: string },
    givnMonth: number,
    givenYear: number
  ) {
    let total = 0;
    for (const [date, amount] of Object.entries(dailyReimbursement)) {
      const [month, day, year] = date.split('-').map(Number);
      if (month === givnMonth && year === givenYear) {
        total += parseInt(amount as string, 10);
      }
    }
    return total.toString();
  }
  findTotalGivenMonthForAllUsers(
    users: User[],
    field: UserDailyField,
    givenMonth: number,
    givenYear: number
  ): string {
    let total = 0;

    users.forEach((user) => {
      const dailyData = user[field];
      if (dailyData) {
        for (const [date, amount] of Object.entries(dailyData)) {
          const [month, , year] = date.split('-').map(Number); // Destructuring to ignore day
          if (month === givenMonth && year === givenYear) {
            total += parseInt(amount, 10);
          }
        }
      }
    });

    return total.toString();
  }

  findTotalGivenMonthForAllUsersSortedDescending(
    users: User[],
    field: UserDailyField,
    givenMonth: number,
    givenYear: number
  ): {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] {
    const results: {
      firstName: string;
      totalReserve: number;
      totalReserveInDollars: string;
    }[] = [];

    users.forEach((user) => {
      let userTotal = 0;
      const dailyData = user[field];
      if (dailyData) {
        for (const [date, amount] of Object.entries(dailyData)) {
          const [month, , year] = date.split('-').map(Number); // Extract month and year
          if (month === givenMonth && year === givenYear) {
            userTotal += parseInt(amount, 10); // Summing up the amounts for the given month and year
          }
        }
      }
      if (userTotal > 0) {
        let userTotalInDollars = this.convertCongoleseFrancToUsDollars(
          userTotal.toString()
        );
        userTotalInDollars = userTotalInDollars.toString();
        results.push({
          firstName: user.firstName!,
          totalReserve: userTotal,
          totalReserveInDollars: userTotalInDollars,
        });
      }
    });

    // Sort by reserve amount in dollars in descending order
    results.sort(
      (a, b) =>
        parseInt(b.totalReserveInDollars) - parseInt(a.totalReserveInDollars)
    );
    return results;
  }

  findTotalForMonthAllDailyPointsEmployees(
    employees: Employee[],
    month: string,
    year: string
  ) {
    const targetMonth = parseInt(month, 10);
    const targetYear = parseInt(year, 10);

    let total = 0;
    for (let e of employees) {
      if (e.dailyPoints) {
        for (const [date, amount] of Object.entries(e.dailyPoints)) {
          const [month, day, year] = date.split('-').map(Number);
          if (month === targetMonth && year === targetYear) {
            total += parseInt(amount, 10);
          }
        }
      }
    }

    return total.toString();
  }

  findTotalForMonthAllTotalDailyPointsEmployees(
    employees: Employee[],
    month: string,
    year: string
  ) {
    const targetMonth = parseInt(month, 10);
    const targetYear = parseInt(year, 10);

    let total = 0;
    for (let e of employees) {
      if (e.dailyPoints) {
        for (const [date, amount] of Object.entries(e.totalDailyPoints!)) {
          const [month, day, year] = date.split('-').map(Number);
          if (month === targetMonth && year === targetYear) {
            total += parseInt(amount, 10);
          }
        }
      }
    }

    return total.toString();
  }
  getMonthNameFrench(monthNumber: number) {
    const monthNamesInFrench = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];

    // Check if the month number is valid (1-12)
    if (monthNumber < 1 || monthNumber > 12) {
      return 'Invalid month number';
    }

    // Subtract 1 to convert to 0-indexed array
    return monthNamesInFrench[monthNumber - 1];
  }
  async fetchImageAsBase64(url: string) {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  async generateInvoice(employee: Employee, text = 'Paiement') {
    let invoiceNum = employee.payments
      ? (Object.keys(employee.payments!).length + 1).toString()
      : '1';

    let dateFrench = this.time.getTodaysDateInFrench();
    const imageUrl = '../../../assets/img/gervais.png';
    try {
      const base64Image = await this.fetchImageAsBase64(imageUrl);
      let dd: any = {
        content: [
          { text: 'Fondation Gervais.', style: 'header' },
          {
            image: base64Image,

            width: 75,
            style: 'logo',
          },
          { text: `${text}`, style: 'invoiceTitle' },
          {
            columns: [
              {
                text: [
                  { text: 'Fondation Gervais\n', style: 'companyTitle' },
                  '9 Avenue Nations-Unis, Maman Mobutu \n',
                  'Mon-Ngafula\n',
                  'RDC, Kinshasa\n',
                ],
              },
              {
                text: [
                  { text: 'Facture #', bold: true },
                  `${invoiceNum}\n`,

                  { text: 'Date: ', bold: true },
                  `${dateFrench}`,

                  // { text: 'Payment Terms: ', bold: true }, 'Net 45\n',
                  // { text: 'Due Date: ', bold: true }, 'Jan 15, 2024\n'
                ],
                alignment: 'right',
              },
            ],
          },
          {
            style: 'section',
            columns: [
              {
                width: 'auto',
                text: [
                  { text: 'Payé à:\n', bold: true },
                  `${employee.firstName} ${employee.middleName} ${employee.lastName}\n`,
                  // 'Ketsia Kiabani Bamu\n',
                ],
              },
              {
                width: '*',
                text: [
                  { text: 'Remuneration:\n', bold: true, fontSize: 14 },
                  // 'FC 1,725.00\n'
                ],
                alignment: 'right',
              },
            ],
          },
          {
            style: 'itemsTable',
            table: {
              widths: ['*', 'auto', 'auto', 'auto'],
              body: [
                [
                  { text: 'Nom', style: 'tableHeader' },
                  { text: 'Signature', style: 'tableHeader' },
                  { text: '', style: 'tableHeader' },
                  { text: '', style: 'tableHeader' },
                ],
                ['', '', '', ''],
              ],
            },
            layout: 'lightHorizontalLines',
          },
        ],
        styles: {
          header: {
            fontSize: 10,
            bold: true,
            margin: [0, 0, 0, 10],
          },
          logo: {
            margin: [0, 0, 0, 0],
          },
          invoiceTitle: {
            fontSize: 22,
            bold: true,
            alignment: 'right',
            margin: [0, 0, 0, 10],
          },
          companyTitle: {
            fontSize: 14,
            bold: true,
          },
          section: {
            margin: [0, 5, 0, 15],
          },
          itemsTable: {
            margin: [0, 5, 0, 15],
          },
          tableHeader: {
            bold: true,
            fontSize: 13,
            color: 'black',
          },
          totals: {
            bold: true,
            margin: [0, 30, 0, 0],
          },
        },
        defaultStyle: {
          columnGap: 20,
        },
      };
      let browser = this.getBrowserName();
      if (browser === 'Safari') {
        pdfMake.createPdf(dd).download();
      } else {
        pdfMake.createPdf(dd).open();
      }
    } catch (error) {
      console.log('Error generating invoice', error);
    }
  }
  getBrowserName() {
    const userAgent = navigator.userAgent;

    if (userAgent.match(/chrome|chromium|crios/i)) {
      return 'Chrome';
    } else if (userAgent.match(/firefox|fxios/i)) {
      return 'Firefox';
    } else if (userAgent.match(/safari/i)) {
      return 'Safari';
    } else if (userAgent.match(/opr\//i)) {
      return 'Opera';
    } else if (userAgent.match(/edg/i)) {
      return 'Edge';
    } else if (userAgent.match(/msie|trident/i)) {
      return 'Internet Explorer';
    } else {
      return 'Unknown';
    }
  }

  findTotalAllUsersGivenField(users: User[], field: keyof User) {
    let total = 0;
    users.forEach((user) => {
      total += Number(user[field]);
    });

    return total;
  }

  findTodayTotalResultsGivenField(
    users: User[],
    field: UserDailyField
  ): string {
    let total = 0;
    const today = this.time.todaysDateMonthDayYear(); // Get today's date in the correct format

    users.forEach((user) => {
      const dailyData = user[field];
      if (dailyData) {
        Object.entries(dailyData).forEach(([date, amount]) => {
          // Normalize the date to ignore the time component if present
          const normalizedDate = date.split('-').slice(0, 3).join('-');
          if (normalizedDate === today) {
            // Check if the amount contains a colon indicating additional text
            const numericAmount = amount.split(':')[0]; // Assumes the amount is before the colon if it exists
            total += parseInt(numericAmount, 10);
          }
        });
      }
    });

    return total.toString();
  }

  findTodayTotalResultsGivenFieldSortedDescending(
    users: User[],
    field: UserDailyField
  ): {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] {
    const today = this.time.todaysDateMonthDayYear(); // Get today's date in the correct format
    const results: {
      firstName: string;
      totalReserve: number;
      totalReserveInDollars: string;
    }[] = [];

    users.forEach((user) => {
      const dailyData = user[field];
      let totalReserve = 0;
      if (dailyData) {
        Object.entries(dailyData).forEach(([date, amount]) => {
          const normalizedDate = date.split('-').slice(0, 3).join('-'); // Normalize the date
          if (normalizedDate === today) {
            totalReserve += parseInt(amount.split(':')[0], 10); // Sum up today's reserves
          }
        });
      }
      if (totalReserve > 0) {
        let totalReserveInDollars = this.convertCongoleseFrancToUsDollars(
          totalReserve.toString()
        );
        (totalReserveInDollars = totalReserveInDollars.toString()),
          results.push({
            firstName: user.firstName!,
            totalReserve,
            totalReserveInDollars,
          }); // Add to results if there's any reserve today
      }
    });

    // Sort by reserve amount in descending order
    results.sort(
      (a, b) =>
        parseInt(b.totalReserveInDollars) - parseInt(a.totalReserveInDollars)
    );
    return results;
  }

  filterOutElements(summary: string[], index: number) {
    // fliter out elements

    summary = summary.filter((element, num) => {
      return num < index;
    });

    return summary;
  }
}
