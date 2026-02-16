import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import type { FirebaseApp } from 'firebase/app';
import { environment } from '../../../environments/environments';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class PublicAuthService {
  private firebaseAppPromise: Promise<FirebaseApp> | null = null;

  constructor(
    private router: Router,
    private authService: AuthService
  ) {}

  async SignOn(email: string, password: string, word: string): Promise<void> {
    const app = await this.ensureFirebaseApp();
    const { getAuth, signInWithEmailAndPassword } = await import(
      'firebase/auth'
    );

    try {
      const auth = getAuth(app);
      const result = await signInWithEmailAndPassword(auth, email, password);
      this.authService.applyRoleWord(word);

      if (result.user?.emailVerified) {
        await this.router.navigate(['/home']);
      } else {
        await this.router.navigate(['/verify-email']);
      }
    } catch (error) {
      this.authService.clearPersistedRoleFlags();
      throw error;
    }
  }

  async register(
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ): Promise<void> {
    const app = await this.ensureFirebaseApp();
    const { getAuth, createUserWithEmailAndPassword } = await import(
      'firebase/auth'
    );

    try {
      const auth = getAuth(app);
      const res = await createUserWithEmailAndPassword(auth, email, password);
      alert('Registration was Successful');

      await this.sendEmailForVerification(res.user);
      await this.addNewUser(firstName, lastName, res.user);
      await this.router.navigate(['/verify-email']);
    } catch (err: any) {
      alert(err?.message ?? 'Something went wrong');
      await this.router.navigate(['/']);
    }
  }

  async forgotPassword(email: string): Promise<void> {
    const app = await this.ensureFirebaseApp();
    const { getAuth, sendPasswordResetEmail } = await import('firebase/auth');

    try {
      const auth = getAuth(app);
      await sendPasswordResetEmail(auth, email);
      await this.router.navigate(['verify-email']);
    } catch (err) {
      alert('Something went wrong');
      await this.router.navigate(['/']);
    }
  }

  private async sendEmailForVerification(user: any): Promise<void> {
    if (!user) {
      return;
    }

    const { sendEmailVerification } = await import('firebase/auth');
    await sendEmailVerification(user).catch((error) => {
      console.error('Error sending verification email', error);
    });
  }

  private async addNewUser(
    firstName: string,
    lastName: string,
    user: any
  ): Promise<void> {
    if (!user?.uid) {
      return;
    }

    const app = await this.ensureFirebaseApp();
    const { getFirestore, doc, setDoc } = await import('firebase/firestore');
    const firestore = getFirestore(app);
    const userRef = doc(firestore, `users/${user.uid}`);

    const data = {
      uid: user.uid,
      email: user.email,
      firstName: firstName,
      lastName: lastName,
      numberOfClients: '0',
      amountInvested: '0',
      amountInvestedDollars: '0',
      investements: {},
      investmentsDollar: {},
      amountLended: '0',
      clientsSavings: '0',
      expensesAmount: '0',
      expenses: {},
      performances: {},
      projectedRevenue: '0',
      reserveAmount: '0',
      reserveAmountDollar: '0',
      reserve: {},
      reserveinDollar: {},
      fees: '0',
      moneyInHands: '0',
      totalDebtLeft: '0',
      cardsMoney: '0',
      dailyLending: {},
      roles: ['user'],
      mode: 'production',
      feesData: {},
      dailyReimbursement: {},
      dailyMobileMoneyPayment: {},
      dailySaving: {},
      dailySavingReturns: {},
      dailyCardReturns: {},
      dailyCardPayments: {},
      dailyMoneyRequests: {},
      dailyFeesReturns: {},
      monthBudget: '',
      monthBudgetPending: '0',
    };

    await setDoc(userRef, data, { merge: true });
  }

  private ensureFirebaseApp(): Promise<FirebaseApp> {
    if (!this.firebaseAppPromise) {
      this.firebaseAppPromise = import('firebase/app').then(
        ({ getApps, initializeApp }) => {
          const apps = getApps();
          return apps.length ? apps[0] : initializeApp(environment.firebase);
        }
      );
    }

    return this.firebaseAppPromise;
  }
}
