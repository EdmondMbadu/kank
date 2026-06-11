import { Component, OnDestroy, OnInit } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Certificate, Employee, Trophy } from 'src/app/models/employee';
import { Client } from 'src/app/models/client';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { combineLatest, Subscription } from 'rxjs';

type TrophyModalType = 'team' | 'employee' | 'all';
type TrophyModalEntry = {
  trophy: Trophy;
  type: Exclude<TrophyModalType, 'all'>;
};
type TrophyHeatmapTile = {
  employee: Employee;
  name: string;
  initials: string;
  photoUrl: string;
  total: number;
  teamCount: number;
  employeeCount: number;
  latestLabel: string;
  latestTypeLabel: string;
  colorClass: string;
  layoutStyle: Record<string, string>;
};
type TrophyHeatmapStats = {
  totalTrophies: number;
  employeesWithTrophies: number;
  topCount: number;
};
type TrophyHistoryScope = 'employees' | 'teams' | 'clients';
type ClientTrophyRow = {
  client: Client;
  name: string;
  initials: string;
  photoUrl: string;
  locationName: string;
  phoneNumber: string;
  stars: number;
  creditScore: string;
  debtLeft: number;
  loanAmount: number;
  latestAwardLabel: string;
  colorClass: string;
  layoutStyle: Record<string, string>;
};
type ClientTrophyStats = {
  totalStars: number;
  clientsWithStars: number;
  topStars: number;
};
type ClientTrophyTeamRow = {
  teamName: string;
  clients: ClientTrophyRow[];
  clientsWithStars: number;
  totalStars: number;
  topStars: number;
  topClientName: string;
  averageStars: number;
  colorClass: string;
  layoutStyle: Record<string, string>;
};
type ClientTrophyTeamStats = {
  totalStars: number;
  teamsWithStars: number;
  topTeamStars: number;
};
type TrophyHeatmapRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

@Component({
  selector: 'app-certificate',
  templateUrl: './certificate.component.html',
  styleUrls: ['./certificate.component.css'],
})
export class CertificateComponent implements OnInit, OnDestroy {
  constructor(
    public auth: AuthService,
    private storage: AngularFireStorage,
    private data: DataService,
    public time: TimeService,
    private compute: ComputationService
  ) {}

  selectedBest: Certificate = {};
  best: any = {};
  url: string = '';
  certificateId: string = '';
  certificates: Certificate[] = [];
  months?: number[] = [];

  years: string[] = [];
  // note that currentMonth and currentYear, here means the previous one
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth();
  currentYear = this.currentDate.getFullYear();
  givenMonth = this.currentMonth - 1;
  givenYear = this.currentYear;
  month?: number = this.givenMonth;
  monthsList: number[] = [...Array(12).keys()];
  yearsList: number[] = this.time.yearsList;
  year = this.currentDate.getFullYear();
  preposition: string = 'De';
  formError = '';
  isSaving = false;

  certificate: Certificate = this.createEmptyCertificate();
  displayAddTeam: boolean = false;
  allUsers: User[] = [];
  allEmployeesAll: Employee[] = [];
  employeesLoading = false;
  private userSub?: Subscription;
  private certificateSub?: Subscription;
  private employeeSubs: Subscription[] = [];
  private clientTrophySub?: Subscription;
  private trophyHeatmapCacheKey = '';
  private trophyHeatmapCache: TrophyHeatmapTile[] = [];
  trophyHistoryScope: TrophyHistoryScope = 'employees';
  clientTrophyLoading = false;
  clientTrophyError = '';
  private clientTrophyRowsCacheKey = '';
  private clientTrophyRowsCache: ClientTrophyRow[] = [];
  private clientTrophyTeamRowsCache: ClientTrophyTeamRow[] = [];
  private clientTrophyLoaded = false;
  private clientTrophyLoadKey = '';
  selectedClientTrophyRow: ClientTrophyRow | null = null;
  selectedClientTrophyTeamRow: ClientTrophyTeamRow | null = null;

  trophyModalVisible = false;
  trophyModalType: TrophyModalType | null = null;
  trophyModalEmployee: Employee | null = null;

  get editingSelectedCertificate(): boolean {
    return !!this.findCertificateForSelection();
  }

  get modalActionLabel(): string {
    return this.editingSelectedCertificate ? 'Mettre à jour' : 'Ajouter';
  }

