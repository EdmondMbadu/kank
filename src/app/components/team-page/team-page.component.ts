import { Component, OnInit } from '@angular/core';
import {
  AngularFireStorage,
  AngularFireUploadTask,
} from '@angular/fire/compat/storage';
import { Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
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
  salaries: any[] = [
    [
      { people: '60' },
      { role: 'Manager', base: '80$', a: '15$', b: '25$', c: '45$', d: '55$' },
      {
        role: 'Agent Margeting',
        base: '70$',
        a: '10$',
        b: '20$',
        c: '40$',
        d: '50$',
      },
    ],
    [
      { people: '100' },
      {
        role: 'Manager',
        base: '80$',
        a: '60$',
        b: '80$',
        c: '100$',
        d: '110$',
      },
      {
        role: 'Agent Margeting',
        base: '70$',
        a: '50$',
        b: '70$',
        c: '90$',
        d: '100$',
      },
    ],
    [
      { people: '160' },
      {
        role: 'Manager',
        base: '80$',
        a: '110$',
        b: '130$',
        c: '150$',
        d: '160$',
      },
      {
        role: 'Agent Margeting',
        base: '70$',
        a: '100$',
        b: '120$',
        c: '140$',
        d: '150$',
      },
    ],
  ];
  today = this.time.todaysDateMonthDayYear();
  tomorrow = this.time.getTomorrowsDateMonthDayYear();
  frenchDate = this.time.convertDateToDayMonthYear(this.today);

  url: string = '';
  task?: AngularFireUploadTask;
  employees: Employee[] = [];
  allClients: Client[] = [];

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
    for (let i = 0; i < this.employees.length; i++) {
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
}
