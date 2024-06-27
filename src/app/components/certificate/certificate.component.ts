import { Component, OnInit } from '@angular/core';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Router } from '@angular/router';
import { Certificate } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-certificate',
  templateUrl: './certificate.component.html',
  styleUrls: ['./certificate.component.css'],
})
export class CertificateComponent implements OnInit {
  constructor(
    private router: Router,
    public auth: AuthService,
    private storage: AngularFireStorage,
    private data: DataService,
    public time: TimeService,
    private compute: ComputationService
  ) {}

  selectedTeamAndEmployee: Certificate = {};
  best: any = {};
  url: string = '';
  certificateId: string = '';
  certificates: Certificate[] = [];
  months?: number[] = [];

  currentDownloadUrl: string = '';
  employeeDocDownloadUrl: string = '';
  teamDocDownloadUrl: string = '';
  years: string[] = [];
  // note that currentMonth and currentYear, here means the previous one
  currentDate = new Date();
  currentMonth = this.currentDate.getMonth();
  currentYear = this.currentDate.getFullYear();
  givenMonth = this.currentMonth - 1;
  givenYear = this.currentYear;
  month?: number = this.givenMonth;
  monthsList: number[] = [...Array(12).keys()].map((i) => i + 1);
  yearsList: number[] = this.time.yearsList;
  year = this.currentDate.getFullYear();

  certificate: Certificate = {
    month: '',
    year: '',
    bestTeam: '',
    bestEmployee: '',
    bestEmployeePerformance: '',
    bestTeamCertificatePath: '',
    bestTeamCertificateDownloadUrl: '',
    bestEmployeeCertificatePath: '',
    bestEmployeeCertificateDownloadUrl: '',
  };
  displayAddTeam: boolean = false;
  ngOnInit(): void {
    if (this.givenMonth < 0) {
      this.givenMonth = 11; // December
      this.givenYear -= 1; // Decrease the year
    }
    this.auth.getCertificateInfo().subscribe((data) => {
      this.best = data;
      this.certificateId = this.best[0].certificateId;
      this.certificates = this.best[0].certificate;
      this.months = [
        ...new Set(this.certificates.map((item: any) => item.month)),
      ];
      this.years = [
        ...new Set(this.certificates.map((item: any) => item.year)),
      ];

      this.updateSelection();
    });
  }
  toggleDisplayAddTeam() {
    this.displayAddTeam = !this.displayAddTeam;
  }

  updateSelection() {
    this.selectedTeamAndEmployee = this.selectTeamAndEmployeeByMonthAndYear(
      this.certificates,
      this.time.monthFrenchNames[this.givenMonth],
      this.givenYear.toString()
    );
    console.log(
      'here is the data complete first ',
      this.certificates,
      this.time.monthFrenchNames[this.givenMonth],
      this.givenMonth,
      this.givenYear
    );
    console.log('The selection is', this.selectedTeamAndEmployee);
  }
  async startUploadCBestTeamData(event: FileList) {
    const file = event?.item(0);
    console.log(' current file data', file);

    if (file?.type.split('/')[0] !== 'image') {
      alert('Unsupported file type. Please upload an image.');
      return;
    }

    // the size cannot be greater than 20mb
    if (file?.size >= 20000000) {
      alert(
        "L'image est trop grande. La Taille maximale du fichier est de 20MB"
      );
      return;
    }
    const path = `certificates/team-${this.certificate.month}-${this.certificate.year}`;

    // the main task
    console.log('the path', path);

    const uploadTask = await this.storage.upload(path, file);
    this.teamDocDownloadUrl = await uploadTask.ref.getDownloadURL();
    uploadTask.totalBytes;

    this.certificate.bestTeamCertificatePath = path;
    this.certificate.bestTeamCertificateDownloadUrl = this.teamDocDownloadUrl;
  }

  selectTeamAndEmployeeByMonthAndYear(
    certificate: Certificate[],
    userEnteredMonth: string,
    userEnteredYear: string
  ) {
    const selectedObject = certificate.find(
      (item) => item.month === userEnteredMonth && item.year === userEnteredYear
    );
    return selectedObject!;
  }

  async startUploadCBestEmployeeData(event: FileList) {
    const file = event?.item(0);
    console.log(' current file data', file);

    if (file?.type.split('/')[0] !== 'image') {
      alert('Unsupported file type. Please upload an image.');
      return;
    }

    // the size cannot be greater than 20mb
    if (file?.size >= 20000000) {
      alert(
        "L'image est trop grande. La Taille maximale du fichier est de 20MB"
      );
      return;
    }
    const path = `certificates/employee-${this.certificate.month}-${this.certificate.year}`;

    // the main task
    console.log('the path', path);

    const uploadTask = await this.storage.upload(path, file);
    this.employeeDocDownloadUrl = await uploadTask.ref.getDownloadURL();
    uploadTask.totalBytes;

    this.certificate.bestEmployeeCertificatePath = path;
    this.certificate.bestEmployeeCertificateDownloadUrl =
      this.employeeDocDownloadUrl;
  }

  onTeamClick(): void {
    const fileInput = document.getElementById('getTeam') as HTMLInputElement;
    fileInput.click();
  }
  onEmployeClick(): void {
    const fileInput = document.getElementById('getEmploye') as HTMLInputElement;
    fileInput.click();
  }

  updateData() {
    this.certificates.push(this.certificate);
    this.data.addCertificateData(this.certificates, this.certificateId);
    this.router.navigate(['/home']);
  }
  choose() {}
}
