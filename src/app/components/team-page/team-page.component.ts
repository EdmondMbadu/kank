import { Component, OnInit } from '@angular/core';
import {
  AngularFireStorage,
  AngularFireUploadTask,
} from '@angular/fire/compat/storage';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee, Trophy } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { PerformanceService } from 'src/app/services/performance.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-team-page',
  templateUrl: './team-page.component.html',
  styleUrls: ['./team-page.component.css'],
})
export class TeamPageComponent implements OnInit {
  constructor(
    private router: Router,
    public auth: AuthService,
    public data: DataService,
    private time: TimeService,
    private performance: PerformanceService,
    private storage: AngularFireStorage,
    private compute: ComputationService
  ) {}
  displayEditEmployees: boolean[] = [];

  // ===== Trophy Modal state =====
  trophyModalVisible = false;
  trophyModalType: 'team' | 'employee' | null = null;
  trophyModalEmployee: Employee | null = null;

  // ===== Transfer state =====
  transferModalVisible = false;
  isTransferring = false;
  transfer = {
    sourceId: null as string | null,
    targetId: null as string | null,
    sourceClientCount: 0,
    targetClientCount: 0,
  };
  bulkAction = {
    activeTab: 'transfer' as 'transfer' | 'copy' | 'swap' | 'duplicates',
    subset: 'all' as 'all' | 'count',
    count: null as number | null,
    randomize: true,
    duplicateIds: [] as string[],
    duplicatesRemoveFrom: 'source' as 'source' | 'target',
    duplicatesLoading: false,
  };
  private clientDictionary: Record<string, Client> = {};

