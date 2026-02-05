import { booleanAttribute, Injectable } from '@angular/core';
import { Client } from '../../models/client';
// import * as pdfMake from 'pdfmake/build/pdfmake';
// import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { TimeService } from '../../services/time.service';
import { Employee } from '../../models/employee';
import { User, UserDailyField } from '../../models/user';
import { AuthService } from '../../services/auth.service';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Observable, map, catchError, of } from 'rxjs';
import { AngularFirestore } from '@angular/fire/compat/firestore';
// (pdfMake as any).vfs = pdfFonts.pdfMake.vfs;
@Injectable({
  providedIn: 'root',
})
export class ComputationService {
  constructor(
    private time: TimeService,
    private storage: AngularFireStorage,
    private afs: AngularFirestore
  ) {
    this.initRatesFromFirestore();
  }
  colorPositive: string = '#008080';
  colorNegative: string = '#ff0000';
  rateFranc: number = 0.00034;
  rateDollar: number = 2900;
  week: number = 6;
  month: number = 26;
  year: number = 320;
  quarter1: number = 3;
  quarter2: number = 6;
  quarter3: number = 9;
  quarter4: number = 12;
  private R = 6371e3; // Earth's radius in meters
  today = this.time.todaysDateMonthDayYear();
  private pdfMakePromise?: Promise<any>;
  private assetBase64Cache = new Map<string, string>();

  // ADD this pair of methods inside DataService
  /** Live stream of rates from Firestore (safe: never throws). */
  watchManagementRates$(): Observable<{
    rateDollar?: number;
    rateFranc?: number;
  }> {
    // ⚠️ Replace 'singleton' with your real management doc id if different.
    const docRef = this.afs.collection('management').doc('singleton');
    return docRef.valueChanges().pipe(
      map((doc: any) => {
        const toNum = (v: any) => {
          if (v === null || v === undefined) return undefined;
          const n = Number(String(v).replace(/,/g, ''));
          return Number.isFinite(n) ? n : undefined;
        };
        return {
          rateDollar: toNum(doc?.rateDollar),
          rateFranc: toNum(doc?.rateFranc),
        };
      }),
      catchError(() => of({}))
    );
  }

  /** Persist new rates (numbers) to Firestore. */
  updateManagementRates(rateDollar: number, rateFranc: number) {
    const docRef = this.afs.collection('management').doc('singleton');
    return docRef.set({ rateDollar, rateFranc }, { merge: true });
  }

  // ADD these two helpers inside the class
  /** Overwrite runtime rates safely (used by admin UI and stream). */
  setRates(partial: { rateDollar?: number; rateFranc?: number }) {
    if (
      typeof partial.rateDollar === 'number' &&
      Number.isFinite(partial.rateDollar) &&
      partial.rateDollar > 0
    ) {
      this.rateDollar = partial.rateDollar;
    }
    if (
      typeof partial.rateFranc === 'number' &&
      Number.isFinite(partial.rateFranc) &&
      partial.rateFranc > 0
    ) {
      this.rateFranc = partial.rateFranc;
    }
  }

  /** Background init: load & react to Firestore updates, but keep defaults if missing/invalid. */
  private initRatesFromFirestore() {
    try {
      // this.ratesSub =  // (uncomment if you plan to unsubscribe on destroy)
      this.watchManagementRates$().subscribe((r) => {
        if (
          typeof r.rateDollar === 'number' &&
          Number.isFinite(r.rateDollar) &&
          r.rateDollar > 0
        ) {
          this.rateDollar = r.rateDollar;
        }
        if (
          typeof r.rateFranc === 'number' &&
          Number.isFinite(r.rateFranc) &&
          r.rateFranc > 0
        ) {
          this.rateFranc = r.rateFranc;
        }
      });
    } catch {
      // swallow and keep defaults
    }
  }

