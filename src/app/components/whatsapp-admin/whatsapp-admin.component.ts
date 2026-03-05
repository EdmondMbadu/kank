import { Component, OnDestroy, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';

interface WhatsAppStats {
  incomingCount?: number;
  outgoingCount?: number;
  updatedAtMs?: number;
}

interface WhatsAppMessage {
  id?: string;
  direction?: 'incoming' | 'outgoing';
  phone?: string;
  body?: string;
  source?: string;
  createdAt?: any;
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
  createdAt?: any;
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
export class WhatsappAdminComponent implements OnInit, OnDestroy {
  stats: WhatsAppStats = { incomingCount: 0, outgoingCount: 0 };

  latestMessages: WhatsAppMessage[] = [];
  complaints: WhatsAppComplaint[] = [];
  payments: WhatsAppPayment[] = [];

  loadingPayments = false;
  paymentError = '';

  private subs: Subscription[] = [];

  constructor(
    public auth: AuthService,
    private afs: AngularFirestore,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.auth.isAdmin) {
      this.router.navigate(['/home']);
      return;
    }

    this.subs.push(
      this.afs
        .doc<WhatsAppStats>('whatsappStats/global')
        .valueChanges()
        .subscribe((data) => {
          this.stats = {
            incomingCount: this.toNumber(data?.incomingCount),
            outgoingCount: this.toNumber(data?.outgoingCount),
            updatedAtMs: this.toNumber(data?.updatedAtMs),
          };
        })
    );

    this.subs.push(
      this.afs
        .collection<WhatsAppMessage>('whatsappMessages', (ref) =>
          ref.orderBy('createdAt', 'desc').limit(10)
        )
        .snapshotChanges()
        .subscribe((snaps) => {
          this.latestMessages = snaps.map((snap) => ({
            id: snap.payload.doc.id,
            ...(snap.payload.doc.data() as WhatsAppMessage),
          }));
        })
    );

    this.subs.push(
      this.afs
        .collection<WhatsAppComplaint>('whatsappComplaints', (ref) =>
          ref.orderBy('createdAt', 'desc').limit(50)
        )
        .snapshotChanges()
        .subscribe((snaps) => {
          this.complaints = snaps.map((snap) => ({
            id: snap.payload.doc.id,
            ...(snap.payload.doc.data() as WhatsAppComplaint),
          }));
        })
    );

    this.loadLatestPayments();
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
  }

  get incomingCount(): number {
    return this.toNumber(this.stats.incomingCount);
  }

  get outgoingCount(): number {
    return this.toNumber(this.stats.outgoingCount);
  }

  get totalMessages(): number {
    return this.incomingCount + this.outgoingCount;
  }

  async loadLatestPayments(): Promise<void> {
    this.loadingPayments = true;
    this.paymentError = '';

    try {
      const snap = await this.afs.firestore
        .collectionGroup('mobileMoneyTransactions')
        .where('whatsappOriginated', '==', true)
        .limit(100)
        .get();

      const rows = snap.docs
        .map((doc) => {
          const data = doc.data() || {};
          return {
            id: doc.id,
            reference: String(data['reference'] || doc.id),
            ownerUid: String(data['ownerUid'] || ''),
            clientUid: String(data['clientUid'] || ''),
            paymentAmount: this.toNumber(data['paymentAmount']),
            status: String(data['status'] || 'UNKNOWN'),
            updatedAtMs: this.toNumber(data['updatedAtMs'] || data['createdAtMs']),
            whatsappPhone: String(data['whatsappPhone'] || ''),
            clientName: String(data['clientName'] || '').trim(),
          };
        })
        .filter((x) => x.status.toUpperCase() === 'SUCCESS')
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs)
        .slice(0, 10);

      const enriched = await Promise.all(
        rows.map(async (row) => {
          let clientName = row.clientName;

          if (!clientName && row.ownerUid && row.clientUid) {
            try {
              const clientSnap = await this.afs
                .doc(`users/${row.ownerUid}/clients/${row.clientUid}`)
                .ref.get();
              if (clientSnap.exists) {
                const c: any = clientSnap.data() || {};
                clientName = [
                  String(c['middleName'] || '').trim(),
                  String(c['firstName'] || '').trim(),
                  String(c['lastName'] || '').trim(),
                ]
                  .filter(Boolean)
                  .join(' ');
              }
            } catch (_) {
              // keep fallback name
            }
          }

          return {
            id: row.id,
            reference: row.reference,
            clientName: clientName || 'Client inconnu',
            paymentAmount: row.paymentAmount,
            status: row.status,
            updatedAtMs: row.updatedAtMs,
            sourcePhone: row.whatsappPhone,
          } as WhatsAppPayment;
        })
      );

      this.payments = enriched;
    } catch (err: any) {
      this.paymentError = err?.message || 'Erreur lors du chargement des paiements WhatsApp.';
    } finally {
      this.loadingPayments = false;
    }
  }

  formatDate(value: any): string {
    if (!value) return '--';

    let date: Date | null = null;
    if (typeof value?.toDate === 'function') {
      date = value.toDate();
    } else if (typeof value?.seconds === 'number') {
      date = new Date(value.seconds * 1000);
    } else if (typeof value === 'number') {
      date = new Date(value);
    } else {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) date = parsed;
    }

    if (!date) return '--';
    return date.toLocaleString('fr-FR');
  }

  formatFC(value: any): string {
    return `${this.toNumber(value).toLocaleString('fr-FR')} FC`;
  }

  toNumber(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
}
