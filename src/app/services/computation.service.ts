import { Injectable } from '@angular/core';

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
}
