import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmployeePaymentDialogComponent } from './employee-payment-dialog.component';
import { buildEmployeePaymentSummary } from './employee-payment-summary';
import { paymentFixture } from '../../../../test/fixtures/employee-payment';
import { buildEmployeeBonusSummary } from './employee-bonus-summary';
import { bonusFixture } from '../../../../test/fixtures/employee-bonus';

describe('EmployeePaymentDialogComponent', () => {
  let fixture: ComponentFixture<EmployeePaymentDialogComponent>;
  let element: HTMLElement;
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EmployeePaymentDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(EmployeePaymentDialogComponent);
    fixture.componentRef.setInput('summary', buildEmployeePaymentSummary(paymentFixture()));
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('initially collapses details and clearly separates actual pay, hypothetical pay, and confirmation', () => {
    expect(text(element.querySelector('[data-testid="actual-payment"]'))).toBe('89 $');
    expect(text(element.querySelector('[data-testid="potential-payment"]'))).toContain('Vous auriez reçu');
    expect(text(element.querySelector('.potential-value strong'))).toBe('118 $');
    expect(text(element.querySelector('.confirm-button'))).toBe('Confirmer 89 $');
    expect(element.querySelector('.details-toggle')?.getAttribute('aria-expanded')).toBe('false');
    expect((element.querySelector('.payment-details') as HTMLElement).hidden).toBeTrue();
  });

  it('opens the salary and actual weekly breakdown, then closes it again', () => {
    const toggle = element.querySelector('.details-toggle') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(text(toggle)).toBe('Masquer le détail');
    expect((element.querySelector('.payment-details') as HTMLElement).hidden).toBeFalse();
    expect(element.querySelectorAll('.income-list .detail-row').length).toBe(3);
    expect(element.querySelectorAll('.weekly-details tbody tr').length).toBe(3);
    expect(text(element.querySelector('.weekly-details'))).toContain('900 000 FC');
    toggle.click();
    fixture.detectChanges();
    expect((element.querySelector('.payment-details') as HTMLElement).hidden).toBeTrue();
  });

  it('renders the no-deduction state with just the three income components when expanded', () => {
    fixture.componentRef.setInput('summary', buildEmployeePaymentSummary(paymentFixture({ net: 118, late: 0, objectiveDeduction: 0, weeks: [] })));
    fixture.detectChanges();
    expect(text(element.querySelector('[data-testid="actual-payment"]'))).toBe('118 $');
    expect(text(element.querySelector('[data-testid="no-deductions"]'))).toBe('Aucune retenue');
    expect(element.querySelector('[data-testid="potential-payment"]')).toBeNull();
    expect(element.querySelector('.deduction-list')).toBeNull();
    (element.querySelector('.details-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelectorAll('.payment-details .detail-row').length).toBe(3);
    expect(element.querySelector('.weekly-details')).toBeNull();
    expect(text(element.querySelector('.confirm-button'))).toBe('Confirmer 118 $');
  });

  it('keeps the administration note visible before the employee opens details', () => {
    fixture.componentRef.setInput('summary', buildEmployeePaymentSummary(paymentFixture({ note: 'Merci de vérifier avant signature.' })));
    fixture.detectChanges();
    expect(text(element.querySelector('.payment-note'))).toContain('Merci de vérifier avant signature.');
    expect(element.querySelector('.payment-details .payment-note')).toBeNull();
  });

  it('shows the bonus amount with collapsed details and no payroll deduction language', () => {
    fixture.componentRef.setInput('summary', buildEmployeeBonusSummary(bonusFixture()));
    fixture.detectChanges();
    expect(text(element.querySelector('h2'))).toBe('Votre bonus');
    expect(text(element.querySelector('#employee-bonus-period'))).toBe('Edmond Mbadu · août 2026');
    expect(text(element.querySelector('.payment-actual p'))).toBe('Bonus à recevoir');
    expect(text(element.querySelector('.payment-amount'))).toBe('70 $');
    expect(text(element.querySelector('.confirm-button'))).toBe('Confirmer 70 $');
    expect(element.querySelector('.deduction-list, .no-deductions, .payment-potential, .attendance-details, .weekly-details')).toBeNull();
    expect(element.querySelector('[role="dialog"]')?.getAttribute('aria-labelledby')).toBe('employee-bonus-title');
    expect(element.querySelector('.icon-button')?.getAttribute('aria-label')).toBe('Fermer le bonus');
    expect(element.querySelector('.details-toggle')?.getAttribute('aria-controls')).toBe('employee-bonus-details');
    expect((element.querySelector('#employee-bonus-details') as HTMLElement).hidden).toBeTrue();
  });

  it('expands only awarded bonus components, preserving the performance percentage and cents', () => {
    fixture.componentRef.setInput('summary', buildEmployeeBonusSummary(bonusFixture({
      net: 140.5, performance: 30.5, percentage: 92.5, employeeAward: 20, manager: 20,
    })));
    fixture.detectChanges();
    const toggle = element.querySelector('.details-toggle') as HTMLButtonElement;
    toggle.click();
    fixture.detectChanges();
    expect((element.querySelector('#employee-bonus-details') as HTMLElement).hidden).toBeFalse();
    const rows = () => Array.from(element.querySelectorAll('.detail-row')).map(row => [text(row.querySelector('dt')), text(row.querySelector('dd'))]);
    expect(rows()).toEqual([
      ['Performance · 92,5 %', '30,5 $'], ['Meilleure équipe', '70 $'], ['Meilleur employé', '20 $'], ['Meilleur manager', '20 $'],
    ]);
    expect(text(element.querySelector('.confirm-button'))).toBe('Confirmer 140,5 $');
    fixture.componentRef.setInput('summary', buildEmployeeBonusSummary(bonusFixture()));
    fixture.detectChanges();
    expect(rows()).toEqual([['Meilleure équipe', '70 $']]);
    toggle.click();
    fixture.detectChanges();
    expect((element.querySelector('#employee-bonus-details') as HTMLElement).hidden).toBeTrue();
  });

  it('shows an awarded performance amount even without a percentage and explains an empty bonus', () => {
    fixture.componentRef.setInput('summary', buildEmployeeBonusSummary(bonusFixture({ net: 25, performance: 25, team: 0 })));
    fixture.detectChanges();
    (element.querySelector('.details-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(text(element.querySelector('.detail-row dt'))).toBe('Performance');
    expect(text(element.querySelector('.detail-row dd'))).toBe('25 $');
    fixture.componentRef.setInput('summary', buildEmployeeBonusSummary(bonusFixture({ net: 0, team: 0, percentage: 80 })));
    fixture.detectChanges();
    expect(element.querySelector('.detail-row')).toBeNull();
    expect(text(element.querySelector('#employee-bonus-details'))).toBe('Aucun bonus ce mois-ci.');
    expect(text(element.querySelector('.confirm-button'))).toBe('Confirmer 0 $');
  });

  it('keeps the bonus note outside collapsed details and prevents repeated confirmation while busy', () => {
    fixture.componentRef.setInput('summary', buildEmployeeBonusSummary(bonusFixture({ note: ' Merci pour votre travail. ' })));
    fixture.detectChanges();
    expect(text(element.querySelector('.payment-note p'))).toBe('Merci pour votre travail.');
    expect(element.querySelector('#employee-bonus-details .payment-note')).toBeNull();
    const confirm = spyOn(fixture.componentInstance.confirmed, 'emit');
    const dismiss = spyOn(fixture.componentInstance.dismissed, 'emit');
    (element.querySelector('.confirm-button') as HTMLButtonElement).click();
    expect(confirm).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    expect(text(element.querySelector('.confirm-button'))).toBe('Confirmation…');
    expect(element.querySelector('[role="dialog"]')?.getAttribute('aria-busy')).toBe('true');
    for (const selector of ['.confirm-button', '.cancel-button', '.icon-button']) {
      const button = element.querySelector(selector) as HTMLButtonElement;
      expect(button.disabled).toBeTrue();
      button.click();
    }
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(dismiss).not.toHaveBeenCalled();
  });

  it('emits the existing actions and disables them during confirmation', () => {
    const confirm = spyOn(fixture.componentInstance.confirmed, 'emit');
    const dismiss = spyOn(fixture.componentInstance.dismissed, 'emit');
    (element.querySelector('.confirm-button') as HTMLButtonElement).click();
    (element.querySelector('.cancel-button') as HTMLButtonElement).click();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledTimes(1);
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    expect((element.querySelector('.confirm-button') as HTMLButtonElement).disabled).toBeTrue();
    fixture.componentInstance.confirm();
    fixture.componentInstance.dismiss();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('supports Escape and traps keyboard focus within the dialog', () => {
    const dismiss = spyOn(fixture.componentInstance.dismissed, 'emit');
    const close = element.querySelector('.icon-button') as HTMLButtonElement;
    const confirm = element.querySelector('.confirm-button') as HTMLButtonElement;
    expect(document.activeElement).toBe(close);
    confirm.focus();
    confirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(close);
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(confirm);
    confirm.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('restores the opening button and page scrolling when the dialog is removed', () => {
    fixture.destroy();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const originalOverflow = document.body.style.overflow;
    fixture = TestBed.createComponent(EmployeePaymentDialogComponent);
    fixture.componentRef.setInput('summary', buildEmployeePaymentSummary(paymentFixture()));
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');
    fixture.destroy();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe(originalOverflow);
    trigger.remove();
  });
});
