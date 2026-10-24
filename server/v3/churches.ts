// Bible Arena v3: Church League. Churches, fellowships and campus groups make a team with an invite code/link;
// members' round points roll up to a weekly league (Monday 00:00 Lagos time to the next Monday) and an all-time board.
// Last week's top church is recorded once as the weekly champion (badge + title count).
//
// Storage: the team registry and memberships live in the server's own SQLite database (tables v3_churches,
// v3_church_members, v3_church_wins, created here with CREATE TABLE IF NOT EXISTS), which server/persist.ts snapshots
// to Postgres (bible_arena.sqlite_snapshots); every church write also asks for an immediate snapshot. Points are read
// from Postgres bible_arena.rounds, so no Postgres schema change is needed. A member's points count for the church from
// the moment they join (switching churches never carries points across).
import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { getDb } from "../db";
import { snapshotNow } from "../persist";
import { rateLimit } from "../_core/rate-limit";
import { logger } from "../_core/logger";
import { baPool, SCH } from "./pg";

type Me = { openId: string; name: string };
type Guard = (fn: (req: Request, res: Response, me: Me) => Promise<void>, needAuth?: boolean) => (req: Request, res: Response) => Promise<void>;
type Send = (res: Response, status: number, body: unknown) => void;

export const NG_STATES = ["Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT Abuja", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara", "Outside Nigeria"];
export const KINDS = ["church", "fellowship", "campus"] as const;
const LIMITS = { name: [3, 50], city: [2, 40], maxCreatesPerDay: 2, maxMembers: 5000 } as const;
// Basic moderation: obvious obscenities/insults (lower-case, matched on letters only). Kept short on purpose.
const BLOCK = ["shit", "bitch", "pussy", "dick", "cock", "porn", "sex", "nude", "nigger", "nigga", "whore", "slut", "bastard", "asshole", "satan rules", "ashawo", "olosho", "mumu", "werey", "oloshi", "kill", "rape", "hitler", "fuck"];
const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

// ---------- clock (injectable for tests) ----------
let nowFn = () => Date.now();
export function _setNow(fn: () => number) { nowFn = fn; }
const LAGOS = 3600_000;
/** Start (UTC ms) of the league week containing t: Monday 00:00 in Lagos (UTC+1). offset -1 = last week. */
export function weekStart(t = nowFn(), offset = 0): number {
  const local = t + LAGOS;
  const day = Math.floor(local / 86_400_000);
  const dow = (day + 3) % 7; // 1970-01-01 was a Thursday -> Monday = 0
  return (day - dow + offset * 7) * 86_400_000 - LAGOS;
}
export function weekKey(t = nowFn(), offset = 0): string {
  return new Date(weekStart(t, offset) + LAGOS).toISOString().slice(0, 10); // the Monday's Lagos date
}

// ---------- validation ----------
export function normSpace(v: unknown, max = 200): string {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f<>{}\[\]\\`$]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}
export function nameKey(v: string): string {
  return v.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
}
function blocked(v: string): boolean {
  const words = v.toLowerCase().replace(/[^a-z ]+/g, " ").split(/\s+/).filter(Boolean);
  const flat = words.join("");
  return BLOCK.some((b) => (b.length <= 4 && b !== "fuck" ? words.includes(b) : flat.includes(b.replace(/ /g, ""))));
}
export function validateChurch(b: any): { ok: true; name: string; city: string; state: string; kind: string } | { ok: false; error: string; field: string } {
  const name = normSpace(b?.name, 80);
  const city = normSpace(b?.city, 60);
  const state = NG_STATES.find((s) => s.toLowerCase() === normSpace(b?.state, 40).toLowerCase()) || "";
  const kind = (KINDS as readonly string[]).includes(String(b?.kind)) ? String(b.kind) : "church";
  if (name.length < LIMITS.name[0]) return { ok: false, field: "name", error: "Please enter your church name (at least 3 letters)." };
  if (name.length > LIMITS.name[1]) return { ok: false, field: "name", error: `Keep the name under ${LIMITS.name[1]} characters.` };
  if ((name.match(/[A-Za-z\u00C0-\u024F]/g) || []).length < 3) return { ok: false, field: "name", error: "The name needs at least 3 letters." };
  if (/https?:|www\.|\.(com|ng|org|net|xyz|io)\b|@/i.test(name)) return { ok: false, field: "name", error: "No links or emails in the name, please." };
  if ((name.match(/\d/g) || []).length >= 7) return { ok: false, field: "name", error: "No phone numbers in the name, please." };
  if (blocked(name)) return { ok: false, field: "name", error: "Please choose a respectful name." };
  if (city.length < LIMITS.city[0] || city.length > LIMITS.city[1] || !/[A-Za-z]{2}/.test(city)) return { ok: false, field: "city", error: "Please enter the city or town." };
  if (blocked(city) || /https?:|www\./i.test(city)) return { ok: false, field: "city", error: "Please enter a real city or town." };
  if (!state) return { ok: false, field: "state", error: "Please pick the state." };
  return { ok: true, name, city, state, kind };
}

// ---------- SQLite registry ----------
let purged = false;
function db() {
  const d = getDb();
  d.exec(`CREATE TABLE IF NOT EXISTS v3_churches (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, name_key TEXT NOT NULL, city TEXT NOT NULL,
      state TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'church', owner_open_id TEXT NOT NULL, created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL, deleted_at INTEGER);
    CREATE INDEX IF NOT EXISTS v3_churches_key ON v3_churches(name_key, city);
    CREATE INDEX IF NOT EXISTS v3_churches_creator ON v3_churches(created_by, created_at);
    CREATE TABLE IF NOT EXISTS v3_church_members (
      open_id TEXT PRIMARY KEY, church_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', joined_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS v3_church_members_church ON v3_church_members(church_id);
    CREATE TABLE IF NOT EXISTS v3_church_wins (week TEXT PRIMARY KEY, church_id TEXT NOT NULL, name TEXT NOT NULL, points INTEGER NOT NULL, recorded_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS v3_church_creates (open_id TEXT NOT NULL, at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS v3_church_creates_who ON v3_church_creates(open_id, at);
    CREATE TABLE IF NOT EXISTS v3_church_verify (
      id TEXT PRIMARY KEY, church_id TEXT NOT NULL, open_id TEXT NOT NULL, code TEXT NOT NULL, requester TEXT NOT NULL, role TEXT NOT NULL,
      link TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
      reason TEXT NOT NULL DEFAULT '', name_key TEXT NOT NULL, created_at INTEGER NOT NULL, decided_at INTEGER);
    CREATE INDEX IF NOT EXISTS v3_church_verify_church ON v3_church_verify(church_id, created_at);
    CREATE INDEX IF NOT EXISTS v3_church_verify_who ON v3_church_verify(open_id, created_at);
    CREATE TABLE IF NOT EXISTS v3_church_verified (church_id TEXT PRIMARY KEY, name_key TEXT NOT NULL, verified_at INTEGER NOT NULL, request_id TEXT NOT NULL DEFAULT '');`);
  if (!purged) { purged = true; try { d.exec("DELETE FROM v3_churches WHERE deleted_at IS NOT NULL"); } catch {} } // v3.4.0 soft-deleted rows
  return d;
}
type Church = { id: string; code: string; name: string; city: string; state: string; kind: string; owner_open_id: string; created_at: number };
const COLS = "id, code, name, city, state, kind, owner_open_id, created_at";
function churchById(id: string): Church | null {
  return (db().prepare(`SELECT ${COLS} FROM v3_churches WHERE id = ? AND deleted_at IS NULL`).get(String(id)) as any) || null;
}
function churchByCode(code: string): Church | null {
  const c = String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (c.length < 4) return null;
  return (db().prepare(`SELECT ${COLS} FROM v3_churches WHERE code = ? AND deleted_at IS NULL`).get(c) as any) || null;
}
function membership(openId: string): { church_id: string; role: string; joined_at: number } | null {
  return (db().prepare("SELECT church_id, role, joined_at FROM v3_church_members WHERE open_id = ?").get(openId) as any) || null;
}
function memberCount(id: string): number {
  return Number((db().prepare("SELECT COUNT(*) AS n FROM v3_church_members WHERE church_id = ?").get(id) as any)?.n || 0);
}
function newCode(): string {
  for (let i = 0; i < 20; i++) {
    const b = crypto.randomBytes(6);
    const c = Array.from(b, (x) => CODE_ABC[x % CODE_ABC.length]).join("");
    if (!db().prepare("SELECT 1 FROM v3_churches WHERE code = ?").get(c)) return c;
  }
  throw new Error("code_space");
}
function persistSoon(reason: string) { clearStandingsCache(); snapshotNow(reason).catch(() => {}); }

/** Leave the current church. The last member out closes it; an owner leaving hands over to the longest-serving member. */
function leaveInternal(openId: string): { left: string | null; closed: boolean } {
  const d = db();
  const m = membership(openId);
  if (!m) return { left: null, closed: false };
  d.prepare("DELETE FROM v3_church_members WHERE open_id = ?").run(openId);
  const rest = d.prepare("SELECT open_id FROM v3_church_members WHERE church_id = ? ORDER BY joined_at ASC LIMIT 1").get(m.church_id) as any;
  if (!rest) {
    d.prepare("DELETE FROM v3_churches WHERE id = ?").run(m.church_id); // an empty team is removed outright
    d.prepare("DELETE FROM v3_church_verified WHERE church_id = ?").run(m.church_id);
    d.prepare("DELETE FROM v3_church_verify WHERE church_id = ?").run(m.church_id);
    return { left: m.church_id, closed: true };
  }
  const c = d.prepare("SELECT owner_open_id FROM v3_churches WHERE id = ?").get(m.church_id) as any;
  if (c && c.owner_open_id === openId) {
    d.prepare("UPDATE v3_churches SET owner_open_id = ? WHERE id = ?").run(rest.open_id, m.church_id);
    d.prepare("UPDATE v3_church_members SET role = 'owner' WHERE open_id = ?").run(rest.open_id);
  }
  return { left: m.church_id, closed: false };
}

// ---------- points ----------
type Standing = { id: string; name: string; city: string; state: string; kind: string; members: number; points: number; titles: number; verified: boolean };
async function memberPoints(members: Array<{ open_id: string; joined_at: number }>, from: number | null, to: number | null): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!members.length) return out;
  const pool = baPool();
  if (!pool) return out;
  const r = await pool.query(
    `with m(open_id, joined) as (select * from unnest($1::text[], $2::timestamptz[]))
     select m.open_id, coalesce(sum(r.score), 0)::bigint as pts
       from m join ${SCH}.rounds r on r.open_id = m.open_id
      where r.created_at >= greatest(m.joined, coalesce($3::timestamptz, m.joined)) and ($4::timestamptz is null or r.created_at < $4::timestamptz)
      group by m.open_id`,
    [members.map((m) => m.open_id), members.map((m) => new Date(m.joined_at).toISOString()), from == null ? null : new Date(from).toISOString(), to == null ? null : new Date(to).toISOString()],
  );
  for (const row of r.rows) out.set(row.open_id, Number(row.pts) || 0);
  return out;
}
function titles(): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of db().prepare("SELECT church_id, COUNT(*) AS n FROM v3_church_wins WHERE church_id <> '' GROUP BY church_id").all() as any[]) m.set(r.church_id, Number(r.n));
  return m;
}
// v3.5.0: league standings are cached for 20 s (the load test showed DB round trips are the bottleneck); any church write clears it.
const STANDINGS_TTL_MS = 20_000;
const standingsCache = new Map<string, { at: number; rows: Promise<Standing[]> }>();
export function clearStandingsCache() { standingsCache.clear(); }
export function standings(period: "week" | "all" | "prev"): Promise<Standing[]> {
  const key = period + ":" + weekStart();
  const hit = standingsCache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < STANDINGS_TTL_MS) return hit.rows;
  const rows = standingsUncached(period);
  standingsCache.set(key, { at: now, rows });
  rows.catch(() => standingsCache.delete(key));
  return rows;
}
async function standingsUncached(period: "week" | "all" | "prev"): Promise<Standing[]> {
  const d = db();
  const churches = d.prepare(`SELECT ${COLS} FROM v3_churches WHERE deleted_at IS NULL`).all() as any as Church[];
  const members = d.prepare("SELECT m.open_id, m.church_id, m.joined_at FROM v3_church_members m JOIN v3_churches c ON c.id = m.church_id AND c.deleted_at IS NULL").all() as any[];
  const from = period === "week" ? weekStart() : period === "prev" ? weekStart(nowFn(), -1) : null;
  const to = period === "prev" ? weekStart() : null;
  const pts = await memberPoints(members, from, to);
  const t = titles();
  const by = new Map<string, Standing>();
  const ver = verifiedSet();
  for (const c of churches) by.set(c.id, { id: c.id, name: c.name, city: c.city, state: c.state, kind: c.kind, members: 0, points: 0, titles: t.get(c.id) || 0, verified: ver.has(c.id) });
  for (const m of members) { const s = by.get(m.church_id); if (s) { s.members++; s.points += pts.get(m.open_id) || 0; } }
  return Array.from(by.values()).filter((s) => s.members > 0).sort((a, b) => b.points - a.points || b.members - a.members || a.name.localeCompare(b.name));
}
let championChecked = "";
/** Record last week's champion once (lazily, on the first league read of a new week). */
export async function ensureChampion(): Promise<{ week: string; church_id: string; name: string; points: number } | null> {
  const key = weekKey(nowFn(), -1);
  const d = db();
  let row = d.prepare("SELECT week, church_id, name, points FROM v3_church_wins WHERE week = ?").get(key) as any;
  if (!row && championChecked !== key) {
    const prev = await standings("prev");
    const top = prev[0];
    d.prepare("INSERT OR IGNORE INTO v3_church_wins (week, church_id, name, points, recorded_at) VALUES (?, ?, ?, ?, ?)").run(key, top && top.points > 0 ? top.id : "", top && top.points > 0 ? top.name : "", top && top.points > 0 ? top.points : 0, nowFn());
    championChecked = key;
    persistSoon("church-champion");
    row = d.prepare("SELECT week, church_id, name, points FROM v3_church_wins WHERE week = ?").get(key) as any;
  }
  return row && row.church_id ? row : null;
}

function pub(c: Church, extra: Record<string, unknown> = {}) {
  return { id: c.id, name: c.name, city: c.city, state: c.state, kind: c.kind, members: memberCount(c.id), verified: isVerified(c.id), ...extra };
}
async function setPlayerChurch(me: Me, name: string | null) {
  const pool = baPool();
  if (!pool) return;
  await pool.query(
    `insert into ${SCH}.players(open_id, name, church) values ($1, $2, $3) on conflict (open_id) do update set church = excluded.church, updated_at = now()`,
    [me.openId, normSpace(me.name, 40) || "Player", name],
  );
}

/** OG preview for /c/CODE share links. */
export async function previewForOg(code: string): Promise<{ name: string; city: string; members: number; verified: boolean } | null> {
  const c = churchByCode(code);
  return c ? { name: c.name, city: c.city, members: memberCount(c.id), verified: isVerified(c.id) } : null;
}
/** The team name a member plays for (used by /api/v3/player so a typed church can't override the team). */
export function teamNameFor(openId: string): string | null {
  try { const m = membership(openId); if (!m) return null; const c = churchById(m.church_id); return c ? c.name : null; } catch { return null; }
}
/** Account deletion: drop the membership (a church left empty closes). */
export function deleteChurchData(openId: string): number {
  try {
    const r = leaveInternal(openId);
    const d = db();
    d.prepare("DELETE FROM v3_church_creates WHERE open_id = ?").run(openId);
    d.prepare("DELETE FROM v3_church_verify WHERE open_id = ? AND status <> 'approved'").run(openId);
    d.prepare("UPDATE v3_church_verify SET requester = '', email = '', phone = '', open_id = '' WHERE open_id = ?").run(openId);
    // a team they created that still has members keeps going under its new lead; no trace of them stays in it
    d.prepare("UPDATE v3_churches SET created_by = '' WHERE created_by = ?").run(openId);
    persistSoon("church-account-delete");
    return r.left ? 1 : 0;
  } catch { return 0; }
}
/** Guest -> Google merge: carry the guest's membership over when the Google account has none. */
export function mergeChurchMembership(guestOpenId: string, googleOpenId: string) {
  try {
    const d = db();
    const g = membership(guestOpenId);
    if (!g) return;
    if (membership(googleOpenId)) { leaveInternal(guestOpenId); }
    else {
      d.prepare("UPDATE v3_church_members SET open_id = ? WHERE open_id = ?").run(googleOpenId, guestOpenId);
      d.prepare("UPDATE v3_churches SET owner_open_id = ? WHERE owner_open_id = ?").run(googleOpenId, guestOpenId);
      d.prepare("UPDATE v3_churches SET created_by = ? WHERE created_by = ?").run(googleOpenId, guestOpenId);
      d.prepare("UPDATE v3_church_creates SET open_id = ? WHERE open_id = ?").run(googleOpenId, guestOpenId);
      d.prepare("UPDATE v3_church_verify SET open_id = ? WHERE open_id = ?").run(googleOpenId, guestOpenId);
    }
    persistSoon("church-merge");
  } catch (error) {
    logger.warn("v3_church_merge_failed", { error: error instanceof Error ? error.message : String(error) });
  }
}

export function registerChurches(app: Express, guard: Guard, send: Send): void {
  const limitCreate = rateLimit({ windowMs: 60 * 60_000, max: 6, name: "v3-church-create" });
  const limitJoin = rateLimit({ windowMs: 60_000, max: 20, name: "v3-church-join" });
  const limitRead = rateLimit({ windowMs: 60_000, max: 120, name: "v3-church-read" });

  app.get("/api/v3/churches/meta", (_req, res) => send(res, 200, { states: NG_STATES, kinds: KINDS, limits: LIMITS, weekStart: weekStart(), resetsAt: weekStart(nowFn(), 1) }));

  app.get("/api/v3/churches/mine", limitRead, guard(async (_req, res, me) => {
    if (!me) return send(res, 200, { church: null });
    const m = membership(me.openId);
    const c = m ? churchById(m.church_id) : null;
    if (!c) return send(res, 200, { church: null, resetsAt: weekStart(nowFn(), 1) });
    const champ = await ensureChampion().catch(() => null);
    const week = await standings("week");
    const pos = week.findIndex((s) => s.id === c.id);
    const mine = await memberPoints([{ open_id: me.openId, joined_at: m!.joined_at }], weekStart(), null);
    send(res, 200, { church: pub(c, { code: c.code, role: m!.role, rank: pos + 1, of: week.length, weekPoints: week[pos]?.points || 0, myWeekPoints: mine.get(me.openId) || 0, champion: champ?.church_id === c.id }), resetsAt: weekStart(nowFn(), 1) });
  }, false));

  app.post("/api/v3/churches", limitCreate, guard(async (req, res, me) => {
    const v = validateChurch(req.body || {});
    if (!v.ok) return send(res, 400, { error: "invalid", field: v.field, message: v.error });
    const d = db();
    const since = nowFn() - 86_400_000;
    d.prepare("DELETE FROM v3_church_creates WHERE at < ?").run(nowFn() - 2 * 86_400_000);
    const made = Number((d.prepare("SELECT COUNT(*) AS n FROM v3_church_creates WHERE open_id = ? AND at > ?").get(me.openId, since) as any)?.n || 0);
    if (made >= LIMITS.maxCreatesPerDay) return send(res, 429, { error: "too_many", message: "You've created enough churches for today. Try again tomorrow." });
    const key = nameKey(v.name);
    const dup = d.prepare(`SELECT ${COLS} FROM v3_churches WHERE name_key = ? AND lower(city) = lower(?) AND deleted_at IS NULL`).get(key, v.city) as any;
    if (dup) return send(res, 409, { error: "exists", message: `${dup.name} (${dup.city}) is already on Bible Arena. Ask a member for the invite link to join it.`, church: pub(dup) });
    const id = crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "x");
    const code = newCode();
    const now = nowFn();
    d.exec("BEGIN IMMEDIATE");
    try {
      leaveInternal(me.openId);
      d.prepare("INSERT INTO v3_churches (id, code, name, name_key, city, state, kind, owner_open_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, code, v.name, key, v.city, v.state, v.kind, me.openId, me.openId, now);
      d.prepare("INSERT INTO v3_church_members (open_id, church_id, role, joined_at) VALUES (?, ?, 'owner', ?)").run(me.openId, id, now);
      d.prepare("INSERT INTO v3_church_creates (open_id, at) VALUES (?, ?)").run(me.openId, now);
      d.exec("COMMIT");
    } catch (error) { d.exec("ROLLBACK"); throw error; }
    persistSoon("church-create");
    await setPlayerChurch(me, v.name);
    logger.info("v3_church_created", { id, kind: v.kind, state: v.state });
    send(res, 200, { church: pub(churchById(id)!, { code, role: "owner" }) });
  }));

  app.get("/api/v3/churches/code/:code", limitJoin, guard(async (req, res, me) => {
    const c = churchByCode(req.params.code);
    if (!c) return send(res, 404, { error: "not_found", message: "That invite code doesn't match any church. Check the code and try again." });
    const m = me ? membership(me.openId) : null;
    const cur = m ? churchById(m.church_id) : null;
    send(res, 200, { church: pub(c), alreadyMember: m?.church_id === c.id, current: cur && cur.id !== c.id ? { id: cur.id, name: cur.name } : null });
  }, false));

  app.post("/api/v3/churches/join", limitJoin, guard(async (req, res, me) => {
    const c = churchByCode((req.body || {}).code);
    if (!c) return send(res, 404, { error: "not_found", message: "That invite code doesn't match any church. Check the code and try again." });
    const m = membership(me.openId);
    if (m?.church_id === c.id) return send(res, 200, { church: pub(c, { code: c.code, role: m.role }), already: true });
    if (memberCount(c.id) >= LIMITS.maxMembers) return send(res, 409, { error: "full", message: "This church team is full." });
    const d = db();
    d.exec("BEGIN IMMEDIATE");
    try {
      leaveInternal(me.openId);
      d.prepare("INSERT INTO v3_church_members (open_id, church_id, role, joined_at) VALUES (?, ?, 'member', ?)").run(me.openId, c.id, nowFn());
      d.exec("COMMIT");
    } catch (error) { d.exec("ROLLBACK"); throw error; }
    persistSoon("church-join");
    await setPlayerChurch(me, c.name);
    send(res, 200, { church: pub(c, { code: c.code, role: "member" }) });
  }));

  app.post("/api/v3/churches/leave", limitJoin, guard(async (_req, res, me) => {
    const d = db();
    d.exec("BEGIN IMMEDIATE");
    let r;
    try { r = leaveInternal(me.openId); d.exec("COMMIT"); } catch (error) { d.exec("ROLLBACK"); throw error; }
    if (r.left) { persistSoon("church-leave"); await setPlayerChurch(me, null); }
    send(res, 200, { left: !!r.left, closed: r.closed });
  }));

  app.post("/api/v3/churches/:id/remove", limitJoin, guard(async (req, res, me) => {
    const c = churchById(req.params.id);
    if (!c) return send(res, 404, { error: "not_found" });
    if (c.owner_open_id !== me.openId) return send(res, 403, { error: "owner_only" });
    const idx = Number((req.body || {}).member);
    const rows = db().prepare("SELECT open_id FROM v3_church_members WHERE church_id = ? ORDER BY joined_at ASC").all(c.id) as any[];
    const target = rows[idx]?.open_id;
    if (!target || target === me.openId) return send(res, 400, { error: "bad_member" });
    db().prepare("DELETE FROM v3_church_members WHERE open_id = ? AND church_id = ?").run(target, c.id);
    persistSoon("church-remove");
    await baPool()?.query(`update ${SCH}.players set church = null, updated_at = now() where open_id = $1 and church = $2`, [target, c.name]);
    send(res, 200, { removed: true });
  }));

  app.get("/api/v3/churches/:id", limitRead, guard(async (req, res, me) => {
    const c = churchById(req.params.id);
    if (!c) return send(res, 404, { error: "not_found", message: "This church isn't on Bible Arena any more." });
    const champ = await ensureChampion().catch(() => null);
    const [week, all] = await Promise.all([standings("week"), standings("all")]);
    const rows = db().prepare("SELECT open_id, role, joined_at FROM v3_church_members WHERE church_id = ? ORDER BY joined_at ASC").all(c.id) as any[];
    const [wk, at] = await Promise.all([memberPoints(rows, weekStart(), null), memberPoints(rows, null, null)]);
    const pool = baPool();
    const names = new Map<string, any>();
    if (pool && rows.length) {
      const r = await pool.query(`select open_id, name, xp from ${SCH}.players where open_id = any($1::text[])`, [rows.map((x) => x.open_id)]);
      for (const p of r.rows) names.set(p.open_id, p);
    }
    const isMember = !!me && rows.some((x) => x.open_id === me.openId);
    const members = rows.map((x, i) => ({ idx: i, name: names.get(x.open_id)?.name || "Player", xp: names.get(x.open_id)?.xp || 0, role: x.role, week: wk.get(x.open_id) || 0, all: at.get(x.open_id) || 0, isMe: me?.openId === x.open_id }));
    const wpos = week.findIndex((s) => s.id === c.id), apos = all.findIndex((s) => s.id === c.id);
    const t = titles().get(c.id) || 0;
    send(res, 200, {
      church: pub(c, { code: isMember ? c.code : undefined, titles: t, champion: champ?.church_id === c.id }),
      week: { rank: wpos + 1, of: week.length, points: week[wpos]?.points || 0 },
      all: { rank: apos + 1, of: all.length, points: all[apos]?.points || 0 },
      members: members.slice(0, 200), isMember, isOwner: !!me && c.owner_open_id === me.openId, resetsAt: weekStart(nowFn(), 1),
    });
  }, false));

  app.get("/api/v3/league", limitRead, guard(async (req, res, me) => {
    const period = req.query.period === "all" ? "all" : "week";
    const champ = await ensureChampion().catch(() => null);
    const list = await standings(period);
    const m = me ? membership(me.openId) : null;
    send(res, 200, {
      period, resetsAt: weekStart(nowFn(), 1), weekStart: weekStart(),
      champion: champ ? { id: champ.church_id, name: champ.name, points: champ.points, week: champ.week } : null,
      churches: list.slice(0, 100).map((s, i) => ({ ...s, pos: i + 1, isMine: m?.church_id === s.id })),
      mine: m ? (() => { const i = list.findIndex((s) => s.id === m.church_id); return i >= 0 ? { ...list[i], pos: i + 1 } : null; })() : null,
    });
  }, false));
}

// ---------- Verified churches (v3.5.0) ----------
// Proof-based, never self-service: the team lead asks, gets a code built from the church name (e.g. BA-LFCA-7K3), posts it on the church's official
// public page (or emails it from the official church address); the owner reviews on the admin page (/admin/verify, key in
// the BA_ADMIN_KEY env secret) and approves or rejects with a reason. The tick is a cosmetic trust badge only, with no extra
// powers. A rename after approval drops the tick until it is reviewed again (the approved name is stored with the tick).
export const VERIFY_LIMITS = { perDevicePerDay: 3, requester: [3, 60], role: [2, 40], link: 200, reason: 300 } as const;
export const VERIFY_ROLES = ["Senior Pastor", "Pastor", "Assistant Pastor", "Youth Pastor", "Church Administrator", "Fellowship President", "Campus Fellowship Leader", "Church Media Team"];
export function isVerified(churchId: string): boolean {
  try {
    const r = db().prepare("SELECT v.name_key AS vk, c.name_key AS ck FROM v3_church_verified v JOIN v3_churches c ON c.id = v.church_id WHERE v.church_id = ?").get(churchId) as any;
    return !!r && r.vk === r.ck;
  } catch { return false; }
}
function verifiedSet(): Set<string> {
  const s = new Set<string>();
  try { for (const r of db().prepare("SELECT v.church_id FROM v3_church_verified v JOIN v3_churches c ON c.id = v.church_id AND c.name_key = v.name_key").all() as any[]) s.add(r.church_id); } catch {}
  return s;
}
export function normLink(raw: unknown): string | null {
  let s = String(raw ?? "").trim().replace(/[\s<>"'`]/g, "");
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
    const h = u.hostname.toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(h) || /^(localhost|.*\.local)$/.test(h) || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return null;
    if (/(^|\.)(wa\.me|whatsapp\.com|bit\.ly|tinyurl\.com|t\.co)$/.test(h)) return null; // a church's own page, not a chat or a short link
    const out = u.toString();
    return out.length <= VERIFY_LIMITS.link ? out : null;
  } catch { return null; }
}
export function validateVerify(b: any): { ok: true; requester: string; role: string; link: string; email: string; phone: string } | { ok: false; field: string; error: string } {
  const requester = normSpace(b?.requester, 80), role = normSpace(b?.role, 60);
  if (requester.length < VERIFY_LIMITS.requester[0] || requester.length > VERIFY_LIMITS.requester[1]) return { ok: false, field: "requester", error: "Enter your full name (3 to 60 letters)." };
  if (blocked(requester) || /https?:|www\.|\d{6,}/i.test(requester)) return { ok: false, field: "requester", error: "Please enter your real name." };
  if (role.length < VERIFY_LIMITS.role[0] || role.length > VERIFY_LIMITS.role[1] || blocked(role)) return { ok: false, field: "role", error: "Choose or type your role in the church." };
  const link = normLink(b?.link);
  if (!link) return { ok: false, field: "link", error: "Paste the church's official Facebook or Instagram page, or its website (for example https://facebook.com/yourchurch)." };
  const email = normSpace(b?.email, 120).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email)) return { ok: false, field: "email", error: "That email doesn't look right." };
  const phone = normSpace(b?.phone, 30);
  if (phone && !/^\+?[0-9 ()-]{7,20}$/.test(phone)) return { ok: false, field: "phone", error: "That phone number doesn't look right." };
  return { ok: true, requester, role, link, email, phone };
}
/** "BA-" + initials of the church name's significant words (max 6) + "-" + 3 random characters, e.g. Living Faith Church Akure -> BA-LFCA-7K3. */
const SKIP_WORDS = new Set(["THE", "OF", "AND", "A", "AN", "FOR", "IN", "AT", "ON", "TO", "BY", "ST"]);
export function verifyPrefix(name: string): string {
  const words = String(name || "").toUpperCase().normalize("NFKD").replace(/[^A-Z0-9 ]+/g, " ").split(/\s+/).filter((w) => w && !SKIP_WORDS.has(w));
  let p = words.map((w) => w[0]).join("").slice(0, 6);
  if (p.length < 2 && words[0]) p = words[0].replace(/[^A-Z]/g, "").slice(0, 4) || p;
  return p || "CH";
}
function verifyCode(churchName: string): string {
  const d = db();
  const pre = "BA-" + verifyPrefix(churchName) + "-";
  for (let i = 0; i < 30; i++) {
    const c = pre + Array.from(crypto.randomBytes(3), (b) => CODE_ABC[b % CODE_ABC.length]).join("");
    if (!d.prepare("SELECT 1 FROM v3_church_verify WHERE code = ?").get(c)) return c;
  }
  throw new Error("verify_code_exhausted");
}
type VRow = { id: string; church_id: string; open_id: string; code: string; requester: string; role: string; link: string; email: string; phone: string; status: string; reason: string; name_key: string; created_at: number; decided_at: number | null };
function latestRequest(churchId: string): VRow | null {
  return (db().prepare("SELECT * FROM v3_church_verify WHERE church_id = ? ORDER BY created_at DESC LIMIT 1").get(churchId) as any) || null;
}
const leadView = (r: VRow | null) => r ? { code: r.code, status: r.status, reason: r.reason || null, link: r.link, role: r.role, requester: r.requester, createdAt: r.created_at, decidedAt: r.decided_at } : null;
export const VERIFY_INSTRUCTIONS = "Post this code on your church's official page (or email it from the official church address), then wait for review.";
function adminKeyOk(req: Request): boolean {
  const want = String(process.env.BA_ADMIN_KEY || "");
  const got = String(req.headers["x-admin-key"] || "");
  if (want.length < 24 || !got) return false;
  const a = crypto.createHash("sha256").update(got).digest(), b = crypto.createHash("sha256").update(want).digest();
  return crypto.timingSafeEqual(a, b);
}
const adminFails = new Map<string, { n: number; reset: number }>();
const ipOf = (req: Request) => { const f = req.headers["x-forwarded-for"]; return (typeof f === "string" ? f.split(",")[0].trim() : req.ip) || "ip"; };
export function adminGate(req: Request, res: Response, send: Send): boolean {
  const ip = ipOf(req), now = Date.now();
  let f = adminFails.get(ip);
  if (f && f.reset <= now) { adminFails.delete(ip); f = undefined; }
  if (f && f.n >= 10) { send(res, 429, { error: "too_many_attempts" }); return false; }
  if (!process.env.BA_ADMIN_KEY || String(process.env.BA_ADMIN_KEY).length < 24) { send(res, 503, { error: "admin_not_configured" }); return false; }
  if (!adminKeyOk(req)) { adminFails.set(ip, { n: (f?.n || 0) + 1, reset: f?.reset || now + 15 * 60_000 }); send(res, 403, { error: "bad_key" }); return false; }
  return true;
}
const devHits = new Map<string, { n: number; reset: number }>();
function devAllow(key: string): boolean {
  const now = Date.now(); let h = devHits.get(key);
  if (!h || h.reset <= now) { h = { n: 0, reset: now + 86_400_000 }; devHits.set(key, h); }
  return ++h.n <= VERIFY_LIMITS.perDevicePerDay * 2; // per network: twice the per-device daily cap
}

