export class Employee {
  uid?: string;
  firstName?: string;
  age?: string;
  trackingId?: string;
  lastName?: string;
  middleName?: string;
  role?: string;
  dailyPoints?: { [key: string]: string } = {};
  payments?: { [key: string]: string } = {};
  paymentsPicturePath?: string[];
  totalDailyPoints?: { [key: string]: string } = {};
  averagePoints?: string;
  totalPoints?: string;
  salaryPaid?: string;
  currentTotalPoints?: number;
  phoneNumber?: string;
  sex?: string;
  letterGrade?: string;
  performancePercantage?: string;
  dateOfBirth?: string;
  dateJoined?: string;
  status?: string;
  profilePicture?: Avatar;
  dateLeft?: string;
  clients?: string[];
  dailyStatus?: { [key: string]: string };
}
export class Avatar {
  path?: string;
  size?: string;
  downloadURL?: string;
}
