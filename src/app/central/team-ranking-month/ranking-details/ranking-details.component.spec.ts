import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RankingDetailsComponent } from './ranking-details.component';
import { RankingDetailsView } from '../ranking-placement.util';

describe('RankingDetailsComponent', () => {
  let fixture: ComponentFixture<RankingDetailsComponent>;
  let trigger: HTMLButtonElement;
  let previousOverflow: string;
  const view = (): RankingDetailsView => ({
    name: 'Grâce M.', location: 'Bandal', metric: 'Performance habituelle', period: 'juillet 2026',
    loading: false, message: '', summary: {
      ranks: [{ rank: 1, days: 6 }, { rank: 2, days: 4 }, { rank: 3, days: 3 }, { rank: 4, days: 7 }],
      days: 20, topThree: 13, other: 7, unranked: 2, incomplete: 1,
    },
  });
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RankingDetailsComponent] }).compileComponents();
    trigger = document.createElement('button');
    document.body.appendChild(trigger); trigger.focus();
    previousOverflow = document.body.style.overflow;
    fixture = TestBed.createComponent(RankingDetailsComponent);
    fixture.componentInstance.details = view();
    fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); trigger.remove(); });

  it('shows accurate totals, an expandable distribution and clear completeness rules', () => {
    const dialog: HTMLElement = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain('Grâce M.');
    expect(dialog.textContent).toContain('13 / 20 jours');
    expect(dialog.textContent).toContain('4e place');
    expect(dialog.textContent).toContain('journée aux données incomplètes exclue');
    expect(dialog.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('13');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('distinguishes loading and unavailable history from genuine zero wins', () => {
    fixture.componentInstance.details = { ...view(), summary: null, loading: true };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Calcul des places');
    expect(fixture.nativeElement.querySelector('[role="progressbar"]')).toBeNull();
    fixture.componentInstance.details = { ...view(), summary: null, message: 'Cette vue contient les paiements du jour.' };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Historique non chargé');
    expect(fixture.nativeElement.textContent).not.toContain('1re place');
  });

  it('traps focus, closes on Escape and restores the trigger and scrolling on destroy', () => {
    const component = fixture.componentInstance;
    const dismiss = spyOn(component.dismissed, 'emit');
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(document.activeElement).toBe(buttons[0]);
    expect(document.body.style.overflow).toBe('hidden');
    const backwards = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
    component.onKeydown(backwards);
    expect(backwards.defaultPrevented).toBeTrue();
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    component.onKeydown(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe(previousOverflow);
  });

  it('keeps clicks within the dialog open and dismisses via backdrop or close button', () => {
    const dismiss = spyOn(fixture.componentInstance.dismissed, 'emit');
    fixture.nativeElement.querySelector('h2').click();
    expect(dismiss).not.toHaveBeenCalled();
    fixture.nativeElement.querySelector('button').click();
    fixture.nativeElement.firstElementChild.click();
    expect(dismiss).toHaveBeenCalledTimes(2);
  });
});
