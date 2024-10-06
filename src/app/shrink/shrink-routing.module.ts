import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EmployeePageComponent } from './employee-page/employee-page.component';

const routes: Routes = [
  // { path: ':', component: EmployeePageComponent }, // Handling the ':id' parameter
  { path: ':id', component: EmployeePageComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ShrinkRoutingModule {}
