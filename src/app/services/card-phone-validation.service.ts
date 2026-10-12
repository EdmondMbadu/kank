import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import {
  assertCardPhoneIdentity,
  CardPhoneIdentity,
  CardPhoneValidationError,
  normalizeStoredCardPhone,
} from '../utils/card-phone-identity.util';

type CardPhoneTransaction = Parameters<Parameters<AngularFirestore['firestore']['runTransaction']>[0]>[0];

@Injectable({ providedIn: 'root' })
export class CardPhoneValidationService {
  constructor(private afs: AngularFirestore) {}

  // Read-only precheck for the confirmation dialog. Saving always performs its
  // own fresh check and transaction, even when this earlier check succeeded.
  async validate(candidate: CardPhoneIdentity, ownerUid: string, excludeCardUid?: string): Promise<void> {
    await this.loadIdentities(candidate, ownerUid, excludeCardUid);
  }

  async commit(
    candidate: CardPhoneIdentity,
    ownerUid: string,
    cardUid: string,
    write: (transaction: CardPhoneTransaction) => void,
    excludeCardUid?: string
  ): Promise<void> {
    const { employees, matchingPaths } = await this.loadIdentities(candidate, ownerUid, excludeCardUid);
    const cardPath = `users/${ownerUid}/cards/${cardUid}`;
    const guardRef = this.afs.firestore.doc(`cardPhoneWriteGuards/${candidate.phoneNumber}`);

    // The guard and card/event writes commit together. Concurrent saves retry
    // against the winning card instead of both accepting an unused number.
    await this.afs.firestore.runTransaction(async (transaction) => {
      const guard = await transaction.get(guardRef);
      const savedPaths: unknown = guard.data()?.['cardPaths'];
      const paths = new Set(matchingPaths);
      if (Array.isArray(savedPaths)) {
        savedPaths.forEach((path: unknown) => {
          if (typeof path === 'string' && /^users\/[^/]+\/cards\/[^/]+$/.test(path)) paths.add(path);
        });
      }
      if (excludeCardUid) paths.delete(`users/${ownerUid}/cards/${excludeCardUid}`);
      const snapshots = await Promise.all([...paths].map((path) =>
        transaction.get(this.afs.firestore.doc(path))));
      const currentCards = snapshots.filter((snapshot) => snapshot.exists)
        .map((snapshot) => snapshot.data() as CardPhoneIdentity);
      assertCardPhoneIdentity(candidate, currentCards, employees);
      const activePaths = snapshots.filter((snapshot) => snapshot.exists &&
        normalizeStoredCardPhone(snapshot.data()?.['phoneNumber']) === candidate.phoneNumber)
        .map((snapshot) => snapshot.ref.path);
      write(transaction);
      transaction.set(guardRef, { cardPaths: [...new Set([...activePaths, cardPath])] });
    });
  }

  private async loadIdentities(candidate: CardPhoneIdentity, ownerUid: string, excludeCardUid?: string) {
    assertCardPhoneIdentity(candidate, [], []);
    try {
      if (!ownerUid) throw new Error('Missing card owner');
      const locations = await this.afs.firestore.collection('users').get({ source: 'server' });
      // Include the current location even if its user document has not been returned.
      const ownerIds = [...new Set([ownerUid, ...locations.docs.map((doc) => doc.id)])];
      const cards: CardPhoneIdentity[] = [];
      const employees: CardPhoneIdentity[] = [];
      const matchingPaths: string[] = [];

      // Bound concurrent reads. A complete scan also catches legacy numbers with
      // spaces/country prefixes, and needs no new index or data migration.
      for (let offset = 0; offset < ownerIds.length; offset += 4) {
        await Promise.all(ownerIds.slice(offset, offset + 4).map(async (uid) => {
          const [cardSnapshot, employeeSnapshot] = await Promise.all([
            this.afs.firestore.collection(`users/${uid}/cards`).get({ source: 'server' }),
            this.afs.firestore.collection(`users/${uid}/employees`).get({ source: 'server' }),
          ]);
          cardSnapshot.docs.forEach((doc) => {
            // Compare document identity, never the page's array index or names.
            if (uid !== ownerUid || doc.id !== excludeCardUid) {
              const identity = doc.data() as CardPhoneIdentity;
              cards.push(identity);
              if (normalizeStoredCardPhone(identity.phoneNumber) === candidate.phoneNumber) {
                matchingPaths.push(doc.ref.path);
              }
            }
          });
          employeeSnapshot.docs.forEach((doc) => employees.push(doc.data()));
        }));
      }
      assertCardPhoneIdentity(candidate, cards, employees);
      return { employees, matchingPaths };
    } catch (error) {
      if (error instanceof CardPhoneValidationError) throw error;
      throw new CardPhoneValidationError('lookup-failed',
        'Impossible de vérifier ce numéro. Vérifiez votre connexion et réessayez.');
    }
  }
}
