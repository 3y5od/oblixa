/**
 * Minimal 5-field cron matcher (UTC): minute hour day-of-month month day-of-week.
 * Supports *, single integers, and comma-separated lists (OR). Unknown patterns default to match.
 */
function matchNumField(spec: string, value: number): boolean {
  const s = spec.trim();
  if (s === "*") return true;
  if (s.includes(",")) {
    return s.split(",").some((part) => matchNumField(part.trim(), value));
  }
  if (/^\d+$/.test(s)) return Number(s) === value;
  return true;
}

/** day-of-week: 0-6 Sun-Sat, also accepts 7 as Sunday */
function matchDow(spec: string, jsDow: number): boolean {
  const s = spec.trim();
  if (s === "*") return true;
  if (s.includes(",")) {
    return s.split(",").some((part) => matchDow(part.trim(), jsDow));
  }
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    const normalized = n === 7 ? 0 : n;
    return normalized === jsDow;
  }
  return true;
}

export function cronMatchesUtc(expression: string | null | undefined, date: Date): boolean {
  if (!expression?.trim()) return true;
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return true;
  const [minS, hourS, domS, monthS, dowS] = parts;
  return (
    matchNumField(minS, date.getUTCMinutes()) &&
    matchNumField(hourS, date.getUTCHours()) &&
    matchNumField(domS, date.getUTCDate()) &&
    matchNumField(monthS, date.getUTCMonth() + 1) &&
    matchDow(dowS, date.getUTCDay())
  );
}
