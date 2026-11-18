// WAT (UTC+1, no DST) is Chever's shared day, regardless of the device's zone.
const DAY_MS = 86_400_000;
const WAT_MS = 3_600_000;
export const lagosDay = (ms = Date.now()) => new Date(ms + WAT_MS).toISOString().slice(0, 10);
export const msUntilLagosMidnight = (ms = Date.now()) => DAY_MS - ((ms + WAT_MS) % DAY_MS + DAY_MS) % DAY_MS;
export function verseForDay(list, day) {
  const start = Date.parse(day + 'T00:00:00Z');
  if (!Number.isFinite(start) || new Date(start).toISOString().slice(0, 10) !== day || !list.length) return null;
  const n = start / DAY_MS;
  return list[((n % list.length) + list.length) % list.length] || null;
}
