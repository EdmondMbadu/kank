import { PercentPipe } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-tutorial',
  templateUrl: './tutorial.component.html',
  styleUrls: ['./tutorial.component.css'],
})
export class TutorialComponent {
  showFirst: boolean = false;
  system: boolean = false;
  payment: boolean = false;
  role: boolean = false;
  performance: boolean = false;
  intro: boolean = false;
  register: boolean = false;
  best: boolean = false;
  agentRole: string = 'Manager';
  clientPayment: boolean = false;
  card: boolean = false;
  cardReturn: boolean = false;
  moneyInHands: boolean = false;
  moneyRequested: boolean = false;
  reserveSummary: boolean = false;
  dailyActivity: boolean = false;

  numberOfPeople: number = 0;
  percentage: number = 0;

  base: number = 0;

  result: string = '';

  bonus: number = 0;

  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    public compute: ComputationService
  ) {}

  // Generic toggle method
  toggle(
    property:
      | 'system'
      | 'payment'
      | 'role'
      | 'performance'
      | 'intro'
      | 'register'
      | 'clientPayment'
      | 'card'
      | 'cardReturn'
      | 'moneyInHands'
      | 'moneyRequested'
      | 'reserveSummary'
      | 'dailyActivity'
      | 'best'
  ) {
    this[property] = !this[property];
  }
  computeBonus() {
    if (this.agentRole === 'Manager') {
      this.base = 80;
    } else {
      this.base = 70;
    }

    this.bonus = this.compute.getBonus(
      Number(this.numberOfPeople),
      Number(this.percentage),
      this.agentRole
    );
  }
}
