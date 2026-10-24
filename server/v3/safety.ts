// Bible Arena v3.9.0: player safety in voice rooms (Google Play user-generated-content rules).
// Voice chat lets strangers talk, so every player can MUTE (for themselves), BLOCK and REPORT any other player.
//  - Identity: room players have no account. The phone sends a random device id it keeps in localStorage
//    (header x-ba-d); the server only ever keeps/exposes a one-way tag of it (deviceTag), never the id itself.
//  - Block: kept on the phone (localStorage) AND here (v3_blocks), so it works in every future room:
//    two players where either blocked the other never see each other in voice and no voice signal is relayed between them.
//  - Report: room code, reported player (room id, tag, name), reason, optional note, reporter tag/name -> v3_reports.
//    Reports are reviewed by the owner at /admin/reports (BA_ADMIN_KEY). 3 different reporters in one room take
//    the player out of that room's voice at once (they can still play).
// Storage: the server's own SQLite (tables created here with CREATE TABLE IF NOT EXISTS, like the church tables),
// snapshotted to Postgres by server/persist.ts. No Postgres schema change. Audio itself is never sent to or stored by the server.
import crypto from "node:crypto";
import type { Express, Request, Response } from "express";

export const REPORT_REASONS: Record<string, string> = {
  language: "Bad language",
  bullying: "Bullying or insults",
  sexual: "Sexual or inappropriate talk",
  hate: "Hate or threats",
  personal: "Asking for or sharing personal info",
  spam: "Spam or noise",
  name: "Offensive name",
  other: "Something else",
};
const KEEP_MS = 180 * 86_400_000;      // reports older than 180 days are deleted
export const VOICE_KICK_REPORTERS = 3; // distinct reporters in one room -> out of that room's voice

/** One-way tag of the phone's random device id (16 chars). "" when the id is missing or too short. */
export function deviceTag(raw: unknown): string {
  const s = String(raw ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64);
  if (s.length < 16) return "";
  return crypto.createHash("sha256").update("ba-device-v1:" + s).digest("base64url").slice(0, 16);
}
export const cleanTag = (v: unknown) => { const s = String(v ?? ""); return /^[A-Za-z0-9_-]{16}$/.test(s) ? s : ""; };

