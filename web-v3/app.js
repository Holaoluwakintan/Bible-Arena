/* Bible Arena v3 — fast, cinematic web game. No framework: built to fly on low-end Android. */
(function () {
"use strict";
window.BA_V = "3.1.0";
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const app = $("#app");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n || 0).toLocaleString("en-US");
const TIER = { b: { name: "Believer", sub: "Warm-up", icon: "🕊️" }, s: { name: "Scholar", sub: "Deeper", icon: "📜" }, t: { name: "Theologian", sub: "Pastor-grade", icon: "👑" } };
const MODES = {
  mixed: { name: "Mixed Arena", icon: "⚔️", desc: "A bit of everything" },
  arena: { name: "Arena Quiz", icon: "🏛️", desc: "People, places, numbers" },
  gap: { name: "Fill in the Gap", icon: "✍️", desc: "Tap the missing words" },
  who: { name: "Who Am I?", icon: "🎭", desc: "Fewer clues, more points" },
  myth: { name: "Bible or Myth", icon: "🧐", desc: "Fact or church folklore?" },
  daily: { name: "Daily Challenge", icon: "☀️", desc: "Same 10 for everyone" },
  sudden: { name: "Sudden Death", icon: "💀", desc: "One mistake ends it" },
};
const ACH = {
  first_round: ["🌱", "First Steps", "Finish a round"], ten_rounds: ["🔁", "Faithful", "10 rounds"], fifty_rounds: ["🏃", "Running the Race", "50 rounds"],
  perfect: ["💯", "Without Blemish", "A perfect round"], theologian_perfect: ["👑", "Rightly Dividing", "Perfect Theologian round"],
  combo_5: ["🔥", "On Fire", "5 in a row"], combo_10: ["⚡", "Pentecost", "10 in a row"], gap_10: ["✍️", "Scribe", "10 perfect gaps"],
  gap_50: ["📜", "Hid in My Heart", "50 perfect gaps"], first_clue: ["🎯", "Discerner", "Who Am I on clue 1"], myth_buster: ["🧐", "Berean", "25 myths judged right"],
  correct_100: ["📖", "Student", "100 correct"], correct_500: ["🎓", "Teacher of the Law", "500 correct"], streak_3: ["🕯️", "Kindled", "3-day streak"],
  streak_7: ["🔥", "Seven Days", "7-day streak"], streak_30: ["🏆", "Steadfast", "30-day streak"], daily_5: ["☀️", "Daily Bread", "5 daily challenges"],
  duel_sent: ["⚔️", "Challenger", "Send a pastor duel"], duel_won: ["🥇", "Giant Slayer", "Win a duel"], duel_5: ["🛡️", "Mighty Man", "Win 5 duels"],
  rematch: ["🔄", "Seventy Times Seven", "Ask for a rematch"], church: ["⛪", "One Body", "Join the Pastors' League"],
  rank_elder: ["🧔", "Elder", "Reach Elder"], rank_apostle: ["✨", "Apostle", "Reach Apostle"],
};
const RANKS = [["Seeker", 0], ["Disciple", 600], ["Servant", 1800], ["Watchman", 4000], ["Scribe", 8000], ["Elder", 14000], ["Prophet", 24000], ["Apostle", 40000]];
function rankOf(xp) {
  xp = xp || 0; let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1][1]) i++;
  const cur = RANKS[i], next = RANKS[i + 1];
  const p = next ? (xp - cur[1]) / (next[1] - cur[1]) : 1;
  const div = next ? Math.min(3, Math.floor(p * 3) + 1) : 3;
  return { index: i, name: cur[0], division: ["I", "II", "III"][div - 1], next: next ? next[0] : null, nextXp: next ? next[1] : null, progress: p };
}

// ---------- local state ----------
const LS = "ba3:v1";
const S = Object.assign({ name: "", church: "", tier: "s", sound: true, haptics: true, onboarded: false, imported: false, seen: {} }, safeJSON(localStorage.getItem(LS)) || {});
function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }
function safeJSON(s) { try { return JSON.parse(s); } catch (e) { return null; } }
let ME = { user: null, player: null };
let BANK = null, BY = {};

// ---------- feedback: sound + haptics ----------
let ac = null;
function audio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return ac; }
function tone(freqs, dur, type, vol, gap) {
  if (!S.sound) return; const a = audio(); if (!a) return;
  if (a.state === "suspended") a.resume();
  let t = a.currentTime;
  freqs.forEach((f) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
    t += gap == null ? dur * 0.7 : gap;
  });
}
const sfx = {
  tap: () => tone([520], 0.06, "triangle", 0.08),
  ok: () => tone([660, 880, 1320], 0.16, "sine", 0.16, 0.08),
  bad: () => tone([220, 160], 0.22, "sawtooth", 0.07, 0.12),
  tick: () => tone([1000], 0.04, "square", 0.04),
  win: () => tone([523, 659, 784, 1047, 1319], 0.22, "triangle", 0.16, 0.11),
  chip: () => tone([740], 0.05, "triangle", 0.07),
};
function buzz(p) { if (S.haptics && navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }
function toast(msg, ms) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), ms || 2200); }
function confetti(n) {
  const box = document.createElement("div"); box.className = "confetti";
  const colors = ["#F5B942", "#FFD98A", "#3DDC97", "#9B8CFF", "#5AB8FF", "#FF8A65"];
  for (let i = 0; i < (n || 60); i++) {
    const p = document.createElement("i");
    p.style.left = Math.random() * 100 + "vw"; p.style.background = colors[i % colors.length];
    p.style.setProperty("--dx", (Math.random() * 120 - 60) + "px");
    p.style.animationDuration = 1.6 + Math.random() * 1.6 + "s"; p.style.animationDelay = Math.random() * 0.4 + "s";
    box.appendChild(p);
  }
  document.body.appendChild(box); setTimeout(() => box.remove(), 4000);
}

