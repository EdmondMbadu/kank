import { Client } from './client';

export class Management {
  id?: string;
  moneyInHands?: string;
  expenses?: { [key: string]: string } = {};
  reserve?: { [key: string]: string } = {};
  investment?: { [key: string]: string } = {};
  moneyGiven?: { [key: string]: string } = {};
  exchangeLoss?: { [key: string]: string } = {};
  dollarTransferLoss?: { [key: string]: string } = {};
  bankDepositDollars?: { [key: string]: string } = {};
  bankDepositFrancs?: { [key: string]: string } = {};
  budgetedExpenses?: { [date: string]: string };
  moneyInHandsTracking?: { [key: string]: string } = {};
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
