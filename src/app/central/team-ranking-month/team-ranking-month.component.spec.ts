import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TeamRankingMonthComponent } from './team-ranking-month.component';

describe('TeamRankingMonthComponent', () => {
  let component: TeamRankingMonthComponent;
  let fixture: ComponentFixture<TeamRankingMonthComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TeamRankingMonthComponent]
    });
    fixture = TestBed.createComponent(TeamRankingMonthComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
