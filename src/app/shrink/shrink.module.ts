import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ShrinkRoutingModule } from './shrink-routing.module';
import { ShrinkComponent } from './shrink.component';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { FormsModule } from '@angular/forms';
import { PlotlyModule } from 'angular-plotly.js';
import { EmployeePageComponent } from './employee-page/employee-page.component';
import { SharedModule } from '../shared/shared.module';
import { TeamPageComponent } from '../components/team-page/team-page.component';

@NgModule({
  declarations: [ShrinkComponent, EmployeePageComponent],
  imports: [
    CommonModule,
    SharedModule,
    FormsModule,
    PlotlyModule,
    ShrinkRoutingModule,
  ],
})
export class ShrinkModule {}