// ---------- API ----------
async function api(path, opts) {
  opts = opts || {};
  const r = await fetch(path, { method: opts.body ? "POST" : "GET", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-client-platform": "web" }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let data = null; try { data = await r.json(); } catch (e) {}
  if (!r.ok) { const err = new Error((data && data.error) || "http_" + r.status); err.status = r.status; err.data = data; throw err; }
  return data;
}
async function ensureSession() {
  try { ME = await api("/api/v3/me"); } catch (e) { ME = { user: null, player: null }; }
  if (!ME.user) {
    try { await api("/api/auth/guest", { body: {} }); ME = await api("/api/v3/me"); } catch (e) {}
  }
  return ME;
}
async function loadBank() {
  if (BANK) return BANK;
  const r = await fetch("/v3/bank.json?v=" + (window.BA_V || "1"));
  BANK = await r.json(); BANK.items.forEach((i) => (BY[i.id] = i));
  return BANK;
}
function legacyXp() {
  try { const o = JSON.parse(localStorage.getItem("bible-arena:local-progress:v1") || "null"); return o ? { xp: (o.progression && o.progression.totalXp) || 0, name: o.displayName || "" } : null; } catch (e) { return null; }
}
async function savePlayer(extra) {
  const body = Object.assign({ name: S.name, church: S.church, tier: S.tier }, extra || {});
  try { const r = await api("/api/v3/player", { body }); ME.player = r.player; } catch (e) {}
}

// ---------- tiny router ----------
let cleanup = [];
function onLeave(fn) { cleanup.push(fn); }
function go(h) { if (location.hash === h) route(); else location.hash = h; }
window.addEventListener("hashchange", route);
function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [p, q] = h.split("?");
  return { parts: (p || "").split("/").filter(Boolean), q: new URLSearchParams(q || "") };
}
function render(html, cls) {
  cleanup.forEach((f) => { try { f(); } catch (e) {} }); cleanup = [];
  // The tab bar lives outside the animated screen: a transformed ancestor would pin it mid-page.
  let tabs = "";
  html = html.replace(/<div class="tabbar">[\s\S]*?<\/nav><\/div>/, (m) => { tabs = m; return ""; });
  app.innerHTML = `<div class="screen ${cls || ""}">${html}</div>`;
  let t = document.getElementById("tabs");
  if (!t) { t = document.createElement("div"); t.id = "tabs"; document.body.appendChild(t); }
  t.innerHTML = tabs;
  window.scrollTo(0, 0);
}
function tabbar(active) {
  const t = (h, i, l, k) => `<a href="${h}" class="${active === k ? "on" : ""}"><i>${i}</i>${l}</a>`;
  return `<div class="tabbar"><nav>${t("#/", "🏠", "Home", "home")}${t("#/duels", "⚔️", "Duels", "duels")}${t("#/ranks", "🏆", "Ranks", "ranks")}${t("#/me", "👤", "Me", "me")}</nav></div>`;
}
async function route() {
  const { parts, q } = parseHash();
  const pathDuel = location.pathname.match(/^\/d\/([A-Za-z0-9]{4,12})/);
  if (pathDuel && !parts.length) { history.replaceState(null, "", "/#/d/" + pathDuel[1].toUpperCase()); return route(); }
  if (!S.onboarded && parts[0] !== "d") return onboarding();
  const [a, b] = parts;
  if (!a) return home();
  if (a === "play") return startMode(b || q.get("mode") || "arena", q.get("tier") || S.tier);
  if (a === "duels") return duelsScreen();
  if (a === "duel" && b === "new") return newDuel(q.get("from"));
  if (a === "d" && b) return acceptDuel(b.toUpperCase());
  if (a === "ranks") return ranks(q.get("tab") || "week");
  if (a === "me") { if (q.get("signedin")) { toast("Signed in with Google ✓"); history.replaceState(null, "", "#/me"); } return profile(); }
  return home();
}

// ---------- onboarding ----------
function onboarding(after) {
  const lx = legacyXp();
  if (!S.name && lx && lx.name) S.name = lx.name;
  render(`
  <div class="col" style="gap:18px;padding-top:4vh">
    <div class="center" style="position:relative">
      <div class="boot-mark">✦</div>
      <h1 class="title-gold" style="font-size:34px;letter-spacing:.14em">BIBLE ARENA</h1>
      <p class="muted" style="margin:6px 0 0">Know the Word. Challenge the World.</p>
    </div>
    <div class="card gold col">
      <div class="field"><label for="nm">What should we call you?</label><input id="nm" maxlength="40" placeholder="e.g. Pastor Michael" value="${esc(S.name)}"></div>
      <div class="field"><label for="ch">Your church or group <span class="dim">(for the Pastors' League, optional)</span></label><input id="ch" maxlength="60" placeholder="e.g. RCCG Jesus House, Ibadan" value="${esc(S.church)}"></div>
    </div>
    <div class="col" style="gap:8px">
      <div class="tiny muted">Choose your level</div>
      <div class="tiers" id="tiers">${["b", "s", "t"].map((k) => `<button class="tier ${S.tier === k ? "on" : ""}" data-t="${k}"><div style="font-size:22px">${TIER[k].icon}</div><b>${TIER[k].name}</b><small>${TIER[k].sub}</small></button>`).join("")}</div>
      <p class="small dim" style="margin:0">Theologian has more blanks, decoys and a faster clock. You can change it any time.</p>
    </div>
    ${lx && lx.xp ? `<div class="card small">🎁 Welcome back! Your <b class="gold">${fmt(lx.xp)} XP</b> from the old Bible Arena comes with you.</div>` : ""}
    <button class="btn primary block" id="go">Enter the Arena</button>
  </div>`);
  $("#tiers").onclick = (e) => { const t = e.target.closest(".tier"); if (!t) return; S.tier = t.dataset.t; $$(".tier").forEach((x) => x.classList.toggle("on", x === t)); sfx.tap(); };
  $("#go").onclick = async () => {
    S.name = $("#nm").value.trim().slice(0, 40) || "Player"; S.church = $("#ch").value.trim().slice(0, 60);
    S.onboarded = true; save(); buzz(15); sfx.ok();
    $("#go").disabled = true; $("#go").textContent = "Opening the gates…";
    await ensureSession();
    const imp = !S.imported && lx && lx.xp && !(ME.player && ME.player.xp) ? lx.xp : 0;
    await savePlayer(imp ? { importXp: imp } : {});
    S.imported = true; save();
    if (after) after(); else go("#/");
  };
}

// ---------- home ----------
const VOD = [
  ["Thy word is a lamp unto my feet, and a light unto my path.", "Psalm 119:105"],
  ["Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word of truth.", "2 Timothy 2:15"],
  ["Thy word have I hid in mine heart, that I might not sin against thee.", "Psalm 119:11"],
  ["The grass withereth, the flower fadeth: but the word of our God shall stand for ever.", "Isaiah 40:8"],
  ["So then faith cometh by hearing, and hearing by the word of God.", "Romans 10:17"],
  ["Heaven and earth shall pass away, but my words shall not pass away.", "Matthew 24:35"],
  ["All scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness:", "2 Timothy 3:16"],
];
function topbar() {
  const p = ME.player || {}; const rk = rankOf(p.xp);
  return `<div class="topbar">
    <div class="emblem" title="${rk.name}">${rk.name[0]}</div>
    <div class="grow">
      <div class="row between"><b>${esc(rk.name)} ${rk.division}</b><span class="small muted">${fmt(p.xp)} XP</span></div>
      <div class="xpbar" style="margin-top:6px"><i style="width:${Math.round(rk.progress * 100)}%"></i></div>
      <div class="small dim" style="margin-top:4px">${rk.next ? `${fmt(rk.nextXp - (p.xp || 0))} XP to ${rk.next}` : "Highest rank"}</div>
    </div>
    <div class="flame" title="Daily streak">🔥 ${p.streak || 0}</div>
  </div>`;
}
async function home() {
  render(`${topbar()}<div id="h"></div>${tabbar("home")}`);
  const day = Math.floor((Date.now() + 3600e3) / 864e5);
  const vod = VOD[day % VOD.length];
  let daily = null;
  try { daily = await api("/api/v3/daily"); } catch (e) {}
  const hello = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";
  const h = $("#h"); if (!h) return;
  h.innerHTML = `
  <div class="col" style="gap:14px">
    <div class="row between"><div><div class="small muted">${hello},</div><h2>${esc(S.name || "friend")}</h2></div>
      <button class="chip on" id="tierchip">${TIER[S.tier].icon} ${TIER[S.tier].name}</button></div>
    <div class="hero">
      <div class="rays"></div>
      <div class="tiny gold">☀️ Daily Challenge · ${esc(daily ? daily.day : "")}</div>
      <h2 style="margin:6px 0 4px;font-family:var(--serif)">${daily && daily.played ? `Done: ${fmt(daily.played.score)} pts` : "Today's 10 for everyone"}</h2>
      <p class="small muted" style="margin:0 0 14px">${daily && daily.played ? `You got ${daily.played.correct}/${daily.played.total}. New challenge in ${untilMidnight()}.` : "Gaps, myths, clues and deep questions. +100 bonus XP. One try only."}</p>
      <div class="row">${daily && daily.played ? `<a class="btn ghost grow" href="#/ranks?tab=daily">See today's board</a>` : `<a class="btn primary grow" href="#/play/daily">Play today's challenge</a>`}</div>
    </div>
    <button class="card gold row" id="duelcta" style="text-align:left;gap:14px">
      <div style="font-size:34px">⚔️</div>
      <div class="grow"><b style="font-size:17px">Challenge a Pastor</b><div class="small muted">Play a set, send the link on WhatsApp. Same questions, who wins?</div></div>
      <div class="gold" style="font-size:22px">›</div>
    </button>
    <div class="card livecta">
      <div class="row" style="gap:12px;align-items:flex-start"><div style="font-size:34px">⛪</div>
        <div class="grow"><div class="tiny" style="color:#FF8A9A">● LIVE · NEW</div><b style="font-size:17px">Church Quiz Night</b><div class="small muted">Put it on the projector. Up to 200 people play on their phones with a code. Teams, podium, confetti.</div></div></div>
      <div class="row" style="margin-top:12px"><a class="btn primary grow" href="/live">Host a quiz night</a><a class="btn ghost grow" href="/join">Join with a code</a></div>
    </div>
    <div class="grid2">
      ${modeTile("gap", true)}${modeTile("who")}${modeTile("myth")}${modeTile("arena")}${modeTile("mixed")}${modeTile("sudden")}
    </div>
    <div class="card">
      <div class="tiny gold">Verse of the day</div>
      <p class="vod" style="margin:8px 0 6px">“${esc(vod[0])}”</p>
      <div class="small muted">${esc(vod[1])} (KJV)</div>
    </div>
    <div class="card">
      <div class="row between"><b>Classic modes</b><span class="small dim">from Bible Arena v2</span></div>
      <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:10px">
        <a class="chip" href="/room">🔴 Live Room (classic)</a><a class="chip" href="/ai-battle">🤖 AI Battle</a><a class="chip" href="/quiz?kind=puzzle">🔤 Word Puzzle</a><a class="chip" href="/friends">👥 Friends</a><a class="chip" href="/play">🏛️ Classic Arena</a>
      </div>
    </div>
    ${androidCard()}
  </div>`;
  $("#duelcta").onclick = () => { sfx.tap(); go("#/duel/new"); };
  $("#tierchip").onclick = () => tierSheet(() => home());
  $$(".mode", h).forEach((m) => (m.onclick = () => { sfx.tap(); buzz(8); go("#/play/" + m.dataset.m); }));
}
function androidCard() {
  if (/[?&]app=android/.test(location.search)) { try { sessionStorage.setItem("ba3:app", "1"); } catch (e) {} }
  let flag = null; try { flag = sessionStorage.getItem("ba3:app"); } catch (e) {}
  const isApp = flag || document.referrer.startsWith("android-app://") || matchMedia("(display-mode: standalone)").matches;
  if (isApp || !/Android/i.test(navigator.userAgent)) return "";
  return `<a class="card row" href="/download" style="text-decoration:none;color:inherit"><div style="font-size:28px">📱</div><div class="grow"><b>Get the Android app</b><div class="small muted">Full screen, one tap from your home screen</div></div><div class="gold">›</div></a>`;
}
function untilMidnight() {
  const now = Date.now() + 3600e3; const left = 864e5 - (now % 864e5);
  const h = Math.floor(left / 36e5), m = Math.floor((left % 36e5) / 6e4); return `${h}h ${m}m`;
}
function modeTile(k, isNew) {
  const m = MODES[k];
  const colors = { gap: "rgba(245,185,66,.18)", who: "rgba(155,140,255,.18)", myth: "rgba(60,201,192,.18)", arena: "rgba(90,184,255,.18)", mixed: "rgba(255,138,101,.18)", sudden: "rgba(255,93,115,.16)" };
  return `<button class="mode" data-m="${k}">${isNew ? `<span class="new">NEW</span>` : ""}<div class="ico" style="background:${colors[k]}">${m.icon}</div><div><b>${m.name}</b><span>${m.desc}</span></div></button>`;
}
function tierSheet(done) {
  const el = document.createElement("div"); el.className = "modal";
  el.innerHTML = `<div class="sheet col"><h2>Choose your level</h2>
    ${["b", "s", "t"].map((k) => `<button class="card row tierpick" data-t="${k}" style="text-align:left;${S.tier === k ? "border-color:var(--gold)" : ""}"><div style="font-size:28px">${TIER[k].icon}</div><div class="grow"><b>${TIER[k].name}</b><div class="small muted">${k === "b" ? "The classic questions. Relaxed clock, 2 blanks per verse." : k === "s" ? "Deeper questions, 3 blanks + decoys, a clock on every question." : "Pastor-grade: minor characters, numbers, 5 blanks, look-alike decoys, fast clock."}</div></div>${S.tier === k ? "✓" : ""}</button>`).join("")}
    <button class="btn ghost" id="x">Close</button></div>`;
  document.body.appendChild(el);
  el.onclick = (e) => {
    const t = e.target.closest(".tierpick");
    if (t) { S.tier = t.dataset.t; save(); savePlayer(); sfx.ok(); el.remove(); done && done(); return; }
    if (e.target === el || e.target.id === "x") el.remove();
  };
}

// ---------- engine ----------
const BASE = { b: 100, s: 150, t: 200 };
const LIMITS = { mc: { b: 30, s: 22, t: 16 }, who_said: { b: 30, s: 22, t: 16 }, tf: { b: 20, s: 15, t: 12 }, order: { b: 45, s: 40, t: 35 }, who: { b: 60, s: 50, t: 40 }, gap: { b: 0, s: 50, t: 45 } };
const limitOf = (it, tier) => (LIMITS[it.k] || LIMITS.mc)[tier];
const WORD = /[A-Za-z\u2019]+/g;
function gapAnswer(it, tier) { const toks = it.text.match(WORD) || []; return it.g[tier].blanks.map((i) => toks[i]); }
function check(it, tier, choice) {
  if (it.k === "gap") { const want = gapAnswer(it, tier); let n = 0; want.forEach((w, i) => { if (choice && choice[i] === w) n++; }); return { correct: n === want.length, partial: n / want.length }; }
  const ok = String(choice) === String(it.a); return { correct: ok, partial: ok ? 1 : 0 };
}
function points(it, tier, c, ms, clues, combo) {
  const limit = limitOf(it, tier), base = BASE[tier];
  if (!c.correct) return it.k === "gap" ? Math.round(base * 0.3 * c.partial) : 0;
  const frac = limit ? Math.max(0, Math.min(1, 1 - ms / 1000 / limit)) : 0.5;
  let p = base * (1 + 0.5 * frac) * (1 + Math.min(combo, 10) * 0.1);
  if (it.k === "who") p *= [1, 1, 0.75, 0.5, 0.3][Math.max(1, Math.min(4, clues || 4))];
  if (it.k === "gap") p *= 1.2;
  return Math.round(p);
}
function rng(seed) { let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1e6) / 1e6; }; }
function shuffled(arr, seed) { const r = rng(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pool(mode, tier) {
  const p = BANK.items.filter((i) => i.m === mode && i.tiers.indexOf(tier) >= 0);
  // A thin tier borrows from the tier below it.
  if (p.length < 24 && tier !== "b") return p.concat(pool(mode, tier === "t" ? "s" : "b").filter((i) => p.indexOf(i) < 0));
  return p;
}
function drawSet(mode, tier, n) {
  const seen = S.seen[tier] || [];
  let p = pool(mode, tier);
  let fresh = p.filter((i) => seen.indexOf(i.id) < 0);
  if (fresh.length < n) { S.seen[tier] = seen.filter((id) => !p.some((i) => i.id === id)); fresh = p; }
  return shuffled(fresh, Math.random() + "").slice(0, n).map((i) => i.id);
}
function markSeen(ids, tier) { const s = S.seen[tier] || []; ids.forEach((id) => { if (s.indexOf(id) < 0) s.push(id); }); S.seen[tier] = s.slice(-900); save(); }
function mixedSet(tier) { return shuffled([].concat(drawSet("arena", tier, 4), drawSet("gap", tier, 2), drawSet("myth", tier, 2), drawSet("who", tier, 2)), Math.random() + ""); }

async function startMode(mode, tier) {
  render(`<div class="boot"><div class="boot-mark">✦</div><div class="boot-sub">Preparing your round…</div></div>`);
  await loadBank();
  if (!["b", "s", "t"].includes(tier)) tier = S.tier;
  if (mode === "daily") {
    let d = null; try { d = await api("/api/v3/daily"); } catch (e) { toast("Couldn't reach the server. Check your data."); return go("#/"); }
    if (d.played) { toast("You've played today's challenge. See the board!"); return go("#/ranks?tab=daily"); }
    return runRound({ ids: d.ids, tier: "s", mode: "daily", title: "Daily Challenge" });
  }
  if (mode === "sudden") {
    const ids = shuffled([].concat(drawSet("arena", tier, 30), drawSet("myth", tier, 12), drawSet("gap", tier, 10)), Math.random() + "");
    return runRound({ ids, tier, mode: "sudden", title: "Sudden Death", sudden: true });
  }
  const n = mode === "who" ? 6 : mode === "gap" ? 8 : mode === "myth" ? 12 : 10;
  const ids = mode === "mixed" ? mixedSet(tier) : drawSet(mode, tier, n);
  runRound({ ids, tier, mode, title: MODES[mode] ? MODES[mode].name : "Arena" });
}

function runRound(cfg) {
  const { ids, tier } = cfg;
  const items = ids.map((id) => BY[id]).filter(Boolean);
  const answers = []; let idx = 0, score = 0, combo = 0, bestCombo = 0, correctN = 0;
  let timerH = null, tickH = null, rivalH = null, rival = null;
  const total = cfg.sudden ? null : items.length;
  onLeave(() => { clearTimeout(timerH); clearInterval(tickH); clearInterval(rivalH); });
  if (cfg.duel) {
    const poll = async () => { try { const v = await api("/api/v3/duels/" + cfg.duel.code); const others = v.entries.filter((e) => !e.isMe); rival = others.find((e) => !e.finished && e.progress > 0 && Date.now() - new Date(e.updatedAt).getTime() < 60000) || others.find((e) => e.isCreator) || others[0] || null; drawRival(); } catch (e) {} };
    poll(); rivalH = setInterval(poll, 4000);
  }
  function drawRival() {
    const el = $("#rival"); if (!el || !rival) return;
    const liveNow = !rival.finished && Date.now() - new Date(rival.updatedAt).getTime() < 60000;
    const n = rival.finished ? rival.total : rival.progress;
    el.innerHTML = `<div class="rival">${liveNow ? `<span class="live">LIVE</span>` : "⚔️"}<b>${esc(rival.name)}</b><div class="xpbar"><i style="width:${Math.round((n / items.length) * 100)}%"></i></div><span class="gold">${fmt(rival.score)}</span></div>`;
  }
  function header() {
    const dots = cfg.sudden ? `<div class="grow small muted">Question ${idx + 1} · one life</div>` : `<div class="dots">${items.map((_, i) => `<i class="${i < idx ? (answers[i] && answers[i].correct ? "ok" : "bad") : i === idx ? "cur" : ""}"></i>`).join("")}</div>`;
    return `<div class="playtop"><button class="iconbtn" id="quit" aria-label="Quit">✕</button>${dots}${combo >= 2 ? `<span class="combo">x${(1 + Math.min(combo, 10) * 0.1).toFixed(1)}</span>` : ""}<div class="score-pill" id="sc">${fmt(score)}</div></div><div id="rival"></div>`;
  }
  function next() {
    clearTimeout(timerH); clearInterval(tickH);
    if (idx >= items.length || (cfg.sudden && answers.length && !answers[answers.length - 1].correct)) return finish();
    show(items[idx]);
  }
  function show(it) {
    const limit = limitOf(it, tier);
    const label = it.m === "gap" ? "Fill in the Gap" : it.m === "who" ? "Who Am I?" : it.m === "myth" ? "Bible or Myth?" : it.k === "who_said" ? "Who said it?" : it.k === "order" ? "Put in order" : (it.cat || "Arena");
    render(`${header()}${limit ? `<div class="timer" id="tm"><i></i></div>` : `<div style="height:20px"></div>`}
      <div class="qcard"><div class="qmeta"><span class="tiny">${esc(label)}</span><span class="pill-tier">${TIER[tier].name}</span></div><div id="qbody"></div></div>
      <div id="ans"></div><div id="fb"></div>`);
    $("#quit").onclick = () => { if (confirm("Leave this round? Your progress in it will be lost.")) go("#/"); };
    drawRival();
    const started = performance.now();
    let done = false, clues = 1;
    const finishQ = (choice) => {
      if (done) return; done = true; clearTimeout(timerH); clearInterval(tickH);
      const ms = Math.round(performance.now() - started);
      const c = check(it, tier, choice);
      const pts = points(it, tier, c, ms, clues, combo);
      if (c.correct) { combo++; correctN++; bestCombo = Math.max(bestCombo, combo); sfx.ok(); buzz(20); } else { combo = 0; sfx.bad(); buzz([40, 40, 60]); }
      score += pts;
      answers.push({ id: it.id, choice, ms, clues, correct: c.correct, partial: c.partial, pts });
      const sc = $("#sc"); if (sc) sc.textContent = fmt(score);
      const tm = $("#tm"); if (tm) tm.style.visibility = "hidden";
      reveal(it, choice, c);
      if (cfg.duel) api("/api/v3/duels/" + cfg.duel.code + "/progress", { body: { i: answers.length, score, correct: correctN, name: S.name, church: S.church } }).catch(() => {});
      feedback(it, c, pts);
    };
    if (limit) {
      const bar = $("#tm i"); bar.style.transition = "none"; bar.style.transform = "scaleX(1)";
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = `transform ${limit}s linear`; bar.style.transform = "scaleX(0)"; }));
      timerH = setTimeout(() => finishQ(it.k === "gap" ? gapState() : null), limit * 1000);
      tickH = setInterval(() => { const left = limit - (performance.now() - started) / 1000; if (left <= 5.5 && left > 0) { sfx.tick(); const t = $("#tm"); t && t.classList.add("low"); } }, 1000);
    }
    let gapState = () => null;
    const body = $("#qbody"), ans = $("#ans");
    if (it.k === "tf") {
      body.innerHTML = `<div class="qtext">${esc(it.q)}</div>`;
      ans.innerHTML = `<div class="mythbtns"><button class="opt" data-c="fact">FACT<small>It's in the Bible</small></button><button class="opt" data-c="myth">MYTH<small>Not what it says</small></button></div>`;
      $$(".opt", ans).forEach((b) => (b.onclick = () => finishQ(b.dataset.c)));
    } else if (it.k === "who") {
      const draw = () => {
        body.innerHTML = `<div class="tiny muted" style="margin-bottom:8px">Identify me with as few clues as you can</div><div class="clues">${it.clues.map((c, i) => i < clues ? `<div class="clue"><b>CLUE ${i + 1}</b>${esc(c)}</div>` : "").join("")}${clues < it.clues.length ? `<button class="clue locked" id="more">🔓 Reveal clue ${clues + 1} (points drop to ${[100, 100, 75, 50, 30][clues + 1]}%)</button>` : ""}</div>`;
        const m = $("#more"); if (m) m.onclick = () => { if (done) return; clues++; sfx.tap(); draw(); };
      };
      draw();
      const opts = shuffled(it.o.map((o, i) => [o, i]), it.id);
      ans.innerHTML = `<div class="opts">${opts.map(([o, i], n) => `<button class="opt" data-c="${i}"><span class="k">${"ABCDEF"[n]}</span>${esc(o)}</button>`).join("")}</div>`;
      $$(".opt", ans).forEach((b) => (b.onclick = () => finishQ(Number(b.dataset.c))));
    } else if (it.k === "gap") {
      const toks = []; let last = 0; const text = it.text; let m; const re = new RegExp(WORD.source, "g");
      while ((m = re.exec(text))) { if (m.index > last) toks.push({ sep: text.slice(last, m.index) }); toks.push({ w: m[0], i: toks.filter((t) => t.w).length }); last = m.index + m[0].length; }
      if (last < text.length) toks.push({ sep: text.slice(last) });
      const blanks = it.g[tier].blanks, want = gapAnswer(it, tier);
      const fill = blanks.map(() => null);
      const chips = shuffled(want.concat(it.g[tier].decoys).map((w, i) => ({ w, i })), it.id + tier);
      const draw = () => {
        const nextEmpty = fill.indexOf(null);
        body.innerHTML = `<div class="tiny muted" style="margin-bottom:6px">Tap the words in order · ${blanks.length} blanks</div><div class="verse">${toks.map((t) => {
          if (t.sep != null) return esc(t.sep);
          const bi = blanks.indexOf(t.i);
          if (bi < 0) return esc(t.w);
          const f = fill[bi];
          return `<button class="blank ${bi === nextEmpty ? "next" : ""}" data-b="${bi}">${f != null ? esc(chips[f].w) : "&nbsp;"}</button>`;
        }).join("")}</div>`;
        ans.innerHTML = `<div class="chips">${chips.map((c, ci) => `<button class="wchip ${fill.indexOf(ci) >= 0 ? "used" : ""}" data-ci="${ci}">${esc(c.w)}</button>`).join("")}</div>
          <button class="btn primary block" id="chk" style="margin-top:14px" ${fill.indexOf(null) >= 0 ? "disabled" : ""}>Check ✓</button>`;
        $$(".blank", body).forEach((b) => (b.onclick = () => { if (done) return; fill[Number(b.dataset.b)] = null; sfx.tap(); draw(); }));
        $$(".wchip", ans).forEach((b) => (b.onclick = () => { if (done) return; const e = fill.indexOf(null); if (e < 0) return; fill[e] = Number(b.dataset.ci); sfx.chip(); buzz(6); draw(); }));
        $("#chk").onclick = () => finishQ(gapState());
      };
      gapState = () => fill.map((f) => (f == null ? null : chips[f].w));
      draw();
      it._toks = toks; it._fill = fill; it._chips = chips;
    } else if (it.k === "order") {
      body.innerHTML = `<div class="qtext">${esc(it.q)}</div><div class="small muted" style="margin-top:6px">Tap them from first to last</div>`;
      const picked = [];
      const draw = () => {
        ans.innerHTML = `<div class="opts">${it.o.map((o, i) => `<button class="opt ${picked.indexOf(i) >= 0 ? "dim" : ""}" data-c="${i}"><span class="k">${picked.indexOf(i) >= 0 ? picked.indexOf(i) + 1 : "·"}</span>${esc(o)}</button>`).join("")}</div>`;
        $$(".opt", ans).forEach((b) => (b.onclick = () => { if (done) return; const i = Number(b.dataset.c); const at = picked.indexOf(i); if (at >= 0) picked.splice(at, 1); else picked.push(i); sfx.tap(); if (picked.length === it.o.length) finishQ(picked.join(">")); else draw(); }));
      };
      draw();
    } else {
      body.innerHTML = it.k === "who_said" ? `<div class="tiny muted" style="margin-bottom:6px">Who said:</div><div class="quote">${esc(it.q)}</div>` : `<div class="qtext">${esc(it.q)}</div>`;
      const opts = shuffled(it.o.map((o, i) => [o, i]), it.id);
      ans.innerHTML = `<div class="opts">${opts.map(([o, i], n) => `<button class="opt" data-c="${i}"><span class="k">${"ABCD"[n]}</span>${esc(o)}</button>`).join("")}</div>`;
      $$(".opt", ans).forEach((b) => (b.onclick = () => finishQ(Number(b.dataset.c))));
    }
  }
  function reveal(it, choice, c) {
    if (it.k === "gap") {
      const want = gapAnswer(it, tier);
      $$(".blank").forEach((b) => { const bi = Number(b.dataset.b); const got = choice && choice[bi]; const ok = got === want[bi]; b.classList.remove("next"); b.classList.add(ok ? "ok" : "bad"); if (!ok) b.innerHTML = `${got ? esc(got) : "—"}<span class="fix">${esc(want[bi])}</span>`; b.onclick = null; });
      $$(".wchip").forEach((b) => (b.onclick = null)); const chk = $("#chk"); if (chk) chk.remove();
      return;
    }
    $$("#ans .opt").forEach((b) => {
      const v = b.dataset.c; b.onclick = null;
      const isAns = it.k === "order" ? false : String(v) === String(it.a);
      if (isAns) b.classList.add("ok"); else if (String(v) === String(choice)) b.classList.add("bad"); else b.classList.add("dim");
    });
    if (it.k === "order") { const right = String(it.a).split(">").map(Number); $("#ans").innerHTML = `<div class="opts">${right.map((i, n) => `<div class="opt ${c.correct ? "ok" : ""}"><span class="k">${n + 1}</span>${esc(it.o[i])}</div>`).join("")}</div>`; }
  }
  function feedback(it, c, pts) {
    const verdict = c.correct ? ["ok", ["Correct!", "Well done!", "Amen! Correct.", "That's it!"][Math.floor(Math.random() * 4)]] : it.k === "gap" && c.partial > 0 ? ["bad", `${Math.round(c.partial * gapAnswer(it, tier).length)} of ${gapAnswer(it, tier).length} words`] : ["bad", "Not quite"];
    let ans = "";
    if (!c.correct) {
      if (it.k === "tf") ans = `It's a <b>${it.a === "myth" ? "MYTH" : "FACT"}</b>.`;
      else if (it.k === "who" || it.k === "mc" || it.k === "who_said") ans = `Answer: <b>${esc(it.o[it.a])}</b>`;
    }
    const last = idx + 1 >= items.length || (cfg.sudden && !c.correct);
    $("#fb").innerHTML = `<div class="feedback ${verdict[0]}">
      <div class="row between"><span class="verdict">${verdict[1]}</span><span class="gold serif" style="font-weight:800">+${fmt(pts)}</span></div>
      ${ans ? `<div style="margin-top:6px">${ans}</div>` : ""}
      ${it.k === "gap" && !c.correct ? `<div class="vod" style="margin-top:8px;font-size:15.5px">“${esc(it.text)}”</div>` : ""}
      ${it.x ? `<div class="small muted" style="margin-top:6px">${esc(it.x)}</div>` : ""}
      ${it.r ? `<div class="ref">📖 ${esc(it.r)} <span class="dim small" style="font-weight:600">KJV</span></div>` : ""}
      </div><button class="btn primary block" id="nx" style="margin-top:12px">${last ? "See results" : "Next ›"}</button>`;
    $("#nx").onclick = () => { idx++; sfx.tap(); next(); };
    setTimeout(() => { const n = $("#nx"); n && n.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 120);
  }
  function finish() {
    clearInterval(rivalH);
    markSeen(answers.map((a) => a.id), tier);
    results(cfg, answers, { score, correct: correctN, bestCombo, total: answers.length });
  }
  next();
}

