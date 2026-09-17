import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  AuthService,
  WeeklyObjectiveDeductionConfig,
} from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { combineLatest, Subscription } from 'rxjs';
import { User } from 'src/app/models/user';
import { WeeklyPaymentTargetPeriod } from 'src/app/models/weekly-payment-target';
import { pointBusinessDay } from 'src/app/utils/point-performance.util';
import {
  findMatchingWeeklyPaymentTargetPeriod,
  formatWeeklyPaymentTargetDateIso,
  parseWeeklyPaymentTargetDate,
} from 'src/app/utils/weekly-payment-target.util';
import {
  DEFAULT_PERFORMANCE_BUDGET_PROPORTION,
  scalePerformanceBudget,
} from 'src/app/utils/performance-budget.util';

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
  budgetProportionPercent = DEFAULT_PERFORMANCE_BUDGET_PROPORTION;
  budgetProportionInput: number | null = DEFAULT_PERFORMANCE_BUDGET_PROPORTION;
  budgetProportionSaving = false;
  budgetProportionMessage = '';
  readonly performanceBudgetRows = Array.from({ length: 9 }, (_, index) => {
    const tier = 9 - index;
    return { range: `${tier * 10}-${tier * 10 + 9} %`, baseFc: tier * 1000000 };
  });
  private budgetProportionSub?: Subscription;

  numberOfPeople: number = 0;
  percentage: number = 0;

  base: number = 0;

  result: string = '';

  bonus: number = 0;
  weeklyMinimumFc: number = 600000;
  weeklyMinimumInput: string = '';
  weeklyDeductionGuide: WeeklyDeductionGuideRow[] = [];
  weeklyMinimumSaving = false;
  weeklyMinimumHasSiteOverride = false;
  private tutorialUser: User | null = null;
  teamWeeklyBonusThresholdFc = 600000;
  teamWeeklyBonusTotalInput = '';
  teamWeeklyBonusGuide: TeamWeeklyBonusGuideRow[] = [];
  weeklyObjectiveAdjustmentConfig: WeeklyObjectiveDeductionConfig = {
    bandFc: 100000,
    penaltyPerBandUsd: 1,
    bonusBandFc: 100000,
    bonusPerBandUsd: 1,
  };
  private weeklyTargetSub?: Subscription;
  private weeklyObjectiveConfigSub?: Subscription;

  constructor(
    public auth: AuthService,
    public compute: ComputationService
  ) {}
  ngOnInit() {
    this.budgetProportionSub = this.auth.performanceBudgetProportion$.subscribe((percent) => {
      this.budgetProportionPercent = percent;
      this.budgetProportionInput = percent;
    });
    this.startingBudget = Number(this.auth.currentUser?.startingBudget ?? 0);
    console.log('budget ', this.startingBudget);
    this.weeklyTargetSub = combineLatest([
      this.auth.weeklyPaymentTarget$, this.auth.weeklyDeductionTarget$, this.auth.user$,
    ]).subscribe(([, , user]) => {
      this.tutorialUser = user;
      this.refreshWeeklyTargets();
    });
    this.weeklyObjectiveConfigSub =
      this.auth.weeklyObjectiveDeductionConfig$.subscribe(
      (config) => {
        this.weeklyObjectiveAdjustmentConfig = { ...config };
        this.refreshWeeklyTargets();
      }
    );
  }
  ngOnDestroy() {
    this.budgetProportionSub?.unsubscribe();
    this.weeklyTargetSub?.unsubscribe();
    this.weeklyObjectiveConfigSub?.unsubscribe();
  }
  /* === Calcul frais prêt === */
  budgetTierAmount(baseFc: number): number {
    return scalePerformanceBudget(baseFc, this.budgetProportionPercent);
  }

  async saveBudgetProportion(): Promise<void> {
    if (!this.auth.isAdmin || this.budgetProportionSaving) return;
    const percent = this.budgetProportionInput;
    if (percent === null || !Number.isFinite(percent) || percent < 0 || percent > 100) {
      this.budgetProportionMessage = 'Entrez une proportion entre 0 et 100 %.';
      return;
    }
    this.budgetProportionSaving = true;
    this.budgetProportionMessage = '';
    try {
      await this.auth.updatePerformanceBudgetProportion(percent);
      this.budgetProportionPercent = percent;
      this.budgetProportionMessage = 'Proportion enregistrée pour toutes les équipes.';
    } catch {
      this.budgetProportionMessage = 'Impossible d’enregistrer la proportion.';
    } finally {
      this.budgetProportionSaving = false;
    }
  }

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
    if (!Number.isFinite(value) || value < 100000 || value % 100000 !== 0) {
      alert('Entrez un minimum valide en tranche de 100 000 FC.');
      return;
    }

    this.weeklyMinimumSaving = true;
    try {
      const period = this.currentDeductionWeek(value);
      const periods = (this.tutorialUser?.weeklyDeductionTargetPeriods || []).filter(
        (entry) => entry.startDateIso !== period.startDateIso
      );
      await this.auth.updateWeeklyDeductionTargetPeriodsForCurrentUser([...periods, period]);
      this.tutorialUser = this.auth.currentUser;
      this.refreshWeeklyTargets();
      alert('Exception de retenue enregistrée pour ce site et cette semaine.');
    } catch (error) {
      alert('Erreur lors de la mise à jour du minimum hebdomadaire.');
    } finally {
      this.weeklyMinimumSaving = false;
    }
  }

  async useDefaultWeeklyMinimum(): Promise<void> {
    if (!this.auth.isAdmin || this.weeklyMinimumSaving) return;
    const active = findMatchingWeeklyPaymentTargetPeriod(
      this.tutorialUser?.weeklyDeductionTargetPeriods || [], pointBusinessDay()
    );
    if (!active) return;
    this.weeklyMinimumSaving = true;
    try {
      await this.auth.updateWeeklyDeductionTargetPeriodsForCurrentUser(
        (this.tutorialUser?.weeklyDeductionTargetPeriods || []).filter((period) =>
          period.startDateIso !== active.startDateIso || period.endDateIso !== active.endDateIso
        )
      );
      this.tutorialUser = this.auth.currentUser;
      this.refreshWeeklyTargets();
    } catch {
      alert('Impossible de rétablir le minimum central.');
    } finally {
      this.weeklyMinimumSaving = false;
    }
  }

  private currentDeductionWeek(targetFc: number): WeeklyPaymentTargetPeriod {
    const start = parseWeeklyPaymentTargetDate(pointBusinessDay())!;
    start.setDate(start.getDate() - (start.getDay() + 6) % 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { startDateIso: formatWeeklyPaymentTargetDateIso(start),
      endDateIso: formatWeeklyPaymentTargetDateIso(end), targetFc };
  }

  private refreshWeeklyTargets(): void {
    const date = pointBusinessDay();
    this.weeklyMinimumHasSiteOverride = !!findMatchingWeeklyPaymentTargetPeriod(
      this.tutorialUser?.weeklyDeductionTargetPeriods || [], date
    );
    this.syncWeeklyMinimum(this.auth.resolveWeeklyDeductionTargetForDate(date, this.tutorialUser));
    this.syncTeamWeeklyBonusThreshold(this.auth.resolveWeeklyPaymentTargetForDate(date, this.tutorialUser));
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
      Number.isFinite(Number(targetFc)) && Number(targetFc) > 0
        ? Number(targetFc)
        : 600000;
    if (this.weeklyMinimumFc !== normalizedTarget || !this.weeklyMinimumInput) {
      this.weeklyMinimumInput = normalizedTarget.toString();
    }
    this.weeklyMinimumFc = normalizedTarget;
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

    const bandFc = this.weeklyObjectiveAdjustmentConfig.bandFc;
    for (let upperBound = targetFc - 1; upperBound >= 0; upperBound -= bandFc) {
      const lowerBound = Math.max(0, upperBound - bandFc + 1);
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
        tone: lowerBound === 0 ? 'danger' : 'warning',
      });
    }

    return rows;
  }

  private formatFc(value: number): string {
    return new Intl.NumberFormat('fr-FR').format(value);
  }

  get teamWeeklyBonusThresholdShortLabel(): string {
    return this.formatCompactFc(this.teamWeeklyBonusThresholdFc);
  }

  get teamWeeklyBonusStepFc(): number {
    return this.weeklyObjectiveAdjustmentConfig.bonusBandFc;
  }

  get teamWeeklyBonusStepUsd(): number {
    return this.weeklyObjectiveAdjustmentConfig.bonusPerBandUsd;
  }

  get teamWeeklyBonusEnteredTotalFc(): number {
    const value = Number(this.teamWeeklyBonusTotalInput);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  get teamWeeklyBonusExpectedUsd(): number {
    const totalFc = this.teamWeeklyBonusEnteredTotalFc;
    if (totalFc < this.teamWeeklyBonusThresholdFc) {
      return 0;
    }

    const completedSteps =
      Math.floor(
        (totalFc - this.teamWeeklyBonusThresholdFc) /
          this.teamWeeklyBonusStepFc
      ) + 1;

    return completedSteps * this.teamWeeklyBonusStepUsd;
  }

  get teamWeeklyBonusCurrentLevel(): number {
    return this.teamWeeklyBonusStepUsd > 0
      ? this.teamWeeklyBonusExpectedUsd / this.teamWeeklyBonusStepUsd
      : 0;
  }

  get teamWeeklyBonusNextTargetFc(): number {
    if (this.teamWeeklyBonusEnteredTotalFc < this.teamWeeklyBonusThresholdFc) {
      return this.teamWeeklyBonusThresholdFc;
    }

    return (
      this.teamWeeklyBonusThresholdFc +
      this.teamWeeklyBonusCurrentLevel * this.teamWeeklyBonusStepFc
    );
  }

  get teamWeeklyBonusRemainingFc(): number {
    return Math.max(
      this.teamWeeklyBonusNextTargetFc - this.teamWeeklyBonusEnteredTotalFc,
      0
    );
  }

  get teamWeeklyBonusProgressPercent(): number {
    const totalFc = this.teamWeeklyBonusEnteredTotalFc;
    const startFc =
      totalFc < this.teamWeeklyBonusThresholdFc
        ? 0
        : this.teamWeeklyBonusThresholdFc +
          Math.max(this.teamWeeklyBonusCurrentLevel - 1, 0) *
            this.teamWeeklyBonusStepFc;
    const targetFc = this.teamWeeklyBonusNextTargetFc;
    const rangeFc = Math.max(targetFc - startFc, 1);

    return Math.min(
      Math.max(((totalFc - startFc) / rangeFc) * 100, 0),
      100
    );
  }

  private syncTeamWeeklyBonusThreshold(thresholdFc: number): void {
    const normalizedThreshold =
      Number.isFinite(Number(thresholdFc)) &&
      Number(thresholdFc) >= 100000 &&
      Number(thresholdFc) % 100000 === 0
        ? Number(thresholdFc)
        : 600000;

    this.teamWeeklyBonusThresholdFc = normalizedThreshold;
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

    const levelCount = 6;
    return Array.from({ length: levelCount }, (_, index) => {
      const totalFc = thresholdFc + index * this.teamWeeklyBonusStepFc;
      const bonusUsd = (index + 1) * this.teamWeeklyBonusStepUsd;
      const progressPercent =
        ((index + 1) / Math.max(levelCount, 1)) * 100;

      return {
        totalFc,
        bonusUsd,
        progressPercent,
        rowClass: rowClasses[Math.min(index, rowClasses.length - 1)],
        bonusClass: bonusClasses[Math.min(index, bonusClasses.length - 1)],
      };
    });
  }

  private formatCompactFc(value: number): string {
    const compact = value / 1000000;
    const fractionDigits = Number.isInteger(compact) ? 0 : 1;
    return `${compact.toFixed(fractionDigits)}M`;
  }
}
