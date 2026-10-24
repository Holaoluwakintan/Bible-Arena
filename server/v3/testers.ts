// Bible Arena v3.11.2: "Become a tester" sign-up page for the Google Play closed test (Michael, Oct 24 2026).
// Public page /test (mobile-first, own OG card) -> POST /api/v3/testers. Owner list at /admin/testers (same BA_ADMIN_KEY gate as
// /admin/reports): count, list, CSV download, comma-separated email list for Play Console's tester list, "mark as added to Play".
// Storage: the server's own SQLite (table created here, like v3_reports), snapshotted to Postgres by server/persist.ts.
// No Postgres schema change. Spam guards: email format check, de-dup (Gmail dots/+tags count as the same inbox), a hidden
// honeypot field, and a per-IP limit (10 tries per 10 minutes, 80 per day; mobile carriers share IPs).
import crypto from "node:crypto";
import type { Express, Request, Response } from "express";

export interface TesterRow {
  key: string; email: string; name: string; phone: string; platform: "android" | "iphone";
  status: "new" | "added"; ip_tag: string; created_at: number; updated_at: number;
}
type SqlDb = { exec(sql: string): void; prepare(sql: string): { run(...a: any[]): any; get(...a: any[]): any; all(...a: any[]): any[] } };
export interface TesterStore {
  get(key: string): TesterRow | undefined;
  insert(r: TesterRow): void;
  update(key: string, f: { name: string; phone: string; platform: string; updated_at: number }): void;
  list(): TesterRow[];
  setStatus(keys: string[], status: string): number;
  remove(key: string): boolean;
}

