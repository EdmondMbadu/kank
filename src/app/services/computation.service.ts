import { Injectable } from '@angular/core';
import { Client } from '../models/client';

@Injectable({
  providedIn: 'root',
})
export class ComputationService {
  constructor() {}

  convertCongoleseFrancToUsDollars(value: string) {
    let input = Number(value);
    if (isNaN(input)) return '';

    let dollars = Math.floor(input * 0.0004);

    return dollars;
  }

  computeExpectedPerDate(clients: Client[]) {
    let total = 0;

    for (let client of clients) {
      if (Number(client.amountToPay) > 0) {
        const pay =
          Number(client.amountToPay) / Number(client.paymentPeriodRange);

        total += pay;
      }
    }
    return total;
  }
}
