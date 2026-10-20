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
    CREATE INDEX IF NOT EXISTS v3_church_creates_who ON v3_church_creates(open_id, at);`);
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
function persistSoon(reason: string) { snapshotNow(reason).catch(() => {}); }

/** Leave the current church. The last member out closes it; an owner leaving hands over to the longest-serving member. */
function leaveInternal(openId: string): { left: string | null; closed: boolean } {
  const d = db();
  const m = membership(openId);
  if (!m) return { left: null, closed: false };
  d.prepare("DELETE FROM v3_church_members WHERE open_id = ?").run(openId);
  const rest = d.prepare("SELECT open_id FROM v3_church_members WHERE church_id = ? ORDER BY joined_at ASC LIMIT 1").get(m.church_id) as any;
  if (!rest) {
    d.prepare("DELETE FROM v3_churches WHERE id = ?").run(m.church_id); // an empty team is removed outright
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
type Standing = { id: string; name: string; city: string; state: string; kind: string; members: number; points: number; titles: number };
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
export async function standings(period: "week" | "all" | "prev"): Promise<Standing[]> {
  const d = db();
  const churches = d.prepare(`SELECT ${COLS} FROM v3_churches WHERE deleted_at IS NULL`).all() as any as Church[];
  const members = d.prepare("SELECT m.open_id, m.church_id, m.joined_at FROM v3_church_members m JOIN v3_churches c ON c.id = m.church_id AND c.deleted_at IS NULL").all() as any[];
  const from = period === "week" ? weekStart() : period === "prev" ? weekStart(nowFn(), -1) : null;
  const to = period === "prev" ? weekStart() : null;
  const pts = await memberPoints(members, from, to);
  const t = titles();
  const by = new Map<string, Standing>();
  for (const c of churches) by.set(c.id, { id: c.id, name: c.name, city: c.city, state: c.state, kind: c.kind, members: 0, points: 0, titles: t.get(c.id) || 0 });
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
  return { id: c.id, name: c.name, city: c.city, state: c.state, kind: c.kind, members: memberCount(c.id), ...extra };
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
export async function previewForOg(code: string): Promise<{ name: string; city: string; members: number } | null> {
  const c = churchByCode(code);
  return c ? { name: c.name, city: c.city, members: memberCount(c.id) } : null;
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
