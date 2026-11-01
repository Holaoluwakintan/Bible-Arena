// v3.12.0: how a guest's progress joins a signed-in (Google) player's record when they sign in.
// Rule: never lower anything the account already has. Counters add up, records (bests, highest levels, stars) keep the
// higher value, per-level maps (story, st3) are a union with the higher value per level. Never produces NaN/null.
// (Before 3.12.0 every key was added as a number, so object keys like stats.st3 (story stars) became NaN -> null and a
// player's whole story map was wiped if the guest had played any story level before signing in.)

/** Keys whose value is a record (keep the higher), not a counter (add). */
const MAX_KEYS = new Set(["bestCombo", "endless", "streakSaves", "lastWeekly"]);
const isMaxKey = (k: string) => MAX_KEYS.has(k) || /best|max|high|level/i.test(k);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Per-key union of two maps; numbers keep the higher value, nested objects merge the same way. */
export function unionMax(a: unknown, b: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = isObj(a) ? { ...a } : {};
  if (!isObj(b)) return out;
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    if (cur == null) { if (v != null) out[k] = v; continue; }
    const x = num(cur), y = num(v);
    if (x != null && y != null) out[k] = Math.max(x, y);
    else if (isObj(cur) && isObj(v)) out[k] = unionMax(cur, v);
  }
  return out;
}

/** Daily story energy {d: day, u: used, a: ads}: keep the newer day; on the same day keep the higher use (never hand out extra tries). */
function mergeEnergy(a: unknown, b: unknown): unknown {
  if (!isObj(a)) return isObj(b) ? b : a;
  if (!isObj(b)) return a;
  const da = String(a.d || ""), db = String(b.d || "");
  if (da !== db) return da > db ? a : b;
  return { d: da, u: Math.max(num(a.u) || 0, num(b.u) || 0), a: Math.max(num(a.a) || 0, num(b.a) || 0) };
}

/** Merge a guest's players.stats into the account's players.stats (pure; inputs untouched). */
export function mergeStats(target: unknown, guest: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = isObj(target) ? { ...target } : {};
  if (!isObj(guest)) return out;
  for (const [k, g] of Object.entries(guest)) {
    if (g == null) continue;
    const t = out[k];
    if (t == null) { out[k] = g; continue; } // the account had nothing here (or a value an old merge broke): take the guest's
    if (k === "st3e") { out[k] = mergeEnergy(t, g); continue; }
    if (k === "streakSaves") { out[k] = Math.min(2, Math.max(num(t) || 0, num(g) || 0)); continue; }
    const x = num(t), y = num(g);
    if (x != null && y != null) { out[k] = isMaxKey(k) ? Math.max(x, y) : x + y; continue; }
    if (isObj(t) && isObj(g)) { out[k] = unionMax(t, g); continue; }
    if (Array.isArray(t) && Array.isArray(g)) { out[k] = Array.from(new Set([...t, ...g])); continue; }
    // strings/booleans/mismatched types: keep the account's value
  }
  return out;
}

export interface PlayerRowLike { name?: string | null; church?: string | null; xp?: number; streak?: number; best_streak?: number; last_day?: unknown; rounds?: number; achievements?: unknown; stats?: unknown }
const dayStr = (v: unknown) => (v == null || v === "" ? null : (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10));
const DEFAULT_NAMES = new Set(["", "player", "guest player"]);

/** The account row after a guest joins it. XP and rounds add (each round was really played once); streak follows the more recent day. */
export function mergePlayerRows(t: PlayerRowLike, g: PlayerRowLike) {
  const td = dayStr(t.last_day), gd = dayStr(g.last_day);
  const newer = gd && (!td || gd > td) ? "g" : "t";
  const streak = td && gd && td === gd ? Math.max(Number(t.streak) || 0, Number(g.streak) || 0) : newer === "g" ? Number(g.streak) || 0 : Number(t.streak) || 0;
  const tn = String(t.name || "").trim();
  return {
    xp: (Number(t.xp) || 0) + (Number(g.xp) || 0),
    rounds: (Number(t.rounds) || 0) + (Number(g.rounds) || 0),
    best_streak: Math.max(Number(t.best_streak) || 0, Number(g.best_streak) || 0, streak),
    streak,
    last_day: newer === "g" ? gd : td,
    stats: mergeStats(t.stats, g.stats),
    achievements: Array.from(new Set([...(Array.isArray(t.achievements) ? t.achievements : []), ...(Array.isArray(g.achievements) ? g.achievements : [])])),
    name: DEFAULT_NAMES.has(tn.toLowerCase()) && g.name && !DEFAULT_NAMES.has(String(g.name).trim().toLowerCase()) ? String(g.name) : (t.name ?? g.name ?? "Player"),
    church: t.church && String(t.church).trim() ? t.church : (g.church && String(g.church).trim() ? g.church : t.church ?? null),
  };
}
