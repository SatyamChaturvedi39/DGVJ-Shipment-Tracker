/**
 * Normalizes a timestamp string so Android's JavaScript engine can parse it.
 * Supabase may return "2026-04-03T15:30:00+00:00", "2026-04-03 15:30:00+00",
 * or "2026-04-03T15:30:00" (no tz). Android is stricter than desktop browsers.
 */
function normalize(ts: string): string {
  // Replace space separator with T (e.g. "2026-04-03 15:30:00" → "2026-04-03T15:30:00")
  let s = ts.replace(' ', 'T');
  // If no timezone info at all, append Z (UTC)
  if (!s.includes('+') && !s.includes('-', 10) && !s.endsWith('Z')) {
    s = s + 'Z';
  }
  return s;
}

function safeParse(timestamp: string | null | undefined): Date | null {
  if (!timestamp) return null;
  const d = new Date(normalize(timestamp));
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Formats a timestamp for status timeline items.
 * Returns 'Pending' for missing/invalid timestamps.
 */
export function formatEventDate(timestamp: string | null | undefined): string {
  const d = safeParse(timestamp);
  if (!d) return 'Pending';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formats a completed_at timestamp with full date and time.
 */
export function formatFullDate(timestamp: string | null | undefined): string {
  const d = safeParse(timestamp);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Returns a human-readable ETA string, e.g. "1 May 2026".
 */
export function formatETA(etaDate: string | null | undefined, etaTime?: string | null): string {
  if (!etaDate) return '—';
  const dateStr = etaTime ? `${etaDate}T${etaTime}:00Z` : `${etaDate}T00:00:00Z`;
  const d = safeParse(dateStr);
  if (!d) return etaDate; // fallback to raw string
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Returns true if ETA date is in the past (shipment may be delayed).
 */
export function isETAPast(etaDate: string | null | undefined): boolean {
  if (!etaDate) return false;
  const d = safeParse(`${etaDate}T00:00:00Z`);
  if (!d) return false;
  return d < new Date();
}
