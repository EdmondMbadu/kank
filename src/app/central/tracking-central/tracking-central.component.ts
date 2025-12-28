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
}
