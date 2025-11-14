import { Injectable, inject } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Route, Router } from '@angular/router';
import { Firestore, collectionData, collection } from '@angular/fire/firestore';
import { Auth, idToken } from '@angular/fire/auth';
import {
  AngularFirestore,
  AngularFirestoreCollection,
  AngularFirestoreDocument,
} from '@angular/fire/compat/firestore';
import { firstValueFrom, Observable, of } from 'rxjs';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { filter, map, shareReplay, switchMap, take, tap } from 'rxjs/operators';
import { User } from '../models/user';
import { Client, Comment } from '../models/client';
import { IdeaSubmission } from '../models/idea';
import { Timestamp } from 'firebase/firestore';
import { TimeService } from './time.service';
import { ComputationService } from '../shrink/services/computation.service';
import { Employee } from '../models/employee';
import { Card } from '../models/card';
import { Audit, Management } from '../models/management';

const ADMIN_FLAG_KEY = 'kank-admin-flag';
const DISTRIBUTOR_FLAG_KEY = 'kank-distributor-flag';
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  user$: Observable<User | null>;
  clientsRef$: Observable<any>;
  cardsRefs: Observable<any>;
  employeesRef$: Observable<any>;
  email?: Observable<any>;
  currentUser: any = {};
  managementInfo: any = {};
  private readonly adminWord = 'synergie';
  private readonly distributorWord = 'plan';
  public isAdmninistrator: boolean = false;
  public isDistributoring: boolean = false;
  clientId: string = '';
  currentClient: Client = new Client();

  constructor(
    private fireauth: AngularFireAuth,
    private afs: AngularFirestore,
    private router: Router,
    private time: TimeService,
    private compute: ComputationService,
    private storage: AngularFireStorage
  ) {
    this.clientsRef$ = of(null);
    this.user$ = this.fireauth.authState.pipe(
      switchMap((user) => {
        if (!user) {
          this.email = of(null);
          return of(null);
        }

        this.email = of(user.email);

        return this.afs
          .doc<User>(`users/${user.uid}`)
          .valueChanges()
          .pipe(map((doc) => doc ?? null));
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.clientsRef$ = this.fireauth.authState.pipe(
      switchMap((user) => {
        if (user) {
          return this.afs
            .collection(`users/${user.uid}/clients/`)
            .valueChanges();
        } else {
          return of(null);
        }
      })
    );

    this.cardsRefs = this.fireauth.authState.pipe(
      switchMap((user) => {
        if (user) {
          return this.afs.collection(`users/${user.uid}/cards/`).valueChanges();
        } else {
          return of(null);
        }
      })
    );
    this.employeesRef$ = this.fireauth.authState.pipe(
      switchMap((user) => {
        if (user) {
          return this.afs
            .collection(`users/${user.uid}/employees/`)
            .valueChanges();
        } else {
          return of(null);
        }
      })
    );

    // this.managementRef$ = this.fireauth.authState.pipe(
    //   switchMap((user) => {
    //     if (user) {
    //       return this.afs.collection(`users/${user.uid}/cards/`).valueChanges();
    //     } else {
    //       return of(null);
    //     }
    //   })
    // );
    this.getCurrentUser();
    this.getManagementInfoData();
    this.restoreRoleFlags();
  }
  ngOnInit() {}
  getAllClients(): Observable<Client> {
    return this.clientsRef$;
  }
  getClient(clientId: string) {
    const clieintref: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.currentUser.uid}/clients/${clientId}`
    );
    return clieintref.valueChanges();
  }
  getClientsOfAUser(userId: string) {
    return this.afs
      .collection<Client>(`users/${userId}/clients/`)
      .valueChanges();
  }
  getReviews(): Observable<any[]> {
    return this.user$.pipe(
      switchMap((user) => {
        if (user && user.uid) {
          return this.afs
            .collection<Client>(`users/${user.uid}/reviews/`)
            .valueChanges();
        } else {
          return of([]); // Return an empty array if no user is authenticated
        }
      })
    );
  }
  getReviewsForTarget(
    targetUid: string | null | undefined
  ): Observable<{ reviewDocId: string | null; reviews: Comment[] }> {
    if (!targetUid) {
      return of({ reviewDocId: null, reviews: [] });
    }
    return this.afs
      .collection<{ reviews: Comment[] }>(`users/${targetUid}/reviews/`)
      .snapshotChanges()
      .pipe(
        map((actions) => {
          if (!actions || !actions.length) {
            return { reviewDocId: null, reviews: [] };
          }
          const action = actions[0];
          const data = action.payload.doc.data() || {};
          const aggregate = (data.reviews ?? []) as Comment[];
          return {
            reviewDocId: action.payload.doc.id,
            reviews: Array.isArray(aggregate) ? aggregate : [],
          };
        })
      );
  }

  getCertificateInfo() {
    return this.afs.collection<Client>(`certificate/`).valueChanges();
  }
  getManagementInfo() {
    return this.afs.collection<Management>(`management/`).valueChanges();
  }
  getAuditInfo() {
    return this.afs.collection<Audit>(`audit/`).valueChanges();
  }
  getClientsCardOfAUser(userId: string) {
    return this.afs.collection<Client>(`users/${userId}/cards/`).valueChanges();
  }
  getManagementInfoData() {
    this.getManagementInfo().subscribe((data) => {
      this.managementInfo = data[0];
    });
  }
  getAllEmployees(): Observable<Employee> {
    return this.employeesRef$;
  }
  getAllEmployeesGivenUser(myuser: User): Observable<Employee> {
    let employeesRef$: Observable<any> = this.fireauth.authState.pipe(
      switchMap((user) => {
        if (myuser) {
          return this.afs
            .collection(`users/${myuser.uid}/employees/`)
            .valueChanges();
        } else {
          return of(null);
        }
      })
    );
    return employeesRef$;
  }
  getAllClientsCard(): Observable<Card> {
    return this.cardsRefs;
  }

  getCurrentUser() {
    this.user$.subscribe((user) => {
      this.currentUser = user;
    });
  }
  // auth.service.ts
  SignOn(email: string, password: string, word: string): Promise<void> {
    return this.fireauth // ← on retourne la promesse
      .signInWithEmailAndPassword(email, password)
      .then((res) => {
        this.applyRoleWord(word);

        if (res.user?.emailVerified) {
          this.router.navigate(['/home']);
        } else {
          this.router.navigate(['/verify-email']);
        }
      })
      .catch((err) => {
        // alert('Something went wrong'); // message inchangé
        // Pas de navigation vers « / » : on reste sur la page
        this.clearRoleFlags();
        return Promise.reject(err); // ← on relaie l’erreur
      });
  }

  getAllUsersInfo() {
    return this.afs
      .collection<User>('users', (ref) => ref.where('mode', '!=', 'testing'))
      .valueChanges();
  }
  register(
    firstName: string,
    lastName: string,
    email: string,
    password: string
  ) {
    this.fireauth
      .createUserWithEmailAndPassword(email, password)
      .then(
        (res) => {
          alert('Registration was Successful');
          this.sendEmailForVerification(res.user);

          this.addNewUser(firstName, lastName, res.user);
          this.router.navigate(['/verify-email']);
        },
        (err) => {
          alert(err.message);
        }
      )
      .catch((error) => {
        alert('Something went wrong');
        this.router.navigate(['/']);
        // ...
      });
  }

  addNewUser(firstName: string, lastName: string, user: any) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${user.uid}`
    );
    const data = {
      uid: user.uid,
      email: user.email,
      firstName: firstName,
      lastName: lastName,
      numberOfClients: '0',
      amountInvested: '0',
      amountInvestedDollars: '0',
      investements: {},
      investmentsDollar: {},
      amountLended: '0',
      clientsSavings: '0',
      expensesAmount: '0',
      expenses: {},
      performances: {},
      projectedRevenue: '0',
      reserveAmount: '0',
      reserveAmountDollar: '0',
      reserve: {},
      reserveinDollar: {},
      fees: '0',
      moneyInHands: '0',
      totalDebtLeft: '0',
      cardsMoney: '0',
      dailyLending: {},
      roles: ['user'],
      mode: 'production',
      feesData: {},
      dailyReimbursement: {},
      dailySaving: {},
      dailySavingReturns: {},
      dailyCardReturns: {},
      dailyCardPayments: {},
      dailyMoneyRequests: {},
      dailyFeesReturns: {},
      monthBudget: '',
      monthBudgetPending: '0',
    };
    return userRef.set(data, { merge: true });
  }

  addNewClient(client: Client) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const data = {
      uid: this.afs.createId().toString(),
      firstName: client.firstName,
      lastName: client.lastName,
      middleName: client.middleName,
      phoneNumber: client.phoneNumber,
      businessCapital: client.businessCapital,
      homeAddress: client.homeAddress,
      businessAddress: client.businessAddress,
      debtCycle: '0',
      membershipFee: client.membershipFee,
      applicationFee: client.applicationFee,
      savings: client.savings,
      savingsPayments: client.savingsPayments,
      loanAmount: client.loanAmount,
      creditScore: '50',
      agent: client.agent,
      debtLeft: client.debtLeft,
      amountToPay: client.amountToPay,
      interestRate: client.interestRate,
      debtCycleStartDate: client.debtCycleStartDate,
      debtCycleEndDate: client.debtCycleEndDate,
      paymentPeriodRange: client.paymentPeriodRange,
      profession: client.profession,
      amountPaid: '0',
      dateJoined: `${month}-${day}-${year}`,
      numberOfPaymentsMissed: '0',
      numberOfPaymentsMade: '0',
      paymentDay: client.paymentDay,
      payments: {},
      clients: [],
    };
    this.clientId = data.uid;
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.currentUser.uid}/clients/${data.uid}`
    );
    return clientRef.set(data, { merge: true });
  }

  addReview(review: Comment, targetUserId?: string): Promise<void> {
    const uid = targetUserId ?? this.currentUser?.uid;
    if (!uid) {
      return Promise.reject(new Error("Aucun utilisateur cible pour l'avis."));
    }

    const reviewsCollection = this.afs.collection<any>(`users/${uid}/reviews/`);

    return reviewsCollection
      .snapshotChanges()
      .pipe(take(1))
      .toPromise()
      .then((actions: any) => {
        if (actions.length > 0) {
          // Get the existing document
          const doc = actions[0];
          const reviewId = doc.payload.doc.id; // Extract reviewId
          const data = doc.payload.doc.data();
          const updatedReviews = data.reviews || [];
          updatedReviews.push(review); // Add a single review object

          return this.afs
            .doc(`users/${uid}/reviews/${reviewId}`)
            .set({ reviews: updatedReviews }, { merge: true });
        } else {
          // Create a new document with a generated reviewId
          const reviewId = this.afs.createId();
          const data = {
            reviews: [review], // Wrap the single review in an array
            reviewId: reviewId,
          };

          return this.afs.doc(`users/${uid}/reviews/${reviewId}`).set(data);
        }
      });
  }

  addIdeaSubmission(idea: IdeaSubmission): Promise<void> {
    const id = this.afs.createId();
    const payload: IdeaSubmission = {
      ...idea,
      id,
      userId: idea.userId ?? this.currentUser?.uid ?? null,
    };

    return this.afs.doc(`ideaBox/${id}`).set(payload);
  }

  getIdeaSubmissions(limitCount?: number) {
    return this.afs
      .collection<IdeaSubmission>('ideaBox', (ref) => {
        let query = ref.orderBy('createdAtISO', 'desc');
        if (limitCount && limitCount > 0) {
          query = query.limit(limitCount);
        }
        return query;
      })
      .valueChanges({ idField: 'id' });
  }

  deleteIdeaSubmission(ideaId: string): Promise<void> {
    if (!ideaId) {
      return Promise.reject(new Error('Identifiant de la Boîte à idées manquant.'));
    }
    return this.afs.doc(`ideaBox/${ideaId}`).delete();
  }

  registerNewClient(client: Client) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    const data = {
      uid: this.afs.createId().toString(),
      firstName: client.firstName,
      lastName: client.lastName,
      middleName: client.middleName,
      phoneNumber: client.phoneNumber,
      birthDate: client.birthDate, // ex. 05-21-1985
      businessCapital: client.businessCapital,
      homeAddress: client.homeAddress,
      businessAddress: client.businessAddress,
      membershipFee: client.membershipFee,
      applicationFee: client.applicationFee,
      savings: client.savings,
      savingsPayments: client.savingsPayments,
      applicationFeePayments: client.applicationFeePayments,
      membershipFeePayments: client.membershipFeePayments,
      creditScore: '50', // Default to '50' if not calculated
      type: 'register',
      loanAmount: client.loanAmount,
      requestAmount: client.requestAmount,
      requestStatus: 'pending',
      requestType: 'lending',
      requestDate: client.requestDate,
      profession: client.profession,
      dateOfRequest: client.dateOfRequest,
      dateJoined: `${month}-${day}-${year}`,
      payments: {},
      clients: [],
      profilePicture: client.profilePicture,

      // New fields
      timeInBusiness: client.timeInBusiness,
      monthlyIncome: client.monthlyIncome,
      debtInProcess: client.debtInProcess,
      planToPayDebt: client.planToPayDebt,
      references: client.references,
      collateral: client.collateral,
      creditworthinessScore: client.creditworthinessScore,
    };

    this.clientId = data.uid;
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.currentUser.uid}/clients/${data.uid}`
    );
    return clientRef.set(data, { merge: true });
  }

  cancelClientRegistration(client: Client) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.currentUser.uid}/clients/${client.uid}`
    );
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const data = {
      membershipFee: '0',
      applicationFee: '0',
      savings: '0',
      savingsPayments: client.savingsPayments,
      applicationFeePayments: client.applicationFeePayments,
      membershipFeePayments: client.membershipFeePayments,
      type: '',
      debtCycle: (Number(client.debtCycle) - 1).toString(),
      loanAmount: '0',
      requestAmount: '',
      requestStatus: '',
      requestType: '',
      requestDate: '',
    };
    return clientRef.set(data, { merge: true });
  }

  addNewClientCard(card: Card) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();

    const data = {
      uid: this.afs.createId().toString(),
      firstName: card.firstName,
      lastName: card.lastName,
      middleName: card.middleName,
      phoneNumber: card.phoneNumber,
      homeAddress: card.homeAddress,
      businessAddress: card.businessAddress,
      cardCycle: '1',
      profession: card.profession,
      amountPaid: card.amountPaidToday,
      amountToPay: card.amountToPay,
      dateJoined: `${month}-${day}-${year}`,
      numberOfPaymentsMade: '1',
      payments: card.payments,
    };
    this.clientId = data.uid;
    const cardtRef: AngularFirestoreDocument<Card> = this.afs.doc(
      `users/${this.currentUser.uid}/cards/${data.uid}`
    );
    return cardtRef.set(data, { merge: true });
  }

  startNewCardCycle(card: Card) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const data = {
      firstName: card.firstName,
      lastName: card.lastName,
      middleName: card.middleName,
      phoneNumber: card.phoneNumber,
      homeAddress: card.homeAddress,
      businessAddress: card.businessAddress,
      cardCycle: card.cardCycle,
      profession: card.profession,
      amountPaid: card.amountPaidToday,
      amountToPay: card.amountToPay,
      clientCardStatus: '',
      cardCycleStartDate: `${month}-${day}-${year}`,
      numberOfPaymentsMade: '1',
      payments: card.payments,
    };
    const cardRef: AngularFirestoreDocument<Card> = this.afs.doc(
      `users/${this.currentUser.uid}/cards/${card.uid}`
    );
    return cardRef.set(data, { merge: true });
  }

  addNewEmployee(employee: Employee) {
    const data = {
      uid: this.afs.createId().toString(),
      firstName: employee.firstName,
      lastName: employee.lastName,
      middleName: employee.middleName,
      phoneNumber: employee.phoneNumber,
      dateJoined: employee.dateJoined,
      dailyPoints: {},
      totalDailyPoints: {},
      averagePoints: '0',
      totalPoints: '0',
      sex: employee.sex,
      dateOfBirth: employee.dateOfBirth,
      status: employee.status,
      paymentsPicturePath: [],
      role: employee.role,
      clients: [],
      dailyStatus: {},
      dateLeft: '',
    };
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${this.currentUser.uid}/employees/${data.uid}`
    );
    return employeeRef.set(data, { merge: true });
  }

  /**
   * Helper method to add a payment code to a user's teamCode.
   * Only adds if the code doesn't already exist (avoids duplicates).
   * @param userId - The user ID whose teamCode to update
   * @param code - The payment code to add
   */
  private async addCodeToTeamCode(
    userId: string,
    code: string
  ): Promise<void> {
    if (!code || !code.trim()) {
      return; // No code to add
    }

    const trimmedCode = code.trim();
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${userId}`
    );
    const userDoc = await firstValueFrom(userRef.valueChanges());

    if (!userDoc) {
      console.warn(`User ${userId} not found, cannot update teamCode`);
      return;
    }

    const currentTeamCode = userDoc.teamCode || '';
    const codes = currentTeamCode
      .split('-')
      .map((c) => c.trim())
      .filter((c) => !!c);

    // Check if code already exists (case-sensitive)
    if (codes.includes(trimmedCode)) {
      return; // Already exists, no need to add
    }

    // Add the new code
    codes.push(trimmedCode);
    const newTeamCode = codes.join('-');

    await userRef.set({ teamCode: newTeamCode }, { merge: true });
  }

  /**
   * Helper method to remove a payment code from a user's teamCode.
   * @param userId - The user ID whose teamCode to update
   * @param code - The payment code to remove
   */
  private async removeCodeFromTeamCode(
    userId: string,
    code: string
  ): Promise<void> {
    if (!code || !code.trim()) {
      return; // No code to remove
    }

    const trimmedCode = code.trim();
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${userId}`
    );
    const userDoc = await firstValueFrom(userRef.valueChanges());

    if (!userDoc) {
      console.warn(`User ${userId} not found, cannot update teamCode`);
      return;
    }

    const currentTeamCode = userDoc.teamCode || '';
    const codes = currentTeamCode
      .split('-')
      .map((c) => c.trim())
      .filter((c) => !!c);

    // Remove the code (case-sensitive)
    const filteredCodes = codes.filter((c) => c !== trimmedCode);

    // Only update if something changed
    if (filteredCodes.length !== codes.length) {
      const newTeamCode = filteredCodes.join('-');
      await userRef.set({ teamCode: newTeamCode }, { merge: true });
    }
  }

  /**
   * Delete an employee completely from Firestore.
   * Also removes their paymentCode from the location's teamCode if it exists.
   * @param userId - The user ID (location) that owns the employee
   * @param employeeId - The employee ID to delete
   */
  async deleteEmployee(userId: string, employeeId: string): Promise<void> {
    // Get the employee's paymentCode before deleting
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${userId}/employees/${employeeId}`
    );
    const employeeDoc = await firstValueFrom(employeeRef.valueChanges());

    // Remove paymentCode from teamCode if it exists
    if (employeeDoc?.paymentCode) {
      await this.removeCodeFromTeamCode(userId, employeeDoc.paymentCode);
    }

    // Delete the employee
    return employeeRef.delete();
  }

  /**
   * Copy an employee from one location (user) to another location.
   * Excludes the clients array as clients are location-specific.
   * @param sourceUserId - The user ID of the source location
   * @param sourceEmployeeId - The employee ID to copy
   * @param targetUserId - The user ID of the target location
   * @param isRotation - Whether this is a rotation (temporary) or affectation (permanent)
   */
  async copyEmployeeToLocation(
    sourceUserId: string,
    sourceEmployeeId: string,
    targetUserId: string,
    isRotation: boolean = false
  ): Promise<void> {
    // Get the source employee
    const sourceEmployeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${sourceUserId}/employees/${sourceEmployeeId}`
    );
    const sourceEmployeeDoc = await firstValueFrom(
      sourceEmployeeRef.valueChanges()
    );

    if (!sourceEmployeeDoc) {
      throw new Error('Employee not found');
    }

    // Create a copy excluding clients and UI-only fields
    const {
      clients,
      currentClients,
      clientsFinishedPaying,
      _attachmentFile,
      _attachmentPreview,
      _attachmentType,
      _attachmentSize,
      _attachmentError,
      _uploading,
      _attachmentTakenAt,
      _attachmentDeviceInfo,
      _attachmentUA,
      _attachmentSoftId,
      _attachmentHash,
      _dailyTotal,
      tempUser,
      tempLocationHolder,
      ...employeeData
    } = sourceEmployeeDoc as any;

    // Generate new UID for the copied employee
    const newUid = this.afs.createId().toString();

    // Create the new employee at the target location
    const targetEmployeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${targetUserId}/employees/${newUid}`
    );

    // Set the employee data with a new UID and reset location-specific fields
    const copiedData: any = {
      ...employeeData,
      uid: newUid,
      clients: [], // Always start with empty clients array
      currentClients: [],
      clientsFinishedPaying: 0,
      dailyPoints: employeeData.dailyPoints || {},
      totalDailyPoints: employeeData.totalDailyPoints || {},
      dailyStatus: employeeData.dailyStatus || {},
      attendance: employeeData.attendance || {},
      paymentsPicturePath: employeeData.paymentsPicturePath || [],
      // Reset performance-related fields to start fresh
      averagePoints: employeeData.averagePoints || '0',
      totalPoints: employeeData.totalPoints || '0',
      currentTotalPoints: 0,
      // Set rotation fields
      isRotation: isRotation,
      rotationSourceLocationId: isRotation ? sourceUserId : undefined,
    };

    // Save the copied employee
    await targetEmployeeRef.set(copiedData, { merge: true });

    // Add paymentCode to target location's teamCode if it exists
    // Note: We don't remove it from source location's teamCode
    if (sourceEmployeeDoc.paymentCode) {
      await this.addCodeToTeamCode(targetUserId, sourceEmployeeDoc.paymentCode);
    }
  }

  /**
   * Convert a rotation employee to definitive (affectation).
   * Removes the rotation flag and source location reference.
   * @param userId - The user ID (location) that owns the employee
   * @param employeeId - The employee ID to convert
   */
  async convertRotationToDefinitive(
    userId: string,
    employeeId: string
  ): Promise<void> {
    const employeeRef: AngularFirestoreDocument<Employee> = this.afs.doc(
      `users/${userId}/employees/${employeeId}`
    );

    await employeeRef.set(
      {
        isRotation: false,
        rotationSourceLocationId: undefined,
      },
      { merge: true }
    );
  }

  /**
   * Copy a client from one location (user) to another location.
   * Excludes the agent field as it should be reassigned at the new location.
   * @param sourceUserId - The user ID of the source location
   * @param sourceClientId - The client ID to copy
   * @param targetUserId - The user ID of the target location
   */
  async copyClientToLocation(
    sourceUserId: string,
    sourceClientId: string,
    targetUserId: string
  ): Promise<void> {
    // Get the source client
    const sourceClientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${sourceUserId}/clients/${sourceClientId}`
    );
    const sourceClientDoc = await firstValueFrom(
      sourceClientRef.valueChanges()
    );

    if (!sourceClientDoc) {
      throw new Error('Client not found');
    }

    // Create a copy excluding agent and UI-only fields
    const {
      agent,
      employee,
      locationName,
      ...clientData
    } = sourceClientDoc as any;

    // Generate new UID for the copied client
    const newUid = this.afs.createId().toString();

    // Create the new client at the target location
    const targetClientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${targetUserId}/clients/${newUid}`
    );

    // Set the client data with a new UID, excluding agent
    // Mark as pending transfer so the destination location can accept/reject
    const copiedData: any = {
      ...clientData,
      uid: newUid,
      transferStatus: 'pending',
      // agent is excluded - will need to be assigned at the new location
    };

    return targetClientRef.set(copiedData, { merge: true });
  }

  deleteClient(client: Client) {
    const clientRef: AngularFirestoreDocument<Client> = this.afs.doc(
      `users/${this.currentUser.uid}/clients/${client.uid}`
    );
    return clientRef.delete();
  }

  UpdateUserInfoForDeletedClient(client: Client) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.currentUser.uid}`
    );
    const data = {
      numberOfClients: (
        Number(this.currentUser.numberOfClients) - 1
      ).toString(),

      amountLended: (
        Number(this.currentUser.amountLended) - Number(client.loanAmount)
      ).toString(),
      clientsSavings: (
        Number(this.currentUser.clientsSavings) - Number(client.savings)
      ).toString(),
      fees: (
        Number(this.currentUser.fees) -
        (Number(client.applicationFee) + Number(client.membershipFee))
      ).toString(),
      projectedRevenue: (
        Number(this.currentUser.projectedRevenue) - Number(client.amountToPay)
      ).toString(),
      totalDebtLeft: (
        Number(this.currentUser.totalDebtLeft) - Number(client.debtLeft)
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }

  setUserField(field: string, value: any) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.currentUser.uid}`
    );
    const data = {
      [field]: value, // Dynamic key assignment
    };
    return userRef.set(data, { merge: true });
  }
  // auth.service.ts
  updateNestedUserField(mapField: string, dateKey: string, amount: any) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.currentUser.uid}`
    );

    // Dot-notation comprise par update()
    return userRef.update({ [`${mapField}.${dateKey}`]: amount });
  }

  UpdateUserInfoForDeletedRegisterClient(client: Client) {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.currentUser.uid}`
    );
    let total: number =
      Number(client.savings) +
      Number(client.applicationFee) +
      Number(client.membershipFee);
    const data = {
      numberOfClients: (
        Number(this.currentUser.numberOfClients) - 1
      ).toString(),
      moneyInHands: (Number(this.currentUser.moneyInHands) - total).toString(),
      clientsSavings: (
        Number(this.currentUser.clientsSavings) - Number(client.savings)
      ).toString(),
      fees: (
        Number(this.currentUser.fees) -
        (Number(client.applicationFee) + Number(client.membershipFee))
      ).toString(),
    };
    return userRef.set(data, { merge: true });
  }

  sendEmailForVerification(user: any) {
    user
      .sendEmailVerification()
      .then(
        (res: any) => {
          this.router.navigate(['verify-email']);
        },
        (err: any) => {
          alert('Something went wrong. Unable to send you an email');
        }
      )
      .catch((error: any) => {
        alert('Something went wrong');
        this.router.navigate(['/']);
        // ...
      });
  }

  logout() {
    this.email = of('');
    this.fireauth
      .signOut()
      .then(
        () => {
          this.clearRoleFlags();

          this.router.navigate(['/']);
        },
        (err) => {
          alert(err.message);
        }
      )
      .catch((error) => {
        alert('Something went wrong');
        this.router.navigate(['/']);
        // ...
      });
  }

  forgotPassword(email: string) {
    this.fireauth
      .sendPasswordResetEmail(email)
      .then(
        () => {
          this.router.navigate(['verify-email']);
        },
        (err) => {
          alert('Something went wrong');
        }
      )
      .catch((error) => {
        alert('Something went wrong');
        this.router.navigate(['/']);
        // ...
      });
  }

  get isAdmin() {
    const allowed = ['admin'];
    return this.matchingRole(allowed);
  }
  get isDistributor() {
    const allowed = ['distributor'];
    return this.matchingRoleDistributor(allowed);
  }

  private matchingRole(alloweedRoles: string[]): boolean {
    if (!this.currentUser || this.currentUser.roles === undefined) return false;
    return alloweedRoles.some(
      (element) =>
        this.currentUser.roles.includes(element) ||
        this.isAdmninistrator ||
        (this.currentUser.admin && this.currentUser.admin === 'true')
    );
  }
  private matchingRoleDistributor(alloweedRoles: string[]): boolean {
    if (!this.currentUser || this.currentUser.roles === undefined) return false;
    return alloweedRoles.some(
      (element) =>
        this.currentUser.roles.includes(element) ||
        this.isDistributoring ||
        (this.currentUser.distributor &&
          this.currentUser.distributor === 'true')
    );
  }

  makeAdmin() {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.currentUser.uid}`
    );
    const data = {
      admin: 'true',
    };
    return userRef.set(data, { merge: true });
  }
  makeDistributor() {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.currentUser.uid}`
    );
    const data = {
      distributor: 'true',
    };
    return userRef.set(data, { merge: true });
  }

  removeAdmin() {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.currentUser.uid}`
    );
    const data = {
      admin: 'false',
    };
    return userRef.set(data, { merge: true });
  }

  removeDistributor() {
    const userRef: AngularFirestoreDocument<User> = this.afs.doc(
      `users/${this.currentUser.uid}`
    );
    const data = {
      distributor: 'false',
    };
    return userRef.set(data, { merge: true });
  }

  private persistRoleFlags(): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(ADMIN_FLAG_KEY, String(this.isAdmninistrator));
    localStorage.setItem(DISTRIBUTOR_FLAG_KEY, String(this.isDistributoring));
  }

  private normalizeSecret(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
  }

  public applyRoleWord(word: string): void {
    const normalized = this.normalizeSecret(word);
    this.isAdmninistrator = normalized === this.normalizeSecret(this.adminWord);
    this.isDistributoring =
      normalized === this.normalizeSecret(this.distributorWord);

    this.persistRoleFlags();
  }

  public clearPersistedRoleFlags(): void {
    this.clearRoleFlags();
  }

  private restoreRoleFlags(): void {
    if (typeof window === 'undefined') {
      this.isAdmninistrator = false;
      this.isDistributoring = false;
      return;
    }

    this.isAdmninistrator = localStorage.getItem(ADMIN_FLAG_KEY) === 'true';
    this.isDistributoring =
      localStorage.getItem(DISTRIBUTOR_FLAG_KEY) === 'true';
  }

  private clearRoleFlags(): void {
    this.isAdmninistrator = false;
    this.isDistributoring = false;

    if (typeof window === 'undefined') {
      return;
    }

    localStorage.removeItem(ADMIN_FLAG_KEY);
    localStorage.removeItem(DISTRIBUTOR_FLAG_KEY);
  }

  async deleteReview(
    reviewDocId: string,
    reviewToRemove: Comment,
    targetUid?: string
  ): Promise<void> {
    const uid = targetUid ?? this.currentUser.uid;
    const docRef = this.afs.doc<{ reviews: Comment[] }>(
      `users/${uid}/reviews/${reviewDocId}`
    );

    const snap = await firstValueFrom(docRef.get());
    if (!snap.exists) return;

    const current = snap.data()!.reviews || [];

    const removed: Comment[] = [];

    // Prefer unique identifiers (time + name) when available. Fallback to
    // deep-equality stringify comparison only if necessary.
    const hasKeys = !!(
      reviewToRemove &&
      reviewToRemove.time &&
      reviewToRemove.name
    );

    const next = current.filter((r) => {
      let isMatch = false;
      if (hasKeys) {
        isMatch =
          r.time === reviewToRemove.time && r.name === reviewToRemove.name;
      } else {
        try {
          isMatch = JSON.stringify(r) === JSON.stringify(reviewToRemove);
        } catch (e) {
          isMatch = false;
        }
      }
      if (isMatch) removed.push(r);
      return !isMatch;
    });

    // Best-effort: if the removed review(s) had attachments, try to delete
    // the corresponding files from Firebase Storage. Do not fail the whole
    // operation if storage deletion fails.
    for (const rem of removed) {
      const atts = (rem as any).attachments || [];
      for (const att of atts) {
        const url = att?.url;
        if (url) {
          try {
            // refFromURL may throw if URL is not a storage URL; wrap in try/catch
            await this.storage.storage.refFromURL(url).delete();
          } catch (err) {
            console.warn(
              'Could not delete storage file for review attachment:',
              err
            );
          }
        }
      }
    }

    return docRef.update({ reviews: next });
  }

  updateReviewVisibility(
    reviewId: string,
    updatedReview: Comment,
    targetUid?: string
  ): Promise<void> {
    const uid = targetUid ?? this.currentUser.uid;
    const docRef = this.afs.doc<any>(`users/${uid}/reviews/${reviewId}`);

    return docRef
      .valueChanges()
      .pipe(take(1))
      .toPromise()
      .then((doc) => {
        const reviews: Comment[] = doc?.reviews || [];

        // remplace l’élément correspondant (critère = même horodatage & même auteur)
        const index = reviews.findIndex(
          (r) => r.time === updatedReview.time && r.name === updatedReview.name
        );

        if (index !== -1) {
          reviews[index] = { ...updatedReview }; // remplacement
        } else {
          reviews.push(updatedReview); // au cas où il n’existait pas
        }

        return docRef.set({ reviews }, { merge: true });
      });
  }
  /** Remplace entièrement le tableau reviews du document concerné */
  updateReviewPerformance(
    reviewDocId: string,
    reviews: Comment[],
    targetUid?: string
  ) {
    const uid = targetUid ?? this.currentUser.uid; // utilisateur courant
    const docRef = this.afs.doc(`users/${uid}/reviews/${reviewDocId}`);
    return docRef.update({ reviews }); // ← Firestore set-merge
  }
  /** Écrase complètement le tableau reviews du document reviews/{reviewDocId} */
  updateReview(
    reviewDocId: string,
    reviews: Comment[],
    targetUid?: string
  ): Promise<void> {
    const uid = targetUid ?? this.currentUser.uid; // UID de l’utilisateur connecté
    const docRef = this.afs.doc<{ reviews: Comment[] }>(
      `users/${uid}/reviews/${reviewDocId}`
    );

    // .update() préserve les autres champs éventuels du document
    return docRef.update({ reviews });
  }
}
