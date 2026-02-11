import { Component, OnInit } from '@angular/core';
import { Management } from 'src/app/models/management';
import { AuthService } from 'src/app/services/auth.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { User } from 'src/app/models/user';

interface FraudEntry {
  key: string;
  amount: number;
  reason: string;
  location: string;
  dateLabel: string;
  month: number;
  year: number;
}

@Component({
  selector: 'app-gestion-fraude',
  templateUrl: './gestion-fraude.component.html',
  styleUrls: ['./gestion-fraude.component.css'],
})
export class GestionFraudeComponent implements OnInit {
  fraudAmount: string = '';
  fraudReason: string = '';
  fraudLocation: string = '';
  managementInfo?: Management = {};
  showAllFraudes = false;
  isSaving = false;
  editingEntryKey: string | null = null;

  selectedMonth: number = new Date().getMonth() + 1;
  selectedYear: number = new Date().getFullYear();
  selectedLocationFilter: string = 'Total';
  personNameFilter: string = '';
  locations: string[] = ['Total'];
  siteLocations: string[] = ['Total'];
  yearsList: number[] = [];

  allEntries: FraudEntry[] = [];
  filteredEntries: FraudEntry[] = [];
  monthTotalFiltered = 0;

  constructor(
    public auth: AuthService,
    private data: DataService,
    public time: TimeService,
    private compute: ComputationService
  ) {}

  ngOnInit(): void {
    this.yearsList = this.time.yearsList;
    this.auth.getAllUsersInfo().subscribe((users) => {
      const names = (Array.isArray(users) ? (users as User[]) : [])
        .map((u) => (u.firstName || u.email || 'Site').trim())
        .filter((v) => !!v)
        .sort((a, b) => a.localeCompare(b, 'fr'));
      this.siteLocations = ['Total', ...Array.from(new Set(names))];
      if (!this.fraudLocation && this.siteLocations.length) {
        this.fraudLocation = this.siteLocations[0];
      }
      this.rebuildEntries();
    });
    this.auth.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
      this.rebuildEntries();
    });
  }

  async saveFraud() {
    if (this.fraudAmount === '' || this.fraudReason.trim() === '') {
      alert('Fill all fields!');
      return;
    }
    if (isNaN(Number(this.fraudAmount))) {
      alert('Enter a valid number!');
      return;
    }
    if (this.fraudLocation.trim() === '') {
      alert('Veuillez renseigner une localisation.');
      return;
    }

    const amount = Number(this.fraudAmount);
    const reason = this.fraudReason.trim();
    const location = this.fraudLocation.trim();

    const conf = confirm(
      this.editingEntryKey
        ? `Modifier cette entrée de fraude (${amount} FC) ?`
        : `Ajouter une fraude de ${amount} FC pour "${reason}" (${location}) ?`
    );
    if (!conf) return;

    this.isSaving = true;
    try {
      if (this.editingEntryKey) {
        await this.data.updateManagementFraudEntry(
          this.editingEntryKey,
          amount.toString(),
          reason,
          location
        );
        alert('Entrée de fraude modifiée avec succès.');
      } else {
        await this.data.updateManagementInfoForAddFraud(
          amount.toString(),
          reason,
          location
        );
        alert('Fraude ajoutée avec succès.');
      }
      this.resetForm();
    } catch (err) {
      console.error('Erreur lors de la sauvegarde de la fraude', err);
      alert("Erreur lors de l'enregistrement.");
    } finally {
      this.isSaving = false;
    }
  }

  startEdit(entry: FraudEntry) {
    this.editingEntryKey = entry.key;
    this.fraudAmount = entry.amount.toString();
    this.fraudReason = entry.reason;
    this.fraudLocation = entry.location;
  }

  cancelEdit() {
    this.resetForm();
  }

  async deleteEntry(entry: FraudEntry) {
    const conf = confirm(
      `Supprimer la fraude de ${entry.amount} FC (${entry.location}) ?`
    );
    if (!conf) return;

    this.isSaving = true;
    try {
      await this.data.deleteManagementFraudEntry(entry.key);
      if (this.editingEntryKey === entry.key) {
        this.resetForm();
      }
    } catch (err) {
      console.error('Erreur lors de la suppression de la fraude', err);
      alert('Erreur lors de la suppression.');
    } finally {
      this.isSaving = false;
    }
  }

  applyFilters() {
    this.filteredEntries = this.allEntries.filter((entry) => {
      const monthMatch =
        entry.month === this.selectedMonth && entry.year === this.selectedYear;
      const locationMatch =
        this.selectedLocationFilter === 'Total' ||
        entry.location === this.selectedLocationFilter;
      const personMatch =
        this.personNameFilter.trim() === '' ||
        entry.reason
          .toLowerCase()
          .includes(this.personNameFilter.trim().toLowerCase());
      return monthMatch && locationMatch && personMatch;
    });
    this.monthTotalFiltered = this.filteredEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0
    );
  }

  hasMoreFraudes(): boolean {
    return this.filteredEntries.length > 3;
  }

  private resetForm() {
    this.fraudAmount = '';
    this.fraudReason = '';
    this.fraudLocation = '';
    this.editingEntryKey = null;
  }

  private rebuildEntries() {
    const source = this.managementInfo?.fraudes || {};
    const sorted = this.compute.sortArrayByDateDescendingOrder(
      Object.entries(source)
    );

    this.allEntries = sorted.map(([key, raw]) => {
      const parsed = this.parseFraudValue(raw || '');
      const [month, , year] = key.split('-').map((v) => Number(v));
      return {
        key,
        amount: parsed.amount,
        reason: parsed.reason,
        location: parsed.location,
        dateLabel: this.time.convertTimeFormat(key),
        month: Number.isFinite(month) ? month : 0,
        year: Number.isFinite(year) ? year : 0,
      };
    });

    const uniqueLocations = Array.from(
      new Set(
        this.allEntries
          .map((entry) => entry.location)
          .filter((location) => !!location)
      )
    ).sort((a, b) => a.localeCompare(b, 'fr'));

    this.locations = Array.from(
      new Set(['Total', ...(this.siteLocations || []), ...uniqueLocations])
    );
    if (!this.locations.includes(this.selectedLocationFilter)) {
      this.selectedLocationFilter = 'Total';
    }

    this.applyFilters();
  }

  private parseFraudValue(raw: string): {
    amount: number;
    reason: string;
    location: string;
  } {
    if (!raw) {
      return { amount: 0, reason: '', location: 'Non renseignée' };
    }

    const firstColon = raw.indexOf(':');
    if (firstColon === -1) {
      return {
        amount: Number(raw) || 0,
        reason: '',
        location: 'Non renseignée',
      };
    }

    const lastColon = raw.lastIndexOf(':');
    if (lastColon === firstColon) {
      return {
        amount: Number(raw.slice(0, firstColon)) || 0,
        reason: raw.slice(firstColon + 1),
        location: 'Non renseignée',
      };
    }

    return {
      amount: Number(raw.slice(0, firstColon)) || 0,
      reason: raw.slice(firstColon + 1, lastColon),
      location: raw.slice(lastColon + 1) || 'Non renseignée',
    };
  }
}
