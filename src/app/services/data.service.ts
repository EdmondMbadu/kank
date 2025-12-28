import { Injectable } from '@angular/core';
import {
  AngularFirestore,
  AngularFirestoreCollection,
  AngularFirestoreDocument,
} from '@angular/fire/compat/firestore/';
import { LocationCoordinates, User } from '../models/user';
import { firstValueFrom, Observable } from 'rxjs';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AuthService } from './auth.service';
import { Client, Comment } from '../models/client';
import { TimeService } from './time.service';
import {
  AttendanceAttachment,
  Avatar,
  Certificate,
  Employee,
} from '../models/employee';
import { ComputationService } from '../shrink/services/computation.service';
import { Card } from '../models/card';
import { doc, increment, writeBatch } from 'firebase/firestore';
import { Audit, Management } from '../models/management';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Router } from '@angular/router';
import firebase from 'firebase/compat/app'; // ① NEW
import 'firebase/compat/firestore'; // ②

import 'firebase/compat/firestore';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  constructor(
    private afs: AngularFirestore,
    private storage: AngularFireStorage,
    private auth: AuthService,
    private time: TimeService,
    private compute: ComputationService,
    private router: Router
  ) {}
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  todayFull = this.time.todaysDate();
  url: string = '';
  generalMaxNumberOfClients: number = 70;
  generalMaxNumberOfDaysToLend: Number = 20;
  allowedMimeTypes: string[] = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/webb',
    'image/heic',
    'application/pdf', // Correct MIME type for PDF files
  ];
  clientWithdrawFromSavings(client: Client, amount: string) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const data = {
      savings: client.savings,
      savingsPayments: client.savingsPayments,
      requestAmount: '',
      requestStatus: '',
      requestType: '',
      requestDate: '',
    };

    this.updateUserInfoForClientSavingsWithdrawal(client, amount);
    return clientRef.set(data, { merge: true });
  }
  clientRequestSavingsWithdrawal(client: Client, amount: string) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const data = {
      requestAmount: amount,
      requestStatus: 'pending',
      requestDate: client.requestDate,
      requestType: 'savings',
      dateOfRequest: client.dateOfRequest,
    };

    this.updateUserInfoForClientRequestSavingsWithdrawal(client, amount);
    return clientRef.set(data, { merge: true });
  }
  /**
   * Returns true if the employee is currently working ("Travaille").
   * Handles common variants and typos.
   */
  private isWorkingEmployee(employee: any): boolean {
    if (!employee) return false;
    const raw =
      employee.status ?? employee.workStatus ?? employee.employmentStatus ?? '';
    const val = String(raw).trim().toLowerCase();
    // Accept common variants / typos
    return ['travaille', 'tavaille', 'en travail', 'working', 'work'].includes(
      val
    );
  }

  clientPayment(
    client: Client,
    savings: string,
    date: string,
    payment: string
  ) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const data = {
      amountPaid: client.amountPaid,
      creditScore: client.creditScore,
      numberOfPaymentsMade: client.numberOfPaymentsMade,
      numberOfPaymentsMissed: client.numberOfPaymentsMissed,
      payments: client.payments,
      savings: client.savings,
      savingsPayments: client.savingsPayments,
      debtLeft: client.debtLeft,
    };
    this.updateUserInfoForClientPayment(client, savings, date, payment);
    return clientRef.set(data, { merge: true });
  }
  // data.service.ts
  async clientPaymentAndStats(
    client: Client,
    savings: string,
    dayKey: string, // e.g. "2025-09-09" (you can pass the same value as `date`)
    payment: string
  ) {
    const ownerUid = this.auth.currentUser.uid;
    const amount = Number(payment || 0);
    const savingsNum = Number(savings || 0);
    const assignedAgentUid: string | null =
      (client as any)?.employee?.uid || (client as any)?.agent || null;

    const db = this.afs.firestore;

    // Get all employee IDs before transaction (lightweight - just IDs)
    const employeesCollectionRef = this.afs.collection(
      `users/${ownerUid}/employees`
    );
    const allEmployeesSnapshot = await employeesCollectionRef.ref.get();
    const allEmployeeIds: string[] = allEmployeesSnapshot.docs.map(
      (doc) => doc.id
    );

    // Refs (these don't depend on agentUid, so we can create them upfront)
    const clientRef = this.afs.doc(
      `users/${ownerUid}/clients/${client.uid}`
    ).ref;
    const ownerDailyRef = this.afs.doc(
      `users/${ownerUid}/stats/dailyReimbursement`
    ).ref;

    // 1) Run the transaction (reads first, then writes — only numbers/strings)
    const txPromise = db.runTransaction(async (tx) => {
      // ===== DETERMINE THE CORRECT AGENT UID =====
      let finalAgentUid: string | null = assignedAgentUid;

      // If there's an assigned agent, check if they're working
      if (assignedAgentUid) {
        const assignedEmpRef = this.afs.doc(
          `users/${ownerUid}/employees/${assignedAgentUid}`
        ).ref;
        const assignedEmpSnap = await tx.get(assignedEmpRef);

        if (assignedEmpSnap.exists) {
          const assignedEmp = assignedEmpSnap.data();
          if (this.isWorkingEmployee(assignedEmp)) {
            // Assigned employee is working, use them
            finalAgentUid = assignedAgentUid;
          } else {
            // Assigned employee is NOT working, find another working employee
            let foundWorkingEmployee: string | null = null;

            // Read other employee documents one by one until we find a working one
            for (const empId of allEmployeeIds) {
              // Skip the assigned agent (we already know they're not working)
              if (empId === assignedAgentUid) continue;

              const empRef = this.afs.doc(
                `users/${ownerUid}/employees/${empId}`
              ).ref;
              const empSnap = await tx.get(empRef);

              if (empSnap.exists) {
                const empData = empSnap.data();
                if (this.isWorkingEmployee(empData)) {
                  foundWorkingEmployee = empId;
                  break; // Found first working employee that's not the assigned one
                }
              }
            }

            // Use the found working employee, or fall back to assigned agent if none found
            finalAgentUid = foundWorkingEmployee || assignedAgentUid;
          }
        }
      } else {
        // No assigned agent, find the first working employee
        for (const empId of allEmployeeIds) {
          const empRef = this.afs.doc(
            `users/${ownerUid}/employees/${empId}`
          ).ref;
          const empSnap = await tx.get(empRef);

          if (empSnap.exists) {
            const empData = empSnap.data();
            if (this.isWorkingEmployee(empData)) {
              finalAgentUid = empId;
              break; // Found first working employee
            }
          }
        }
        // If no working employee found, finalAgentUid remains null
      }

      // ===== READS =====
      const ownerSnap = await tx.get(ownerDailyRef);
      const prevOwnerVal = ownerSnap.exists ? ownerSnap.get(dayKey) : 0;
      const prevOwner =
        typeof prevOwnerVal === 'number'
          ? prevOwnerVal
          : Number(prevOwnerVal || 0);

      let prevTotal = 0;
      let prevCount = 0;
      let empDayTotalsRef = null;
      let empLedgerRef = null;

      // Create employee refs based on the determined finalAgentUid
      if (finalAgentUid) {
        empDayTotalsRef = this.afs.doc(
          `users/${ownerUid}/employees/${finalAgentUid}/dayTotals/${dayKey}`
        ).ref;
        empLedgerRef = this.afs
          .collection(`users/${ownerUid}/employees/${finalAgentUid}/payments`)
          .doc().ref;

        const daySnap = await tx.get(empDayTotalsRef);
        if (daySnap.exists) {
          const d: any = daySnap.data();
          prevTotal = Number(d?.total || 0);
          prevCount = Number(d?.count || 0);
        }
      }

      // Precompute primitive time fields (avoid Timestamp/serverTimestamp)
      const now = new Date();
      const startOfDay = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
      );
      const dayStartMs = startOfDay.getTime();
      const nowMs = Date.now();
      const monthKey = `${now.getFullYear()}-${String(
        now.getMonth() + 1
      ).padStart(2, '0')}`;

      // ===== WRITES =====
      tx.set(
        clientRef,
        {
          amountPaid: client.amountPaid,
          creditScore: client.creditScore,
          numberOfPaymentsMade: client.numberOfPaymentsMade,
          numberOfPaymentsMissed: client.numberOfPaymentsMissed,
          payments: client.payments,
          savings: client.savings,
          savingsPayments: client.savingsPayments,
          debtLeft: client.debtLeft,
        },
        { merge: true }
      );

      tx.set(ownerDailyRef, { [dayKey]: prevOwner + amount }, { merge: true });

      if (empDayTotalsRef && empLedgerRef) {
        tx.set(
          empDayTotalsRef,
          {
            total: prevTotal + amount,
            count: prevCount + 1,
            dayKey,
            dayStartMs,
            monthKey,
            updatedAtMs: nowMs,
          },
          { merge: true }
        );

        tx.set(empLedgerRef, {
          amount: amount,
          dayKey,
          clientUid: client.uid,
          trackingId: client.trackingId || null,
          createdAtMs: nowMs,
          savings: savingsNum || 0,
        });
      }
    });

    // 2) After the transaction succeeds, call your existing helper
    //    (we pass `dayKey` as the `date` argument).
    return txPromise.then(() =>
      this.updateUserInfoForClientPayment(client, savings, dayKey, payment)
    );
  }

  clientDeposit(client: Client, savings: string, date: string) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const data = {
      savings: client.savings,
      savingsPayments: client.savingsPayments,
    };
    this.updateUserInfoForClientDeposit(client, savings, date);
    return clientRef.set(data, { merge: true });
  }
  setClientField(field: string, value: any, clientId: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${clientId}`
    );
    const data = {
      [field]: value, // Dynamic key assignment
    };
    return userRef.set(data, { merge: true });
  }
  clientCardPayment(clientCard: Card) {
    const clientCardRef: AngularFirestoreDocument<Card> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/cards/${clientCard.uid}`
    );
    const data = {
      amountPaid: clientCard.amountPaid,
      numberOfPaymentsMade: clientCard.numberOfPaymentsMade,
      payments: clientCard.payments,
    };
    return clientCardRef.set(data, { merge: true });
  }

  clientCardReturnMoney(clientCard: Card) {
    const clientCardRef: AngularFirestoreDocument<Card> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/cards/${clientCard.uid}`
    );
    const data = {
      amountPaid: clientCard.amountPaid,
      withdrawal: clientCard.withdrawal,
      clientCardStatus: 'ended',
      requestAmount: '',
      requestStatus: '',
      requestType: '',
      requestDate: '',
      payments: {},
    };
    return clientCardRef.set(data, { merge: true });
  }
  clientCardRequestReturnMoney(clientCard: Card) {
    const clientCardRef: AngularFirestoreDocument<Card> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/cards/${clientCard.uid}`
    );
    const data = {
      requestAmount: clientCard.requestAmount,
      requestStatus: 'pending',
      requestDate: clientCard.requestDate,
      requestType: 'card',
      dateOfRequest: clientCard.dateOfRequest,
    };
    return clientCardRef.set(data, { merge: true });
  }

  updateClientInfo(client: Client) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );

    const data = {
      firstName: client.firstName,
      lastName: client.lastName,
      middleName: client.middleName,
      phoneNumber: client.phoneNumber,
      previousPhoneNumbers: client.previousPhoneNumbers || [], // 👈 history
      businessAddress: client.businessAddress,
      homeAddress: client.homeAddress,
      profession: client.profession,
      paymentDay: client.paymentDay,
      agent: client.agent,
      ...(client.vitalStatus !== undefined && {
        vitalStatus: client.vitalStatus,
      }),
    };

    return clientRef.set(data, { merge: true });
  }

  updateClientInvestigationFields(
    clientId: string,
    payload: Partial<Client>
  ) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${clientId}`
    );
    return clientRef.set(payload, { merge: true });
  }

  updateClientInvestigationFieldsForUser(
    userId: string,
    clientId: string,
    payload: Partial<Client>
  ) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${userId}/clients/${clientId}`
    );
    return clientRef.set(payload, { merge: true });
  }

  updateEmployeeInfoForClientAgentAssignment(agent: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${agent.uid}`
    );

    const data = {
      clients: agent.clients,
    };

    return employeeRef.set(data, { merge: true });
  }
  updateEmployeeInfoBulk(agentClientMap: { [agentId: string]: string[] }) {
    const batch: any = this.afs.firestore.batch();

    Object.keys(agentClientMap).forEach((agentId) => {
      const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
        `users/${this.auth.currentUser.uid}/employees/${agentId}`
      );

      const data = {
        clients: agentClientMap[agentId],
      };

      // Use .set with { mergeFields: ['clients'] } to update only the clients array
      batch.set(employeeRef.ref, data, { mergeFields: ['clients'] });
    });

    // Commit the batch
    return batch.commit();
  }

  // data.service.ts
  getEmployeeDayTotalsForDay(
    ownerUid: string,
    empUid: string,
    dayKey: string
  ): Promise<{ total: number; count: number }> {
    const basePath = `users/${ownerUid}/employees/${empUid}/dayTotals`;
    const tryGet = (key: string) =>
      this.afs
        .doc(`${basePath}/${key}`)
        .ref.get()
        .then((snap) => {
          if (!snap.exists) return null;
          const d: any = snap.data() || {};
          return { total: Number(d?.total || 0), count: Number(d?.count || 0) };
        });

    // first try exact key
    return tryGet(dayKey).then(async (res) => {
      if (res) return res;
      // fallback: remove leading zeros from M/D if your stored docs use "9-5-2025"
      const altKey = dayKey.replace(/\b0(\d)/g, '$1'); // "09-05-2025" -> "9-5-2025"
      if (altKey !== dayKey) {
        const alt = await tryGet(altKey);
        if (alt) return alt;
      }
      return { total: 0, count: 0 };
    });
  }

  // Utility to chunk large arrays for batch writes
  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  private pickClientIds(
    sourceIds: string[],
    count?: number,
    randomize: boolean = true
  ): string[] {
    const unique = Array.from(new Set(sourceIds));
    if (!count || count >= unique.length) {
      return unique;
    }

    if (!randomize) {
      return unique.slice(0, count);
    }

    const shuffled = [...unique];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
  }

  /**
   * Transfer clients from employee A -> employee B.
   * - Removes the selected clients from A
   * - Adds them (deduped) to B
   * - Updates each client { agent: B }
   * Returns the count of selected clients.
   */
  async transferCurrentClients(
    sourceEmployeeId: string,
    targetEmployeeId: string,
    opts?: { count?: number; randomize?: boolean }
  ): Promise<number> {
    const tenantUid = this.auth.currentUser.uid;

    const srcRef = this.afs.doc<any>(
      `users/${tenantUid}/employees/${sourceEmployeeId}`
    ).ref;
    const dstRef = this.afs.doc<any>(
      `users/${tenantUid}/employees/${targetEmployeeId}`
    ).ref;

    const [srcSnap, dstSnap] = await Promise.all([srcRef.get(), dstRef.get()]);
    const srcExists = srcSnap.exists;
    if (!dstSnap.exists) throw new Error('Target employee not found');

    const srcData = srcExists ? srcSnap.data() || {} : {};
    const dstData = dstSnap.data() || {};

    // Prefer stored 'clients'; fall back to 'currentClients' if necessary
    const rawSrc: string[] = srcExists
      ? ((srcData.clients ?? srcData.currentClients ?? []) as string[])
      : await this.getClientIdsForAgent(tenantUid, sourceEmployeeId);
    const rawDst: string[] = (dstData.clients ??
      dstData.currentClients ??
      []) as string[];

    if (!rawSrc.length) {
      return 0;
    }

    // De-duplicate both sides first
    const srcUnique = Array.from(new Set(rawSrc));
    const selectedIds = this.pickClientIds(
      srcUnique,
      opts?.count,
      opts?.randomize ?? true
    );
    const selectedSet = new Set(selectedIds);
    const dstSet = new Set(rawDst);

    // What will actually be ADDED to B (not already there)
    const toAdd = selectedIds.filter((id) => !dstSet.has(id));

    // New target array = union (still deduped)
    const newDst = Array.from(new Set([...rawDst, ...selectedIds]));
    const remainingSrc = rawSrc.filter((id) => !selectedSet.has(id));

    // 1) Update A (clear) and B (union) atomically
    await this.afs.firestore.runTransaction(async (tx) => {
      if (srcExists) {
        tx.update(srcRef, { clients: remainingSrc });
      }
      tx.update(dstRef, { clients: newDst });
    });

    // 2) Reassign each client’s agent to B (use ALL unique from A)
    const toReassign = selectedIds;
    const chunk = <T>(arr: T[], size: number) =>
      arr.reduce<T[][]>(
        (acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]),
        []
      );

    for (const ids of chunk(toReassign, 450)) {
      const batch = this.afs.firestore.batch();
      ids.forEach((clientId) => {
        const cRef = this.afs.doc(`users/${tenantUid}/clients/${clientId}`).ref;
        batch.update(cRef, { agent: targetEmployeeId });
      });
      await batch.commit();
    }

    // Return the number of clients we attempted to move (selected)
    return selectedIds.length;
  }

  private async getClientIdsForAgent(
    tenantUid: string,
    agentId: string
  ): Promise<string[]> {
    if (!agentId) {
      return [];
    }
    const snapshot = await this.afs.firestore
      .collection(`users/${tenantUid}/clients`)
      .where('agent', '==', agentId)
      .get();
    return snapshot.docs.map((doc) => doc.id);
  }

  /**
   * Swap the entire client lists between two employees.
   * - Employee A receives B's clients and vice-versa
   * - Each client's `agent` field is updated to the new owner
   * - Clients that both employees already shared keep their current agent assignment
   * Returns the number of clients reassigned to each employee.
   */
  async swapClientsBetweenEmployees(
    firstEmployeeId: string,
    secondEmployeeId: string
  ): Promise<{ toFirst: number; toSecond: number }> {
    if (firstEmployeeId === secondEmployeeId) {
      throw new Error('Les deux employés doivent être différents.');
    }

    const tenantUid = this.auth.currentUser.uid;

    const firstRef = this.afs.doc<any>(
      `users/${tenantUid}/employees/${firstEmployeeId}`
    ).ref;
    const secondRef = this.afs.doc<any>(
      `users/${tenantUid}/employees/${secondEmployeeId}`
    ).ref;

    const [firstSnap, secondSnap] = await Promise.all([
      firstRef.get(),
      secondRef.get(),
    ]);
    if (!firstSnap.exists) {
      throw new Error('Premier employé introuvable');
    }
    if (!secondSnap.exists) {
      throw new Error('Deuxième employé introuvable');
    }

    const firstData = firstSnap.data() || {};
    const secondData = secondSnap.data() || {};

    const rawFirst: string[] = (firstData.clients ??
      firstData.currentClients ??
      []) as string[];
    const rawSecond: string[] = (secondData.clients ??
      secondData.currentClients ??
      []) as string[];

    const firstUnique = Array.from(new Set(rawFirst));
    const secondUnique = Array.from(new Set(rawSecond));

    if (!firstUnique.length && !secondUnique.length) {
      return { toFirst: 0, toSecond: 0 };
    }

    const secondSet = new Set(secondUnique);
    const shared = new Set(firstUnique.filter((id) => secondSet.has(id)));

    // Swap the arrays (still deduped)
    await this.afs.firestore.runTransaction(async (tx) => {
      tx.update(firstRef, { clients: secondUnique });
      tx.update(secondRef, { clients: firstUnique });
    });

    const assignToFirst = secondUnique.filter((id) => !shared.has(id));
    const assignToSecond = firstUnique.filter((id) => !shared.has(id));

    for (const ids of this.chunk(assignToFirst, 450)) {
      const batch = this.afs.firestore.batch();
      ids.forEach((clientId) => {
        const cRef = this.afs.doc(`users/${tenantUid}/clients/${clientId}`).ref;
        batch.update(cRef, { agent: firstEmployeeId });
      });
      await batch.commit();
    }

    for (const ids of this.chunk(assignToSecond, 450)) {
      const batch = this.afs.firestore.batch();
      ids.forEach((clientId) => {
        const cRef = this.afs.doc(`users/${tenantUid}/clients/${clientId}`).ref;
        batch.update(cRef, { agent: secondEmployeeId });
      });
      await batch.commit();
    }

    return {
      toFirst: assignToFirst.length,
      toSecond: assignToSecond.length,
    };
  }

  /**
   * Copy clients from employee A -> employee B.
   * - Adds selected clients to B (deduped); A keeps them.
   * - Does NOT touch the client.agent (original owner keeps it).
   * Returns the number of clients newly added to B.
   */
  async copyClientsToEmployee(
    sourceEmployeeId: string,
    targetEmployeeId: string,
    opts?: { count?: number; randomize?: boolean }
  ): Promise<number> {
    const tenantUid = this.auth.currentUser.uid;

    const srcRef = this.afs.doc<any>(
      `users/${tenantUid}/employees/${sourceEmployeeId}`
    ).ref;
    const dstRef = this.afs.doc<any>(
      `users/${tenantUid}/employees/${targetEmployeeId}`
    ).ref;

    const [srcSnap, dstSnap] = await Promise.all([srcRef.get(), dstRef.get()]);
    if (!srcSnap.exists) throw new Error('Source employee not found');
    if (!dstSnap.exists) throw new Error('Target employee not found');

    const srcData = srcSnap.data() || {};
    const dstData = dstSnap.data() || {};

    const rawSrc: string[] = (srcData.clients ??
      srcData.currentClients ??
      []) as string[];
    const rawDst: string[] = (dstData.clients ??
      dstData.currentClients ??
      []) as string[];

    const srcUnique = Array.from(new Set(rawSrc));
    const selectedIds = this.pickClientIds(
      srcUnique,
      opts?.count,
      opts?.randomize ?? true
    );

    const dstSet = new Set(rawDst);
    const toAdd = selectedIds.filter((id) => !dstSet.has(id));
    if (!toAdd.length) {
      return 0;
    }

    const newDst = Array.from(new Set([...rawDst, ...selectedIds]));
    await dstRef.update({ clients: newDst });

    return toAdd.length;
  }

  /**
   * Remove duplicate client IDs that exist on both employees.
   * removeFrom: 'source' removes from employee A, 'target' removes from B.
   * Returns the number of duplicates removed.
   */
  async removeDuplicateClientsBetweenEmployees(
    sourceEmployeeId: string,
    targetEmployeeId: string,
    removeFrom: 'source' | 'target'
  ): Promise<number> {
    const tenantUid = this.auth.currentUser.uid;

    const srcRef = this.afs.doc<any>(
      `users/${tenantUid}/employees/${sourceEmployeeId}`
    ).ref;
    const dstRef = this.afs.doc<any>(
      `users/${tenantUid}/employees/${targetEmployeeId}`
    ).ref;

    const [srcSnap, dstSnap] = await Promise.all([srcRef.get(), dstRef.get()]);
    if (!srcSnap.exists) throw new Error('Source employee not found');
    if (!dstSnap.exists) throw new Error('Target employee not found');

    const srcData = srcSnap.data() || {};
    const dstData = dstSnap.data() || {};

    const rawSrc: string[] = (srcData.clients ??
      srcData.currentClients ??
      []) as string[];
    const rawDst: string[] = (dstData.clients ??
      dstData.currentClients ??
      []) as string[];

    const srcSet = new Set(rawSrc);
    const dstSet = new Set(rawDst);
    const duplicates = [...srcSet].filter((id) => dstSet.has(id));

    if (!duplicates.length) {
      return 0;
    }

    const dupSet = new Set(duplicates);
    if (removeFrom === 'source') {
      const updated = rawSrc.filter((id) => !dupSet.has(id));
      await srcRef.update({ clients: updated });
    } else {
      const updated = rawDst.filter((id) => !dupSet.has(id));
      await dstRef.update({ clients: updated });
    }

    return duplicates.length;
  }

  updateEmployeeInfo(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );

    const data: any = {
      firstName: employee.firstName,
      lastName: employee.lastName,
      middleName: employee.middleName,
      phoneNumber: employee.phoneNumber,
      dateJoined: employee.dateJoined,
      sex: employee.sex,
      dateOfBirth: employee.dateOfBirth,
      status: employee.status,
      role: employee.role,
      vacationAcceptedNumberOfDays: employee.vacationAcceptedNumberOfDays,
      arrivalHour: employee.arrivalHour,
      arrivalMinute: employee.arrivalMinute,
      originLocation: employee.originLocation || '',
    };

    // Handle trophy arrays - filter out empty trophies and include only valid ones
    if (employee.bestTeamTrophies && Array.isArray(employee.bestTeamTrophies)) {
      data.bestTeamTrophies = employee.bestTeamTrophies.filter(
        (trophy) =>
          trophy.month &&
          trophy.month.trim() !== '' &&
          trophy.year &&
          trophy.year.toString().trim() !== ''
      );
    } else {
      data.bestTeamTrophies = [];
    }

    if (
      employee.bestEmployeeTrophies &&
      Array.isArray(employee.bestEmployeeTrophies)
    ) {
      data.bestEmployeeTrophies = employee.bestEmployeeTrophies.filter(
        (trophy) =>
          trophy.month &&
          trophy.month.trim() !== '' &&
          trophy.year &&
          trophy.year.toString().trim() !== ''
      );
    } else {
      data.bestEmployeeTrophies = [];
    }

    return employeeRef.set(data, { merge: true });
  }
  updateAuditInfo(audit: Audit) {
    const auditRef: AngularFirestoreDocument<Audit> = this.afs.doc(
      `audit/${audit.id}`
    );

    const data = {
      name: audit.name,
      phoneNumber: audit.phoneNumber,
    };

    return auditRef.set(data, { merge: true });
  }
  /**
   * Replace the audit’s pendingClients with a new array
   */
  updateAuditPendingClients(
    auditId: string,
    pendingClients: any[]
  ): Promise<void> {
    // note the path here is `audit/${auditId}`—match whatever you use elsewhere
    return this.afs
      .doc(`audit/${auditId}`)
      .set({ pendingClients }, { merge: true });
  }
  createAudit(audit: Partial<Audit>) {
    const docRef = this.afs.collection('audit').doc();

    const newAudit: Audit = {
      id: docRef.ref.id,
      name: audit.name || '',
      phoneNumber: audit.phoneNumber || '',
      profilePicture: audit.profilePicture || '',
      pendingClients: audit.pendingClients || [],
    };

    return docRef.set(newAudit, { merge: true });
  }
  deleteAudit(auditId: string) {
    return this.afs.collection('audit').doc(auditId).delete();
  }
  updateEmployeeBonusInfo(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );

    const data = {
      bonusAmount: employee.bonusAmount,
      bonusPercentage: employee.bonusPercentage,
      bestTeamBonusAmount: employee.bestTeamBonusAmount,
      bestEmployeeBonusAmount: employee.bestEmployeeBonusAmount,
      bestManagerBonusAmount: employee.bestManagerBonusAmount,
      totalBonusThisMonth: employee.totalBonusThisMonth,
    };

    return employeeRef.set(data, { merge: true });
  }
  removePendingClientByFilter(audit: Audit, clientIdToRemove: string) {
    // 1) Filter out the client from the local array
    const newPendingClients = audit.pendingClients
      ? audit.pendingClients.filter((pc) => pc.clientId !== clientIdToRemove)
      : [];

    // 2) Build the new object to save
    const updatedAuditData = {
      pendingClients: newPendingClients,
    };

    // 3) Use set(..., { merge: true }) to overwrite pendingClients
    const auditDocRef: AngularFirestoreDocument<Audit> = this.afs.doc(
      `audit/${audit.id}`
    );
    return auditDocRef.set(updatedAuditData, { merge: true });
  }
  updateEmployeePaymentInfo(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );

    const data = {
      paymentAmount: employee.paymentAmount,
      paymentAbsent: employee.paymentAbsent,
      paymentNothing: employee.paymentNothing,
      paymentIncreaseYears: employee.paymentIncreaseYears,
      paymentLate: employee.paymentLate,
      paymentBankFee: employee.paymentBankFee,
      paymentObjectiveWeekDeductionTotal:
        employee.paymentObjectiveWeekDeductionTotal,
      paymentObjectiveWeekDeductions: employee.paymentObjectiveWeekDeductions,
      totalPayments: employee.totalPayments,
    };

    return employeeRef.set(data, { merge: true });
  }

  toggleEmployeeCheckVisibility(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );

    // Toggle the checkVisible value, handling undefined case
    let newVisibility: string;
    if (employee.checkVisible === undefined) {
      newVisibility = 'true';
    } else {
      newVisibility = employee.checkVisible === 'true' ? 'false' : 'true';
    }

    const data = {
      checkVisible: newVisibility,
    };

    return employeeRef.set(data, { merge: true });
  }
  toggleEmployeePaymentCheckVisibility(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );
    let newVisibility: string;
    if (employee.paymentCheckVisible === undefined) {
      newVisibility = 'true';
    } else {
      newVisibility =
        employee.paymentCheckVisible === 'true' ? 'false' : 'true';
    }

    const data = {
      paymentCheckVisible: newVisibility,
    };

    return employeeRef.set(data, { merge: true });
  }
  toggleEmployeeContractSignVisibility(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );

    const newVisibility =
      employee.contractSignVisible === 'true' ? 'false' : 'true';

    return employeeRef.set(
      {
        contractSignVisible: newVisibility,
      },
      { merge: true }
    );
  }

  updateEmployeeContractDocument(
    employee: Employee,
    payload: {
      contract: string;
      signedAt: string;
      signedBy: string;
      contractYear: string;
      contractRole?: string;
      contractSignVisible?: string;
      contractSignatureImage?: string | null;
    }
  ) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );

    const data = {
      contract: payload.contract,
      contractSignedAt: payload.signedAt,
      contractSignedBy: payload.signedBy,
      contractYear: payload.contractYear,
      contractRole: payload.contractRole ?? employee.role,
      contractSignVisible:
        payload.contractSignVisible ?? employee.contractSignVisible ?? 'false',
      contractSignatureImage:
        payload.contractSignatureImage ?? employee.contractSignatureImage ?? null,
    };

    return employeeRef.set(data, { merge: true });
  }
  async updateEmployeeBonusCheckUrl(employee: Employee, url: string) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );

    const data = {
      bonusCheckUrl: url,
    };

    return employeeRef.set(data, { merge: true });
  }

  initiateNewDebtCycle(client: Client) {
    const data = {
      firstName: client.firstName,
      lastName: client.lastName,
      middleName: client.middleName,
      phoneNumber: client.phoneNumber,
      businessCapital: client.businessCapital,
      homeAddress: client.homeAddress,
      businessAddress: client.businessAddress,
      debtCycle: (Number(client.debtCycle) + 1).toString(),
      membershipFee: client.membershipFee,
      applicationFee: client.applicationFee,
      savings: client.savings,
      loanAmount: client.loanAmount,
      creditScore: client.creditScore,
      amountToPay: client.amountToPay,
      interestRate: client.interestRate,
      debtCycleStartDate: client.debtCycleStartDate,
      debtCycleEndDate: client.debtCycleEndDate,
      paymentPeriodRange: client.paymentPeriodRange,
      profession: client.profession,
      agent: client.agent,
      amountPaid: '0',
      numberOfPaymentsMissed: '0',
      numberOfPaymentsMade: '0',
      payments: {},

      debtLeft: client.amountToPay,
    };
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    return clientRef
      .set(data, { merge: true })
      .then(() => {
        // Explicitly set `savingsPayments` to ensure it is not merged
        clientRef.update({ savingsPayments: client.savingsPayments });
      })
      .catch((error) => console.error('Failed to update client data:', error));
    // return clientRef.set(data, { merge: true });
  }

  registerNewDebtCycle(client: Client) {
    const data = {
      firstName: client.firstName,
      lastName: client.lastName,
      middleName: client.middleName,
      phoneNumber: client.phoneNumber,
      previousPhoneNumbers: client.previousPhoneNumbers || [], // 👈 persist history
      birthDate: client.birthDate, // ex. 05-21-1985
      businessCapital: client.businessCapital,
      homeAddress: client.homeAddress,
      businessAddress: client.businessAddress,
      creditScore: client.creditScore, // in case they went to 0 and 6 months has passed since they finished. in other case, it does nothing
      debtCycle: (Number(client.debtCycle) + 1).toString(),
      membershipFee: client.membershipFee,
      applicationFee: client.applicationFee,
      savings: client.savings,
      loanAmount: client.loanAmount,
      profession: client.profession,
      amountPaid: '0',
      type: 'register',
      numberOfPaymentsMissed: '0',
      numberOfPaymentsMade: '0',
      previousPayments: client.previousPayments,
      previousSavingsPayments: client.previousSavingsPayments,
      payments: {},
      amountToPay: '0',
      debtLeft: '0',
      requestAmount: client.requestAmount,
      requestStatus: 'pending',
      requestType: 'lending',
      references: client.references,
      isPhoneCorrect: 'true',
      vitalStatus: '',
      agentVerifyingName: '',
      agentSubmittedVerification: '',
      requestDate: client.requestDate,
      dateOfRequest: client.dateOfRequest,
      applicationFeePayments: client.applicationFeePayments,
      membershipFeePayments: client.membershipFeePayments,

      comments: [],
    };
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    return clientRef
      .set(data, { merge: true })
      .then(() => {
        // Explicitly set `savingsPayments` to ensure it is not merged
        clientRef.update({ savingsPayments: client.savingsPayments });
      })
      .catch((error) => console.error('Failed to update client data:', error));
    // return clientRef.set(data, { merge: true });
  }
  public async saveCurrentCycle(client: Client): Promise<void> {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const cycleId = this.afs.createId();

    // Fetch the current client data
    const clientData = await clientRef.ref
      .get()
      .then((doc) => doc.data() as Client);

    if (clientData) {
      const cyclesCollection: AngularFirestoreCollection<any> =
        clientRef.collection('cycles');

      const cycleData = {
        ...clientData,
        comments: Array.isArray(clientData.comments) ? clientData.comments : [], // ← ensure included
        debtCycle: clientData.debtCycle,
        cycleId: cycleId,
        // Optionally, remove fields that shouldn't be duplicated
      }; // Or use a timestamp: Date.now().toString()

      // Add a timestamp or cycle number as document ID
      return cyclesCollection.doc(cycleId).set(cycleData);
    } else {
      throw new Error('Client data not found.');
    }
  }
  getClientCycles(clientId: string): Observable<any[]> {
    const cyclesCollection: AngularFirestoreCollection<any> =
      this.afs.collection(
        `users/${this.auth.currentUser.uid}/clients/${clientId}/cycles`,
        (ref) => ref.orderBy('debtCycle', 'desc') // Adjust ordering as needed
      );
    return cyclesCollection.valueChanges({ idField: 'cycleId' });
  }
  getClientCycle(clientId: string, cycleId: string): Observable<any> {
    const cycleDoc: AngularFirestoreDocument<any> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${clientId}/cycles/${cycleId}`
    );
    return cycleDoc.valueChanges();
  }

  registerClientRequestUpdate(client: Client) {
    const data = {
      firstName: client.firstName,
      lastName: client.lastName,
      middleName: client.middleName,
      phoneNumber: client.phoneNumber,
      businessCapital: client.businessCapital,
      homeAddress: client.homeAddress,
      businessAddress: client.businessAddress,
      loanAmount: client.loanAmount,
      profession: client.profession,
      amountPaid: '0',
      type: 'register',
      numberOfPaymentsMissed: '0',
      numberOfPaymentsMade: '0',
      payments: {},
      amountToPay: '0',
      debtLeft: '0',
      requestAmount: client.requestAmount,
      requestStatus: 'pending',
      requestType: 'lending',
      requestDate: client.requestDate,
      dateOfRequest: client.dateOfRequest,
    };
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    return clientRef
      .set(data, { merge: true })
      .then(() => {
        // Explicitly set `savingsPayments` to ensure it is not merged
        clientRef.update({ savingsPayments: client.savingsPayments });
      })
      .catch((error) => console.error('Failed to update client data:', error));
    // return clientRef.set(data, { merge: true });
  }

  transformRegisterClientToFullClient(client: Client) {
    const data = {
      firstName: client.firstName,
      lastName: client.lastName,
      middleName: client.middleName,
      phoneNumber: client.phoneNumber,
      businessCapital: client.businessCapital,
      homeAddress: client.homeAddress,
      businessAddress: client.businessAddress,
      debtCycle: client.debtCycle,
      loanAmount: client.loanAmount,
      creditScore: client.creditScore,
      amountToPay: client.amountToPay,
      interestRate: client.interestRate,
      paymentDay: client.paymentDay,
      debtCycleStartDate: client.debtCycleStartDate,
      debtCycleEndDate: client.debtCycleEndDate,
      paymentPeriodRange: client.paymentPeriodRange,
      profession: client.profession,
      agent: client.agent,
      amountPaid: '0',
      numberOfPaymentsMissed: '0',
      numberOfPaymentsMade: '0',
      requestAmount: '',
      requestStatus: '',
      requestType: '',
      requestDate: '',
      payments: {},
      type: '',
      debtLeft: client.amountToPay,
    };

    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    return clientRef.set(data, { merge: true });
  }

  updateUserInfoForAddInvestment(amount: string) {
    let dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      amountInvestedDollars: (
        Number(this.auth.currentUser.amountInvestedDollars) + Number(dollar)
      ).toString(),
      amountInvested: (
        Number(this.auth.currentUser.amountInvested) + Number(amount)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) + Number(amount)
      ).toString(),
      investments: { [this.time.todaysDate()]: amount },
      investmentsDollar: { [this.time.todaysDate()]: dollar.toString() },
    };

    return userRef.set(data, { merge: true });
  }

  updateUserInfoForAddToReserve(amount: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    let dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const data = {
      reserveAmount: (
        Number(this.auth.currentUser.reserveAmount) + Number(amount)
      ).toString(),
      reserveAmountDollar: (
        Number(this.auth.currentUser.reserveAmountDollar) + Number(dollar)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) - Number(amount)
      ).toString(),

      reserve: { [this.time.todaysDate()]: amount },
      reserveinDollar: { [this.time.todaysDate()]: dollar.toString() },
    };

    return userRef.set(data, { merge: true });
  }

  updateManagementInfoForAddToReserve(amount: string) {
    const managementRef: AngularFirestoreDocument<Management> = this.afs.doc(
      `management/${this.auth.managementInfo.id}`
    );
    // let dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const data = {
      moneyInHands: (
        Number(this.auth.managementInfo.moneyInHands) + Number(amount)
      ).toString(),

      reserve: { [this.time.todaysDate()]: amount },
    };

    return managementRef.set(data, { merge: true });
  }

  /**
   * Atomically updates both the user's reserve and management reserve in a single transaction.
   * Ensures that either both updates succeed or neither does - preventing partial updates
   * due to network issues.
   *
   * @param amount - The amount in Congolese Francs to add to reserve
   * @param includeManagement - Whether to also update the management document (false for testing mode)
   */
  async atomicAddToReserve(
    amount: string,
    includeManagement: boolean
  ): Promise<void> {
    const db = this.afs.firestore;
    const amountNum = Number(amount);
    const dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const dateKey = this.time.todaysDate();

    // Document references
    const userRef = this.afs.doc(`users/${this.auth.currentUser.uid}`).ref;
    const managementRef = includeManagement
      ? this.afs.doc(`management/${this.auth.managementInfo.id}`).ref
      : null;

    return db.runTransaction(async (tx) => {
      // ===== READS =====
      const userSnap = await tx.get(userRef);
      const userData = userSnap.data() as User;

      let managementData: Management | null = null;
      if (managementRef) {
        const managementSnap = await tx.get(managementRef);
        managementData = managementSnap.data() as Management;
      }

      // ===== COMPUTE NEW VALUES =====
      // User values
      const newReserveAmount = (
        Number(userData.reserveAmount || 0) + amountNum
      ).toString();
      const newReserveAmountDollar = (
        Number(userData.reserveAmountDollar || 0) + Number(dollar)
      ).toString();
      const newUserMoneyInHands = (
        Number(userData.moneyInHands || 0) - amountNum
      ).toString();

      // Merge reserve map entries
      const existingReserve = userData.reserve || {};
      const existingReserveKey = existingReserve[dateKey];
      const newReserveValue = existingReserveKey
        ? (Number(existingReserveKey) + amountNum).toString()
        : amount;

      const existingReserveDollar = userData.reserveinDollar || {};
      const existingDollarKey = existingReserveDollar[dateKey];
      const newDollarValue = existingDollarKey
        ? (Number(existingDollarKey) + Number(dollar)).toString()
        : dollar.toString();

      // ===== WRITES =====
      // Update user document
      tx.set(
        userRef,
        {
          reserveAmount: newReserveAmount,
          reserveAmountDollar: newReserveAmountDollar,
          moneyInHands: newUserMoneyInHands,
          reserve: { [dateKey]: newReserveValue },
          reserveinDollar: { [dateKey]: newDollarValue },
        },
        { merge: true }
      );

      // Update management document (if applicable)
      if (managementRef && managementData) {
        const newManagementMoneyInHands = (
          Number(managementData.moneyInHands || 0) + amountNum
        ).toString();

        // Merge management reserve map entries
        const existingMgmtReserve = managementData.reserve || {};
        const existingMgmtReserveKey = existingMgmtReserve[dateKey];
        const newMgmtReserveValue = existingMgmtReserveKey
          ? (Number(existingMgmtReserveKey) + amountNum).toString()
          : amount;

        tx.set(
          managementRef,
          {
            moneyInHands: newManagementMoneyInHands,
            reserve: { [dateKey]: newMgmtReserveValue },
          },
          { merge: true }
        );
      }
    });
  }

  updateManagementInfoForAddToInvestment(amount: string) {
    const managementRef: AngularFirestoreDocument<Management> = this.afs.doc(
      `management/${this.auth.managementInfo.id}`
    );
    // let dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const data = {
      moneyInHands: (
        Number(this.auth.managementInfo.moneyInHands) + Number(amount)
      ).toString(),

      investment: { [this.time.todaysDate()]: amount },
    };

    return managementRef.set(data, { merge: true });
  }

  updateManagementInfoForMoneyGiven(amount: string) {
    const managementRef: AngularFirestoreDocument<Management> = this.afs.doc(
      `management/${this.auth.managementInfo.id}`
    );
    // let dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const dateKey = this.time.reserveTargetDateKey();
    const newMoneyInHands =
      Number(this.auth.managementInfo.moneyInHands) - Number(amount);
    const data = {
      moneyInHands: newMoneyInHands.toString(),
      moneyGiven: { [dateKey]: amount },
      moneyInHandsTracking: { [dateKey]: newMoneyInHands.toString() },
    };

    return managementRef.set(data, { merge: true });
  }
  updateManagementInfoToAddMoneyInTheBank(
    amountFrancs: string,
    amountDollars: string,
    loss: string
  ) {
    const managementRef: AngularFirestoreDocument<Management> = this.afs.doc(
      `management/${this.auth.managementInfo.id}`
    );
    // let dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const data = {
      moneyInHands: (
        Number(this.auth.managementInfo.moneyInHands) - Number(amountFrancs)
      ).toString(),

      bankDepositDollars: { [this.time.todaysDate()]: amountDollars },
      bankDepositFrancs: { [this.time.todaysDate()]: amountFrancs },
      dollarTransferLoss: { [this.time.todaysDate()]: loss },
    };

    return managementRef.set(data, { merge: true });
  }

  updateBankDepositDollarEntry(dateKey: string, amountDollars: string) {
    const managementRef: AngularFirestoreDocument<Management> = this.afs.doc(
      `management/${this.auth.managementInfo.id}`
    );

    const data = {
      bankDepositDollars: { [dateKey]: amountDollars },
    };

    return managementRef.set(data, { merge: true });
  }

  updateBankDepositEntry(
    dateKey: string,
    amountDollars: string,
    amountFrancs: string
  ) {
    const managementRef: AngularFirestoreDocument<Management> = this.afs.doc(
      `management/${this.auth.managementInfo.id}`
    );

    const data = {
      bankDepositDollars: { [dateKey]: amountDollars },
      bankDepositFrancs: { [dateKey]: amountFrancs },
    };

    return managementRef.set(data, { merge: true });
  }
  updateManagementInfoForMoneyLoss(amount: string) {
    console.log('data from management', this.auth.managementInfo);
    const managementRef: AngularFirestoreDocument<Management> = this.afs.doc(
      `management/${this.auth.managementInfo.id}`
    );
    // let dollar = this.compute.convertCongoleseFrancToUsDollars(amount);
    const data = {
      moneyInHands: (
        Number(this.auth.managementInfo.moneyInHands) - Number(amount)
      ).toString(),

      exchangeLoss: { [this.time.todaysDate()]: amount },
    };

    return managementRef.set(data, { merge: true });
  }

  updateUserInfoForAddExpense(amount: string, reason: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      expensesAmount: (
        Number(this.auth.currentUser.expensesAmount) + Number(amount)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) - Number(amount)
      ).toString(),

      expenses: { [this.time.todaysDate()]: `${amount}:${reason}` },
    };

    return userRef.set(data, { merge: true });
  }

  updateUserInfoForAddLoss(amount: string, reason: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) - Number(amount)
      ).toString(),

      losses: { [this.time.todaysDate()]: `${amount}:${reason}` },
    };

    return userRef.set(data, { merge: true });
  }
  updateManagementInfoForAddExpense(amount: string, reason: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `management/${this.auth.managementInfo.id}`
    );
    const data = {
      moneyInHands: (
        Number(this.auth.managementInfo.moneyInHands) - Number(amount)
      ).toString(),

      expenses: { [this.time.todaysDate()]: `${amount}:${reason}` },
    };

    return userRef.set(data, { merge: true });
  }

  updateEmployeePictureData(employee: Employee, avatar: Avatar) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );
    const data = {
      profilePicture: avatar,
    };
    return employeeRef.set(data, { merge: true });
  }
  updateAuditPictureData(audit: Audit, url: string) {
    const auditRef: AngularFirestoreDocument<Audit> = this.afs.doc(
      `audit/${audit.id}`
    );
    const data = {
      profilePicture: url,
    };
    return auditRef.set(data, { merge: true });
  }
  updateClientPictureData(client: Client, avatar: Avatar) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const data = {
      profilePicture: avatar,
    };
    return employeeRef.set(data, { merge: true });
  }
  addCommentToClientProfile(client: Client, comments: Comment[]) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );
    const data = {
      comments: comments,
    };
    return clientRef.set(data, { merge: true });
  }
  updateEmployeeAttendance(attendance: any, employeeId: string) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employeeId}`
    );
    const data = {
      attendance: attendance,
    };
    return employeeRef.set(data, { merge: true });
  }
  // In your data service (e.g., data.service.ts)
  updateEmployeeAttendanceForUser(
    attendance: any,
    employeeId: string,
    userId: string
  ) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${userId}/employees/${employeeId}`
    );
    const data = { attendance: attendance };
    return employeeRef.set(data, { merge: true });
  }

  /** ===== Scalable structure ===== */

  private attendanceDoc(userId: string, employeeId: string, dateISO: string) {
    return this.afs.doc(
      `users/${userId}/employees/${employeeId}/attendance/${dateISO}`
    );
  }

  setAttendanceEntry(
    userId: string,
    employeeId: string,
    dateISO: string,
    status: 'P' | 'A' | 'L' | 'N',
    dateLabel: string,
    createdBy: string
  ) {
    const ref = this.attendanceDoc(userId, employeeId, dateISO);
    const payload = {
      status,
      dateISO,
      dateLabel,
      createdAt: new Date(),
      createdBy,
    };
    return ref.set(payload, { merge: true });
  }

  async uploadAttendanceAttachment(
    file: File,
    employeeId: string,
    userId: string,
    dateISO: string,
    uploaderId: string,
    dateLabel: string
  ): Promise<AttendanceAttachment> {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
    const path = `attendance_proofs/${userId}/${employeeId}/${dateISO}/${Date.now()}.${ext}`;

    await this.storage.upload(path, file, {
      contentType: file.type || undefined,
      customMetadata: { userId, employeeId, dateISO, dateLabel, uploaderId },
    });

    const url = await firstValueFrom(this.storage.ref(path).getDownloadURL());

    return {
      url,
      path,
      size: file.size,
      contentType: file.type || 'application/octet-stream',
      uploadedAt: Date.now(), // ⟵ change from ISO string to number
      uploaderId,
    };
  }

  addAttendanceAttachmentDoc(
    userId: string,
    employeeId: string,
    dateISO: string,
    attachment: AttendanceAttachment
  ) {
    const ref = this.attendanceDoc(userId, employeeId, dateISO)
      .collection('attachments')
      .doc(); // autoId
    return ref.set(attachment);
  }
  // DataService
  updateAttendanceKey(
    userId: string,
    employeeId: string,
    label: string,
    status: 'P' | 'A' | 'L' | 'N' | 'V' | 'VP'
  ) {
    const ref = this.afs.doc(`users/${userId}/employees/${employeeId}`);
    return ref.update({ [`attendance.${label}`]: status });
  }

  // NEW: write parallel map attendanceAttachments[date] = attachment
  updateEmployeeAttendanceAttachment(
    employeeId: string,
    userId: string,
    date: string,
    attachment: any
  ) {
    const employeeRef: AngularFirestoreDocument = this.afs.doc(
      `users/${userId}/employees/${employeeId}`
    );
    // Merge nested map (Firestore merges nested objects on set with merge:true)
    const payload = {
      attendanceAttachments: {
        [date]: attachment,
      },
    };
    return employeeRef.set(payload, { merge: true });
  }

  updateEmployeeAttendanceRejection(attendance: any, employeeId: string) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employeeId}`
    );

    // Use update instead of set
    return employeeRef
      .update({ attendance })
      .then(() => {
        console.log('Attendance successfully updated in the database.');
      })
      .catch((error) => {
        console.error('Error updating attendance in the database:', error);
      });
  }
  updateEmployeeNumberOfVacationRequest(vR: string, employeeId: string) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employeeId}`
    );
    const data = {
      vacationRequestNumberOfDays: vR,
    };
    return employeeRef.set(data, { merge: true });
  }
  updateEmployeeNumberOfAcceptedVacation(vA: string, employeeId: string) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employeeId}`
    );
    const data = {
      vacationAcceptedNumberOfDays: vA,
    };
    return employeeRef.set(data, { merge: true });
  }

  addCertificateData(certificate: Certificate[], certificateId: string) {
    const certificateref: AngularFirestoreDocument<any> = this.afs.doc(
      `certificate/${certificateId}`
    );
    const data = {
      certificate: certificate,
    };
    return certificateref.set(data, { merge: true });
  }

  updateEmployeePaymentPictureData(employee: Employee) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );
    console.log(
      'current picture path being added to database',
      employee.paymentsPicturePath
    );
    const data = {
      paymentsPicturePath: employee.paymentsPicturePath,
    };
    return employeeRef.set(data, { merge: true });
  }
  addPaymentToEmployee(employee: Employee, context: string = '') {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );

    const baseKey = this.time.todaysDate();
    const uniqueStamp = Date.now().toString();
    const safeContext = (context || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-');
    const keyParts = [baseKey, uniqueStamp];
    if (safeContext) {
      keyParts.push(safeContext);
    }
    const paymentKey = keyParts.join('-');

    const data = {
      payments: {
        [paymentKey]: `${employee.salaryPaid}`,
      },
    };
    return employeeRef.set(data, { merge: true });
  }
  updateEmployeePaymentCode(employee: Employee) {
    // Implement the logic to update the employee's payment code
    // For example, you might send a request to a server
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );
    const data = {
      paymentCode: employee.paymentCode,
    };
    return employeeRef.set(data, { merge: true });
  }
  // In data.service.ts (or wherever):
  updateEmployeeReceiptsField(employee: Employee) {
    const docRef = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employee.uid}`
    );
    // or `users/${this.auth.currentUser.uid}/employees/${employee.uid}`, depending on your structure
    return docRef.update({ receipts: employee.receipts });
  }

  async atomicClientCardAndUserUpdate(clientCard: Card, deposit: string) {
    // Document references
    const clientCardRef = this.afs.doc<Card>(
      `users/${this.auth.currentUser.uid}/cards/${clientCard.uid}`
    ).ref;

    const userRef = this.afs.doc<User>(
      `users/${this.auth.currentUser.uid}`
    ).ref;

    // Exactly the same data you normally set in each separate call:
    const cardData = {
      amountPaid: clientCard.amountPaid,
      numberOfPaymentsMade: clientCard.numberOfPaymentsMade,
      payments: clientCard.payments,
    };

    const date = this.time.todaysDateMonthDayYear();
    const depot = this.computeDailyCardPayments(date, deposit);
    const userData = {
      cardsMoney: (
        Number(this.auth.currentUser.cardsMoney) + Number(deposit)
      ).toString(),
      dailyCardPayments: {
        [date]: `${depot}`,
      },
    };

    // 2. Build a single Firestore WriteBatch
    const batch = this.afs.firestore.batch();

    // 3. Enqueue our two .set() operations
    batch.set(clientCardRef, cardData, { merge: true });
    batch.set(userRef, userData, { merge: true });

    // 4. Commit the batch atomically
    return batch.commit();
  }

  updateUserInfoForClientCardPayment(deposit: string) {
    let date = this.time.todaysDateMonthDayYear();
    let depot: any = this.computeDailyCardPayments(date, deposit);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );

    const data = {
      cardsMoney: (
        Number(this.auth.currentUser.cardsMoney) + Number(deposit)
      ).toString(),
      dailyCardPayments: {
        [date]: `${depot}`,
      },
    };
    return userRef.set(data, { merge: true });
  }

  updateUserInfoForClientCardReturnMoney(amountToGiveBack: string) {
    let date = this.time.todaysDateMonthDayYear();
    let depot: any = this.computeDailyCardReturns(date, amountToGiveBack);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );

    const data = {
      cardsMoney: (
        Number(this.auth.currentUser.cardsMoney) - Number(amountToGiveBack)
      ).toString(),
      dailyCardReturns: {
        [date]: `${depot}`,
      },
    };
    return userRef.set(data, { merge: true });
  }

  updateUserInfoForClientCardRequestReturnMoney(
    amountToGiveBack: string,
    client: Card
  ) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    let request: any = this.computeDailyMoneyRequests(
      client.requestDate!,
      amountToGiveBack
    );

    const data = {
      dailyMoneyRequests: {
        [client.requestDate!]: `${request}`,
      },
    };
    return userRef.set(data, { merge: true });
  }
  updateUserInfoForClientPayment(
    client: Client,
    savings: string,
    date: string,
    payment: string
  ) {
    let reimburse: any = this.computeDailyReimbursement(date, payment);
    let save: any = this.computeDailySaving(date, savings);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );

    const data = {
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) + Number(savings)
      ).toString(),
      dailyReimbursement: {
        [date]: `${reimburse}`,
      },
      dailySaving: {
        [date]: `${save}`,
      },
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) +
        Number(savings) +
        Number(payment)
      ).toString(),
      totalDebtLeft: (
        Number(this.auth.currentUser.totalDebtLeft) - Number(payment)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }
  updateUserInfoForClientDeposit(
    client: Client,
    savings: string,
    date: string
  ) {
    let save: any = this.computeDailySaving(date, savings);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );

    const data = {
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) + Number(savings)
      ).toString(),

      dailySaving: {
        [date]: `${save}`,
      },
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) + Number(savings)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }

  updateUserInfoForClientRequestSavingsWithdrawal(
    client: Client,
    withdrawal: string
  ) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    let request: any = this.computeDailyMoneyRequests(
      client.requestDate!,
      withdrawal
    );

    const data = {
      dailyMoneyRequests: {
        [client.requestDate!]: `${request}`,
      },
    };
    return userRef.set(data, { merge: true });
  }

  updateClientCreditScoreBulk(clients: Client[]) {
    const batch: any = this.afs.firestore.batch();

    clients.forEach((client) => {
      const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
        `users/${this.auth.currentUser.uid}/clients/${client.uid}`
      );
      const data = {
        creditScore: '50',
      };
      batch.set(clientRef.ref, data, { merge: true });
    });

    return batch
      .commit()
      .then(() => {
        console.log('Batch update successful');
      })
      .catch((error: any) => {
        console.error('Batch update failed: ', error);
      });
  }
  updateUserInfoForClientSavingsWithdrawal(client: Client, withdrawal: string) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    let date = this.time.todaysDateMonthDayYear();
    // sdd tje minus to mark withdrawal
    let save: any = this.computeDailySavingReturn(date, `${withdrawal}`);
    const data = {
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) - Number(withdrawal)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) - Number(withdrawal)
      ).toString(),
      dailySavingReturns: {
        [date]: `${save}`,
      },
    };
    return userRef.set(data, { merge: true });
  }

  UpdateUserInfoForCancelingdRegisteredClient(client: Client) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    let date = this.time.todaysDateMonthDayYear();
    let save: any = this.computeDailySavingReturn(date, `${client.savings}`);
    let total: number =
      Number(client.applicationFee) +
      Number(client.membershipFee) +
      Number(client.savings);
    let totalFees: number =
      Number(client.applicationFee) + Number(client.membershipFee);
    let Total = this.computeDailyFeesReturn(date, totalFees.toString());
    const data = {
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) - total
      ).toString(),
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) - Number(client.savings)
      ).toString(),
      fees: (
        Number(this.auth.currentUser.fees) -
        (Number(client.applicationFee) + Number(client.membershipFee))
      ).toString(),
      dailySavingReturns: {
        [date]: `${save}`,
      },
      monthBudgetPending: (
        Number(this.auth.currentUser.monthBudgetPending) -
        Number(client.previouslyRequestedAmount)
      ).toString(),
      dailyFeesReturns: {
        [date]: `${Total}`,
      },
    };

    return userRef.set(data, { merge: true });
  }

  updateUserInfoForClientNewDebtCycle(
    client: Client,
    savings: string,
    date: string
  ) {
    let dailyLending: any = this.computeDailyLending(client, date);
    let dailyFees: any = this.computeDailyFees(client, date);
    let save: any = this.computeDailySaving(date, savings);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      amountLended: (
        Number(this.auth.currentUser.amountLended) + Number(client.loanAmount!)
      ).toString(),
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) + Number(savings)
      ).toString(),
      fees: (
        Number(this.auth.currentUser.fees) +
        Number(client.membershipFee) +
        Number(client.applicationFee)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) +
        Number(client.membershipFee) +
        Number(savings) +
        Number(client.applicationFee) -
        Number(client.loanAmount)
      ).toString(),
      projectedRevenue: (
        Number(this.auth.currentUser.projectedRevenue) +
        Number(client.amountToPay)
      ).toString(),
      dailyLending: { [date]: `${dailyLending}` },
      dailySaving: {
        [date]: `${save}`,
      },
      feesData: { [date]: `${dailyFees}` },
      totalDebtLeft: (
        Number(this.auth.currentUser.totalDebtLeft) + Number(client.amountToPay)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }

  updateUserInfoForRegisterClientNewDebtCycle(
    client: Client,
    savings: string,
    date: string
  ) {
    console.log(' the savings being added', savings);
    let dailyFees: any = this.computeDailyFees(client, date);
    let save: any = this.computeDailySaving(date, savings);
    let request: any = this.computeDailyMoneyRequests(
      client.requestDate!,
      client.requestAmount!
    );
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) + Number(savings)
      ).toString(),
      fees: (
        Number(this.auth.currentUser.fees) +
        Number(client.membershipFee) +
        Number(client.applicationFee)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) +
        Number(client.membershipFee) +
        Number(savings) +
        Number(client.applicationFee)
      ).toString(),
      dailySaving: {
        [date]: `${save}`,
      },
      dailyMoneyRequests: {
        [client.requestDate!]: `${request}`,
      },
      // ADDED CHECK FOR CREDIT SCORE >= 70
      monthBudgetPending:
        Number(client.creditScore) >= 70
          ? this.auth.currentUser.monthBudgetPending // skip updating
          : (
              Number(this.auth.currentUser.monthBudgetPending) +
              Number(client.requestAmount)
            ).toString(),

      feesData: { [date]: `${dailyFees}` },
    };
    return userRef.set(data, { merge: true });
  }
  public async updateUserInfoForRegisterClientNewDebtCycleOfflineSafe(
    client: Client,
    addedSavings: number,
    todayApp: string
  ): Promise<void> {
    const uid = this.auth.currentUser.uid;
    const doc = this.afs.doc(`users/${uid}`); // AngularFirestoreDocument
    const inc = firebase.firestore.FieldValue.increment;

    await this.afs.firestore.runTransaction(async (tx) => {
      const snap = await tx.get(doc.ref); // native DocumentReference
      const d = snap.data() as User;

      const toNum = (s?: string) => Number(s || 0);

      const feesInc =
        Number(client.membershipFee) + Number(client.applicationFee);

      const newClientsSavings = toNum(d.clientsSavings) + addedSavings;
      const newFees = toNum(d.fees) + feesInc;
      const newMoneyInHands = toNum(d.moneyInHands) + feesInc + addedSavings;
      const newMonthBudgetPending =
        toNum(d.monthBudgetPending) +
        (Number(client.creditScore) >= 70 ? 0 : Number(client.requestAmount));

      /* helper to bump nested‑map strings */
      const bump = (
        map: { [k: string]: string } | undefined,
        key: string,
        inc: number
      ) =>
        Object.assign({}, map, {
          [key]: (toNum(map?.[key]) + inc).toString(),
        });

      tx.update(doc.ref, {
        clientsSavings: newClientsSavings.toString(),
        fees: newFees.toString(),
        moneyInHands: newMoneyInHands.toString(),
        monthBudgetPending: newMonthBudgetPending.toString(),

        dailySaving: bump(d.dailySaving, todayApp, addedSavings),
        dailyMoneyRequests: bump(
          d.dailyMoneyRequests,
          client.requestDate!,
          Number(client.requestAmount)
        ),
        feesData: bump(d.feesData, todayApp, feesInc),
      });
    });
  }
  updateUserInfoForRegisterClientRequestUpdate(
    client: Client,
    savings: string,
    date: string
  ) {
    let dailyFees: any = this.computeDailyFees(client, date);
    let save: any = this.computeDailySaving(date, savings);
    let request: any = this.computeDailyMoneyRequests(
      client.requestDate!,
      client.requestAmount!
    );
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      dailyMoneyRequests: {
        [client.requestDate!]: `${request}`,
      },
    };
    return userRef.set(data, { merge: true });
  }
  updateUserInforForRegisterClientToFullClient(client: Client, date: string) {
    let dailyLending: any = this.computeDailyLending(client, date);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      amountLended: (
        Number(this.auth.currentUser.amountLended) + Number(client.loanAmount!)
      ).toString(),

      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) - Number(client.loanAmount)
      ).toString(),
      projectedRevenue: (
        Number(this.auth.currentUser.projectedRevenue) +
        Number(client.amountToPay)
      ).toString(),
      dailyLending: { [date]: `${dailyLending}` },
      totalDebtLeft: (
        Number(this.auth.currentUser.totalDebtLeft) + Number(client.amountToPay)
      ).toString(),
      // ADDED CHECK FOR CREDIT SCORE >= 70
      monthBudget:
        Number(client.creditScore) >= 70
          ? this.auth.currentUser.monthBudget // skip updating
          : (
              Number(this.auth.currentUser.monthBudget) -
              Number(client.loanAmount)
            ).toString(),
      // ADDED CHECK FOR CREDIT SCORE >= 70
      monthBudgetPending:
        Number(client.creditScore) >= 70
          ? this.auth.currentUser.monthBudgetPending // skip updating
          : (
              Number(this.auth.currentUser.monthBudgetPending) -
              Number(client.requestAmount)
            ).toString(),
    };
    return userRef.set(data, { merge: true });
  }

  updateUserInfoForNewClient(client: Client, date: string) {
    let dailyLending: any = this.computeDailyLending(client, date);
    let dailyFees: any = this.computeDailyFees(client, date);
    let save: any = this.computeDailySaving(date, client.savings!);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      numberOfClients: (
        Number(this.auth.currentUser.numberOfClients) + 1
      ).toString(),
      amountLended: (
        Number(this.auth.currentUser.amountLended) + Number(client.loanAmount!)
      ).toString(),
      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) + Number(client.savings)
      ).toString(),
      fees: (
        Number(this.auth.currentUser.fees) +
        Number(client.membershipFee) +
        Number(client.applicationFee)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) +
        Number(client.membershipFee) +
        Number(client.savings) +
        Number(client.applicationFee) -
        Number(client.loanAmount)
      ).toString(),
      projectedRevenue: (
        Number(this.auth.currentUser.projectedRevenue) +
        Number(client.amountToPay)
      ).toString(),
      dailyLending: { [date]: `${dailyLending}` },
      dailySaving: {
        [date]: `${save}`,
      },
      feesData: { [date]: `${dailyFees}` },
      totalDebtLeft: (
        Number(this.auth.currentUser.totalDebtLeft) + Number(client.amountToPay)
      ).toString(),
    };

    return userRef.set(data, { merge: true });
  }

  updateUserInfoForNewClientSavings(client: Client, date: string) {
    let dailyFees: any = this.computeDailyFees(client, date);
    let save: any = this.computeDailySaving(date, client.savings!);
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      numberOfClients: (
        Number(this.auth.currentUser.numberOfClients) + 1
      ).toString(),

      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) + Number(client.savings)
      ).toString(),
      fees: (
        Number(this.auth.currentUser.fees) +
        Number(client.membershipFee) +
        Number(client.applicationFee)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) +
        Number(client.membershipFee) +
        Number(client.savings) +
        Number(client.applicationFee)
      ).toString(),
      projectedRevenue: (
        Number(this.auth.currentUser.projectedRevenue) +
        Number(client.amountToPay)
      ).toString(),
      dailySaving: {
        [date]: `${save}`,
      },
      feesData: { [date]: `${dailyFees}` },
    };

    return userRef.set(data, { merge: true });
  }
  async batchUpdateVitalStatus(
    clients: Client[],
    status: string
  ): Promise<void> {
    const batch = this.afs.firestore.batch();

    for (const client of clients) {
      const docRef = this.afs.doc(
        `users/${this.auth.currentUser.uid}/clients/${client.uid}`
      ).ref;
      batch.set(docRef, { vitalStatus: status }, { merge: true });
    }
    // Commit once
    await batch.commit();
  }

  updateUserInfoForRegisterClient(client: Client, date: string) {
    // let dailyLending: any = this.computeDailyLending(client, date);
    let dailyFees: any = this.computeDailyFees(client, date);
    let save: any = this.computeDailySaving(date, client.savings!);
    let request: any = this.computeDailyMoneyRequests(
      client.requestDate!,
      client.requestAmount!
    );
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      numberOfClients: (
        Number(this.auth.currentUser.numberOfClients) + 1
      ).toString(),

      clientsSavings: (
        Number(this.auth.currentUser.clientsSavings) + Number(client.savings)
      ).toString(),
      fees: (
        Number(this.auth.currentUser.fees) +
        Number(client.membershipFee) +
        Number(client.applicationFee)
      ).toString(),
      moneyInHands: (
        Number(this.auth.currentUser.moneyInHands) +
        Number(client.membershipFee) +
        Number(client.savings) +
        Number(client.applicationFee)
      ).toString(),
      dailySaving: {
        [date]: `${save}`,
      },
      dailyMoneyRequests: {
        [client.requestDate!]: `${request}`,
      },
      monthBudgetPending: (
        Number(this.auth.currentUser.monthBudgetPending) +
        Number(client.requestAmount)
      ).toString(),

      // dailyLending: { [date]: `${dailyLending}` },
      feesData: { [date]: `${dailyFees}` },
    };

    return userRef.set(data, { merge: true });
  }

  updateUserInfoForNewCardClient(card: Card) {
    let date = this.time.todaysDateMonthDayYear();
    let depot: any = this.computeDailyCardPayments(date, card.amountToPay!);
    let benefit: any = this.computeDailyCardBenefits(date, card.amountToPay!);
    let cMoney =
      this.auth.currentUser.cardsMoney === undefined
        ? '0'
        : this.auth.currentUser.cardsMoney;
    let cClients =
      this.auth.currentUser.numberOfCardClients === undefined
        ? '0'
        : this.auth.currentUser.numberOfCardClients;
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );

    const data = {
      numberOfCardClients: (Number(cClients) + 1).toString(),
      dailyCardPayments: { [date]: `${depot}` },
      dailyCardBenefits: { [date]: `${benefit}` },
      cardsMoney: (Number(cMoney) + Number(card.amountPaidToday)).toString(),
    };

    return userRef.set(data, { merge: true });
  }

  updateUserInfoForNewCardCycleClient(card: Card) {
    let date = this.time.todaysDateMonthDayYear();
    let depot: any = this.computeDailyCardPayments(date, card.amountToPay!);
    let benefit: any = this.computeDailyCardBenefits(date, card.amountToPay!);
    let cMoney =
      this.auth.currentUser.cardsMoney === undefined
        ? '0'
        : this.auth.currentUser.cardsMoney;

    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    console.log('cmoney, ', cMoney);
    console.log('amount paid today', card.amountToPay);
    const data = {
      dailyCardPayments: { [date]: `${depot}` },
      cardsMoney: (Number(cMoney) + Number(card.amountToPay)).toString(),
      dailyCardBenefits: { [date]: `${benefit}` },
    };

    return userRef.set(data, { merge: true });
  }

  computeAmountToPay(interestRate: string, loanAmount: string) {
    const amount = (1 + Number(interestRate) * 0.01) * Number(loanAmount);
    // Round to the nearest whole number
    const roundedAmount = Math.round(amount);

    return roundedAmount.toString();
  }

  computeDailyReimbursement(date: string, payment: string) {
    let reimburse: any = '';
    if (this.auth.currentUser.dailyReimbursement[`${date}`] === undefined) {
      reimburse = payment;
    } else {
      reimburse =
        Number(this.auth.currentUser.dailyReimbursement[`${date}`]) +
        Number(payment);
    }
    return reimburse;
  }
  computeDailySaving(date: string, saving: string) {
    let save: any = '';
    if (this.auth.currentUser.dailySaving[`${date}`] === undefined) {
      save = saving;
    } else {
      save =
        Number(this.auth.currentUser.dailySaving[`${date}`]) + Number(saving);
    }
    return save;
  }
  computeDailySavingReturn(date: string, saving: string) {
    let save: any = '';
    if (this.auth.currentUser.dailySavingReturns[`${date}`] === undefined) {
      save = saving;
    } else {
      save =
        Number(this.auth.currentUser.dailySavingReturns[`${date}`]) +
        Number(saving);
    }
    return save;
  }
  computeDailyFeesReturn(date: string, total: string) {
    let Total: any = '';
    if (this.auth.currentUser.dailyFeesReturns[`${date}`] === undefined) {
      Total = total;
    } else {
      Total =
        Number(this.auth.currentUser.dailyFeesReturns[`${date}`]) +
        Number(total);
    }
    return Total;
  }
  computeDailyMoneyRequests(date: string, request: string) {
    let mRequest: any = '';
    if (this.auth.currentUser.dailyMoneyRequests[`${date}`] === undefined) {
      mRequest = request;
    } else {
      mRequest =
        Number(this.auth.currentUser.dailyMoneyRequests[`${date}`]) +
        Number(request);
    }
    return mRequest;
  }
  computeDailyCardPayments(date: string, payment: string) {
    let deposit: any = '';
    if (
      this.auth.currentUser.dailyCardPayments === undefined ||
      this.auth.currentUser.dailyCardPayments[`${date}`] === undefined
    ) {
      deposit = payment;
    } else {
      deposit =
        Number(this.auth.currentUser.dailyCardPayments[`${date}`]) +
        Number(payment);
    }
    return deposit;
  }
  computeDailyCardBenefits(date: string, payment: string) {
    let benefit: any = '';
    if (
      this.auth.currentUser.dailyCardBenefits === undefined ||
      this.auth.currentUser.dailyCardBenefits[`${date}`] === undefined
    ) {
      benefit = payment;
    } else {
      benefit =
        Number(this.auth.currentUser.dailyCardBenefits[`${date}`]) +
        Number(payment);
    }
    return benefit;
  }
  computeDailyCardReturns(date: string, payment: string) {
    let pReturn: any = '';
    if (
      this.auth.currentUser.dailyCardReturns === undefined ||
      this.auth.currentUser.dailyCardReturns[`${date}`] === undefined
    ) {
      pReturn = payment;
    } else {
      pReturn =
        Number(this.auth.currentUser.dailyCardReturns[`${date}`]) +
        Number(payment);
    }
    return pReturn;
  }

  computeDailyLending(client: Client, date: string) {
    let lending: any = '';
    if (this.auth.currentUser.dailyLending[`${date}`] === undefined) {
      lending = client.loanAmount;
    } else {
      lending =
        Number(this.auth.currentUser.dailyLending[`${date}`]) +
        Number(client.loanAmount);
    }
    return lending;
  }
  computeDailyFees(client: Client, date: string) {
    let fees: any = '';
    if (this.auth.currentUser.feesData[`${date}`] === undefined) {
      fees = Number(client.membershipFee) + Number(client.applicationFee);
    } else {
      fees =
        Number(this.auth.currentUser.feesData[`${date}`]) +
        Number(client.membershipFee) +
        Number(client.applicationFee);
    }
    return fees;
  }

  numbersValid(...args: string[]): boolean {
    // Check if any of the arguments is not a number or is a negative number
    for (const arg of args) {
      const num = Number(arg);
      if (isNaN(num) || num < 0) {
        return false;
      }
    }

    // If none of the arguments is invalid, return true
    return true;
  }
  removeDuplicates(payments: any[]): any[] {
    const uniquePayments = payments.filter(
      (value, index, self) =>
        index ===
        self.findIndex(
          (t) =>
            t.trackingId === value.trackingId &&
            t.amount === value.amount &&
            t.time === value.time
        )
    );
    return uniquePayments;
  }
  setLocation(location: LocationCoordinates) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.auth.currentUser.uid}`
    );
    const data = {
      locationCoordinates: location,
    };
    return userRef.set(data, { merge: true });
  }
  didClientStartThisWeek(client: Client) {
    const convertToDateCompatibleFormat = (dateStr: string) => {
      const [month, day, year] = dateStr.split('-');
      return `${year}/${month}/${day}`;
    };

    const oneWeekAgo = new Date();
    // watch out for this one. I am not sure. whether it is 7 so I put 6 just in case.
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);

    const formattedDebtCycleStartDate = convertToDateCompatibleFormat(
      client.debtCycleStartDate!
    );
    const debtCycleStartDate = new Date(formattedDebtCycleStartDate);

    if (debtCycleStartDate > oneWeekAgo) {
      return false;
    }

    return true;
  }

  async startUpload(
    event: FileList,
    currentPath: string,
    employeeId: string,
    field: string
  ) {
    const file = event?.item(0);
    console.log(' current file data', file);

    if (file) {
      if (!this.allowedMimeTypes.includes(file.type)) {
        console.log('unsupported file type');
        return;
      }

      // Proceed with file processing
      console.log('File is supported:', file);
      // Your file handling logic here
      if (file?.size >= 10000000) {
        console.log('the file is too big');
        alert('The picture is too big. It should be less than 5MB');
        return;
      }
    }
    // the file should not be larger than 10MB

    const path = currentPath;

    // the main task
    console.log('the path', path);

    // this.task = await this.storage.upload(path, file);
    const uploadTask = await this.storage.upload(path, file);
    this.url = await uploadTask.ref.getDownloadURL();
    uploadTask.totalBytes;
    // console.log('the download url', this.url);
    const avatar = {
      path: path,
      downloadURL: this.url,
      size: uploadTask.totalBytes.toString(),
    };

    await this.updateEmployeeField(employeeId, field, this.url);
    this.router.navigate(['/home']);
    return this.url;
  }

  updateEmployeeField(employeeId: string, field: string, value: any) {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.auth.currentUser.uid}/employees/${employeeId}`
    );

    const data = {
      [field]: value, // Dynamically set the field and value
    };

    return employeeRef.set(data, { merge: true });
  }
  findClientsWithDebts(clients: Client[] | null | undefined): Client[] {
    if (!Array.isArray(clients)) {
      return [];
    }

    return clients.filter((data) => {
      const isAlive =
        data.vitalStatus === undefined ||
        data.vitalStatus === '' ||
        data.vitalStatus?.toLowerCase() === 'vivant';

      const debt = Number(data.debtLeft);
      const hasDebt = !isNaN(debt) && debt > 0;

      return isAlive && hasDebt;
    });
  }

  findClientsWithDebtsIncludingThoseWhoLeft(clients: Client[]) {
    if (!Array.isArray(clients)) {
      return [];
    }
    clients = clients!.filter((data) => {
      return Number(data.debtLeft) > 0;
    });
    // return clients
    return clients;
  }
  minimumPayment(client: Client) {
    const pay = Number(client.amountToPay) / Number(client.paymentPeriodRange);

    // make sure that if the client has a debt less than the minimum payment, we only ask for the debt
    if (client.debtLeft && Number(client.debtLeft) < pay) {
      return client.debtLeft;
    }
    return pay.toString();
  }

  findTotalDebtLeft(clients: Client[]) {
    // just to make sure we will filter again
    clients = clients!.filter((data) => {
      const isAlive =
        data.vitalStatus === undefined ||
        data.vitalStatus.toLowerCase() === '' ||
        data.vitalStatus.toLowerCase() === 'vivant';
      return isAlive && Number(data.debtLeft) > 0;
    });
    const totalDebtLeft = clients.reduce(
      (sum, client) => sum + Number(client.debtLeft || 0),
      0
    );

    return totalDebtLeft.toString();
  }

  findTotalClientSavings(clients: Client[]) {
    // just to make sure we will filter again
    clients = clients!.filter((data) => {
      const isAlive =
        data.vitalStatus === undefined ||
        data.vitalStatus.toLowerCase() === '' ||
        data.vitalStatus.toLowerCase() === 'vivant';
      return isAlive && Number(data.debtLeft) > 0;
    });
    const totalSavings = clients.reduce(
      (sum, client) => sum + Number(client.savings || 0),
      0
    );

    return totalSavings.toString();
  }

  clientRequestRejectionRefund(client: Client) {
    const ref = this.afs.doc(
      `users/${this.auth.currentUser.uid}/clients/${client.uid}`
    );

    const data = {
      requestAmount: client.rejectionReturnAmount,
      previouslyRequestedAmount: client.previouslyRequestedAmount,
      rejectionReturnAmount: client.rejectionReturnAmount,
      requestStatus: 'pending',
      requestType: 'rejection',
      requestDate: client.requestDate,
      dateOfRequest: client.dateOfRequest,
    };

    return ref.set(data, { merge: true });
  }

  /** Generic writer used by the budget-expense modal */
  async upsertManagementMapField(
    field: 'expenses' | 'budgetedExpenses' | 'reserve' | 'moneyGiven',
    amountFC: number,
    dateKey: string,
    reason: string,
    mode: 'set' | 'add' = 'set'
  ) {
    const docId = this.auth.managementInfo.id!;
    const docRef = this.afs.doc<Management>(`management/${docId}`);

    if (mode === 'set') {
      return docRef.set(
        { [field]: { [dateKey]: `${amountFC}:${reason.trim()}` } },
        { merge: true }
      );
    }

    // mode === 'add' → increment and append reason
    return this.afs.firestore.runTransaction(async (trx) => {
      const snap = await trx.get(docRef.ref);
      const prevRaw = snap.get(field)?.[dateKey] ?? '0';
      const [prevAmountStr, prevReasonsRaw = ''] = String(prevRaw).split(':');
      const prevAmount = Number(prevAmountStr);
      const mergedReasons = [prevReasonsRaw, reason.trim()]
        .filter(Boolean)
        .join('|');

      trx.set(
        docRef.ref,
        {
          [field]: {
            [dateKey]: `${prevAmount + amountFC}:${mergedReasons}`,
          },
        },
        { merge: true }
      );
    });
  }
  async addBudgetPlannedExpense(amountFC: number, reason: string) {
    const docId = this.auth.managementInfo.id!;
    const key = this.time.todaysDate(); // timestamp (seconds)
    const docRef = this.afs.doc(`management/${docId}`);

    return docRef.set(
      {
        budgetedExpenses: { [key]: `${amountFC}:${reason.trim()}` },
      },
      { merge: true }
    );
  }

  computeCreditScore(client: Client) {
    let dateX = '';
    let creditScore = '';
    if (client.debtLeft !== '0') {
      return client.creditScore;
    }
    if (Number(client.paymentPeriodRange) === 4) {
      dateX = this.time.getDateInFiveWeeks(client.debtCycleStartDate!);
    } else if (Number(client.paymentPeriodRange) === 8) {
      dateX = this.time.getDateInNineWeeks(client.debtCycleStartDate!);
    }
    let today = this.time.todaysDateMonthDayYear();
    // +5 for finishing the payment anytime early or on the date
    if (this.time.isGivenDateLessOrEqual(dateX, today)) {
      creditScore = (Number(client.creditScore) + 5).toString();
      // -2 every week you are late
    } else if (!this.time.isGivenDateLessOrEqual(dateX, today)) {
      let elapsed = this.time.weeksElapsed(dateX, today);

      creditScore = (Number(client.creditScore) - 2 * elapsed).toString();
    }
    creditScore = Math.min(Number(creditScore), 100).toString();

    return creditScore;
  }
  async transferCardToCredit(card: Card, credit: Client, amount: number) {
    const uid = this.auth.currentUser.uid;
    const cardPath = `users/${uid}/cards/${card.uid}`;
    const creditPath = `users/${uid}/clients/${credit.uid}`;
    const userPath = `users/${uid}`;

    const today = this.time.todaysDate(); // 26-07-2025
    const todayMDY = this.time.todaysDateMonthDayYear(); // 7-26-2025

    return this.afs.firestore.runTransaction(async (t) => {
      /* ───── 1️⃣  CARD ──── */
      const newCardAmount = +card.amountPaid! - amount;
      const newCardPayments = { [today]: `-${amount}` };

      t.set(
        this.afs.doc(cardPath).ref,
        {
          amountPaid: newCardAmount.toString(),
          numberOfPaymentsMade: (+card.numberOfPaymentsMade! + 1).toString(),
          payments: newCardPayments,
        },
        { merge: true }
      );

      /* ───── 2️⃣  CREDIT ─── */
      const newPaid = +credit.amountPaid! + amount;
      const newDebtLeft = +credit.amountToPay! - newPaid;
      const newPayMade = +credit.numberOfPaymentsMade! + 1;
      const newPayMissed = Math.max(
        0,
        this.time.weeksSince(credit.dateJoined!) - newPayMade
      );

      let newScore = credit.creditScore;
      if (newDebtLeft <= 0) {
        newScore = this.computeCreditScoreForClient(credit);
      }

      t.set(
        this.afs.doc(creditPath).ref,
        {
          amountPaid: newPaid.toString(),
          payments: { [today]: amount.toString() },
          debtLeft: newDebtLeft.toString(),
          numberOfPaymentsMade: newPayMade.toString(),
          numberOfPaymentsMissed: newPayMissed.toString(),
          creditScore: newScore,
        },
        { merge: true }
      );

      /* ───── 3️⃣  USER AGGREGATE ───
       · cardsMoney ↓
       · totalDebtLeft ↓
       · dailyCardPayments (negative)
       · dailyReimbursement (positive)
       · moneyInHands -- untouched
    */
      const u = this.auth.currentUser;

      const dailyCard = this.computeDailyCardPayments(
        todayMDY,
        (-amount).toString() // record as negative
      );
      const dailyReimb = this.computeDailyReimbursement(
        todayMDY,
        amount.toString()
      );

      t.set(
        this.afs.doc(userPath).ref,
        {
          // cardsMoney: (+u.cardsMoney - amount).toString(), // this should not be updated either
          totalDebtLeft: (+u.totalDebtLeft - amount).toString(),
          dailyCardPayments: { [todayMDY]: dailyCard },
          dailyReimbursement: { [todayMDY]: dailyReimb },
          // moneyInHands   : <unchanged>
        },
        { merge: true }
      );
    });
  }

  /* helper: identical logic you already have in WithdrawSavingsComponent */
  private computeCreditScoreForClient(client: Client): string {
    let dateX = '';
    if (Number(client.paymentPeriodRange) === 4) {
      dateX = this.time.getDateInFiveWeeks(client.debtCycleStartDate!);
    } else if (Number(client.paymentPeriodRange) === 8) {
      dateX = this.time.getDateInNineWeeks(client.debtCycleStartDate!);
    }
    const today = this.time.todaysDateMonthDayYear();
    let score = +client.creditScore!;
    if (this.time.isGivenDateLessOrEqual(dateX, today)) {
      score += 5;
    } else {
      const elapsed = this.time.weeksElapsed(dateX, today);
      score -= 2 * elapsed;
    }
    return Math.min(score, 100).toString();
  }
}
