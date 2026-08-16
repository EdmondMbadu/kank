import { Client } from '../models/client';
import { coerceToNumber } from './number-utils';

export const BUDGET_EXEMPT_CREDIT_SCORE = 70;

export interface InvalidPendingLoanRequest {
  clientUid: string;
  clientName: string;
  requestAmount: unknown;
}

export interface PendingLoanBudget {
  amount: number;
  invalidRequests: InvalidPendingLoanRequest[];
}

export interface LoanBudgetAvailability extends PendingLoanBudget {
  monthlyBudget: number | null;
  available: number | null;
}

function normalizedValue(value: unknown): string {
  return value?.toString().trim().toLowerCase() ?? '';
}

function clientName(client: Client): string {
  const name = [client.firstName, client.middleName, client.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || 'Client sans nom';
}

export function isPendingLoanRequest(client: Client | null | undefined): boolean {
  return (
    !!client &&
    normalizedValue(client.requestStatus) === 'pending' &&
    normalizedValue(client.requestType) === 'lending'
  );
}

export function isLoanBudgetExempt(client: Client | null | undefined): boolean {
  const creditScore = coerceToNumber(client?.creditScore);
  return creditScore !== null && creditScore >= BUDGET_EXEMPT_CREDIT_SCORE;
}

/**
 * Calculates the amount reserved by active loan requests.
 *
 * Clients with a credit score of 70 or more are deliberately excluded from
 * the team budget. Invalid active requests are reported instead of being
 * silently treated as zero, so callers can fail closed on budget checks.
 */
export function calculatePendingLoanBudget(
  clients: readonly Client[] | null | undefined
): PendingLoanBudget {
  let amount = 0;
  const invalidRequests: InvalidPendingLoanRequest[] = [];

  for (const client of clients ?? []) {
    if (!isPendingLoanRequest(client) || isLoanBudgetExempt(client)) {
      continue;
    }

    const requestAmount = coerceToNumber(client.requestAmount);
    if (requestAmount === null || requestAmount <= 0) {
      invalidRequests.push({
        clientUid: client.uid ?? '',
        clientName: clientName(client),
        requestAmount: client.requestAmount,
      });
      continue;
    }

    amount += requestAmount;
  }

  return { amount, invalidRequests };
}

export function calculateLoanBudgetAvailability(
  monthlyBudgetValue: unknown,
  clients: readonly Client[] | null | undefined
): LoanBudgetAvailability {
  const monthlyBudget = coerceToNumber(monthlyBudgetValue);
  const pending = calculatePendingLoanBudget(clients);

  return {
    ...pending,
    monthlyBudget,
    available: monthlyBudget === null ? null : monthlyBudget - pending.amount,
  };
}

export function loanBudgetContribution(client: Client): number | null {
  if (!isPendingLoanRequest(client) || isLoanBudgetExempt(client)) {
    return 0;
  }

  const requestAmount = coerceToNumber(client.requestAmount);
  return requestAmount !== null && requestAmount > 0 ? requestAmount : null;
}
