import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { ComputationService } from 'src/app/services/computation.service';
import { TimeService } from 'src/app/services/time.service';

@Component({
  selector: 'app-tutorial',
  templateUrl: './tutorial.component.html',
  styleUrls: ['./tutorial.component.css'],
})
export class TutorialComponent {
  showFirst: boolean = false;
  system: boolean = false;
  payment: boolean = false;
  role: boolean = false;
  performance: boolean = false;
  constructor(
    private router: Router,
    public auth: AuthService,
    private time: TimeService,
    private compute: ComputationService
  ) {}

  // Generic toggle method
  toggle(property: 'system' | 'payment' | 'role' | 'performance') {
    this[property] = !this[property];
  }
}
