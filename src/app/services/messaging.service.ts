// src/app/services/messaging.service.ts
import { Injectable } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class MessagingService {
  constructor(private fns: AngularFireFunctions) {}

  sendCustomSMS(phoneNumber: string, message: string, metadata: any = {}) {
    const callable = this.fns.httpsCallable('sendCustomSMS');
    return firstValueFrom(callable({ phoneNumber, message, metadata }));
  }
}
