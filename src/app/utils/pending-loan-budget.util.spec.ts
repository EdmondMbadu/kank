import { Client } from '../models/client';
import {
  calculateLoanBudgetAvailability,
  calculatePendingLoanBudget,
  isLoanBudgetExempt,
  loanBudgetContribution,
} from './pending-loan-budget.util';

function client(fields: Partial<Client>): Client {
  return Object.assign(new Client(), fields);
}

describe('pending loan budget', () => {
  it('sums verified and unverified pending lending requests', () => {
    const result = calculatePendingLoanBudget([
      client({
        uid: 'unverified',
        requestStatus: 'pending',
        requestType: 'lending',
        requestAmount: '100000',
        creditScore: '50',
        agentSubmittedVerification: '',
      }),
      client({
        uid: 'verified',
        requestStatus: 'pending',
        requestType: 'lending',
        requestAmount: '250,000 FC',
        creditScore: '69',
        agentSubmittedVerification: 'true',
      }),
    ]);

    expect(result.amount).toBe(350000);
    expect(result.invalidRequests).toEqual([]);
  });

  it('keeps clients with score 70 or higher outside the budget', () => {
    const score70 = client({
      requestStatus: 'pending',
      requestType: 'lending',
      requestAmount: '900000',
      creditScore: '70',
    });
    const score85 = client({
      requestStatus: 'pending',
      requestType: 'lending',
      requestAmount: '500000',
      creditScore: '85',
    });

    expect(isLoanBudgetExempt(score70)).toBeTrue();
    expect(isLoanBudgetExempt(score85)).toBeTrue();
    expect(calculatePendingLoanBudget([score70, score85]).amount).toBe(0);
    expect(loanBudgetContribution(score70)).toBe(0);
  });

  it('excludes non-lending and completed requests', () => {
    const result = calculatePendingLoanBudget([
      client({
        requestStatus: 'pending',
        requestType: 'savings',
        requestAmount: '100000',
        creditScore: '50',
      }),
      client({
        requestStatus: 'pending',
        requestType: 'rejection',
        requestAmount: '100000',
        creditScore: '50',
      }),
      client({
        requestStatus: '',
        requestType: '',
        requestAmount: '',
        creditScore: '50',
      }),
    ]);

    expect(result.amount).toBe(0);
    expect(result.invalidRequests).toEqual([]);
  });

  it('reports an invalid active request instead of hiding it as zero', () => {
    const invalid = client({
      uid: 'broken-client',
      firstName: 'Jean',
      lastName: 'Mbuyi',
      requestStatus: 'pending',
      requestType: 'lending',
      requestAmount: 'NaN',
      creditScore: '50',
    });

    const result = calculatePendingLoanBudget([invalid]);

    expect(result.amount).toBe(0);
    expect(result.invalidRequests).toEqual([
      jasmine.objectContaining({
        clientUid: 'broken-client',
        clientName: 'Jean Mbuyi',
        requestAmount: 'NaN',
      }),
    ]);
    expect(loanBudgetContribution(invalid)).toBeNull();
  });

  it('does not exempt a client whose credit score is missing or invalid', () => {
    const missingScore = client({
      requestStatus: 'pending',
      requestType: 'lending',
      requestAmount: '75000',
      creditScore: '',
    });

    expect(isLoanBudgetExempt(missingScore)).toBeFalse();
    expect(calculatePendingLoanBudget([missingScore]).amount).toBe(75000);
  });

  it('derives the available budget without trusting the stored pending total', () => {
    const pendingClient = client({
      requestStatus: 'pending',
      requestType: 'lending',
      requestAmount: '200000',
      creditScore: '55',
    });

    const result = calculateLoanBudgetAvailability('1000000', [pendingClient]);

    expect(result.monthlyBudget).toBe(1000000);
    expect(result.amount).toBe(200000);
    expect(result.available).toBe(800000);
  });

  it('marks a corrupt monthly budget as unavailable', () => {
    const result = calculateLoanBudgetAvailability('NaN', []);

    expect(result.monthlyBudget).toBeNull();
    expect(result.available).toBeNull();
  });
});
