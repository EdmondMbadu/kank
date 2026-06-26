import { Avatar, Employee } from './employee';

export interface ClientBonusEvent {
  amount: string;
  type: 'credit' | 'transfer' | 'adjustment';
  createdAt: string;
  balanceAfter?: string;
  note?: string;
}

export interface ClientTrophyAward {
  awardedOn: string;
  cycle: string;
  amountUsd: string;
  createdAt: string;
}

export type ClientGalleryCategory = 'domicile' | 'trophy' | 'other';

export interface ClientGalleryPicture {
  id: string;
  category: ClientGalleryCategory;
  url: string;
  path: string;
  size: number;
  name?: string;
  uploadedAt: string;
  uploadedBy?: string;
  uploadedByName?: string;
  captureTimeOriginalISO?: string;
  captureTimeSource?: 'exif' | 'manual';
}

export interface AuditConversationAudioAttachment {
  url: string;
  name?: string;
  mimeType?: string;
  recordedAt?: string;
  recordedAtSource?: string;
  uploadedAt?: string;
  uploadedBy?: string;
}

export type AuditClientCommentTag = 'no_answer' | 'fraud' | 'other';

export interface ClientCommentAttachment {
  type: 'image' | 'video' | 'audio';
  url: string;
  name?: string;
  mimeType: string;
  size: number; // bytes
  path?: string;
  uploadedAt?: string;
  uploadedBy?: string;
  width?: number; // px (image/video)
  height?: number; // px (image/video)
  durationSec?: number; // audio/video
  captureTimeOriginalISO?: string; // exact original timestamp
  captureTimeSource?:
    | 'exif'
    | 'mediainfo'
    | 'fileLastModified'
    | 'uploadTime';
  gps?: { lat: number; lng: number; alt?: number }; // if available from EXIF
}

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
  debtRecognized?: string;
  notifiedForPolice?: boolean;
  dateJoined?: string;
  numberOfPaymentsMissed?: string;
  numberOfPaymentsMade?: string;
  payments?: { [key: string]: string } = {};
  paymentSources?: { [key: string]: 'manual' | 'mobile_money' } = {};
  previousPayments?: { [key: string]: string } = {};
  previousPaymentSources?: { [key: string]: 'manual' | 'mobile_money' } = {};
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
  auditCommentTag?: AuditClientCommentTag | string;
  auditCommentTagLabel?: string;
  auditCommentTaggedAt?: string;
  auditCommentTaggedBy?: string;
  auditConversationAudios?: AuditConversationAudioAttachment[];
  auditConversationAudioUrl?: string;
  auditConversationAudioName?: string;
  auditConversationAudioMimeType?: string;
  auditConversationAudioRecordedAt?: string;
  auditConversationAudioRecordedAtSource?: string;
  auditConversationAudioUploadedAt?: string;
  auditConversationAudioUploadedBy?: string;
  birthDate?: string;
  age?: string;
  locationName?: string;
  locationOwnerId?: string;
  archivedAt?: string;
  galleryPictures?: { [key: string]: ClientGalleryPicture } = {};
  bonus?: string;
  bonusHistory?: { [key: string]: ClientBonusEvent } = {};
  trophyAwards?: { [key: string]: ClientTrophyAward } = {};
  stars?: string;
  requestNotTosend?: string;
  transferStatus?: 'pending' | 'accepted';
  recoveredAwayDebts?: {
    [id: string]: {
      amount: number;
      createdAt: string;
      createdAtISO: string;
      createdById?: string;
      createdByName?: string;
    };
  };
}

export class Comment {
  name?: string;
  time?: string;
  timeFormatted?: string;
  comment?: string;
  stars?: string;
  starsNumber?: number;
  audioUrl?: string;
  source?: string;
  category?: AuditClientCommentTag | string;
  categoryLabel?: string;
  commentType?: AuditClientCommentTag | string;
  tag?: string;
  createdById?: string;
  createdByName?: string;
  investigationDayKey?: string;

  visible?: boolean; // false par défaut

  // ← NOUVEAU : 5 indicateurs (1-10)
  ponctualite?: number;
  proprete?: number;
  cahier?: number;
  suiviClients?: number;
  relationClient?: number;
  attitudeEquipe?: number;
  performance?: number;
  __editingPerf?: boolean;
  __perfDraft?: number;
  __editingComment?: boolean;
  __commentDraft?: string;
  targetUserId?: string;
  targetUserLastName?: string;
  scope?: 'team' | 'individual';

  [key: string]: any;
  // NEW:
  attachments?: ClientCommentAttachment[];
}
