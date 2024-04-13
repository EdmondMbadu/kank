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
import { Card } from '../models/card';

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
  todayFull = this.time.todaysDate();
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
  clientCardPayment(clientCard: Card) {
    const clientCardRef: AngularFirestoreDocument<Card> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/cards/${clientCard.uid}`
    );
    const data = {
      amountPaid: clientCard.amountPaid,
      numberOfPaymentsMade: clientCard.numberOfPaymentsMade,
      payments: clientCard.payments,
    };
    return clientCardRef.set(data, { merge: true });
  }
  clientCardReturnMoney(clientCard: Card) {
    const clientCardRef: AngularFirestoreDocument<Card> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/cards/${clientCard.uid}`
    );
    const data = {
      amountPaid: clientCard.amountPaid,
      withdrawal: clientCard.withdrawal,
      clientCardStatus: 'ended',
      payments: {},
    };
    return clientCardRef.set(data, { merge: true });
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

  transformRegisterClientToFullClient(client: Client) {
    const data = {
      firstName: client.firstName,
      lastName: client.lastName,
      middleName: client.middleName,
      phoneNumber: client.phoneNumber,
      businessCapital: client.businessCapital,
      homeAddress: client.homeAddress,
      businessAddress: client.businessAddress,
      debtCycle: '1',
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
      type: '',
      debtLeft: client.amountToPay,
    };
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    return clientRef.set(data, { merge: true });
  }

  updateUserInfoForAddInvestment(amount: string) {
    let dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      amountInvestedDollars: (
        Number(this.auth.currentUser.amountInvestedDollars) + Number(dollar)
      ).toString(),
      amountInvested: (
        Number(this.auth.currentUser.amountInvested) + Number(amount)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) + Number(amount)
      ).toString(),
      investments: { [this.time.todaysDate()]: amount },
      investmentsDollar: { [this.time.todaysDate()]: dollar.toString() },
    };

    return userRef.set(data, { merge: true });
  }

  updateUserInfoForAddToReserve(amount: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    let dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const data = {
      reserveAmount: (
        Number(this.auth.currentUser.reserveAmount) + Number(amount)
      ).toString(),
      reserveAmountDollar: (
        Number(this.auth.currentUser.reserveAmountDollar) + Number(dollar)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) - Number(amount)
      ).toString(),

      reserve: { [this.time.todaysDate()]: amount },
      reserveinDollar: { [this.time.todaysDate()]: dollar.toString() },
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
  updateEmployeePaymentPictureData(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );
    console.log(
      'current picture path being added to database',
      employee.paymentsPicturePath
    );
    const data = {
      paymentsPicturePath: employee.paymentsPicturePath,
    };
    return employeeRef.set(data, { merge: true });
  }
  addPaymentToEmployee(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );

    const data = {
      payments: {
        [this.todayFull]: `${employee.salaryPaid}`,
      },
    };
    return employeeRef.set(data, { merge: true });
  }

  updateUserInfoForClientCardPayment(deposit: string) {
    let date = this.time.todaysDateMonthDayYear();
    let depot: any = this.computeDailyCardPayments(date, deposit);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );

    const data = {
      cardsMoney: (
        Number(this.auth.currentUser.cardsMoney) + Number(deposit)
      ).toString(),
      dailyCardPayments: {
        [date]: `${depot}`,
      },
    };
    return userRef.set(data, { merge: true });
  }
  updateUserInfoForClientCardReturnMoney(amountToGiveBack: string) {
    let date = this.time.todaysDateMonthDayYear();
    let depot: any = this.computeDailyCardReturns(date, amountToGiveBack);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );

    const data = {
      cardsMoney: (
        Number(this.auth.currentUser.cardsMoney) - Number(amountToGiveBack)
      ).toString(),
      dailyCardReturns: {
        [date]: `${depot}`,
      },
    };
    return userRef.set(data, { merge: true });
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
    let dailyFees: any = this.computeDailyFees(client, date);
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
      feesData: { [date]: `${dailyFees}` },
      totalDebtLeft: (
        Number(this.auth.currentUser.totalDebtLeft) + Number(client.amountToPay)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }

  updateUserInforForRegisterClientToFullClient(client: Client, date: string) {
    let dailyLending: any = this.computeDailyLending(client, date);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      amountLended: (
        Number(this.auth.currentUser.amountLended) + Number(client.loanAmount!)
      ).toString(),

      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) - Number(client.loanAmount)
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
    let dailyFees: any = this.computeDailyFees(client, date);
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
      feesData: { [date]: `${dailyFees}` },
      totalDebtLeft: (
        Number(this.auth.currentUser.totalDebtLeft) + Number(client.amountToPay)
      ).toString(),
    };

    return userRef.set(data, { merge: true });
  }

  updateUserInfoForRegisterClient(client: Client, date: string) {
    // let dailyLending: any = this.computeDailyLending(client, date);
    let dailyFees: any = this.computeDailyFees(client, date);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      numberOfClients: (
        Number(this.auth.currentUser.numberOfClients) + 1
      ).toString(),
      // amountLended: (
      //   Number(this.auth.currentUser.amountLended) + Number(client.loanAmount!)
      // ).toString(),
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
        Number(client.applicationFee)
      ).toString(),
      // projectedRevenue: (
      //   Number(this.auth.currentUser.projectedRevenue) +
      //   Number(client.amountToPay)
      // ).toString(),
      // dailyLending: { [date]: `${dailyLending}` },
      feesData: { [date]: `${dailyFees}` },
      // totalDebtLeft: (
      //   Number(this.auth.currentUser.totalDebtLeft) + Number(client.amountToPay)
      // ).toString(),
    };

    return userRef.set(data, { merge: true });
  }

  updateUserInfoForNewCardClient(card: Card) {
    let date = this.time.todaysDateMonthDayYear();
    let depot: any = this.computeDailyCardPayments(date, card.amountToPay!);
    let benefit: any = this.computeDailyCardBenefits(date, card.amountToPay!);
    let cMoney =
      this.auth.currentUser.cardsMoney === undefined
        ? '0'
        : this.auth.currentUser.cardsMoney;
    let cClients =
      this.auth.currentUser.numberOfCardClients === undefined
        ? '0'
        : this.auth.currentUser.numberOfCardClients;
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );

    const data = {
      numberOfCardClients: (Number(cClients) + 1).toString(),
      dailyCardPayments: { [date]: `${depot}` },
      dailyCardBenefits: { [date]: `${benefit}` },
      cardsMoney: (Number(cMoney) + Number(card.amountPaidToday)).toString(),
    };

    return userRef.set(data, { merge: true });
  }

  updateUserInfoForNewCardCycleClient(card: Card) {
    let date = this.time.todaysDateMonthDayYear();
    let depot: any = this.computeDailyCardPayments(date, card.amountToPay!);
    let benefit: any = this.computeDailyCardBenefits(date, card.amountToPay!);
    let cMoney =
      this.auth.currentUser.cardsMoney === undefined
        ? '0'
        : this.auth.currentUser.cardsMoney;

    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    console.log('cmoney, ', cMoney);
    console.log('amount paid today', card.amountToPay);
    const data = {
      dailyCardPayments: { [date]: `${depot}` },
      cardsMoney: (Number(cMoney) + Number(card.amountToPay)).toString(),
      dailyCardBenefits: { [date]: `${benefit}` },
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
  computeDailyCardPayments(date: string, payment: string) {
    let deposit: any = '';
    if (
      this.auth.currentUser.dailyCardPayments === undefined ||
      this.auth.currentUser.dailyCardPayments[`${date}`] === undefined
    ) {
      deposit = payment;
    } else {
      deposit =
        Number(this.auth.currentUser.dailyCardPayments[`${date}`]) +
        Number(payment);
    }
    return deposit;
  }
  computeDailyCardBenefits(date: string, payment: string) {
    let benefit: any = '';
    if (
      this.auth.currentUser.dailyCardBenefits === undefined ||
      this.auth.currentUser.dailyCardBenefits[`${date}`] === undefined
    ) {
      benefit = payment;
    } else {
      benefit =
        Number(this.auth.currentUser.dailyCardBenefits[`${date}`]) +
        Number(payment);
    }
    return benefit;
  }
  computeDailyCardReturns(date: string, payment: string) {
    let pReturn: any = '';
    if (
      this.auth.currentUser.dailyCardReturns === undefined ||
      this.auth.currentUser.dailyCardReturns[`${date}`] === undefined
    ) {
      pReturn = payment;
    } else {
      pReturn =
        Number(this.auth.currentUser.dailyCardReturns[`${date}`]) +
        Number(payment);
    }
    return pReturn;
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
  computeDailyFees(client: Client, date: string) {
    let fees: any = '';
    if (this.auth.currentUser.feesData[`${date}`] === undefined) {
      fees = Number(client.membershipFee) + Number(client.applicationFee);
    } else {
      fees =
        Number(this.auth.currentUser.feesData[`${date}`]) +
        Number(client.membershipFee) +
        Number(client.applicationFee);
    }
    return fees;
  }

  numbersValid(...args: string[]): boolean {
    // Check if any of the arguments is not a number or is a negative number
    for (const arg of args) {
      const num = Number(arg);
      if (isNaN(num) || num < 0) {
        return false;
      }
    }

    // If none of the arguments is invalid, return true
    return true;
  }
}
