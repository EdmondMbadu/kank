import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Client } from 'src/app/models/client';
import { Employee } from 'src/app/models/employee';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';
import { AngularFireStorage } from '@angular/fire/compat/storage';

@Component({
  selector: 'app-register-portal',
  templateUrl: './register-portal.component.html',
  styleUrls: ['./register-portal.component.css'],
})
export class RegiserPortalComponent {
  client = new Client();
  minPay = '';
  employees: Employee[] = [];
  agent?: Employee = { firstName: '-' };
  url: string = '';

  id: any = '';
  paymentDate = '';
  debtStart = '';
  requestDate = '';
  debtEnd = '';
  worhty? = '';
  savings: string = '0';
  public graphWorthiness = {
    data: [
      {
        domain: { x: [0, 1], y: [0, 1] },
        value: 270,
        title: { text: 'Speed' },
        type: 'indicator',
        mode: 'gauge+number',
        gauge: {
          axis: { range: [0, 100], tickcolor: 'blue' }, // Color of the ticks (optional)
          bar: { color: 'blue' }, // Single color for the gauge bar (needle)
        },
      },
    ],
    layout: {
      margin: { t: 0, b: 0, l: 0, r: 0 }, // Adjust margins
      responsive: true, // Make the chart responsive
    },
  };
  public graphCredit = {
    data: [
      {
        domain: { x: [0, 1], y: [0, 1] },
        value: 270,
        title: { text: 'Speed' },
        type: 'indicator',
        mode: 'gauge+number',
        gauge: {
          axis: { range: [0, 100], tickcolor: 'blue' }, // Color of the ticks (optional)
          bar: { color: 'blue' }, // Single color for the gauge bar (needle)
        },
      },
    ],
    layout: {
      margin: { t: 0, b: 0, l: 0, r: 0 }, // Adjust margins
      responsive: true, // Make the chart responsive
    },
  };
  constructor(
    public auth: AuthService,
    public activatedRoute: ActivatedRoute,
    private router: Router,
    private time: TimeService,
    private data: DataService,
    private compute: ComputationService,
    private storage: AngularFireStorage
  ) {
    this.id = this.activatedRoute.snapshot.paramMap.get('id');
  }
  ngOnInit(): void {
    this.retrieveClient();
  }

  retrieveClient(): void {
    this.auth.getAllClients().subscribe((data: any) => {
      this.client = data[Number(this.id)];
      console.log('Current client ', this.client);
      this.setGraphCredit();
      this.setFields();
      this.setGraphWorthiness();
      this.client.debtCycle =
        this.client.debtCycle === undefined || this.client.debtCycle === '0'
          ? '1'
          : this.client.debtCycle;
      this.requestDate = this.time.convertDateToDayMonthYear(
        this.client.requestDate!
      );
    });
  }

  startNewDebtCycle() {
    if (this.client.amountPaid !== this.client.amountToPay) {
      alert(
        `Vous devez encore FC ${this.client.debtLeft}. Terminez d'abord ce cycle.`
      );
      return;
    } else {
      this.router.navigate(['/debt-cycle/' + this.id]);
    }
  }
  withDrawFromSavings() {
    if (this.client.savings === '0') {
      alert("Vous n'avez pas d'argent !");
      return;
    } else {
      this.router.navigate(['/withdraw-savings/' + this.id]);
    }
  }

  // delete() {
  //   let result = confirm('Êtes-vous sûr de vouloir supprimer ce client?');
  //   if (!result) {
  //     return;
  //   }
  //   this.auth
  //     .deleteClient(this.client)
  //     .then(() => {
  //       alert('Client supprimé avec succès !');
  //       this.router.navigate(['/client-info/']);
  //     })
  //     .catch((error) => {
  //       alert('Error deleting client: ');
  //     });

  //   this.auth
  //     .UpdateUserInfoForDeletedRegisterClient(this.client)
  //     .then(() => {
  //       console.log('updated user info');
  //     })
  //     .catch((error) => {
  //       alert('Error deleting client: ');
  //     });
  // }

