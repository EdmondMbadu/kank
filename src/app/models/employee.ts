import { User } from './user';

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
  attendance?: { [key: string]: string };
  monthToBePaid?: string;
  checkVisible?: string;
  paymentCheckVisible?: string;
  bonusAmount?: string;
  paymentAmount?: string;
  bonusPercentage?: string;
  bestTeamBonusAmount?: string;
  bestEmployeeBonusAmount?: string;
  bestManagerBonusAmount?: string;
  totalBonusThisMonth?: string;
  paymentAbsent?: string;
  paymentNothing?: string;
  paymentIncreaseYears?: string;
  thisMonthPaymentAmount?: string;
  totalPayments?: string;
  bonusCheckUrl?: string;
  paymentCode?: string;
  tempLocationHolder?: string;
  contract?: string;
  vacationRequestNumberOfDays?: string;
  vacationAcceptedNumberOfDays?: string;
  bank?: string;
  tempUser?: User;
  showAttendance?: boolean;
  receipts?: string[];
  paidThisMonth?: boolean;
  paymentBankFee?: string;
  paymentLate?: string;
  // NEW: parallel map of attachments by date
  attendanceAttachments?: { [date: string]: AttendanceAttachment };

  arrivalHour?: string;
  arrivalMinute?: string;

  // ---------- UI-only transient fields (not saved) ----------
  _attachmentFile?: File | null;
  _attachmentPreview?: string | null;
  _attachmentType?: string | null;
  _attachmentSize?: number | null;
  _attachmentError?: string | null;
  _uploading?: boolean;
  _attachmentTakenAt?: string;
  _attachmentDeviceInfo?: string;
  _attachmentUA?: string;
  _attachmentSoftId?: string;
  _attachmentHash?: string;
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
  bestManager?: string;
  bestEmployeePerformance?: string;
  bestTeamCertificatePath?: string;
  bestTeamCertificateDownloadUrl?: string;
  bestEmployeeCertificatePath?: string;
  bestEmployeeCertificateDownloadUrl?: string;
  bestManagerCertificatePath?: string;
  bestManagerCertificateDownloadUrl?: string;
}
export type AttendanceAttachment = {
  url: string;
  path: string;
  size: number;
  contentType: string;
  uploadedAt: number; // ISO string
  uploaderId: string;
};
