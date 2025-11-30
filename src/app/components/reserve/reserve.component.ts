import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/shrink/services/computation.service';
import { DataService } from 'src/app/services/data.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-reserve',
  templateUrl: './reserve.component.html',
  styleUrls: ['./reserve.component.css'],
})
export class ReserveComponent {
  reserveAmount: string = '';
  reserve: string[] = [];
  reserveAmounts: string[] = [];
  reserveDates: string[] = [];
  currentUser: any = {};
  expectedReserve: string = '0';
  clients?: any[] = [];
  clientsWithDebts: any[] = [];
  day: string = new Date().toLocaleString('en-US', { weekday: 'long' });

  // Tooltip helper variables
  showTooltip: boolean = false;
  tooltipMessage: string = '';
  tooltipColor: string = ''; // 'tooltip-red' or 'tooltip-green', etc.
  dailyPercentage: number = 0; // Will store (daily sum / expected) * 100
  isLoading: boolean = false; // Loading state to prevent double submissions

  constructor(
    public auth: AuthService,
    private data: DataService,
    private router: Router,
    private compute: ComputationService,
    private time: TimeService
  ) {}

  ngOnInit() {
    this.getCurrentUserReserve();
    this.auth.getAllClients().subscribe((data: any) => {
      this.clients = data;
      this.findClientsWithDebts();
    });
  }

  /**
   * Called when user clicks the "Ajouter" button to add a reserve amount.
   */
  async addToReserve() {
    // Prevent double submission
    if (this.isLoading) {
      return;
    }

    if (this.reserveAmount === '') {
      alert('Remplissez toutes les données!');
      return;
    } else if (isNaN(Number(this.reserveAmount))) {
      alert('Entrez un nombre valide!');
      return;
    } else {
      let conf = confirm(
        `Vous ajouter dans la reserve ${this.reserveAmount} FC. Voulez-vous continuer ?`
      );
      if (!conf) return;

      // Set loading state
      this.isLoading = true;

      try {
        // 1. Update the user's reserve info
        const userInfo = await this.data.updateUserInfoForAddToReserve(
          this.reserveAmount
        );

        // 2. Update management info (unless in testing mode)
        if (this.auth.currentUser.mode !== 'testing') {
          await this.data.updateManagementInfoForAddToReserve(
            this.reserveAmount
          );
        }

        // 3. Because user$.subscribe will fire again after data changes,
        //    you can let that trigger the tooltip. OR fetch updated user info
        //    immediately. One simple approach is to call getCurrentUserReserve()
        //    again, then show the tooltip:

        // this.getCurrentUserReserve();
        this.showDailyReserveTooltip();
        // Reset loading state since operation is complete
        this.isLoading = false;

        // If you still want to navigate away, do so after the tooltip has shown:
        // setTimeout(() => {
        //   this.router.navigate(['/home']);
        // }, 6000);

        // Or navigate immediately if that's your desired flow:
        // this.router.navigate(['/home']);
      } catch (err: any) {
        alert("Une erreur s'est produite lors de l'initialization, Réessayez");
        console.log('error occurred while entering reserve amount', err);
        this.isLoading = false; // Reset loading state on error
        return;
      } finally {
        // Reset loading state after completion (success or error)
        // Note: We don't reset it here on success because the tooltip will handle navigation
        // But we reset it in the catch block for errors
      }
    }
  }

  /**
   * Grabs the latest user data, sorts the reserve array by date, etc.
   */
  getCurrentUserReserve() {
    this.auth.user$.subscribe((user) => {
      this.currentUser = user;

      this.reserve = this.currentUser.reserve;
      console.log('currentUser reserve', this.currentUser.reserve);

      // Recompute expected
      this.expectedReserve = this.compute
        .computeExpectedPerDate(this.clientsWithDebts)
        .toString();

      // Sort by date descending
      let currentreserve = this.compute.sortArrayByDateDescendingOrder(
        Object.entries(this.currentUser.reserve)
      );
      this.reserveAmounts = currentreserve.map((entry) => entry[1]);
      this.reserveDates = currentreserve.map((entry) =>
        this.time.convertTimeFormat(entry[0])
      );
    });
  }

