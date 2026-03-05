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
  filterMode: 'day' | 'month' = 'day';
  selectedDay = this.buildTodayIso();
  selectedMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  selectedYear = String(new Date().getFullYear());

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

  reportLabel = '';
  loading = false;
  error = '';

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

    this.loadReport();
  }

  async loadReport(): Promise<void> {
    this.loading = true;
    this.error = '';

    try {
      const callable = this.fns.httpsCallable('getWhatsAppAdminReport');
      const payload =
        this.filterMode === 'month'
          ? {
              mode: 'month',
              month: Number(this.selectedMonth),
              year: Number(this.selectedYear),
            }
          : {
              mode: 'day',
              day: this.selectedDay,
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
    this.loadReport();
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