const ADMIN_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Bible Arena · Church verification</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#070C1A;color:#E8E6DF;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;padding:16px;max-width:760px;margin:auto}
h1{font-size:20px;color:#F5B942}.card{background:#111a33;border:1px solid #23305a;border-radius:14px;padding:14px;margin:12px 0}.muted{color:#9aa3b8}.code{font:700 20px monospace;color:#F5B942}
input,textarea{width:100%;background:#0b1328;color:#fff;border:1px solid #2a3866;border-radius:10px;padding:10px;font:inherit}button{border:0;border-radius:10px;padding:10px 14px;font-weight:700;margin:6px 6px 0 0;cursor:pointer}
.ok{background:#3DDC97;color:#04210f}.no{background:#FF5D73;color:#2a0007}.ghost{background:#23305a;color:#fff}a{color:#7cc4ff;word-break:break-all}.tag{display:inline-block;padding:2px 8px;border-radius:99px;background:#23305a;font-size:12px}
</style></head><body><h1>⛪ Church verification</h1><p class="muted">Approve only when you have seen the code on the church's official page (or an email from the official church address). No request is ever approved automatically.</p>
<div id="login" class="card"><label>Admin key<input id="k" type="password" autocomplete="current-password"></label><button class="ok" id="go">Open</button><div id="lerr" class="muted"></div></div>
<div id="main" hidden><div class="row"><button class="ghost" id="rf">↻ Refresh</button><button class="ghost" id="out">Sign out</button></div><h2>Pending</h2><div id="pending"></div><h2>Verified</h2><div id="verified"></div><h2>Recently decided</h2><div id="recent"></div></div>
<script>
const $=s=>document.querySelector(s);const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let K=sessionStorage.getItem("ba-admin")||"";
async function api(p,b){const r=await fetch(p,{method:b?"POST":"GET",headers:{"Content-Type":"application/json","x-admin-key":K},body:b?JSON.stringify(b):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.error||r.status),{status:r.status});return d}
const when=t=>t?new Date(t).toLocaleString():"";
function req(r,act){return '<div class="card"><div class="code">'+esc(r.code)+'</div><b>'+esc(r.church.name)+'</b> <span class="muted">'+esc(r.church.city)+', '+esc(r.church.state)+' · '+esc(r.church.kind)+' · '+r.church.members+' member'+(r.church.members==1?'':'s')+' · team created '+when(r.church.createdAt)+'</span>'+
'<div style="margin-top:8px">Official page: <a href="'+esc(r.link)+'" target="_blank" rel="noopener noreferrer">'+esc(r.link)+'</a></div>'+
'<div>Requested by <b>'+esc(r.requester||"(account deleted)")+'</b>, '+esc(r.role)+(r.email?' · '+esc(r.email):'')+(r.phone?' · '+esc(r.phone):'')+'</div><div class="muted">Asked '+when(r.createdAt)+(r.decidedAt?' · decided '+when(r.decidedAt):'')+' · <span class="tag">'+esc(r.status)+'</span>'+(r.reason?' · '+esc(r.reason):'')+'</div>'+
(act?'<textarea data-reason="'+r.id+'" rows="2" placeholder="Reason (shown to the team lead if rejected)"></textarea><button class="ok" data-a="approve" data-id="'+r.id+'">✅ Approve</button><button class="no" data-a="reject" data-id="'+r.id+'">Reject</button>':'')+'</div>'}
async function load(){let d;try{d=await api("/api/v3/admin/verify")}catch(e){$("#main").hidden=true;$("#login").hidden=false;$("#lerr").textContent=e.status==403?"Wrong key.":e.status==429?"Too many tries. Wait 15 minutes.":e.status==503?"Admin key not set on the server.":"Error: "+e.message;return}
$("#login").hidden=true;$("#main").hidden=false;$("#pending").innerHTML=d.pending.map(r=>req(r,true)).join("")||'<p class="muted">Nothing waiting.</p>';
$("#verified").innerHTML=d.verified.map(v=>'<div class="card"><b>✅ '+esc(v.name)+'</b> <span class="muted">'+esc(v.city)+' · since '+when(v.verifiedAt)+(v.nameChanged?' · renamed since approval (tick hidden)':'')+'</span><br><button class="no" data-revoke="'+v.id+'">Revoke</button></div>').join("")||'<p class="muted">None yet.</p>';
$("#recent").innerHTML=d.recent.map(r=>req(r,false)).join("")||'<p class="muted">None.</p>'}
document.addEventListener("click",async e=>{const b=e.target.closest("button");if(!b)return;
if(b.id==="go"){K=$("#k").value.trim();sessionStorage.setItem("ba-admin",K);return load()}
if(b.id==="rf")return load();if(b.id==="out"){sessionStorage.removeItem("ba-admin");K="";location.reload();return}
if(b.dataset.a){const reason=(document.querySelector('[data-reason="'+b.dataset.id+'"]')||{}).value||"";if(b.dataset.a==="reject"&&!reason.trim()){alert("Write a reason for the team lead first.");return}
if(!confirm(b.dataset.a==="approve"?"Approve and show the ✅ Verified tick?":"Reject this request?"))return;try{await api("/api/v3/admin/verify/"+b.dataset.id,{action:b.dataset.a,reason});load()}catch(err){alert("Failed: "+err.message)}}
if(b.dataset.revoke){const reason=prompt("Reason for revoking (shown to the team lead):");if(reason===null)return;try{await api("/api/v3/admin/churches/"+b.dataset.revoke+"/revoke",{reason});load()}catch(err){alert("Failed: "+err.message)}}});
if(K)load();
</script></body></html>`;

export function registerVerify(app: Express, guard: Guard, send: Send): void {
  const limitRead = rateLimit({ windowMs: 60_000, max: 60, name: "v3-verify-read" });
  const limitAsk = rateLimit({ windowMs: 60 * 60_000, max: 10, name: "v3-verify-ask" });
  app.get("/api/v3/churches/:id/verify", limitRead, guard(async (req, res, me) => {
    const c = churchById(req.params.id);
    if (!c) return send(res, 404, { error: "not_found" });
    if (c.owner_open_id !== me.openId) return send(res, 403, { error: "owner_only" });
    send(res, 200, { verified: isVerified(c.id), request: leadView(latestRequest(c.id)), roles: VERIFY_ROLES, instructions: VERIFY_INSTRUCTIONS });
  }));
  app.post("/api/v3/churches/:id/verify", limitAsk, guard(async (req, res, me) => {
    const c = churchById(req.params.id);
    if (!c) return send(res, 404, { error: "not_found" });
    if (c.owner_open_id !== me.openId) return send(res, 403, { error: "owner_only", message: "Only the team lead can ask for verification." });
    if (isVerified(c.id)) return send(res, 409, { error: "already_verified", message: "This church is already verified." });
    const last = latestRequest(c.id);
    if (last && last.status === "pending") return send(res, 409, { error: "pending", message: "A request is already waiting for review.", request: leadView(last) });
    const d = db();
    const day = Number((d.prepare("SELECT COUNT(*) AS n FROM v3_church_verify WHERE open_id = ? AND created_at > ?").get(me.openId, nowFn() - 86_400_000) as any)?.n || 0);
    if (day >= VERIFY_LIMITS.perDevicePerDay || !devAllow("ip:" + ipOf(req))) return send(res, 429, { error: "too_many", message: "That's enough requests for today. Try again tomorrow." });
    const v = validateVerify(req.body || {});
    if (!v.ok) return send(res, 400, { error: "invalid", field: v.field, message: v.error });
    const id = crypto.randomBytes(8).toString("base64url");
    const code = verifyCode(c.name);
    d.prepare("INSERT INTO v3_church_verify (id, church_id, open_id, code, requester, role, link, email, phone, status, name_key, created_at) VALUES (?,?,?,?,?,?,?,?,?, 'pending', ?, ?)")
      .run(id, c.id, me.openId, code, v.requester, v.role, v.link, v.email, v.phone, (c as any).name_key || nameKey(c.name), nowFn());
    persistSoon("church-verify-request");
    logger.info("v3_church_verify_requested", { church: c.id });
    send(res, 200, { request: leadView(latestRequest(c.id)), instructions: VERIFY_INSTRUCTIONS });
  }));

  // ---- owner-only admin (key in the BA_ADMIN_KEY env secret, sent as the x-admin-key header) ----
  app.get(["/admin/verify", "/admin/verify/"], (_req, res) => {
    res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Robots-Tag", "noindex, nofollow"); res.setHeader("Referrer-Policy", "no-referrer");
    res.type("html").send(ADMIN_HTML);
  });
  const full = (r: VRow) => {
    const ch = (db().prepare("SELECT id, name, city, state, kind, created_at FROM v3_churches WHERE id = ?").get(r.church_id) as any) || { id: r.church_id, name: "(church removed)", city: "", state: "", kind: "", created_at: 0 };
    return { id: r.id, code: r.code, status: r.status, reason: r.reason, link: r.link, requester: r.requester, role: r.role, email: r.email, phone: r.phone, createdAt: r.created_at, decidedAt: r.decided_at,
      church: { id: ch.id, name: ch.name, city: ch.city, state: ch.state, kind: ch.kind, createdAt: ch.created_at, members: memberCount(ch.id) } };
  };
  app.get("/api/v3/admin/verify", (req, res) => {
    if (!adminGate(req, res, send)) return;
    const d = db();
    const pending = (d.prepare("SELECT * FROM v3_church_verify WHERE status = 'pending' ORDER BY created_at ASC LIMIT 200").all() as any[]).map(full);
    const recent = (d.prepare("SELECT * FROM v3_church_verify WHERE status <> 'pending' ORDER BY decided_at DESC LIMIT 30").all() as any[]).map(full);
    const verified = (d.prepare("SELECT v.church_id AS id, v.verified_at, v.name_key AS vk, c.name_key AS ck, c.name, c.city FROM v3_church_verified v JOIN v3_churches c ON c.id = v.church_id ORDER BY v.verified_at DESC").all() as any[])
      .map((v) => ({ id: v.id, name: v.name, city: v.city, verifiedAt: v.verified_at, nameChanged: v.vk !== v.ck }));
    send(res, 200, { pending, recent, verified });
  });
  app.post("/api/v3/admin/verify/:rid", (req, res) => {
    if (!adminGate(req, res, send)) return;
    const d = db();
    const r = d.prepare("SELECT * FROM v3_church_verify WHERE id = ?").get(String(req.params.rid)) as VRow | undefined;
    if (!r) return send(res, 404, { error: "not_found" });
    if (r.status !== "pending") return send(res, 409, { error: "already_decided", status: r.status });
    const action = String((req.body || {}).action), reason = normSpace((req.body || {}).reason, VERIFY_LIMITS.reason);
    const ch = churchById(r.church_id);
    if (!ch) return send(res, 410, { error: "church_gone" });
    const now = nowFn();
    if (action === "approve") {
      d.prepare("UPDATE v3_church_verify SET status = 'approved', reason = ?, decided_at = ? WHERE id = ?").run(reason, now, r.id);
      d.prepare("INSERT INTO v3_church_verified (church_id, name_key, verified_at, request_id) VALUES (?,?,?,?) ON CONFLICT(church_id) DO UPDATE SET name_key = excluded.name_key, verified_at = excluded.verified_at, request_id = excluded.request_id")
        .run(r.church_id, (ch as any).name_key || nameKey(ch.name), now, r.id);
    } else if (action === "reject") {
      if (!reason) return send(res, 400, { error: "reason_required" });
      d.prepare("UPDATE v3_church_verify SET status = 'rejected', reason = ?, decided_at = ? WHERE id = ?").run(reason, now, r.id);
    } else return send(res, 400, { error: "bad_action" });
    persistSoon("church-verify-" + action);
    logger.info("v3_church_verify_decided", { church: r.church_id, action });
    send(res, 200, { ok: true, status: action === "approve" ? "approved" : "rejected", verified: isVerified(r.church_id) });
  });
  app.post("/api/v3/admin/churches/:id/revoke", (req, res) => {
    if (!adminGate(req, res, send)) return;
    const d = db();
    const id = String(req.params.id);
    const n = Number(d.prepare("DELETE FROM v3_church_verified WHERE church_id = ?").run(id).changes || 0);
    if (n) {
      const reason = normSpace((req.body || {}).reason, VERIFY_LIMITS.reason) || "Verification was removed.";
      d.prepare("UPDATE v3_church_verify SET status = 'revoked', reason = ?, decided_at = ? WHERE id = (SELECT id FROM v3_church_verify WHERE church_id = ? AND status = 'approved' ORDER BY decided_at DESC LIMIT 1)").run(reason, nowFn(), id);
      persistSoon("church-verify-revoke");
    }
    send(res, 200, { ok: true, revoked: n > 0 });
  });
}