  get selectedAwardCount(): number {
    if (!this.selectedBest) return 0;
    return [
      this.selectedBest.bestTeam,
      this.selectedBest.bestEmployee,
      this.selectedBest.bestManager,
    ].filter((value) => !!value?.trim()).length;
  }

  get currentEmployeeWinnerName(): string {
    return this.selectedBest?.bestEmployee?.trim() || 'À compléter';
  }

  get trophyHeatmapTiles(): TrophyHeatmapTile[] {
    const employees = this.trophyHeatmapSourceEmployees();
    const key = employees
      .map((employee) =>
        [
          employee.uid || '',
          employee.status || '',
          this.trophyListSignature(employee.bestTeamTrophies),
          this.trophyListSignature(employee.bestEmployeeTrophies),
        ].join(':')
      )
      .join('|');

    if (this.trophyHeatmapCacheKey !== key) {
      this.trophyHeatmapCache = this.buildTrophyHeatmapTiles(employees);
      this.trophyHeatmapCacheKey = key;
    }

    return this.trophyHeatmapCache;
  }

  get trophyHeatmapStats(): TrophyHeatmapStats {
    const tiles = this.trophyHeatmapTiles;
    return {
      totalTrophies: tiles.reduce((total, tile) => total + tile.total, 0),
      employeesWithTrophies: tiles.length,
      topCount: tiles[0]?.total || 0,
    };
  }

  get clientTrophyRows(): ClientTrophyRow[] {
    return this.clientTrophyRowsCache;
  }

  get clientTrophyStats(): ClientTrophyStats {
    const rows = this.clientTrophyRows;
    return {
      totalStars: rows.reduce((total, row) => total + row.stars, 0),
      clientsWithStars: rows.length,
      topStars: rows[0]?.stars || 0,
    };
  }

  get clientTrophyTeamRows(): ClientTrophyTeamRow[] {
    return this.clientTrophyTeamRowsCache;
  }

  get clientTrophyTeamStats(): ClientTrophyTeamStats {
    const rows = this.clientTrophyTeamRows;
    return {
      totalStars: rows.reduce((total, row) => total + row.totalStars, 0),
      teamsWithStars: rows.length,
      topTeamStars: rows[0]?.totalStars || 0,
    };
  }

  get modalTotalTrophyCount(): number {
    return this.modalTeamTrophyCount + this.modalEmployeeTrophyCount;
  }

  get modalTeamTrophyCount(): number {
    return this.trophyModalEmployee?.bestTeamTrophies?.length || 0;
  }

  get modalEmployeeTrophyCount(): number {
    return this.trophyModalEmployee?.bestEmployeeTrophies?.length || 0;
  }

  get selectedTrophyModalEmployeeName(): string {
    return this.formatEmployeeName(this.trophyModalEmployee);
  }

  ngOnInit(): void {
    if (this.givenMonth < 0) {
      this.givenMonth = 11; // December
      this.givenYear -= 1; // Decrease the year
    }
    this.resetCertificateDraft();
    this.certificateSub = this.auth.getCertificateInfo().subscribe((data) => {
      this.best = data;
      this.certificateId = this.best?.[0]?.certificateId || '';
      this.certificates = (this.best?.[0]?.certificate ?? []).map(
        (item: Certificate) => this.sanitizeCertificate(item)
      );
      this.months = [
        ...new Set(this.certificates.map((item: any) => item.month)),
      ];
      this.years = [
        ...new Set(this.certificates.map((item: any) => item.year)),
      ];

      this.updateSelection();
    });
    this.userSub = this.auth.getAllUsersInfo().subscribe((data) => {
      this.allUsers = data || [];
      this.getAllEmployees();
    });
  }

  ngOnDestroy(): void {
    this.certificateSub?.unsubscribe();
    this.userSub?.unsubscribe();
    this.clientTrophySub?.unsubscribe();
    this.employeeSubs.forEach((sub) => sub.unsubscribe());
    this.employeeSubs = [];
  }

  private createEmptyCertificate(): Certificate {
    return {
      month: '',
      year: '',
      bestTeam: '',
      bestEmployee: '',
      bestEmployeePerformance: '',
      bestTeamCertificatePath: '',
      bestTeamCertificateDownloadUrl: '',
      bestEmployeeCertificatePath: '',
      bestEmployeeCertificateDownloadUrl: '',
      bestManagerCertificatePath: '',
      bestManagerCertificateDownloadUrl: '',
    };
  }

