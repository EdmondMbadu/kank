import { Injectable, inject } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Route, Router } from '@angular/router';
import { Firestore, collectionData, collection } from '@angular/fire/firestore';
import { Auth, idToken } from '@angular/fire/auth';
import {
  AngularFirestore,
  AngularFirestoreCollection,
  AngularFirestoreDocument,
} from '@angular/fire/compat/firestore';
import { Observable, of } from 'rxjs';
import { filter, map, switchMap, take, tap } from 'rxjs/operators';
import { User } from '../models/user';
import { Client } from '../models/client';
import { Timestamp } from 'firebase/firestore';
import { TimeService } from './time.service';
import { ComputationService } from './computation.service';
import { Employee } from '../models/employee';
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  user$: Observable<any>;
  clientsRef$: Observable<any>;
  employeesRef$: Observable<any>;
  email?: Observable<any>;
  currentUser: any = {};
  clientId: string = '';
  currentClient: Client = new Client();

  constructor(
    private fireauth: AngularFireAuth,
    private afs: AngularFirestore,
    private router: Router,
    private time: TimeService,
    private compute: ComputationService
  ) {
    this.clientsRef$ = of(null);
    this.user$ = this.fireauth.authState.pipe(
      switchMap((user) => {
        if (user) {
          this.email = of(user.email);
          return this.afs.doc<User>(`users/${user.uid}`).valueChanges();
        } else {
          return of(null);
        }
      })
    );

    this.clientsRef$ = this.fireauth.authState.pipe(
      switchMap((user) => {
        if (user) {
          return this.afs
            .collection(`users/${user.uid}/clients/`)
            .valueChanges();
        } else {
          return of(null);
        }
      })
    );

    this.employeesRef$ = this.fireauth.authState.pipe(
      switchMap((user) => {
        if (user) {
          return this.afs
            .collection(`users/${user.uid}/employees/`)
            .valueChanges();
        } else {
          return of(null);
        }
      })
    );
    this.getCurrentUser();
  }
  ngOnInit() {}
  getAllClients(): Observable<Client> {
    return this.clientsRef$;
  }
  getAllEmployees(): Observable<Employee> {
    return this.employeesRef$;
  }

  getCurrentUser() {
    this.user$.subscribe((user) => {
      this.currentUser = user;
    });
  }
  SignOn(email: string, password: string) {
    this.fireauth
      .signInWithEmailAndPassword(email, password)
      .then(
        (res) => {
          if (res.user?.emailVerified == true) {
            this.router.navigate(['/home']);
          } else {
            this.router.navigate(['/verify-email']);
          }
        },
        (err) => {
          alert('Something went wrong');
          this.router.navigate(['/']);
        }
      )
      .catch((error) => {
        alert('Something went wrong');
        this.router.navigate(['/']);
        // ...
      });
  }

  register(
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) {
    this.fireauth
      .createUserWithEmailAndPassword(email, password)
      .then(
        (res) => {
          alert('Registration was Successful');
          this.sendEmailForVerification(res.user);

          this.addNewUser(firstName, lastName, res.user);
          this.router.navigate(['/verify-email']);
        },
        (err) => {
          alert(err.message);
        }
      )
      .catch((error) => {
        alert('Something went wrong');
        this.router.navigate(['/']);
        // ...
      });
  }

  addNewUser(firstName: string, lastName: string, user: any) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${user.uid}`
    );
    const data = {
      uid: user.uid,
      email: user.email,
      firstName: firstName,
      lastName: lastName,
      numberOfClients: '0',
      amountInvested: '0',
      investements: {},
      amountLended: '0',
      clientsSavings: '0',
      expensesAmount: '0',
      expenses: {},
      performances: {},
      projectedRevenue: '0',
      reserveAmount: '0',
      reserve: {},
      fees: '0',
      dailyLending: {},
      dailyReimbursement: {},
    };
    return userRef.set(data, { merge: true });
  }

  addNewClient(client: Client) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const data = {
      uid: this.afs.createId().toString(),
      firstName: client.firstName,
      lastName: client.lastName,
      middleName: client.middleName,
      phoneNumber: client.phoneNumber,
      businessCapital: client.businessCapital,
      homeAddress: client.homeAddress,
      businessAddress: client.businessAddress,
      debtCycle: '1',
      membershipFee: client.membershipFee,
      applicationFee: client.applicationFee,
      savings: client.savings,
      loanAmount: client.loanAmount,
      creditScore: '50',
      agent: client.agent,
      debtLeft: client.debtLeft,
      amountToPay: client.amountToPay,
      interestRate: client.interestRate,
      debtCycleStartDate: client.debtCycleStartDate,
      debtCycleEndDate: client.debtCycleEndDate,
      paymentPeriodRange: client.paymentPeriodRange,
      profession: client.profession,
      amountPaid: '0',
      dateJoined: `${month}-${day}-${year}`,
      numberOfPaymentsMissed: '0',
      numberOfPaymentsMade: '0',
      paymentDay: client.paymentDay,
      payments: {},
      clients: [],
    };
    this.clientId = data.uid;
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.currentUser.uid}/clients/${data.uid}`
    );
    return clientRef.set(data, { merge: true });
  }

  addNewEmployee(employee: Employee) {
    const data = {
      uid: this.afs.createId().toString(),
      firstName: employee.firstName,
      lastName: employee.lastName,
      middleName: employee.middleName,
      phoneNumber: employee.phoneNumber,
      dateJoined: employee.dateJoined,
      dailyPoints: {},
      totalDailyPoints: {},
      averagePoints: '0',
      totalPoints: '0',
      sex: employee.sex,
      dateOfBirth: employee.dateOfBirth,
      status: employee.status,
      paymentsPicturePath: [],
      role: employee.role,
      clients: [],
      dailyStatus: {},
      dateLeft: '',
    };
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.currentUser.uid}/employees/${data.uid}`
    );
    return employeeRef.set(data, { merge: true });
  }

  deleteClient(client: Client) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.currentUser.uid}/clients/${client.uid}`
    );
    return clientRef.delete();
  }

  UpdateUserInfoForDeletedClient(client: Client) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.currentUser.uid}`
    );
    const data = {
      numberOfClients: (
        Number(this.currentUser.numberOfClients) - 1
      ).toString(),

      amountLended: (
        Number(this.currentUser.amountLended) - Number(client.loanAmount)
      ).toString(),
      clientsSavings: (
        Number(this.currentUser.clientsSavings) - Number(client.savings)
      ).toString(),
      fees: (
        Number(this.currentUser.fees) -
        (Number(client.applicationFee) + Number(client.membershipFee))
      ).toString(),
      projectedRevenue: (
        Number(this.currentUser.projectedRevenue) - Number(client.amountToPay)
      ).toString(),
      totalDebtLeft: (
        Number(this.currentUser.totalDebtLeft) - Number(client.debtLeft)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }

  sendEmailForVerification(user: any) {
    user
      .sendEmailVerification()
      .then(
        (res: any) => {
          this.router.navigate(['verify-email']);
        },
        (err: any) => {
          alert('Something went wrong. Unable to send you an email');
        }
      )
      .catch((error: any) => {
        alert('Something went wrong');
        this.router.navigate(['/']);
        // ...
      });
  }

  logout() {
    this.email = of('');
    this.fireauth
      .signOut()
      .then(
        () => {
          this.router.navigate(['/']);
        },
        (err) => {
          alert(err.message);
        }
      )
      .catch((error) => {
        alert('Something went wrong');
        this.router.navigate(['/']);
        // ...
      });
  }

  forgotPassword(email: string) {
    this.fireauth
      .sendPasswordResetEmail(email)
      .then(
        () => {
          this.router.navigate(['verify-email']);
        },
        (err) => {
          alert('Something went wrong');
        }
      )
      .catch((error) => {
        alert('Something went wrong');
        this.router.navigate(['/']);
        // ...
      });
  }
}