  private resolveAssetUrl(path: string): string {
    if (!path) {
      return path;
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    const normalized = path
      .replace(/\\/g, '/')
      .replace(/^\/?/, '')
      .replace(/^(\.\.\/)+/, '')
      .replace(/^assets\//, 'assets/');

    const baseUri =
      (typeof document !== 'undefined' && document.baseURI) ||
      (typeof window !== 'undefined' && window.location?.href) ||
      '/';

    try {
      return new URL(normalized, baseUri).toString();
    } catch {
      return normalized.startsWith('/') ? normalized : `/${normalized}`;
    }
  }

  private async ensurePdfMake(): Promise<any> {
    if (!this.pdfMakePromise) {
      this.pdfMakePromise = (async () => {
        const pdfMakeModule = (await import('pdfmake/build/pdfmake')) as any;
        const pdfFontsModule = (await import('pdfmake/build/vfs_fonts')) as any;

        const pdfMake = pdfMakeModule?.default || pdfMakeModule;
        const pdfFonts = pdfFontsModule?.default || pdfFontsModule;

        pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

        if (!pdfMake.vfs['Roboto-Medium.ttf']) {
          console.warn('Roboto-Medium.ttf not found in pdfMake.vfs');
        }

        return pdfMake;
      })().catch((error) => {
        this.pdfMakePromise = undefined;
        throw error;
      });
    }

    return this.pdfMakePromise;
  }

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
      { people: '50' },
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
    // [
    //   { people: '100' },
    //   {
    //     role: 'Manager',
    //     base: '100$',
    //     a: '60$',
    //     b: '80$',
    //     c: '100$',
    //     d: '110$',
    //   },
    //   {
    //     role: 'Agent Marketing',
    //     base: '90$',
    //     a: '50$',
    //     b: '70$',
    //     c: '90$',
    //     d: '100$',
    //   },
    // ],
    // [
    //   { people: '160' },
    //   {
    //     role: 'Manager',
    //     base: '120$',
    //     a: '110$',
    //     b: '130$',
    //     c: '150$',
    //     d: '160$',
    //   },
    //   {
    //     role: 'Agent Marketing',
    //     base: '110$',
    //     a: '100$',
    //     b: '120$',
    //     c: '140$',
    //     d: '150$',
    //   },
    // ],
    // [
    //   { people: '200' },
    //   {
    //     role: 'Manager',
    //     base: '140$',
    //     a: '160$',
    //     b: '180$',
    //     c: '200$',
    //     d: '220$',
    //   },
    //   {
    //     role: 'Agent Marketing',
    //     base: '130$',
    //     a: '150$',
    //     b: '170$',
    //     c: '190$',
    //     d: '210$',
    //   },
    // ],
  ];
  minimumPayment(client: Client) {
    const amountToPay = Number(client.amountToPay);
    const paymentPeriod = Number(client.paymentPeriodRange);
    const debtLeft = Number(client.debtLeft);
    const amountPaid = Number(client.amountPaid);

    let pay =
      Number.isFinite(amountToPay) &&
      Number.isFinite(paymentPeriod) &&
      paymentPeriod > 0
        ? amountToPay / paymentPeriod
        : 0;

    const remaining =
      Number.isFinite(amountToPay) && Number.isFinite(amountPaid)
        ? Math.max(amountToPay - amountPaid, 0)
        : 0;

    if (remaining > 0 && (pay <= 0 || remaining < pay)) {
      pay = remaining;
    }

    if (
      Number.isFinite(debtLeft) &&
      debtLeft > 0 &&
      (pay <= 0 || debtLeft < pay)
    ) {
      pay = debtLeft;
    }

    return Math.max(pay, 0).toString();
  }
  computeExpectedPerDate(clients: Client[]) {
    let total = 0;

    for (let client of clients) {
      if (Number(client.amountToPay) - Number(client.amountPaid) >= 0) {
        const amountToPay = Number(client.amountToPay);
        const paymentPeriod = Number(client.paymentPeriodRange);
        const amountPaid = Number(client.amountPaid);
        const debtLeft = Number(client.debtLeft);

        let pay =
          Number.isFinite(amountToPay) &&
          Number.isFinite(paymentPeriod) &&
          paymentPeriod > 0
            ? amountToPay / paymentPeriod
            : 0;

        const remaining =
          Number.isFinite(amountToPay) && Number.isFinite(amountPaid)
            ? Math.max(amountToPay - amountPaid, 0)
            : 0;

        if (remaining > 0 && (pay <= 0 || remaining < pay)) {
          pay = remaining;
        }

        if (
          Number.isFinite(debtLeft) &&
          debtLeft > 0 &&
          (pay <= 0 || debtLeft < pay)
        ) {
          pay = debtLeft;
        }

        total += Math.max(pay, 0);
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

  private timestampFromDateKey(dateKey: string): number {
    if (!dateKey) {
      return 0;
    }

    // dateKey format: M-D-YYYY-HH-mm-ss (month-day-year-hour-minute-second)
    const parts = dateKey.split('-');
    if (parts.length < 3) {
      return 0;
    }

    // Format: month-day-year-hour-minute-second
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const hour = parts.length > 3 ? parseInt(parts[3], 10) : 0;
    const minute = parts.length > 4 ? parseInt(parts[4], 10) : 0;
    const second = parts.length > 5 ? parseInt(parts[5], 10) : 0;

    const timestamp = new Date(
      year,
      month - 1, // month is 0-indexed in Date constructor
      day,
      hour,
      minute,
      second
    ).getTime();

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  sortArrayByDateDescendingOrder(array: [string, string][]) {
    // Sort the array by date in descending order
    array.sort(
      (a, b) =>
        this.timestampFromDateKey(b[0]) - this.timestampFromDateKey(a[0])
    );

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
  getGradientColorLite(value: number): { background: string; text: string } {
    if (value < 50) {
      return { background: 'rgb(255, 0, 0)', text: 'white' }; // F: Red for values below 50
    } else if (value < 60) {
      return { background: 'rgb(255, 87, 34)', text: 'white' }; // E: Red-Orange for 50-60
    } else if (value < 70) {
      return { background: 'rgb(255, 152, 0)', text: 'black' }; // D: Orange for 60-70
    } else if (value < 80) {
      return { background: 'rgb(255, 193, 7)', text: 'black' }; // C: Yellow for 70-80
    } else if (value < 90) {
      return { background: 'rgb(139, 195, 74)', text: 'black' }; // B: Light Green for 80-90
    } else {
      return { background: 'rgb(40, 167, 69)', text: 'white' }; // A: Green for 90-100
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
  // roundNumber(num: any) {
  //   let rounded: any = Math.round(num * 10) / 10;
  //   return rounded;
  // }
  roundNumber(num: any) {
    return Math.ceil(num);
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

  // findTotalForMonth(
  //   dailyReimbursement: { [key: string]: string },
  //   month: string,
  //   year: string
  // ) {
  //   const targetMonth = parseInt(month, 10);
  //   const targetYear = parseInt(year, 10);

  //   let total = 0;
  //   for (const [date, amount] of Object.entries(dailyReimbursement)) {
  //     const [month, day, year] = date.split('-').map(Number);
  //     if (month === targetMonth && year === targetYear) {
  //       total += parseInt(amount as string, 10);
  //     }
  //   }
  //   return total.toString();
  // }
  findTotalForMonth(
    dailyReimbursement: { [key: string]: string },
    month: string,
    year: string
  ) {
    const targetMonth = parseInt(month, 10);
    const targetYear = parseInt(year, 10);

    let total = 0;
    for (const [date, amount] of Object.entries(dailyReimbursement)) {
      const [entryMonth, day, entryYear] = date.split('-').map(Number);
      if (entryMonth === targetMonth && entryYear === targetYear) {
        total += parseFloat(amount); // Allows decimal values
      }
    }
    return total.toFixed(2); // Keeps two decimal places
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
        totalForToday += parseFloat(value);
      }
    });

    return totalForToday.toFixed(2);
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

  /**
   * Aggregate a user's daily field for a whole year across every month.
   * Keeps the string return type to align with existing monthly helpers.
   */
  findTotalGivenYearForAllUsers(
    users: User[],
    field: UserDailyField,
    givenYear: number
  ): string {
    let total = 0;

    users.forEach((user) => {
      const dailyData = user[field];
      if (!dailyData) {
        return;
      }

      for (const [date, amount] of Object.entries(dailyData)) {
        const [, , year] = date.split('-').map(Number); // Extract year only
        if (year === givenYear) {
          total += parseInt(String(amount), 10);
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

    // Sort by base currency (CDF) to avoid FX rounding affecting rankings
    results.sort((a, b) => b.totalReserve - a.totalReserve);
    return results;
  }

  /**
   * Aggregate totals across all available data (all time) and sort descending.
   */
  findTotalAllTimeForAllUsersSortedDescending(
    users: User[],
    field: UserDailyField
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
        for (const [, amount] of Object.entries(dailyData)) {
          userTotal += parseInt(String(amount), 10);
        }
      }
      if (userTotal > 0) {
        const userTotalInDollars = this.convertCongoleseFrancToUsDollars(
          userTotal.toString()
        ).toString();
        results.push({
          firstName: user.firstName!,
          totalReserve: userTotal,
          totalReserveInDollars: userTotalInDollars,
        });
      }
    });

    // Sort by base currency (CDF) to avoid FX rounding affecting rankings
    results.sort((a, b) => b.totalReserve - a.totalReserve);
    return results;
  }

  /**
   * Aggregate totals across all available data (all time).
   */
  findTotalAllTimeForAllUsers(
    users: User[],
    field: UserDailyField
  ): string {
    let total = 0;

    users.forEach((user) => {
      const dailyData = user[field];
      if (dailyData) {
        for (const [, amount] of Object.entries(dailyData)) {
          total += parseInt(String(amount), 10);
        }
      }
    });

    return total.toString();
  }

  /**
   * Aggregate totals for a whole year per user and sort descending.
   */
  findTotalGivenYearForAllUsersSortedDescending(
    users: User[],
    field: UserDailyField,
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
          const [, , year] = date.split('-').map(Number); // Extract year
          if (year === givenYear) {
            userTotal += parseInt(String(amount), 10);
          }
        }
      }
      if (userTotal > 0) {
        const userTotalInDollars = this.convertCongoleseFrancToUsDollars(
          userTotal.toString()
        ).toString();
        results.push({
          firstName: user.firstName!,
          totalReserve: userTotal,
          totalReserveInDollars: userTotalInDollars,
        });
      }
    });

    // Sort by base currency (CDF) to avoid FX rounding affecting rankings
    results.sort((a, b) => b.totalReserve - a.totalReserve);
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
            total += parseFloat(amount);
          }
        }
      }
    }

    return total.toFixed(2);
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
            total += parseFloat(amount); // Changed from parseInt to parseFloat to match histogram calculation
          }
        }
      }
    }

    return total.toFixed(2); // Changed from toString() to toFixed(2) for consistency with findTotalForMonthAllDailyPointsEmployees
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
  async fetchImageAsBase64(path: string): Promise<string> {
    const resolvedUrl = this.resolveAssetUrl(path);

    if (this.assetBase64Cache.has(resolvedUrl)) {
      return this.assetBase64Cache.get(resolvedUrl)!;
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(resolvedUrl, {
          cache: 'no-cache',
        });

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status} ${response.statusText}`.trim()
          );
        }

        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        this.assetBase64Cache.set(resolvedUrl, base64);
        return base64;
      } catch (err) {
        lastError = err;
        await new Promise((resolve) =>
          setTimeout(resolve, 150 * (attempt + 1))
        );
      }
    }

    const reason =
      lastError instanceof Error ? lastError.message : String(lastError || '');
    throw new Error(
      `Impossible de charger l'image (${resolvedUrl}). ${reason}`.trim()
    );
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
      const pdfMake = await this.ensurePdfMake();
      const browser = this.getBrowserName();
      const pdfDoc = pdfMake.createPdf(dd);

      if (browser === 'Safari') {
        pdfDoc.download();
      } else {
        pdfDoc.open();
      }
    } catch (error) {
      console.log('Error generating invoice', error);
    }
  }

  // async generateBonusCheck(employee: Employee, text = 'Paiement') {
  //   let invoiceNum = employee.payments
  //     ? (Object.keys(employee.payments!).length + 1).toString()
  //     : '1';

  //   let dateFrench = this.time.getTodaysDateInFrench();
  //   const imageUrl = '../../../assets/img/gervais.png';
  //   try {
  //     const base64Image = await this.fetchImageAsBase64(imageUrl);
  //     let dd: any = {
  //       content: [
  //         { text: 'Fondation Gervais.', style: 'header' },
  //         {
  //           image: base64Image,

  //           width: 75,
  //           style: 'logo',
  //         },
  //         { text: `${text}`, style: 'invoiceTitle' },
  //         {
  //           columns: [
  //             {
  //               text: [
  //                 { text: 'Fondation Gervais\n', style: 'companyTitle' },
  //                 '9 Avenue Nations-Unis, Maman Mobutu \n',
  //                 'Mon-Ngafula\n',
  //                 'RDC, Kinshasa\n',
  //               ],
  //             },
  //             {
  //               text: [
  //                 { text: 'Facture #', bold: true },
  //                 `${invoiceNum}\n`,

  //                 { text: 'Date: ', bold: true },
  //                 `${dateFrench}`,

  //                 // { text: 'Payment Terms: ', bold: true }, 'Net 45\n',
  //                 // { text: 'Due Date: ', bold: true }, 'Jan 15, 2024\n'
  //               ],
  //               alignment: 'right',
  //             },
  //           ],
  //         },
  //         {
  //           style: 'section',
  //           columns: [
  //             {
  //               width: 'auto',
  //               text: [
  //                 { text: 'Payé à:\n', bold: true },
  //                 `${employee.firstName} ${employee.middleName} ${employee.lastName}\n`,
  //                 // 'Ketsia Kiabani Bamu\n',
  //               ],
  //             },
  //             {
  //               width: '*',
  //               text: [
  //                 { text: 'Remuneration:\n', bold: true, fontSize: 14 },
  //                 {
  //                   text: `$ ${employee.totalPayments}`,
  //                   fontSize: 15,
  //                   italics: true,
  //                   bold: true,
  //                 },
  //               ],
  //               alignment: 'right',
  //             },
  //           ],
  //         },
  //         {
  //           style: 'itemsTable',
  //           table: {
  //             widths: ['*', 'auto', 'auto', 'auto'],
  //             body: [
  //               [
  //                 { text: '', style: 'tableHeader' },
  //                 { text: 'Signature', style: 'tableHeader' },
  //                 { text: '', style: 'tableHeader' },
  //                 { text: '', style: 'tableHeader' },
  //               ],
  //               [
  //                 '',
  //                 {
  //                   text: `${employee.firstName} ${employee.middleName} ${employee.lastName}`,
  //                   style: 'signatureStyle',
  //                 },
  //                 '',
  //                 '',
  //               ],
  //             ],
  //           },
  //           layout: 'lightHorizontalLines',
  //         },
  //       ],
  //       styles: {
  //         header: {
  //           fontSize: 10,
  //           bold: true,
  //           margin: [0, 0, 0, 10],
  //         },
  //         logo: {
  //           margin: [0, 0, 0, 0],
  //         },

  //         invoiceTitle: {
  //           fontSize: 22,
  //           bold: true,
  //           alignment: 'right',
  //           margin: [0, 0, 0, 10],
  //         },
  //         companyTitle: {
  //           fontSize: 14,
  //           bold: true,
  //         },
  //         section: {
  //           margin: [0, 5, 0, 15],
  //         },
  //         itemsTable: {
  //           margin: [0, 5, 0, 15],
  //         },
  //         tableHeader: {
  //           bold: true,
  //           fontSize: 13,
  //           color: 'black',
  //         },
  //         totals: {
  //           bold: true,
  //           margin: [0, 30, 0, 0],
  //         },
  //         signatureStyle: {
  //           italics: true,
  //           fontSize: 14,
  //           bold: true,
  //           color: 'black',
  //           // Use a monospaced font for a signature-like appearance
  //         },
  //       },
  //       defaultStyle: {
  //         columnGap: 20,
  //       },
  //     };
  //     // Dynamic imports with type assertions
  //     const pdfMakeModule = (await import('pdfmake/build/pdfmake')) as any;
  //     const pdfFontsModule = (await import('pdfmake/build/vfs_fonts')) as any;

  //     const pdfMake = pdfMakeModule?.default || pdfMakeModule;
  //     const pdfFonts = pdfFontsModule?.default || pdfFontsModule;

  //     // Set the virtual file system
  //     pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

  //     // Verify that 'Roboto-Medium.ttf' exists
  //     if (!pdfMake.vfs['Roboto-Medium.ttf']) {
  //       console.error('Roboto-Medium.ttf not found in pdfMake.vfs');
  //     }
  //     const pdfDocGenerator = pdfMake.createPdf(dd);

  //     // Generate PDF as a Blob
  //     return new Promise<Blob>((resolve, reject) => {
  //       pdfDocGenerator.getBlob(
  //         (blob: Blob) => {
  //           resolve(blob);
  //         },
  //         (error: any) => {
  //           console.error('Error generating PDF Blob:', error);
  //           reject(error);
  //         }
  //       );
  //     });
  //   } catch (error) {
  //     console.error('Error generating bonus check:', error);
  //     // Throw the error to ensure the function returns a rejected Promise
  //     throw error;
  //   }
  // }

  async generateBonusCheck(
    employee: Employee,
    title: string = 'Bonus' // shown in the big heading
  ): Promise<Blob> {
    /* ── helpers ─────────────────────────────────────────────────────── */
    const fmt = (v: number) => {
      try {
        return new Intl.NumberFormat('fr-FR', {
          minimumFractionDigits: 0,
        }).format(v);
      } catch {
        return v.toLocaleString(undefined, { minimumFractionDigits: 0 });
      }
    };

    const todayFr = this.time.getTodaysDateInFrench();
    const periodFr = `${
      this.time.monthFrenchNames[new Date().getMonth()]
    } ${new Date().getFullYear()}`;
    const invoice = employee.payments
      ? (Object.keys(employee.payments).length + 1).toString()
      : '1';

    /* ── bonus components ────────────────────────────────────────────── */
    const perf = +employee.bonusAmount! || 0;
    const team = +employee.bestTeamBonusAmount! || 0;
    const best = +employee.bestEmployeeBonusAmount! || 0;
    const mgr = +employee.bestManagerBonusAmount! || 0;
    const total = perf + team + best + mgr;

    const rows = [
      [
        { text: 'Composante', style: 'th' },
        { text: 'Montant ($)', style: 'th', alignment: 'right' },
      ],
      ['Bonus performance', { text: fmt(perf), alignment: 'right' }],
      ['Meilleure équipe', { text: fmt(team), alignment: 'right' }],
      ['Meilleur employé', { text: fmt(best), alignment: 'right' }],
      ['Meilleur manager', { text: fmt(mgr), alignment: 'right' }],
      [
        { text: 'Total bonus net', style: 'totalLabel' },
        { text: fmt(total), style: 'total', alignment: 'right' },
      ],
    ];

    /* ── attendance résumé (current month) ───────────────────────────── */
    const stats = { P: 0, A: 0, L: 0, N: 0 } as Record<string, number>;
    const ymKey = `${new Date().getMonth() + 1}-`;
    Object.keys(employee.attendance || {}).forEach((k) => {
      if (k.startsWith(ymKey)) {
        const v = (employee.attendance as any)[k];
        if (stats[v] !== undefined) stats[v] += 1;
      }
    });

    /* ── branding ────────────────────────────────────────────────────── */
    const logo = await this.fetchImageAsBase64(
      '../../../assets/img/gervais.png'
    );

    /* ── pdfmake doc-definition ──────────────────────────────────────── */
    const dd: any = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],

      content: [
        // ── header bar
        {
          columns: [
            [
              { text: 'FONDATION GERVAIS', style: 'brand' },
              {
                text: '9 Av. Nations-Unies\nMon-Ngafula, Kinshasa (RDC)',
                style: 'tiny',
              },
              { text: 'Téléphone : +243 825 333 567', style: 'tiny' },
            ],
            { image: logo, width: 75, alignment: 'right' },
          ],
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 435,
              y2: 0,
              lineWidth: 1.5,
              lineColor: '#263238',
            },
          ],
          margin: [0, 5, 0, 15],
        },

        // ── title + meta
        { text: `Fiche de ${title}`, style: 'docTitle' },
        {
          columns: [
            {
              text: [
                { text: 'Employé : ', bold: true },
                `${employee.firstName} ${employee.middleName ?? ''} ${
                  employee.lastName
                }\n`,
                { text: 'Rôle : ', bold: true },
                `${employee.role ?? ''}\n`,
                { text: 'Période : ', bold: true },
                periodFr,
              ],
            },
            {
              text: [
                { text: 'N° Fiche : ', bold: true },
                `${invoice}\n`,
                { text: 'Date : ', bold: true },
                todayFr,
              ],
              alignment: 'right',
            },
          ],
          margin: [0, 0, 0, 15],
        },

        // ── bonus breakdown table
        {
          style: 'table',
          table: { widths: ['*', 'auto'], body: rows },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#B0BEC5',
          },
          margin: [0, 0, 0, 20],
        },

        // ── attendance summary
        {
          text: 'Résumé de présence',
          style: 'subHeader',
          margin: [0, 0, 0, 6],
        },
        {
          ul: [
            `Présent : ${stats['P']} jours`,
            `Retard : ${stats['L']} jours`,
            `Absent : ${stats['A']} jours`,
            `Néant : ${stats['N']} jours`,
          ],
          margin: [0, 0, 0, 20],
        },

        // ── signature band
        {
          table: {
            widths: ['*', '*', '*'],
            body: [
              [
                { text: 'Signature employé', style: 'th', alignment: 'center' },
                { text: 'Manager', style: 'th', alignment: 'center' },
                { text: 'Service RH', style: 'th', alignment: 'center' },
              ],
              [
                // simulate a handwritten signature
                {
                  text: `${employee.firstName} ${employee.middleName ?? ''} ${
                    employee.lastName
                  }`,
                  style: 'signature',
                  alignment: 'center',
                },
                { text: ' ', margin: [0, 30] },
                { text: ' ' },
              ],
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ],

      styles: {
        brand: { fontSize: 14, bold: true, color: '#263238' },
        tiny: { fontSize: 8, color: '#546E7A' },
        docTitle: { fontSize: 18, bold: true, margin: [0, 0, 0, 15] },
        subHeader: { fontSize: 12, bold: true },
        table: { margin: [0, 0, 0, 10] },
        tableHeader: { bold: true, color: '#0F172A', margin: [0, 3, 0, 3] },
        monthCell: { bold: true, color: '#0F172A' },
        th: { bold: true, fillColor: '#ECEFF1', margin: [0, 3, 0, 3] },
        totalLabel: { bold: true, margin: [0, 3, 0, 3] },
        total: { bold: true, fontSize: 12, margin: [0, 3, 0, 3] },

        /* NEW: cursive-like signature */
        signature: { italics: true, fontSize: 14 },
      },

      defaultStyle: { fontSize: 10 },
    };

    /* ── generate & return Blob ────────────────────────────────────────── */
    const pdfMake = await this.ensurePdfMake();
    const pdfDoc = pdfMake.createPdf(dd as any);

    return new Promise<Blob>((resolve, reject) => {
      pdfDoc.getBlob(
        (blob: Blob) => resolve(blob),
        (err: any) => reject(err)
      );
    });
  }
  // async generatePaymentCheck(
  //   employee: Employee,
  //   text = 'Paiement',
  //   paymentAmount: string
  // ) {
  //   let invoiceNum = employee.payments
  //     ? (Object.keys(employee.payments!).length + 1).toString()
  //     : '1';

  //   let dateFrench = this.time.getTodaysDateInFrench();
  //   const imageUrl = '../../../assets/img/gervais.png';
  //   try {
  //     const base64Image = await this.fetchImageAsBase64(imageUrl);
  //     let dd: any = {
  //       content: [
  //         { text: 'Fondation Gervais.', style: 'header' },
  //         {
  //           image: base64Image,

  //           width: 75,
  //           style: 'logo',
  //         },
  //         { text: `${text}`, style: 'invoiceTitle' },
  //         {
  //           columns: [
  //             {
  //               text: [
  //                 { text: 'Fondation Gervais\n', style: 'companyTitle' },
  //                 '9 Avenue Nations-Unis, Maman Mobutu \n',
  //                 'Mon-Ngafula\n',
  //                 'RDC, Kinshasa\n',
  //               ],
  //             },
  //             {
  //               text: [
  //                 { text: 'Facture #', bold: true },
  //                 `${invoiceNum}\n`,

  //                 { text: 'Date: ', bold: true },
  //                 `${dateFrench}`,

  //                 // { text: 'Payment Terms: ', bold: true }, 'Net 45\n',
  //                 // { text: 'Due Date: ', bold: true }, 'Jan 15, 2024\n'
  //               ],
  //               alignment: 'right',
  //             },
  //           ],
  //         },
  //         {
  //           style: 'section',
  //           columns: [
  //             {
  //               width: 'auto',
  //               text: [
  //                 { text: 'Payé à:\n', bold: true },
  //                 `${employee.firstName} ${employee.middleName} ${employee.lastName}\n`,
  //                 // 'Ketsia Kiabani Bamu\n',
  //               ],
  //             },
  //             {
  //               width: '*',
  //               text: [
  //                 { text: 'Remuneration:\n', bold: true, fontSize: 14 },
  //                 {
  //                   text: `$ ${paymentAmount}`,
  //                   fontSize: 15,
  //                   italics: true,
  //                   bold: true,
  //                 },
  //               ],
  //               alignment: 'right',
  //             },
  //           ],
  //         },
  //         {
  //           style: 'itemsTable',
  //           table: {
  //             widths: ['*', 'auto', 'auto', 'auto'],
  //             body: [
  //               [
  //                 { text: '', style: 'tableHeader' },
  //                 { text: 'Signature', style: 'tableHeader' },
  //                 { text: '', style: 'tableHeader' },
  //                 { text: '', style: 'tableHeader' },
  //               ],
  //               [
  //                 '',
  //                 {
  //                   text: `${employee.firstName} ${employee.middleName} ${employee.lastName}`,
  //                   style: 'signatureStyle',
  //                 },
  //                 '',
  //                 '',
  //               ],
  //             ],
  //           },
  //           layout: 'lightHorizontalLines',
  //         },
  //       ],
  //       styles: {
  //         header: {
  //           fontSize: 10,
  //           bold: true,
  //           margin: [0, 0, 0, 10],
  //         },
  //         logo: {
  //           margin: [0, 0, 0, 0],
  //         },

  //         invoiceTitle: {
  //           fontSize: 22,
  //           bold: true,
  //           alignment: 'right',
  //           margin: [0, 0, 0, 10],
  //         },
  //         companyTitle: {
  //           fontSize: 14,
  //           bold: true,
  //         },
  //         section: {
  //           margin: [0, 5, 0, 15],
  //         },
  //         itemsTable: {
  //           margin: [0, 5, 0, 15],
  //         },
  //         tableHeader: {
  //           bold: true,
  //           fontSize: 13,
  //           color: 'black',
  //         },
  //         totals: {
  //           bold: true,
  //           margin: [0, 30, 0, 0],
  //         },
  //         signatureStyle: {
  //           italics: true,
  //           fontSize: 14,
  //           bold: true,
  //           color: 'black',
  //           // Use a monospaced font for a signature-like appearance
  //         },
  //       },
  //       defaultStyle: {
  //         columnGap: 20,
  //       },
  //     };
  //     // Dynamic imports with type assertions
  //     const pdfMakeModule = (await import('pdfmake/build/pdfmake')) as any;
  //     const pdfFontsModule = (await import('pdfmake/build/vfs_fonts')) as any;

  //     const pdfMake = pdfMakeModule?.default || pdfMakeModule;
  //     const pdfFonts = pdfFontsModule?.default || pdfFontsModule;

  //     // Set the virtual file system
  //     pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

  //     // Verify that 'Roboto-Medium.ttf' exists
  //     if (!pdfMake.vfs['Roboto-Medium.ttf']) {
  //       console.error('Roboto-Medium.ttf not found in pdfMake.vfs');
  //     }
  //     const pdfDocGenerator = pdfMake.createPdf(dd);

  //     // Generate PDF as a Blob
  //     return new Promise<Blob>((resolve, reject) => {
  //       pdfDocGenerator.getBlob(
  //         (blob: Blob) => {
  //           resolve(blob);
  //         },
  //         (error: any) => {
  //           console.error('Error generating PDF Blob:', error);
  //           reject(error);
  //         }
  //       );
  //     });
  //   } catch (error) {
  //     console.error('Error generating bonus check:', error);
  //     // Throw the error to ensure the function returns a rejected Promise
  //     throw error;
  //   }
  // }

  /*
   * Enhanced salary‑ / bonus‑slip generator
   * -------------------------------------------------------------------
   * Handles both regular « Paiement » and « Bonus » scenarios.
   * The table body is built dynamically according to the title passed
   * (case‑insensitive check for the word “bonus”).
   */

  async generatePaymentCheck(
    employee: Employee,
    title: string = 'Paiement', // "Paiement" or "Bonus"
    paymentAmount: string // net amount actually paid / total bonus
  ) {
    /* ---------- Helpers --------------------------------------------------*/
    const safeNumber = (v: number) => {
      const cleaned = String(v ?? '').replace(/[^\d.-]/g, '');
      const parsed = Number(cleaned);
      const n = Number.isFinite(parsed) ? Math.round(parsed) : 0;
      return n.toString();
    };
    const formatWeekRange = (start?: string, end?: string) => {
      if (!start) return '';
      const endLabel = end || start;
      return `${start} au ${endLabel}`;
    };

    const todayFr = this.time.getTodaysDateInFrench();
    const periodFr = `${
      this.time.monthFrenchNames[new Date().getMonth()]
    } ${new Date().getFullYear()}`;
    const invoiceNum = employee.payments
      ? (Object.keys(employee.payments).length + 1).toString()
      : '1';

    const isBonus = title.toLowerCase().includes('bonus');

    /* ---------- Amount breakdown ----------------------------------------*/
    let tableRows: (
      | string
      | { text: string; alignment?: string; style?: string }
    )[][] = [];
    let netPay = 0;

    if (isBonus) {
      const perfBonus = Number(employee.bonusAmount ?? 0);
      const teamBonus = Number(employee.bestTeamBonusAmount ?? 0);
      const empBonus = Number(employee.bestEmployeeBonusAmount ?? 0);
      const mgrBonus = Number(employee.bestManagerBonusAmount ?? 0);
      netPay = perfBonus + teamBonus + empBonus + mgrBonus;

      tableRows = [
        [
          { text: 'Composante', style: 'th' },
          { text: 'Montant ($)', style: 'th', alignment: 'right' },
        ],
        [
          'Bonus performance',
          { text: safeNumber(perfBonus), alignment: 'right' },
        ],
        [
          'Meilleure équipe',
          { text: safeNumber(teamBonus), alignment: 'right' },
        ],
        [
          'Meilleur employé',
          { text: safeNumber(empBonus), alignment: 'right' },
        ],
        [
          'Meilleur manager',
          { text: safeNumber(mgrBonus), alignment: 'right' },
        ],
        [
          { text: 'Total bonus net', style: 'totalLabel' },
          { text: safeNumber(netPay), style: 'total', alignment: 'right' },
        ],
      ];
    } else {
      const baseSalary = Number(employee.paymentAmount ?? 0);
      const expIncrease = Number(employee.paymentIncreaseYears ?? 0);
      const bankTransfer = Number(employee.paymentBankFee ?? 0);
      const absentDed = Number(employee.paymentAbsent ?? 0);
      const noneDed = Number(employee.paymentNothing ?? 0);
      const late = Number(employee.paymentLate ?? 0);
      const objectiveDed = Number(
        employee.paymentObjectiveWeekDeductionTotal ?? 0
      );
      const objectiveWeeks = Array.isArray(
        employee.paymentObjectiveWeekDeductions
      )
        ? employee.paymentObjectiveWeekDeductions
        : [];

      netPay =
        baseSalary +
        expIncrease +
        bankTransfer -
        absentDed -
        noneDed -
        late -
        objectiveDed;

      tableRows = [
        [
          { text: 'Composante', style: 'th' },
          { text: 'Montant ($)', style: 'th', alignment: 'right' },
        ],
        [
          'Salaire de base',
          { text: safeNumber(baseSalary), alignment: 'right' },
        ],
        [
          'Augmentation ancienneté',
          { text: safeNumber(expIncrease), alignment: 'right' },
        ],
        [
          'Frais de virement bancaire',
          { text: safeNumber(bankTransfer), alignment: 'right' },
        ],
        [
          'Retenues – Absences',
          { text: `-${safeNumber(absentDed)}`, alignment: 'right' },
        ],
        [
          'Retenues – Néant',
          { text: `-${safeNumber(noneDed)}`, alignment: 'right' },
        ],
        [
          'Retenues – Retard',
          { text: `-${safeNumber(late)}`, alignment: 'right' },
        ],
        [
          'Retenues – Objectif semaine non atteint',
          { text: `-${safeNumber(objectiveDed)}`, alignment: 'right' },
        ],
        [
          { text: 'Net à payer', style: 'totalLabel' },
          { text: safeNumber(netPay), style: 'total', alignment: 'right' },
        ],
      ];

      if (objectiveWeeks.length > 0) {
        const weekLabel = objectiveWeeks
          .map((w) => formatWeekRange(w.start, w.end))
          .filter((v) => v)
          .join(' | ');
        tableRows.splice(tableRows.length - 1, 0, [
          {
            text: `Semaines concernées: ${weekLabel}`,
            colSpan: 2,
            style: 'tiny',
          } as any,
          '' as any,
        ]);
      }
    }

    /* ---------- Attendance stats (kept for both) ------------------------*/
    const stats = { P: 0, A: 0, L: 0, N: 0 } as Record<string, number>;
    const now = new Date();
    const ymKey = `${now.getMonth() + 1}-`;
    Object.keys(employee.attendance || {}).forEach((k) => {
      if (k.startsWith(ymKey)) {
        const v = (employee.attendance as any)[k];
        if (stats[v] !== undefined) stats[v] += 1;
      }
    });

    /* ---------- Branding -------------------------------------------------*/
    const base64Logo = await this.fetchImageAsBase64(
      '../../../assets/img/gervais.png'
    );

    /* ---------- Document definition -------------------------------------*/
    const dd: any = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],

      content: [
        // Header ----------------------------------------------------------
        {
          columns: [
            [
              { text: 'FONDATION GERVAIS', style: 'brand' },
              {
                text: '9 Av. Nations-Unies\nMon‑Ngafula, Kinshasa (RDC)',
                style: 'tiny',
              },
              { text: 'Téléphone : +243 825 333 567', style: 'tiny' },
            ],
            { image: base64Logo, width: 75, alignment: 'right' },
          ],
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 515 - 80,
              y2: 0,
              lineWidth: 1.5,
              lineColor: '#263238',
            },
          ],
          margin: [0, 5, 0, 15],
        },

        { text: `Fiche de ${title}`, style: 'docTitle' },

        {
          columns: [
            {
              text: [
                { text: 'Employé : ', bold: true },
                `${employee.firstName} ${employee.middleName ?? ''} ${
                  employee.lastName
                }\n`,
                { text: 'Rôle : ', bold: true },
                `${employee.role ?? ''}\n`,
                { text: 'Période : ', bold: true },
                `${periodFr}`,
              ],
            },
            {
              text: [
                { text: 'N° Fiche : ', bold: true },
                `${invoiceNum}\n`,
                { text: "Date d'édition : ", bold: true },
                todayFr,
              ],
              alignment: 'right',
            },
          ],
          margin: [0, 0, 0, 15],
        },

        // Breakdown table -------------------------------------------------
        {
          style: 'table',
          table: {
            widths: ['*', 'auto'],
            body: tableRows,
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0,
            hLineColor: () => '#B0BEC5',
          },
          margin: [0, 0, 0, 20],
        },

        // Attendance summary ----------------------------------------------
        {
          text: 'Résumé de présence',
          style: 'subHeader',
          margin: [0, 0, 0, 6],
        },
        {
          ul: [
            `Présent : ${stats['P']} jours`,
            `Retard : ${stats['L']} jours`,
            `Absent : ${stats['A']} jours`,
            `Néant : ${stats['N']} jours`,
          ],
          margin: [0, 0, 0, 20],
        },

        // Signatures -------------------------------------------------------
        {
          table: {
            widths: ['*', '*', '*'],
            body: [
              [
                { text: 'Signature employé', style: 'th', alignment: 'center' },
                { text: 'Manager', style: 'th', alignment: 'center' },
                { text: 'Service RH', style: 'th', alignment: 'center' },
              ],
              [
                // simulate a handwritten signature
                {
                  text: `${employee.firstName} ${employee.middleName ?? ''} ${
                    employee.lastName
                  }`,
                  style: 'signature',
                  alignment: 'center',
                },
                { text: ' ', margin: [0, 30] },
                { text: ' ' },
              ],
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ],

      styles: {
        brand: { fontSize: 14, bold: true, color: '#263238' },
        tiny: { fontSize: 8, color: '#546E7A' },
        docTitle: { fontSize: 18, bold: true, margin: [0, 0, 0, 15] },
        subHeader: { fontSize: 12, bold: true },
        table: { margin: [0, 0, 0, 10] },
        th: { bold: true, fillColor: '#ECEFF1', margin: [0, 3, 0, 3] },
        totalLabel: { bold: true, margin: [0, 3, 0, 3] },
        total: { bold: true, fontSize: 12, margin: [0, 3, 0, 3] },

        /* NEW: cursive-like signature */
        signature: { italics: true, fontSize: 14 },
      },

      defaultStyle: { fontSize: 10 },
    };

    /* ---------- Generate -------------------------------------------------*/
    const pdfMake = await this.ensurePdfMake();
    const pdfDoc = pdfMake.createPdf(dd);

    return new Promise<Blob>((resolve, reject) => {
      pdfDoc.getBlob(
        (b: Blob) => resolve(b),
        (e: any) => reject(e)
      );
    });
  }

  async generateYearlyPaymentSummary(
    employee: Employee,
    year: number,
    months: {
      month: number;
      monthLabel: string;
      entries: { dateLabel: string; amount: number; kind: 'paiement' | 'bonus' }[];
      totalPayment: number;
      totalBonus: number;
    }[],
    totalPayment: number,
    totalBonus: number
  ): Promise<Blob> {
    const safeNumber = (v: number) => {
      const cleaned = String(v ?? '').replace(/[^0-9.-]/g, '');
      const parsed = Number(cleaned);
      const n = Number.isFinite(parsed) ? Math.round(parsed) : 0;
      return n.toString();
    };

    const base64Logo = await this.fetchImageAsBase64(
      '../../../assets/img/gervais.png'
    );

    const content: any[] = [
      {
        columns: [
          [
            { text: 'FONDATION GERVAIS', style: 'brand' },
            {
              text: '9 Av. Nations-Unies\nMon‑Ngafula, Kinshasa (RDC)',
              style: 'tiny',
            },
            { text: 'Téléphone : +243 825 333 567', style: 'tiny' },
          ],
          { image: base64Logo, width: 75, alignment: 'right' },
        ],
      },
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515 - 80,
            y2: 0,
            lineWidth: 1.5,
            lineColor: '#263238',
          },
        ],
        margin: [0, 5, 0, 15],
      },
      { text: 'Résumé annuel des paiements', style: 'docTitle' },
      {
        columns: [
          {
            text: [
              { text: 'Employé : ', bold: true },
              `${employee.firstName} ${employee.middleName ?? ''} ${
                employee.lastName
              }\n`,
              { text: 'Rôle : ', bold: true },
              `${employee.role ?? ''}\n`,
              { text: 'Année : ', bold: true },
              `${year}`,
            ],
          },
          {
            text: [
              { text: "Date d'édition : ", bold: true },
              this.time.getTodaysDateInFrench(),
            ],
            alignment: 'right',
          },
        ],
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            [
              { text: 'TOTAL PAIEMENTS ANNUEL', style: 'yearTotalLabel' },
              {
                text: `$${safeNumber(totalPayment)}`,
                style: 'yearTotalValue',
                alignment: 'right',
              },
            ],
            [
              { text: 'TOTAL BONUS ANNUEL', style: 'yearTotalBonusLabel' },
              {
                text: `$${safeNumber(totalBonus)}`,
                style: 'yearTotalBonusValue',
                alignment: 'right',
              },
            ],
            [
              { text: 'TOTAL RÉMUNÉRATIONS', style: 'yearTotalAllLabel' },
              {
                text: `$${safeNumber(totalPayment + totalBonus)}`,
                style: 'yearTotalAllValue',
                alignment: 'right',
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.7,
          vLineWidth: () => 0,
          hLineColor: () => '#B0BEC5',
        },
        margin: [0, 0, 0, 15],
      },
    ];

    const formatMoney = (value: number) => `$${safeNumber(value)}`;

    const monthSummaryRows = months
      .filter((month) => month.entries && month.entries.length > 0)
      .map((month) => [
        { text: month.monthLabel, style: 'monthCell' },
        { text: formatMoney(month.totalPayment), alignment: 'right' },
        { text: formatMoney(month.totalBonus), alignment: 'right' },
        {
          text: formatMoney(month.totalPayment + month.totalBonus),
          alignment: 'right',
          style: 'total',
        },
      ]);

    content.push({
      text: 'Résumé mensuel',
      style: 'subHeader',
      margin: [0, 6, 0, 6],
    });
    content.push({
      style: 'table',
      table: {
        widths: ['*', 'auto', 'auto', 'auto'],
        body: [
          [
            { text: 'Mois', style: 'tableHeader' },
            { text: 'Paiements', style: 'tableHeader', alignment: 'right' },
            { text: 'Bonus', style: 'tableHeader', alignment: 'right' },
            { text: 'Rémunérations', style: 'tableHeader', alignment: 'right' },
          ],
          ...monthSummaryRows,
        ],
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0,
        hLineColor: () => '#B0BEC5',
        fillColor: (rowIndex: number) => {
          if (rowIndex === 0) return '#E2E8F0';
          return rowIndex % 2 === 0 ? '#F8FAFC' : null;
        },
      },
      margin: [0, 0, 0, 16],
    });

    const dd: any = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content,
      styles: {
        brand: { fontSize: 14, bold: true, color: '#263238' },
        tiny: { fontSize: 8, color: '#546E7A' },
        docTitle: { fontSize: 18, bold: true, margin: [0, 0, 0, 15] },
        subHeader: { fontSize: 12, bold: true, margin: [0, 6, 0, 6] },
        table: { margin: [0, 0, 0, 10] },
        th: { bold: true, fillColor: '#ECEFF1', margin: [0, 3, 0, 3] },
        totalLabel: { bold: true, margin: [0, 3, 0, 3] },
        total: { bold: true, fontSize: 10, margin: [0, 3, 0, 3] },
        yearTotalLabel: {
          bold: true,
          fontSize: 12,
          color: '#0F172A',
          fillColor: '#E2E8F0',
          margin: [0, 4, 0, 4],
        },
        yearTotalValue: {
          bold: true,
          fontSize: 14,
          color: '#0F172A',
          fillColor: '#E2E8F0',
          margin: [0, 4, 0, 4],
        },
        yearTotalBonusLabel: {
          bold: true,
          fontSize: 12,
          color: '#0F172A',
          fillColor: '#DCFCE7',
          margin: [0, 4, 0, 4],
        },
        yearTotalBonusValue: {
          bold: true,
          fontSize: 14,
          color: '#166534',
          fillColor: '#DCFCE7',
          margin: [0, 4, 0, 4],
        },
        yearTotalAllLabel: {
          bold: true,
          fontSize: 12,
          color: '#14532D',
          fillColor: '#DCFCE7',
          margin: [0, 4, 0, 4],
        },
        yearTotalAllValue: {
          bold: true,
          fontSize: 15,
          color: '#166534',
          fillColor: '#DCFCE7',
          margin: [0, 4, 0, 4],
        },
      },
      defaultStyle: { fontSize: 10 },
    };

    const pdfMake = await this.ensurePdfMake();
    const pdfDoc = pdfMake.createPdf(dd);

    return new Promise<Blob>((resolve, reject) => {
      pdfDoc.getBlob(
        (b: Blob) => resolve(b),
        (e: any) => reject(e)
      );
    });
  }

  private formatContractBullet(bullet: string): string | { text: any; style: string } {
    const match = bullet.match(/base mensuelle\s*:\s*(.+)$/i);
    if (!match) {
      return bullet;
    }
    const amount = match[1].trim();
    return {
      text: [
        { text: 'Base mensuelle : ', bold: true, fontSize: 12 },
        { text: amount, bold: true, fontSize: 12, color: '#0f172a' },
      ],
      style: 'baseSalaryBullet',
    };
  }

  async generateContractDocument(
    employee: Employee,
    contract: {
      title: string;
      subject: string;
      intro: string[];
      sections: { title: string; bullets?: string[]; paragraphs?: string[] }[];
      closing: string[];
      signedDate: string;
      roleLabel: string;
      effectiveDate?: string;
      signatureDataUrl?: string;
    }
  ): Promise<Blob> {
    const logo = await this.fetchImageAsBase64(
      '../../../assets/img/gervais.png'
    );

    const fullName = `${employee.firstName ?? ''} ${
      employee.middleName ?? ''
    } ${employee.lastName ?? ''}`.replace(/\s+/g, ' ');

    const content: any[] = [
      {
        columns: [
          [
            { text: 'FONDATION GERVAIS', style: 'brand' },
            {
              text: '9 Av. Nations-Unies\nMon‑Ngafula, Kinshasa (RDC)',
              style: 'tiny',
            },
            { text: 'Téléphone : +243 825 333 567', style: 'tiny' },
          ],
          { image: logo, width: 80, alignment: 'right', style: 'logo' },
        ],
      },
      {
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 0,
            x2: 515 - 80,
            y2: 0,
            lineWidth: 1.5,
            lineColor: '#263238',
          },
        ],
        margin: [0, 5, 0, 15],
      },
      {
        text: contract.title,
        style: 'docTitle',
        alignment: 'center',
        margin: [0, 0, 0, 4],
      },
      {
        text: contract.subject,
        style: 'subject',
        alignment: 'center',
        margin: [0, 0, 0, 12],
      },
    ];

    if (contract.effectiveDate) {
      content.push({
        text: contract.effectiveDate,
        style: 'paragraph',
        margin: [0, 0, 0, 10],
      });
    }

    contract.intro.forEach((p) =>
      content.push({ text: p, style: 'paragraph', margin: [0, 0, 0, 8] })
    );

    contract.sections.forEach((section) => {
      const isMotif = section.title === 'Motifs de Licenciement';
      const titleStyle = isMotif ? 'sectionTitleMotif' : 'sectionTitle';
      const paragraphStyle = isMotif ? 'paragraphMotif' : 'paragraph';
      const listStyle = isMotif ? 'paragraphMotif' : 'paragraph';

      content.push({
        text: section.title,
        style: titleStyle,
        margin: [0, 12, 0, 6],
      });

      (section.paragraphs || []).forEach((p) =>
        content.push({ text: p, style: paragraphStyle, margin: [0, 0, 0, 6] })
      );

      if (section.bullets?.length) {
        const listItems = section.bullets.map((bullet) =>
          this.formatContractBullet(bullet)
        );
        content.push({
          ul: listItems,
          style: listStyle,
          margin: [0, 0, 0, 10],
        });
      }
    });

    contract.closing.forEach((p) =>
      content.push({ text: p, style: 'paragraph', margin: [0, 0, 0, 6] })
    );

    content.push({
      margin: [0, 18, 0, 0],
      table: {
        widths: ['*', '*'],
        body: [
          [
            { text: 'Signature', style: 'signatureLabel' },
            {
              text: 'Validation Fondation',
              style: 'signatureLabel',
              alignment: 'right',
            },
          ],
          [
            {
              stack: [
                contract.signatureDataUrl
                  ? {
                      image: contract.signatureDataUrl,
                      width: 160,
                      alignment: 'left',
                      margin: [0, 0, 0, 4],
                    }
                  : { text: fullName, style: 'signatureName' },
                {
                  text: `Signé le ${contract.signedDate}`,
                  style: 'signatureDate',
                },
                contract.signatureDataUrl
                  ? { text: fullName, style: 'signatureName', margin: [0, 4, 0, 0] }
                  : {},
              ].filter(Boolean),
            },
            {
              stack: [
                { text: 'Georgine Kuta', style: 'signatureName', alignment: 'right' },
                {
                  text: 'Fondatrice',
                  style: 'signatureDate',
                  alignment: 'right',
                },
                {
                  text: contract.signedDate,
                  style: 'signatureDate',
                  alignment: 'right',
                },
              ],
            },
          ],
        ],
      },
      layout: 'noBorders',
    });

    const dd: any = {
      pageSize: 'A4',
      pageMargins: [40, 55, 40, 55],
      content,
      styles: {
        brand: { fontSize: 14, bold: true, color: '#263238' },
        tiny: { fontSize: 8, color: '#546E7A' },
        logo: { margin: [0, 0, 0, 0] },
        docTitle: { fontSize: 18, bold: true, color: '#111827' },
        subject: { fontSize: 12, color: '#1f2937' },
        paragraph: { fontSize: 11, lineHeight: 1.35, color: '#111827' },
        sectionTitle: { fontSize: 13, bold: true, color: '#0f172a' },
        sectionTitleMotif: {
          fontSize: 13,
          bold: true,
          color: '#b91c1c',
        },
        signatureLabel: { bold: true, fontSize: 12, margin: [0, 0, 0, 6] },
        signatureName: { bold: true, fontSize: 12 },
        signatureDate: { italics: true, fontSize: 10, color: '#4b5563' },
        baseSalaryBullet: { fontSize: 12, bold: true, color: '#0f172a' },
        paragraphMotif: {
          fontSize: 11,
          lineHeight: 1.35,
          color: '#b91c1c',
          bold: true,
        },
      },
      defaultStyle: { fontSize: 10 },
    };

    const pdfMake = await this.ensurePdfMake();
    const pdfDoc = pdfMake.createPdf(dd);

    return new Promise<Blob>((resolve, reject) => {
      pdfDoc.getBlob(
        (b: Blob) => resolve(b),
        (e: any) => reject(e)
      );
    });
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
            const raw = typeof amount === 'string' ? amount : String(amount);
            const numericAmount = raw.split(':')[0]; // Amount is before the colon if it exists
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
            const raw = typeof amount === 'string' ? amount : String(amount);
            totalReserve += parseInt(raw.split(':')[0], 10); // Sum up today's reserves
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
      // [
      //   { people: '100' },
      //   {
      //     role: 'Manager',
      //     base: '100$',
      //     bonus70_79: '60$',
      //     bonus80_89: '80$',
      //     bonus90_99: '100$',
      //     bonus100: '110$',
      //   },
      //   {
      //     role: 'Agent Marketing',
      //     base: '90$',
      //     bonus70_79: '50$',
      //     bonus80_89: '70$',
      //     bonus90_99: '90$',
      //     bonus100: '100$',
      //   },
      // ],
      // [
      //   { people: '160' },
      //   {
      //     role: 'Manager',
      //     base: '120$',
      //     bonus70_79: '110$',
      //     bonus80_89: '130$',
      //     bonus90_99: '150$',
      //     bonus100: '160$',
      //   },
      //   {
      //     role: 'Agent Marketing',
      //     base: '110$',
      //     bonus70_79: '100$',
      //     bonus80_89: '120$',
      //     bonus90_99: '140$',
      //     bonus100: '150$',
      //   },
      // ],
      // [
      //   { people: '200' },
      //   {
      //     role: 'Manager',
      //     base: '140$',
      //     bonus70_79: '160$',
      //     bonus80_89: '180$',
      //     bonus90_99: '200$',
      //     bonus100: '220$',
      //   },
      //   {
      //     role: 'Agent Marketing',
      //     base: '130$',
      //     bonus70_79: '150$',
      //     bonus80_89: '170$',
      //     bonus90_99: '190$',
      //     bonus100: '210$',
      //   },
      // ],
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

  // Returns true if distance minus accuracy is within radius
  checkWithinRadius(
    userLat: number,
    userLng: number,
    targetLat: number,
    targetLng: number,
    radius: number,
    userAccuracy = 0 // meters
  ): boolean {
    const distance = this.calculateDistance(
      userLat,
      userLng,
      targetLat,
      targetLng
    );
    const effective = Math.max(0, distance - (userAccuracy || 0));
    return effective <= radius;
  }

  // computation.service.ts
  bestEffortGetLocation(maxWaitMs = 15000): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      let best: GeolocationPosition | null = null;
      let settled = false;

      const cleanup = (watchId?: number) => {
        if (watchId != null) navigator.geolocation.clearWatch(watchId);
      };

      // 1) Start watchPosition to collect multiple fixes
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          // Keep the most accurate sample
          if (!best || pos.coords.accuracy < best.coords.accuracy) {
            best = pos;
            // If we reach good accuracy early, resolve immediately
            if (pos.coords.accuracy <= 50 && !settled) {
              settled = true;
              cleanup(watchId);
              resolve(pos);
            }
          }
        },
        () => {
          /* ignore transient errors during watch */
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: maxWaitMs,
        }
      );

      // 2) Safety timer: after 12s, use the best we have, or fallback to a quick getCurrentPosition
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup(watchId);

        if (best) {
          resolve(best);
          return;
        }

        // 3) Last fallback: coarse, fast location (helps in low bandwidth)
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          (err) => reject(err),
          {
            enableHighAccuracy: false,
            maximumAge: 300000, // up to 5 min cached if needed
            timeout: 8000,
          }
        );
      }, Math.min(12000, maxWaitMs));
    });
  }

  // getMaxLendAmount(creditScore: number): number {
  //   if (!Number.isFinite(creditScore)) {
  //     throw new Error('Credit score must be a finite number.');
  //   }
  //   if (creditScore > 100) {
  //     throw new Error('Credit score must be ≤ 100.');
  //   }

  //   // Thresholds are inclusive (<=). 0 or less → 0 FC.
  //   const scoreLimits = [
  //     0, 19, 34, 39, 44, 49, 54, 59, 64, 69, 74, 79, 84, 89, 94, 99, 100,
  //   ];
  //   const amounts = [
  //     0, // <= 0%
  //     50000, // 1–19%
  //     100000, // 20–34%
  //     150000, // 35–39%
  //     200000, // 40–44%
  //     300000, // 45–49%
  //     400000, // 50–54%
  //     500000, // 55–59%
  //     600000, // 60–64%
  //     700000, // 65–69%
  //     1000000, // 70–74%
  //     1100000, // 75–79%
  //     1200000, // 80–84%
  //     1300000, // 85–89%
  //     1400000, // 90–94%
  //     1500000, // 95–99%
  //     2000000, // 100%
  //   ];

  //   const idx = scoreLimits.findIndex((limit) => creditScore <= limit);
  //   return amounts[idx];
  // }

  getMaxLendAmount(creditScore: number): number {
    if (!Number.isFinite(creditScore)) {
      throw new Error('Credit score must be a finite number.');
    }

    // Base scale up to score <= 100
    const scoreLimits = [
      0, 19, 34, 39, 44, 49, 54, 59, 64, 69, 74, 79, 84, 89, 94, 99, 100,
    ];

    const amounts = [
      0, // <= 0%
      50_000, // 1–19%
      100_000, // 20–34%
      150_000, // 35–39%
      200_000, // 40–44%
      300_000, // 45–49%
      400_000, // 50–54%
      500_000, // 55–59%
      600_000, // 60–64%
      700_000, // 65–69%
      1_000_000, // 70–74%
      1_100_000, // 75–79%
      1_200_000, // 80–84%
      1_300_000, // 85–89%
      1_400_000, // 90–94%
      1_500_000, // 95–99%
      2_000_000, // ✅ now 100 → 2,000,000
    ];

    // If score ≤ 100 → use the table normally
    if (creditScore <= 100) {
      const idx = scoreLimits.findIndex((limit) => creditScore <= limit);
      return amounts[idx];
    }

    // If score > 100 → dynamic increase
    const extra = creditScore - 100;
    const step = Math.floor(extra / 5);

    return 2_000_000 + step * 100_000;
  }

  yearsSinceJoining(dateJoined: string): number {
    const joinDate = new Date(dateJoined);
    const currentDate = new Date();

    let yearsPassed = currentDate.getFullYear() - joinDate.getFullYear();

    // Check if the anniversary for this year has passed or not
    const hasAnniversaryPassed =
      currentDate.getMonth() > joinDate.getMonth() ||
      (currentDate.getMonth() === joinDate.getMonth() &&
        currentDate.getDate() >= joinDate.getDate());

    if (!hasAnniversaryPassed) {
      yearsPassed--; // Subtract one if the anniversary hasn't occurred yet
    }

    return Math.max(0, yearsPassed); // Ensure non-negative values
  }
  isNumber(value: string): boolean {
    return !isNaN(Number(value));
  }
  public computeAge(birth: string | undefined): number | null {
    if (!birth) {
      return null;
    } // sécurité
    const [d, m, y] = birth.split('-').map(Number); // jj-mm-aaaa
    const dob = new Date(y, m - 1, d);
    const today = new Date();
    let a = today.getFullYear() - dob.getFullYear();
    const diff =
      today.getMonth() - dob.getMonth() || today.getDate() - dob.getDate();
    if (diff < 0) a--;
    return a;
  }
}
