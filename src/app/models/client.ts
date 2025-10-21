import { Avatar, Employee } from './employee';

export class Client {
  uid?: string;
  trackingId?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  profession?: string;
  phoneNumber?: string;
  previousPhoneNumbers?: string[];
  paymentDay?: string;
  minPayment?: string;
  frenchPaymentDay?: string;
  businessCapital?: string;
  homeAddress?: string;
  businessAddress?: string;
  debtCycle?: string;
  membershipFee?: string;
  membershipFeePayments?: { [key: string]: string } = {};
  applicationFee?: string;
  applicationFeePayments?: { [key: string]: string } = {};
  savings?: string;
  loanAmount?: string;
  creditScore?: string;
  amountPaid?: string;
  debtLeft?: string;
  dateJoined?: string;
  numberOfPaymentsMissed?: string;
  numberOfPaymentsMade?: string;
  payments?: { [key: string]: string } = {};
  previousPayments?: { [key: string]: string } = {};
  previousSavingsPayments?: { [key: string]: string } = {};
  savingsPayments?: { [key: string]: string } = {};
  interestRate?: string;
  agent?: string;
  amountToPay?: string;
  loanAmountPending?: string;
  paymentPeriodRange?: string;
  debtCycleStartDate?: string;
  debtCycleEndDate?: string;
  employee?: Employee;
  type?: string;
  requestAmount?: string;
  previouslyRequestedAmount?: string;
  requestStatus?: string;
  requestDate?: string;
  requestType?: string;
  rejectionReturnAmount?: string; // NEW
  dateOfRequest?: string;
  profilePicture?: Avatar;
  vitalStatus?: string;
  timeInBusiness?: string;
  monthlyIncome?: string;
  debtInProcess?: string;
  planToPayDebt?: string;
  references?: string[];
  collateral?: string;
  creditworthinessScore?: string;
  cycleId?: string;
  comments?: Comment[];
  isPhoneCorrect?: string;
  agentVerifyingName?: string;
  agentSubmittedVerification?: string;
  birthDate?: string;
  age?: string;
  locationName?: string;
  archivedAt?: string;
}

export class Comment {
  name?: string;
  time?: string;
  timeFormatted?: string;
  comment?: string;
  stars?: string;
  starsNumber?: number;
  audioUrl?: string;

  visible?: boolean; // false par défaut

  // ← NOUVEAU : 5 indicateurs (1-10)
  ponctualite?: number;
  proprete?: number;
  cahier?: number;
  suiviClients?: number;
  relationClient?: number;
  performance?: number;
  __editingPerf?: boolean;
  __perfDraft?: number;
  __editingComment?: boolean;
  __commentDraft?: string;
  targetUserId?: string;
  targetUserLastName?: string;

  [key: string]: any;
  // NEW:
  attachments?: Array<{
    type: 'image' | 'video';
    url: string;
    mimeType: string;
    size: number; // bytes
    width?: number; // px (image/video)
    height?: number; // px (image/video)
    durationSec?: number; // video only
    captureTimeOriginalISO?: string; // exact original timestamp
    captureTimeSource?:
      | 'exif'
      | 'mediainfo'
      | 'fileLastModified'
      | 'uploadTime';
    gps?: { lat: number; lng: number; alt?: number }; // if available from EXIF
  }>;
}
