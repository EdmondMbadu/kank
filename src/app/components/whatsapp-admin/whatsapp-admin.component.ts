import { Component, OnInit } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/compat/functions';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';

interface WhatsAppStats {
  incomingCount: number;
  outgoingCount: number;
  totalMessages: number;
  complaintCount: number;
  complaintOpenCount: number;
  complaintClosedCount: number;
  paymentCount: number;
  distinctParticipantCount: number;
  overallDistinctParticipantCount: number | null;
}

interface WhatsAppMessagePagination {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  phoneSearch: string;
}

interface WhatsAppMessage {
  id?: string;
  direction?: 'incoming' | 'outgoing';
  phone?: string;
  body?: string;
  source?: string;
  createdAtMs?: number;
}

interface WhatsAppComplaint {
  id?: string;
  phone?: string;
  clientName?: string;
  category?: string;
  description?: string;
  reference?: string;
  status?: string;
  createdAtMs?: number;
}

interface WhatsAppPayment {
  id: string;
  reference: string;
  clientName: string;
  paymentAmount: number;
  status: string;
  updatedAtMs: number;
  sourcePhone: string;
}

interface WhatsAppParticipant {
  phone: string;
  fullName: string;
  locationName?: string;
  lastInteractionAtMs?: number;
  lastQuestionAtMs?: number;
  isKnownClient?: boolean;
}

@Component({
  selector: 'app-whatsapp-admin',
  templateUrl: './whatsapp-admin.component.html',
  styleUrls: ['./whatsapp-admin.component.css'],
})
export class WhatsappAdminComponent implements OnInit {
  readonly messagePageSize = 20;
  readonly reportTimeZone = 'Africa/Kinshasa';
  readonly todayParts = this.getTodayParts();
  filterMode: 'day' | 'month' = 'day';
  selectedDay = this.buildTodayIso();
  selectedMonth = this.todayParts.month;
  selectedYear = this.todayParts.year;
  messagePhoneSearch = '';
  complaintSearch = '';
  messagePage = 1;

