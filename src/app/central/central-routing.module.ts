import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '../services/auth.guard';
import { HomeCentralComponent } from './home-central/home-central.component';
import { SummaryCardCentralComponent } from './summary-card-central/summary-card-central.component';
import { TeamRankingMonthComponent } from './team-ranking-month/team-ranking-month.component';
import { TodayCardCentralComponent } from './today-card-central/today-card-central.component';
import { TodayCentralComponent } from './today-central/today-central.component';
import { TrackingCardMonthCentralComponent } from './tracking-card-month-central/tracking-card-month-central.component';
import { TrackingCentralComponent } from './tracking-central/tracking-central.component';
import { TrackingMonthCentralComponent } from './tracking-month-central/tracking-month-central.component';

const routes: Routes = [
  {
    path: 'home-central',
    component: HomeCentralComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'tracking-central',
    component: TrackingCentralComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'tracking-month-central',
    component: TrackingMonthCentralComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'tracking-card-month-central',
    component: TrackingCardMonthCentralComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'today-central',
    component: TodayCentralComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'today-card-central',
    component: TodayCardCentralComponent,
    canActivate: [AuthGuard],
  },
  {
    path: 'summary-card-central',
    component: SummaryCardCentralComponent,
  },
  {
    path: 'team-ranking-month',
    component: TeamRankingMonthComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CentralRoutingModule {}
