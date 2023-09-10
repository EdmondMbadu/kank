import { Injectable } from '@angular/core';
import {
  AngularFirestore,
  AngularFirestoreCollection,
  AngularFirestoreDocument,
} from '@angular/fire/compat/firestore/';
import { User } from '../models/user';
import { Observable } from 'rxjs';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AuthService } from './auth.service';
import { Client } from '../models/client';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  constructor(private afs: AngularFirestore, private auth: AuthService) {}

  clientWithdrawFromSavings(client: Client, amount: string) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const data = {
      savings: client.savings,
      savingsPayments: client.savingsPayments,
    };
    this.updateUserInfoForClientSavingsWithdrawal(client, amount);
    return clientRef.set(data, { merge: true });
  }
  clientPayment(client: Client, savings: string) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const data = {
      amountPaid: client.amountPaid,
      creditScore: client.creditScore,
      numberOfPaymentsMade: client.numberOfPaymentsMade,
      numberOfPaymentsMissed: client.numberOfPaymentsMissed,
      payments: client.payments,
      savings: client.savings,
      savingsPayments: client.savingsPayments,
      debtLeft: client.debtLeft,
    };
    this.updateUserInfoForClientPayment(client, savings);
    return clientRef.set(data, { merge: true });
  }

  initiateNewDebtCycle(client: Client) {
    const data = {
      firstName: client.firstName,
      lastName: client.lastName,
      phoneNumber: client.phoneNumber,
      businessCapital: client.businessCapital,
      homeAddress: client.homeAddress,
      businessAddress: client.businessAddress,
      debtCycle: (Number(client.debtCycle) + 1).toString(),
      membershipFee: client.membershipFee,
      applicationFee: client.applicationFee,
      savings: client.savings,
      loanAmount: client.loanAmount,
      creditScore: client.creditScore,
      amountToPay: client.amountToPay,
      interestRate: client.interestRate,
      debtCycleStartDate: client.debtCycleStartDate,
      debtCycleEndDate: client.debtCycleEndDate,
      paymentPeriodRange: client.paymentPeriodRange,
      profession: client.profession,
      amountPaid: '0',
      numberOfPaymentsMissed: '0',
      numberOfPaymentsMade: '0',
      payments: {},
      debtLeft: client.amountToPay,
    };
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    return clientRef.set(data, { merge: true });
  }
  updateUserInfoForClientPayment(client: Client, savings: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) + Number(savings)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }
  updateUserInfoForClientSavingsWithdrawal(client: Client, withdrawal: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) - Number(withdrawal)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }
  updateUserInfoForClientNewDebtCycle(client: Client, savings: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      amountLended: (
        Number(this.auth.currentUser.amountLended) + Number(client.loanAmount!)
      ).toString(),
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) + Number(savings)
      ).toString(),
      fees: (
        Number(this.auth.currentUser.fees) +
        Number(client.membershipFee) +
        Number(client.applicationFee)
      ).toString(),
      projectedRevenue: (
        Number(this.auth.currentUser.projectedRevenue) +
        Number(client.amountToPay)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }

  computeAmountToPay(interestRate: string, loanAmount: string) {
    const amount = (
      (1 + Number(interestRate) * 0.01) *
      Number(loanAmount)
    ).toString();

    return amount;
  }
}
