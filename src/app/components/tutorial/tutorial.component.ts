import { Component, OnDestroy, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { Subscription } from 'rxjs';

interface WeeklyDeductionGuideRow {
  label: string;
  deductionUsd: number;
  tone: 'success' | 'warning' | 'danger';
  note?: string;
}

interface TeamWeeklyBonusGuideRow {
  totalFc: number;
  bonusUsd: number;
  progressPercent: number;
  rowClass: string;
  bonusClass: string;
}

@Component({
  selector: 'app-tutorial',
  templateUrl: './tutorial.component.html',
  styleUrls: ['./tutorial.component.css'],
})
export class TutorialComponent implements OnInit, OnDestroy {
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
  weeklyDeduction: boolean = false;
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
  weeklyMinimumFc: number = 600000;
  weeklyMinimumInput: string = '';
  weeklyDeductionGuide: WeeklyDeductionGuideRow[] = [];
  weeklyMinimumSaving = false;
  teamWeeklyBonusThresholdFc = 1500000;
  teamWeeklyBonusThresholdInput = '';
  teamWeeklyBonusGuide: TeamWeeklyBonusGuideRow[] = [];
  teamWeeklyBonusSaving = false;
  private weeklyTargetSub?: Subscription;
  private teamWeeklyBonusSub?: Subscription;

  constructor(
    public auth: AuthService,
    public compute: ComputationService
  ) {}
  ngOnInit() {
    this.startingBudget = Number(this.auth.currentUser?.startingBudget ?? 0);
    console.log('budget ', this.startingBudget);
    this.syncWeeklyMinimum(this.auth.weeklyPaymentTargetFc || 600000);
    this.weeklyTargetSub = this.auth.weeklyPaymentTarget$.subscribe((targetFc) => {
      this.syncWeeklyMinimum(targetFc || 600000);
    });
    this.syncTeamWeeklyBonusThreshold(
      this.auth.teamWeeklyBonusThresholdFc || 1500000
    );
    this.teamWeeklyBonusSub = this.auth.teamWeeklyBonusConfig$.subscribe(
      (config) => {
        this.syncTeamWeeklyBonusThreshold(config?.thresholdFc || 1500000);
      }
    );
  }
  ngOnDestroy() {
    this.weeklyTargetSub?.unsubscribe();
    this.teamWeeklyBonusSub?.unsubscribe();
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
      | 'weeklyDeduction'
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

  async saveWeeklyMinimum(): Promise<void> {
    if (!this.auth.isAdmin || this.weeklyMinimumSaving) {
      return;
    }

    const value = Number(this.weeklyMinimumInput);
    if (!Number.isFinite(value) || value < 600000 || value % 100000 !== 0) {
      alert('Entrez un minimum valide en tranche de 100 000 FC (minimum 600 000 FC).');
      return;
    }

    this.weeklyMinimumSaving = true;
    try {
      await this.auth.updateWeeklyPaymentTargetGlobal(value);
      this.syncWeeklyMinimum(value);
      alert('Minimum hebdomadaire mis à jour.');
    } catch (error) {
      alert('Erreur lors de la mise à jour du minimum hebdomadaire.');
    } finally {
      this.weeklyMinimumSaving = false;
    }
  }

  async saveTeamWeeklyBonusThreshold(): Promise<void> {
    if (!this.auth.isAdmin || this.teamWeeklyBonusSaving) {
      return;
    }

    const value = Number(this.teamWeeklyBonusThresholdInput);
    if (!Number.isFinite(value) || value < 100000 || value % 100000 !== 0) {
      alert(
        'Entrez un seuil valide en tranche de 100 000 FC (minimum 100 000 FC).'
      );
      return;
    }

    this.teamWeeklyBonusSaving = true;
    try {
      await this.auth.updateTeamWeeklyBonusThresholdGlobal(value);
      this.syncTeamWeeklyBonusThreshold(value);
      alert("Seuil du bonus hebdomadaire d'équipe mis à jour.");
    } catch (error) {
      alert("Erreur lors de la mise à jour du seuil du bonus d'équipe.");
    } finally {
      this.teamWeeklyBonusSaving = false;
    }
  }

  toneClass(row: WeeklyDeductionGuideRow): string {
    if (row.tone === 'success') {
      return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200';
    }
    if (row.tone === 'danger') {
      return 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-200';
    }
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200';
  }

  private syncWeeklyMinimum(targetFc: number): void {
    const normalizedTarget =
      Number.isFinite(Number(targetFc)) && Number(targetFc) >= 600000
        ? Number(targetFc)
        : 600000;
    this.weeklyMinimumFc = normalizedTarget;
    this.weeklyMinimumInput = normalizedTarget.toString();
    this.weeklyDeductionGuide = this.buildWeeklyDeductionGuide(normalizedTarget);
  }

  private buildWeeklyDeductionGuide(targetFc: number): WeeklyDeductionGuideRow[] {
    const rows: WeeklyDeductionGuideRow[] = [
      {
        label: `${this.formatFc(targetFc)} FC ou plus`,
        deductionUsd: 0,
        tone: 'success',
        note: 'Aucune retenue',
      },
    ];

    for (let lowerBound = targetFc - 100000; lowerBound >= 600000; lowerBound -= 100000) {
      const upperBound = Math.min(targetFc - 1, lowerBound + 99999);
      const deductionUsd = this.compute.computeWeeklyObjectiveDeductionUsd(
        lowerBound,
        targetFc
      );
      if (deductionUsd <= 0) {
        continue;
      }

      rows.push({
        label: `${this.formatFc(lowerBound)} - ${this.formatFc(upperBound)} FC`,
        deductionUsd,
        tone: 'warning',
      });
    }

    rows.push({
      label: `Moins de ${this.formatFc(600000)} FC`,
      deductionUsd: this.compute.computeWeeklyObjectiveDeductionUsd(599999, targetFc),
      tone: 'danger',
      note: targetFc >= 1200000 ? 'Retenue renforcée' : 'Retenue maximale',
    });

    return rows;
  }

  private formatFc(value: number): string {
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  get teamWeeklyBonusThresholdShortLabel(): string {
    return this.formatCompactFc(this.teamWeeklyBonusThresholdFc);
  }

  get teamWeeklyBonusStepFc(): number {
    return 100000;
  }

  get teamWeeklyBonusStepUsd(): number {
    return 5;
  }

  private syncTeamWeeklyBonusThreshold(thresholdFc: number): void {
    const normalizedThreshold =
      Number.isFinite(Number(thresholdFc)) &&
      Number(thresholdFc) >= 100000 &&
      Number(thresholdFc) % 100000 === 0
        ? Number(thresholdFc)
        : 1500000;

    this.teamWeeklyBonusThresholdFc = normalizedThreshold;
    this.teamWeeklyBonusThresholdInput = normalizedThreshold.toString();
    this.teamWeeklyBonusGuide =
      this.buildTeamWeeklyBonusGuide(normalizedThreshold);
  }

  private buildTeamWeeklyBonusGuide(
    thresholdFc: number
  ): TeamWeeklyBonusGuideRow[] {
    const rowClasses = [
      'bg-green-50 dark:bg-green-900 border-b hover:bg-green-700',
      'bg-green-100 dark:bg-green-900 border-b hover:bg-green-700',
      'bg-green-200 dark:bg-green-900 border-b hover:bg-green-700',
      'bg-green-300 dark:bg-green-900 border-b hover:bg-green-700',
      'bg-green-400 dark:bg-green-900 border-b hover:bg-green-700',
      'bg-green-500 dark:bg-green-800 hover:bg-green-600 text-white',
    ];
    const bonusClasses = [
      'font-semibold text-green-700 dark:text-green-300 flex items-center gap-1',
      'font-semibold text-green-700 dark:text-green-300 flex items-center gap-1',
      'font-semibold text-green-700 dark:text-green-300 flex items-center gap-1',
      'font-semibold text-green-800 dark:text-green-200 flex items-center gap-1',
      'font-semibold text-green-900 dark:text-green-100 flex items-center gap-1',
      'font-bold flex items-center gap-1',
    ];

    return Array.from({ length: 6 }, (_, index) => {
      const totalFc = thresholdFc + index * this.teamWeeklyBonusStepFc;
      const bonusUsd = (index + 1) * this.teamWeeklyBonusStepUsd;
      const progressPercent = 50 + index * 10;

      return {
        totalFc,
        bonusUsd,
        progressPercent,
        rowClass: rowClasses[index],
        bonusClass: bonusClasses[index],
      };
    });
  }

  private formatCompactFc(value: number): string {
    const compact = value / 1000000;
    const fractionDigits = Number.isInteger(compact) ? 0 : 1;
    return `${compact.toFixed(fractionDigits)}M`;
  }
}
