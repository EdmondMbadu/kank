import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { coerceToNumber } from 'src/app/utils/number-utils';

@Component({
  selector: 'app-tracking-central',
  templateUrl: './tracking-central.component.html',
  styleUrls: ['./tracking-central.component.css'],
})
export class TrackingCentralComponent {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}
  allUsers: User[] = [];
  rolePasswords = {
    admin: '',
    gestion: '',
    investigator: '',
  };
  rolePasswordsSaving = false;
  rolePasswordsSaved = false;
  weeklyPaymentTargetFc = 600000;
  weeklyPaymentTargetInput = '';
  weeklyPaymentTargetSaving = false;
  weeklyPaymentTargetSaved = false;
  monthlyBudgetGlobalInput = '';
  monthlyBudgetGlobalSaving = false;
  monthlyBudgetGlobalSaved = false;
  monthlyBudgetLocationId = '';
  monthlyBudgetLocationInput = '';
  monthlyBudgetLocationSaving = false;
  monthlyBudgetLocationSaved = false;
  selectedBudgetLocation?: User;
  ngOnInit(): void {
    if (this.auth.isAdmin) {
      this.auth.getAllUsersInfo().subscribe((data) => {
        this.allUsers = data;
        this.initalizeInputs();
      });
      this.auth.rolePasswords$.subscribe((payload) => {
        this.rolePasswords = { ...payload };
      });
    }
    this.auth.weeklyPaymentTarget$.subscribe((value) => {
      this.weeklyPaymentTargetFc = value;
    });
  }

  totalPerfomance: number = 0;
  linkPaths: string[] = [
    '/client-info-current',
    '/add-expense',
    '/add-reserve',
    '/client-info-current',
    '/client-info-current',
  ];
  summary: string[] = [
    'Epargne Clients',
    'Depenses',
    'Reserve',
    'Argent en Main',
    'Benefice Réel',
  ];
  valuesConvertedToDollars: number[] = [];

  imagePaths: string[] = [
    '../../../assets/img/saving.svg',
    '../../../assets/img/expense.svg',
    '../../../assets/img/reserve.svg',
    '../../../assets/img/salary.png',
    '../../../assets/img/revenue.svg',
  ];

  today = this.time.todaysDateMonthDayYear();
  summaryContent: number[] = [];
  initalizeInputs() {
    const savings =
      coerceToNumber(
        this.compute.findTotalAllUsersGivenField(this.allUsers, 'clientsSavings')
      ) ?? 0;
    const expenses =
      coerceToNumber(
        this.compute.findTotalAllUsersGivenField(this.allUsers, 'expensesAmount')
      ) ?? 0;
    const reserveDollar =
      coerceToNumber(
        this.compute.findTotalAllUsersGivenField(
          this.allUsers,
          'reserveAmountDollar'
        )
      ) ?? 0;
    const moneyHand =
      coerceToNumber(
        this.compute.findTotalAllUsersGivenField(this.allUsers, 'moneyInHands')
      ) ?? 0;
    const invested =
      coerceToNumber(
        this.compute.findTotalAllUsersGivenField(this.allUsers, 'amountInvested')
      ) ?? 0;
    const debtTotal =
      coerceToNumber(
        this.compute.findTotalAllUsersGivenField(this.allUsers, 'totalDebtLeft')
      ) ?? 0;
    const cardM =
      coerceToNumber(
        this.compute.findTotalAllUsersGivenField(this.allUsers, 'cardsMoney')
      ) ?? 0;

    const realBenefit = debtTotal - invested;

    const enMain = moneyHand + cardM;
    const reserveCdf =
      coerceToNumber(
        this.compute.convertUsDollarsToCongoleseFranc(reserveDollar.toString())
      ) ?? 0;

    this.summaryContent = [
      savings,
      expenses,
      reserveCdf,
      enMain,
      realBenefit,
    ];

    this.valuesConvertedToDollars = [
      coerceToNumber(
        this.compute.convertCongoleseFrancToUsDollars(savings.toString())
      ) ?? 0,
      coerceToNumber(
        this.compute.convertCongoleseFrancToUsDollars(expenses.toString())
      ) ?? 0,
      reserveDollar,
      coerceToNumber(
        this.compute.convertCongoleseFrancToUsDollars(enMain.toString())
      ) ?? 0,
      coerceToNumber(
        this.compute.convertCongoleseFrancToUsDollars(realBenefit.toString())
      ) ?? 0,
    ];
  }

  saveRolePasswords(): void {
    if (!this.auth.isAdmin) return;
    if (this.rolePasswordsSaving) return;
    this.rolePasswordsSaving = true;
    this.rolePasswordsSaved = false;

    const payload = {
      admin: this.rolePasswords.admin.trim(),
      gestion: this.rolePasswords.gestion.trim(),
      investigator: this.rolePasswords.investigator.trim(),
    };

    this.auth
      .updateRolePasswords(payload)
      .then(() => {
        this.rolePasswordsSaved = true;
      })
      .catch((err) => {
        console.error('Failed to update role passwords:', err);
        alert("Impossible d'enregistrer les mots de passe.");
      })
      .finally(() => {
        this.rolePasswordsSaving = false;
      });
  }

  saveWeeklyPaymentTargetGlobal(): void {
    if (!this.auth.isAdmin) return;
    if (this.weeklyPaymentTargetSaving) return;
    const value = Number(this.weeklyPaymentTargetInput);
    if (!Number.isFinite(value) || value <= 0) {
      alert('Entrez un montant valide.');
      return;
    }

    this.weeklyPaymentTargetSaving = true;
    this.weeklyPaymentTargetSaved = false;
    this.auth
      .updateWeeklyPaymentTargetGlobal(value)
      .then(() => {
        this.weeklyPaymentTargetSaved = true;
        this.weeklyPaymentTargetInput = '';
      })
      .catch((err) => {
        console.error('Failed to update weekly payment target:', err);
        alert("Impossible d'enregistrer le montant.");
      })
      .finally(() => {
        this.weeklyPaymentTargetSaving = false;
      });
  }

  onBudgetLocationChange(userId: string): void {
    this.selectedBudgetLocation = this.allUsers.find(
      (user) => user.uid === userId
    );
    this.monthlyBudgetLocationSaved = false;
  }

  saveMonthlyBudgetGlobal(): void {
    if (!this.auth.isAdmin) return;
    if (this.monthlyBudgetGlobalSaving) return;
    const value = Number(this.monthlyBudgetGlobalInput);
    if (!Number.isFinite(value) || value <= 0) {
      alert('Entrez un montant valide.');
      return;
    }
    const payload = value.toString();
    const userIds = this.allUsers.map((user) => user.uid || '').filter(Boolean);
    if (!userIds.length) {
      alert('Aucun site trouvé.');
      return;
    }

    this.monthlyBudgetGlobalSaving = true;
    this.monthlyBudgetGlobalSaved = false;
    this.auth
      .updateUsersFieldBulk(userIds, 'monthBudget', payload)
      .then(() => {
        this.monthlyBudgetGlobalSaved = true;
        this.monthlyBudgetGlobalInput = '';
        this.allUsers = this.allUsers.map((user) => ({
          ...user,
          monthBudget: payload,
        }));
        if (this.selectedBudgetLocation) {
          this.selectedBudgetLocation = {
            ...this.selectedBudgetLocation,
            monthBudget: payload,
          };
        }
      })
      .catch((err) => {
        console.error('Failed to update monthly budget global:', err);
        alert("Impossible d'enregistrer le budget global.");
      })
      .finally(() => {
        this.monthlyBudgetGlobalSaving = false;
      });
  }

  saveMonthlyBudgetForLocation(): void {
    if (!this.auth.isAdmin) return;
    if (this.monthlyBudgetLocationSaving) return;
    const value = Number(this.monthlyBudgetLocationInput);
    if (!Number.isFinite(value) || value <= 0) {
      alert('Entrez un montant valide.');
      return;
    }
    if (!this.monthlyBudgetLocationId) {
      alert('Choisissez un site.');
      return;
    }
    const payload = value.toString();

    this.monthlyBudgetLocationSaving = true;
    this.monthlyBudgetLocationSaved = false;
    this.auth
      .updateUserFieldForUserId(
        this.monthlyBudgetLocationId,
        'monthBudget',
        payload
      )
      .then(() => {
        this.monthlyBudgetLocationSaved = true;
        this.monthlyBudgetLocationInput = '';
        this.allUsers = this.allUsers.map((user) =>
          user.uid === this.monthlyBudgetLocationId
            ? { ...user, monthBudget: payload }
            : user
        );
        this.onBudgetLocationChange(this.monthlyBudgetLocationId);
      })
      .catch((err) => {
        console.error('Failed to update monthly budget for location:', err);
        alert("Impossible d'enregistrer le budget du site.");
      })
      .finally(() => {
        this.monthlyBudgetLocationSaving = false;
      });
  }
}