// ---------- storage (injectable for tests) ----------
export interface SafetyStore {
  loadBlocks(): Array<[string, string]>;
  saveBlock(blocker: string, blocked: string, on: boolean, at: number): void;
  saveReport(r: ReportRow): void;
  recentReport(reporter: string, targetId: string, room: string, since: number): boolean;
  listReports(limit: number, status: string): ReportRow[];
  setStatus(id: string, status: string): boolean;
}
export interface ReportRow {
  id: string; room: string; reporter_tag: string; reporter_name: string; target_id: string; target_tag: string; target_name: string;
  reason: string; note: string; in_voice: number; status: string; created_at: number;
}
// SQLite store; wired at boot by initSafetyStore(getDb, snapshotNow) from server/v3/index.ts (keeps this file free of DB imports for tests).
type SqlDb = { exec(sql: string): void; prepare(sql: string): { run(...a: any[]): any; get(...a: any[]): any; all(...a: any[]): any[] } };
function sqliteStore(getDb: () => SqlDb): SafetyStore {
  let ready = false;
  const db = () => {
    const d = getDb();
    if (!ready) {
      d.exec(`CREATE TABLE IF NOT EXISTS v3_reports (
          id TEXT PRIMARY KEY, room TEXT NOT NULL, reporter_tag TEXT NOT NULL, reporter_name TEXT NOT NULL, target_id TEXT NOT NULL,
          target_tag TEXT NOT NULL, target_name TEXT NOT NULL, reason TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
          in_voice INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'open', created_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS v3_reports_when ON v3_reports(status, created_at);
        CREATE TABLE IF NOT EXISTS v3_blocks (blocker TEXT NOT NULL, blocked TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (blocker, blocked));`);
      ready = true;
    }
    return d;
  };
  return {
    loadBlocks: () => (db().prepare("SELECT blocker, blocked FROM v3_blocks").all() as any[]).map((r) => [String(r.blocker), String(r.blocked)] as [string, string]),
    saveBlock: (a, b, on, at) => {
      if (on) db().prepare("INSERT OR IGNORE INTO v3_blocks (blocker, blocked, created_at) VALUES (?, ?, ?)").run(a, b, at);
      else db().prepare("DELETE FROM v3_blocks WHERE blocker = ? AND blocked = ?").run(a, b);
    },
    saveReport: (r) => {
      const d = db();
      d.prepare("DELETE FROM v3_reports WHERE created_at < ?").run(r.created_at - KEEP_MS);
      d.prepare(`INSERT INTO v3_reports (id, room, reporter_tag, reporter_name, target_id, target_tag, target_name, reason, note, in_voice, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(r.id, r.room, r.reporter_tag, r.reporter_name, r.target_id, r.target_tag, r.target_name, r.reason, r.note, r.in_voice, r.status, r.created_at);
    },
    recentReport: (rep, tid, room, since) => !!db().prepare("SELECT 1 FROM v3_reports WHERE reporter_tag = ? AND target_id = ? AND room = ? AND created_at > ? LIMIT 1").get(rep, tid, room, since),
    listReports: (limit, status) => db().prepare(`SELECT * FROM v3_reports ${status === "all" ? "" : "WHERE status = ?"} ORDER BY created_at DESC LIMIT ?`)
      .all(...(status === "all" ? [limit] : [status, limit])) as any[],
    setStatus: (id, status) => Number(db().prepare("UPDATE v3_reports SET status = ? WHERE id = ?").run(status, id).changes || 0) > 0,
  };
}
/** In-memory store (tests, and the moments before boot wiring). */
export function memoryStore(): SafetyStore & { reports: ReportRow[]; blocks: Array<[string, string]> } {
  const st = { reports: [] as ReportRow[], blocks: [] as Array<[string, string]> };
  return Object.assign(st, {
    loadBlocks: () => st.blocks.slice(),
    saveBlock: (a: string, b: string, on: boolean) => { st.blocks = st.blocks.filter(([x, y]) => !(x === a && y === b)); if (on) st.blocks.push([a, b]); },
    saveReport: (r: ReportRow) => { st.reports.push(r); },
    recentReport: (rep: string, tid: string, room: string, since: number) => st.reports.some((r) => r.reporter_tag === rep && r.target_id === tid && r.room === room && r.created_at > since),
    listReports: (limit: number, status: string) => st.reports.filter((r) => status === "all" || r.status === status).slice(-limit).reverse(),
    setStatus: (id: string, status: string) => { const r = st.reports.find((x) => x.id === id); if (r) r.status = status; return !!r; },
  });
}
let store: SafetyStore = memoryStore();
let persist: (why: string) => void = () => {};
export function initSafetyStore(getDb: () => SqlDb, snapshotNow: (why: string) => Promise<unknown>) {
  store = sqliteStore(getDb); persist = (why) => { snapshotNow(why).catch(() => {}); }; blocks = null;
}
/** Tests: swap the storage and the snapshot call. */
export function _setStore(s: SafetyStore, p: (why: string) => void = () => {}) { store = s; persist = p; blocks = null; }

// ---------- blocks ----------
let blocks: Map<string, Set<string>> | null = null;
function blockMap(): Map<string, Set<string>> {
  if (blocks) return blocks;
  const m = new Map<string, Set<string>>();
  try { for (const [a, b] of store.loadBlocks()) { if (!m.has(a)) m.set(a, new Set()); m.get(a)!.add(b); } } catch {}
  blocks = m;
  return m;
}
/** True when either player blocked the other (empty tags never match). */
export function blockedPair(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b || a === b) return false;
  const m = blockMap();
  return !!(m.get(a)?.has(b) || m.get(b)?.has(a));
}
export function setBlock(blocker: string, blocked: string, on: boolean, now = Date.now()): boolean {
  if (!blocker || !blocked || blocker === blocked) return false;
  const m = blockMap();
  const set = m.get(blocker) || new Set<string>();
  if (on) { if (set.size >= 500) return false; set.add(blocked); m.set(blocker, set); } else set.delete(blocked);
  try { store.saveBlock(blocker, blocked, on, now); persist("block"); } catch {}
  return true;
}

// ---------- reports ----------
export function cleanReason(v: unknown): string { const s = String(v ?? ""); return s in REPORT_REASONS ? s : "other"; }
export function cleanNote(v: unknown): string {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
}
/** Saves one report. Same reporter + same player + same room within 10 minutes counts once. */
export function addReport(input: Omit<ReportRow, "id" | "status" | "created_at">, now = Date.now()): { ok: true; dup: boolean; id?: string } {
  if (store.recentReport(input.reporter_tag, input.target_id, input.room, now - 600_000)) return { ok: true, dup: true };
  const id = crypto.randomUUID();
  store.saveReport({ ...input, id, status: "open", created_at: now });
  persist("report");
  return { ok: true, dup: false, id };
}
export const listReports = (limit = 200, status = "open") => store.listReports(Math.max(1, Math.min(limit, 500)), status);
export const setReportStatus = (id: string, status: string) => ["open", "done", "dismissed"].includes(status) && store.setStatus(String(id).slice(0, 64), status);

/** In-memory: who reported whom in each live room, for the "3 reporters = out of voice" rule. */
const roomReports = new Map<string, Map<string, Set<string>>>(); // room -> target player id -> reporter keys
export function noteRoomReport(room: string, targetId: string, reporterKey: string): number {
  let r = roomReports.get(room); if (!r) { r = new Map(); roomReports.set(room, r); }
  let s = r.get(targetId); if (!s) { s = new Set(); r.set(targetId, s); }
  s.add(reporterKey);
  if (roomReports.size > 5000) roomReports.delete(roomReports.keys().next().value as string);
  return s.size;
}
export function voiceBanned(room: string, targetId: string): boolean { return (roomReports.get(room)?.get(targetId)?.size || 0) >= VOICE_KICK_REPORTERS; }
export function forgetRoom(room: string) { roomReports.delete(room); }

// ---------- owner review (/admin/reports, same BA_ADMIN_KEY as /admin/verify) ----------
type Send = (res: Response, status: number, body: unknown) => void;
export function registerSafetyAdmin(app: Express, gate: (req: Request, res: Response, send: Send) => boolean, send: Send): void {
  app.get("/api/v3/admin/reports", (req, res) => {
    if (!gate(req, res, send)) return;
    const status = ["open", "done", "dismissed", "all"].includes(String(req.query.status)) ? String(req.query.status) : "open";
    send(res, 200, { reasons: REPORT_REASONS, reports: listReports(200, status) });
  });
  app.post("/api/v3/admin/reports/:id", (req, res) => {
    if (!gate(req, res, send)) return;
    const ok = setReportStatus(String(req.params.id), String((req.body || {}).status || ""));
    send(res, ok ? 200 : 404, { ok });
  });
  app.get("/admin/reports", (_req, res) => { res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Robots-Tag", "noindex"); res.type("html").send(REPORTS_HTML); });

}

// v3.9.0 owner page for player reports (same BA_ADMIN_KEY as /admin/verify, kept in this browser tab only).
const REPORTS_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Bible Arena · Player reports</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0 auto;background:#070C1A;color:#E8E6DF;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;padding:16px;max-width:760px}
h1{font-size:20px;color:#F5B942}.card{background:#111a33;border:1px solid #23305a;border-radius:14px;padding:14px;margin:12px 0}.muted{color:#9aa3b8;font-size:13px}button,select,input{font:inherit;border-radius:10px;border:1px solid #23305a;background:#0b1430;color:#E8E6DF;padding:8px 12px}button{cursor:pointer}</style></head>
<body><h1>Player reports</h1><div id="login" class="card" hidden><input id="k" type="password" placeholder="Admin key" style="width:100%"><p><button id="go">Open</button></p><p id="lerr" class="muted"></p></div>
<div id="main" hidden><p><select id="st"><option value="open">Open</option><option value="done">Handled</option><option value="dismissed">Dismissed</option><option value="all">All</option></select> <button id="rf">Refresh</button> <button id="out">Sign out</button></p><div id="list"></div></div>
<script>
const $=(s)=>document.querySelector(s);const esc=(s)=>String(s==null?"":s).replace(/[&<>"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let K=sessionStorage.getItem("ba-admin")||"";let R={};
async function api(p,b){const r=await fetch(p,{method:b?"POST":"GET",headers:{"Content-Type":"application/json","x-admin-key":K},body:b?JSON.stringify(b):undefined});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.error||r.status),{status:r.status});return d}
async function load(){let d;try{d=await api("/api/v3/admin/reports?status="+$("#st").value)}catch(e){$("#main").hidden=true;$("#login").hidden=false;$("#lerr").textContent=e.status==403?"Wrong key.":e.status==429?"Too many tries. Wait 15 minutes.":e.status==503?"Admin key not set on the server.":"Error: "+e.message;return}
$("#login").hidden=true;$("#main").hidden=false;R=d.reasons||{};const L=d.reports||[];
$("#list").innerHTML=L.length?L.map((r)=>'<div class="card"><b>'+esc(r.target_name)+'</b> <span class="muted">reported by '+esc(r.reporter_name)+' · game '+esc(r.room)+' · '+new Date(r.created_at).toLocaleString()+(r.in_voice?' · was in voice':'')+'</span><div>'+esc(R[r.reason]||r.reason)+(r.note?': '+esc(r.note):'')+'</div><div class="muted">player tag '+esc(r.target_tag||"none")+' · status '+esc(r.status)+'</div><p><button data-id="'+esc(r.id)+'" data-s="done">Handled</button> <button data-id="'+esc(r.id)+'" data-s="dismissed">Dismiss</button></p></div>').join(""):'<p class="muted">No reports here.</p>'}
document.addEventListener("click",async(e)=>{const b=e.target.closest("button");if(!b)return;if(b.id==="go"){K=$("#k").value.trim();sessionStorage.setItem("ba-admin",K);return load()}if(b.id==="rf")return load();if(b.id==="out"){sessionStorage.removeItem("ba-admin");location.reload();return}
if(b.dataset.id){try{await api("/api/v3/admin/reports/"+b.dataset.id,{status:b.dataset.s});load()}catch(err){alert("Failed: "+err.message)}}});
$("#st").onchange=load;if(K)load();else $("#login").hidden=false;
</script></body></html>`;
