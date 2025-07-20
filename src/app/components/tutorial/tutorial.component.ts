import { PercentPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-tutorial',
  templateUrl: './tutorial.component.html',
  styleUrls: ['./tutorial.component.css'],
})
export class TutorialComponent implements OnInit {
  showFirst: boolean = false;
  system: boolean = false;
  payment: boolean = false;
  role: boolean = false;
  maxLoan: boolean = false;
  performance: boolean = false;
  budget: boolean = false;
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
  criteriaToLend: boolean = false;
  startingBudget: number = 0;

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
  ngOnInit() {
    this.startingBudget = Number(this.auth.currentUser?.startingBudget ?? 0);
    console.log('budget ', this.startingBudget);
  }
  /* === Calcul frais prêt === */
  isNewClient: boolean = true; // Nouveau = true, Ancien = false
  loanAmount: number | null = null;

  readonly memberFee: number = 5000; // Frais de membre (toujours)
  repaymentWeeks = 8; // 4 ou 8

  // Taux d’intérêt simple (0.20 ou 0.40)
  get interestRate(): number {
    return this.repaymentWeeks === 8 ? 0.4 : 0.2;
  }

  // Intérêt en FC
  get loanInterest(): number {
    return this.loanAmount! * this.interestRate;
  }

  // Montant total à rembourser (principal + intérêt)
  get totalRepay(): number {
    return this.loanAmount! + this.loanInterest;
  }

  // Paiement hebdomadaire
  get weeklyRepay(): number {
    return this.totalRepay / this.repaymentWeeks;
  }
  get adhesionFee(): number {
    // Frais d’adhésion (nouveau client)
    return this.isNewClient ? 10000 : 0;
  }
  get savingDeposit(): number {
    // 30 % du montant demandé
    return this.loanAmount ? Math.round(this.loanAmount * 0.3) : 0;
  }
  get totalToPay(): number {
    // Somme totale
    return this.memberFee + this.adhesionFee + this.savingDeposit;
  }

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
      | 'budget'
      | 'maxLoan'
      | 'criteriaToLend'
  ) {
    this[property] = !this[property];
  }
  computeBonus() {
    this.base = this.findBase(
      Number(this.numberOfPeople),
      this.agentRole,
      this.percentage
    );

    this.bonus = this.compute.getBonus(
      Number(this.numberOfPeople),
      Number(this.percentage),
      this.agentRole
    );
  }

  findBase(people: number, agentRole: string, percentage: number): number {
    let base = 80;
    if (people < 100) {
      base = 80;
    }
    // } else if (percentage < 50) {
    //   base = 80;
    // } else if (people >= 100 && people < 160) {
    //   base = 100;
    // } else if (people >= 160 && base < 200) {
    //   base = 120;
    // } else base = 140;

    if (agentRole !== 'Manager') base -= 10;
    return base;
  }
}
