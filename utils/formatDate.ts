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
 * Returns a human-readable ETA string, e.g. "1 May 2026  ·  2:30 PM".
 * Uses noon UTC when no time is given to avoid date-shift due to timezone offset.
 */
export function formatETA(etaDate: string | null | undefined, etaTime?: string | null): string {
  if (!etaDate) return '—';
  // Use noon UTC so the date stays correct across timezones (avoids midnight rollover)
  const hasTime = etaTime && etaTime.trim().length > 0;
  const dateStr = hasTime ? `${etaDate}T${etaTime}:00` : `${etaDate}T12:00:00Z`;
  const d = safeParse(dateStr);
  if (!d) {
    // Last-resort: parse just the date part manually to avoid any timezone weirdness
    const parts = etaDate.split('-');
    if (parts.length === 3) {
      const yr = parseInt(parts[0], 10);
      const mo = parseInt(parts[1], 10) - 1;
      const dy = parseInt(parts[2], 10);
      const fallback = new Date(yr, mo, dy, 12, 0, 0);
      if (!isNaN(fallback.getTime())) {
        return fallback.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    }
    return etaDate;
  }
  const datePart = d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (hasTime) {
    const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `${datePart}  ·  ${timePart}`;
  }
  return datePart;
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
