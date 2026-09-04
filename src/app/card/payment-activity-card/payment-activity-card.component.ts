import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Card, CardLifecycleEvent } from 'src/app/models/card';
import { AuthService } from 'src/app/services/auth.service';
import { TimeService } from 'src/app/services/time.service';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Subscription } from 'rxjs';
import {
  buildCardPaymentActivities,
  CardLifecycleEventWithId,
  CardPaymentActivity,
} from 'src/app/utils/card-payment-activity.util';

@Component({
  selector: 'app-payment-activity-card',
  templateUrl: './payment-activity-card.component.html',
  styleUrls: ['./payment-activity-card.component.css'],
})
export class PaymentActivityCardComponent implements OnInit, OnDestroy {
  id: any = '';
  clientCard: Card = new Card();
  activities: CardPaymentActivity[] = [];
  searchTerm = '';
  selectedCycle = 0;
  private lifecycleEvents: CardLifecycleEventWithId[] = [];
  private eventsSubscription?: Subscription;
  private subscribedCardUid = '';
  constructor(
    private activatedRoute: ActivatedRoute,
    public auth: AuthService,
    private time: TimeService,
    private afs: AngularFirestore
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
    this.selectedCycle = Math.max(
      0,
      Math.floor(
        Number(this.activatedRoute.snapshot.queryParamMap.get('cycle')) || 0
      )
    );
  }
  ngOnInit() {
    this.retrieveClientCard();
  }

  ngOnDestroy(): void {
    this.eventsSubscription?.unsubscribe();
  }

  retrieveClientCard(): void {
    this.auth.getAllClientsCard().subscribe((data: any) => {
      const card = data?.[Number(this.id)];
      if (!card) return;

      this.clientCard = card;
      this.rebuildActivities();
      this.subscribeToLifecycleEvents();
    });
  }

  private subscribeToLifecycleEvents(): void {
    const ownerUid = this.auth.currentUser?.uid;
    const cardUid = this.clientCard?.uid;
    if (!ownerUid || !cardUid || this.subscribedCardUid === cardUid) return;

    this.eventsSubscription?.unsubscribe();
    this.subscribedCardUid = cardUid;
    this.eventsSubscription = this.afs
      .collection<CardLifecycleEvent>(
        `users/${ownerUid}/cards/${cardUid}/events`
      )
      .valueChanges({ idField: 'uid' })
      .subscribe({
        next: (events) => {
          this.lifecycleEvents = events as CardLifecycleEventWithId[];
          this.rebuildActivities();
        },
        error: (error) => {
          // The card fields and withdrawal snapshot are still a usable
          // fallback if an older deployment cannot read the event collection.
          console.error('Impossible de charger les mouvements carte:', error);
        },
      });
  }

  private rebuildActivities(): void {
    const cycle = this.displayedCycle;
    this.activities = buildCardPaymentActivities(
      this.clientCard,
      this.lifecycleEvents
    ).filter((activity) => activity.cycle === cycle);
  }

  get displayedCycle(): number {
    return this.selectedCycle || Math.max(1, Number(this.clientCard.cardCycle) || 1);
  }

  get isPreviousCycle(): boolean {
    return this.displayedCycle !== Math.max(1, Number(this.clientCard.cardCycle) || 1);
  }

  get filteredActivities(): CardPaymentActivity[] {
    const term = this.searchTerm.trim().toLocaleLowerCase('fr');
    if (!term) return this.activities;

    return this.activities.filter((activity) =>
      [
        this.activityLabel(activity),
        this.formatActivityDate(activity.dateKey),
        String(activity.amount),
      ]
        .join(' ')
        .toLocaleLowerCase('fr')
        .includes(term)
    );
  }

  formatActivityDate(dateKey: string): string {
    return dateKey.split('-').length >= 6
      ? this.time.convertDateToDesiredFormat(dateKey)
      : this.time.formatDateForDRC(dateKey);
  }

  activityLabel(activity: CardPaymentActivity): string {
    switch (activity.kind) {
      case 'deposit':
        return 'Dépôt';
      case 'partial_withdrawal':
        return 'Retrait partiel';
      case 'total_withdrawal':
        return 'Retrait de fin de cycle';
      case 'credit_transfer':
        return 'Transfert vers crédit';
      case 'total_withdrawal_reversed':
        return 'Retrait de fin de cycle annulé';
      default:
        return 'Correction';
    }
  }

  isMoneyOut(activity: CardPaymentActivity): boolean {
    return (
      activity.kind === 'partial_withdrawal' ||
      activity.kind === 'total_withdrawal' ||
      activity.kind === 'credit_transfer'
    );
  }

  async deletePaymentCard(activity: CardPaymentActivity, ev: Event) {
    ev.stopPropagation();

    const dateKey = activity.paymentDateKey;
    if (!dateKey) return;

    const formatted = this.time.convertDateToDesiredFormat(dateKey);
    if (!confirm(`Supprimer ce mouvement carte du ${formatted} ?`)) return;

    try {
      // Guard rails
      const docId = (this.clientCard as any)?.uid;
      if (!docId) {
        throw new Error(
          'clientCard.uid manquant — assurez-vous d’inclure idField: "uid" quand vous chargez les cartes.'
        );
      }

      // 1) Build a fresh payments map without this entry
      const newPayments: { [d: string]: string } = {
        ...(this.clientCard.payments || {}),
      };
      delete newPayments[dateKey];

      // 2) Update the card document and its matching audit event together.
      const path = `users/${this.auth.currentUser.uid}/cards/${docId}`;
      const batch = this.afs.firestore.batch();
      batch.update(this.afs.doc(path).ref, { payments: newPayments });
      if (activity.eventId) {
        batch.delete(
          this.afs
            .collection(`${path}/events`)
            .doc(activity.eventId).ref
        );
      }
      await batch.commit();

      // 3) Update local state so the UI reflects the change instantly.
      this.clientCard.payments = newPayments;
      if (activity.eventId) {
        this.lifecycleEvents = this.lifecycleEvents.filter(
          (event) => event.uid !== activity.eventId
        );
      }
      this.rebuildActivities();
    } catch (err: any) {
      alert('Échec de suppression : ' + (err?.message || 'Erreur inconnue'));
    }
  }
}
