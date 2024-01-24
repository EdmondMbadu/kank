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
import { TimeService } from './time.service';
import { Avatar, Employee } from '../models/employee';
import { ComputationService } from './computation.service';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  constructor(
    private afs: AngularFirestore,
    private auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}

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
  clientPayment(
    client: Client,
    savings: string,
    date: string,
    payment: string
  ) {
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
    this.updateUserInfoForClientPayment(client, savings, date, payment);
    return clientRef.set(data, { merge: true });
  }

  updateClientInfo(client: Client) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );

    const data = {
      firstName: client.firstName,
      lastName: client.lastName,
      middleName: client.middleName,
      phoneNumber: client.phoneNumber,
      businessAddress: client.businessAddress,
      homeAddress: client.homeAddress,
      profession: client.profession,
      paymentDay: client.paymentDay,
      agent: client.agent,
    };

    return clientRef.set(data, { merge: true });
  }

  updateEmployeeInfoForClientAgentAssignment(agent: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${agent.uid}`
    );

    const data = {
      clients: agent.clients,
    };

    return employeeRef.set(data, { merge: true });
  }

  updateEmployeeInfo(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );

    const data = {
      firstName: employee.firstName,
      lastName: employee.lastName,
      middleName: employee.middleName,
      phoneNumber: employee.phoneNumber,
      dateJoined: employee.dateJoined,
      sex: employee.sex,
      dateOfBirth: employee.dateOfBirth,
      status: employee.status,
      role: employee.role,
    };

    return employeeRef.set(data, { merge: true });
  }

  initiateNewDebtCycle(client: Client) {
    const data = {
      firstName: client.firstName,
      lastName: client.lastName,
      middleName: client.middleName,
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
      agent: client.agent,
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

  updateUserInfoForAddInvestment(amount: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      amountInvested: (
        Number(this.auth.currentUser.amountInvested) + Number(amount)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) + Number(amount)
      ).toString(),
      investments: { [this.time.todaysDate()]: amount },
    };

    return userRef.set(data, { merge: true });
  }

  updateUserInfoForAddToReserve(amount: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    let amountInDollars = this.compute
      .convertCongoleseFrancToUsDollars(amount)
      .toString();
    const data = {
      reserveAmount: (
        Number(this.auth.currentUser.reserveAmount) + Number(amount)
      ).toString(),
      reserveAmountDollar: (
        Number(this.auth.currentUser.reserveAmountDollar) +
        Number(amountInDollars)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) - Number(amount)
      ).toString(),

      reserve: { [this.time.todaysDate()]: amount },
    };

    return userRef.set(data, { merge: true });
  }
  updateUserInfoForAddExpense(amount: string, reason: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      expensesAmount: (
        Number(this.auth.currentUser.expensesAmount) + Number(amount)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) - Number(amount)
      ).toString(),

      expenses: { [this.time.todaysDate()]: `${amount}:${reason}` },
    };

    return userRef.set(data, { merge: true });
  }

  updateEmployeePictureData(employee: Employee, avatar: Avatar) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );
    const data = {
      profilePicture: avatar,
    };
    return employeeRef.set(data, { merge: true });
  }

  updateUserInfoForClientPayment(
    client: Client,
    savings: string,
    date: string,
    payment: string
  ) {
    let reimburse: any = this.computeDailyReimbursement(date, payment);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );

    const data = {
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) + Number(savings)
      ).toString(),
      dailyReimbursement: {
        [date]: `${reimburse}`,
      },
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) +
        Number(savings) +
        Number(payment)
      ).toString(),
      totalDebtLeft: (
        Number(this.auth.currentUser.totalDebtLeft) - Number(payment)
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
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) - Number(withdrawal)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }
  updateUserInfoForClientNewDebtCycle(
    client: Client,
    savings: string,
    date: string
  ) {
    let dailyLending: any = this.computeDailyLending(client, date);
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
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) +
        Number(client.membershipFee) +
        Number(client.savings) +
        Number(client.applicationFee) -
        Number(client.loanAmount)
      ).toString(),
      projectedRevenue: (
        Number(this.auth.currentUser.projectedRevenue) +
        Number(client.amountToPay)
      ).toString(),
      dailyLending: { [date]: `${dailyLending}` },
      totalDebtLeft: (
        Number(this.auth.currentUser.totalDebtLeft) + Number(client.amountToPay)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }

  updateUserInfoForNewClient(client: Client, date: string) {
    let dailyLending: any = this.computeDailyLending(client, date);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      numberOfClients: (
        Number(this.auth.currentUser.numberOfClients) + 1
      ).toString(),
      amountLended: (
        Number(this.auth.currentUser.amountLended) + Number(client.loanAmount!)
      ).toString(),
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) + Number(client.savings)
      ).toString(),
      fees: (
        Number(this.auth.currentUser.fees) +
        Number(client.membershipFee) +
        Number(client.applicationFee)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) +
        Number(client.membershipFee) +
        Number(client.savings) +
        Number(client.applicationFee) -
        Number(client.loanAmount)
      ).toString(),
      projectedRevenue: (
        Number(this.auth.currentUser.projectedRevenue) +
        Number(client.amountToPay)
      ).toString(),
      dailyLending: { [date]: `${dailyLending}` },
      totalDebtLeft: (
        Number(this.auth.currentUser.totalDebtLeft) + Number(client.amountToPay)
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

  computeDailyReimbursement(date: string, payment: string) {
    let reimburse: any = '';
    if (this.auth.currentUser.dailyReimbursement[`${date}`] === undefined) {
      reimburse = payment;
    } else {
      reimburse =
        Number(this.auth.currentUser.dailyReimbursement[`${date}`]) +
        Number(payment);
    }
    return reimburse;
  }

  computeDailyLending(client: Client, date: string) {
    let lending: any = '';
    if (this.auth.currentUser.dailyLending[`${date}`] === undefined) {
      lending = client.loanAmount;
    } else {
      lending =
        Number(this.auth.currentUser.dailyLending[`${date}`]) +
        Number(client.loanAmount);
    }
    return lending;
  }

  numbersValid(a: string, b: string, c: string, d: string): boolean {
    if (
      isNaN(Number(a)) ||
      isNaN(Number(b)) ||
      isNaN(Number(c)) ||
      isNaN(Number(d))
    ) {
      return false;
    } else if (
      Number(a) < 0 ||
      Number(b) < 0 ||
      Number(c) < 0 ||
      Number(d) < 0
    ) {
      return false;
    } else {
      return true;
    }
  }
}
