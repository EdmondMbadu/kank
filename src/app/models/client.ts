export interface Client {
  id?: number;
  name?: string;
  phone?: string;
  creditScore?: string;
  amountBorrowed?: string;
  amountPaid?: string;
  dateJoined?: string;
  numberofPaymentMissed?: string;
  numberofPaymentMade?: string;
  payments?: string[];
}
