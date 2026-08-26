export type RemainingLoanMonthEndStatus = 'final' | 'reconstructed';

export interface RemainingLoanMonthEndSite {
  ownerUid: string;
  siteName: string;
  debtLeftFc: number;
  activeClientCount: number;
  sharePercent: number;
  previousClosingFc?: number;
  growthPercent?: number | null;
}

export interface RemainingLoanMonthEndSnapshot {
  periodKey: string;
  month: number;
  year: number;
  status: RemainingLoanMonthEndStatus;
  timeZone: 'Africa/Kinshasa';
  closingDate: string;
  capturedAt?: unknown;
  definitionVersion: string;
  totalDebtLeftFc: number;
  activeClientCount: number;
  siteCount: number;
  previousClosingFc?: number;
  growthPercent?: number | null;
  duplicateClientCount?: number;
  clientDocumentCount?: number;
  sites: RemainingLoanMonthEndSite[];
}
