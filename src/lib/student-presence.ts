export type PresenceAlertLevel = 'WARDEN_2H' | 'PARENT_4H';

export function getPresenceAlertLevels(
  status: 'INSIDE' | 'OUTSIDE',
  statusSince: string | null,
  now: string,
): PresenceAlertLevel[] {
  if (status !== 'OUTSIDE' || !statusSince) return [];

  const elapsed = Date.parse(now) - Date.parse(statusSince);
  if (!Number.isFinite(elapsed) || elapsed <= 2 * 60 * 60 * 1000) return [];

  return elapsed > 4 * 60 * 60 * 1000
    ? ['WARDEN_2H', 'PARENT_4H']
    : ['WARDEN_2H'];
}