  /**
   * Find all clients that have debts and are due today,
   * then calculate the new expected reserve for the day.
   */
  findClientsWithDebts() {
    if (this.clients) {
      this.clientsWithDebts = this.data.findClientsWithDebts(this.clients);
    }
    this.clientsWithDebts = this.clientsWithDebts!.filter((c) => {
      return c.paymentDay === this.day && this.data.didClientStartThisWeek(c);
    });
    this.expectedReserve = this.compute
      .computeExpectedPerDate(this.clientsWithDebts)
      .toString();
    console.log('this.expectedReserve', this.expectedReserve);
  }
  /**
   * Sum today's reserve entries and compute daily percentage vs. expectedReserve.
   * Then set a custom French message, color, etc., and show a popup for 6s.
   */
  showDailyReserveTooltip() {
    if (!this.currentUser?.reserve) return;

    const dailySum = this.calculateTodaySum();
    const expected = parseFloat(this.expectedReserve) || 0;
    if (expected === 0) {
      // Possibly set some tooltip message like “0 expected for today”
      // or skip the tooltip but still navigate:
      this.router.navigate(['/today']);
      return;
    }

    this.dailyPercentage = (dailySum / expected) * 100;

    // 1) Build the message in French
    //    We also embed the dailyPercentage with one decimal or no decimal.
    let mainMessage = '';
    if (this.dailyPercentage < 10) {
      mainMessage = 'C’est très faible. Redoublez d’efforts !';
    } else if (this.dailyPercentage < 20) {
      mainMessage = 'Un début, continuez pour augmenter le score !';
    } else if (this.dailyPercentage < 40) {
      mainMessage = 'Pas mal. Poursuivez vos efforts !';
    } else if (this.dailyPercentage < 50) {
      mainMessage = 'Presque à mi-chemin, courage !';
    } else if (this.dailyPercentage < 70) {
      mainMessage = 'Bien joué, continuez comme ça !';
    } else {
      mainMessage = 'Excellent travail, continuez comme ça !';
    }

    // 2) Combine the main message + mention the current day's percentage
    // e.g.: "Vous avez atteint 25% de l'objectif pour aujourd'hui..."
    this.tooltipMessage = `Vous avez atteint ${this.dailyPercentage.toFixed(
      0
    )}% de l’objectif pour aujourd’hui. ${mainMessage}`;

    // 3) Color code (just picking a class name)
    this.tooltipColor =
      this.dailyPercentage < 50 ? 'tooltip-red' : 'tooltip-green';

    // 4) Show the popup
    this.showTooltip = true;

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      this.showTooltip = false;
      this.router.navigate(['/today']);
    }, 10000);
  }

  /**
   * Helper to sum the amounts for today's entries in the "reserve" object.
   */
  calculateTodaySum(): number {
    let dailySum = 0;
    const todayKey = this.getDateKey(new Date()); // e.g. "3-25-2025"
    const allReserveKeys = Object.keys(
      this.currentUser.dailyReimbursement || {}
    );
    for (let key of allReserveKeys) {
      const splitted = key.split('-'); // "MM-DD-YYYY-HH-mm-ss"
      const dayKey = `${splitted[0]}-${splitted[1]}-${splitted[2]}`;
      if (dayKey === todayKey) {
        dailySum += Number(this.currentUser.dailyReimbursement[key]);
      }
    }
    return dailySum;
  }

  getDateKey(d: Date): string {
    // e.g. "3-25-2025"
    return `${d.getMonth() + 1}-${d.getDate()}-${d.getFullYear()}`;
  }

  closeTooltip() {
    this.showTooltip = false;
    this.router.navigate(['/today']);
  }
}