  ngOnInit(): void {
    this.retreiveClients();
  }
  readonly TOTAL_VACATION_DAYS = 7;
  today = this.time.todaysDateMonthDayYear();
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);

  url: string = '';
  task?: AngularFireUploadTask;
  employees: Employee[] = [];
  allClients: Client[] = [];
  clientsWithDebts: Client[] = [];
  year = new Date().getFullYear();
  employee: Employee = {};
  firstName: string = '';
  lastName: string = '';
  middleName: string = '';
  phoneNumber: string = '';
  role: string = '';
  dateOfBirth: string = '';
  sex: string = '';
  dateJoined: string = '';
  status: string = '';
  attendance: string = '';
  displayAddNewEmployee: boolean = false;
  displayEditEmployee: boolean = false;
  agentClientMap: any = {};
  vacation: number = 0;
  originLocation: string = '';

  toggleAddNewEmployee() {
    this.displayAddNewEmployee = !this.displayAddNewEmployee;
  }
  toggleEditEmployee(index: number) {
    this.displayEditEmployees[index] = !this.displayEditEmployees[index];
  }
  retrieveEmployees(): void {
    this.auth.getAllEmployees().subscribe((data: any) => {
      this.employees = data;

      if (this.employees !== null) {
        this.displayEditEmployees = new Array(this.employees.length).fill(
          false
        );
      }

      this.addIdsToEmployees();
    });
  }
  /** — NEW —  add these in your TeamPageComponent class  */
  isFullPictureVisible = false;
  fullPictureURL: string | null = null;

  /** Opens the viewer (pass the URL) or closes it when called without a URL */
  toggleFullPicture(url?: string): void {
    if (url) {
      this.fullPictureURL = url;
      this.isFullPictureVisible = true;
    } else {
      this.isFullPictureVisible = false;
      this.fullPictureURL = null;
    }
  }

  retreiveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.allClients = data;
      this.buildClientDictionary();
      this.findClientsWithDebts();
      this.retrieveEmployees();
    });
  }

  private buildClientDictionary(): void {
    this.clientDictionary = {};
    this.allClients?.forEach((client) => {
      if (client.uid) {
        this.clientDictionary[client.uid] = client;
      }
    });
  }
  addNewEmployee() {
    if (
      this.firstName === '' ||
      this.lastName === '' ||
      this.middleName === '' ||
      this.phoneNumber === '' ||
      this.role === '' ||
      this.dateOfBirth === '' ||
      this.sex === '' ||
      this.dateJoined === '' ||
      this.status === ''
    ) {
      alert('Remplissez toutes les données.');
      return;
    }
    this.fillEmployee();
    this.auth
      .addNewEmployee(this.employee)
      .then(() => {
        alert('Employé Ajouté avec Succès');
      })
      .catch((err) => {
        alert(
          "Une erreur s'est produite lors de l'ajout d'un employé. Essayez encore."
        );

        console.log(err);
      });
    this.toggleAddNewEmployee();
  }
  addIdsToEmployees() {
    // let commonElements = this.employees[0].clients!.filter((item) =>
    //   this.employees[1].clients!.includes(item)
    // );
    // console.log('common elements', commonElements);

    for (let i = 0; this.employees && i < this.employees.length; i++) {
      // Migrate old single trophy fields to new array format
      this.migrateTrophyData(this.employees[i]);
      // console.log(' here I am employee ', this.employees[i]);
      this.employees[i].trackingId = `${i}`;
      this.employees[i].age = this.time
        .calculateAge(this.employees[i].dateOfBirth!)
        .toString();

      this.employees[i].currentClients =
        this.compute.filterClientsWithoutDebtFollowedByEmployee(
          this.allClients,
          this.employees[i]
        );

      if (this.employees[i].role === 'Manager') {
        let result = this.performance.findAverageAndTotalAllEmployee(
          this.employees
        );

        this.employees[i].averagePoints = `${result[0]} / ${result[1]}`;
        this.employees[i].letterGrade = this.performance.findLetterGrade(
          result[0] / result[1]
        );
        let rounded = this.compute.roundNumber((result[0] * 100) / result[1]);
        this.employees[i].performancePercantage = rounded.toString();
      } else {
        let result = this.performance.findAverageAndTotal(this.employees[i]);

        this.employees[i].averagePoints = `${result[0]} / ${result[1]}`;
        this.employees[i].letterGrade = this.performance.findLetterGrade(
          result[0] / result[1]
        );
        let rounded = this.compute.roundNumber((result[0] * 100) / result[1]);
        this.employees[i].performancePercantage = rounded.toString();
      }
    }
    if (!this.auth.isAdmninistrator) {
      if (this.employees) {
        this.employees = this.employees.filter((emp) => {
          return emp?.status === 'Travaille' || emp?.status === 'Vacance';
        });
      }
    }
    if (!this.auth.isAdmninistrator && !this.auth.isDistributor) {
      if (this.employees) {
        this.employees = this.employees.filter((emp) => {
          return (
            emp.role === 'Manager' ||
            emp.role === 'Agent' ||
            emp.role === 'Agent Marketing' ||
            emp.role === 'Stagaire' ||
            emp.role === 'Vérificateur' ||
            emp.role === 'Vérificatrice'
          );
        });
      }
    }
  }

  findClientsWithDebts() {
    if (this.allClients) {
      this.clientsWithDebts = this.data.findClientsWithDebts(this.allClients);
      this.agentClientMap = this.getAgentsWithClients();
    }
  }

  async resetClientsAndEmployees() {
    try {
      let reset = await this.data.updateEmployeeInfoBulk(this.agentClientMap);
      this.router.navigate(['/home']);
    } catch (error) {
      console.log(
        'An error occured while reseting employees info in bulk',
        error
      );
    }
  }
  /** Met à jour this.vacation (= jours restants) */
  numberOfVacationDaysLeft(employee: Employee) {
    const acceptedDays = Number(employee.vacationAcceptedNumberOfDays) || 0;

    return this.TOTAL_VACATION_DAYS - acceptedDays;
  }

  getAgentsWithClients() {
    const agentClientMap: any = {};

    this.clientsWithDebts.forEach((client) => {
      const agent = client.agent;
      const uid = client.uid;

      // If the agent is not in the dictionary, add it with an empty array
      if (!agentClientMap[agent!]) {
        agentClientMap[agent!] = [];
      }

      // Add the client's UID to the agent's list
      agentClientMap[agent!].push(uid);
    });

    return agentClientMap;
  }

  onImageClick(index: number): void {
    const fileInput = document.getElementById(
      'getFile' + index
    ) as HTMLInputElement;
    fileInput.click();
  }
  onCVClick(): void {
    const fileInput = document.getElementById('getCV') as HTMLInputElement;
    fileInput.click();
  }
  onFieldClick(id: string): void {
    const fileInput = document.getElementById(id) as HTMLInputElement;
    fileInput.click();
  }

  async startUpload(event: FileList, emp: Employee) {
    console.log('current employee', emp);
    const file = event?.item(0);
    console.log(' current file data', file);

    if (file?.type.split('/')[0] !== 'image') {
      console.log('unsupported file type');
      return;
    }
    // the size cannot be greater than 20mb
    if (file?.size >= 20000000) {
      alert(
        "L'image est trop grande. La Taille maximale du fichier est de 20MB"
      );
      return;
    }
    const path = `avatar/${emp.firstName}-${emp.lastName}`;

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
    this.data.updateEmployeePictureData(emp, avatar);
    this.router.navigate(['/home']);
  }

  async startUploadCV(event: FileList, emp: Employee) {
    console.log('current employee', emp);
    const file = event?.item(0);
    console.log(' current file data', file);

    if (file?.type !== 'application/pdf') {
      alert('Unsupported file type. Please upload a PDF.');
      return;
    }

    // the size cannot be greater than 20mb
    if (file?.size >= 20000000) {
      alert(
        "L'image est trop grande. La Taille maximale du fichier est de 20MB"
      );
      return;
    }
    const path = `avatar/${emp.firstName}-${emp.lastName}-CV`;

    // the main task
    console.log('the path', path);

    // this.task = await this.storage.upload(path, file);
    const uploadTask = await this.storage.upload(path, file);
    this.url = await uploadTask.ref.getDownloadURL();
    uploadTask.totalBytes;
    // console.log('the download url', this.url);
    const avatar = {
      CV: path,
      CVDownloadURL: this.url,
      CVSize: uploadTask.totalBytes.toString(),
    };
    this.data.updateEmployeePictureData(emp, avatar);
    this.router.navigate(['/home']);
  }
  fillEmployee() {
    this.employee.firstName = this.firstName;
    this.employee.lastName = this.lastName;
    this.employee.middleName = this.middleName;
    this.employee.phoneNumber = this.phoneNumber;
    this.employee.role = this.role;
    this.employee.dateOfBirth = this.dateOfBirth;
    this.employee.sex = this.sex;
    this.employee.dateJoined = this.dateJoined;
    this.employee.status = this.status;
  }

  updateEmployeeInfo(index: number) {
    if (
      this.employees[index].firstName === '' ||
      this.employees[index].lastName === '' ||
      this.employees[index].middleName === '' ||
      this.employees[index].phoneNumber === '' ||
      this.employees[index].role === '' ||
      this.employees[index].dateOfBirth === '' ||
      this.employees[index].sex === '' ||
      this.employees[index].dateJoined === '' ||
      this.employees[index].status === ''
    ) {
      alert('Remplissez toutes les données.');
      return;
    }
    this.data
      .updateEmployeeInfo(this.employees[index])
      .then(() => {
        alert('Employé Modifier avec Succès');
      })
      .catch((err) => {
        alert(
          "Une erreur s'est produite lors de la modification de l'employé. Essayez encore."
        );
        console.log(err);
      });
    this.toggleEditEmployee(index);
  }

  updatePerformance() {
    let dummyClient = new Client();
    this.performance.updateUserPerformance(dummyClient);
    this.router.navigate(['/home']);
  }
  async startUploadContract(
    event: FileList,
    employee: Employee,
    path: string = 'contract'
  ) {
    console.log('path', path);
    try {
      await this.data.startUpload(
        event,
        `${path}/${employee.firstName}-${employee.lastName}`,
        employee.uid!,
        path
      );
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error occurred while uploading file. Please try again.');
    }
  }

  openTransferModal() {
    this.transferModalVisible = true;
    this.transfer = {
      sourceId: null,
      targetId: null,
      sourceClientCount: 0,
      targetClientCount: 0,
    };
    this.bulkAction = {
      activeTab: 'transfer',
      subset: 'all',
      count: null,
      randomize: true,
      duplicateIds: [],
      duplicatesRemoveFrom: 'source',
      duplicatesLoading: false,
    };
  }

  closeTransferModal() {
    this.transferModalVisible = false;
    this.bulkAction.duplicateIds = [];
  }

  onSourceChange() {
    const src = this.employees.find((e) => e.uid === this.transfer.sourceId);
    this.transfer.sourceClientCount =
      src?.currentClients?.length ?? src?.clients?.length ?? 0;
    this.clampBulkCount();
    if (this.bulkAction.activeTab === 'duplicates') {
      this.bulkAction.duplicateIds = [];
    }
  }

  onTargetChange() {
    this.updateTargetCount();
    if (this.bulkAction.activeTab === 'duplicates') {
      this.bulkAction.duplicateIds = [];
    }
  }

  private updateTargetCount() {
    const dst = this.employees.find((e) => e.uid === this.transfer.targetId);
    this.transfer.targetClientCount =
      dst?.currentClients?.length ?? dst?.clients?.length ?? 0;
  }

  public clampBulkCount(): void {
    if (this.bulkAction.subset === 'all') {
      this.bulkAction.count = null;
      return;
    }
    const max = this.transfer.sourceClientCount;
    if (max === 0) {
      this.bulkAction.count = null;
      return;
    }
    if (!this.bulkAction.count || this.bulkAction.count < 1) {
      this.bulkAction.count = 1;
    }
    if (this.bulkAction.count > max) {
      this.bulkAction.count = max;
    }
  }

  setBulkTab(tab: 'transfer' | 'copy' | 'swap' | 'duplicates'): void {
    this.bulkAction.activeTab = tab;
    if (tab !== 'duplicates') {
      this.bulkAction.duplicateIds = [];
    }
    if (tab === 'swap') {
      this.bulkAction.subset = 'all';
      this.bulkAction.count = null;
    } else if (this.bulkAction.subset === 'count') {
      this.clampBulkCount();
    }
  }

  setSubset(mode: 'all' | 'count'): void {
    if (this.bulkAction.activeTab === 'swap') {
      this.bulkAction.subset = 'all';
      this.bulkAction.count = null;
      return;
    }
    this.bulkAction.subset = mode;
    this.clampBulkCount();
  }

  canExecuteBulkAction(): boolean {
    return (
      !!this.transfer.sourceId &&
      !!this.transfer.targetId &&
      this.transfer.sourceId !== this.transfer.targetId &&
      (this.bulkAction.activeTab === 'swap'
        ? this.transfer.sourceClientCount > 0 ||
          this.transfer.targetClientCount > 0
        : this.transfer.sourceClientCount > 0 &&
          (this.bulkAction.subset === 'all' ||
            (this.bulkAction.count !== null && this.bulkAction.count > 0)))
    );
  }

  confirmBulkAction() {
    if (!this.canExecuteBulkAction()) {
      return;
    }

    this.isTransferring = true;
    const { sourceId, targetId } = this.transfer;
    const sourceName = this.getEmployeeName(sourceId);
    const targetName = this.getEmployeeName(targetId);

    let action: Promise<any>;
    if (this.bulkAction.activeTab === 'swap') {
      action = this.data.swapClientsBetweenEmployees(sourceId!, targetId!);
    } else {
      const count =
        this.bulkAction.subset === 'count'
          ? this.bulkAction.count ?? undefined
          : undefined;
      const randomize = this.bulkAction.randomize;
      action =
        this.bulkAction.activeTab === 'copy'
          ? this.data.copyClientsToEmployee(sourceId!, targetId!, {
              count,
              randomize,
            })
          : this.data.transferCurrentClients(sourceId!, targetId!, {
              count,
              randomize,
            });
    }

    action
      .then((result) => {
        this.isTransferring = false;

        if (this.bulkAction.activeTab === 'swap') {
          const swapResult = result as { toFirst: number; toSecond: number };
          this.closeTransferModal();
          alert(
            `Échange terminé : ${swapResult.toSecond} client(s) vers ${
              targetName || 'B'
            } et ${swapResult.toFirst} client(s) vers ${sourceName || 'A'}.`
          );
        } else {
          const affectedCount = result as number;
          const actionLabel =
            this.bulkAction.activeTab === 'copy' ? 'copié(s)' : 'transféré(s)';
          this.closeTransferModal();
          alert(`${affectedCount} client(s) ${actionLabel} avec succès.`);
        }
        this.retreiveClients();
      })
      .catch((err) => {
        this.isTransferring = false;
        console.error('Bulk action error:', err);
        alert(
          "Une erreur est survenue lors de l'opération. Réessayez dans un instant."
        );
      });
  }

  getClientDisplayName(id: string): string {
    const client = this.clientDictionary[id];
    if (!client) return id;
    const composed = `${client.firstName || ''} ${client.middleName || ''} ${
      client.lastName || ''
    }`
      .replace(/\s+/g, ' ')
      .trim();
    return composed || client.name || client.phoneNumber || id;
  }

  getEmployeeName(id: string | null): string {
    if (!id) {
      return '';
    }
    const emp = this.employees.find((e) => e.uid === id);
    if (!emp) {
      return '';
    }
    return `${emp.firstName || ''} ${emp.lastName || ''}`.trim();
  }

  findDuplicateClients() {
    if (
      !this.transfer.sourceId ||
      !this.transfer.targetId ||
      this.transfer.sourceId === this.transfer.targetId
    ) {
      alert('Sélectionnez deux employés différents.');
      return;
    }
    this.bulkAction.duplicatesLoading = true;
    const src = this.employees.find((e) => e.uid === this.transfer.sourceId);
    const dst = this.employees.find((e) => e.uid === this.transfer.targetId);

    const srcClients = src?.clients ?? src?.currentClients ?? [];
    const dstSet = new Set(dst?.clients ?? dst?.currentClients ?? []);
    const duplicates = Array.from(new Set(srcClients)).filter((uid) =>
      dstSet.has(uid)
    );

    this.bulkAction.duplicateIds = duplicates;
    this.bulkAction.duplicatesLoading = false;
  }

  removeFoundDuplicates() {
    if (!this.bulkAction.duplicateIds.length) {
      return;
    }
    if (!this.transfer.sourceId || !this.transfer.targetId) {
      return;
    }

    this.isTransferring = true;
    const removeFrom = this.bulkAction.duplicatesRemoveFrom;
    this.data
      .removeDuplicateClientsBetweenEmployees(
        this.transfer.sourceId,
        this.transfer.targetId,
        removeFrom
      )
      .then((removedCount) => {
        this.isTransferring = false;
        alert(
          `${removedCount} doublon(s) retiré(s) de l'employé ${
            removeFrom === 'source' ? 'A' : 'B'
          }.`
        );
        this.bulkAction.duplicateIds = [];
        this.retreiveClients();
      })
      .catch((err) => {
        this.isTransferring = false;
        console.error('Duplicate cleanup error:', err);
        alert("Impossible de retirer les doublons pour l'instant. Réessayez.");
      });
  }

  /**
   * Check if employee has best team trophies
   */
  hasBestTeamTrophy(employee: Employee): boolean {
    return !!(
      employee.bestTeamTrophies && employee.bestTeamTrophies.length > 0
    );
  }

  /**
   * Check if employee has best employee trophies
   */
  hasBestEmployeeTrophy(employee: Employee): boolean {
    return !!(
      employee.bestEmployeeTrophies && employee.bestEmployeeTrophies.length > 0
    );
  }

  /**
   * Get formatted trophy date string
   */
  getTrophyDate(trophy: Trophy): string {
    if (!trophy || !trophy.month || !trophy.year) return '';
    const monthNames = [
      'Janvier',
      'Février',
      'Mars',
      'Avril',
      'Mai',
      'Juin',
      'Juillet',
      'Août',
      'Septembre',
      'Octobre',
      'Novembre',
      'Décembre',
    ];
    const monthIndex = parseInt(trophy.month, 10) - 1;
    const monthName =
      monthIndex >= 0 && monthIndex < 12
        ? monthNames[monthIndex]
        : trophy.month;
    return `${monthName} ${trophy.year}`;
  }

  /**
   * Get all team trophies for an employee
   */
  getTeamTrophies(employee: Employee): Trophy[] {
    return employee.bestTeamTrophies || [];
  }

  /**
   * Get all employee trophies for an employee
   */
  getEmployeeTrophies(employee: Employee): Trophy[] {
    return employee.bestEmployeeTrophies || [];
  }

  /**
   * Add a new team trophy
   */
  addTeamTrophy(index: number, month: string, year: string): void {
    if (!this.employees[index].bestTeamTrophies) {
      this.employees[index].bestTeamTrophies = [];
    }
    this.employees[index].bestTeamTrophies!.push({ month, year });
  }

  /**
   * Add a new employee trophy
   */
  addEmployeeTrophy(index: number, month: string, year: string): void {
    if (!this.employees[index].bestEmployeeTrophies) {
      this.employees[index].bestEmployeeTrophies = [];
    }
    this.employees[index].bestEmployeeTrophies!.push({ month, year });
  }

  /**
   * Remove a team trophy
   */
  removeTeamTrophy(index: number, trophyIndex: number): void {
    if (this.employees[index].bestTeamTrophies) {
      this.employees[index].bestTeamTrophies!.splice(trophyIndex, 1);
    }
  }

  /**
   * Remove an employee trophy
   */
  removeEmployeeTrophy(index: number, trophyIndex: number): void {
    if (this.employees[index].bestEmployeeTrophies) {
      this.employees[index].bestEmployeeTrophies!.splice(trophyIndex, 1);
    }
  }

  /**
   * Open trophy modal
   */
  openTrophyModal(employee: Employee, type: 'team' | 'employee'): void {
    this.trophyModalEmployee = employee;
    this.trophyModalType = type;
    this.trophyModalVisible = true;
  }

  /**
   * Close trophy modal
   */
  closeTrophyModal(): void {
    this.trophyModalVisible = false;
    this.trophyModalEmployee = null;
    this.trophyModalType = null;
  }

  /**
   * Get trophies for modal display
   */
  getModalTrophies(): Trophy[] {
    if (!this.trophyModalEmployee || !this.trophyModalType) return [];
    return this.trophyModalType === 'team'
      ? this.trophyModalEmployee.bestTeamTrophies || []
      : this.trophyModalEmployee.bestEmployeeTrophies || [];
  }

  /**
   * Get modal title
   */
  getModalTitle(): string {
    if (!this.trophyModalType) return '';
    return this.trophyModalType === 'team'
      ? 'Trophées Meilleure Équipe'
      : 'Trophées Meilleur Employé';
  }

  /**
   * Migrate old single trophy fields to new array format
   */
  private migrateTrophyData(employee: Employee): void {
    // Migrate best team trophy
    if (!employee.bestTeamTrophies || employee.bestTeamTrophies.length === 0) {
      employee.bestTeamTrophies = [];
      // Check for old format fields
      if (
        (employee as any).bestTeamTrophyMonth &&
        (employee as any).bestTeamTrophyYear
      ) {
        employee.bestTeamTrophies.push({
          month: (employee as any).bestTeamTrophyMonth,
          year: (employee as any).bestTeamTrophyYear,
        });
        // Clear old fields (they'll be removed on next save)
        delete (employee as any).bestTeamTrophyMonth;
        delete (employee as any).bestTeamTrophyYear;
      }
    }

    // Migrate best employee trophy
    if (
      !employee.bestEmployeeTrophies ||
      employee.bestEmployeeTrophies.length === 0
    ) {
      employee.bestEmployeeTrophies = [];
      // Check for old format fields
      if (
        (employee as any).bestEmployeeTrophyMonth &&
        (employee as any).bestEmployeeTrophyYear
      ) {
        employee.bestEmployeeTrophies.push({
          month: (employee as any).bestEmployeeTrophyMonth,
          year: (employee as any).bestEmployeeTrophyYear,
        });
        // Clear old fields (they'll be removed on next save)
        delete (employee as any).bestEmployeeTrophyMonth;
        delete (employee as any).bestEmployeeTrophyYear;
      }
    }
  }

  /**
   * Delete an employee completely from the system.
   * Only available to admins.
   */
  async deleteEmployee(employee: Employee, index: number): Promise<void> {
    if (!this.auth.isAdmin) {
      return;
    }

    const employeeName =
      `${employee.firstName || ''} ${employee.lastName || ''}`.trim() ||
      'Cet employé';
    const clientCount =
      employee.currentClients?.length || employee.clients?.length || 0;

    let confirmMessage = `Êtes-vous sûr de vouloir supprimer définitivement ${employeeName} ?\n\n`;
    if (clientCount > 0) {
      confirmMessage += `⚠️ ATTENTION : Cet employé a ${clientCount} client(s) assigné(s).\n`;
      confirmMessage += `Les clients ne seront pas supprimés, mais leur agent assigné sera retiré.\n\n`;
    }
    confirmMessage += `Cette action est irréversible.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const userId = this.auth.currentUser?.uid;
      if (!userId || !employee.uid) {
        alert("Impossible d'identifier l'employé ou l'utilisateur.");
        return;
      }

      await this.auth.deleteEmployee(userId, employee.uid);

      // Remove from local array
      this.employees.splice(index, 1);
      this.displayEditEmployees = new Array(this.employees.length).fill(false);

      alert(`${employeeName} a été supprimé avec succès.`);

      // Refresh the list
      this.retreiveClients();
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      alert(
        `Une erreur s'est produite lors de la suppression de l'employé. ${
          error?.message || ''
        }`
      );
    }
  }

  /**
   * Convert a rotation employee to definitive (affectation)
   */
  async convertRotationToDefinitive(employee: Employee): Promise<void> {
    const currentUserId = this.auth.currentUser?.uid;
    if (!employee.uid || !currentUserId) {
      alert('Impossible de convertir cet employé. Informations manquantes.');
      return;
    }

    if (
      !confirm(
        `Convertir ${employee.firstName} ${employee.lastName} de rotation en affectation définitive ?\n\nL'employé sera traité comme un employé permanent de cette localisation.`
      )
    ) {
      return;
    }

    try {
      console.log('Converting rotation employee to definitive:', {
        employeeId: employee.uid,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        currentUserId: currentUserId,
        isRotation: employee.isRotation,
        rotationSourceLocationId: employee.rotationSourceLocationId,
      });

      await this.auth.convertRotationToDefinitive(currentUserId, employee.uid);

      // Reload employees to reflect the change
      this.retrieveEmployees();

      alert('Employé converti en affectation définitive avec succès.');
    } catch (error: any) {
      console.error('=== Error converting rotation to definitive ===');
      console.error('Error object:', error);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Error stack:', error?.stack);
      console.error('Parameters used:', {
        userId: currentUserId,
        employeeId: employee.uid,
        employeeName: `${employee.firstName} ${employee.lastName}`,
      });
      console.error('================================================');
      alert(
        "Une erreur s'est produite lors de la conversion. Veuillez réessayer."
      );
    }
  }
}
