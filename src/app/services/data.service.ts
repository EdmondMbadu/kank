import { Injectable } from '@angular/core';
import {
  AngularFirestore,
  AngularFirestoreCollection,
} from '@angular/fire/compat/firestore/';
import { User } from '../models/user';
import { Observable } from 'rxjs';
import { AngularFireAuth } from '@angular/fire/compat/auth';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private dbPath = '/users';
  usersRef: AngularFirestoreCollection<User>;
  constructor(private afs: AngularFirestore) {
    this.usersRef = this.afs.collection(this.dbPath);
  }

  getAllUsers(): AngularFirestoreCollection<User> {
    return this.usersRef;
  }
}
