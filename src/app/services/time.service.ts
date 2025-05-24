import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from './auth.service';
import { Client } from '../models/client';

@Injectable({
  providedIn: 'root',
})
export class TimeService {
  constructor() {}
  englishToFrenchDay: { [key: string]: string } = {
    Sunday: 'Dimanche',
    Monday: 'Lundi',
    Tuesday: 'Mardi',
    Wednesday: 'Mercredi',
    Thursday: 'Jeudi',
    Friday: 'Vendredi',
    Saturday: 'Samedi',
  };
  computeDateRange() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const startDate = `${month}-${day}-${year}`;
    const endDate = this.getDateInFiveWeeks(startDate);
    return [startDate, endDate];
  }
  computeDateRange2Months() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const startDate = `${month}-${day}-${year}`;
    const endDate = this.getDateInNineWeeks(startDate);
    return [startDate, endDate];
  }
  yearsList: number[] = [2023, 2024, 2025, 2026];
  monthFrenchNames = [
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
  todaysDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    let date = `${month}-${day}-${year}-${hours}-${minutes}-${seconds}`;

    return date;
  }
  todaysDateMonthDayYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    let date = `${month}-${day}-${year}`;
    return date;
  }
  findPrepositionStartWithVowelOrConsonant(str: string) {
    if (!str) {
      return 'De';
    }

    const firstChar = str.charAt(0).toLowerCase();

    if (/[aeiou]/.test(firstChar)) {
      return "D'";
    } else if (/[a-z]/.test(firstChar)) {
      return 'De';
    } else {
      return 'De';
    }
  }
  parseDate(timeStr: any) {
    const parts = timeStr.split('-');
    // The parts array will have the format [month, day, year, hour, minute, second]
    return new Date(
      parts[2],
      parts[0] - 1,
      parts[1],
      parts[3],
      parts[4],
      parts[5]
    );
  }

  convertToYearMonthDay(dateStr: string) {
    // Split the input date string by the hyphen
    const [year, month, day] = dateStr.split('-');
    // remove leading zeros
    const newMonth = parseInt(month, 10);
    const newDay = parseInt(day, 10);

    // Return the date in MM-DD-YYYY format
    return `${year}-${newMonth}-${newDay}`;
  }
  convertDateToMonthDayYear(dateStr: string) {
    // Split the input date string by the hyphen
    const [year, month, day] = dateStr.split('-');
    // remove leading zeros
    const newMonth = parseInt(month, 10);
    const newDay = parseInt(day, 10);

    // Return the date in MM-DD-YYYY format
    return `${newMonth}-${newDay}-${year}`;
  }
  getTomorrowsDateMonthDayYear() {
    const currentDate = new Date();

    // Get tomorrow's date
    currentDate.setDate(currentDate.getDate() + 1);

    // Extract the month, day, and year
    const month = currentDate.getMonth() + 1; // getMonth() is zero-based
    const day = currentDate.getDate();
    const year = currentDate.getFullYear();

    // Return the formatted date string
    return `${month}-${day}-${year}`;
  }

  // Example u

  validateDateWithInOneWeekNotPastOrToday(dateStr: string) {
    // Get the current date
    const currentDate: any = new Date();

    // Create a date object from the input date string
    const inputDate: any = new Date(dateStr);

    // Calculate the difference in milliseconds
    const diffTime = inputDate - currentDate;

    // Convert the difference to days
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    // Check if the difference is within one week and the date is in the future
    // the minus is for practical consideration since the actual data gives us numbers
    // between -1 and 0 for future considerations ( from -1 to 0)
    // added one day to the minimum to include today
    if (diffDays > 1 && diffDays <= 7) {
      return true;
    } else {
      return false;
    }
  }

  validateDateWithInOneWeekNotPastOrTodayCard(dateStr: string) {
    // Get the current date
    const currentDate: any = new Date();

    // Create a date object from the input date string
    const inputDate: any = new Date(dateStr);

    // Calculate the difference in milliseconds
    const diffTime = inputDate - currentDate;

    // Convert the difference to days
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    // Check if the difference is within one week and the date is in the future
    // the minus is for practical consideration since the actual data gives us numbers
    // between -1 and 0 for future considerations ( from -1 to 0)
    // added one day to the minimum to include today
    if (diffDays > -1 && diffDays <= 7) {
      return true;
    } else {
      return false;
    }
  }
  convertDateToDayMonthYear(dateStr: string) {
    // Split the input date string by the hyphen
    const [month, day, year] = dateStr.split('-');

    // Return the date in MM-DD-YYYY format
    return `${day}/${month}/${year}`;
  }

  nextPaymentDate(dateJoined: any) {
    const targetDay = new Date(dateJoined).getDay();
    if (targetDay < 0 || targetDay > 6) {
      throw new Error('Invalid day: the day parameter must be between 0 and 6');
    }

    let today = new Date();
    let dayOfWeek = today.getDay();
    let daysUntilTargetDay = (targetDay - dayOfWeek + 7) % 7;

    // If the target day is today, we want the date for the same day in the next week
    if (daysUntilTargetDay === 0) {
      daysUntilTargetDay = 7;
    }
    today.setDate(today.getDate() + daysUntilTargetDay);
    today.setHours(0, 0, 0, 0); // Reset hours, minutes, seconds and milliseconds

    const format = today.toDateString().split(' ');
    return format[1] + ' ' + format[2];
  }

  formatDateString(inputDate: any) {
    // Parse the input date
    let input = inputDate.split('-');
    let month = parseInt(input[0], 10) - 1; // Months are zero-indexed in JavaScript
    let day = parseInt(input[1], 10);
    let year = parseInt(input[2], 10);

    // Create a Date object
    const date = new Date(year, month, day);

    // Array of month names
    const monthNames = [
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
    // Get the month name and day
    const formattedMonth = monthNames[date.getMonth()];
    const formattedDay = date.getDate();

    // Format the date to "Month Day"
    return `${formattedMonth} ${formattedDay} ${year}`;
  }
  getDateInFiveWeeks(inputDate: string) {
    // Parse the input date
    let input = inputDate.split('-');
    let month = parseInt(input[0], 10) - 1; // Months are zero-indexed in JavaScript
    let day = parseInt(input[1], 10);
    let year = parseInt(input[2], 10);

    // Create a Date object
    const date = new Date(year, month, day);

    // Add 35 days to the date
    date.setDate(date.getDate() + 28);

    // Get the new date components
    const newYear = date.getFullYear();
    const newMonth = date.getMonth() + 1; // Convert back to one-indexed
    const newDay = date.getDate();

    // Format the new date as a string
    return `${newMonth}-${newDay}-${newYear}`;
  }
  getDateInNineWeeks(inputDate: string) {
    // Parse the input date
    let input = inputDate.split('-');
    let month = parseInt(input[0], 10) - 1; // Months are zero-indexed in JavaScript
    let day = parseInt(input[1], 10);
    let year = parseInt(input[2], 10);

    // Create a Date object
    const date = new Date(year, month, day);

    // Add 35 days to the date
    date.setDate(date.getDate() + 56);

    // Get the new date components
    const newYear = date.getFullYear();
    const newMonth = date.getMonth() + 1; // Convert back to one-indexed
    const newDay = date.getDate();

    // Format the new date as a string
    return `${newMonth}-${newDay}-${newYear}`;
  }

  weeksSince(dateString: string) {
    const givenDate: any = new Date(dateString);
    const today: any = new Date();

    // Reset the time parts to avoid time offsets
    givenDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const daysPassed = (today - givenDate) / millisecondsPerDay;
    const weeksPassed = daysPassed / 7;

    return Math.floor(weeksPassed);
  }

  getDayOfWeek(dateString: string) {
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const [month, day, year] = dateString
      .split('-')
      .map((part) => parseInt(part, 10));
    const date = new Date(year, month - 1, day);
    return days[date.getDay()];
  }
  convertTimeFormat(input: string) {
    const parts = input.split('-');

    // Map the month numbers to their names in French
    const monthNames = [
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

    // Map the day numbers to their names in French
    const dayNames = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];

    // Create a Date object from the input parts
    const date = new Date(
      `${parts[0]}/${parts[1]}/${parts[2]} ${parts[3]}:${parts[4]}:${parts[5]}`
    );

    // Get the day of the week and month from the Date object
    const dayOfWeek = dayNames[date.getDay()];
    const month = monthNames[parseInt(parts[0], 10) - 1];
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const hour = ('0' + parseInt(parts[3], 10)).slice(-2); // Add leading zero
    const minute = ('0' + parseInt(parts[4], 10)).slice(-2); // Add leading zero

    // Construct the desired output format with the day of the week
    const formatted = `${day} ${month} ${year} à ${hour}:${minute}`;
    return formatted;
  }

  convertDateToDesiredFormat(input: string) {
    const parts = input.split('-');

    // Map the month numbers to their names in French
    const monthNames = [
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

    // Map the day numbers to their names in French
    const dayNames = [
      'Dimanche',
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
    ];

    // Create a Date object from the input parts
    const date = new Date(
      `${parts[0]}/${parts[1]}/${parts[2]} ${parts[3]}:${parts[4]}:${parts[5]}`
    );

    // Get the day of the week and month from the Date object
    const dayOfWeek = dayNames[date.getDay()];
    const month = monthNames[parseInt(parts[0], 10) - 1];
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    const hour = ('0' + parseInt(parts[3], 10)).slice(-2); // Add leading zero
    const minute = ('0' + parseInt(parts[4], 10)).slice(-2); // Add leading zero

    // Construct the desired output format with the day of the week
    const formatted = `${dayOfWeek} ${day} ${month} ${year} à ${hour}:${minute}`;
    return formatted;
  }

  isDateInRange(dateString: string) {
    // Parse the given date and the start date
    const givenDate = new Date(dateString);
    const startDate = new Date('2023-09-13');

    // Get the current date with time set to 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if the date is not before the start date and not after today
    return givenDate >= startDate && givenDate <= today;
  }

  isEndDateGreater(start: string, end: string) {
    // Convert the start and end dates
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Compare and return the result
    return endDate >= startDate;
  }

  getTodaysDateYearMonthDay(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  getTomorrowsDateYearMonthDay(): string {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  getDatesInRange(start: string, end: string) {
    const parseDate = (dateStr: string) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    const formatDate = (date: Date) => {
      const day = date.getDate();
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      return `${month}-${day}-${year}`;
    };

    const startDate = parseDate(start);
    const endDate = parseDate(end);
    const dates = [];

    for (
      let date = new Date(startDate);
      date <= endDate;
      date.setDate(date.getDate() + 1)
    ) {
      dates.push(formatDate(date));
    }

    return dates;
  }

  filterClientsByPaymentDates(clients: Client[], dates: string[]) {
    // Helper function to convert MM-DD-YYYY to YYYY/MM-DD
    const convertToDateCompatibleFormat = (dateStr: string) => {
      const [month, day, year] = dateStr.split('-');
      return `${year}/${month}/${day}`;
    };

    // Helper function to extract date part from the payment key
    const extractDate = (paymentKey: string) => {
      return paymentKey.split('-').slice(0, 3).join('-');
    };

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Filter clients
    return clients.filter((client) => {
      if (Number(client.debtLeft) <= 0) {
        return false;
      }

      const formattedDebtCycleStartDate = convertToDateCompatibleFormat(
        client.debtCycleStartDate!
      );
      const debtCycleStartDate = new Date(formattedDebtCycleStartDate);

      if (debtCycleStartDate > oneWeekAgo) {
        return false;
      }

      const paymentDates = Object.keys(client.payments!)
        .map(extractDate)
        .map(convertToDateCompatibleFormat);

      const formattedDates = dates.map(convertToDateCompatibleFormat);
      return !paymentDates.some((paymentDate) =>
        formattedDates.includes(paymentDate)
      );
    });
  }

  calculateAge(birthDateString: string) {
    var today = new Date();
    var birthDate = new Date(birthDateString);

    var age = today.getFullYear() - birthDate.getFullYear();
    var m = today.getMonth() - birthDate.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  timeAgo(dateString: string) {
    if (!dateString) return '';
    const [month, day, year, hours, minutes, seconds] = dateString
      .split('-')
      .map(Number);
    const givenDate = new Date(year, month - 1, day, hours, minutes, seconds);
    const now = new Date();

    const secondsDiff = Math.floor(
      (now.getTime() - givenDate.getTime()) / 1000
    );
    if (secondsDiff < 60) {
      return `${secondsDiff} second${secondsDiff > 1 ? 's' : ''} ago`;
    }

    const minutesDiff = Math.floor(secondsDiff / 60);
    if (minutesDiff < 60) {
      return `${minutesDiff} minute${minutesDiff > 1 ? 's' : ''} ago`;
    }

    const hoursDiff = Math.floor(minutesDiff / 60);
    if (hoursDiff < 24) {
      return `${hoursDiff} hour${hoursDiff > 1 ? 's' : ''} ago`;
    }

    const daysDiff = Math.floor(hoursDiff / 24);
    if (daysDiff < 30) {
      return `${daysDiff} day${daysDiff > 1 ? 's' : ''} ago`;
    }

    // Rough estimate for months, not accounting for varying days in months
    const monthsDiff = Math.floor(daysDiff / 30);
    if (monthsDiff < 12) {
      return `${monthsDiff} month${monthsDiff > 1 ? 's' : ''} ago`;
    }

    const yearsDiff = Math.floor(monthsDiff / 12);
    return `${yearsDiff} year${yearsDiff > 1 ? 's' : ''} ago`;
  }

  getTodaysDateInFrench() {
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

    const today = new Date();
    const day = today.getDate();
    const monthIndex = today.getMonth();
    const year = today.getFullYear();

    return `${day} ${monthNamesInFrench[monthIndex]} ${year}`;
  }
  toDate(dateString: string) {
    const [month, day, year] = dateString
      .split('-')
      .map((part: any) => parseInt(part, 10));
    return new Date(year, month - 1, day);
  }
  translateDayInFrench(day: string) {
    let response = this.englishToFrenchDay[day];
    return response !== undefined ? response : '';
  }
  isGivenDateLessOrEqual(dateX: string, today: string) {
    // Split the dates into components
    const [monthX, dayX, yearX] = dateX.split('-').map(Number);
    const [monthToday, dayToday, yearToday] = today.split('-').map(Number);

    // Create Date objects for comparison
    const dateObjectX = new Date(yearX, monthX - 1, dayX);
    const dateObjectToday = new Date(yearToday, monthToday - 1, dayToday);

    // Compare the dates
    return dateObjectToday <= dateObjectX;
  }

  weeksElapsed(dateX: string, today: string) {
    // Split the dates into components
    const [monthX, dayX, yearX] = dateX.split('-').map(Number);
    const [monthToday, dayToday, yearToday] = today.split('-').map(Number);

    // Create Date objects
    const dateObjectX: any = new Date(yearX, monthX - 1, dayX);
    const dateObjectToday: any = new Date(yearToday, monthToday - 1, dayToday);

    // Calculate the difference in milliseconds
    const diffInMs = Math.abs(dateObjectX - dateObjectToday);

    // Convert milliseconds to weeks
    const msInWeek = 1000 * 60 * 60 * 24 * 7;
    // const weeksElapsed = diffInMs / msInWeek;
    const weeksElapsed = Math.floor(diffInMs / msInWeek);

    return weeksElapsed;
  }
  isEmployeeOnTime(limitHour: number, limitMinute: number): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Check if the current time is after the limit
    if (
      currentHour > limitHour ||
      (currentHour === limitHour && currentMinute > limitMinute)
    ) {
      return false; // Late
    }
    return true; // On time
  }

  public isValidRequestDateForVacation(date: string): boolean {
    if (!date) {
      alert('La date est vide');
      return false;
    }

    // Parse the date string and adjust to local time
    const [year, month, day] = date.split('-').map(Number);
    const enteredDate = new Date(year, month - 1, day); // Month is zero-based
    const today = new Date();
    const yearNow = today.getFullYear();

    // Check if the date is valid
    if (isNaN(enteredDate.getTime())) {
      alert('Format de date invalide');
      return false;
    }

    console.log('enetered date', enteredDate);
    // Ensure the date is not in the past
    today.setHours(0, 0, 0, 0); // Normalize today's date to midnight
    if (enteredDate < today) {
      alert('La date est dans le passé');
      return false;
    }

    // Ensure the date is not tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (enteredDate.getTime() === tomorrow.getTime()) {
      alert('La date ne peut pas être demain');
      return false;
    }

    // Ensure the date is the day after tomorrow
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(today.getDate() + 2);
    if (enteredDate.getTime() < dayAfterTomorrow.getTime()) {
      alert('La date doit être après-demain');
      return false;
    }

    // Ensure the date is within the current year
    if (enteredDate.getFullYear() !== yearNow) {
      alert("La date doit être dans l'année en cours");
      return false;
    }

    return true;
  }
  convertEpochToDate(epochMs: number): string {
    return new Date(epochMs).toLocaleDateString('en-CA'); // → YYYY-MM-DD
  }
  /** 14 Mai 2025 à 11:27 (heure locale) */
  formatEpochLongFr(epochMs: number): string {
    const d = new Date(epochMs);
    const date = d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }); // → "14 mai 2025"
    const time = d.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }); // → "11:27"
    // Capitaliser le mois
    return (
      date.replace(
        /^(\d{2}) (\w)/,
        (_m, p1, p2) => `${p1} ${p2.toUpperCase()}`
      ) + ` à ${time}`
    );
  }
}
