import { Employee } from 'src/app/models/employee';

function normalizeRole(role?: string | null): string {
  return (role ?? '').trim().toLowerCase();
}

export function selectWinnerTeamMembers(employees: Employee[]): Employee[] {
  const manager = employees.find(
    (employee) => normalizeRole(employee.role) === 'manager'
  );
  const marketingAgent = employees.find(
    (employee) => normalizeRole(employee.role) === 'agent marketing'
  );

  return [manager, marketingAgent].filter(
    (employee): employee is Employee => !!employee
  );
}
