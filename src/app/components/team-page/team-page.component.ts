import { Component, OnInit } from '@angular/core';
import {
  AngularFireStorage,
  AngularFireUploadTask,
} from '@angular/fire/compat/storage';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
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

  ngOnInit(): void {
    this.retreiveClients();
  }

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

  retreiveClients(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.allClients = data;
      this.findClientsWithDebts();
      this.retrieveEmployees();
    });
  }
  addNewEmployee() {
    console.log(
      this.firstName,
      this.lastName,
      this.middleName,
      this.phoneNumber,
      this.role,
      this.dateOfBirth,
      this.sex,
      this.dateJoined,
      status
    );
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
          return emp?.status === 'Travaille';
        });
      }
    }
    if (!this.auth.isAdmninistrator && !this.auth.isDistributor) {
      if (this.employees) {
        this.employees = this.employees.filter((emp) => {
          return emp.role === 'Manager' || emp.role === 'Agent';
        });
      }
    }
  }

  findClientsWithDebts() {
    if (this.allClients) {
      this.clientsWithDebts = this.allClients.filter((data) => {
        return Number(data.debtLeft) > 0 && data.vitalStatus !== 'Mort'; //remove clients that are dead from the mixt
      });
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
}
