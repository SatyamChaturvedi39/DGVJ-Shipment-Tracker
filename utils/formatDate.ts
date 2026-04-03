/**
 * Safely formats a timestamp string for display in status timelines.
 * Returns 'Pending' for missing/invalid timestamps instead of crashing.
 */
export function formatEventDate(timestamp: string | null | undefined): string {
  if (!timestamp) return 'Pending';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return 'Pending';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a completed_at timestamp with full date.
 */
export function formatFullDate(timestamp: string | null | undefined): string {
  if (!timestamp) return '—';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Returns a human-readable ETA string with optional delay warning.
 * e.g. "Arriving in 2 days" or "Delayed" if past ETA and not delivered.
 */
export function formatETA(etaDate: string | null | undefined, etaTime?: string | null): string {
  if (!etaDate) return '—';
  const dateStr = etaTime ? `${etaDate}T${etaTime}:00` : etaDate;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return etaDate;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Returns true if ETA is in the past (shipment may be delayed).
 */
export function isETAPast(etaDate: string | null | undefined): boolean {
  if (!etaDate) return false;
  const d = new Date(etaDate);
  if (isNaN(d.getTime())) return false;
  return d < new Date();
}
