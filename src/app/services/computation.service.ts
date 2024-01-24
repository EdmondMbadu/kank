import { Injectable } from '@angular/core';
import { Client } from '../models/client';

@Injectable({
  providedIn: 'root',
})
export class ComputationService {
  constructor() {}
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
}
