// One Hall of Fame XP ladder for the v3 dashboard and ranked server.
export const RANKS = [
  { name: 'Seeker', xp: 0 }, { name: 'Disciple', xp: 2500 }, { name: 'Servant', xp: 7500 }, { name: 'Watchman', xp: 18000 },
  { name: 'Scribe', xp: 38000 }, { name: 'Teacher', xp: 75000 }, { name: 'Elder', xp: 135000 }, { name: 'Prophet', xp: 225000 },
  { name: 'Theologian', xp: 360000 }, { name: 'Apostle', xp: 500000 },
];
export function rankOf(value) {
  const n = Number(value), xp = Number.isFinite(n) ? Math.max(0, n) : 0;
  let index = 0;
  while (index + 1 < RANKS.length && xp >= RANKS[index + 1].xp) index++;
  const rank = RANKS[index], next = RANKS[index + 1];
  const progress = next ? (xp - rank.xp) / (next.xp - rank.xp) : 1;
  return { index, name: rank.name, next: next?.name ?? null, nextXp: next?.xp ?? null, progress, division: ['I', 'II', 'III'][Math.min(2, Math.floor(progress * 3))] };
}
