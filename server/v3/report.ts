// Bible Arena v3.10: weekly report card (strongest / weakest books, accuracy vs last week, questions answered, streak).
// Per-book tallies live in the server's own SQLite (v3_book_week, CREATE TABLE IF NOT EXISTS like safety.ts), snapshotted to
// Postgres by server/persist.ts. Weekly totals come from the existing rounds table (read only). No Postgres schema change.
// Kept 5 weeks, deleted with the account.
import type { Express, Request, Response } from "express";

/** "1 Samuel 17:49" -> "1 Samuel"; "Psalm 23:1" -> "Psalms". "" when no book can be read. */
export function bookOf(ref: unknown): string {
  const m = String(ref ?? "").match(/^\s*((?:[1-3]\s)?[A-Za-z][A-Za-z ]*?)\s*\d/);
  if (!m) return "";
  const b = m[1].replace(/\s+/g, " ").trim();
  return b === "Psalm" ? "Psalms" : b === "Song of Songs" ? "Song of Solomon" : b;
}
/** Monday (Lagos day, YYYY-MM-DD) of the week that holds day. */
export function weekStart(day: string): string {
  const t = Date.parse(day + "T00:00:00Z");
  const dow = new Date(t).getUTCDay(); // 0 Sun .. 6 Sat
  return new Date(t - ((dow + 6) % 7) * 86_400_000).toISOString().slice(0, 10);
}
const addDays = (day: string, n: number) => new Date(Date.parse(day + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const lagosDay = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10);

export interface BookRow { book: string; right: number; total: number }
export interface ReportStore { add(openId: string, week: string, rows: BookRow[]): void; get(openId: string, week: string): BookRow[]; prune(beforeWeek: string): void; del(openId: string): number; move?(fromOpenId: string, toOpenId: string): void }
type SqlDb = { exec(sql: string): void; prepare(sql: string): { run(...a: any[]): any; get(...a: any[]): any; all(...a: any[]): any[] }; transaction?: (fn: any) => any };
function sqliteStore(getDb: () => SqlDb): ReportStore {
  let ready = false;
  const db = () => {
    const d = getDb();
    if (!ready) {
      d.exec(`CREATE TABLE IF NOT EXISTS v3_book_week (open_id TEXT NOT NULL, week TEXT NOT NULL, book TEXT NOT NULL,
          right_n INTEGER NOT NULL DEFAULT 0, total_n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (open_id, week, book));
        CREATE INDEX IF NOT EXISTS v3_book_week_week ON v3_book_week(week);`);
      ready = true;
    }
    return d;
  };
  return {
    add: (openId, week, rows) => {
      const st = db().prepare(`INSERT INTO v3_book_week (open_id, week, book, right_n, total_n) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(open_id, week, book) DO UPDATE SET right_n = right_n + excluded.right_n, total_n = total_n + excluded.total_n`);
      for (const r of rows) st.run(openId, week, r.book, r.right, r.total);
    },
    get: (openId, week) => (db().prepare("SELECT book, right_n, total_n FROM v3_book_week WHERE open_id = ? AND week = ?").all(openId, week) as any[])
      .map((r) => ({ book: String(r.book), right: Number(r.right_n), total: Number(r.total_n) })),
    prune: (before) => { db().prepare("DELETE FROM v3_book_week WHERE week < ?").run(before); },
    del: (openId) => Number(db().prepare("DELETE FROM v3_book_week WHERE open_id = ?").run(openId)?.changes || 0),
    // v3.12.0: a guest's weekly tallies follow them when they sign in with Google (added to the account's).
    move: (from, to) => {
      const d = db();
      d.prepare(`INSERT INTO v3_book_week (open_id, week, book, right_n, total_n) SELECT ?, week, book, right_n, total_n FROM v3_book_week WHERE open_id = ? AND true
        ON CONFLICT(open_id, week, book) DO UPDATE SET right_n = right_n + excluded.right_n, total_n = total_n + excluded.total_n`).run(to, from);
      d.prepare("DELETE FROM v3_book_week WHERE open_id = ?").run(from);
    },
  };
}
let store: ReportStore | null = null;
let lastPrune = 0;
export function initReportStore(getDb: () => SqlDb) { store = sqliteStore(getDb); }
/** Tests: swap the storage. */
export function _setReportStore(s: ReportStore) { store = s; }

/** v3.12.0: move a guest's per-book tallies onto the account they signed in to. Never throws. */
export function mergeReport(fromOpenId: string, toOpenId: string) {
  if (!store || !store.move || !fromOpenId || !toOpenId || fromOpenId === toOpenId) return;
  try { store.move(fromOpenId, toOpenId); } catch {}
}

/** After a server-scored round: add each answered question to its book's tally for this week. Never throws. */
export function tallyBooks(openId: string, results: Array<{ id: string; correct: boolean }>, refOf: (id: string) => string | undefined, day = lagosDay()) {
  if (!store || !openId || !Array.isArray(results)) return;
  try {
    const m = new Map<string, BookRow>();
    for (const r of results) {
      const b = bookOf(refOf(r.id)); if (!b) continue;
      const row = m.get(b) || { book: b, right: 0, total: 0 };
      row.total++; if (r.correct) row.right++;
      m.set(b, row);
    }
    if (!m.size) return;
    store.add(openId, weekStart(day), [...m.values()]);
    if (Date.now() - lastPrune > 3600_000) { lastPrune = Date.now(); store.prune(addDays(weekStart(day), -35)); }
  } catch {}
}
export function deleteReportData(openId: string): number { try { return store ? store.del(openId) : 0; } catch { return 0; } }

const acc = (r: { right: number; total: number }) => (r.total ? r.right / r.total : 0);
/** Strongest / weakest books: at least 3 questions in the book this week; ties broken by more questions. */
export function pickBooks(rows: BookRow[], n = 3) {
  const ok = rows.filter((r) => r.total >= 3);
  if (ok.length < 2) return { strong: ok, weak: [] as BookRow[] };
  const k = Math.min(n, Math.floor(ok.length / 2));
  const strong = [...ok].sort((a, b) => acc(b) - acc(a) || b.total - a.total).slice(0, k);
  const weak = [...ok].sort((a, b) => acc(a) - acc(b) || b.total - a.total).slice(0, k);
  return { strong, weak };
}
export function summarize(days: Array<{ d: string; c: number; t: number; n: number }>, start: string) {
  const end = addDays(start, 7);
  const s = { answered: 0, correct: 0, rounds: 0, days: 0 };
  for (const x of days) if (x.d >= start && x.d < end) { s.answered += x.t; s.correct += x.c; s.rounds += x.n; if (x.n) s.days++; }
  return { ...s, accuracy: s.answered ? Math.round((s.correct / s.answered) * 100) : null };
}

export function registerReport(app: Express, guard: any, send: (res: Response, s: number, b: unknown) => void, deps: { pool: () => any; SCH: string; getPlayer: (openId: string) => Promise<any> }) {
  app.get("/api/v3/report", guard(async (_req: Request, res: Response, me: { openId: string }) => {
    const today = lagosDay(), wk = weekStart(today), prev = addDays(wk, -7);
    const r = await deps.pool().query(
      `select to_char((created_at at time zone 'UTC') + interval '1 hour', 'YYYY-MM-DD') as d, sum(correct)::int as c, sum(total)::int as t, count(*)::int as n
       from ${deps.SCH}.rounds where open_id=$1 and created_at > now() - interval '16 days' group by 1`, [me.openId]);
    const days = r.rows.map((x: any) => ({ d: String(x.d), c: Number(x.c), t: Number(x.t), n: Number(x.n) }));
    const p = await deps.getPlayer(me.openId);
    let rows: BookRow[] = [], lastRows: BookRow[] = [];
    try { if (store) { rows = store.get(me.openId, wk); lastRows = store.get(me.openId, prev); } } catch {}
    const books = pickBooks(rows);
    const lastAcc = new Map(lastRows.map((x) => [x.book, acc(x)]));
    const shape = (x: BookRow) => ({ book: x.book, right: x.right, total: x.total, accuracy: Math.round(acc(x) * 100), last: lastAcc.has(x.book) ? Math.round(lastAcc.get(x.book)! * 100) : null });
    send(res, 200, {
      week: { start: wk, end: addDays(wk, 6), today },
      thisWeek: summarize(days, wk), lastWeek: summarize(days, prev),
      books: { strong: books.strong.map(shape), weak: books.weak.map(shape), count: rows.length },
      streak: p ? p.streak : 0, bestStreak: p ? p.best_streak : 0, saves: Math.max(0, Math.min(2, Number(p?.stats?.streakSaves) || 0)),
      name: p?.name || null, xp: p?.xp || 0,
    });
  }));
}
