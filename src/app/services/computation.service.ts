import { Injectable } from '@angular/core';
import { Client } from '../models/client';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { TimeService } from './time.service';
import { Employee } from '../models/employee';
(pdfMake as any).vfs = pdfFonts.pdfMake.vfs;
@Injectable({
  providedIn: 'root',
})
export class ComputationService {
  constructor(private time: TimeService) {}
  colorPositive: string = '#008080';
  colorNegative: string = '#ff0000';

  convertCongoleseFrancToUsDollars(value: string) {
    let input = Number(value);
    if (isNaN(input)) return '';

    let dollars = Math.ceil(input * 0.00037);

    return dollars;
  }
  convertUsDollarsToCongoleseFranc(value: string) {
    let input = Number(value);
    if (isNaN(input)) return '';

    let dollars = Math.floor(input * 2700);

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
  findTotalCurrentMonth(dailyReimbursement: { [key: string]: string }) {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
    const currentYear = currentDate.getFullYear();
    let total = 0;
    for (const [date, amount] of Object.entries(dailyReimbursement)) {
      const [month, day, year] = date.split('-').map(Number);
      if (month === currentMonth && year === currentYear) {
        total += parseInt(amount as string, 10);
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
  async generateInvoice(employee: Employee) {
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
          { text: 'Paiement', style: 'invoiceTitle' },
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
}
