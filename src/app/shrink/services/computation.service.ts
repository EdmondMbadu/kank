import { booleanAttribute, Injectable } from '@angular/core';
import { Client } from '../../models/client';
// import * as pdfMake from 'pdfmake/build/pdfmake';
// import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { TimeService } from '../../services/time.service';
import { Employee } from '../../models/employee';
import { User, UserDailyField } from '../../models/user';
import { AuthService } from '../../services/auth.service';
import { AngularFireStorage } from '@angular/fire/compat/storage';
// (pdfMake as any).vfs = pdfFonts.pdfMake.vfs;
@Injectable({
  providedIn: 'root',
})
export class ComputationService {
  constructor(private time: TimeService, private storage: AngularFireStorage) {}
  colorPositive: string = '#008080';
  colorNegative: string = '#ff0000';
  rateFranc: number = 0.00034;
  rateDollar: number = 2900;
  week: number = 6;
  month: number = 26;
  private R = 6371e3; // Earth's radius in meters
  today = this.time.todaysDateMonthDayYear();
  convertCongoleseFrancToUsDollars(value: string) {
    let input = Number(value);
    if (isNaN(input)) return '';

    let dollars = Math.ceil(input * this.rateFranc);

    return dollars;
  }
  convertUsDollarsToCongoleseFranc(value: string) {
    let input = Number(value);
    if (isNaN(input)) return '';

    let dollars = Math.floor(input * this.rateDollar);

    return dollars;
  }
  salaries: any[] = [
    [
      { people: '60' },
      { role: 'Manager', base: '80$', a: '15$', b: '25$', c: '45$', d: '55$' },
      {
        role: 'Agent Marketing',
        base: '70$',
        a: '10$',
        b: '20$',
        c: '40$',
        d: '50$',
      },
    ],
    [
      { people: '100' },
      {
        role: 'Manager',
        base: '100$',
        a: '60$',
        b: '80$',
        c: '100$',
        d: '110$',
      },
      {
        role: 'Agent Marketing',
        base: '90$',
        a: '50$',
        b: '70$',
        c: '90$',
        d: '100$',
      },
    ],
    [
      { people: '160' },
      {
        role: 'Manager',
        base: '120$',
        a: '110$',
        b: '130$',
        c: '150$',
        d: '160$',
      },
      {
        role: 'Agent Marketing',
        base: '110$',
        a: '100$',
        b: '120$',
        c: '140$',
        d: '150$',
      },
    ],
    [
      { people: '200' },
      {
        role: 'Manager',
        base: '140$',
        a: '160$',
        b: '180$',
        c: '200$',
        d: '220$',
      },
      {
        role: 'Agent Marketing',
        base: '130$',
        a: '150$',
        b: '170$',
        c: '190$',
        d: '210$',
      },
    ],
  ];
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

