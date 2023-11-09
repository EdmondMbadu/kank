import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class TimeService {
  constructor() {}

  computeDateRange() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const startDate = `${month}-${day}-${year}`;
    const endDate = this.getDateInFiveWeeks(startDate);
    return [startDate, endDate];
  }

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
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    // Get the month name and day
    const formattedMonth = monthNames[date.getMonth()];
    const formattedDay = date.getDate();

    // Format the date to "Month Day"
    return `${formattedMonth} ${formattedDay}`;
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
    date.setDate(date.getDate() + 35);

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
}