  private sanitizeText(value?: string): string {
    return value?.trim() ?? '';
  }

  private sanitizeCertificate(certificate?: Certificate): Certificate {
    return {
      month: this.sanitizeText(certificate?.month),
      year: this.sanitizeText(certificate?.year),
      bestTeam: this.sanitizeText(certificate?.bestTeam),
      bestEmployee: this.sanitizeText(certificate?.bestEmployee),
      bestEmployeePerformance: this.sanitizeText(
        certificate?.bestEmployeePerformance
      ),
      bestManager: this.sanitizeText(certificate?.bestManager),
      bestTeamCertificatePath: this.sanitizeText(
        certificate?.bestTeamCertificatePath
      ),
      bestTeamCertificateDownloadUrl: this.sanitizeText(
        certificate?.bestTeamCertificateDownloadUrl
      ),
      bestEmployeeCertificatePath: this.sanitizeText(
        certificate?.bestEmployeeCertificatePath
      ),
      bestEmployeeCertificateDownloadUrl: this.sanitizeText(
        certificate?.bestEmployeeCertificateDownloadUrl
      ),
      bestManagerCertificatePath: this.sanitizeText(
        certificate?.bestManagerCertificatePath
      ),
      bestManagerCertificateDownloadUrl: this.sanitizeText(
        certificate?.bestManagerCertificateDownloadUrl
      ),
    };
  }

  private getSelectedMonthLabel(): string {
    return this.time.monthFrenchNames[this.givenMonth] ?? '';
  }

  private findCertificateForSelection(): Certificate | undefined {
    return this.certificates.find(
      (item) =>
        item.month === this.getSelectedMonthLabel() &&
        item.year === this.givenYear.toString()
    );
  }

  resetCertificateDraft(): void {
    this.certificate = this.sanitizeCertificate({
      ...this.createEmptyCertificate(),
      month: this.getSelectedMonthLabel(),
      year: this.givenYear.toString(),
    });
    this.formError = '';
  }

  openAddCertificateModal(): void {
    const existingCertificate = this.findCertificateForSelection();
    this.certificate = existingCertificate
      ? this.sanitizeCertificate(existingCertificate)
      : this.sanitizeCertificate({
          ...this.createEmptyCertificate(),
          month: this.getSelectedMonthLabel(),
          year: this.givenYear.toString(),
        });
    this.formError = '';
    this.displayAddTeam = true;
  }

  closeAddCertificateModal(): void {
    this.displayAddTeam = false;
    this.resetCertificateDraft();
  }

  updateSelection() {
    this.selectedBest = this.selectTeamAndEmployeeByMonthAndYear(
      this.certificates,
      this.time.monthFrenchNames[this.givenMonth],
      this.givenYear.toString()
    );
    this.preposition = this.time.findPrepositionStartWithVowelOrConsonant(
      this.time.monthFrenchNames[this.givenMonth]
    );
  }

  selectTeamAndEmployeeByMonthAndYear(
    certificate: Certificate[],
    userEnteredMonth: string,
    userEnteredYear: string
  ) {
    const selectedObject = certificate.find(
      (item) => item.month === userEnteredMonth && item.year === userEnteredYear
    );
    return selectedObject!;
  }

  private getAllEmployees(): void {
    this.employeeSubs.forEach((sub) => sub.unsubscribe());
    this.employeeSubs = [];

    const owners =
      Array.isArray(this.allUsers) && this.allUsers.length > 0
        ? this.allUsers.filter((user) => !!user?.uid)
        : this.auth.currentUser
        ? [this.auth.currentUser as User]
        : [];

    if (!owners.length) {
      this.allEmployeesAll = [];
      this.trophyHeatmapCacheKey = '';
      this.trophyHeatmapCache = [];
      return;
    }

    this.employeesLoading = true;
    const sub = combineLatest(
      owners.map((owner) => this.auth.getAllEmployeesGivenUser(owner))
    ).subscribe({
      next: (employeeGroups) => {
        const employeesByKey = new Map<string, Employee>();

        employeeGroups.forEach((employees, ownerIndex) => {
          const owner = owners[ownerIndex];
          const employeeList: Employee[] = Array.isArray(employees)
            ? (employees as Employee[])
            : [];

          employeeList.forEach((employee) => {
            const key =
              employee.uid ||
              `${employee.firstName || ''}|${employee.lastName || ''}|${
                employee.trackingId || ''
              }`;
            if (!key || employeesByKey.has(key)) return;
            employeesByKey.set(key, {
              ...employee,
              tempUser: owner,
              tempLocationHolder: owner.firstName,
            });
          });
        });

        this.allEmployeesAll = Array.from(employeesByKey.values());
        this.trophyHeatmapCacheKey = '';
        this.employeesLoading = false;
      },
      error: () => {
        this.allEmployeesAll = [];
        this.trophyHeatmapCacheKey = '';
        this.trophyHeatmapCache = [];
        this.employeesLoading = false;
      },
    });
    this.employeeSubs.push(sub);
  }