  readonly months = [
    { value: '01', label: 'Janvier' },
    { value: '02', label: 'Février' },
    { value: '03', label: 'Mars' },
    { value: '04', label: 'Avril' },
    { value: '05', label: 'Mai' },
    { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' },
    { value: '08', label: 'Août' },
    { value: '09', label: 'Septembre' },
    { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Décembre' },
  ];

  readonly years = Array.from({ length: 6 }, (_, i) =>
    String(Number(this.todayParts.year) - i)
  );

  stats: WhatsAppStats = {
    incomingCount: 0,
    outgoingCount: 0,
    totalMessages: 0,
    complaintCount: 0,
    complaintOpenCount: 0,
    complaintClosedCount: 0,
    paymentCount: 0,
    distinctParticipantCount: 0,
    overallDistinctParticipantCount: null,
  };

  latestMessages: WhatsAppMessage[] = [];
  complaints: WhatsAppComplaint[] = [];
  payments: WhatsAppPayment[] = [];
  participants: WhatsAppParticipant[] = [];
  overallParticipants: WhatsAppParticipant[] = [];
  messagePagination: WhatsAppMessagePagination = {
    page: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 1,
    phoneSearch: '',
  };

  reportLabel = '';
  loading = false;
  error = '';
  overallParticipantStatsReady = false;

  messagesOpen = false;
  participantsOpen = false;
  participantsViewMode: 'period' | 'global' = 'period';
  overallParticipantsLoading = false;
  overallParticipantsLoaded = false;
  complaintsOpen = false;
  paymentsOpen = false;
  complaintActionId = '';

  constructor(
    public auth: AuthService,
    private fns: AngularFireFunctions,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.auth.isAdmin) {
      this.router.navigate(['/home']);
      return;
    }

    this.loadReport(1);
  }

  async loadReport(page: number = this.messagePage): Promise<void> {
    this.loading = true;
    this.error = '';
    this.messagePage = page;

    try {
      const callable = this.fns.httpsCallable('getWhatsAppAdminReport');
      const payload =
        this.filterMode === 'month'
          ? {
              mode: 'month',
              month: Number(this.selectedMonth),
              year: Number(this.selectedYear),
              messagesPage: this.messagePage,
              phoneSearch: this.messagePhoneSearch,
            }
          : {
              mode: 'day',
              day: this.selectedDay,
              messagesPage: this.messagePage,
              phoneSearch: this.messagePhoneSearch,
            };

      const response: any = await firstValueFrom(callable(payload));
      const data = response || {};

      this.reportLabel = String(data.filter?.label || '');
      this.stats = {
        incomingCount: this.toNumber(data.stats?.incomingCount),
        outgoingCount: this.toNumber(data.stats?.outgoingCount),
        totalMessages: this.toNumber(data.stats?.totalMessages),
        complaintCount: this.toNumber(data.stats?.complaintCount),
        complaintOpenCount: this.toNumber(data.stats?.complaintOpenCount),
        complaintClosedCount: this.toNumber(data.stats?.complaintClosedCount),
        paymentCount: this.toNumber(data.stats?.paymentCount),
        distinctParticipantCount: this.toNumber(
          data.stats?.distinctParticipantCount
        ),
        overallDistinctParticipantCount:
          data.stats?.overallDistinctParticipantCount == null
            ? null
            : this.toNumber(data.stats?.overallDistinctParticipantCount),
      };
      this.latestMessages = Array.isArray(data.latestMessages)
        ? data.latestMessages
        : [];
      this.messagePagination = {
        page: this.toNumber(data.messages?.page) || 1,
        pageSize: this.toNumber(data.messages?.pageSize) || this.messagePageSize,
        totalCount: this.toNumber(data.messages?.totalCount),
        totalPages: this.toNumber(data.messages?.totalPages) || 1,
        phoneSearch: String(data.messages?.phoneSearch || ''),
      };
      this.messagePage = this.messagePagination.page;
      this.complaints = Array.isArray(data.complaints) ? data.complaints : [];
      this.payments = Array.isArray(data.payments) ? data.payments : [];
      this.participants = Array.isArray(data.participants)
        ? data.participants
        : [];
      this.overallParticipantStatsReady =
        this.overallParticipantsLoaded ||
        data.stats?.overallDistinctParticipantCount != null;
      if (
        Array.isArray(data.overallParticipants) &&
        data.overallParticipants.length
      ) {
        this.overallParticipants = data.overallParticipants;
        this.overallParticipantsLoaded = true;
        this.overallParticipantStatsReady = true;
      } else if (
        data.stats?.overallDistinctParticipantCount === 0
      ) {
        this.overallParticipants = [];
        this.overallParticipantsLoaded = true;
        this.overallParticipantStatsReady = true;
      }

    } catch (err: any) {
      console.error('WhatsApp admin load failed', err);
      this.error =
        err?.message ||
        'Erreur lors du chargement des données WhatsApp. Vérifiez aussi les logs Firebase Functions.';
    } finally {
      this.loading = false;
    }
  }

  setFilterMode(mode: 'day' | 'month'): void {
    if (this.filterMode === mode) return;
    this.filterMode = mode;
    this.loadReport(1);
  }

  onPeriodFilterChange(): void {
    this.loadReport(1);
  }

  applyMessagePhoneSearch(): void {
    this.loadReport(1);
  }

  clearMessagePhoneSearch(): void {
    if (!this.messagePhoneSearch) return;
    this.messagePhoneSearch = '';
    this.loadReport(1);
  }

  async closeComplaint(complaint: WhatsAppComplaint): Promise<void> {
    const complaintId = String(complaint.id || '').trim();
    if (!complaintId || (complaint.status || 'open') === 'closed') return;

    this.complaintActionId = complaintId;
    this.error = '';
    try {
      const callable = this.fns.httpsCallable('closeWhatsAppComplaint');
      await firstValueFrom(callable({ complaintId }));
      await this.loadReport(this.messagePage);
    } catch (err: any) {
      console.error('WhatsApp complaint close failed', err);
      this.error =
        err?.message || 'Erreur lors de la clôture de la plainte.';
    } finally {
      this.complaintActionId = '';
    }
  }

  async deleteComplaint(complaint: WhatsAppComplaint): Promise<void> {
    const complaintId = String(complaint.id || '').trim();
    if (!complaintId) return;

    const confirmed = window.confirm(
      `Supprimer la plainte ${complaint.reference || complaintId} ?`
    );
    if (!confirmed) return;

    this.complaintActionId = complaintId;
    this.error = '';
    try {
      const callable = this.fns.httpsCallable('deleteWhatsAppComplaint');
      await firstValueFrom(callable({ complaintId }));
      await this.loadReport(this.messagePage);
    } catch (err: any) {
      console.error('WhatsApp complaint delete failed', err);
      this.error =
        err?.message || 'Erreur lors de la suppression de la plainte.';
    } finally {
      this.complaintActionId = '';
    }
  }

  goToMessagePage(page: number): void {
    if (page < 1 || page > this.messagePagination.totalPages) return;
    if (page === this.messagePage) return;
    this.loadReport(page);
  }

  get messagePageNumbers(): number[] {
    const total = this.messagePagination.totalPages || 1;
    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }
    const current = this.messagePagination.page || 1;
    let start = Math.max(1, current - 2);
    let end = Math.min(total, start + 4);
    start = Math.max(1, end - 4);
    const pages: number[] = [];
    for (let page = start; page <= end; page++) {
      pages.push(page);
    }
    return pages;
  }

