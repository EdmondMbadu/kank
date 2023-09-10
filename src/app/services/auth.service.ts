import { Injectable, NgZone } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import {
  AngularFirestore,
  AngularFirestoreCollection,
  AngularFirestoreDocument,
} from '@angular/fire/compat/firestore';
import { Observable, of, from, ReplaySubject } from 'rxjs';
import { filter, map, switchMap, take, tap } from 'rxjs/operators';
import { User } from '../models/user';
import { DataService } from './data.service';
import { Client } from '../models/client';
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  user$: Observable<any>;
  clientsRef$: Observable<any>;
  email?: Observable<any>;
  currentUser: any = {};
  currentClient: Client = new Client();
  constructor(
    private fireauth: AngularFireAuth,
    private afs: AngularFirestore,
    private router: Router
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

    this.getCurrentUser();
  }
  ngOnInit() {}
  getAllClients(): Observable<Client> {
    return this.clientsRef$;
  }

  getCurrentUser() {
    this.user$.subscribe((user) => {
      this.currentUser = user;
    });
  }

  getCurrentClient() {
    this.clientsRef$.subscribe((client) => {
      this.currentClient = client;
    });
  }

  SignOn(email: string, password: string) {
    this.fireauth.signInWithEmailAndPassword(email, password).then(
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
    );
  }

  register(
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) {
    this.fireauth.createUserWithEmailAndPassword(email, password).then(
      (res) => {
        alert('Registration was Successful');
        this.sendEmailForVerification(res.user);

        this.addNewUser(firstName, lastName, res.user);
        this.router.navigate(['/verify-email']);
      },
      (err) => {
        alert(err.message);
      }
    );
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
      projectedRevenue: '0',
      reserveAmount: '0',
      reserve: {},
      fees: '0',
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
      payments: {},
    };
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.currentUser.uid}/clients/${data.uid}`
    );
    return clientRef.set(data, { merge: true });
  }

  sendEmailForVerification(user: any) {
    user.sendEmailVerification().then(
      (res: any) => {
        this.router.navigate(['verify-email']);
      },
      (err: any) => {
        alert('Something went wrong. Unable to send you an email');
      }
    );
  }

  updateUserInfoForNewClient(client: Client) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.currentUser.uid}`
    );
    const data = {
      numberOfClients: (
        Number(this.currentUser.numberOfClients) + 1
      ).toString(),
      amountLended: (
        Number(this.currentUser.amountLended) + Number(client.loanAmount!)
      ).toString(),
      clientsSavings: (
        Number(this.currentUser.clientsSavings) + Number(client.savings)
      ).toString(),
      fees: (
        Number(this.currentUser.fees) +
        Number(client.membershipFee) +
        Number(client.applicationFee)
      ).toString(),
      projectedRevenue: (
        Number(this.currentUser.projectedRevenue) + Number(client.amountToPay)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }

  logout() {
    this.email = of('');
    this.fireauth.signOut().then(
      () => {
        this.router.navigate(['/']);
      },
      (err) => {
        alert(err.message);
      }
    );
  }

  forgotPassword(email: string) {
    this.fireauth.sendPasswordResetEmail(email).then(
      () => {
        this.router.navigate(['verify-email']);
      },
      (err) => {
        alert('Something went wrong');
      }
    );
  }
}
