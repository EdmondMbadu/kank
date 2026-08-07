import { Client } from '../models/client';

export function isActivelyFollowedClient(
  client: Client | null | undefined
): boolean {
  if (!client) return false;

  const status = String(client.vitalStatus || '').trim().toLowerCase();
  const hasActiveStatus = status === '' || status === 'vivant';
  const debtLeft = Number(client.debtLeft);

  return hasActiveStatus && Number.isFinite(debtLeft) && debtLeft > 0;
}