// ---------- results ----------
async function results(cfg, answers, local) {
  render(`<div class="boot"><div class="boot-mark">✦</div><div class="boot-sub">Scoring your round…</div></div>`);
  const payload = answers.map((a) => ({ id: a.id, choice: a.choice, ms: a.ms, clues: a.clues }));
  let r = null, err = null;
  try {
    if (cfg.duel) r = await api("/api/v3/duels/" + cfg.duel.code + "/submit", { body: { name: S.name, church: S.church, answers: payload } });
    else r = await api("/api/v3/round", { body: { mode: cfg.mode, tier: cfg.tier, answers: payload } });
    if (r.player) ME.player = r.player;
  } catch (e) { err = e; if (e.status === 409 && e.data && e.data.duel) r = { duel: e.data.duel, score: local.score, correct: local.correct, total: local.total }; }
  if (cfg.duel && r && r.duel) return duelResult(r.duel, r, cfg);
  const score = r ? r.score : local.score, correct = r ? r.correct : local.correct, total = r ? r.total : local.total;
  const perfect = total > 0 && correct === total;
  render(`
  <div class="col" style="gap:14px">
    <div class="center" style="padding-top:10px">
      <div class="tiny gold">${esc(cfg.title || "Round")} · ${TIER[cfg.tier].name}</div>
      <div class="bigscore" id="big">0</div>
      <div class="muted">${perfect ? "A perfect round. Rightly dividing the word of truth! 👑" : correct / Math.max(1, total) >= 0.7 ? "Strong round. The Word is in you." : correct / Math.max(1, total) >= 0.4 ? "Good effort. Every verse you missed is now one you know." : "Tough set! Read the references and come back stronger."}</div>
    </div>
    <div class="stats3"><div class="stat"><b>${correct}/${total}</b><span>Correct</span></div><div class="stat"><b>x${local.bestCombo}</b><span>Best streak</span></div><div class="stat"><b class="gold">+${fmt(r ? r.xp : 0)}</b><span>XP</span></div></div>
    ${r && r.player ? `<div class="card"><div class="row between"><b>${esc(r.player.rank.name)} ${r.player.rank.division}</b><span class="small muted">${fmt(r.player.xp)} XP</span></div><div class="xpbar" style="margin-top:8px"><i id="xpb" style="width:${Math.round((r.rankBefore ? r.rankBefore.progress : 0) * 100)}%"></i></div><div class="small dim" style="margin-top:6px">${r.player.rank.next ? `${fmt(r.player.rank.nextXp - r.player.xp)} XP to ${r.player.rank.next}` : "You've reached Apostle"} · 🔥 ${r.player.streak}-day streak</div></div>` : ""}
    ${err && !r ? `<div class="card small">⚠️ Couldn't save this round (no connection). Your score still counts here.</div>` : ""}
    ${r && r.newAchievements && r.newAchievements.length ? r.newAchievements.map((a) => ACH[a] ? `<div class="badge"><div class="bi">${ACH[a][0]}</div><div><b>Achievement: ${ACH[a][1]}</b><div class="small muted">${ACH[a][2]}</div></div></div>` : "").join("") : ""}
    ${cfg.mode !== "daily" && cfg.mode !== "sudden" ? `<button class="card gold row" id="dset" style="text-align:left;gap:12px"><div style="font-size:28px">⚔️</div><div class="grow"><b>Challenge a pastor with this exact set</b><div class="small muted">They play the same ${total} questions and try to beat ${fmt(score)}</div></div><div class="gold">›</div></button>` : ""}
    <div class="row"><button class="btn primary grow" id="again">${cfg.mode === "daily" ? "Today's board" : "Play again"}</button><button class="btn ghost" id="share" aria-label="Share">📤</button></div>
    <div class="card"><b>Review</b>${answers.map((a) => { const it = BY[a.id]; return `<div class="review"><div>${a.correct ? "✅" : a.partial > 0 ? "🟨" : "❌"}</div><div class="grow"><div>${esc(shortQ(it))}</div><div class="small gold">${esc(it.r || "")}</div></div></div>`; }).join("")}</div>
    <a class="btn ghost block" href="#/">Home</a>
  </div>`);
  countUp($("#big"), score);
  setTimeout(() => { const b = $("#xpb"); if (b && r && r.player) b.style.width = Math.round((r.rankAfter && r.rankAfter.index > r.rankBefore.index ? 1 : r.player.rank.progress) * 100) + "%"; }, 300);
  if (perfect) { confetti(80); sfx.win(); } else sfx.ok();
  if (r && r.rankAfter && r.rankBefore && r.rankAfter.index > r.rankBefore.index) setTimeout(() => rankUp(r.rankAfter), 900);
  $("#again").onclick = () => (cfg.mode === "daily" ? go("#/ranks?tab=daily") : startMode(cfg.mode, cfg.tier));
  const ds = $("#dset"); if (ds) ds.onclick = () => createDuelFromSet(cfg, answers);
  $("#share").onclick = () => shareCard({ score, correct, total, tier: cfg.tier, title: cfg.title });
}
function shortQ(it) { if (!it) return ""; if (it.k === "gap") return "“" + it.text.slice(0, 70) + (it.text.length > 70 ? "…”" : "”"); if (it.k === "who") return "Who Am I: " + it.o[it.a]; const q = it.q || ""; return q.length > 90 ? q.slice(0, 88) + "…" : q; }
function countUp(el, to) { if (!el) return; const t0 = performance.now(), d = 1100; const f = (t) => { const p = Math.min(1, (t - t0) / d); el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }
function rankUp(rk) {
  sfx.win(); buzz([30, 60, 30, 60, 80]); confetti(100);
  const el = document.createElement("div"); el.className = "modal center";
  el.innerHTML = `<div class="sheet rankup"><div class="burst"></div><div class="emblem">${rk.name[0]}</div><div class="tiny gold">New rank</div><h1 class="title-gold" style="font-size:34px;margin:4px 0">${esc(rk.name)}</h1><p class="muted">“Well done, thou good and faithful servant.” Matthew 25:21</p><button class="btn primary block" style="margin-top:12px">Amen!</button></div>`;
  document.body.appendChild(el); el.querySelector("button").onclick = () => el.remove();
}

// ---------- share ----------
function origin() { return location.origin; }
function waLink(text) { return "https://wa.me/?text=" + encodeURIComponent(text); }
async function makeCard(o) {
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1080; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 0, 1080); g.addColorStop(0, "#1C2B5C"); g.addColorStop(1, "#070C1A"); x.fillStyle = g; x.fillRect(0, 0, 1080, 1080);
  x.save(); x.translate(540, 300); x.globalAlpha = 0.18; x.fillStyle = "#FFD98A";
  for (let i = 0; i < 24; i++) { x.rotate(Math.PI / 12); x.beginPath(); x.moveTo(0, 0); x.lineTo(-30, -700); x.lineTo(30, -700); x.closePath(); x.fill(); }
  x.restore(); x.globalAlpha = 1;
  const gold = x.createLinearGradient(0, 120, 0, 900); gold.addColorStop(0, "#FFE7AE"); gold.addColorStop(0.6, "#F5B942"); gold.addColorStop(1, "#C98A1B");
  x.textAlign = "center"; x.fillStyle = gold; x.font = "800 64px Cinzel, Georgia, serif"; x.fillText("BIBLE ARENA", 540, 170);
  x.fillStyle = "#9AA6C2"; x.font = "600 36px 'Plus Jakarta Sans', sans-serif"; x.fillText(o.subtitle || `${o.title || "Round"} · ${TIER[o.tier].name}`, 540, 240);
  x.fillStyle = gold; x.font = "800 220px Cinzel, Georgia, serif"; x.fillText(fmt(o.score), 540, 520);
  x.fillStyle = "#F6F1E7"; x.font = "700 46px 'Plus Jakarta Sans', sans-serif"; x.fillText(`${o.correct}/${o.total} correct · ${o.rank || rankOf((ME.player || {}).xp).name}`, 540, 610);
  x.fillStyle = "#F6F1E7"; x.font = "800 58px 'Plus Jakarta Sans', sans-serif"; x.fillText(o.cta || "Can you beat me?", 540, 780);
  x.fillStyle = "#FFD98A"; x.font = "700 38px 'Plus Jakarta Sans', sans-serif"; x.fillText(o.url ? o.url.replace(/^https?:\/\//, "") : origin().replace(/^https?:\/\//, ""), 540, 850);
  x.fillStyle = "#66729A"; x.font = "600 30px 'Plus Jakarta Sans', sans-serif"; x.fillText("— " + (S.name || "A player") + (S.church ? ", " + S.church : ""), 540, 960);
  return new Promise((res) => c.toBlob(res, "image/png"));
}
async function shareCard(o) {
  const text = o.text || `📖 I scored ${fmt(o.score)} on Bible Arena (${TIER[o.tier].name}). Can you beat me?\n${o.url || origin()}`;
  try {
    const blob = await makeCard(o);
    const file = new File([blob], "bible-arena.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
  } catch (e) { if (e && e.name === "AbortError") return; }
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  location.href = waLink(text);
}

// ---------- duels ----------
// Who won a duel: higher score; equal scores -> faster total time, in tenths of a second (what the
// screen shows); equal score and time -> a draw. Same rule as server/v3/duel-outcome.ts.
function duelCmp(a, b) { const sa = Number(a.score) || 0, sb = Number(b.score) || 0; if (sa !== sb) return sa > sb ? 1 : -1; const ta = Math.round(Math.max(0, Number(a.timeMs) || 0) / 100), tb = Math.round(Math.max(0, Number(b.timeMs) || 0) / 100); return ta === tb ? 0 : ta < tb ? 1 : -1; }
const secs = (ms) => (Math.round(Math.max(0, Number(ms) || 0) / 100) / 10).toFixed(1) + "s";
function duelText(code, score, tier, mode) {
  const url = origin() + "/d/" + code;
  return score != null
    ? `⚔️ ${S.name || "I"} scored ${fmt(score)} on Bible Arena (${TIER[tier].name} · ${MODES[mode] ? MODES[mode].name : "Arena"}).\nSame questions. Can you beat me, Pastor? 📖\n${url}`
    : `⚔️ ${S.name || "I"} challenge you to a Bible Arena duel (${TIER[tier].name}). Same questions, head to head. 📖\n${url}`;
}
async function newDuel() {
  let mode = "mixed", tier = S.tier;
  const draw = () => {
    render(`<div class="row" style="margin-bottom:14px"><a class="iconbtn" href="#/duels">‹</a><h2 class="grow">Challenge a Pastor</h2></div>
    <div class="col" style="gap:14px">
      <div class="hero"><div class="rays"></div><div style="font-size:36px">⚔️</div><h2 style="font-family:var(--serif);margin:6px 0">Same questions. One winner.</h2><p class="small muted" style="margin:0">1. You play the set · 2. Send the link on WhatsApp · 3. They play the same questions · 4. See who knows the Word. If you're both on at once, you'll see each other live.</p></div>
      <div class="tiny muted">Mode</div>
      <div class="grid2">${["mixed", "gap", "who", "myth", "arena"].map((k) => `<button class="mode ${mode === k ? "" : ""}" data-m="${k}" style="min-height:96px;${mode === k ? "border-color:var(--gold);background:rgba(245,185,66,.1)" : ""}"><div class="ico">${MODES[k].icon}</div><div><b>${MODES[k].name}</b></div></button>`).join("")}</div>
      <div class="tiny muted">Level</div>
      <div class="tiers">${["b", "s", "t"].map((k) => `<button class="tier ${tier === k ? "on" : ""}" data-t="${k}"><div style="font-size:20px">${TIER[k].icon}</div><b>${TIER[k].name}</b></button>`).join("")}</div>
      <button class="btn primary block" id="start">Play my set first</button>
    </div>`);
    $$(".mode").forEach((b) => (b.onclick = () => { mode = b.dataset.m; sfx.tap(); draw(); }));
    $$(".tier").forEach((b) => (b.onclick = () => { tier = b.dataset.t; sfx.tap(); draw(); }));
    $("#start").onclick = async () => {
      $("#start").disabled = true; $("#start").textContent = "Setting up your duel…";
      try {
        await ensureSession(); await loadBank();
        const d = await api("/api/v3/duels", { body: { mode, tier, name: S.name } });
        runRound({ ids: d.ids, tier, mode: "duel", title: "Duel · " + MODES[mode].name, duel: { code: d.code, creator: true, mode } });
      } catch (e) { toast("Couldn't create the duel. Check your connection."); draw(); }
    };
  };
  draw();
}
async function createDuelFromSet(cfg, answers) {
  try {
    toast("Creating your challenge…");
    const d = await api("/api/v3/duels", { body: { mode: ["gap", "who", "myth", "arena", "mixed"].includes(cfg.mode) ? cfg.mode : "mixed", tier: cfg.tier, name: S.name, ids: answers.map((a) => a.id), answers: answers.map((a) => ({ id: a.id, choice: a.choice, ms: a.ms, clues: a.clues })) } });
    go("#/d/" + d.code);
  } catch (e) { toast("Couldn't create the challenge. Try again."); }
}
async function acceptDuel(code) {
  render(`<div class="boot"><div class="boot-mark">⚔️</div><div class="boot-sub">Loading the challenge…</div></div>`);
  await ensureSession();
  let v; try { v = await api("/api/v3/duels/" + code); } catch (e) {
    return render(`<div class="col center" style="padding-top:20vh;gap:12px"><div style="font-size:48px">🕊️</div><h2>Challenge not found</h2><p class="muted">The link may be mistyped. Start your own instead.</p><a class="btn primary" href="#/duel/new">Challenge a Pastor</a><a class="btn ghost" href="#/">Home</a></div>`);
  }
  const mine = v.entries.find((e) => e.isMe);
  if (mine && mine.finished) return duelResult(v, null, null);
  if (v.creator.isMe && !mine) return duelResult(v, null, null);
  const creator = v.entries.find((e) => e.isCreator && e.finished);
  const needName = !S.onboarded;
  render(`<div class="col" style="gap:16px;padding-top:2vh">
    <div class="center"><div class="tiny gold">Bible Arena · Pastor Duel</div></div>
    <div class="hero center"><div class="rays"></div>
      <div class="avatar" style="width:72px;height:72px;font-size:28px">${esc((v.creator.name || "?")[0].toUpperCase())}</div>
      <h2 style="font-family:var(--serif)">${esc(v.creator.name)}</h2>
      <div class="muted">challenges you to</div>
      <h1 class="title-gold" style="margin:6px 0">${esc(MODES[v.mode] ? MODES[v.mode].name : "Arena")}</h1>
      <div class="row" style="justify-content:center;gap:8px"><span class="pill-tier">${TIER[v.tier].name}</span><span class="pill-tier">${v.ids.length} questions</span></div>
      ${creator ? `<div style="margin-top:14px" class="muted">Score to beat</div><div class="bigscore" style="font-size:44px">${fmt(creator.score)}</div>` : ""}
    </div>
    ${needName ? `<div class="card col"><div class="field"><label for="nm">Your name</label><input id="nm" maxlength="40" placeholder="e.g. Pastor Ade" value="${esc(S.name)}"></div><div class="field"><label for="ch">Church or group <span class="dim">(optional)</span></label><input id="ch" maxlength="60" value="${esc(S.church)}"></div></div>` : ""}
    <p class="small muted center" style="margin:0">Same questions, same clock. Points for speed and streaks. Every answer shows its verse.</p>
    <button class="btn primary block" id="acc">Accept the challenge</button>
    ${v.entries.filter((e) => e.finished).length > 1 ? `<div class="card"><b>Already played</b>${board(v)}</div>` : ""}
  </div>`);
  $("#acc").onclick = async () => {
    if (needName) { S.name = ($("#nm").value || "").trim().slice(0, 40) || "Player"; S.church = ($("#ch").value || "").trim().slice(0, 60); S.onboarded = true; save(); await savePlayer(); }
    await loadBank();
    sfx.ok(); buzz(20);
    runRound({ ids: v.ids, tier: v.tier, mode: "duel", title: "Duel vs " + v.creator.name, duel: { code: v.code, creator: false, mode: v.mode } });
  };
}
function board(v) {
  const done = v.entries.filter((e) => e.finished).sort((a, b) => duelCmp(b, a));
  const pos = new Map(); done.forEach((e, i) => pos.set(e, i && duelCmp(e, done[i - 1]) === 0 ? pos.get(done[i - 1]) : i + 1));
  return [...done, ...v.entries.filter((e) => !e.finished && e.progress)].map((e) => `<div class="lb ${e.isMe ? "me" : ""}"><div class="pos ${e.finished ? "p" + pos.get(e) : ""}">${e.finished ? pos.get(e) : "…"}</div><div class="grow"><b>${esc(e.name)}</b>${e.isCreator ? ` <span class="small gold">challenger</span>` : ""}<div class="small muted">${e.finished ? `${e.correct}/${e.total} · ${secs(e.timeMs)}` : `playing… ${e.progress}/${v.ids.length}`}${e.church ? " · " + esc(e.church) : ""}</div></div><div class="gold serif" style="font-weight:800">${fmt(e.score)}</div></div>`).join("");
}
function duelResult(v, r, cfg) {
  if (location.hash !== "#/d/" + v.code) history.replaceState(null, "", "#/d/" + v.code);
  const me = v.entries.find((e) => e.isMe);
  const others = v.entries.filter((e) => !e.isMe && e.finished);
  const opp = v.creator.isMe ? others[0] : others.find((e) => e.isCreator) || others[0];
  const url = origin() + "/d/" + v.code;
  const cmp = me && opp ? duelCmp(me, opp) : null;
  const onTime = cmp && me.score === opp.score;
  const gap = onTime ? secs(Math.abs(Math.round(me.timeMs / 100) - Math.round(opp.timeMs / 100)) * 100) : "";
  let banner = "";
  if (cmp === 1) banner = `<h1 class="title-gold">${onTime ? "You win on time! ⏱️" : "You win! 🏆"}</h1>${onTime ? `<p class="muted" style="margin:4px 0 0">Same score. You were ${gap} faster.</p>` : ""}`;
  else if (cmp === -1) banner = `<h1 style="font-family:var(--serif)">${esc(opp.name)} wins${onTime ? " on time" : ""}</h1>${onTime ? `<p class="muted" style="margin:4px 0 0">Same score. ${esc(opp.name.split(" ")[0])} was ${gap} faster.</p>` : ""}`;
  else if (cmp === 0) banner = `<h1 class="title-gold">It's a draw 🤝</h1><p class="muted" style="margin:4px 0 0">Same score, same time. Honours shared.</p>`;
  else if (me && v.creator.isMe) banner = `<h1 class="title-gold">Now send it!</h1><p class="muted" style="margin:4px 0 0">Your score: <b class="gold">${fmt(me.score)}</b>. Waiting for a pastor to answer your challenge.</p>`;
  const side = (e, win) => e ? `<div class="side ${win ? "win" : ""}"><div class="avatar">${esc(e.name[0].toUpperCase())}</div><b>${esc(e.name)}</b><div class="bigscore" style="font-size:30px;margin-top:4px">${fmt(e.score)}</div><div class="small muted">${e.correct}/${e.total} · ${secs(e.timeMs)}</div></div>` : `<div class="side"><div class="avatar">?</div><b>Waiting…</b><div class="small muted">Send the link</div></div>`;
  const n = v.ids.length;
  const grid = me && opp && me.answers.length ? `<div class="card"><b>Question by question</b><div class="grid-ans" style="--n:${n};margin-top:10px"><span class="small">You</span>${me.answers.map((a) => `<i class="${a ? "y" : "n"}"></i>`).join("")}<span class="small">${esc(opp.name.split(" ")[0])}</span>${opp.answers.map((a) => `<i class="${a ? "y" : "n"}"></i>`).join("")}</div></div>` : "";
  render(`<div class="row" style="margin-bottom:12px"><a class="iconbtn" href="#/duels">‹</a><div class="grow tiny gold">Duel · ${esc(MODES[v.mode] ? MODES[v.mode].name : "")} · ${TIER[v.tier].name}</div><button class="iconbtn" id="rf" aria-label="Refresh">↻</button></div>
  <div class="col" style="gap:14px">
    <div class="center">${banner}</div>
    <div class="vs">${side(me, cmp === 1)}<div class="vsx">${cmp === 0 ? "🤝" : "VS"}</div>${side(opp, cmp === -1)}</div>
    ${grid}
    ${r && r.newAchievements && r.newAchievements.length ? r.newAchievements.map((a) => ACH[a] ? `<div class="badge"><div class="bi">${ACH[a][0]}</div><div><b>Achievement: ${ACH[a][1]}</b><div class="small muted">${ACH[a][2]}</div></div></div>` : "").join("") : ""}
    ${r && r.xp ? `<div class="small muted center">+${fmt(r.xp)} XP · ${esc(r.player ? r.player.rank.name + " " + r.player.rank.division : "")}</div>` : ""}
    <a class="btn wa block" id="wa" href="${waLink(duelText(v.code, me ? me.score : null, v.tier, v.mode))}" target="_blank" rel="noopener">Send on WhatsApp</a>
    <div class="row"><button class="btn ghost grow" id="cp">Copy link</button><button class="btn ghost grow" id="sh">Share card</button></div>
    ${me && opp ? `<button class="btn primary block" id="rm">🔄 Rematch (new questions)</button>` : ""}
    ${v.entries.filter((e) => e.finished).length ? `<div class="card"><b>Everyone on this challenge</b>${board(v)}</div>` : ""}
    <a class="btn ghost block" href="#/">Home</a>
  </div>${tabbar("duels")}`);
  if (cmp === 1 && r) { confetti(90); sfx.win(); }
  $("#rf").onclick = async () => { try { const nv = await api("/api/v3/duels/" + v.code); duelResult(nv, null, cfg); } catch (e) {} };
  $("#cp").onclick = async () => { try { await navigator.clipboard.writeText(url); toast("Link copied ✓"); } catch (e) { prompt("Copy this link:", url); } };
  $("#sh").onclick = () => shareCard({ score: me ? me.score : 0, correct: me ? me.correct : 0, total: n, tier: v.tier, title: "Pastor Duel", url, text: duelText(v.code, me ? me.score : null, v.tier, v.mode), cta: cmp === 1 ? "I won this duel. Your turn?" : cmp === 0 ? "We drew this duel. Can you break the tie?" : "Can you beat me?" });
  const rm = $("#rm"); if (rm) rm.onclick = async () => {
    rm.disabled = true; rm.textContent = "Preparing the rematch…";
    try { await loadBank(); const d = await api("/api/v3/duels", { body: { mode: v.mode, tier: v.tier, name: S.name, parent: v.code } }); runRound({ ids: d.ids, tier: v.tier, mode: "duel", title: "Rematch · " + (MODES[v.mode] ? MODES[v.mode].name : ""), duel: { code: d.code, creator: true, mode: v.mode } }); }
    catch (e) { toast("Couldn't start the rematch."); rm.disabled = false; }
  };
  if (!me || !opp) { const t = setInterval(async () => { try { const nv = await api("/api/v3/duels/" + v.code); if (nv.entries.filter((e) => e.finished).length !== v.entries.filter((e) => e.finished).length) { clearInterval(t); duelResult(nv, null, cfg); } } catch (e) {} }, 8000); onLeave(() => clearInterval(t)); }
}
async function duelsScreen() {
  render(`<div class="row between" style="margin-bottom:14px"><h2>Pastor Duels</h2><a class="btn primary" href="#/duel/new" style="min-height:42px">+ New</a></div><div id="dl" class="col"><div class="muted small">Loading your duels…</div></div>${tabbar("duels")}`);
  await ensureSession();
  let r; try { r = await api("/api/v3/duels/mine"); } catch (e) { if (!$("#dl")) return; $("#dl").innerHTML = `<div class="card">Couldn't load duels. Check your connection.</div>`; return; }
  const el = $("#dl"); if (!el) return;
  if (!r.duels.length) { el.innerHTML = `<div class="hero center"><div class="rays"></div><div style="font-size:42px">⚔️</div><h2 style="font-family:var(--serif)">No duels yet</h2><p class="muted small">Challenge a pastor friend: you both play the same questions and the link shows who won.</p><a class="btn primary block" href="#/duel/new">Challenge a Pastor</a></div>`; return; }
  el.innerHTML = r.duels.map((d) => {
    const es = d.entries || []; const me = es.find((e) => e.me); const others = es.filter((e) => !e.me && e.finished);
    const best = others.sort((a, b) => duelCmp(b, a))[0];
    const c = me && me.finished && best ? duelCmp(me, best) : null;
    const status = !me || !me.finished ? "Your turn" : !best ? "Waiting for opponent" : c === 1 ? "You lead 🏆" : c === 0 ? "Draw 🤝" : `${best.name} leads`;
    return `<a class="card row" href="#/d/${d.code}" style="text-decoration:none;color:inherit;gap:12px"><div style="font-size:26px">${MODES[d.mode] ? MODES[d.mode].icon : "⚔️"}</div><div class="grow"><b>${d.mine ? "Your challenge" : "From " + esc(d.creator_name)}</b><div class="small muted">${MODES[d.mode] ? MODES[d.mode].name : ""} · ${TIER[d.tier] ? TIER[d.tier].name : ""} · ${d.players} played</div></div><div class="small ${status.startsWith("You") ? "gold" : "muted"}" style="text-align:right;font-weight:700">${esc(status)}</div></a>`;
  }).join("");
}

// ---------- leaderboards ----------
async function ranks(tab) {
  const tabs = [["week", "This week"], ["church", "Pastors' League"], ["rivals", "Rivals"], ["daily", "Today"], ["all", "All-time"]];
  render(`<h2 style="margin-bottom:12px">Leaderboards</h2><div class="segs">${tabs.map(([k, l]) => `<a class="chip ${tab === k ? "on" : ""}" href="#/ranks?tab=${k}">${l}</a>`).join("")}</div><div id="lb" class="card"><div class="muted small">Loading…</div></div>${tabbar("ranks")}`);
  await ensureSession();
  let r; try { r = await api("/api/v3/leaderboard?scope=" + tab); } catch (e) { const l = $("#lb"); if (l) l.innerHTML = "Couldn't load the board."; return; }
  const el = $("#lb"); if (!el) return;
  if (tab === "church") {
    el.innerHTML = `<div class="small muted" style="margin-bottom:8px">Churches and groups ranked by their players' total XP. ${S.church ? `You play for <b class="gold">${esc(S.church)}</b>.` : `<a href="#/me">Add your church</a> to join.`}</div>` + (r.churches.length ? r.churches.map((c, i) => `<div class="lb"><div class="pos p${i + 1}">${i + 1}</div><div class="grow"><b>⛪ ${esc(c.church)}</b><div class="small muted">${c.players} player${c.players > 1 ? "s" : ""}</div></div><div class="gold serif" style="font-weight:800">${fmt(c.score)}</div></div>`).join("") : `<div class="muted">No churches yet. Be the first!</div>`);
    return;
  }
  const rows = r.rows || [];
  const empty = { week: "No rounds this week yet. Play one and top the board!", daily: "Nobody has played today's challenge yet.", rivals: "Your rivals appear here after your first duel.", all: "No players yet." }[tab];
  el.innerHTML = rows.length ? rows.map((x, i) => `<div class="lb ${x.isMe ? "me" : ""}"><div class="pos p${i + 1}">${i + 1}</div><div class="grow"><b>${esc(x.name)}</b>${x.isMe ? ` <span class="small gold">you</span>` : ""}<div class="small muted">${esc(x.rank)}${x.church ? " · " + esc(x.church) : ""}${tab === "rivals" ? ` · You ${x.wins}–${x.losses}${x.draws ? ` · ${x.draws} draw${x.draws > 1 ? "s" : ""}` : ""}` : ""}</div></div><div class="gold serif" style="font-weight:800">${fmt(x.score)}</div></div>`).join("") : `<div class="muted">${empty}</div>${tab === "rivals" ? `<a class="btn primary block" style="margin-top:12px" href="#/duel/new">Challenge a Pastor</a>` : ""}`;
}

// ---------- profile & settings ----------
async function profile() {
  render(`<div id="pf"></div>${tabbar("me")}`);
  await ensureSession();
  const p = ME.player || { xp: 0, achievements: [], stats: {} };
  const rk = rankOf(p.xp); const st = p.stats || {}; const got = p.achievements || [];
  const google = ME.user && ME.user.openId === "google";
  $("#pf").innerHTML = `<div class="col" style="gap:14px">
    <div class="hero center"><div class="rays"></div><div class="emblem" style="width:84px;height:84px;font-size:36px;border-radius:24px;margin:0 auto 10px">${rk.name[0]}</div>
      <h2 style="font-family:var(--serif)">${esc(S.name || "Player")}</h2><div class="gold" style="font-weight:800">${rk.name} ${rk.division}</div>${S.church ? `<div class="small muted">⛪ ${esc(S.church)}</div>` : ""}
      <div class="xpbar" style="margin:12px 0 6px"><i style="width:${Math.round(rk.progress * 100)}%"></i></div><div class="small muted">${fmt(p.xp)} XP${rk.next ? ` · ${fmt(rk.nextXp - p.xp)} to ${rk.next}` : ""}</div></div>
    <div class="stats3"><div class="stat"><b>🔥 ${p.streak || 0}</b><span>Day streak</span></div><div class="stat"><b>${p.bestStreak || 0}</b><span>Best streak</span></div><div class="stat"><b>${p.rounds || 0}</b><span>Rounds</span></div></div>
    <div class="stats3"><div class="stat"><b>${st.correct || 0}</b><span>Correct</span></div><div class="stat"><b>${st.gapPerfect || 0}</b><span>Perfect gaps</span></div><div class="stat"><b>${st.duelsWon || 0}</b><span>Duels won</span></div></div>
    <div class="card"><div class="row between"><b>Ranks</b><span class="small muted">Seeker → Apostle</span></div><div class="row" style="flex-wrap:wrap;gap:6px;margin-top:10px">${RANKS.map(([n, x], i) => `<span class="chip ${i <= rk.index ? "on" : ""}">${n}<span class="dim small">${x ? fmt(x) : ""}</span></span>`).join("")}</div></div>
    <div class="card"><div class="row between"><b>Achievements</b><span class="small muted">${got.length}/${Object.keys(ACH).length}</span></div><div class="achs" style="margin-top:10px">${Object.keys(ACH).map((k) => `<div class="ach ${got.indexOf(k) >= 0 ? "got" : ""}"><div class="ai">${ACH[k][0]}</div><b>${ACH[k][1]}</b><span>${ACH[k][2]}</span></div>`).join("")}</div></div>
    <div class="card">
      <b>Settings</b>
      <div class="setrow"><div class="grow"><div>Name</div><div class="small muted">${esc(S.name)}</div></div><button class="chip" id="ename">Edit</button></div>
      <div class="setrow"><div class="grow"><div>Church / group</div><div class="small muted">${esc(S.church || "Not set")}</div></div><button class="chip" id="echurch">${S.church ? "Edit" : "Add"}</button></div>
      <div class="setrow"><div class="grow"><div>Level</div><div class="small muted">${TIER[S.tier].name}</div></div><button class="chip" id="etier">Change</button></div>
      <div class="setrow"><div>Sound</div><button class="switch ${S.sound ? "on" : ""}" id="snd" aria-label="Sound"></button></div>
      <div class="setrow"><div>Vibration</div><button class="switch ${S.haptics ? "on" : ""}" id="hap" aria-label="Vibration"></button></div>
      <div class="setrow"><div class="grow"><div>Account</div><div class="small muted">${google ? "Signed in with Google ✓ (progress is safe across phones)" : "Guest on this phone. Sign in to keep your progress on any phone."}</div></div>${google ? `<button class="chip" id="out">Sign out</button>` : `<a class="chip on" href="/api/oauth/google/start">Google</a>`}</div>
    </div>
    <div class="card"><b>More</b><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:10px"><a class="chip" href="/play">🏛️ Classic app</a><a class="chip" href="/download">📱 Android app</a><a class="chip" href="#/ranks?tab=church">⛪ Pastors' League</a></div>
      <p class="small dim" style="margin:12px 0 0">Scripture quotations are from the King James Version (public domain). Every answer carries its reference so you can read it yourself.</p></div>
  </div>`;
  const ed = async (key, label, max) => { const v = prompt(label, S[key] || ""); if (v == null) return; S[key] = v.trim().slice(0, max); save(); await savePlayer(); profile(); };
  $("#ename").onclick = () => ed("name", "Your name", 40);
  $("#echurch").onclick = () => ed("church", "Your church or group (for the Pastors' League)", 60);
  $("#etier").onclick = () => tierSheet(() => profile());
  $("#snd").onclick = (e) => { S.sound = !S.sound; save(); e.target.classList.toggle("on", S.sound); sfx.ok(); };
  $("#hap").onclick = (e) => { S.haptics = !S.haptics; save(); e.target.classList.toggle("on", S.haptics); buzz(30); };
  const out = $("#out"); if (out) out.onclick = async () => { await api("/api/auth/logout", { body: {} }).catch(() => {}); ME = { user: null, player: null }; await ensureSession(); toast("Signed out"); profile(); };
}

// ---------- boot ----------
(async function boot() {
  document.addEventListener("click", () => { const a = audio(); if (a && a.state === "suspended") a.resume(); }, { once: true });
  ensureSession().then(() => { if (ME.player) { if (!S.name && ME.player.name) S.name = ME.player.name; if (!S.church && ME.player.church) S.church = ME.player.church; save(); } });
  loadBank().catch(() => {});
  if (S.onboarded) await ensureSession();
  route();
})();
})();
