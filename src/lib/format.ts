// Shared display formatters (Swiss German conventions).

const LOCALE = 'de-CH';

function parseDate(d: string) {
  return new Date(d + 'T00:00:00');
}

export function fmtDate(d: string) {
  return parseDate(d).toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** "Sa, 03.02.2026" */
export function fmtDateWithWeekday(d: string) {
  const date = parseDate(d);
  const weekday = date.toLocaleDateString(LOCALE, { weekday: 'short' });
  return `${weekday}, ${fmtDate(d)}`;
}

/** "03.02." — compact label for prev/next navigation */
export function fmtDateShort(d: string) {
  return parseDate(d).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit' });
}

export function fmtDateRange(dates: string[]): string {
  const sorted = [...dates].sort();
  if (sorted.length === 0) return '';
  if (sorted[0] === sorted[sorted.length - 1]) return fmtDate(sorted[0]);
  return `${fmtDate(sorted[0])} – ${fmtDate(sorted[sorted.length - 1])}`;
}

export function fmtNumber(n: number) {
  return Math.round(n).toLocaleString(LOCALE);
}

export function fmtDuration(sec: number | null) {
  if (sec == null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function fmtDistance(m: number | null) {
  if (m == null) return '—';
  const km = m / 1000;
  return km >= 1000 ? `${fmtNumber(km)} km` : `${km.toFixed(1)} km`;
}

export function fmtElevation(m: number | null) {
  if (m == null) return '—';
  return `${fmtNumber(m)} m`;
}

export function fmtTemp(t: number | null) {
  if (t == null) return '—';
  return t.toFixed(1) + ' °C';
}
