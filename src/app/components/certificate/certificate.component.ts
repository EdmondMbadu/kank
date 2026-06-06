import { Component, OnDestroy, OnInit } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Certificate, Employee, Trophy } from 'src/app/models/employee';
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
  private trophyHeatmapCacheKey = '';
  private trophyHeatmapCache: TrophyHeatmapTile[] = [];

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
