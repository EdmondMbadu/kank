import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { FormControl } from '@angular/forms';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { User } from 'src/app/models/user';

interface InvestmentHistoryEntry {
  key: string;
  amount: number;
  amountUsd: number;
  formattedDate: string;
}

@Component({
  selector: 'app-amount-invested',
  templateUrl: './amount-invested.component.html',
  styleUrls: ['./amount-invested.component.css'],
})
export class AmountInvestedComponent implements OnInit {
  investmentAddAmount: string = '';
  currentUser: User | null = null;
  searchControl = new FormControl();
  investmentEntries: InvestmentHistoryEntry[] = [];
  showDeleteModal = false;
  pendingDeleteEntry: InvestmentHistoryEntry | null = null;
  deletingEntryKey: string | null = null;

  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private compute: ComputationService,
    private time: TimeService
  ) {
    this.getCurrentUser();
  }

  ngOnInit(): void {}

  get visibleInvestmentEntries(): InvestmentHistoryEntry[] {
    const query = (this.searchControl.value || '').toString().trim().toLowerCase();
    const filtered = this.investmentEntries.filter((entry) => {
      if (!query) return true;

      return (
        entry.formattedDate.toLowerCase().includes(query) ||
        entry.key.toLowerCase().includes(query) ||
        entry.amount.toString().includes(query)
      );
    });

    return this.auth.isAdmninistrator ? filtered : filtered.slice(0, 2);
  }

  async addInvestment() {
    if (this.investmentAddAmount === '') {
      alert('Remplissez toutes les données!');
      return;
    } else if (isNaN(Number(this.investmentAddAmount))) {
      alert('Entrez un nombre valide!');
      return;
    } else {
      let conf = confirm(
        ` Vous ajouter un montant de ${this.investmentAddAmount} FC pour l'investissement. Voulez-vous quand même continuer ?`
      );
      if (!conf) {
        return;
      }
      await this.data.updateUserInfoForAddInvestment(this.investmentAddAmount);
      this.router.navigate(['/home']);
    }
  }

  getCurrentUser() {
    this.auth.user$.subscribe((user) => {
      this.currentUser = user ?? null;

      const investments = this.currentUser?.investments ?? {};
      const investmentsDollar = this.currentUser?.investmentsDollar ?? {};

      let investmentsArray = Object.entries(investments).map(
        ([key, value]): [string, string] => [key, String(value)]
      );

      investmentsArray =
        this.compute.sortArrayByDateDescendingOrder(investmentsArray);

      this.investmentEntries = investmentsArray.map(([key, value]) => {
        const amount = Number(value) || 0;
        const amountUsd = Number(
          investmentsDollar[key] ??
            this.compute.convertCongoleseFrancToUsDollars(amount.toString())
        );
        const keyParts = key.split('-');
        const formattedDate =
          keyParts.length >= 6
            ? this.time.convertDateToDesiredFormat(key)
            : this.time.convertTimeFormat(
                `${key}-0-0-0`
              );

        return {
          key,
          amount,
          amountUsd: Number.isNaN(amountUsd) ? 0 : amountUsd,
          formattedDate,
        };
      });
    });
  }

  openDeleteModal(entry: InvestmentHistoryEntry, event: Event): void {
    event.stopPropagation();
    if (!this.auth.isAdmin || this.deletingEntryKey) return;

    this.pendingDeleteEntry = entry;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    if (this.deletingEntryKey) return;

    this.showDeleteModal = false;
    this.pendingDeleteEntry = null;
  }

  async confirmDeleteInvestment(
    affectMoneyInHands: boolean
  ): Promise<void> {
    const entry = this.pendingDeleteEntry;
    if (!entry) return;

    try {
      this.deletingEntryKey = entry.key;
      await this.data.deleteUserInvestmentEntry(
        entry.key,
        affectMoneyInHands
      );
      this.showDeleteModal = false;
      this.pendingDeleteEntry = null;
    } catch (error) {
      alert("Une erreur s'est produite lors de la suppression.");
    } finally {
      this.deletingEntryKey = null;
    }
  }

  trackByInvestmentKey(_: number, entry: InvestmentHistoryEntry): string {
    return entry.key;
  }
}
