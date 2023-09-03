import { Injectable, NgZone } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import {
  AngularFirestore,
  AngularFirestoreDocument,
} from '@angular/fire/compat/firestore';
import { Observable, of, from } from 'rxjs';
import { filter, switchMap } from 'rxjs/operators';
import { User } from '../models/user';
import { DataService } from './data.service';
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  user$: Observable<any>;
  email?: Observable<any>;
  constructor(
    private fireauth: AngularFireAuth,
    private afs: AngularFirestore,
    private router: Router,
    private data: DataService
  ) {
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
  }
  ngOnInit() {}

  // login method
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

  register(email: string, password: string) {
    this.fireauth.createUserWithEmailAndPassword(email, password).then(
      (res) => {
        alert('Registration was Successful');
        this.sendEmailForVerification(res.user);
        // add user. we probably need a cleaner way to do this
        this.addUser(res.user);
        this.router.navigate(['/verify-email']);
      },
      (err) => {
        alert(err.message);
      }
    );
  }

  addUser({ uid, email }: any) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${uid}`
    );
    const data = {
      uid,
      email,
    };
    return userRef.set(data, { merge: true });
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
