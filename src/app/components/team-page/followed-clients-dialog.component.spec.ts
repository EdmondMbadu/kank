import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { FollowedClientsDialogComponent, FollowedClientRow } from './followed-clients-dialog.component';

@Component({ template: '' })
class PortalStubComponent {}

describe('FollowedClientsDialogComponent', () => {
  let fixture: ComponentFixture<FollowedClientsDialogComponent>;
  let previousOverflow: string;

  beforeEach(async () => {
    previousOverflow = document.body.style.overflow;
    await TestBed.configureTestingModule({
      imports: [FollowedClientsDialogComponent, RouterTestingModule.withRoutes([
        { path: 'client-portal/:id', component: PortalStubComponent },
      ])],
      declarations: [PortalStubComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(FollowedClientsDialogComponent);
  });

  afterEach(() => {
    fixture.destroy();
    expect(document.body.style.overflow).toBe(previousOverflow);
  });

  function open(rows: FollowedClientRow[]) {
    fixture.componentRef.setInput('employeeName', 'Edmond Mbadu');
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();
  }

  const row = (uid: string): FollowedClientRow => ({
    uid, name: `Client ${uid}`, debt: '125 000 FC', phone: '082 111 2233',
  });

  it('uses the stable client id when a row navigates to the portal', async () => {
    open([row('stable-client-id')]);
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/client-portal/stable-client-id');
    link.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/client-portal/stable-client-id');
  });

  it('bounds the initial DOM for long lists and adds more rows only on request', () => {
    open(Array.from({ length: 120 }, (_, i) => row(String(i))));
    expect(fixture.nativeElement.querySelectorAll('a').length).toBe(50);
    const more = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((button) => (button as HTMLButtonElement).textContent?.includes('Afficher plus')) as HTMLButtonElement;
    more.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('a').length).toBe(100);
  });

  it('handles an empty list and requests dismissal on Escape', () => {
    open([]);
    expect(fixture.nativeElement.textContent).toContain('Aucun client suivi');
    const dismissed = spyOn(fixture.componentInstance.dismissed, 'emit');
    const cancel = new Event('cancel', { cancelable: true });
    fixture.nativeElement.querySelector('dialog').dispatchEvent(cancel);
    expect(dismissed).toHaveBeenCalledTimes(1);
    expect(cancel.defaultPrevented).toBeTrue();
  });
});