// ---------- validation ----------
const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}$/;
export function cleanEmail(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase().replace(/^mailto:/, "");
  if (s.length > 254 || !EMAIL_RE.test(s) || s.includes("..") || s.split("@")[0].startsWith(".") || s.split("@")[0].endsWith(".")) return "";
  const g = s.replace(/@googlemail\.com$/, "@gmail.com");
  return /@gmail\.com$/.test(g) ? g.replace(/\+[^@]*@/, "@") : g; // the Google account itself, without a +tag
}
/** One key per real inbox: Gmail ignores dots and anything after "+". */
export function emailKey(email: string): string {
  const [u, d] = email.split("@");
  if (d === "gmail.com") return u.split("+")[0].replace(/\./g, "") + "@gmail.com";
  return u.split("+")[0] + "@" + d;
}
export const isGmail = (email: string) => /@gmail\.com$/.test(email);
export function cleanText(v: unknown, max: number): string {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f<>"`]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
export const cleanPlatform = (v: unknown): "android" | "iphone" => (String(v ?? "").toLowerCase() === "iphone" ? "iphone" : "android");
const ipTag = (ip: string) => crypto.createHash("sha256").update("ba-tester-ip-v1:" + ip).digest("base64url").slice(0, 12);

// ---------- storage ----------
function sqliteStore(getDb: () => SqlDb): TesterStore {
  let ready = false;
  const db = () => {
    const d = getDb();
    if (!ready) {
      d.exec(`CREATE TABLE IF NOT EXISTS v3_testers (
          key TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
          platform TEXT NOT NULL DEFAULT 'android', status TEXT NOT NULL DEFAULT 'new', ip_tag TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS v3_testers_when ON v3_testers(created_at);`);
      ready = true;
    }
    return d;
  };
  return {
    get: (key) => db().prepare("SELECT * FROM v3_testers WHERE key = ?").get(key) as TesterRow | undefined,
    insert: (r) => { db().prepare(`INSERT OR IGNORE INTO v3_testers (key, email, name, phone, platform, status, ip_tag, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(r.key, r.email, r.name, r.phone, r.platform, r.status, r.ip_tag, r.created_at, r.updated_at); },
    update: (key, f) => { db().prepare("UPDATE v3_testers SET name = ?, phone = ?, platform = ?, updated_at = ? WHERE key = ?").run(f.name, f.phone, f.platform, f.updated_at, key); },
    list: () => db().prepare("SELECT * FROM v3_testers ORDER BY created_at ASC LIMIT 20000").all() as TesterRow[],
    setStatus: (keys, status) => { let n = 0; const st = db().prepare("UPDATE v3_testers SET status = ? WHERE key = ?"); for (const k of keys) n += Number(st.run(status, k).changes || 0); return n; },
    remove: (key) => Number(db().prepare("DELETE FROM v3_testers WHERE key = ?").run(key).changes || 0) > 0,
  };
}
export function memoryStore(): TesterStore & { rows: TesterRow[] } {
  const rows: TesterRow[] = [];
  return {
    rows,
    get: (key) => rows.find((r) => r.key === key),
    insert: (r) => { if (!rows.some((x) => x.key === r.key)) rows.push({ ...r }); },
    update: (key, f) => { const r = rows.find((x) => x.key === key); if (r) Object.assign(r, f); },
    list: () => rows.slice().sort((a, b) => a.created_at - b.created_at),
    setStatus: (keys, status) => { let n = 0; for (const r of rows) if (keys.includes(r.key)) { r.status = status as any; n++; } return n; },
    remove: (key) => { const i = rows.findIndex((x) => x.key === key); if (i < 0) return false; rows.splice(i, 1); return true; },
  };
}
let store: TesterStore = memoryStore();
let persist: (why: string) => void = () => {};
export function initTesterStore(getDb: () => SqlDb, snapshotNow: (why: string) => Promise<unknown>) {
  store = sqliteStore(getDb); persist = (why) => { snapshotNow(why).catch(() => {}); };
}
export function _setTesterStore(s: TesterStore, p: (why: string) => void = () => {}) { store = s; persist = p; hits.clear(); }

// ---------- per-IP limit ----------
export const LIMITS = { shortMax: 10, shortMs: 10 * 60_000, dayMax: 80 } // generous: mobile networks put many phones behind one IP;
const hits = new Map<string, { s: number; sReset: number; d: number; dReset: number }>();
export function allowIp(ip: string, now = Date.now()): boolean {
  let h = hits.get(ip);
  if (!h) { h = { s: 0, sReset: now + LIMITS.shortMs, d: 0, dReset: now + 86_400_000 }; hits.set(ip, h); }
  if (h.sReset <= now) { h.s = 0; h.sReset = now + LIMITS.shortMs; }
  if (h.dReset <= now) { h.d = 0; h.dReset = now + 86_400_000; }
  if (h.s >= LIMITS.shortMax || h.d >= LIMITS.dayMax) return false;
  h.s++; h.d++;
  if (hits.size > 20_000) for (const [k, v] of hits) if (v.dReset <= now) hits.delete(k);
  return true;
}
const ipOf = (req: Request) => { const f = req.headers["x-forwarded-for"]; return (typeof f === "string" ? f.split(",")[0].trim() : req.ip) || "ip"; };

// ---------- sign-up ----------
export type SignupResult =
  | { ok: true; dup: boolean; platform: "android" | "iphone"; bot?: true }
  | { ok: false; status: number; error: string; message: string };
export function signup(body: any, ip: string, now = Date.now()): SignupResult {
  body = body && typeof body === "object" ? body : {};
  const platform = cleanPlatform(body.platform);
  // honeypot: real people never see or fill "website"; bots get a normal-looking success and nothing is stored
  if (String(body.website ?? "").trim()) return { ok: true, dup: false, platform, bot: true };
  if (!allowIp(ip, now)) return { ok: false, status: 429, error: "too_many", message: "Too many sign-ups from this network. Try again in a few minutes." };
  const email = cleanEmail(body.email);
  if (!email) return { ok: false, status: 400, error: "bad_email", message: "That email doesn't look right. Check it and try again." };
  const name = cleanText(body.name, 60), phone = cleanText(body.phone, 60);
  const key = emailKey(email);
  const old = store.get(key);
  if (old) {
    store.update(key, { name: name || old.name, phone: phone || old.phone, platform, updated_at: now });
    persist("tester");
    return { ok: true, dup: true, platform };
  }
  store.insert({ key, email, name, phone, platform, status: "new", ip_tag: ipTag(ip), created_at: now, updated_at: now });
  persist("tester");
  return { ok: true, dup: false, platform };
}

export function summary() {
  const rows = store.list();
  const android = rows.filter((r) => r.platform === "android");
  return {
    total: rows.length, android: android.length, iphone: rows.length - android.length,
    androidNew: android.filter((r) => r.status === "new").length, playMin: 12,
    rows: rows.map(({ ip_tag, ...r }) => r),
  };
}
const csvCell = (v: unknown) => { let s = String(v ?? ""); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function toCsv(rows: TesterRow[]): string {
  const head = ["email", "name", "phone_model", "platform", "status", "signed_up_utc"];
  return [head.join(","), ...rows.map((r) => [r.email, r.name, r.phone, r.platform, r.status === "added" ? "added_to_play" : "new", new Date(r.created_at).toISOString()].map(csvCell).join(","))].join("\r\n") + "\r\n";
}
export function emailList(which: "new" | "all"): string {
  return store.list().filter((r) => r.platform === "android" && (which === "all" || r.status === "new")).map((r) => r.email).join(", ");
}

// ---------- routes ----------
type Send = (res: Response, status: number, body: unknown) => void;
export function registerTesters(app: Express, gate: (req: Request, res: Response, send: Send) => boolean, send: Send): void {
  app.get(["/test", "/test/", "/testers", "/beta"], (req, res) => {
    if (req.path !== "/test") return res.redirect(301, "/test");
    const origin = `${req.protocol}://${req.get("host")}`;
    res.setHeader("Cache-Control", "no-cache");
    res.type("html").send(TEST_HTML.replace(/__ORIGIN__/g, origin));
  });
  app.post("/api/v3/testers", (req, res) => {
    const r = signup(req.body, ipOf(req));
    if (!r.ok) return send(res, r.status, { error: r.error, message: r.message });
    send(res, 200, { ok: true, dup: r.dup, platform: r.platform });
  });

  app.get("/api/v3/admin/testers", (req, res) => {
    if (!gate(req, res, send)) return;
    send(res, 200, { ...summary(), listNew: emailList("new"), listAll: emailList("all") });
  });
  app.get("/api/v3/admin/testers.csv", (req, res) => {
    if (!gate(req, res, send)) return;
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Disposition", `attachment; filename="bible-arena-testers-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.type("text/csv").send("\ufeff" + toCsv(store.list()));
  });
  app.post("/api/v3/admin/testers/status", (req, res) => {
    if (!gate(req, res, send)) return;
    const b = req.body || {};
    const status = b.status === "new" ? "new" : "added";
    const keys = (Array.isArray(b.keys) ? b.keys : []).map((k: unknown) => String(k).slice(0, 300)).slice(0, 20000);
    const n = store.setStatus(keys, status); if (n) persist("tester-status");
    send(res, 200, { ok: true, changed: n });
  });
  app.post("/api/v3/admin/testers/delete", (req, res) => {
    if (!gate(req, res, send)) return;
    const ok = store.remove(String((req.body || {}).key || "").slice(0, 300)); if (ok) persist("tester-delete");
    send(res, ok ? 200 : 404, { ok });
  });
  app.get("/admin/testers", (_req, res) => { res.setHeader("Cache-Control", "no-store"); res.setHeader("X-Robots-Tag", "noindex"); res.type("html").send(ADMIN_HTML); });
}

// ---------- public page ----------
const TEST_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#070C1A">
<title>Become a Bible Arena tester</title>
<meta name="description" content="Get the Bible Arena Android app on Google Play before everyone else. Solo play, live group games, story mode and a daily challenge. Free.">
<meta property="og:title" content="Become a Bible Arena tester 🎮"><meta property="og:description" content="Get the Android app on Google Play before everyone else. Solo play, live group games, story mode and a daily challenge. Free, sign up in 20 seconds.">
<meta property="og:image" content="__ORIGIN__/v3/og-test.jpg?v=3.11.2"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Bible Arena: become a tester">
<meta property="og:url" content="__ORIGIN__/test"><meta property="og:type" content="website"><meta property="og:site_name" content="Bible Arena"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/v3/icon-192.png"><link rel="preload" href="/v3/fonts/jakarta-latin.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/v3/fonts/cinzel-latin.woff2" as="font" type="font/woff2" crossorigin>
<style>
@font-face{font-family:'Cinzel';font-weight:700 800;font-display:swap;src:url(/v3/fonts/cinzel-latin.woff2) format('woff2')}
@font-face{font-family:'Plus Jakarta Sans';font-weight:400 800;font-display:swap;src:url(/v3/fonts/jakarta-latin.woff2) format('woff2')}
:root{--bg:#070C1A;--card:#121C3A;--card2:#0C1430;--line:rgba(245,185,66,.18);--line2:rgba(255,255,255,.08);--gold:#F5B942;--gold2:#FFD98A;--gold3:#C98A1B;--ivory:#F6F1E7;--muted:#9AA6C2;--ok:#3DDC97;--bad:#FF5D73}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ivory);font:16px/1.45 "Plus Jakarta Sans",system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
body{background:radial-gradient(520px 340px at 90% -60px,rgba(245,185,66,.20),transparent 70%),radial-gradient(420px 300px at -80px 40%,rgba(90,184,255,.10),transparent 70%),var(--bg);min-height:100vh}
.wrap{max-width:480px;margin:0 auto;padding:18px 16px calc(28px + env(safe-area-inset-bottom))}
.top{display:flex;align-items:center;gap:10px}.emblem{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font:800 19px Cinzel,Georgia,serif;color:#1B1305;background:conic-gradient(from 210deg,#FFE7AE,var(--gold),#B97A12,var(--gold),#FFE7AE);box-shadow:0 6px 18px rgba(245,185,66,.2)}
.brand{font:800 17px Cinzel,Georgia,serif;letter-spacing:.16em;background:linear-gradient(180deg,var(--gold2),var(--gold3));-webkit-background-clip:text;background-clip:text;color:transparent}
.pill{display:inline-block;margin:22px 0 10px;padding:5px 12px;border-radius:99px;background:rgba(245,185,66,.14);border:1px solid rgba(245,185,66,.45);color:var(--gold2);font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
h1{margin:0;font:800 30px/1.15 Cinzel,Georgia,serif;letter-spacing:.01em;background:linear-gradient(180deg,#FFE7AE,var(--gold) 60%,var(--gold3));-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{color:var(--muted);margin:10px 0 18px;font-size:15.5px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px}
.f{border-radius:18px;padding:13px 12px;border:1px solid var(--line2);background:linear-gradient(160deg,var(--card),var(--card2))}
.f i{font-style:normal;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;font-size:19px;background:rgba(255,255,255,.07)}
.f b{display:block;margin-top:8px;font-size:15px}.f span{font-size:12.5px;color:var(--muted)}
.card{scroll-margin-top:12px;border-radius:22px;padding:18px 16px;border:1px solid var(--line);background:linear-gradient(150deg,#1A2547 0%,#111A36 55%,#1C1A2A 100%);box-shadow:0 10px 40px rgba(0,0,0,.35)}
.card h2{margin:0 0 4px;font-size:19px}.hint{color:var(--muted);font-size:13px;margin:0 0 14px}
label{display:block;font-weight:700;font-size:14px;margin:12px 0 6px}label small{color:var(--muted);font-weight:500}
input[type=email],input[type=text]{width:100%;min-height:50px;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:#0A1129;color:var(--ivory);font:inherit;font-size:16px;outline:none}
input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(245,185,66,.18)}
.seg{display:grid;grid-template-columns:1fr 1fr;gap:8px}.seg button{min-height:48px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:#0A1129;color:var(--ivory);font:inherit;font-weight:700;cursor:pointer}
.seg button.on{border-color:var(--gold);background:rgba(245,185,66,.14);color:var(--gold2)}
.note{margin-top:10px;padding:10px 12px;border-radius:12px;font-size:13.5px;background:rgba(90,184,255,.10);border:1px solid rgba(90,184,255,.3);color:#cfe6ff}
.warn{background:rgba(245,185,66,.10);border-color:rgba(245,185,66,.35);color:var(--gold2)}.err{background:rgba(255,93,115,.12);border-color:rgba(255,93,115,.4);color:#ffc2cb}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:54px;margin-top:16px;border:0;border-radius:16px;font:inherit;font-weight:800;font-size:16.5px;text-decoration:none;cursor:pointer}
.primary{background:linear-gradient(180deg,#FFD98A,var(--gold) 45%,#D9951E);color:#1B1305;box-shadow:0 6px 24px rgba(245,185,66,.25),inset 0 1px 0 rgba(255,255,255,.5)}
.primary[disabled]{opacity:.6}.wa{background:#25D366;color:#062b14}.ghost{background:rgba(255,255,255,.06);border:1px solid var(--line2);color:var(--ivory)}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.small{font-size:12.5px;color:var(--muted);margin-top:12px;text-align:center}.small a{color:var(--gold2)}
.steps{margin:14px 0 0;padding:0;list-style:none}.steps li{display:flex;gap:10px;margin:8px 0;font-size:14.5px}.steps b{flex:none;width:24px;height:24px;border-radius:99px;display:grid;place-items:center;background:rgba(245,185,66,.16);color:var(--gold2);font-size:13px}
.done{text-align:center}.big{font-size:46px;margin:4px 0 2px}.done h2{font-size:22px}.done p{color:var(--muted);margin:8px 0}
.foot{margin-top:18px;text-align:center;color:var(--muted);font-size:12.5px}
</style></head><body><div class="wrap">
<div class="top"><div class="emblem">B</div><div class="brand">BIBLE ARENA</div></div>
<div class="pill">Android testers wanted</div>
<h1>Play Bible Arena before everyone else</h1>
<p class="lead">The fast Bible quiz game is coming to Google Play. Join the first testers, get the app free and help us make it great.</p>
<a id="jump" class="btn primary" href="#formcard" style="margin:0 0 18px">Become a tester ↓</a>
<div class="grid">
<div class="f"><i>🎯</i><b>Solo play</b><span>Quick rounds, every answer with its verse</span></div>
<div class="f"><i>🎮</i><b>Live group games</b><span>Play friends in real time with a code</span></div>
<div class="f"><i>🗺️</i><b>Story mode</b><span>Genesis to Revelation, level by level</span></div>
<div class="f"><i>📅</i><b>Daily challenge</b><span>New questions every day, keep your streak</span></div>
</div>
<div class="card" id="formcard"><form id="f" novalidate autocomplete="on">
<h2>Become a tester</h2><p class="hint">Takes 20 seconds. Free.</p>
<label for="em">Gmail address</label>
<input id="em" name="email" type="email" inputmode="email" autocomplete="email" placeholder="you@gmail.com" required maxlength="254">
<div class="hint" style="margin:6px 0 0">Use the Google account on your phone's Play Store. Testing on Google Play only works with a Google account.</div>
<label>Your phone</label>
<div class="seg" role="radiogroup"><button type="button" class="on" data-p="android" aria-pressed="true">🤖 Android</button><button type="button" data-p="iphone" aria-pressed="false">🍎 iPhone</button></div>
<div id="ios" class="note" hidden>Android only for now. We'll tell you when iPhone is ready. Leave your email and you can play in your browser today.</div>
<label for="nm">Name <small>(optional)</small></label><input id="nm" name="name" type="text" autocomplete="name" maxlength="60" placeholder="What should we call you?">
<label for="ph">Phone model <small>(optional)</small></label><input id="ph" name="phone" type="text" maxlength="60" placeholder="e.g. Tecno Spark 20, Samsung A15">
<div class="hp" aria-hidden="true"><label for="ws">Website</label><input id="ws" name="website" type="text" tabindex="-1" autocomplete="off"></div>
<div id="msg" class="note err" hidden></div>
<button id="go" class="btn primary" type="submit">Sign me up</button>
<p class="small">We only use your email for the test invite and Bible Arena news. <a href="/privacy">Privacy</a></p>
</form></div>
<div class="card done" id="donecard" hidden></div>
<ul class="steps" id="how"><li><b>1</b><span>Sign up here with your Gmail.</span></li><li><b>2</b><span>You get an email invite to test on Google Play.</span></li><li><b>3</b><span>Install, play and keep the app for 14 days. Tell us what you think.</span></li></ul>
<div class="foot" id="foot">Can't wait? <a href="https://bible-arena.onrender.com" style="color:var(--gold2)">Play now in your browser</a></div>
</div>
<script>
(function(){var $=function(s){return document.querySelector(s)};var P="android";
var SHARE="I just signed up to test the Bible Arena app 🎮 Bible quiz: solo play, live group games with friends, story mode and a daily challenge. Join me as a tester: "+location.origin+"/test";
document.querySelectorAll(".seg button").forEach(function(b){b.onclick=function(){P=b.dataset.p;document.querySelectorAll(".seg button").forEach(function(x){x.classList.toggle("on",x===b);x.setAttribute("aria-pressed",x===b?"true":"false")});$("#ios").hidden=P!=="iphone";$("#go").textContent=P==="iphone"?"Tell me when iPhone is ready":"Sign me up";}});
var RE=/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/;var warned="";
function show(t,cls){var m=$("#msg");m.textContent=t;m.className="note "+(cls||"err");m.hidden=!t}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
$("#f").onsubmit=function(e){e.preventDefault();var em=$("#em").value.trim().toLowerCase();
if(!RE.test(em)){show("Please enter a valid email, like you@gmail.com.");$("#em").focus();return}
if(P==="android"&&!/@(gmail|googlemail)\\.com$/.test(em)&&warned!==em){warned=em;show("Not a Gmail? That's OK only if it's the Google account you use on Play Store. Tap Sign me up again to confirm.","warn");return}
show("");var b=$("#go");b.disabled=true;b.textContent="Signing you up…";
fetch("/api/v3/testers",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:em,name:$("#nm").value,phone:$("#ph").value,platform:P,website:$("#ws").value})})
.then(function(r){return r.json().catch(function(){return{}}).then(function(d){return{ok:r.ok,d:d}})})
.then(function(x){if(!x.ok){throw new Error(x.d.message||"Something went wrong. Try again.")}done(em,x.d)})
.catch(function(err){show(err.message&&err.message.length<140?err.message:"No connection. Check your internet and try again.");b.disabled=false;b.textContent=P==="iphone"?"Tell me when iPhone is ready":"Sign me up"})};
function done(em,d){var ios=P==="iphone";var h="<div class=big>"+(ios?"📱":"🎉")+"</div><h2>"+(d.dup?"You're already on the list!":"You're on the list!")+"</h2>";
h+=ios?"<p>Android only for now. We'll tell you at <b>"+esc(em)+"</b> when iPhone is ready.</p><p>Meanwhile, Bible Arena works in your phone's browser.</p>"
:"<p>You'll get an email invite to test on Google Play soon, sent to <b>"+esc(em)+"</b>.</p><p>Check your Promotions and Spam folders too.</p>";
h+="<a class='btn primary' href='https://bible-arena.onrender.com'>▶ Play now in your browser</a>";
h+="<a class='btn wa' id=wa href='https://wa.me/?text="+encodeURIComponent(SHARE)+"' target=_blank rel=noopener>Share on WhatsApp, bring friends</a>";
h+="<button class='btn ghost' id=cp type=button>Copy link</button>";
$("#formcard").hidden=true;$("#how").hidden=true;$("#jump").hidden=true;$("#foot").hidden=true;var c=$("#donecard");c.innerHTML=h;c.hidden=false;c.scrollIntoView({block:"start"});
$("#cp").onclick=function(){var u=location.origin+"/test";(navigator.clipboard?navigator.clipboard.writeText(u):Promise.reject()).then(function(){$("#cp").textContent="Link copied ✓"},function(){prompt("Copy this link",u)})}}
})();
</script></body></html>`;

// ---------- owner page (/admin/testers, same BA_ADMIN_KEY as /admin/reports, kept in this browser tab only) ----------
const ADMIN_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Bible Arena · Testers</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0 auto;background:#070C1A;color:#E8E6DF;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;padding:16px;max-width:820px}
h1{font-size:20px;color:#F5B942;margin:4px 0 8px}h2{font-size:16px;margin:18px 0 6px}.card{background:#111a33;border:1px solid #23305a;border-radius:14px;padding:14px;margin:12px 0}.muted{color:#9aa3b8;font-size:13px}
button,input,select{font:inherit;border-radius:10px;border:1px solid #23305a;background:#0b1430;color:#E8E6DF;padding:8px 12px}button{cursor:pointer;margin:4px 6px 4px 0}.gold{background:#F5B942;color:#1B1305;border-color:#F5B942;font-weight:700}
textarea{width:100%;min-height:90px;background:#0b1430;color:#E8E6DF;border:1px solid #23305a;border-radius:10px;padding:10px;font:13px/1.4 ui-monospace,Menlo,monospace}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.stat{background:#0b1430;border:1px solid #23305a;border-radius:12px;padding:10px;text-align:center}.stat b{display:block;font-size:24px;color:#F5B942}.stat span{font-size:12px;color:#9aa3b8}
.bar{height:8px;border-radius:9px;background:#23305a;overflow:hidden;margin-top:10px}.bar i{display:block;height:100%;background:linear-gradient(90deg,#C98A1B,#FFD98A)}
table{width:100%;border-collapse:collapse;font-size:13.5px}td,th{padding:7px 6px;border-bottom:1px solid #1d2850;text-align:left;vertical-align:top}th{color:#9aa3b8;font-weight:600}.tag{display:inline-block;padding:1px 8px;border-radius:99px;font-size:12px;background:#23305a}.tag.new{background:#3DDC97;color:#04210f}
.x{background:none;border:0;color:#FF5D73;padding:0 4px;margin:0}@media(max-width:560px){.stats{grid-template-columns:repeat(2,1fr)}.hide-s{display:none}}</style></head>
<body><h1>🎮 Bible Arena testers</h1><div id="login" class="card" hidden><p class="muted">Same admin key as Player reports.</p><input id="k" type="password" placeholder="Admin key" autocomplete="current-password" style="width:100%"><p><button class="gold" id="go">Open</button></p><p id="lerr" class="muted"></p></div>
<div id="main" hidden>
<div class="card"><div class="stats"><div class="stat"><b id="sA">0</b><span>Android</span></div><div class="stat"><b id="sN">0</b><span>New (not added to Play)</span></div><div class="stat"><b id="sI">0</b><span>iPhone (waiting)</span></div><div class="stat"><b id="sT">0</b><span>Total sign-ups</span></div></div>
<div class="bar"><i id="pb" style="width:0"></i></div><p class="muted" id="pt"></p>
<p><button id="rf">↻ Refresh</button><button id="csv">⬇ Download CSV</button><button id="out">Sign out</button></p><p class="muted">Public sign-up page: <a style="color:#7cc4ff" href="/test" target="_blank">/test</a></p></div>
<div class="card"><h2 style="margin-top:0">Emails for Play Console</h2><p class="muted">Play Console → Testing → Closed testing → Testers → your email list → paste. Android sign-ups only.</p>
<p><select id="which"><option value="new">New only (not added yet)</option><option value="all">All Android</option></select> <button class="gold" id="copy">Copy</button><button id="dl">⬇ .txt</button><button id="mark">✓ Mark these as added to Play</button></p>
<textarea id="list" readonly></textarea><p class="muted" id="cnt"></p></div>
<h2>Sign-ups</h2><table><thead><tr><th>Email</th><th class="hide-s">Name</th><th class="hide-s">Phone</th><th>Phone type</th><th>Status</th><th class="hide-s">When</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>
<script>
const $=(s)=>document.querySelector(s);const esc=(s)=>String(s==null?"":s).replace(/[&<>"]/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let K=sessionStorage.getItem("ba-admin")||"";let D=null;
async function api(p,b){const r=await fetch(p,{method:b?"POST":"GET",headers:{"Content-Type":"application/json","x-admin-key":K},body:b?JSON.stringify(b):undefined});if(!r.ok){const d=await r.json().catch(()=>({}));throw Object.assign(new Error(d.error||r.status),{status:r.status})}return r}
function shown(){const w=$("#which").value;return D.rows.filter((r)=>r.platform==="android"&&(w==="all"||r.status==="new"))}
function paintList(){const L=shown();$("#list").value=L.map((r)=>r.email).join(", ");$("#cnt").textContent=L.length+" email"+(L.length===1?"":"s")}
async function load(){try{D=await (await api("/api/v3/admin/testers")).json()}catch(e){$("#main").hidden=true;$("#login").hidden=false;$("#lerr").textContent=e.status==403?"Wrong key.":e.status==429?"Too many tries. Wait 15 minutes.":e.status==503?"Admin key not set on the server.":"Error: "+e.message;return}
$("#login").hidden=true;$("#main").hidden=false;$("#sA").textContent=D.android;$("#sN").textContent=D.androidNew;$("#sI").textContent=D.iphone;$("#sT").textContent=D.total;
$("#pb").style.width=Math.min(100,Math.round(D.android/D.playMin*100))+"%";$("#pt").textContent=D.android>=D.playMin?"✓ "+D.android+" Android testers: past the 12 Google Play needs. Add them, and keep 12+ opted in for 14 days.":D.android+" of the 12 Android testers Google Play needs for 14 days.";
paintList();const rows=D.rows.slice().reverse();
$("#rows").innerHTML=rows.length?rows.map((r)=>"<tr><td>"+esc(r.email)+"</td><td class=hide-s>"+esc(r.name)+"</td><td class=hide-s>"+esc(r.phone)+"</td><td>"+(r.platform==="iphone"?"iPhone":"Android")+"</td><td><span class='tag "+(r.status==="new"?"new":"")+"'>"+(r.status==="new"?"new":"added")+"</span></td><td class=hide-s>"+new Date(r.created_at).toLocaleString()+"</td><td><button class=x title='Delete' data-del='"+esc(r.key)+"'>✕</button></td></tr>").join(""):"<tr><td colspan=7 class=muted>No sign-ups yet.</td></tr>"}
function save(name,type,text){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
document.addEventListener("click",async(e)=>{const b=e.target.closest("button");if(!b)return;
if(b.id==="go"){K=$("#k").value.trim();sessionStorage.setItem("ba-admin",K);return load()}if(b.id==="rf")return load();if(b.id==="out"){sessionStorage.removeItem("ba-admin");location.reload();return}
if(b.id==="csv"){try{const t=await (await api("/api/v3/admin/testers.csv")).text();save("bible-arena-testers-"+new Date().toISOString().slice(0,10)+".csv","text/csv",t)}catch(err){alert("Failed: "+err.message)}return}
if(b.id==="dl"){save("bible-arena-tester-emails.txt","text/plain",$("#list").value);return}
if(b.id==="copy"){const t=$("#list").value;try{await navigator.clipboard.writeText(t);b.textContent="Copied ✓";setTimeout(()=>b.textContent="Copy",1500)}catch{$("#list").select();document.execCommand("copy")}return}
if(b.id==="mark"){const L=shown().filter((r)=>r.status==="new");if(!L.length)return alert("Nothing new to mark.");if(!confirm("Mark "+L.length+" email(s) as added to Play Console?"))return;try{await api("/api/v3/admin/testers/status",{keys:L.map((r)=>r.key),status:"added"});load()}catch(err){alert("Failed: "+err.message)}return}
if(b.dataset.del){if(!confirm("Delete this sign-up?"))return;try{await api("/api/v3/admin/testers/delete",{key:b.dataset.del});load()}catch(err){alert("Failed: "+err.message)}}});
$("#which").onchange=()=>D&&paintList();if(K)load();else $("#login").hidden=false;
</script></body></html>`;
