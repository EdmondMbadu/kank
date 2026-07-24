import { Client } from './client';
import { WeeklyDeductionTargetVersion } from './weekly-deduction-target';
import { WeeklyPaymentTargetPeriod } from './weekly-payment-target';

export class Management {
  id?: string;
  moneyInHands?: string;
  moneyInHandsActivities?: { [key: string]: MoneyInHandsActivity } = {};
  expenses?: { [key: string]: string } = {};
  otherExpenses?: { [key: string]: string } = {};
  fraudes?: { [key: string]: string } = {};
  reserve?: { [key: string]: string } = {};
  investment?: { [key: string]: string } = {};
  moneyGiven?: { [key: string]: string } = {};
  exchangeLoss?: { [key: string]: string } = {};
  dollarTransferLoss?: { [key: string]: string } = {};
  bankDepositDollars?: { [key: string]: string } = {};
  bankDepositFrancs?: { [key: string]: string } = {};
  budgetedExpenses?: { [date: string]: string };
  moneyInHandsTracking?: { [key: string]: string } = {};
  reserveRevealTimeKinshasa?: string;
  notPaidCycleMonthsThreshold?: number;
  notPaidNoPaymentMonthsThreshold?: number;
  weeklyPaymentTargetFc?: number;
  weeklyPaymentTargetPeriods?: WeeklyPaymentTargetPeriod[];
  weeklyDeductionTargetVersions?: WeeklyDeductionTargetVersion[];
  teamWeeklyBonusThresholdFc?: number;
  profitabilityThresholdUsd?: number;
  projectedWeeklyPaymentTargetFc?: number;
  projectedWeeklyPaymentEffectiveDate?: string;
  projectedWeeklyPaymentVisible?: boolean;
  weeklyObjectiveDeductionConfig?: {
    bandFc?: number;
    penaltyPerBandUsd?: number;
    basePenaltyUsd?: number;
  };
  monthlyPaymentSnapshots?: { [monthYear: string]: MonthlyPaymentSnapshot };
  rolePasswords?: {
    admin?: string;
    gestion?: string;
    investigator?: string;
  };
}

export interface MonthlyPaymentSnapshot {
  month: number;
  year: number;
  monthLabel: string;
  createdAt: string;
  createdBy?: string;
  rows: MonthlyPaymentSnapshotRow[];
  totals: MonthlyPaymentSnapshotTotals;
}

export interface MonthlyPaymentSnapshotRow {
  firstName: string;
  expectedFc: number;
  expectedDollar: number;
  totalFc: number;
  totalDollar: number;
  reserveFc: number;
  reserveDollar: number;
  minimumFc: number;
  minimumDollar: number;
  expectedProgressPercent: number;
  expectedProgressTone: 'red' | 'yellow' | 'orange' | 'green';
  reserveExpectedProgressPercent: number;
  reserveExpectedProgressTone: 'red' | 'yellow' | 'orange' | 'green';
  minimumProgressPercent: number;
  minimumProgressTone: 'red' | 'yellow' | 'orange' | 'green';
  minimumStatusLabel: string;
  trackingId: string;
}

export interface MonthlyPaymentSnapshotTotals {
  expectedFc: number;
  expectedDollar: number;
  paymentFc: number;
  paymentDollar: number;
  reserveFc: number;
  reserveDollar: number;
  minimumFc: number;
  minimumDollar: number;
  expectedProgressPercent: number;
  expectedProgressTone: 'red' | 'yellow' | 'orange' | 'green';
  reserveExpectedProgressPercent: number;
  reserveExpectedProgressTone: 'red' | 'yellow' | 'orange' | 'green';
  minimumProgressPercent: number;
  minimumProgressTone: 'red' | 'yellow' | 'orange' | 'green';
}

export interface MoneyInHandsActivity {
  previousAmount: string;
  changeAmount: string;
  newAmount: string;
  source: string;
  action: string;
  direction: 'increase' | 'decrease' | 'adjustment';
  note?: string;
  relatedEntryKey?: string;
  createdBy?: string;
  createdAt?: any;
}

export class Audit {
  id?: string;
  name?: string;
  phoneNumber?: string;
  pendingClients?: PendingClient[];
  profilePicture?: string;
}

export class PendingClient {
  clientName?: string;
  clientPhoneNumber?: string;
  clientLocation?: string;
  clientId?: string;
  clientProfilePicture?: string;
  pendingId?: string;
  dateOfRequest?: string;
  requestDate?: string;
  requestedAt?: string;
  requestCreatedAt?: string;
  assignedAt?: string;
  createdAt?: string;
}

// models/rotation-schedule.ts
export interface RotationCell {
  day?: string; // '2025-06-03'
  employeeUid?: string; // undefined = unassigned
}

export interface RotationSchedule {
  id?: string; // Firestore doc id (auto)
  location?: string; // e.g. 'Kinshasa-North'
  month?: number; // 1-12
  year: number; // 2025
  days?: { [isoDate: string]: string }; // '2025-06-03': 'EMPLOYEE_UID'
  createdAt?: number;
  updatedAt?: number;
}
