import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFireFunctionsModule } from '@angular/fire/compat/functions';
import { AngularFirestoreModule } from '@angular/fire/compat/firestore';
import { AngularFireStorageModule } from '@angular/fire/compat/storage';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PlotlyModule } from 'angular-plotly.js';
import { RotationScheduleComponent } from '../components/rotation-schedule/rotation-schedule.component';
import { SharedModule } from '../shared/shared.module';
import { CentralRoutingModule } from './central-routing.module';
import { HomeCentralComponent } from './home-central/home-central.component';
import { SummaryCardCentralComponent } from './summary-card-central/summary-card-central.component';
import { TeamRankingMonthComponent } from './team-ranking-month/team-ranking-month.component';
import { TodayCardCentralComponent } from './today-card-central/today-card-central.component';
import { TodayCentralComponent } from './today-central/today-central.component';
import { TrackingCardMonthCentralComponent } from './tracking-card-month-central/tracking-card-month-central.component';
import { TrackingCentralComponent } from './tracking-central/tracking-central.component';
import { TrackingMonthCentralComponent } from './tracking-month-central/tracking-month-central.component';

@NgModule({
  declarations: [
    HomeCentralComponent,
    TrackingCentralComponent,
    TodayCentralComponent,
    TrackingMonthCentralComponent,
    TodayCardCentralComponent,
    TrackingCardMonthCentralComponent,
    SummaryCardCentralComponent,
    TeamRankingMonthComponent,
    RotationScheduleComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AngularFirestoreModule,
    AngularFireAuthModule,
    AngularFireStorageModule,
    AngularFireFunctionsModule,
    PlotlyModule,
    SharedModule,
    CentralRoutingModule,
  ],
})
export class CentralModule {}
