import { Injectable } from '@angular/core';
import {
  AngularFirestore,
  AngularFirestoreCollection,
  AngularFirestoreDocument,
} from '@angular/fire/compat/firestore/';
import { LocationCoordinates, User } from '../models/user';
import { Observable } from 'rxjs';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AuthService } from './auth.service';
import { Client, Comment } from '../models/client';
import { TimeService } from './time.service';
import { Avatar, Certificate, Employee } from '../models/employee';
import { ComputationService } from '../shrink/services/computation.service';
import { Card } from '../models/card';
import { WriteBatch } from 'firebase/firestore';
import { Management } from '../models/management';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  constructor(
    private afs: AngularFirestore,
    private storage: AngularFireStorage,
    private auth: AuthService,
    private time: TimeService,
    private compute: ComputationService,
    private router: Router
  ) {}
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  todayFull = this.time.todaysDate();
  url: string = '';
  allowedMimeTypes: string[] = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/webb',
    'image/heic',
    'application/pdf', // Correct MIME type for PDF files
  ];
  clientWithdrawFromSavings(client: Client, amount: string) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const data = {
      savings: client.savings,
      savingsPayments: client.savingsPayments,
      requestAmount: '',
      requestStatus: '',
      requestType: '',
      requestDate: '',
    };

    this.updateUserInfoForClientSavingsWithdrawal(client, amount);
    return clientRef.set(data, { merge: true });
  }
  clientRequestSavingsWithdrawal(client: Client, amount: string) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const data = {
      requestAmount: amount,
      requestStatus: 'pending',
      requestDate: client.requestDate,
      requestType: 'savings',
      dateOfRequest: client.dateOfRequest,
    };

    this.updateUserInfoForClientRequestSavingsWithdrawal(client, amount);
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
  clientDeposit(client: Client, savings: string, date: string) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const data = {
      savings: client.savings,
      savingsPayments: client.savingsPayments,
    };
    this.updateUserInfoForClientDeposit(client, savings, date);
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
      requestAmount: '',
      requestStatus: '',
      requestType: '',
      requestDate: '',
      payments: {},
    };
    return clientCardRef.set(data, { merge: true });
  }
  clientCardRequestReturnMoney(clientCard: Card) {
    const clientCardRef: AngularFirestoreDocument<Card> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/cards/${clientCard.uid}`
    );
    const data = {
      requestAmount: clientCard.requestAmount,
      requestStatus: 'pending',
      requestDate: clientCard.requestDate,
      requestType: 'card',
      dateOfRequest: clientCard.dateOfRequest,
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
      ...(client.vitalStatus !== undefined && {
        vitalStatus: client.vitalStatus,
      }),
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
  updateEmployeeInfoBulk(agentClientMap: { [agentId: string]: string[] }) {
    const batch: any = this.afs.firestore.batch();

    Object.keys(agentClientMap).forEach((agentId) => {
      const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
        `users/${this.auth.currentUser.uid}/employees/${agentId}`
      );

      const data = {
        clients: agentClientMap[agentId],
      };

      // Use .set with { mergeFields: ['clients'] } to update only the clients array
      batch.set(employeeRef.ref, data, { mergeFields: ['clients'] });
    });

    // Commit the batch
    return batch.commit();
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
  updateEmployeeBonusInfo(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );

    const data = {
      bonusAmount: employee.bonusAmount,
      bonusPercentage: employee.bonusPercentage,
      bestTeamBonusAmount: employee.bestTeamBonusAmount,
      bestEmployeeBonusAmount: employee.bestEmployeeBonusAmount,
      bestManagerBonusAmount: employee.bestManagerBonusAmount,
      totalBonusThisMonth: employee.totalBonusThisMonth,
    };

    return employeeRef.set(data, { merge: true });
  }
  updateEmployeePaymentInfo(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );

    const data = {
      paymentAmount: employee.paymentAmount,
      paymentAbsent: employee.paymentAbsent,
      paymentNothing: employee.paymentNothing,
      totalPayments: employee.totalPayments,
    };

    return employeeRef.set(data, { merge: true });
  }

  toggleEmployeeCheckVisibility(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );

    // Toggle the checkVisible value, handling undefined case
    let newVisibility: string;
    if (employee.checkVisible === undefined) {
      newVisibility = 'true';
    } else {
      newVisibility = employee.checkVisible === 'true' ? 'false' : 'true';
    }

    const data = {
      checkVisible: newVisibility,
    };

    return employeeRef.set(data, { merge: true });
  }
  toggleEmployeePaymentCheckVisibility(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );
    let newVisibility: string;
    if (employee.paymentCheckVisible === undefined) {
      newVisibility = 'true';
    } else {
      newVisibility =
        employee.paymentCheckVisible === 'true' ? 'false' : 'true';
    }

    const data = {
      paymentCheckVisible: newVisibility,
    };

    return employeeRef.set(data, { merge: true });
  }
  async updateEmployeeBonusCheckUrl(employee: Employee, url: string) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );

    const data = {
      bonusCheckUrl: url,
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
    return clientRef
      .set(data, { merge: true })
      .then(() => {
        // Explicitly set `savingsPayments` to ensure it is not merged
        clientRef.update({ savingsPayments: client.savingsPayments });
      })
      .catch((error) => console.error('Failed to update client data:', error));
    // return clientRef.set(data, { merge: true });
  }

  registerNewDebtCycle(client: Client) {
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
      profession: client.profession,
      amountPaid: '0',
      type: 'register',
      numberOfPaymentsMissed: '0',
      numberOfPaymentsMade: '0',
      previousPayments: client.previousPayments,
      previousSavingsPayments: client.previousSavingsPayments,
      payments: {},
      amountToPay: '0',
      debtLeft: '0',
      requestAmount: client.requestAmount,
      requestStatus: 'pending',
      requestType: 'lending',
      requestDate: client.requestDate,
      dateOfRequest: client.dateOfRequest,
      applicationFeePayments: client.applicationFeePayments,
      membershipFeePayments: client.membershipFeePayments,
    };
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    return clientRef
      .set(data, { merge: true })
      .then(() => {
        // Explicitly set `savingsPayments` to ensure it is not merged
        clientRef.update({ savingsPayments: client.savingsPayments });
      })
      .catch((error) => console.error('Failed to update client data:', error));
    // return clientRef.set(data, { merge: true });
  }
  public async saveCurrentCycle(client: Client): Promise<void> {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const cycleId = this.afs.createId();

    // Fetch the current client data
    const clientData = await clientRef.ref
      .get()
      .then((doc) => doc.data() as Client);

    if (clientData) {
      const cyclesCollection: AngularFirestoreCollection<any> =
        clientRef.collection('cycles');

      const cycleData = {
        ...clientData,
        debtCycle: clientData.debtCycle,
        cycleId: cycleId,
        // Optionally, remove fields that shouldn't be duplicated
      }; // Or use a timestamp: Date.now().toString()

      // Add a timestamp or cycle number as document ID
      return cyclesCollection.doc(cycleId).set(cycleData);
    } else {
      throw new Error('Client data not found.');
    }
  }
  getClientCycles(clientId: string): Observable<any[]> {
    const cyclesCollection: AngularFirestoreCollection<any> =
      this.afs.collection(
        `users/${this.auth.currentUser.uid}/clients/${clientId}/cycles`,
        (ref) => ref.orderBy('debtCycle', 'desc') // Adjust ordering as needed
      );
    return cyclesCollection.valueChanges({ idField: 'cycleId' });
  }
  getClientCycle(clientId: string, cycleId: string): Observable<any> {
    const cycleDoc: AngularFirestoreDocument<any> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${clientId}/cycles/${cycleId}`
    );
    return cycleDoc.valueChanges();
  }

  registerClientRequestUpdate(client: Client) {
    const data = {
      firstName: client.firstName,
      lastName: client.lastName,
      middleName: client.middleName,
      phoneNumber: client.phoneNumber,
      businessCapital: client.businessCapital,
      homeAddress: client.homeAddress,
      businessAddress: client.businessAddress,
      loanAmount: client.loanAmount,
      profession: client.profession,
      amountPaid: '0',
      type: 'register',
      numberOfPaymentsMissed: '0',
      numberOfPaymentsMade: '0',
      payments: {},
      amountToPay: '0',
      debtLeft: '0',
      requestAmount: client.requestAmount,
      requestStatus: 'pending',
      requestType: 'lending',
      requestDate: client.requestDate,
      dateOfRequest: client.dateOfRequest,
    };
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    return clientRef
      .set(data, { merge: true })
      .then(() => {
        // Explicitly set `savingsPayments` to ensure it is not merged
        clientRef.update({ savingsPayments: client.savingsPayments });
      })
      .catch((error) => console.error('Failed to update client data:', error));
    // return clientRef.set(data, { merge: true });
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
      debtCycle: client.debtCycle,
      loanAmount: client.loanAmount,
      creditScore: client.creditScore,
      amountToPay: client.amountToPay,
      interestRate: client.interestRate,
      paymentDay: client.paymentDay,
      debtCycleStartDate: client.debtCycleStartDate,
      debtCycleEndDate: client.debtCycleEndDate,
      paymentPeriodRange: client.paymentPeriodRange,
      profession: client.profession,
      agent: client.agent,
      amountPaid: '0',
      numberOfPaymentsMissed: '0',
      numberOfPaymentsMade: '0',
      requestAmount: '',
      requestStatus: '',
      requestType: '',
      requestDate: '',
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

  updateManagementInfoForAddToReserve(amount: string) {
    const managementRef: AngularFirestoreDocument<Management> = this.afs.doc(
      `management/${this.auth.managementInfo.id}`
    );
    // let dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const data = {
      moneyInHands: (
        Number(this.auth.managementInfo.moneyInHands) + Number(amount)
      ).toString(),

      reserve: { [this.time.todaysDate()]: amount },
    };

    return managementRef.set(data, { merge: true });
  }

  updateManagementInfoForAddToInvestment(amount: string) {
    const managementRef: AngularFirestoreDocument<Management> = this.afs.doc(
      `management/${this.auth.managementInfo.id}`
    );
    // let dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const data = {
      moneyInHands: (
        Number(this.auth.managementInfo.moneyInHands) + Number(amount)
      ).toString(),

      investment: { [this.time.todaysDate()]: amount },
    };

    return managementRef.set(data, { merge: true });
  }

  updateManagementInfoForMoneyGiven(amount: string) {
    console.log('data from management', this.auth.managementInfo);
    const managementRef: AngularFirestoreDocument<Management> = this.afs.doc(
      `management/${this.auth.managementInfo.id}`
    );
    // let dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const data = {
      moneyInHands: (
        Number(this.auth.managementInfo.moneyInHands) - Number(amount)
      ).toString(),

      moneyGiven: { [this.time.todaysDate()]: amount },
    };

    return managementRef.set(data, { merge: true });
  }
  updateManagementInfoToAddMoneyInTheBank(
    amountFrancs: string,
    amountDollars: string,
    loss: string
  ) {
    console.log('data from management', this.auth.managementInfo);
    const managementRef: AngularFirestoreDocument<Management> = this.afs.doc(
      `management/${this.auth.managementInfo.id}`
    );
    // let dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const data = {
      moneyInHands: (
        Number(this.auth.managementInfo.moneyInHands) - Number(amountFrancs)
      ).toString(),

      bankDepositDollars: { [this.time.todaysDate()]: amountDollars },
      bankDepositFrancs: { [this.time.todaysDate()]: amountFrancs },
      dollarTransferLoss: { [this.time.todaysDate()]: loss },
    };

    return managementRef.set(data, { merge: true });
  }
  updateManagementInfoForMoneyLoss(amount: string) {
    console.log('data from management', this.auth.managementInfo);
    const managementRef: AngularFirestoreDocument<Management> = this.afs.doc(
      `management/${this.auth.managementInfo.id}`
    );
    // let dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const data = {
      moneyInHands: (
        Number(this.auth.managementInfo.moneyInHands) - Number(amount)
      ).toString(),

      exchangeLoss: { [this.time.todaysDate()]: amount },
    };

    return managementRef.set(data, { merge: true });
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

  updateUserInfoForAddLoss(amount: string, reason: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) - Number(amount)
      ).toString(),

      losses: { [this.time.todaysDate()]: `${amount}:${reason}` },
    };

    return userRef.set(data, { merge: true });
  }
  updateManagementInfoForAddExpense(amount: string, reason: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `management/${this.auth.managementInfo.id}`
    );
    const data = {
      moneyInHands: (
        Number(this.auth.managementInfo.moneyInHands) - Number(amount)
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
  updateClientPictureData(client: Client, avatar: Avatar) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const data = {
      profilePicture: avatar,
    };
    return employeeRef.set(data, { merge: true });
  }
  addCommentToClientProfile(client: Client, comments: Comment[]) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const data = {
      comments: comments,
    };
    return clientRef.set(data, { merge: true });
  }
  updateEmployeeAttendance(attendance: any, employeeId: string) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employeeId}`
    );
    const data = {
      attendance: attendance,
    };
    return employeeRef.set(data, { merge: true });
  }
  // In your data service (e.g., data.service.ts)
  updateEmployeeAttendanceForUser(
    attendance: any,
    employeeId: string,
    userId: string
  ) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${userId}/employees/${employeeId}`
    );
    const data = { attendance: attendance };
    return employeeRef.set(data, { merge: true });
  }

  updateEmployeeAttendanceRejection(attendance: any, employeeId: string) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employeeId}`
    );

    // Use update instead of set
    return employeeRef
      .update({ attendance })
      .then(() => {
        console.log('Attendance successfully updated in the database.');
      })
      .catch((error) => {
        console.error('Error updating attendance in the database:', error);
      });
  }
  updateEmployeeNumberOfVacationRequest(vR: string, employeeId: string) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employeeId}`
    );
    const data = {
      vacationRequestNumberOfDays: vR,
    };
    return employeeRef.set(data, { merge: true });
  }
  updateEmployeeNumberOfAcceptedVacation(vA: string, employeeId: string) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employeeId}`
    );
    const data = {
      vacationAcceptedNumberOfDays: vA,
    };
    return employeeRef.set(data, { merge: true });
  }

  addCertificateData(certificate: Certificate[], certificateId: string) {
    const certificateref: AngularFirestoreDocument<any> = this.afs.doc(
      `certificate/${certificateId}`
    );
    const data = {
      certificate: certificate,
    };
    return certificateref.set(data, { merge: true });
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
  updateEmployeePaymentCode(employee: Employee) {
    // Implement the logic to update the employee's payment code
    // For example, you might send a request to a server
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );
    const data = {
      paymentCode: employee.paymentCode,
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

  updateUserInfoForClientCardRequestReturnMoney(
    amountToGiveBack: string,
    client: Card
  ) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    let request: any = this.computeDailyMoneyRequests(
      client.requestDate!,
      amountToGiveBack
    );

    const data = {
      dailyMoneyRequests: {
        [client.requestDate!]: `${request}`,
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
    let save: any = this.computeDailySaving(date, savings);
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
      dailySaving: {
        [date]: `${save}`,
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
  updateUserInfoForClientDeposit(
    client: Client,
    savings: string,
    date: string
  ) {
    let save: any = this.computeDailySaving(date, savings);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );

    const data = {
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) + Number(savings)
      ).toString(),

      dailySaving: {
        [date]: `${save}`,
      },
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) + Number(savings)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }

  updateUserInfoForClientRequestSavingsWithdrawal(
    client: Client,
    withdrawal: string
  ) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    let request: any = this.computeDailyMoneyRequests(
      client.requestDate!,
      withdrawal
    );

    const data = {
      dailyMoneyRequests: {
        [client.requestDate!]: `${request}`,
      },
    };
    return userRef.set(data, { merge: true });
  }

  updateClientCreditScoreBulk(clients: Client[]) {
    const batch: any = this.afs.firestore.batch();

    clients.forEach((client) => {
      const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
        `users/${this.auth.currentUser.uid}/clients/${client.uid}`
      );
      const data = {
        creditScore: '50',
      };
      batch.set(clientRef.ref, data, { merge: true });
    });

    return batch
      .commit()
      .then(() => {
        console.log('Batch update successful');
      })
      .catch((error: any) => {
        console.error('Batch update failed: ', error);
      });
  }
  updateUserInfoForClientSavingsWithdrawal(client: Client, withdrawal: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    let date = this.time.todaysDateMonthDayYear();
    // sdd tje minus to mark withdrawal
    let save: any = this.computeDailySavingReturn(date, `${withdrawal}`);
    const data = {
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) - Number(withdrawal)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) - Number(withdrawal)
      ).toString(),
      dailySavingReturns: {
        [date]: `${save}`,
      },
    };
    return userRef.set(data, { merge: true });
  }

  UpdateUserInfoForCancelingdRegisteredClient(client: Client) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    let date = this.time.todaysDateMonthDayYear();
    let save: any = this.computeDailySavingReturn(date, `${client.savings}`);
    let total: number =
      Number(client.applicationFee) +
      Number(client.membershipFee) +
      Number(client.savings);
    let totalFees: number =
      Number(client.applicationFee) + Number(client.membershipFee);
    let Total = this.computeDailyFeesReturn(date, totalFees.toString());
    const data = {
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) - total
      ).toString(),
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) - Number(client.savings)
      ).toString(),
      fees: (
        Number(this.auth.currentUser.fees) -
        (Number(client.applicationFee) + Number(client.membershipFee))
      ).toString(),
      dailySavingReturns: {
        [date]: `${save}`,
      },
      monthBudgetPending: (
        Number(this.auth.currentUser.monthBudgetPending) -
        Number(client.requestAmount)
      ).toString(),
      dailyFeesReturns: {
        [date]: `${Total}`,
      },
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
    let save: any = this.computeDailySaving(date, savings);
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
        Number(savings) +
        Number(client.applicationFee) -
        Number(client.loanAmount)
      ).toString(),
      projectedRevenue: (
        Number(this.auth.currentUser.projectedRevenue) +
        Number(client.amountToPay)
      ).toString(),
      dailyLending: { [date]: `${dailyLending}` },
      dailySaving: {
        [date]: `${save}`,
      },
      feesData: { [date]: `${dailyFees}` },
      totalDebtLeft: (
        Number(this.auth.currentUser.totalDebtLeft) + Number(client.amountToPay)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }

  updateUserInfoForRegisterClientNewDebtCycle(
    client: Client,
    savings: string,
    date: string
  ) {
    console.log(' the savings being added', savings);
    let dailyFees: any = this.computeDailyFees(client, date);
    let save: any = this.computeDailySaving(date, savings);
    let request: any = this.computeDailyMoneyRequests(
      client.requestDate!,
      client.requestAmount!
    );
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
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
        Number(savings) +
        Number(client.applicationFee)
      ).toString(),
      dailySaving: {
        [date]: `${save}`,
      },
      dailyMoneyRequests: {
        [client.requestDate!]: `${request}`,
      },
      monthBudgetPending: (
        Number(this.auth.currentUser.monthBudgetPending) +
        Number(client.requestAmount)
      ).toString(),

      feesData: { [date]: `${dailyFees}` },
    };
    return userRef.set(data, { merge: true });
  }

  updateUserInfoForRegisterClientRequestUpdate(
    client: Client,
    savings: string,
    date: string
  ) {
    let dailyFees: any = this.computeDailyFees(client, date);
    let save: any = this.computeDailySaving(date, savings);
    let request: any = this.computeDailyMoneyRequests(
      client.requestDate!,
      client.requestAmount!
    );
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      dailyMoneyRequests: {
        [client.requestDate!]: `${request}`,
      },
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
      monthBudget: (
        Number(this.auth.currentUser.monthBudget) - Number(client.loanAmount)
      ).toString(),
      monthBudgetPending: (
        Number(this.auth.currentUser.monthBudgetPending) -
        Number(client.requestAmount)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }

  updateUserInfoForNewClient(client: Client, date: string) {
    let dailyLending: any = this.computeDailyLending(client, date);
    let dailyFees: any = this.computeDailyFees(client, date);
    let save: any = this.computeDailySaving(date, client.savings!);
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
      dailySaving: {
        [date]: `${save}`,
      },
      feesData: { [date]: `${dailyFees}` },
      totalDebtLeft: (
        Number(this.auth.currentUser.totalDebtLeft) + Number(client.amountToPay)
      ).toString(),
    };

    return userRef.set(data, { merge: true });
  }

  updateUserInfoForNewClientSavings(client: Client, date: string) {
    let dailyFees: any = this.computeDailyFees(client, date);
    let save: any = this.computeDailySaving(date, client.savings!);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      numberOfClients: (
        Number(this.auth.currentUser.numberOfClients) + 1
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
        Number(client.applicationFee)
      ).toString(),
      projectedRevenue: (
        Number(this.auth.currentUser.projectedRevenue) +
        Number(client.amountToPay)
      ).toString(),
      dailySaving: {
        [date]: `${save}`,
      },
      feesData: { [date]: `${dailyFees}` },
    };

    return userRef.set(data, { merge: true });
  }

  updateUserInfoForRegisterClient(client: Client, date: string) {
    // let dailyLending: any = this.computeDailyLending(client, date);
    let dailyFees: any = this.computeDailyFees(client, date);
    let save: any = this.computeDailySaving(date, client.savings!);
    let request: any = this.computeDailyMoneyRequests(
      client.requestDate!,
      client.requestAmount!
    );
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      numberOfClients: (
        Number(this.auth.currentUser.numberOfClients) + 1
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
        Number(client.applicationFee)
      ).toString(),
      dailySaving: {
        [date]: `${save}`,
      },
      dailyMoneyRequests: {
        [client.requestDate!]: `${request}`,
      },
      monthBudgetPending: (
        Number(this.auth.currentUser.monthBudgetPending) +
        Number(client.requestAmount)
      ).toString(),

      // dailyLending: { [date]: `${dailyLending}` },
      feesData: { [date]: `${dailyFees}` },
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
    const amount = (1 + Number(interestRate) * 0.01) * Number(loanAmount);
    // Round to the nearest whole number
    const roundedAmount = Math.round(amount);

    return roundedAmount.toString();
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
  computeDailySaving(date: string, saving: string) {
    let save: any = '';
    if (this.auth.currentUser.dailySaving[`${date}`] === undefined) {
      save = saving;
    } else {
      save =
        Number(this.auth.currentUser.dailySaving[`${date}`]) + Number(saving);
    }
    return save;
  }
  computeDailySavingReturn(date: string, saving: string) {
    let save: any = '';
    if (this.auth.currentUser.dailySavingReturns[`${date}`] === undefined) {
      save = saving;
    } else {
      save =
        Number(this.auth.currentUser.dailySavingReturns[`${date}`]) +
        Number(saving);
    }
    return save;
  }
  computeDailyFeesReturn(date: string, total: string) {
    let Total: any = '';
    if (this.auth.currentUser.dailyFeesReturns[`${date}`] === undefined) {
      Total = total;
    } else {
      Total =
        Number(this.auth.currentUser.dailyFeesReturns[`${date}`]) +
        Number(total);
    }
    return Total;
  }
  computeDailyMoneyRequests(date: string, request: string) {
    let mRequest: any = '';
    if (this.auth.currentUser.dailyMoneyRequests[`${date}`] === undefined) {
      mRequest = request;
    } else {
      mRequest =
        Number(this.auth.currentUser.dailyMoneyRequests[`${date}`]) +
        Number(request);
    }
    return mRequest;
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
  removeDuplicates(payments: any[]): any[] {
    const uniquePayments = payments.filter(
      (value, index, self) =>
        index ===
        self.findIndex(
          (t) =>
            t.trackingId === value.trackingId &&
            t.amount === value.amount &&
            t.time === value.time
        )
    );
    return uniquePayments;
  }
  setLocation(location: LocationCoordinates) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      locationCoordinates: location,
    };
    return userRef.set(data, { merge: true });
  }
  didClientStartThisWeek(client: Client) {
    const convertToDateCompatibleFormat = (dateStr: string) => {
      const [month, day, year] = dateStr.split('-');
      return `${year}/${month}/${day}`;
    };

    const oneWeekAgo = new Date();
    // watch out for this one. I am not sure. whether it is 7 so I put 6 just in case.
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);

    const formattedDebtCycleStartDate = convertToDateCompatibleFormat(
      client.debtCycleStartDate!
    );
    const debtCycleStartDate = new Date(formattedDebtCycleStartDate);

    if (debtCycleStartDate > oneWeekAgo) {
      return false;
    }

    return true;
  }

  async startUpload(
    event: FileList,
    currentPath: string,
    employeeId: string,
    field: string
  ) {
    const file = event?.item(0);
    console.log(' current file data', file);

    if (file) {
      if (!this.allowedMimeTypes.includes(file.type)) {
        console.log('unsupported file type');
        return;
      }

      // Proceed with file processing
      console.log('File is supported:', file);
      // Your file handling logic here
      if (file?.size >= 10000000) {
        console.log('the file is too big');
        alert('The picture is too big. It should be less than 5MB');
        return;
      }
    }
    // the file should not be larger than 10MB

    const path = currentPath;

    // the main task
    console.log('the path', path);

    // this.task = await this.storage.upload(path, file);
    const uploadTask = await this.storage.upload(path, file);
    this.url = await uploadTask.ref.getDownloadURL();
    uploadTask.totalBytes;
    // console.log('the download url', this.url);
    const avatar = {
      path: path,
      downloadURL: this.url,
      size: uploadTask.totalBytes.toString(),
    };

    await this.updateEmployeeField(employeeId, field, this.url);
    this.router.navigate(['/home']);
    return this.url;
  }

  updateEmployeeField(employeeId: string, field: string, value: any) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employeeId}`
    );

    const data = {
      [field]: value, // Dynamically set the field and value
    };

    return employeeRef.set(data, { merge: true });
  }
}
