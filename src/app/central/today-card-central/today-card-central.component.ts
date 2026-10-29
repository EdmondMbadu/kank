import { Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { User } from 'src/app/models/user';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { TimeService } from 'src/app/services/time.service';
import { Subscription, firstValueFrom, forkJoin, map, take, timeout } from 'rxjs';
import { DailyActivityRow, parseActivityDate } from '../today-central/daily-activity-details';
import { buildDailyCardRows, compactDailyCard, DailyCardSnapshot } from './card-daily-details';

@Component({
  selector: 'app-today-card-central',
  templateUrl: './today-card-central.component.html',
  styleUrls: ['./today-card-central.component.css'],
})
export class TodayCardCentralComponent implements OnDestroy {
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}

  allUsers: User[] = [];
  totalsLoading = true;
  totalsError = '';
  private usersSub?: Subscription;

  isDetailsOpen = false;
  detailMetric = 0;
  detailsLoading = false;
  detailsError = '';
  detailRows: DailyActivityRow[] = [];
  filteredRows: DailyActivityRow[] = [];
  detailGroups: { id: string; name: string; filteredTotal: number; rows: DailyActivityRow[] }[] = [];
  detailSites: { id: string; name: string }[] = [];
  detailSite = '';
  detailSearch = '';
  detailTotal = 0;
  detailFilteredTotal = 0;
  detailPage = 0;
  readonly detailPageSize = 100;
  @ViewChild('detailsDialog') detailsDialog?: ElementRef<HTMLElement>;
  private previousFocus: HTMLElement | null = null;
  private previousOverflow = '';
  private detailRequestId = 0;
  private destroyed = false;
  private readonly detailsCache = new Map<string, DailyCardSnapshot[]>();
  private readonly detailsPending = new Map<string, Promise<DailyCardSnapshot[]>>();

  requestDate: string = this.time.getTodaysDateYearMonthDay();
  selectedDateKey: string = this.time.todaysDateMonthDayYear();
  displayDate: string = this.time.convertDateToDayMonthYear(this.selectedDateKey);

  ngOnInit(): void {
    if (this.auth.isAdmin) {
      this.usersSub = this.auth.getAllUsersInfo().subscribe({
        next: (data) => {
          this.allUsers = data;
          this.totalsLoading = false;
          this.totalsError = '';
          this.initalizeInputs();
          if (this.isDetailsOpen) void this.loadDetails();
        },
        error: () => {
          this.totalsLoading = false;
          this.totalsError = 'Impossible de charger les sites. Actualisez la page pour réessayer.';
          this.detailRequestId++;
          this.detailsLoading = false;
          this.detailsError = this.totalsError;
        },
      });
    } else {
      this.totalsLoading = false;
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.closeDetails();
    this.usersSub?.unsubscribe();
    this.detailsCache.clear();
  }
  dailyCardPayments: string = '0';
  dailyCardReturns: string = '0';
  dailyCardBenefits: string = '0';

  summary: string[] = [
    'Paiement Carte Du Jour',
    'Retrait Carte Du Jour',
    'Benefice Carte Du Jour',
  ];
  valuesConvertedToDollars: string[] = [];

  imagePaths: string[] = [
    '../../../assets/img/daily-reimbursement.png',
    '../../../assets/img/daily-payment.png',
    '../../../assets/img/daily-reimbursement.png',
  ];

  summaryContent: string[] = [];
  initalizeInputs() {
    const dateKey = this.selectedDateKey;

    this.dailyCardPayments = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyCardPayments',
        dateKey
      )
      .toString();
    this.dailyCardReturns = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyCardReturns',
        dateKey
      )
      .toString();
    this.dailyCardBenefits = this.compute
      .findTodayTotalResultsGivenField(
        this.allUsers,
        'dailyCardBenefits',
        dateKey
      )
      .toString();
    this.dailyCardPayments =
      this.dailyCardPayments === undefined ? '0' : this.dailyCardPayments;
    this.dailyCardReturns =
      this.dailyCardReturns === undefined ? '0' : this.dailyCardReturns;
    this.dailyCardBenefits =
      this.dailyCardBenefits === undefined ? '0' : this.dailyCardBenefits;
    this.summaryContent = [
      ` ${this.dailyCardPayments}`,
      ` ${this.dailyCardReturns}`,
      ` ${this.dailyCardBenefits}`,
    ];

    this.valuesConvertedToDollars = [
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailyCardPayments
      )}`,
      `${this.compute.convertCongoleseFrancToUsDollars(this.dailyCardReturns)}`,
      `${this.compute.convertCongoleseFrancToUsDollars(
        this.dailyCardBenefits
      )}`,
    ];
  }

  onDateChange(date: string) {
    if (!date) {
      return;
    }
    this.requestDate = date;
    this.selectedDateKey = this.time.convertDateToMonthDayYear(date);
    this.displayDate = this.time.convertDateToDayMonthYear(
      this.selectedDateKey
    );

    this.initalizeInputs();
    this.resetDetailFilters();
    if (this.isDetailsOpen) void this.loadDetails();
  }

  amountDollars(amount: number): number {
    return Number(this.compute.convertCongoleseFrancToUsDollars(String(amount))) || 0;
  }

  get detailCentralTotal(): number {
    return Number(this.summaryContent[this.detailMetric]) || 0;
  }

  get detailPageCount(): number {
    return Math.max(1, Math.ceil(this.filteredRows.length / this.detailPageSize));
  }

  openDetails(metric: number): void {
    if (!this.auth.isAdmin || this.totalsLoading || this.totalsError || ![0, 1, 2].includes(metric)) return;
    if (!this.isDetailsOpen) {
      this.previousFocus = document.activeElement as HTMLElement | null;
      this.previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    this.detailMetric = metric;
    this.isDetailsOpen = true;
    this.resetDetailFilters();
    void this.loadDetails();
    setTimeout(() => {
      if (this.isDetailsOpen) this.detailsDialog?.nativeElement.querySelector<HTMLButtonElement>('button')?.focus();
    });
  }

  closeDetails(): void {
    if (!this.isDetailsOpen) return;
    this.isDetailsOpen = false;
    this.detailRequestId++;
    this.detailsLoading = false;
    document.body.style.overflow = this.previousOverflow;
    this.previousFocus?.focus();
  }

  @HostListener('document:keydown', ['$event'])
  onDetailsKeydown(event: KeyboardEvent): void {
    if (!this.isDetailsOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDetails();
    } else if (event.key === 'Tab') {
      const controls = this.detailsDialog?.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])');
      if (!controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
  }

  async loadDetails(refresh = false): Promise<void> {
    if (!this.isDetailsOpen || this.destroyed) return;
    if (this.totalsError) {
      this.detailsError = this.totalsError;
      return;
    }
    const requestId = ++this.detailRequestId;
    const dayKey = this.selectedDateKey;
    const metric = this.detailMetric;
    const monthKey = parseActivityDate(dayKey)?.monthKey;
    this.detailsLoading = true;
    this.detailsError = '';
    this.detailRows = [];
    this.detailSites = [];
    this.detailTotal = 0;
    this.applyDetailFilters();
    try {
      if (!monthKey) throw new Error('Invalid date');
      const users = [...new Map(this.allUsers.filter((user) => user.uid).map((user) => [user.uid!, user])).values()];
      const signature = users.map((user) => [user.uid, user.firstName,
        ...(['dailyCardPayments', 'dailyCardReturns', 'dailyCardBenefits'] as const).map((field) =>
          Object.entries(user[field] || {}).filter(([key]) => parseActivityDate(key)?.monthKey === monthKey)
            .sort(([a], [b]) => a.localeCompare(b))
        ),
      ]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
      const cacheKey = `${monthKey}:${JSON.stringify(signature)}`;
      if (refresh) this.detailsCache.delete(cacheKey);
      let cards = this.detailsCache.get(cacheKey);
      if (!cards) {
        let pending = this.detailsPending.get(cacheKey);
        if (!pending) {
          pending = (users.length ? firstValueFrom(forkJoin(users.map((user) =>
            this.auth.getCardsOfAUserForMonth(user.uid!, monthKey).pipe(
              timeout(30000), take(1),
              map((siteCards) => siteCards.map((card) => compactDailyCard(card, user.uid!, user.firstName || 'Site', monthKey)))
            )
          ))).then((bySite) => bySite.flat()) : Promise.resolve([])).then((result) => {
            if (!this.destroyed) {
              this.detailsCache.set(cacheKey, result);
              while (this.detailsCache.size > 2) this.detailsCache.delete(this.detailsCache.keys().next().value!);
            }
            return result;
          }).finally(() => this.detailsPending.delete(cacheKey));
          this.detailsPending.set(cacheKey, pending);
        }
        cards = await pending;
      }
      if (requestId !== this.detailRequestId || !this.isDetailsOpen || this.destroyed) return;
      this.detailRows = buildDailyCardRows(cards, metric, dayKey);
      this.detailTotal = this.detailRows.reduce((sum, row) => sum + row.amount, 0);
      this.detailSites = [...new Map(this.detailRows.map((row) => [row.locationId, { id: row.locationId, name: row.locationName }])).values()];
      if (!this.detailSites.some((site) => site.id === this.detailSite)) this.detailSite = '';
      this.applyDetailFilters();
    } catch (error) {
      if (requestId !== this.detailRequestId || !this.isDetailsOpen || this.destroyed) return;
      console.error('Unable to load daily card details', error);
      this.detailsError = 'Impossible de charger tous les sites. Réessayez ; aucune liste partielle ne sera affichée.';
    } finally {
      if (requestId === this.detailRequestId) this.detailsLoading = false;
    }
  }

  resetDetailFilters(): void {
    this.detailSite = '';
    this.detailSearch = '';
    this.applyDetailFilters();
  }

  applyDetailFilters(): void {
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const term = normalize(this.detailSearch.trim());
    this.filteredRows = this.detailRows.filter((row) => (!this.detailSite || row.locationId === this.detailSite) &&
      (!term || normalize(`${row.fullName} ${row.locationName} ${row.dateLabel} ${row.detail} ${row.amount}`).includes(term)));
    this.detailFilteredTotal = this.filteredRows.reduce((sum, row) => sum + row.amount, 0);
    this.detailPage = 0;
    this.updateDetailPage();
  }

  changeDetailPage(delta: number): void {
    this.detailPage = Math.max(0, Math.min(this.detailPageCount - 1, this.detailPage + delta));
    this.updateDetailPage();
  }

  private updateDetailPage(): void {
    const totals = new Map<string, number>();
    this.filteredRows.forEach((row) => totals.set(row.locationId, (totals.get(row.locationId) || 0) + row.amount));
    const groups = new Map<string, typeof this.detailGroups[number]>();
    this.filteredRows.slice(this.detailPage * this.detailPageSize, (this.detailPage + 1) * this.detailPageSize).forEach((row) => {
      let group = groups.get(row.locationId);
      if (!group) {
        group = { id: row.locationId, name: row.locationName, filteredTotal: totals.get(row.locationId) || 0, rows: [] };
        groups.set(row.locationId, group);
      }
      group.rows.push(row);
    });
    this.detailGroups = [...groups.values()];
  }

  trackDetail(_index: number, row: { id: string }): string {
    return row.id;
  }
}
