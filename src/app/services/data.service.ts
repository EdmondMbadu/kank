import { Injectable } from '@angular/core';
import {
  AngularFirestore,
  AngularFirestoreCollection,
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
  constructor(private afs: AngularFirestore) {}

  clientPayment(client: Client) {}
}
