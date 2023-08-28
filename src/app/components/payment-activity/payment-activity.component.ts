import { Component } from '@angular/core';
import { Client } from 'src/app/models/client';

@Component({
  selector: 'app-payment-activity',
  templateUrl: './payment-activity.component.html',
  styleUrls: ['./payment-activity.component.css'],
})
export class PaymentActivityComponent {
  clientName: string = 'Masevo Konde';
  public payments: string[] = [
    '100,0000 ',
    ' 200,0000',
    ' 300,0000 ',
    '400,0000 ',
  ];
  public paymentDates: string[] = [
    '11/02/2023',
    '11/02/2023',
    '11/02/2023',
    '11/02/2023',
  ];
}
