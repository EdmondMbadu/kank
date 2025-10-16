import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LandingPageComponent } from '../components/landing-page/landing-page.component';
import { ForgotPasswordComponent } from '../components/forgot-password/forgot-password.component';
import { CreateAccountComponent } from '../components/create-account/create-account.component';
import { VerifyEmailComponent } from '../components/verify-email/verify-email.component';
import { PublicShellComponent } from './public-shell/public-shell.component';

const routes: Routes = [
  {
    path: '',
    component: PublicShellComponent,
    children: [
      { path: '', component: LandingPageComponent, pathMatch: 'full' },
      { path: 'forgot-password', component: ForgotPasswordComponent },
      { path: 'create-account', component: CreateAccountComponent },
      { path: 'verify-email', component: VerifyEmailComponent },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PublicRoutingModule {}