  openTrophyModal(employee: Employee, type: TrophyModalType): void {
    this.trophyModalEmployee = employee;
    this.trophyModalType = type;
    this.trophyModalVisible = true;
  }

  closeTrophyModal(): void {
    this.trophyModalVisible = false;
    this.trophyModalType = null;
    this.trophyModalEmployee = null;
  }

  setTrophyHistoryScope(scope: TrophyHistoryScope): void {
    if (this.trophyHistoryScope === scope) return;
    this.trophyHistoryScope = scope;
    if (scope === 'clients' || scope === 'teams') {
      this.loadClientTrophyRows();
    }
  }

  openClientTrophyModal(row: ClientTrophyRow): void {
    this.selectedClientTrophyRow = row;
  }

  closeClientTrophyModal(): void {
    this.selectedClientTrophyRow = null;
  }

  openClientTrophyTeamModal(row: ClientTrophyTeamRow): void {
    this.selectedClientTrophyTeamRow = row;
  }

  closeClientTrophyTeamModal(): void {
    this.selectedClientTrophyTeamRow = null;
  }

  employeeInitials(employee?: Employee | null): string {
    const first = (employee?.firstName || '').trim();
    const last = (employee?.lastName || '').trim();
    return `${first ? first[0] : ''}${last ? last[0] : ''}`.toUpperCase() || '•';
  }

  employeePhotoUrl(employee?: Employee | null): string {
    return employee?.profilePicture?.downloadURL || '';
  }

  getModalTrophies(): Trophy[] {
    if (!this.trophyModalType || !this.trophyModalEmployee) return [];
    return this.getModalTrophyEntries().map((entry) => entry.trophy);
  }

  getModalTrophyEntries(): TrophyModalEntry[] {
    if (!this.trophyModalType || !this.trophyModalEmployee) return [];

    const teamEntries = (this.trophyModalEmployee.bestTeamTrophies || []).map(
      (trophy) => ({ trophy, type: 'team' as const })
    );
    const employeeEntries = (
      this.trophyModalEmployee.bestEmployeeTrophies || []
    ).map((trophy) => ({ trophy, type: 'employee' as const }));

    const entries =
      this.trophyModalType === 'team'
        ? teamEntries
        : this.trophyModalType === 'employee'
        ? employeeEntries
        : [...teamEntries, ...employeeEntries];

    return entries.sort(
      (a, b) => this.trophySortValue(b.trophy) - this.trophySortValue(a.trophy)
    );
  }

  getModalTitle(): string {
    if (!this.trophyModalType) return '';
    if (this.trophyModalType === 'all') return 'Historique des trophées';
    return this.trophyModalType === 'team'
      ? 'Trophées Meilleure Équipe'
      : 'Trophées Meilleur Employé';
  }

  getTrophyEntryLabel(type: Exclude<TrophyModalType, 'all'>): string {
    return type === 'team' ? 'Meilleure Équipe' : 'Meilleur Employé';
  }

  getTrophyEntryClasses(type: Exclude<TrophyModalType, 'all'>): string {
    return type === 'team'
      ? 'border-emerald-200 bg-emerald-50'
      : 'border-amber-200 bg-amber-50';
  }

  getTrophyEntryBadgeClasses(type: Exclude<TrophyModalType, 'all'>): string {
    return type === 'team'
      ? 'bg-gradient-to-br from-emerald-500 to-teal-700'
      : 'bg-gradient-to-br from-amber-400 to-yellow-600';
  }

  getTrophyDate(trophy: Trophy): string {
    if (!trophy || !trophy.month || !trophy.year) return '';
    const monthIndex = Number(trophy.month) - 1;
    const monthName =
      monthIndex >= 0 && monthIndex < 12
        ? this.time.monthFrenchNames[monthIndex]
        : trophy.month;
    return `${monthName} ${trophy.year}`;
  }