  getGradientColor(value: number) {
    if (value < 50) {
      return 'rgb(255, 0, 0)'; // F: Red for values below 50
    } else if (value < 60) {
      return 'rgb(255, 87, 34)'; // E: Red-Orange for 50-60
    } else if (value < 70) {
      return 'rgb(255, 152, 0)'; // D: Orange for 60-70
    } else if (value < 80) {
      return 'rgb(255, 193, 7)'; // C: Yellow for 70-80
    } else if (value < 90) {
      return 'rgb(139, 195, 74)'; // B: Light Green for 80-90
    } else {
      return 'rgb(40, 167, 69)'; // A: Green for 90-100
    }
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
    if (allclients === null) return;
    const clientsWithDebt = allclients.filter(
      (client: any) => client.debtLeft > 0
    );

    // Filter employees who have clients with debt left
    const filteredClients = employee.clients?.filter((uid: string) => {
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
  findTotalForToday(reserve: { [key: string]: string }, dateString: string) {
    // Compute today's date in "M-D-YYYY" format without leading zeros

    if (!reserve || !dateString) {
      return 0; // Return 0 or handle the error as needed
    }

    const today = new Date();
    // const dateString = `${
    //   today.getMonth() + 1
    // }-${today.getDate()}-${today.getFullYear()}`;

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
    // if (dailyReimbursement === null || dailyReimbursement === undefined) return;
    if (!dailyReimbursement) return '0'; // Return "0" or any other appropriate value if input is null/undefined.
    let total = 0;
    for (const [date, amount] of Object.entries(dailyReimbursement)) {
      const [month, day, year] = date.split('-').map(Number);
      if (month === givnMonth && year === givenYear) {
        total += parseInt(amount as string, 10);
      }
    }
    return total.toString();
  }
  convertToDollarsArray(array: any) {
    let result: number[] = [];
    for (let a of array) {
      result.push(Math.floor(Number(a) * this.rateFranc));
    }

    return result;
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
                  {
                    text: `$ ${employee.totalPayments}`,
                    fontSize: 15,
                    italics: true,
                    bold: true,
                  },
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
                  { text: '', style: 'tableHeader' },
                  { text: 'Signature', style: 'tableHeader' },
                  { text: '', style: 'tableHeader' },
                  { text: '', style: 'tableHeader' },
                ],
                [
                  '',
                  {
                    text: `${employee.firstName} ${employee.middleName} ${employee.lastName}`,
                    style: 'signatureStyle',
                  },
                  '',
                  '',
                ],
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
          signatureStyle: {
            italics: true,
            fontSize: 14,
            bold: true,
            color: 'black',
            // Use a monospaced font for a signature-like appearance
          },
        },
        defaultStyle: {
          columnGap: 20,
        },
      };
      // Dynamic imports with type assertions
      const pdfMakeModule = (await import('pdfmake/build/pdfmake')) as any;
      const pdfFontsModule = (await import('pdfmake/build/vfs_fonts')) as any;

      const pdfMake = pdfMakeModule?.default || pdfMakeModule;
      const pdfFonts = pdfFontsModule?.default || pdfFontsModule;

      // Set the virtual file system
      pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

      // Verify that 'Roboto-Medium.ttf' exists
      if (!pdfMake.vfs['Roboto-Medium.ttf']) {
        console.error('Roboto-Medium.ttf not found in pdfMake.vfs');
      }

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

  async generateBonusCheck(employee: Employee, text = 'Paiement') {
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
                  {
                    text: `$ ${employee.totalPayments}`,
                    fontSize: 15,
                    italics: true,
                    bold: true,
                  },
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
                  { text: '', style: 'tableHeader' },
                  { text: 'Signature', style: 'tableHeader' },
                  { text: '', style: 'tableHeader' },
                  { text: '', style: 'tableHeader' },
                ],
                [
                  '',
                  {
                    text: `${employee.firstName} ${employee.middleName} ${employee.lastName}`,
                    style: 'signatureStyle',
                  },
                  '',
                  '',
                ],
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
          signatureStyle: {
            italics: true,
            fontSize: 14,
            bold: true,
            color: 'black',
            // Use a monospaced font for a signature-like appearance
          },
        },
        defaultStyle: {
          columnGap: 20,
        },
      };
      // Dynamic imports with type assertions
      const pdfMakeModule = (await import('pdfmake/build/pdfmake')) as any;
      const pdfFontsModule = (await import('pdfmake/build/vfs_fonts')) as any;

      const pdfMake = pdfMakeModule?.default || pdfMakeModule;
      const pdfFonts = pdfFontsModule?.default || pdfFontsModule;

      // Set the virtual file system
      pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

      // Verify that 'Roboto-Medium.ttf' exists
      if (!pdfMake.vfs['Roboto-Medium.ttf']) {
        console.error('Roboto-Medium.ttf not found in pdfMake.vfs');
      }
      const pdfDocGenerator = pdfMake.createPdf(dd);

      // Generate PDF as a Blob
      return new Promise<Blob>((resolve, reject) => {
        pdfDocGenerator.getBlob(
          (blob: Blob) => {
            resolve(blob);
          },
          (error: any) => {
            console.error('Error generating PDF Blob:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Error generating bonus check:', error);
      // Throw the error to ensure the function returns a rejected Promise
      throw error;
    }
  }
  async generatePaymentCheck(
    employee: Employee,
    text = 'Paiement',
    paymentAmount: string
  ) {
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
                  {
                    text: `$ ${paymentAmount}`,
                    fontSize: 15,
                    italics: true,
                    bold: true,
                  },
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
                  { text: '', style: 'tableHeader' },
                  { text: 'Signature', style: 'tableHeader' },
                  { text: '', style: 'tableHeader' },
                  { text: '', style: 'tableHeader' },
                ],
                [
                  '',
                  {
                    text: `${employee.firstName} ${employee.middleName} ${employee.lastName}`,
                    style: 'signatureStyle',
                  },
                  '',
                  '',
                ],
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
          signatureStyle: {
            italics: true,
            fontSize: 14,
            bold: true,
            color: 'black',
            // Use a monospaced font for a signature-like appearance
          },
        },
        defaultStyle: {
          columnGap: 20,
        },
      };
      // Dynamic imports with type assertions
      const pdfMakeModule = (await import('pdfmake/build/pdfmake')) as any;
      const pdfFontsModule = (await import('pdfmake/build/vfs_fonts')) as any;

      const pdfMake = pdfMakeModule?.default || pdfMakeModule;
      const pdfFonts = pdfFontsModule?.default || pdfFontsModule;

      // Set the virtual file system
      pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

      // Verify that 'Roboto-Medium.ttf' exists
      if (!pdfMake.vfs['Roboto-Medium.ttf']) {
        console.error('Roboto-Medium.ttf not found in pdfMake.vfs');
      }
      const pdfDocGenerator = pdfMake.createPdf(dd);

      // Generate PDF as a Blob
      return new Promise<Blob>((resolve, reject) => {
        pdfDocGenerator.getBlob(
          (blob: Blob) => {
            resolve(blob);
          },
          (error: any) => {
            console.error('Error generating PDF Blob:', error);
            reject(error);
          }
        );
      });
    } catch (error) {
      console.error('Error generating bonus check:', error);
      // Throw the error to ensure the function returns a rejected Promise
      throw error;
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
    field: UserDailyField,
    requestDate: string
  ): string {
    let total = 0;
    // const today = this.time.todaysDateMonthDayYear(); // Get today's date in the correct format

    users.forEach((user) => {
      const dailyData = user[field];
      if (dailyData) {
        Object.entries(dailyData).forEach(([date, amount]) => {
          // Normalize the date to ignore the time component if present
          const normalizedDate = date.split('-').slice(0, 3).join('-');
          if (normalizedDate === requestDate) {
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
    requestDate: string,
    users: User[],

    field: UserDailyField
  ): {
    firstName: string;
    totalReserve: number;
    totalReserveInDollars: string;
  }[] {
    // const today = this.time.todaysDateMonthDayYear(); // Get today's date in the correct format
    const results: {
      firstName: string;
      totalReserve: number;
      tReserve: string;
      totalReserveInDollars: string;
    }[] = [];

    users.forEach((user) => {
      const dailyData = user[field];
      let totalReserve = 0;
      if (dailyData) {
        Object.entries(dailyData).forEach(([date, amount]) => {
          const normalizedDate = date.split('-').slice(0, 3).join('-'); // Normalize the date
          if (normalizedDate === requestDate) {
            totalReserve += parseInt(amount.split(':')[0], 10); // Sum up today's reserves
          }
        });
      }
      if (totalReserve > 0) {
        let totalReserveInDollars = this.convertCongoleseFrancToUsDollars(
          totalReserve.toString()
        );
        let tReserve = totalReserve.toString();
        totalReserveInDollars = totalReserveInDollars.toString();
        results.push({
          firstName: user.firstName!,
          tReserve,
          totalReserve,
          totalReserveInDollars,
        }); // Add to results if there's any reserve today
      }
    });

    // Sort by reserve amount in descending order
    results.sort((a, b) => parseInt(b.tReserve) - parseInt(a.tReserve));
    return results;
  }

  filterOutElements(summary: string[], index: number) {
    // fliter out elements

    summary = summary.filter((element, num) => {
      return num < index;
    });

    return summary;
  }
  getBonus(
    people: number,
    percentage: number,
    role: 'Manager' | 'Agent Marketing' | string
  ): number {
    // Define the salary array
    const salaries: any[] = [
      [
        { people: '60' },
        {
          role: 'Manager',
          base: '80$',
          bonus70_79: '15$',
          bonus80_89: '25$',
          bonus90_99: '45$',
          bonus100: '55$',
        },
        {
          role: 'Agent Marketing',
          base: '70$',
          bonus70_79: '10$',
          bonus80_89: '20$',
          bonus90_99: '40$',
          bonus100: '50$',
        },
      ],
      [
        { people: '100' },
        {
          role: 'Manager',
          base: '100$',
          bonus70_79: '60$',
          bonus80_89: '80$',
          bonus90_99: '100$',
          bonus100: '110$',
        },
        {
          role: 'Agent Marketing',
          base: '90$',
          bonus70_79: '50$',
          bonus80_89: '70$',
          bonus90_99: '90$',
          bonus100: '100$',
        },
      ],
      [
        { people: '160' },
        {
          role: 'Manager',
          base: '120$',
          bonus70_79: '110$',
          bonus80_89: '130$',
          bonus90_99: '150$',
          bonus100: '160$',
        },
        {
          role: 'Agent Marketing',
          base: '110$',
          bonus70_79: '100$',
          bonus80_89: '120$',
          bonus90_99: '140$',
          bonus100: '150$',
        },
      ],
      [
        { people: '200' },
        {
          role: 'Manager',
          base: '140$',
          bonus70_79: '160$',
          bonus80_89: '180$',
          bonus90_99: '200$',
          bonus100: '220$',
        },
        {
          role: 'Agent Marketing',
          base: '130$',
          bonus70_79: '150$',
          bonus80_89: '170$',
          bonus90_99: '190$',
          bonus100: '210$',
        },
      ],
    ];

    // Step 1: If the number of people is below 60, return 0
    if (people < 60 || percentage < 70) {
      return 0;
    }

    // Step 2: Find the appropriate salary bracket based on the number of people
    let selectedBracket;
    if (people >= 200) {
      selectedBracket = salaries[3];
    } else if (people >= 160) {
      selectedBracket = salaries[2];
    } else if (people >= 100) {
      selectedBracket = salaries[1];
    } else if (people >= 60) {
      selectedBracket = salaries[0];
    }

    // Step 3: Find the role (Manager or Agent Marketing) within the selected bracket
    const roleData = selectedBracket.find((item: any) => item.role === role);

    // Step 4: Determine the bonus based on the percentage
    let bonus = 0;
    if (percentage >= 100) {
      bonus = parseInt(roleData.bonus100.replace('$', ''), 10);
    } else if (percentage >= 90) {
      bonus = parseInt(roleData.bonus90_99.replace('$', ''), 10);
    } else if (percentage >= 80) {
      bonus = parseInt(roleData.bonus80_89.replace('$', ''), 10);
    } else if (percentage >= 70) {
      bonus = parseInt(roleData.bonus70_79.replace('$', ''), 10);
    }

    return bonus;
  }
  // Method to get current location with high accuracy
  getLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, // Use high accuracy
          timeout: 10000, // Set a timeout in case of poor GPS signal
          maximumAge: 0, // Prevent cached locations
        });
      } else {
        reject(new Error('Geolocation is not supported by this browser.'));
      }
    });
  }

  // Calculate distance between two coordinates using the Haversine formula
  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return this.R * c; // Distance in meters
  }

  // Check if the location is within the specified radius
  checkWithinRadius(
    userLat: number,
    userLng: number,
    targetLat: number,
    targetLng: number,
    radius: number
  ): boolean {
    const distance = this.calculateDistance(
      userLat,
      userLng,
      targetLat,
      targetLng
    );
    console.log('distance ', distance);
    return distance <= radius;
  }
}