  get hasMessageResults(): boolean {
    return this.messagePagination.totalCount > 0;
  }

  get participantPeriodLabel(): string {
    return this.filterMode === 'day' ? 'jour sélectionné' : 'mois sélectionné';
  }

  get participantPeriodShortLabel(): string {
    return this.filterMode === 'day' ? 'Jour' : 'Mois';
  }

  get activeParticipants(): WhatsAppParticipant[] {
    return this.participantsViewMode === 'global'
      ? this.overallParticipants
      : this.participants;
  }

  get activeParticipantCount(): number {
    if (this.participantsViewMode === 'global' && this.overallParticipantsLoaded) {
      return this.overallParticipants.length;
    }
    return this.participantsViewMode === 'global'
      ? this.toNumber(this.stats.overallDistinctParticipantCount)
      : this.stats.distinctParticipantCount;
  }

  get activeParticipantLabel(): string {
    return this.participantsViewMode === 'global'
      ? 'vue globale'
      : this.participantPeriodLabel;
  }

  get activeParticipantEmptyScopeLabel(): string {
    return this.participantsViewMode === 'global'
      ? 'la vue globale'
      : `le ${this.participantPeriodLabel}`;
  }

  async setParticipantsViewMode(mode: 'period' | 'global'): Promise<void> {
    this.participantsViewMode = mode;
    if (mode === 'global') {
      await this.ensureOverallParticipantsLoaded();
    }
  }

  private async ensureOverallParticipantsLoaded(): Promise<void> {
    const expectedCount = this.stats.overallDistinctParticipantCount;
    if (this.overallParticipantsLoading) return;
    if (
      this.overallParticipantsLoaded &&
      (expectedCount == null ||
        expectedCount === 0 ||
        this.overallParticipants.length >= expectedCount)
    ) {
      return;
    }

    this.overallParticipantsLoading = true;
    try {
      const callable = this.fns.httpsCallable(
        'getWhatsAppAdminOverallParticipants'
      );
      const response: any = await firstValueFrom(callable({}));
      const participants = Array.isArray(response?.participants)
        ? response.participants
        : [];
      this.overallParticipants = participants;
      this.stats = {
        ...this.stats,
        overallDistinctParticipantCount: this.toNumber(
          response?.count ?? participants.length
        ),
      };
      this.overallParticipantsLoaded = true;
      this.overallParticipantStatsReady = true;
    } catch (err: any) {
      console.error('WhatsApp global participants load failed', err);
      this.error =
        err?.message ||
        'Erreur lors du chargement global des contacts WhatsApp.';
    } finally {
      this.overallParticipantsLoading = false;
    }
  }

  get filteredComplaints(): WhatsAppComplaint[] {
    const search = this.normalizeSearch(this.complaintSearch);
    if (!search) return this.complaints;
    return this.complaints.filter((complaint) => {
      const haystack = [
        complaint.reference,
        complaint.phone,
        complaint.clientName,
        complaint.category,
        complaint.description,
      ]
        .map((value) => this.normalizeSearch(value))
        .join(' ');
      return haystack.includes(search);
    });
  }

  formatDate(value: any): string {
    if (!value) return '--';
    const date = new Date(Number(value));
    if (isNaN(date.getTime())) return '--';
    return date.toLocaleString('fr-FR', {
      timeZone: this.reportTimeZone,
    });
  }

  formatFC(value: any): string {
    return `${this.toNumber(value).toLocaleString('fr-FR')} FC`;
  }

  formatParticipantLocation(participant: WhatsAppParticipant): string {
    return String(participant.locationName || '').trim() || '-';
  }

  formatParticipantLastQuestion(participant: WhatsAppParticipant): string {
    if (!participant.isKnownClient || !participant.lastQuestionAtMs) {
      return '-';
    }
    return this.formatDate(participant.lastQuestionAtMs);
  }

  get overallDistinctParticipantCountDisplay(): string {
    if (!this.overallParticipantStatsReady) return '...';
    return String(this.toNumber(this.stats.overallDistinctParticipantCount));
  }

  getComplaintStatusLabel(status: string | undefined): string {
    return (status || 'open') === 'closed' ? 'Clôturée' : 'Ouverte';
  }

  private toNumber(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private normalizeSearch(value: any): string {
    return String(value || '').trim().toLowerCase();
  }

  private buildTodayIso(): string {
    return `${this.todayParts.year}-${this.todayParts.month}-${this.todayParts.day}`;
  }

  private getTodayParts(): { year: string; month: string; day: string } {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.reportTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());

    const getPart = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((part) => part.type === type)?.value || '';

    return {
      year: getPart('year'),
      month: getPart('month'),
      day: getPart('day'),
    };
  }
}