  private trophyHeatmapSourceEmployees(): Employee[] {
    const seen = new Set<string>();
    return (this.allEmployeesAll || []).filter((employee) => {
      if (!this.isTrophyHeatmapWorkingEmployee(employee)) return false;
      const key =
        employee.uid ||
        `${employee.firstName || ''}|${employee.lastName || ''}|${
          employee.trackingId || ''
        }`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private isTrophyHeatmapWorkingEmployee(employee: Employee): boolean {
    return (employee?.status || '').toLowerCase().trim() === 'travaille';
  }

  private buildTrophyHeatmapTiles(employees: Employee[]): TrophyHeatmapTile[] {
    const tiles = employees
      .map((employee) => {
        const teamCount = employee.bestTeamTrophies?.length || 0;
        const employeeCount = employee.bestEmployeeTrophies?.length || 0;
        const total = teamCount + employeeCount;
        const latest = this.latestTrophyEntry(employee);
        return {
          employee,
          name: this.formatEmployeeName(employee),
          initials: this.employeeInitials(employee),
          photoUrl: this.employeePhotoUrl(employee),
          total,
          teamCount,
          employeeCount,
          latestLabel: latest ? this.getTrophyDate(latest.trophy) : '',
          latestTypeLabel: latest ? this.getTrophyEntryLabel(latest.type) : '',
          colorClass: this.trophyHeatmapColorClass(teamCount, employeeCount, total),
          layoutStyle: {},
        };
      })
      .filter((tile) => tile.total > 0)
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

    const rects = this.buildTrophyTreemapRects(
      tiles.map((tile) => tile.total)
    );
    return tiles.map((tile, index) => ({
      ...tile,
      layoutStyle: this.trophyRectStyle(rects[index]),
    }));
  }

  private buildClientTrophyRows(clients: Client[]): ClientTrophyRow[] {
    const unique = new Map<string, Client>();
    clients.forEach((client) => {
      const key = this.clientUniqueKey(client);
      if (!unique.has(key)) unique.set(key, client);
    });

    const rows = Array.from(unique.values())
      .map((client) => {
        const stars = this.getStarsCount(client);
        const latestAward = this.latestClientTrophyAward(client);
        return {
          client,
          name: this.formatClientName(client),
          initials: this.clientInitials(client),
          photoUrl: this.clientPhotoUrl(client),
          locationName: client.locationName || 'Site non défini',
          phoneNumber: this.formatClientPhone(client.phoneNumber),
          stars,
          creditScore: client.creditScore || '',
          debtLeft: this.safeNumber(client.debtLeft),
          loanAmount: this.safeNumber(client.loanAmount),
          latestAwardLabel: latestAward
            ? this.formatClientTrophyAwardDate(latestAward)
            : '',
          colorClass: this.clientTrophyColorClass(stars),
          layoutStyle: {},
        };
      })
      .filter((row) => row.stars > 0)
      .sort(
        (a, b) =>
          b.stars - a.stars ||
          (b.creditScore || '').localeCompare(a.creditScore || '') ||
          a.name.localeCompare(b.name)
      );

    const rects = this.buildTrophyTreemapRects(
      rows.map((row) => Math.max(row.stars, 1))
    );
    return rows.map((row, index) => ({
      ...row,
      layoutStyle: this.trophyRectStyle(rects[index]),
    }));
  }

  private buildClientTrophyTeamRows(
    clientRows: ClientTrophyRow[]
  ): ClientTrophyTeamRow[] {
    const teams = new Map<string, ClientTrophyRow[]>();
    clientRows.forEach((row) => {
      const teamName = row.locationName || 'Site non défini';
      teams.set(teamName, [...(teams.get(teamName) || []), row]);
    });

    const sortedRows = Array.from(teams.entries())
      .map(([teamName, rows]) => {
        const sortedClients = [...rows].sort(
          (a, b) =>
            b.stars - a.stars ||
            (b.creditScore || '').localeCompare(a.creditScore || '') ||
            a.name.localeCompare(b.name)
        );
        const totalStars = rows.reduce((total, row) => total + row.stars, 0);
        const topRow = sortedClients[0];
        return {
          teamName,
          clients: sortedClients,
          clientsWithStars: rows.length,
          totalStars,
          topStars: topRow?.stars || 0,
          topClientName: topRow?.name || '—',
          averageStars: rows.length ? totalStars / rows.length : 0,
          colorClass: '',
          layoutStyle: {},
        };
      })
      .sort(
        (a, b) =>
          b.totalStars - a.totalStars ||
          b.clientsWithStars - a.clientsWithStars ||
          a.teamName.localeCompare(b.teamName)
      );

    const rects = this.buildTrophyTreemapRects(
      sortedRows.map((row) => Math.max(row.clientsWithStars, 1))
    );

    return sortedRows.map((row, index) => ({
      ...row,
      colorClass: this.clientTrophyTeamColorClass(index),
      layoutStyle: this.trophyRectStyle(rects[index]),
    }));
  }

  private clientTrophyColorClass(stars: number): string {
    if (stars >= 5) return 'client-trophy-tile--legend';
    if (stars === 4) return 'client-trophy-tile--elite';
    if (stars === 3) return 'client-trophy-tile--strong';
    if (stars === 2) return 'client-trophy-tile--special';
    return 'client-trophy-tile--one';
  }

  private clientTrophyTeamColorClass(index: number): string {
    if (index === 0) return 'client-trophy-tile--legend';
    if (index === 1) return 'client-trophy-tile--elite';
    if (index === 2) return 'client-trophy-tile--strong';
    return 'client-trophy-tile--one';
  }

  private clientTrophyOwnerUsers(): User[] {
    return Array.isArray(this.allUsers) && this.allUsers.length > 0
      ? this.allUsers.filter((user) => !!user?.uid)
      : this.auth.currentUser?.uid
      ? [this.auth.currentUser as User]
      : [];
  }

  private clientTrophyOwnerKey(): string {
    return this.clientTrophyOwnerUsers()
      .map((user) => user.uid || '')
      .sort()
      .join('|');
  }

  private loadClientTrophyRows(): void {
    const owners = this.clientTrophyOwnerUsers();
    const loadKey = this.clientTrophyOwnerKey();
    if (!owners.length) {
      this.clientTrophyRowsCache = [];
      this.clientTrophyTeamRowsCache = [];
      this.clientTrophyRowsCacheKey = '';
      this.clientTrophyLoaded = false;
      this.selectedClientTrophyRow = null;
      this.selectedClientTrophyTeamRow = null;
      this.clientTrophyError = 'Aucun site disponible pour charger les clients.';
      return;
    }
    if (this.clientTrophyLoaded && this.clientTrophyLoadKey === loadKey) return;

    this.clientTrophySub?.unsubscribe();
    this.clientTrophyLoading = true;
    this.clientTrophyError = '';
    this.clientTrophySub = combineLatest(
      owners.map((owner) => this.auth.getClientsOfAUser(owner.uid!))
    ).subscribe({
      next: (clientGroups) => {
        const clients: Client[] = [];
        clientGroups.forEach((group, ownerIndex) => {
          const owner = owners[ownerIndex];
          const clientList = Array.isArray(group) ? (group as Client[]) : [];
          clientList.forEach((client) => {
            if (this.getStarsCount(client) <= 0) return;
            clients.push({
              ...client,
              locationName: client.locationName || owner.firstName || '',
              locationOwnerId: client.locationOwnerId || owner.uid,
            });
          });
        });

        const key = clients
          .map((client) =>
            [
              this.clientUniqueKey(client),
              client.stars || '',
              Object.keys(client.trophyAwards || {}).join(','),
            ].join(':')
          )
          .sort()
          .join('|');

        if (this.clientTrophyRowsCacheKey !== key) {
          this.clientTrophyRowsCache = this.buildClientTrophyRows(clients);
          this.clientTrophyTeamRowsCache = this.buildClientTrophyTeamRows(
            this.clientTrophyRowsCache
          );
          this.clientTrophyRowsCacheKey = key;
          this.selectedClientTrophyRow = null;
          this.selectedClientTrophyTeamRow = null;
        }
        this.clientTrophyLoadKey = loadKey;
        this.clientTrophyLoaded = true;
        this.clientTrophyLoading = false;
      },
      error: () => {
        this.clientTrophyRowsCache = [];
        this.clientTrophyTeamRowsCache = [];
        this.clientTrophyError = 'Impossible de charger les clients étoilés.';
        this.clientTrophyLoading = false;
      },
    });
  }

  getStarsCount(client: Client | null | undefined): number {
    if (!client || client.stars === undefined || client.stars === null) return 0;
    const count = Number(client.stars);
    return Number.isFinite(count) && count > 0 ? count : 0;
  }

  private clientUniqueKey(client: Client): string {
    return (
      client.uid ||
      client.trackingId ||
      [
        client.locationOwnerId || '',
        client.firstName || '',
        client.lastName || '',
        client.phoneNumber || '',
      ].join('|')
    );
  }

  private formatClientName(client?: Client | null): string {
    if (!client) return '';
    const parts = [client.firstName, client.lastName, client.middleName]
      .map((value) => (value || '').trim())
      .filter(Boolean);
    return parts.join(' ') || client.name || 'Client';
  }

  private clientInitials(client?: Client | null): string {
    const first = (client?.firstName || client?.name || '').trim();
    const last = (client?.lastName || '').trim();
    const a = first ? first[0] : '';
    const b = last ? last[0] : '';
    return (a + b || 'C').toUpperCase();
  }

  private clientPhotoUrl(client?: Client | null): string {
    const picture = client?.profilePicture as
      | { downloadURL?: string }
      | string
      | undefined;
    if (!picture) return '';
    return typeof picture === 'string' ? picture : picture.downloadURL || '';
  }

  private formatClientPhone(raw?: string | null): string {
    if (!raw) return '—';
    const digits = `${raw}`.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return raw;
  }

  private latestClientTrophyAward(client: Client): any | null {
    const awards = Object.values(client.trophyAwards || {});
    if (!awards.length) return null;
    return awards.sort(
      (a: any, b: any) =>
        this.clientTrophyAwardSortValue(b) - this.clientTrophyAwardSortValue(a)
    )[0];
  }

  private clientTrophyAwardSortValue(award: any): number {
    const raw = award?.awardedOn || award?.createdAt || '';
    const parsed = raw ? new Date(raw) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed.getTime() : 0;
  }

  private formatClientTrophyAwardDate(award: any): string {
    const raw = award?.awardedOn || award?.createdAt || '';
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  private safeNumber(value?: string | number | null): number {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private trophyHeatmapColorClass(
    teamCount: number,
    employeeCount: number,
    total: number
  ): string {
    if (total >= 10) return 'trophy-tile--elite';
    if (employeeCount > teamCount) return 'trophy-tile--employee';
    if (teamCount > employeeCount) return 'trophy-tile--team';
    return 'trophy-tile--balanced';
  }

  private latestTrophyEntry(employee: Employee): TrophyModalEntry | null {
    const entries: TrophyModalEntry[] = [
      ...(employee.bestTeamTrophies || []).map((trophy) => ({
        trophy,
        type: 'team' as const,
      })),
      ...(employee.bestEmployeeTrophies || []).map((trophy) => ({
        trophy,
        type: 'employee' as const,
      })),
    ];
    if (!entries.length) return null;
    return entries.sort(
      (a, b) => this.trophySortValue(b.trophy) - this.trophySortValue(a.trophy)
    )[0];
  }

  private trophyListSignature(trophies?: Trophy[]): string {
    return (trophies || [])
      .map((trophy) => `${trophy.month || ''}-${trophy.year || ''}`)
      .sort()
      .join(',');
  }

  private buildTrophyTreemapRects(weights: number[]): TrophyHeatmapRect[] {
    const rects: TrophyHeatmapRect[] = weights.map(() => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }));
    const items = weights.map((weight, index) => ({
      index,
      weight: Math.max(weight, 1),
    }));

    this.partitionTrophyTreemap(items, { x: 0, y: 0, width: 100, height: 100 }, rects);
    return rects;
  }

  private partitionTrophyTreemap(
    items: Array<{ index: number; weight: number }>,
    rect: TrophyHeatmapRect,
    output: TrophyHeatmapRect[]
  ): void {
    if (!items.length) return;
    if (items.length === 1) {
      output[items[0].index] = rect;
      return;
    }

    const total = items.reduce((sum, item) => sum + item.weight, 0);
    const target = total / 2;
    let splitIndex = 1;
    let running = items[0].weight;

    for (let index = 1; index < items.length - 1; index++) {
      const next = running + items[index].weight;
      if (Math.abs(target - next) > Math.abs(target - running)) break;
      running = next;
      splitIndex = index + 1;
    }

    const first = items.slice(0, splitIndex);
    const second = items.slice(splitIndex);
    const firstWeight = first.reduce((sum, item) => sum + item.weight, 0);
    const ratio = total > 0 ? firstWeight / total : 0.5;

    if (rect.width >= rect.height) {
      const firstWidth = rect.width * ratio;
      this.partitionTrophyTreemap(first, { ...rect, width: firstWidth }, output);
      this.partitionTrophyTreemap(
        second,
        {
          x: rect.x + firstWidth,
          y: rect.y,
          width: rect.width - firstWidth,
          height: rect.height,
        },
        output
      );
    } else {
      const firstHeight = rect.height * ratio;
      this.partitionTrophyTreemap(first, { ...rect, height: firstHeight }, output);
      this.partitionTrophyTreemap(
        second,
        {
          x: rect.x,
          y: rect.y + firstHeight,
          width: rect.width,
          height: rect.height - firstHeight,
        },
        output
      );
    }
  }

  private trophyRectStyle(rect: TrophyHeatmapRect): Record<string, string> {
    return {
      left: `${rect.x}%`,
      top: `${rect.y}%`,
      width: `${rect.width}%`,
      height: `${rect.height}%`,
    };
  }

  private trophySortValue(trophy: Trophy): number {
    const year = Number(trophy?.year || 0);
    const month = Number(trophy?.month || 0);
    return year * 100 + month;
  }

  private formatEmployeeName(employee?: Employee | null): string {
    const name = `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim();
    return name || 'Employé';
  }

  async startUploadCertificate(event: FileList, id: string) {
    let prefix = id.replace(/^get/, '');
    const file = event?.item(0);
    console.log(' current file data', file);
    this.formError = '';

    if (file?.type.split('/')[0] !== 'image') {
      alert('Unsupported file type. Please upload an image.');
      return;
    }

    // the size cannot be greater than 20mb
    if (file?.size >= 20000000) {
      alert(
        "L'image est trop grande. La Taille maximale du fichier est de 20MB"
      );
      return;
    }
    const path = `certificates/Best-${prefix}-${this.certificate.month}-${this.certificate.year}`;

    // the main task
    console.log('the path', path);

    const uploadTask = await this.storage.upload(path, file);

    if (id === 'getEmploye') {
      this.certificate.bestEmployeeCertificateDownloadUrl =
        await uploadTask.ref.getDownloadURL();

      this.certificate.bestEmployeeCertificatePath = path;
    } else if (id === 'getTeam') {
      this.certificate.bestTeamCertificateDownloadUrl =
        await uploadTask.ref.getDownloadURL();
      uploadTask.totalBytes;

      this.certificate.bestTeamCertificatePath = path;
    } else {
      this.certificate.bestManagerCertificateDownloadUrl =
        await uploadTask.ref.getDownloadURL();
      uploadTask.totalBytes;

      this.certificate.bestManagerCertificatePath = path;
    }
  }
  onClick(id: string) {
    const fileInput = document.getElementById(id) as HTMLInputElement;
    fileInput.click();
  }

  private validateCertificate(): string {
    if (!this.certificate.month || !this.certificate.year) {
      return 'Choisissez le mois et l’année du certificat.';
    }

    const hasBestTeam = !!this.certificate.bestTeam?.trim();
    const hasBestEmployee = !!this.certificate.bestEmployee?.trim();
    const hasBestManager = !!this.certificate.bestManager?.trim();

    if (!hasBestTeam && !hasBestEmployee && !hasBestManager) {
      return 'Entrez au moins un nom de lauréat.';
    }

    return '';
  }

  async updateData() {
    this.formError = this.validateCertificate();
    if (this.formError) {
      return;
    }

    const certificateToSave = this.sanitizeCertificate(this.certificate);
    const nextCertificates = this.certificates.map((item) =>
      this.sanitizeCertificate(item)
    );

    const existingIndex = nextCertificates.findIndex(
      (item) =>
        item.month === certificateToSave.month && item.year === certificateToSave.year
    );

    if (existingIndex >= 0) {
      nextCertificates[existingIndex] = certificateToSave;
    } else {
      nextCertificates.push(certificateToSave);
    }

    this.isSaving = true;
    try {
      await this.data.addCertificateData(nextCertificates, this.certificateId);
      this.certificates = nextCertificates;
      this.displayAddTeam = false;
      this.resetCertificateDraft();
      this.givenMonth = this.time.monthFrenchNames.indexOf(
        certificateToSave.month || ''
      );
      this.givenYear = Number(certificateToSave.year);
      this.updateSelection();
    } finally {
      this.isSaving = false;
    }
  }
  choose() {}
}
