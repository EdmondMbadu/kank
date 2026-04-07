import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';

@Component({
  selector: 'app-payment-savings',
  templateUrl: './payment-savings.component.html',
  styleUrls: ['./payment-savings.component.css'],
})
export class PaymentSavingsComponent {
  id: any = '';
  today = this.time.todaysDateMonthDayYear();

  savingsOtherAmount: boolean = false;
  savingsAmount: string = '';

  numberOfPaymentToday = 0;
  minPayment: string = '';
  client: Client = new Client();
  constructor(
    private activatedRoute: ActivatedRoute,
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private time: TimeService,
    private compute: ComputationService,
    private performance: PerformanceService
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClient();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
      this.savingsAmount = this.savingsAmount || '0';
    });
  }

  get savingsLimitPercent(): number {
    const raw = Number(this.auth.currentUser?.savingsRequiredPercent);
    return Number.isFinite(raw) && raw > 0 ? raw : 30;
  }

  get hasClearedDebt(): boolean {
    return Number(this.client?.debtLeft || 0) <= 0;
  }

  get maxLoanAmount(): number {
    return this.compute.getMaxLendAmount(Number(this.client?.creditScore || 0));
  }

  get maxSavingsTotal(): number {
    return Math.round(this.maxLoanAmount * (this.savingsLimitPercent / 100));
  }

  get currentSavingsTotal(): number {
    return Number(this.client?.savings || 0);
  }

  get remainingSavingsCapacity(): number {
    return Math.max(0, this.maxSavingsTotal - this.currentSavingsTotal);
  }

  private savingsCapExceeded(additionalSavings: number): boolean {
    if (!(additionalSavings > 0)) {
      return false;
    }

    const totalAfterDeposit = this.currentSavingsTotal + additionalSavings;
    if (totalAfterDeposit <= this.maxSavingsTotal) {
      return false;
    }

    const remaining = this.remainingSavingsCapacity;
    alert(
      `Le total d'épargne ne peut pas dépasser ${this.savingsLimitPercent}% du montant maximum empruntable (${this.maxLoanAmount} FC), soit ${this.maxSavingsTotal} FC.\n\n` +
        `Épargne actuelle : ${this.currentSavingsTotal} FC.\n` +
        `Montant restant autorisé : ${remaining} FC.\n` +
        `Total saisi : ${totalAfterDeposit} FC.`
    );
    return true;
  }
  displaySavingsOtherAmount() {
    if (this.savingsAmount === 'Autre Montant') {
      this.savingsOtherAmount = true;
      this.savingsAmount = '';
    } else {
      this.savingsOtherAmount = false;
    }
  }

  makeDeposit() {
    if (this.savingsAmount === '') {
      alert('Entrez le montant du dépôt');
      return;
    } else if (Number.isNaN(Number(this.savingsAmount))) {
      alert('Entrée incorrecte. Entrez un numéro');
      return;
    } else if (Number(this.savingsAmount) <= 0) {
      alert('Le montant du dépôt doit etre plus grand que 0.');
      return;
    } else if (
      this.hasClearedDebt &&
      this.savingsCapExceeded(Number(this.savingsAmount))
    ) {
      return;
    } else {
      let conf = confirm(
        ` Vous allez faire un dépôt de ${this.savingsAmount} FC. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }

      if (this.savingsAmount !== '0') {
        this.client.savings = (
          Number(this.client.savings) + Number(this.savingsAmount)
        ).toString();
        this.client.savingsPayments = {
          [this.time.todaysDate()]: this.savingsAmount,
        };
      }
    }
    let date = this.time.todaysDateMonthDayYear();
    try {
      this.data.clientDeposit(this.client, this.savingsAmount, date);
    } catch (error) {
      alert('Erreur lors du dépôt. Réessayez');
      console.error('Error making deposit:', error);
      // Handle the error appropriately, e.g., show an error message to the user
      return;
    }

    this.router.navigate(['/client-portal-savings/' + this.id]);
  }
}
