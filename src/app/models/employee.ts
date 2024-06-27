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
  performancePercentageMonth?: string;
  dateOfBirth?: string;
  dateJoined?: string;
  status?: string;
  profilePicture?: Avatar;
  dateLeft?: string;
  clients?: string[];
  currentClients?: string[];
  clientsFinishedPaying?: number;
  dailyStatus?: { [key: string]: string };
}
export class Avatar {
  path?: string;
  size?: string;
  downloadURL?: string;
  CV?: string;
  CVDownloadURL?: string;
  CVSize?: string;
}

export class Certificate {
  month?: string;
  year?: string;
  bestTeam?: string;
  bestEmployee?: string;
  bestEmployeePerformance?: string;
  bestTeamCertificatePath?: string;
  bestTeamCertificateDownloadUrl?: string;
  bestEmployeeCertificatePath?: string;
  bestEmployeeCertificateDownloadUrl?: string;
}