  async cancelRegistration() {
    let total =
      Number(this.client.savings) +
      Number(this.client.membershipFee) +
      Number(this.client.applicationFee);
    let result = confirm(
      `Êtes-vous sûr de vouloir annuler l'enregistrement?. Cela entraînera le retour de tout l'argent aux clients pour un total de ${total} FC`
    );
    if (!result) {
      return;
    }

    try {
      this.client.applicationFeePayments = {
        [this.time.todaysDate()]:
          Number(this.client.applicationFee) > 0
            ? `-${this.client.applicationFee}`
            : `${this.client.applicationFee}`,
      };

      this.client.membershipFeePayments = {
        [this.time.todaysDate()]:
          Number(this.client.membershipFee) > 0
            ? `-${this.client.membershipFee}`
            : `${this.client.membershipFee}`,
      };
      this.client.savingsPayments = {
        [this.time.todaysDate()]:
          Number(this.client.savings) > 0
            ? `-${this.client.savings}`
            : `${this.client.savings}`,
      };
      const updateUser =
        await this.data.UpdateUserInfoForCancelingdRegisteredClient(
          this.client
        );
      const clientCancel = await this.auth.cancelClientRegistration(
        this.client
      );

      this.router.navigate(['/client-info-current/']);
    } catch (err) {
      console.log('error occured while cancelling registration', err);
      alert("Une erreur s'est de l'annulation de l'enregistrement, Réessayez");
      return;
    }
  }
  setGraphCredit() {
    let num = Number(this.client.creditScore);
    let gaugeColor = this.compute.getGradientColor(Number(num));

    this.graphCredit = {
      data: [
        {
          domain: { x: [0, 1], y: [0, 1] },
          value: num,
          title: {
            text: `Client Score Credit`,
          },
          type: 'indicator',
          mode: 'gauge+number',
          gauge: {
            axis: { range: [0, 100], tickcolor: gaugeColor }, // Color of the ticks (optional)
            bar: { color: gaugeColor }, // Single color for the gauge bar (needle)
          },
        },
      ],
      layout: {
        margin: { t: 20, b: 20, l: 20, r: 20 }, // Adjust margins
        responsive: true, // Make the chart responsive
      },
    };
  }
  setGraphWorthiness() {
    let num = Number(this.client.creditworthinessScore);
    let gaugeColor = this.compute.getGradientColor(Number(num));
    let text = this.getCreditworthinessCategory(num);
    this.graphWorthiness = {
      data: [
        {
          domain: { x: [0, 1], y: [0, 1] },
          value: num,
          title: {
            text: text,
          },
          type: 'indicator',
          mode: 'gauge+number',
          gauge: {
            axis: { range: [0, 100], tickcolor: gaugeColor }, // Color of the ticks (optional)
            bar: { color: gaugeColor }, // Single color for the gauge bar (needle)
          },
        },
      ],
      layout: {
        margin: { t: 20, b: 20, l: 20, r: 20 }, // Adjust margins
        responsive: true, // Make the chart responsive
      },
    };
  }
  async startUpload(event: FileList) {
    console.log('current employee', this.client);
    const file = event?.item(0);
    console.log(' current file data', file);

    if (file?.type.split('/')[0] !== 'image') {
      console.log('unsupported file type');
      return;
    }
    // the size cannot be greater than 10mb
    if (file?.size >= 20000000) {
      alert(
        "L'image est trop grande. La Taille maximale du fichier est de 10MB"
      );
      return;
    }
    const path = `clients-avatar/${this.client.firstName}-${this.client.middleName}-${this.client.lastName}`;

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
    try {
      await this.data.updateClientPictureData(this.client, avatar);
    } catch (error) {
      console.error('Error updating employee picture:', error);
    }
    // this.router.navigate(['/home']);
  }
  onImageClick(id: string): void {
    const fileInput = document.getElementById(id) as HTMLInputElement;
    fileInput.click();
  }
  getCreditworthinessCategory(score: number): string {
    if (score >= 90 && score <= 100) {
      return 'Excellent – Très solvable, faible risque.';
    } else if (score >= 70 && score <= 89) {
      return 'Bon – Solvable avec un risque modéré.';
    } else if (score >= 50 && score <= 69) {
      return 'Moyen – Risque potentiel.';
    } else if (score < 50) {
      return 'Faible – Risque élevé ; prêt non recommandé.';
    } else {
      return 'Score invalide.';
    }
  }

  async setClientField(field: string, value: any) {
    if (!this.compute.isNumber(value)) {
      alert('Enter a valid number');
      return;
    }
    try {
      const loA = await this.data.setClientField(
        field,
        value,
        this.client.uid!
      );
      alert('Montant changer avec succès');
    } catch (err) {
      alert("Une erreur s'est produite lors du placement du budget, Réessayez");
      return;
    }
  }

  setFields() {
    if (this.client.savings) {
      this.savings = this.client.savings;
    }
  }
}
