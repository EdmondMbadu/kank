/** A real repayment from the employee ledger, not a client history transfer. */
export interface EmployeeCashPayment {
  id: string;
  ownerUid: string;
  clientUid: string;
  fullName: string;
  dayKey: string;
  amount: number;
  createdAtMs: number;
  source: string;
}
