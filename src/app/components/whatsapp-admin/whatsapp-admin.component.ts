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
  paymentCount: number;
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

@Component({
  selector: 'app-whatsapp-admin',
  templateUrl: './whatsapp-admin.component.html',
  styleUrls: ['./whatsapp-admin.component.css'],
})
export class WhatsappAdminComponent implements OnInit {
  readonly messagePageSize = 20;
  filterMode: 'day' | 'month' = 'day';
  selectedDay = this.buildTodayIso();
  selectedMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  selectedYear = String(new Date().getFullYear());
  messagePhoneSearch = '';
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
    String(new Date().getFullYear() - i)
  );

  stats: WhatsAppStats = {
    incomingCount: 0,
    outgoingCount: 0,
    totalMessages: 0,
    complaintCount: 0,
    paymentCount: 0,
  };

  latestMessages: WhatsAppMessage[] = [];
  complaints: WhatsAppComplaint[] = [];
  payments: WhatsAppPayment[] = [];
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

  messagesOpen = false;
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
        paymentCount: this.toNumber(data.stats?.paymentCount),
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
    } catch (err: any) {
      this.error =
        err?.message || 'Erreur lors du chargement des données WhatsApp.';
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

  formatDate(value: any): string {
    if (!value) return '--';
    const date = new Date(Number(value));
    if (isNaN(date.getTime())) return '--';
    return date.toLocaleString('fr-FR');
  }

  formatFC(value: any): string {
    return `${this.toNumber(value).toLocaleString('fr-FR')} FC`;
  }

  getComplaintStatusLabel(status: string | undefined): string {
    return (status || 'open') === 'closed' ? 'Clôturée' : 'Ouverte';
  }

  private toNumber(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private buildTodayIso(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
