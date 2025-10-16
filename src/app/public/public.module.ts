import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PublicRoutingModule } from './public-routing.module';
import { LandingPageComponent } from '../components/landing-page/landing-page.component';
import { ForgotPasswordComponent } from '../components/forgot-password/forgot-password.component';
import { CreateAccountComponent } from '../components/create-account/create-account.component';
import { VerifyEmailComponent } from '../components/verify-email/verify-email.component';
import { PublicShellComponent } from './public-shell/public-shell.component';

@NgModule({
  declarations: [
    PublicShellComponent,
    LandingPageComponent,
    ForgotPasswordComponent,
    CreateAccountComponent,
    VerifyEmailComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    PublicRoutingModule,
  ],
})
export class PublicModule {}
