/* Bible Arena v3 — fast, cinematic web game. No framework: built to fly on low-end Android. */
(function () {
"use strict";
window.BA_V = "3.9.0";

// ---------- v3.8.3: opt-in rewarded ads (Android app 1.4.0+ only; the website shows nothing new) ----------
// The app tells the page it can play ads: its launch URL carries baads=1 (Chrome / TWA path, remembered for this tab only),
// or its built-in view exposes window.BAAdsNative. Ads play ONLY when the player taps a "Watch a short ad" button,
// and the reward is given ONLY on "reward". Rewards are practice-only, so XP, ranks, boards and duels are untouched.
const BA_ADS = (() => {
  const PKG = "com.holaoluwakintan.biblearena", SCHEME = "biblearena-ads";
  try {
    const qs = new URLSearchParams(location.search);
    if (qs.get("baads") === "1") {
      sessionStorage.setItem("ba_ads", "1");
      qs.delete("baads");
      const q = qs.toString();
      history.replaceState(history.state, "", location.pathname + (q ? "?" + q : "") + location.hash);
    }
  } catch (e) {}
  const bridge = () => !!(window.BAAdsNative && typeof window.BAAdsNative.showRewarded === "function");
  const twa = () => { try { return sessionStorage.getItem("ba_ads") === "1"; } catch (e) { return false; } };
  const available = () => bridge() || twa();
  const pend = {};
  let busy = false;
  const nonce = () => { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join(""); };
  const cleanReason = (r) => (String(r || "reward").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24) || "reward");
  function viaRelay(n, reason, done) {
    // Chrome path: open the app's ad screen, then read how it ended from the server relay.
    const t0 = Date.now(); let seen = false, visibleMs = 0, lastTick = Date.now(), timer = null, over = false;
    const end = (r) => { if (over) return; over = true; clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); done(r); };
    const poll = async () => {
      if (over) return;
      const now = Date.now();
      if (document.visibilityState === "visible") visibleMs += now - lastTick;
      lastTick = now;
      try {
        const r = await fetch("/api/v3/ads/relay?n=" + n, { cache: "no-store" });
        const j = r.ok ? await r.json() : null;
        const s = j && j.s;
        if (s === "reward" || s === "dismiss" || s === "unavailable") return end(s);
        if (s === "open") seen = true;
      } catch (e) {}
      // No sign of the app's ad screen after ~15 s on screen: the app could not open it.
      if (!seen && visibleMs > 15000) return end("unavailable");
      if (Date.now() - t0 > 180000) return end(seen ? "dismiss" : "unavailable");
      timer = setTimeout(poll, 1000);
    };
    const onVis = () => { if (document.visibilityState === "visible") { clearTimeout(timer); lastTick = Date.now(); poll(); } };
    document.addEventListener("visibilitychange", onVis);
    api._open("intent://reward?n=" + n + "&r=" + reason + "#Intent;scheme=" + SCHEME + ";package=" + PKG + ";end");
    timer = setTimeout(poll, 1200);
  }
  /** showRewarded(reason, {onReward, onDismiss, onUnavailable}) -> Promise<"reward"|"dismiss"|"unavailable"> */
  function showRewarded(reason, cb) {
    cb = cb || {};
    return new Promise((resolve) => {
      const fire = (r) => {
        busy = false; resolve(r);
        try { (r === "reward" ? cb.onReward : r === "dismiss" ? cb.onDismiss : cb.onUnavailable || (() => {}))(); } catch (e) {}
      };
      if (!available() || busy) return fire("unavailable");
      busy = true;
      const n = nonce(), why = cleanReason(reason);
      if (bridge()) {
        pend[n] = fire;
        setTimeout(() => { if (pend[n]) { delete pend[n]; fire("unavailable"); } }, 180000);
        try { window.BAAdsNative.showRewarded(n, why); } catch (e) { delete pend[n]; fire("unavailable"); }
        return;
      }
      viaRelay(n, why, fire);
    });
  }
  const api = { available, showRewarded, _open(u) { location.href = u; }, _native(n, r) { const f = pend[n]; if (!f) return; delete pend[n]; f(r === "reward" || r === "dismiss" ? r : "unavailable"); } };
  window.BAAds = api;
  return api;
})();
const $ = (s, el) => (el || document).querySelector(s);
const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
const app = $("#app");
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n || 0).toLocaleString("en-US");
const TIER = { b: { name: "Believer", sub: "Warm-up", icon: "🕊️" }, s: { name: "Scholar", sub: "Deeper", icon: "📜" }, t: { name: "Theologian", sub: "Hardest", icon: "👑" } };
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
  duel_sent: ["⚔️", "Challenger", "Send a challenge"], duel_won: ["🥇", "Giant Slayer", "Win a duel"], duel_5: ["🛡️", "Mighty Man", "Win 5 duels"],
  rematch: ["🔄", "Seventy Times Seven", "Ask for a rematch"], church: ["⛪", "One Body", "Join a church team"],
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
// v3.9: the same random phone id as live-common.js (x-ba-d), so a Block works in every room
function deviceId() {
  try {
    let d = localStorage.getItem("ba:did");
    if (!d || !/^[A-Za-z0-9_-]{22,64}$/.test(d)) {
      const b = new Uint8Array(18); crypto.getRandomValues(b);
      d = btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      localStorage.setItem("ba:did", d);
    }
    return d;
  } catch (e) { return ""; }
}
// v3.9: the same kind-names filter as the server (server/v3/names.ts), so a rude name is caught before it is saved
function badNm(v) {
  const BAD = ["fuck", "fuk", "fvck", "bitch", "asshole", "bastard", "pussy", "nigger", "nigga", "whore", "slut", "porn", "hitler", "ashawo", "olosho", "oloshi", "werey", "satanrules", "vagina", "boobs", "bullshit", "motherf"];
  const WORDS = ["shit", "shitty", "cunt", "rape", "rapist", "nude", "nudes", "dick", "cock", "sex", "sexy", "mumu", "penis", "kill", "killer"];
  const lower = String(v || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const leet = lower.replace(/[@4]/g, "a").replace(/3/g, "e").replace(/[1!|]/g, "i").replace(/0/g, "o").replace(/[5$]/g, "s").replace(/7/g, "t");
  return [lower, leet].some((s) => { const w = s.replace(/[^a-z]+/g, " ").split(" ").filter(Boolean); const f = w.join(""); return BAD.some((b) => f.indexOf(b) >= 0) || w.some((x) => WORDS.indexOf(x) >= 0); });
}
const KIND_NAME = "Please pick a kind name 🙂";
async function api(path, opts) {
  opts = opts || {};
  const hd = { "Content-Type": "application/json", "x-client-platform": "web" }; const did = deviceId(); if (did) hd["x-ba-d"] = did;
  const r = await fetch(path, { method: opts.body ? "POST" : "GET", credentials: "same-origin", headers: hd, body: opts.body ? JSON.stringify(opts.body) : undefined });
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
// Every navigation retires the round on screen, so a left-behind timer can never answer for a new round.
let ROUND_SEQ = 0;
async function route() {
  ROUND_SEQ++;
  const { parts, q } = parseHash();
  const pathDuel = location.pathname.match(/^\/d\/([A-Za-z0-9]{4,12})/);
  if (pathDuel && !parts.length) { history.replaceState(null, "", "/#/d/" + pathDuel[1].toUpperCase()); return route(); }
  const pathChurch = location.pathname.match(/^\/c\/([A-Za-z0-9]{4,8})/);
  if (pathChurch && !parts.length) { history.replaceState(null, "", "/#/c/" + pathChurch[1].toUpperCase()); return route(); }
  if (!S.onboarded && parts[0] !== "d" && parts[0] !== "c") return ["qm", "live", "ko", "online", "bot"].includes(parts[0]) ? onboarding(() => route()) : onboarding();
  const [a, b] = parts;
  if (window.BAS) { BAS.setBusy(false); BAS.watchLive(!a || a === "live" || a === "online"); }
  if (!a) return home();
  if (a === "live") return liveNow();
  if (a === "qm") return quickMatch(q);
  if (a === "ko") return b === "quick" ? quickKo() : newKo();
  if (a === "online") return onlineNow();
  if (a === "bot") return playBot(MODES[q.get("mode")] ? q.get("mode") : "mixed", TIER[q.get("tier")] ? q.get("tier") : S.tier);
  if (a === "play") return startMode(b || q.get("mode") || "arena", q.get("tier") || S.tier);
  if (a === "duels") return duelsScreen();
  if (a === "duel" && b === "new") return newDuel(q.get("from"));
  if (a === "d" && b) return acceptDuel(b.toUpperCase());
  if (a === "ranks") return ranks(q.get("tab") || "week");
  if (a === "church") { if (b === "new") return createChurch(); if (b) return churchPage(b, q); return churchHub(); }
  if (a === "c" && b) return joinByCode(b.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
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
      <div class="field"><label for="nm">What should we call you?</label><input id="nm" maxlength="40" placeholder="e.g. Michael" value="${esc(S.name)}"></div>
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
    { const n = $("#nm").value.trim().slice(0, 40); if (badNm(n)) { $("#nm").focus(); return toast(KIND_NAME); } S.name = n || "Player"; }
    S.onboarded = true; save(); buzz(15); sfx.ok();
    $("#go").disabled = true; $("#go").textContent = "Opening the gates…";
    await ensureSession();
    const imp = !S.imported && lx && lx.xp && !(ME.player && ME.player.xp) ? lx.xp : 0;
    await savePlayer(imp ? { importXp: imp } : {});
    S.imported = true; save();
    if (after) after(); else go("#/");
  };
}

// ---------- codes (v3.6.0): one box for every code a friend can send ----------
// 6 digits = a live challenge/quiz room (/j/CODE); letters = a "beat my set" challenge (/d/CODE); a pasted link works too.
function codeBoxHTML(id) {
  return `<form class="codebox" id="${id}" autocomplete="off"><input name="c" maxlength="40" placeholder="Got a code? Enter it here" autocapitalize="characters" spellcheck="false" enterkeyhint="go"><button class="btn ghost sm" type="submit">Join</button></form>`;
}
function goCode(raw) {
  const v = String(raw || "").trim();
  let m = v.match(/\/j\/(\d{6})/) || v.match(/^\s*(\d{3})\s?(\d{3})\s*$/);
  if (m) { location.href = "/j/" + (m[2] ? m[1] + m[2] : m[1]); return true; }
  m = v.match(/\/d\/([A-Za-z0-9]{4,12})/); if (m) { go("#/d/" + m[1].toUpperCase()); return true; }
  m = v.match(/\/c\/([A-Za-z0-9]{4,8})/); if (m) { go("#/c/" + m[1].toUpperCase()); return true; }
  const c = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (c.length < 4 || c.length > 12) { toast("Type the code you were sent (like 482913)."); return false; }
  go("#/d/" + c); return true;
}
function bindCodeBox(id) {
  const f = document.getElementById(id); if (!f) return;
  f.onsubmit = (e) => { e.preventDefault(); sfx.tap(); goCode(f.elements.c.value); };
}
// "Challenge someone": a knockout room. The creator is the host and plays from their own phone.
async function newKo() {
  render(`<div class="boot"><div class="boot-mark">⚔️</div><div class="boot-sub">Creating your challenge…</div></div>`);
  try {
    const r = await api("/lv/ko", { body: { name: (S.name || "Player").slice(0, 18), tier: S.tier } });
    try { localStorage.setItem("bal:p:" + r.code, JSON.stringify({ token: r.token, id: r.id })); const me = JSON.parse(localStorage.getItem("bal:me") || "{}") || {}; if (!me.name) localStorage.setItem("bal:me", JSON.stringify({ name: (S.name || "Player").slice(0, 18), avatar: me.avatar })); } catch (e) {}
    location.href = "/j/" + r.code;
  } catch (e) { toast(e.message || "Couldn't create the challenge. Try again."); go("#/"); }
}

// v3.7.0 "Join a live game": the busiest open public knockout lobby, or a new one that starts itself.
function koMine() { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^bal:p:\d{6}$/.test(k)) { const v = JSON.parse(localStorage.getItem(k) || "{}"); if (v && v.token) out.push({ code: k.slice(6), t: v.token }); } } } catch (e) {} return out.slice(-10); }
function koKeep(r) { try { localStorage.setItem("bal:p:" + r.code, JSON.stringify({ token: r.token, id: r.id })); const me = JSON.parse(localStorage.getItem("bal:me") || "{}") || {}; if (!me.name) localStorage.setItem("bal:me", JSON.stringify({ name: (S.name || "Player").slice(0, 18), avatar: me.avatar })); } catch (e) {} }
function koAvatar() { try { return (JSON.parse(localStorage.getItem("bal:me") || "{}") || {}).avatar; } catch (e) { return undefined; } }
async function quickKo() {
  render(`<div class="boot"><div class="boot-mark">🎮</div><div class="boot-sub">Finding a live game…</div></div>`);
  try {
    const r = await api("/lv/ko/quick", { body: { name: (S.name || "Player").slice(0, 18), tier: S.tier, avatar: koAvatar(), mine: koMine() } });
    koKeep(r);
    location.href = "/j/" + r.code;
  } catch (e) { toast(e.message || "Couldn't find a game. Try again."); go("#/"); }
}
/** One tap from Live now / a pop-up: join that knockout room with my name (players in a running game watch until the next one). */
async function joinKo(code) {
  code = String(code || "").replace(/\D/g, "").slice(0, 6);
  try { const had = JSON.parse(localStorage.getItem("bal:p:" + code) || "null"); if (had && had.token) { location.href = "/j/" + code; return; } } catch (e) {}
  if (!S.name) { location.href = "/j/" + code; return; }
  try { const r = await api("/lv/r/" + code + "/join", { body: { name: S.name.slice(0, 18), avatar: koAvatar() } }); koKeep({ code, token: r.token, id: r.id }); }
  catch (e) { if (e.status === 404) { toast("That game has ended."); return; } }
  location.href = "/j/" + code;
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
    <div class="row between"><div><div class="small muted">${hello},</div><h2>${esc(S.name || "friend")}</h2><a class="onlinepill" href="#/online" id="onlpill"><i class="dot"></i><span data-online>${onlineText()}</span></a></div>
      <button class="chip on" id="tierchip">${TIER[S.tier].icon} ${TIER[S.tier].name}</button></div>
    <div class="sechead"><b>How do you want to play?</b></div>
    <div class="card way">
      <div class="row" style="gap:12px"><div class="wayico">🎯</div><div class="grow"><b class="wayt">Play solo</b><div class="small muted">Just you and the Word. Pick a game, play as much as you like.</div></div></div>
      <div class="row" style="gap:8px;margin-top:12px"><a class="btn primary grow" href="#/play/mixed">▶ Play now</a><button class="btn ghost grow" data-more>Choose a game ↓</button></div>
    </div>
    <div id="homelive">${liveCardHTML()}</div>
    <div class="card way gold">
      <div class="row" style="gap:12px"><div class="wayico">⚔️</div><div class="grow"><b class="wayt">Challenge someone</b><div class="small muted">Get a code and send the link. Friends join, you play live: lose a round and you're out. Last one standing wins.</div></div></div>
      <button class="btn primary block" id="kocta" style="margin-top:12px">⚔️ Create a challenge</button>
      <div style="margin-top:10px">${codeBoxHTML("homecode")}</div>
      <a class="small muted" href="#/duel/new" style="display:block;margin-top:10px;text-align:center">Or send a set they can play later ›</a>
    </div>
    <div class="card">
      <div class="row between"><div class="tiny gold">☀️ Daily Challenge · ${esc(daily ? daily.day : "")}</div>${daily && daily.played ? `<span class="small muted">✅ ${fmt(daily.played.score)} pts</span>` : ""}</div>
      <b style="display:block;margin:6px 0 4px;font-size:17px">${daily && daily.played ? `Done! You got ${daily.played.correct}/${daily.played.total}` : "Today's 10 for everyone"}</b>
      ${dailyGuide(!!(daily && daily.played))}
      ${daily && daily.played
        ? `<div class="row" style="gap:8px"><a class="btn ghost grow sm" href="#/play/practice">🔁 Practise again</a><a class="btn ghost grow sm" href="#/ranks?tab=daily">🌍 Scoreboard</a></div>`
        : `<a class="btn primary block" href="#/play/daily">▶ Play today's challenge</a>`}
    </div>
    <div id="moregames" class="col" style="gap:14px">
    <div class="sechead"><b>🎮 All games</b><span class="small muted">Solo, anytime, as many times as you like.</span></div>
    <div class="grid2">
      ${modeTile("gap", true)}${modeTile("who")}${modeTile("myth")}${modeTile("arena")}${modeTile("mixed")}${modeTile("sudden")}
    </div>
    </div>
    <div class="card">
      <div class="tiny gold">Verse of the day</div>
      <p class="vod" style="margin:8px 0 6px">“${esc(vod[0])}”</p>
      <div class="small muted">${esc(vod[1])} (KJV)</div>
    </div>
    <div class="sechead"><b>More</b></div>
    <div id="homechurch"></div>
    <a class="card row slim" href="/live" style="text-decoration:none;color:inherit"><div style="font-size:22px">📺</div><div class="grow"><b>Quiz night for a big group</b><div class="small muted">On a projector, up to 200 phones</div></div><div class="gold">›</div></a>
    <div class="card">
      <div class="row between"><b>Classic modes</b><span class="small dim">from Bible Arena v2</span></div>
      <div class="row" style="flex-wrap:wrap;gap:8px;margin-top:10px">
        <a class="chip" href="/room">🔴 Live Room (classic)</a><a class="chip" href="/ai-battle">🤖 AI Battle</a><a class="chip" href="/quiz?kind=puzzle">🔤 Word Puzzle</a><a class="chip" href="/friends">👥 Friends</a><a class="chip" href="/play">🏛️ Classic Arena</a>
      </div>
    </div>
    ${androidCard()}
  </div>`;
  $("#kocta").onclick = () => { sfx.tap(); buzz(10); go("#/ko/new"); };
  bindCodeBox("homecode");
  homeChurchCard();
  bindLiveCard();
  $("#tierchip").onclick = () => tierSheet(() => home());
  $$(".mode", h).forEach((m) => (m.onclick = () => { sfx.tap(); buzz(8); go("#/play/" + m.dataset.m); }));
  $$("[data-more]", h).forEach((b) => (b.onclick = () => { sfx.tap(); showMoreGames(); }));
  if (WANT_MORE) { WANT_MORE = false; setTimeout(showMoreGames, 250); }
}
// "↓ Play more games below": scroll to the other modes and make them glow for a moment.
let WANT_MORE = false;
function showMoreGames() {
  const el = document.getElementById("moregames");
  if (!el) { WANT_MORE = true; return go("#/"); }
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  setTimeout(() => el.classList.remove("flash"), 2600);
}
function inAppShell() {
  if (/[?&]app=android/.test(location.search)) { try { sessionStorage.setItem("ba3:app", "1"); } catch (e) {} }
  let flag = null; try { flag = sessionStorage.getItem("ba3:app"); } catch (e) {}
  return !!(flag || document.referrer.startsWith("android-app://") || matchMedia("(display-mode: standalone)").matches);
}
function androidCard() {
  if (inAppShell() || !/Android/i.test(navigator.userAgent)) return "";
  return `<a class="card row" href="/download" style="text-decoration:none;color:inherit"><div style="font-size:28px">📱</div><div class="grow"><b>Get the Android app</b><div class="small muted">Full screen, one tap from your home screen</div></div><div class="gold">›</div></a>`;
}
function untilMidnight() {
  const now = Date.now() + 3600e3; const left = 864e5 - (now % 864e5);
  const h = Math.floor(left / 36e5), m = Math.floor((left % 36e5) / 6e4); return `${h}h ${m}m`;
}
// The daily set changes at 00:00 West Africa Time (UTC+1): lagosDay() on the server, untilMidnight() here.
const DAILY_WHY = "One official try a day keeps it fair: everyone gets the same 10. Practise below anytime.";
function dailyWhy() { return `<p class="dailywhy">${DAILY_WHY}</p>`; }
// Step-by-step words for the Daily Challenge, before and after the official try (Michael, Oct 12: "people can be very in need of instruction").
function dailyGuide(played) {
  const li = (i, t) => `<li><span class="gi">${i}</span><span>${t}</span></li>`;
  return played
    ? `<ul class="guide">${li("🌍", "That was today's <b>Global Scoreboard</b> challenge. Your score is in!")}${li("⚖️", "One official try a day, the same 10 for everyone, so it's fair.")}${li("🔁", "Want another go? Practise today's set. It's <b>not scored</b>.")}${li("🎮", "<b>More games are below.</b> Play them anytime, as much as you like.")}${li("⏰", `New challenge at midnight, in ${untilMidnight()}.`)}</ul>`
    : `<ul class="guide">${li("☀️", "Today's 10 questions, the same for everyone.")}${li("🎯", "You get <b>one official try</b> today.")}${li("🌍", "Your score goes on the <b>GLOBAL scoreboard</b>.")}${li("🎮", "Just want to play? <b>More games are below</b>, anytime.")}</ul>`;
}
function modeChips() {
  const c = (h, t) => `<a class="chip" href="${h}">${t}</a>`;
  return `<div class="row" style="gap:8px;flex-wrap:wrap">${c("#/ko/new", "⚔️ Challenge someone")}${["gap", "who", "myth", "arena", "mixed", "sudden"].map((k) => c("#/play/" + k, MODES[k].icon + " " + MODES[k].name)).join("")}</div>`;
}
// The correct answer, spelled out, for the practice review.
function answerText(it) {
  if (!it) return "";
  if (it.k === "gap") return it.text;
  if (it.k === "tf") return String(it.a) === "myth" ? "MYTH: not in the Bible" : "FACT: it's in the Bible";
  if (it.k === "order") return String(it.a).split(">").map((i) => it.o[+i]).join(" → ");
  return it.o ? it.o[it.a] : String(it.a);
}
function practiceQ(it) {
  if (!it) return "";
  if (it.k === "gap") return "Fill in the Gap";
  if (it.k === "who") return "Who Am I? " + (it.clues && it.clues[0] ? it.clues[0] : "");
  return it.q || "";
}
function modeTile(k, isNew) {
  const m = MODES[k];
  const colors = { gap: "rgba(245,185,66,.18)", who: "rgba(155,140,255,.18)", myth: "rgba(60,201,192,.18)", arena: "rgba(90,184,255,.18)", mixed: "rgba(255,138,101,.18)", sudden: "rgba(255,93,115,.16)" };
  return `<button class="mode" data-m="${k}">${isNew ? `<span class="new">NEW</span>` : ""}<div class="ico" style="background:${colors[k]}">${m.icon}</div><div><b>${m.name}</b><span>${m.desc}</span></div></button>`;
}
function tierSheet(done) {
  const el = document.createElement("div"); el.className = "modal";
  el.innerHTML = `<div class="sheet col"><h2>Choose your level</h2>
    ${["b", "s", "t"].map((k) => `<button class="card row tierpick" data-t="${k}" style="text-align:left;${S.tier === k ? "border-color:var(--gold)" : ""}"><div style="font-size:28px">${TIER[k].icon}</div><div class="grow"><b>${TIER[k].name}</b><div class="small muted">${k === "b" ? "The classic questions. Relaxed clock, 2 blanks per verse." : k === "s" ? "Deeper questions, 3 blanks + decoys, a clock on every question." : "Hardest: minor characters, numbers, 5 blanks, look-alike decoys, fast clock."}</div></div>${S.tier === k ? "✓" : ""}</button>`).join("")}
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
  if (mode === "practice") {
    // Practice replays today's Daily Challenge set on this phone only. Nothing is sent to the server,
    // so the board, streak, XP and leagues are untouched. It opens only after the official try.
    let d = null; try { d = await api("/api/v3/daily"); } catch (e) { toast("Couldn't reach the server. Check your data."); return go("#/"); }
    if (!d.played) { toast("Play today's official try first. Practice opens after."); return go("#/play/daily"); }
    return runRound({ ids: d.ids, tier: "s", mode: "practice", title: "Practice — not scored", practice: true });
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
  const answers = []; let idx = 0, score = 0, combo = 0, bestCombo = 0, correctN = 0, bonusRight = 0;
  let timerH = null, tickH = null, rivalH = null, rival = null;
  const total = cfg.sudden ? null : items.length;
  const rid = ++ROUND_SEQ; const live = () => rid === ROUND_SEQ;
  // v3.5.0 fix: the rival poll is round-level, so it is not tied to onLeave (each question's render runs the onLeave
  // cleanups, which stopped the poll after its first read); it stops itself when the round is left or over.
  onLeave(() => { clearTimeout(timerH); clearInterval(tickH); });
  if (cfg.duel) {
    const poll = async () => { if (!live()) return clearInterval(rivalH); try { const v = await api("/api/v3/duels/" + cfg.duel.code); if (!live() || !$("#rival")) return clearInterval(rivalH); const others = v.entries.filter((e) => !e.isMe); rival = others.find((e) => !e.finished && e.progress > 0 && Date.now() - new Date(e.updatedAt).getTime() < 60000) || others.find((e) => e.isCreator) || others[0] || null; drawRival(); } catch (e) {} };
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
    return `<div class="playtop"><button class="iconbtn" id="quit" aria-label="Quit">✕</button>${dots}${combo >= 2 ? `<span class="combo">x${(1 + Math.min(combo, 10) * 0.1).toFixed(1)}</span>` : ""}<div class="score-pill" id="sc">${fmt(score)}</div></div>${cfg.practice ? `<div class="practicetag">Practice — not scored</div>` : ""}${cfg.bonusFrom ? `<div class="practicetag">❤️ Bonus life — just for fun, your score stays at ${fmt(score)}</div>` : ""}<div id="rival"></div>`;
  }
  function next() {
    clearTimeout(timerH); clearInterval(tickH);
    if (idx >= items.length || (cfg.sudden && answers.length && !answers[answers.length - 1].correct && answers.length !== cfg.bonusFrom)) return finish();
    show(items[idx]);
  }
  function show(it) {
    const limit = limitOf(it, tier);
    const label = it.m === "gap" ? "Fill in the Gap" : it.m === "who" ? "Who Am I?" : it.m === "myth" ? "Bible or Myth?" : it.k === "who_said" ? "Who said it?" : it.k === "order" ? "Put in order" : (it.cat || "Arena");
    render(`${header()}${limit ? `<div class="timer" id="tm"><i></i></div>` : `<div style="height:20px"></div>`}
      <div class="qcard"><div class="qmeta"><span class="tiny">${esc(label)}</span><span class="pill-tier">${TIER[tier].name}</span></div><div id="qbody"></div></div>
      <div id="ans"></div><div id="adhint"></div><div id="fb"></div>`);
    onLeave(() => { clearTimeout(timerH); clearInterval(tickH); });
    if (window.BAS) { BAS.setBusy(true); onLeave(() => BAS.setBusy(false)); }
    $("#quit").onclick = () => { if (confirm("Leave this round? Your progress in it will be lost.")) go("#/"); };
    drawRival();
    const started = performance.now();
    let done = false, clues = 1;
    const finishQ = (choice) => {
      if (done || !live()) return; done = true; clearTimeout(timerH); clearInterval(tickH);
      const ms = Math.round(performance.now() - started);
      const c = check(it, tier, choice);
      const bonus = !!cfg.bonusFrom; // v3.8.3: bonus-life answers are just for fun: never scored or sent
      const pts = bonus ? 0 : points(it, tier, c, ms, clues, combo);
      if (c.correct) { if (bonus) bonusRight++; else { combo++; correctN++; bestCombo = Math.max(bestCombo, combo); } sfx.ok(); buzz(20); } else { if (!bonus) combo = 0; sfx.bad(); buzz([40, 40, 60]); }
      score += pts;
      const ah = $("#adhint"); if (ah) ah.innerHTML = "";
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
      tickH = setInterval(() => { if (!live()) return clearInterval(tickH); const left = limit - (performance.now() - started) / 1000; if (left <= 5.5 && left > 0) { sfx.tick(); const t = $("#tm"); t && t.classList.add("low"); } }, 1000);
    }
    let gapState = () => null, hintGap = null;
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
      hintGap = () => { const e = fill.indexOf(null); if (e < 0) return false; const ci = chips.findIndex((c, k) => c.w === want[e] && fill.indexOf(k) < 0); if (ci < 0) return false; fill[e] = ci; draw(); return true; };
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
    if (cfg.practice) adHint(it, () => done, () => hintGap);
  }
  // v3.8.3: Practice only (never scored): "Watch a short ad for a hint", shown only inside the Android app.
  function adHint(it, isDone, getGap) {
    const box = $("#adhint"); if (!box || !BA_ADS.available()) return;
    const opts = it.k === "who" || it.k === "mc" || it.k === "who_said" || (!it.k && Array.isArray(it.o));
    const kind = it.k === "gap" ? "gap" : it.k === "tf" ? (it.r ? "ref" : null) : it.k === "order" ? null : opts && it.o && it.o.length >= 3 ? "fifty" : null;
    if (!kind) return;
    const label = kind === "gap" ? "fill in one word" : kind === "ref" ? "see the Bible reference" : "remove two wrong answers";
    box.innerHTML = `<button class="btn ghost block sm adbtn" id="adh">▶ Watch a short ad to ${label}</button>`;
    $("#adh").onclick = async () => {
      if (isDone() || !live()) return;
      clearTimeout(timerH); clearInterval(tickH); // practice: the clock stops for a hint
      const tm = $("#tm"); if (tm) tm.style.visibility = "hidden";
      const b = $("#adh"); b.disabled = true; b.textContent = "Opening the ad…";
      const r = await BA_ADS.showRewarded("hint");
      if (isDone() || !live() || !$("#adhint")) return;
      if (r !== "reward") {
        if (r === "dismiss") { b.disabled = false; b.textContent = `▶ Watch a short ad to ${label}`; toast("The ad was closed early, so no hint this time."); }
        else { box.innerHTML = ""; toast("No ad available right now. Keep going, you've got this!"); }
        return;
      }
      box.innerHTML = "";
      if (kind === "gap") { const g = getGap(); if (g && g()) toast("Hint: one word filled in ✓"); }
      else if (kind === "ref") box.innerHTML = `<div class="card small" style="margin-top:8px">📖 Hint: look it up in <b>${esc(it.r)}</b> (KJV)</div>`;
      else {
        const wrong = $$("#ans .opt").filter((x) => String(x.dataset.c) !== String(it.a) && !x.disabled);
        const drop = shuffled(wrong, String(Math.random())).slice(0, Math.max(1, Math.min(2, wrong.length - 1)));
        drop.forEach((x) => { x.disabled = true; x.classList.add("dim"); x.style.visibility = "hidden"; });
        toast("Hint: two wrong answers removed ✓");
      }
    };
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
    // v3.8.3: Sudden Death, first miss, Android app only: one opt-in bonus life (answers after it are never scored or sent).
    const offerBonus = cfg.sudden && !c.correct && !cfg.bonusFrom && idx + 1 < items.length && BA_ADS.available();
    $("#fb").innerHTML = `<div class="feedback ${verdict[0]}">
      <div class="row between"><span class="verdict">${verdict[1]}</span><span class="gold serif" style="font-weight:800">+${fmt(pts)}</span></div>
      ${ans ? `<div style="margin-top:6px">${ans}</div>` : ""}
      ${it.k === "gap" && !c.correct ? `<div class="vod" style="margin-top:8px;font-size:15.5px">“${esc(it.text)}”</div>` : ""}
      ${it.x ? `<div class="small muted" style="margin-top:6px">${esc(it.x)}</div>` : ""}
      ${it.r ? `<div class="ref">📖 ${esc(it.r)} <span class="dim small" style="font-weight:600">KJV</span></div>` : ""}
      </div>${offerBonus ? `<button class="btn primary block adbtn" id="adlife" style="margin-top:12px">▶ Watch a short ad for a bonus life</button><div class="small muted center" style="margin-top:6px">Just for fun: your score stays at ${fmt(score)}.</div>` : ""}<button class="btn ${offerBonus ? "ghost" : "primary"} block" id="nx" style="margin-top:12px">${last ? "See results" : "Next ›"}</button>`;
    $("#nx").onclick = () => { idx++; sfx.tap(); next(); };
    if (offerBonus) $("#adlife").onclick = async () => {
      const b = $("#adlife"), nx = $("#nx"); b.disabled = true; nx.disabled = true; b.textContent = "Opening the ad…";
      const r = await BA_ADS.showRewarded("bonus_life");
      if (!live() || !$("#adlife")) return;
      nx.disabled = false;
      if (r === "reward") { cfg.bonusFrom = answers.length; toast("Bonus life ❤️ Keep going!"); idx++; next(); return; }
      if (r === "dismiss") { b.disabled = false; b.textContent = "▶ Watch a short ad for a bonus life"; toast("The ad was closed early, so no bonus life this time."); }
      else { b.remove(); toast("No ad available right now."); }
    };
    setTimeout(() => { const n = $("#nx"); n && n.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, 120);
  }
  function finish() {
    clearInterval(rivalH);
    if (!cfg.practice) markSeen(answers.map((a) => a.id), tier);
    if (cfg.practice) return practiceResults(cfg, answers, { score, correct: correctN, bestCombo, total: answers.length });
    // v3.8.3: only the answers up to the Sudden Death miss are scored; a bonus life is just for fun.
    const scored = cfg.bonusFrom ? answers.slice(0, cfg.bonusFrom) : answers;
    if (cfg.bonusFrom) cfg.bonusNote = `Bonus life: ${bonusRight} more right after your miss, just for fun (not scored).`;
    results(cfg, scored, { score, correct: correctN, bestCombo, total: scored.length });
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
    <div id="pushask"></div>
    <div class="stats3"><div class="stat"><b>${correct}/${total}</b><span>Correct</span></div><div class="stat"><b>x${local.bestCombo}</b><span>Best streak</span></div><div class="stat"><b class="gold">+${fmt(r ? r.xp : 0)}</b><span>XP</span></div></div>
    ${r && r.player ? `<div class="card"><div class="row between"><b>${esc(r.player.rank.name)} ${r.player.rank.division}</b><span class="small muted">${fmt(r.player.xp)} XP</span></div><div class="xpbar" style="margin-top:8px"><i id="xpb" style="width:${Math.round((r.rankBefore ? r.rankBefore.progress : 0) * 100)}%"></i></div><div class="small dim" style="margin-top:6px">${r.player.rank.next ? `${fmt(r.player.rank.nextXp - r.player.xp)} XP to ${r.player.rank.next}` : "You've reached Apostle"} · 🔥 ${r.player.streak}-day streak</div></div>` : ""}
    ${r && !cfg.duel ? `<div id="reschurch"></div>` : ""}
    ${cfg.bonusNote ? `<div class="card small">❤️ ${esc(cfg.bonusNote)}</div>` : ""}
    ${err && !r ? `<div class="card small">⚠️ Couldn't save this round (no connection). Your score still counts here.</div>` : ""}
    ${r && r.newAchievements && r.newAchievements.length ? r.newAchievements.map((a) => ACH[a] ? `<div class="badge"><div class="bi">${ACH[a][0]}</div><div><b>Achievement: ${ACH[a][1]}</b><div class="small muted">${ACH[a][2]}</div></div></div>` : "").join("") : ""}
    ${cfg.mode !== "daily" && cfg.mode !== "sudden" ? `<button class="card gold row" id="dset" style="text-align:left;gap:12px"><div style="font-size:28px">⚔️</div><div class="grow"><b>Challenge someone with this exact set</b><div class="small muted">They play the same ${total} questions and try to beat ${fmt(score)}</div></div><div class="gold">›</div></button>` : ""}
    ${cfg.mode === "daily" ? `<div class="card gold"><b style="font-size:17px">What now?</b>${dailyGuide(true)}<div class="col" style="gap:8px"><button class="btn primary block" data-more>↓ Play more games</button><a class="btn ghost block" href="#/play/practice">🔁 Practise today's set (not scored)</a></div><div class="small muted" style="margin:14px 0 8px">Or jump straight into a game:</div>${modeChips()}</div>` : ""}
    <div class="row"><button class="btn ${cfg.mode === "daily" ? "ghost" : "primary"} grow" id="again">${cfg.mode === "daily" ? "🌍 See the Global Scoreboard" : "Play again"}</button><button class="btn ghost" id="share" aria-label="Share">📤</button></div>
    <div class="card"><b>Review</b>${answers.map((a) => { const it = BY[a.id]; return `<div class="review"><div>${a.correct ? "✅" : a.partial > 0 ? "🟨" : "❌"}</div><div class="grow"><div>${esc(shortQ(it))}</div><div class="small gold">${esc(it.r || "")}</div></div></div>`; }).join("")}</div>
    <a class="btn ghost block" href="#/">Home</a>
  </div>`);
  countUp($("#big"), score);
  if (r && !cfg.duel) resultsChurchLine(score);
  pushAsk("#pushask");
  setTimeout(() => { const b = $("#xpb"); if (b && r && r.player) b.style.width = Math.round((r.rankAfter && r.rankAfter.index > r.rankBefore.index ? 1 : r.player.rank.progress) * 100) + "%"; }, 300);
  if (perfect) { confetti(80); sfx.win(); } else sfx.ok();
  if (r && r.rankAfter && r.rankBefore && r.rankAfter.index > r.rankBefore.index) setTimeout(() => rankUp(r.rankAfter), 900);
  $("#again").onclick = () => (cfg.mode === "daily" ? go("#/ranks?tab=daily") : startMode(cfg.mode, cfg.tier));
  const ds = $("#dset"); if (ds) ds.onclick = () => createDuelFromSet(cfg, answers);
  $$("[data-more]").forEach((b) => (b.onclick = () => { sfx.tap(); showMoreGames(); }));
  $("#share").onclick = () => shareCard({ score, correct, total, tier: cfg.tier, title: cfg.title });
}
// Practice results: scored on the phone only, never posted. Shows every correct answer.
function practiceResults(cfg, answers, local) {
  const { score, correct, total } = local;
  render(`
  <div class="col" style="gap:14px">
    <div class="center" style="padding-top:10px">
      <div class="practicetag" style="margin:0 auto 6px">Practice — not scored</div>
      <div class="tiny gold">Today's Daily Challenge set</div>
      <div class="bigscore" id="big">0</div>
      <div class="muted">${correct === total ? "All ten! You know today's set by heart. 👑" : `You got ${correct}/${total} this time. Every answer is below.`}</div>
    </div>
    <div id="pushask"></div>
    <div class="stats3"><div class="stat"><b>${correct}/${total}</b><span>Correct</span></div><div class="stat"><b>x${local.bestCombo}</b><span>Best streak</span></div><div class="stat"><b class="dim">0</b><span>XP · practice</span></div></div>
    <div class="card small muted">Your board place, 🔥 streak, XP and league stay exactly as they were. Only your official try counts.</div>
    <div class="card"><b>The answers</b>${answers.map((a) => { const it = BY[a.id]; return `<div class="review"><div>${a.correct ? "✅" : a.partial > 0 ? "🟨" : "❌"}</div><div class="grow"><div>${esc(practiceQ(it))}</div><div class="answer">${esc(answerText(it))}</div><div class="small gold">${esc(it.r || "")}</div></div></div>`; }).join("")}</div>
    <div class="col" style="gap:8px"><button class="btn primary block" id="again">🔁 Practise again</button><a class="btn ghost block" href="#/ranks?tab=daily">Today's board</a></div>
    <a class="btn ghost block" href="#/">Home</a>
  </div>`);
  countUp($("#big"), score);
  sfx.ok();
  $("#again").onclick = () => startMode("practice", "s");
}
function shortQ(it) { if (!it) return ""; if (it.k === "gap") return "“" + it.text.slice(0, 70) + (it.text.length > 70 ? "…”" : "”"); if (it.k === "who") return "Who Am I: " + it.o[it.a]; const q = it.q || ""; return q.length > 90 ? q.slice(0, 88) + "…" : q; }
function countUp(el, to) { if (!el) return; const t0 = performance.now(), d = 1100; const f = (t) => { const p = Math.min(1, (t - t0) / d); el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }
function rankUp(rk) {
  sfx.win(); buzz([30, 60, 30, 60, 80]); confetti(100);
  const el = document.createElement("div"); el.className = "modal center";
  el.innerHTML = `<div class="sheet rankup"><div class="burst"></div><div class="emblem">${rk.name[0]}</div><div class="tiny gold">New rank</div><h1 class="title-gold" style="font-size:34px;margin:4px 0">${esc(rk.name)}</h1><p class="muted">“Well done, thou good and faithful servant.” Matthew 25:21</p><button class="btn primary block" style="margin-top:12px">Amen!</button></div>`;
  document.body.appendChild(el); el.querySelector("button").onclick = () => el.remove();
}

// ---------- Church League: church teams, invite links, weekly + all-time church boards ----------
let CH_META = null;
async function chMeta() { if (!CH_META) { try { CH_META = await api("/api/v3/churches/meta"); } catch (e) { CH_META = { states: [], kinds: ["church", "fellowship", "campus"] }; } } return CH_META; }
const KIND = { church: "Church", fellowship: "Fellowship", campus: "Campus fellowship" };
function untilReset(ts) {
  const left = Math.max(0, (ts || 0) - Date.now()); const d = Math.floor(left / 864e5), h = Math.floor((left % 864e5) / 36e5), m = Math.floor((left % 36e5) / 6e4);
  return d ? `${d}d ${h}h` : `${h}h ${m}m`;
}
function churchLink(code) { return origin() + "/c/" + code; }
function churchShareText(c) { return `Join ${c.name} on Bible Arena ⛪\nWe're playing in the Church League. Every round you play adds points for our church. Tap to join our team:\n${churchLink(c.code)}\n(Invite code: ${c.code})`; }
async function shareChurch(c) {
  sfx.tap();
  const text = churchShareText(c);
  if (navigator.share && !/Windows|Macintosh/.test(navigator.userAgent)) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  location.href = waLink(text);
}
// S.church mirrors the church team (the server also forces a member's church to the team name).
function syncChurch(c) { if (c) { S.church = c.name; S.teamName = c.name; } else if (S.teamName) { S.church = ""; S.teamName = ""; } save(); }
function placeLine(c) { return `${esc(c.city)}, ${esc(c.state)} · ${KIND[c.kind] || "Church"}`; }
function medal(i) { return i === 1 ? "🥇" : i === 2 ? "🥈" : i === 3 ? "🥉" : i; }

async function churchHub() {
  render(`<div id="chh"><div class="boot"><div class="boot-mark">⛪</div><div class="boot-sub">Opening the Church League…</div></div></div>${tabbar("ranks")}`);
  await ensureSession();
  let mine = null; try { mine = await api("/api/v3/churches/mine"); } catch (e) {}
  if (mine && mine.church) { syncChurch(mine.church); return go("#/church/" + mine.church.id); }
  const el = $("#chh"); if (!el) return;
  el.innerHTML = `<div class="col" style="gap:14px">
    <div class="hero"><div class="rays"></div><div class="tiny gold">⛪ Church League</div>
      <h2 style="margin:6px 0 6px;font-family:var(--serif)">Play for your church</h2>
      <p class="small muted" style="margin:0">Join your church, fellowship or campus team. Every round you play adds points to your church on the weekly league. The top church each week is crowned champion 🏆</p></div>
    <div class="card gold col">
      <div class="field"><label for="jc">Got an invite code?</label><input id="jc" maxlength="8" autocapitalize="characters" autocomplete="off" placeholder="e.g. K7Q2MX" style="text-transform:uppercase;letter-spacing:.2em;font-weight:800"></div>
      <div id="jerr" class="small" style="color:#ff8a80;display:none"></div>
      <button class="btn primary block" id="jgo">Join my church</button>
    </div>
    <div class="card row" style="gap:14px">
      <div style="font-size:30px">✨</div><div class="grow"><b>Your church isn't here yet?</b><div class="small muted">Create its team in 30 seconds, then share the link in your church WhatsApp group.</div></div>
    </div>
    <a class="btn ghost block" href="#/church/new">➕ Create a church team</a>
    <a class="btn ghost block" href="#/ranks?tab=church">🏆 See the Church League</a>
  </div>`;
  const join = () => { const c = $("#jc").value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ""); if (c.length < 4) { $("#jerr").textContent = "Type the invite code from your church."; $("#jerr").style.display = "block"; return; } go("#/c/" + c); };
  $("#jgo").onclick = join; $("#jc").onkeydown = (e) => { if (e.key === "Enter") join(); };
}

async function createChurch() {
  render(`<div id="chn"></div>${tabbar("ranks")}`);
  await ensureSession();
  const meta = await chMeta();
  const el = $("#chn"); if (!el) return;
  el.innerHTML = `<div class="col" style="gap:14px">
    <div class="row" style="gap:10px"><a class="iconbtn" href="#/church" aria-label="Back">‹</a><h2>Create a church team</h2></div>
    <div class="card gold col" style="gap:14px">
      <div class="field"><label>This team is for a</label><div class="row" id="kinds" style="flex-wrap:wrap;gap:8px">${meta.kinds.map((k, i) => `<button class="chip ${i === 0 ? "on" : ""}" data-k="${k}">${k === "church" ? "⛪" : k === "fellowship" ? "🙌" : "🎓"} ${KIND[k]}</button>`).join("")}</div></div>
      <div class="field"><label for="cn">Name</label><input id="cn" maxlength="50" placeholder="e.g. RCCG Jesus House" autocomplete="off"><span class="small dim" id="cnc">3–50 characters. Use the name your members know.</span></div>
      <div class="field"><label for="cc">City or town</label><input id="cc" maxlength="40" placeholder="e.g. Akure" autocomplete="off"></div>
      <div class="field"><label for="cs">State</label><select id="cs"><option value="">Choose a state</option>${meta.states.map((s) => `<option>${esc(s)}</option>`).join("")}</select></div>
      <div id="cerr" class="small" style="color:#ff8a80;display:none"></div>
      <button class="btn primary block" id="cgo">Create team</button>
      <p class="small dim" style="margin:0">You'll get an invite link to share. You can be in one church team at a time; creating this one moves you into it.</p>
    </div></div>`;
  let kind = meta.kinds[0];
  $("#kinds").onclick = (e) => { const b = e.target.closest("[data-k]"); if (!b) return; kind = b.dataset.k; $$("#kinds .chip").forEach((x) => x.classList.toggle("on", x === b)); sfx.tap(); };
  ["#cn", "#cc", "#cs"].forEach((s) => $(s).addEventListener("input", () => { $("#cerr").style.display = "none"; }));
  $("#cn").oninput = () => { const n = $("#cn").value.trim().length; $("#cnc").textContent = n ? `${n}/50` : "3–50 characters. Use the name your members know."; };
  $("#cgo").onclick = async () => {
    const body = { name: $("#cn").value, city: $("#cc").value, state: $("#cs").value, kind };
    const err = (m) => { $("#cerr").textContent = m; $("#cerr").style.display = "block"; buzz([20, 40, 20]); };
    if (body.name.trim().length < 3) return err("Please enter your church name (at least 3 letters).");
    if (body.city.trim().length < 2) return err("Please enter the city or town.");
    if (!body.state) return err("Please pick the state.");
    $("#cgo").disabled = true; $("#cgo").textContent = "Creating…";
    if (!ME.player) await savePlayer();
    try {
      const r = await api("/api/v3/churches", { body });
      syncChurch(r.church); sfx.win(); confetti(70); toast("Your church team is live ⛪");
      go("#/church/" + r.church.id + "?new=1");
    } catch (e) {
      $("#cgo").disabled = false; $("#cgo").textContent = "Create team";
      err((e.data && e.data.message) || (e.status === 429 ? "Too many new teams from here. Try again later." : "Couldn't create the team. Check your connection and try again."));
    }
  };
}

async function churchPage(id, q) {
  render(`<div id="chp"><div class="boot"><div class="boot-mark">⛪</div><div class="boot-sub">Loading…</div></div></div>${tabbar("ranks")}`);
  await ensureSession();
  let d; try { d = await api("/api/v3/churches/" + encodeURIComponent(id)); } catch (e) {
    const el = $("#chp"); if (el) el.innerHTML = `<div class="col center" style="padding-top:18vh;gap:12px"><div style="font-size:48px">🕊️</div><h2>Church not found</h2><p class="muted">This team may have closed.</p><a class="btn primary" href="#/church">Church League</a></div>`;
    return;
  }
  const c = d.church; if (d.isMember) syncChurch(Object.assign({}, c));
  let per = (q && q.get("p")) === "all" ? "all" : "week";
  const el = $("#chp"); if (!el) return;
  const isNew = q && q.get("new");
  const board = () => {
    const rows = d.members.slice().sort((a, b) => (b[per] - a[per]) || (b.xp - a.xp));
    return rows.length ? rows.slice(0, 50).map((m, i) => `<div class="lb ${m.isMe ? "me" : ""}"><div class="pos p${i + 1}">${medal(i + 1)}</div><div class="grow"><b>${esc(m.name)}</b>${m.isMe ? ` <span class="small gold">you</span>` : ""}${m.role === "owner" ? ` <span class="small dim">· team lead</span>` : ""}<div class="small muted">${esc(rankOf(m.xp).name)}</div></div><div class="gold serif" style="font-weight:800">${fmt(m[per])}</div>${d.isOwner && !m.isMe ? `<button class="chip" data-rm="${m.idx}" aria-label="Remove ${esc(m.name)}" style="padding:4px 8px">✕</button>` : ""}</div>`).join("") : `<div class="muted">No members yet.</div>`;
  };
  el.innerHTML = `<div class="col" style="gap:14px">
    <div class="row" style="gap:10px"><a class="iconbtn" href="#/ranks?tab=church" aria-label="Back">‹</a><div class="tiny gold grow">⛪ Church League</div></div>
    <div class="hero center"><div class="rays"></div>
      ${c.champion ? `<div class="chip on" style="margin-bottom:8px">🏆 Last week's champion</div>` : ""}
      <div style="font-size:40px;line-height:1">${c.kind === "campus" ? "🎓" : c.kind === "fellowship" ? "🙌" : "⛪"}</div>
      <h2 style="font-family:var(--serif);margin:8px 0 2px">${esc(c.name)}${c.verified ? ` <span class="vtick" title="Verified church">✅</span>` : ""}</h2>
      <div class="small muted">${placeLine(c)}</div>
      ${c.verified ? `<div class="small" style="color:#3DDC97;margin-top:4px">✅ Verified church</div>` : ""}
      ${c.titles ? `<div class="small gold" style="margin-top:6px">🏆 ${c.titles}× weekly champion</div>` : ""}
    </div>
    <div class="stats3">
      <div class="stat"><b>${d.week.rank ? "#" + d.week.rank : "–"}</b><span>This week</span></div>
      <div class="stat"><b class="gold">${fmt(d.week.points)}</b><span>Week points</span></div>
      <div class="stat"><b>${c.members}</b><span>Member${c.members === 1 ? "" : "s"}</span></div>
    </div>
    <div class="small dim center" style="margin-top:-4px">All-time: ${fmt(d.all.points)} pts${d.all.rank ? ` · #${d.all.rank} of ${d.all.of}` : ""} · Weekly league resets in ${untilReset(d.resetsAt)}</div>
    ${d.isMember ? `<div class="card gold col" style="gap:10px">
      <div class="row between"><b>${isNew ? "🎉 Now invite your church" : "Invite your church"}</b><span class="small muted">More members, more points</span></div>
      <div class="row" style="gap:10px"><div class="grow"><div class="tiny muted">Invite code</div><div class="serif gold" style="font-size:26px;font-weight:800;letter-spacing:.18em" id="ccode">${esc(c.code)}</div></div><button class="chip" id="ccopy">Copy link</button></div>
      <button class="btn wa block" id="cwa">Share on WhatsApp</button>
    </div>
    <a class="btn primary block" href="#/play/mixed">▶ Play a round for ${esc(c.name.length > 22 ? c.name.slice(0, 21) + "…" : c.name)}</a>` : `<div class="card small muted">Members join with their church's invite link or code. Ask someone from ${esc(c.name)} to share it with you.</div><a class="btn ghost block" href="#/church">Join with a code</a>`}
    <div class="card">
      <div class="row between" style="margin-bottom:6px"><b>Top members</b><div class="row" style="gap:6px"><button class="chip ${per === "week" ? "on" : ""}" data-per="week">This week</button><button class="chip ${per === "all" ? "on" : ""}" data-per="all">All-time</button></div></div>
      <div id="mb">${board()}</div>
    </div>
    ${d.isOwner ? `<div id="verbox"></div>` : ""}
    ${d.isMember ? `<button class="btn ghost block" id="cleave" style="color:#ff8a80">Leave this team</button>` : ""}
    <p class="small dim center" style="margin:0">Points = round scores members earn after joining. Switching churches never carries points across.</p>
  </div>`;
  $$("[data-per]", el).forEach((b) => (b.onclick = () => { per = b.dataset.per; $$("[data-per]", el).forEach((x) => x.classList.toggle("on", x === b)); $("#mb").innerHTML = board(); bindRm(); sfx.chip(); }));
  const bindRm = () => $$("[data-rm]", el).forEach((b) => (b.onclick = async () => {
    const m = d.members.find((x) => String(x.idx) === b.dataset.rm); if (!m || !confirm(`Remove ${m.name} from ${c.name}?`)) return;
    try { await api("/api/v3/churches/" + c.id + "/remove", { body: { member: m.idx } }); toast("Removed"); churchPage(id, q); } catch (e) { toast("Couldn't remove. Try again."); }
  }));
  bindRm();
  if (d.isOwner) verifyBox(c);
  if (d.isMember) {
    $("#cwa").onclick = () => shareChurch(c);
    $("#ccopy").onclick = async () => { const u = churchLink(c.code); try { await navigator.clipboard.writeText(u); toast("Invite link copied ✓"); } catch (e) { prompt("Copy this link:", u); } };
    $("#cleave").onclick = async () => {
      if (!confirm(c.members <= 1 ? `You're the only member. Leaving closes ${c.name}. Leave?` : `Leave ${c.name}? Your future rounds will stop counting for this church.`)) return;
      try { await api("/api/v3/churches/leave", { body: {} }); syncChurch(null); toast("You left the team"); go("#/church"); } catch (e) { toast("Couldn't leave. Try again."); }
    };
  }
}

async function joinByCode(code) {
  render(`<div id="chj"><div class="boot"><div class="boot-mark">⛪</div><div class="boot-sub">Finding your church…</div></div></div>`);
  await ensureSession();
  let d; try { d = await api("/api/v3/churches/code/" + encodeURIComponent(code)); } catch (e) {
    return render(`<div class="col center" style="padding-top:18vh;gap:12px"><div style="font-size:48px">🕊️</div><h2>Code not found</h2><p class="muted">Check the invite code (${esc(code)}) and try again.</p><a class="btn primary" href="#/church">Try another code</a><a class="btn ghost" href="#/">Home</a></div>`);
  }
  const c = d.church;
  if (d.alreadyMember) return go("#/church/" + c.id);
  const needName = !S.onboarded;
  render(`<div class="col" style="gap:16px;padding-top:4vh">
    <div class="center"><div class="tiny gold">⛪ You're invited to the Church League</div></div>
    <div class="hero center"><div class="rays"></div>
      <div style="font-size:44px;line-height:1">${c.kind === "campus" ? "🎓" : c.kind === "fellowship" ? "🙌" : "⛪"}</div>
      <h2 style="font-family:var(--serif);margin:10px 0 4px">${esc(c.name)}${c.verified ? ` <span class="vtick" title="Verified church">✅</span>` : ""}</h2>
      <div class="small muted">${placeLine(c)}</div>
      <div class="small gold" style="margin-top:8px">${c.members} member${c.members === 1 ? "" : "s"} playing</div>
    </div>
    <div class="card small muted">Every round you play adds points for ${esc(c.name)} on the weekly league. The top church each week is crowned champion 🏆</div>
    ${needName ? `<div class="card gold"><div class="field"><label for="nm">What should we call you?</label><input id="nm" maxlength="40" placeholder="e.g. Sister Grace" value="${esc(S.name)}"></div></div>` : ""}
    ${d.current ? `<div class="card small">You're in <b>${esc(d.current.name)}</b> now. Joining moves you to ${esc(c.name)}.</div>` : ""}
    <button class="btn primary block" id="jgo">Join ${esc(c.name.length > 26 ? c.name.slice(0, 25) + "…" : c.name)}</button>
    <a class="btn ghost block" href="#/">Not now</a>
  </div>`);
  $("#jgo").onclick = async () => {
    if (needName) { const n = $("#nm").value.trim().slice(0, 40); if (!n) { $("#nm").focus(); return toast("Tell us your name first"); } if (badNm(n)) { $("#nm").focus(); return toast(KIND_NAME); } S.name = n; S.onboarded = true; save(); await savePlayer(); }
    if (!ME.player) await savePlayer(); // so the church page shows their name
    $("#jgo").disabled = true; $("#jgo").textContent = "Joining…";
    try { const r = await api("/api/v3/churches/join", { body: { code } }); syncChurch(r.church); sfx.win(); confetti(60); toast(`Welcome to ${r.church.name} ⛪`); go("#/church/" + r.church.id); }
    catch (e) { $("#jgo").disabled = false; $("#jgo").textContent = "Join"; toast((e.data && e.data.message) || "Couldn't join. Try again."); }
  };
}

async function leagueBoard(el, per) {
  let r; try { r = await api("/api/v3/league?period=" + per); } catch (e) { el.innerHTML = "Couldn't load the league."; return; }
  const champ = r.champion;
  const mine = r.mine;
  el.innerHTML = `
    <div class="row" style="gap:6px;margin-bottom:10px"><button class="chip ${per === "week" ? "on" : ""}" data-lp="week">This week</button><button class="chip ${per === "all" ? "on" : ""}" data-lp="all">All-time</button><span class="grow"></span>${per === "week" ? `<span class="small dim">Resets in ${untilReset(r.resetsAt)}</span>` : ""}</div>
    ${champ && per === "week" ? `<a class="badge" href="#/church/${esc(champ.id)}" style="text-decoration:none;color:inherit;margin-bottom:10px"><div class="bi">🏆</div><div><b>Last week's champion</b><div class="small muted">${esc(champ.name)} · ${fmt(champ.points)} pts</div></div></a>` : ""}
    ${mine && mine.pos > 5 ? `<a class="lb me" href="#/church/${esc(mine.id)}" style="text-decoration:none;color:inherit;margin-bottom:6px"><div class="pos">${mine.pos}</div><div class="grow"><b>⛪ ${esc(mine.name)}</b> <span class="small gold">your church</span><div class="small muted">${mine.members} member${mine.members === 1 ? "" : "s"}</div></div><div class="gold serif" style="font-weight:800">${fmt(mine.points)}</div></a>`
      : mine ? "" : `<a class="card gold row" href="#/church" style="text-decoration:none;color:inherit;gap:12px;margin-bottom:10px"><div style="font-size:26px">⛪</div><div class="grow"><b>Play for your church</b><div class="small muted">Join with an invite code or create your church's team</div></div><div class="gold">›</div></a>`}
    ${r.churches.length ? r.churches.map((c) => `<a class="lb ${c.isMine ? "me" : ""}" href="#/church/${esc(c.id)}" style="text-decoration:none;color:inherit"><div class="pos p${c.pos}">${medal(c.pos)}</div><div class="grow"><b>${esc(c.name)}</b>${c.verified ? ` <span class="vtick" title="Verified church">✅</span>` : ""}${c.titles ? ` <span class="small gold">🏆${c.titles > 1 ? "×" + c.titles : ""}</span>` : ""}<div class="small muted">${esc(c.city)}, ${esc(c.state)} · ${c.members} member${c.members === 1 ? "" : "s"}</div></div><div class="gold serif" style="font-weight:800">${fmt(c.points)}</div></a>`).join("")
      : `<div class="muted">No church teams yet. Create the first one!</div>`}`;
  $$("[data-lp]", el).forEach((b) => (b.onclick = () => { sfx.chip(); history.replaceState(null, "", "#/ranks?tab=church&p=" + b.dataset.lp); leagueBoard(el, b.dataset.lp); }));
}

async function homeChurchCard() {
  const box = $("#homechurch"); if (!box) return;
  let m = null; try { m = await api("/api/v3/churches/mine"); } catch (e) { return; }
  const b2 = $("#homechurch"); if (!b2) return;
  if (m && m.church) {
    const c = m.church; syncChurch(c);
    b2.innerHTML = `<a class="card row slim" href="#/church/${esc(c.id)}" style="text-decoration:none;color:inherit"><div style="font-size:22px">⛪</div><div class="grow"><b>${esc(c.name)}${c.verified ? " ✅" : ""}</b><div class="small muted">${c.champion ? "🏆 Champions · " : ""}Church League · #${c.rank || "–"} this week · ${fmt(c.weekPoints)} pts</div></div><div class="gold" style="font-size:22px">›</div></a>`;
  } else {
    b2.innerHTML = `<a class="card row slim" href="#/church" style="text-decoration:none;color:inherit"><div style="font-size:22px">⛪</div><div class="grow"><b>Church League</b><div class="small muted">Play for your church or group's team</div></div><div class="gold">›</div></a>`;
  }
}
async function resultsChurchLine(score) {
  const box = $("#reschurch"); if (!box) return;
  let m = null; try { m = await api("/api/v3/churches/mine"); } catch (e) { return; }
  const b2 = $("#reschurch"); if (!b2 || !m) return;
  if (m.church) { const c = m.church; b2.innerHTML = `<a class="badge" href="#/church/${esc(c.id)}" style="text-decoration:none;color:inherit"><div class="bi">⛪</div><div class="grow"><b>+${fmt(score)} for ${esc(c.name)}</b><div class="small muted">Your church is #${c.rank || "–"} this week with ${fmt(c.weekPoints)} pts</div></div><div class="gold">›</div></a>`; }
  else b2.innerHTML = ""; // v3.6.0: church is an extra; non-members are not prompted after every round
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

// ---------- Verified churches (v3.5.0): proof-based request by the team lead, reviewed by the Bible Arena owner ----------
async function verifyBox(c) {
  const box = $("#verbox"); if (!box) return;
  let d; try { d = await api("/api/v3/churches/" + encodeURIComponent(c.id) + "/verify"); } catch (e) { return; }
  const b = $("#verbox"); if (!b) return;
  const r = d.request;
  const codeCard = (r) => `<div class="card gold col" style="gap:8px"><div class="row between"><b>🔎 Verification under review</b><span class="chip">Waiting</span></div>
      <div class="tiny muted">Your verification code</div><div class="row" style="gap:10px"><div class="serif gold grow" style="font-size:24px;font-weight:800;letter-spacing:.06em" id="vcode">${esc(r.code)}</div><button class="chip" id="vcopy">Copy</button></div>
      <div class="small">${esc(d.instructions)}</div>
      <div class="small muted">Official page you gave: <a href="${esc(r.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--gold);word-break:break-all">${esc(r.link)}</a></div>
      <div class="small dim">Asked by ${esc(r.requester)} (${esc(r.role)}). A real person checks every request. Nothing is approved automatically.</div></div>`;
  if (d.verified) { b.innerHTML = `<div class="card row" style="gap:12px"><div style="font-size:26px">✅</div><div class="grow"><b>Verified church</b><div class="small muted">The tick shows on your church page, the league and your invite link.</div></div></div>`; return; }
  if (r && r.status === "pending") { b.innerHTML = codeCard(r); $("#vcopy").onclick = async () => { try { await navigator.clipboard.writeText(r.code); toast("Code copied ✓"); } catch (e) { prompt("Copy this code:", r.code); } }; return; }
  const was = r && (r.status === "rejected" || r.status === "revoked") ? `<div class="small" style="color:#ff8a80;margin-top:6px">${r.status === "revoked" ? "Verification was removed" : "Last request was not approved"}${r.reason ? `: ${esc(r.reason)}` : ""}</div>` : "";
  b.innerHTML = `<div class="card col" style="gap:8px"><div class="row" style="gap:12px"><div style="font-size:26px">✅</div><div class="grow"><b>Get the Verified tick</b><div class="small muted">Show members this is your church's official team. We check it against your church's official page.</div>${was}</div></div><button class="btn ghost block" id="vask">Request verification</button></div>`;
  $("#vask").onclick = () => verifyForm(c, d);
}
function verifyForm(c, d) {
  const b = $("#verbox"); if (!b) return;
  b.innerHTML = `<div class="card gold col" style="gap:10px"><b>Request verification for ${esc(c.name)}</b>
    <div class="small muted">Only the team lead can ask. After you send this you'll get a code to post on the church's official page (or email from the official church address).</div>
    <div class="field"><label for="vrq">Your full name</label><input id="vrq" maxlength="60" placeholder="e.g. Ade Johnson" value="${esc(S.name || "")}"></div>
    <div class="field"><label for="vrl">Your role in the church</label><select id="vrl">${d.roles.map((x) => `<option>${esc(x)}</option>`).join("")}<option value="">Other…</option></select><input id="vrl2" maxlength="40" placeholder="Your role" style="display:none;margin-top:6px"></div>
    <div class="field"><label for="vlk">Church's official page <span class="gold">(required)</span></label><input id="vlk" inputmode="url" maxlength="200" placeholder="https://facebook.com/yourchurch or your website"></div>
    <div class="field"><label for="vem">Official church email <span class="dim">(optional)</span></label><input id="vem" type="email" maxlength="120" placeholder="info@yourchurch.org"></div>
    <div class="field"><label for="vph">Church's public phone <span class="dim">(optional)</span></label><input id="vph" inputmode="tel" maxlength="20" placeholder="+234…"></div>
    <div class="small" id="verr" style="color:#ff8a80"></div>
    <div class="row" style="gap:8px"><button class="btn ghost grow" id="vcancel">Cancel</button><button class="btn primary grow" id="vsend">Send request</button></div></div>`;
  $("#vrl").onchange = () => { $("#vrl2").style.display = $("#vrl").value ? "none" : "block"; };
  $("#vcancel").onclick = () => verifyBox(c);
  $("#vsend").onclick = async () => {
    const btn = $("#vsend"); btn.disabled = true; $("#verr").textContent = "";
    const body = { requester: $("#vrq").value, role: $("#vrl").value || $("#vrl2").value, link: $("#vlk").value, email: $("#vem").value, phone: $("#vph").value };
    try { await api("/api/v3/churches/" + encodeURIComponent(c.id) + "/verify", { body }); sfx.ok(); toast("Request sent ✓"); verifyBox(c); }
    catch (e) { btn.disabled = false; $("#verr").textContent = (e.data && e.data.message) || "Couldn't send. Check your connection and try again."; }
  };
}

// ---------- Live Multiplayer Social (v3.5.0): online now, Live now, Quick Match, Arena Bot ----------
function onlineText() { const n = window.BAS && BAS.st.online; return n == null ? "online now" : `${fmt(n)} online now`; }
function modeName(m) { return MODES[m] ? MODES[m].name : "Mixed Arena"; }
function ago(s) { s = Math.max(0, s | 0); return s < 60 ? s + "s" : Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
function koStatus(x) {
  if (x.phase === "lobby") return x.startsIn != null ? `Starting in ${ago(Math.ceil(x.startsIn / 1000))} · join now` : "In the lobby · join now";
  if (x.phase === "final") return "Winner crowned · join the next game";
  return `${x.final ? "🏆 Final" : "Round " + x.round} · ${x.left} still in · watch & join next game`;
}
function liveItem(x) {
  if (x.t === "ko") return `<div class="lnrow ${x.phase === "lobby" ? "hot" : ""}"><div class="avatar">⚔️</div><div class="grow"><div class="tiny" style="color:#3DDC97">● ${x.phase === "lobby" ? "Knockout lobby" : "Knockout playing"}</div><b>${esc(x.host)}'s knockout · ${x.here} player${x.here === 1 ? "" : "s"}</b><div class="small muted">${esc(koStatus(x))}</div></div><button class="btn ${x.phase === "lobby" ? "primary" : "ghost"} sm" data-ko="${esc(x.code)}">${x.phase === "lobby" ? "Join" : "Watch"}</button></div>`;
  if (x.t === "wait") {
    const tag = x.kind === "champ" ? "🏆 Winner stays on" : x.kind === "challenge" ? (x.forMe ? "⚔️ Challenged you" : "⚔️ Challenge") : "⚡ Open challenge";
    return `<div class="lnrow ${x.forMe ? "hot" : ""}"><div class="avatar">${esc((x.name || "?")[0].toUpperCase())}</div><div class="grow"><div class="tiny" style="color:#3DDC97">${tag}</div><b>${esc(x.mine ? "You're waiting for a challenger" : x.text)}</b><div class="small muted">${TIER[x.tier] ? TIER[x.tier].name : ""} · ${esc(modeName(x.mode))} · waiting ${ago(x.age)}</div></div>${x.mine ? `<a class="chip on" href="#/qm">Open</a>` : `<button class="btn primary sm" data-join="${esc(x.id)}">Join</button>`}</div>`;
  }
  if (x.t === "duel") return `<div class="lnrow"><div class="avatar">⚔️</div><div class="grow"><div class="tiny gold">● Playing now</div><b>${esc(x.names.join(" vs "))}</b><div class="small muted">${TIER[x.tier] ? TIER[x.tier].name : ""} · ${esc(modeName(x.mode))} · play the same questions</div></div><a class="btn ghost sm" href="#/d/${esc(x.code)}">Join</a></div>`;
  if (x.t === "room") return `<div class="lnrow"><div class="avatar">📺</div><div class="grow"><div class="tiny" style="color:#FF8A9A">● Live room</div><b>${esc(x.title)}</b><div class="small muted">${x.church ? esc(x.church) + " · " : ""}${x.phase === "lobby" ? "In the lobby" : `Question ${x.qi + 1}/${x.qn}`} · ${x.n} player${x.n === 1 ? "" : "s"}</div></div><a class="btn ghost sm" href="/j/${esc(x.code)}">Join</a></div>`;
  return "";
}
function bindJoins(el) {
  $$("[data-join]", el).forEach((b) => (b.onclick = () => { sfx.tap(); go("#/qm?join=" + b.dataset.join); }));
  $$("[data-ko]", el).forEach((b) => (b.onclick = () => { sfx.tap(); buzz(10); b.disabled = true; joinKo(b.dataset.ko); }));
}
function liveCardHTML() {
  const st = (window.BAS && BAS.st) || {};
  const list = (st.live || []).filter((x) => !x.mine);
  return `<div class="card livenow way">
    <div class="row between"><div class="row" style="gap:12px"><div class="wayico">🌍</div><b class="wayt">Play online</b></div><a class="onlinepill" href="#/online"><i class="dot"></i><span data-online>${onlineText()}</span></a></div>
    <div class="small muted" style="margin-top:6px">Play a live group game with people online now. Lose a round and you watch; last one standing wins.</div>
    <button class="btn primary block" id="kojoin" style="margin-top:12px">🎮 Join a live game</button>
    ${list.length ? `<div class="col" style="gap:8px;margin-top:10px">${list.slice(0, 3).map(liveItem).join("")}</div>` : ""}
    <div class="row" style="gap:8px;margin-top:10px"><button class="btn ghost grow sm" id="qmgo">⚡ 1v1 Quick Match</button><a class="btn ghost grow sm" href="#/live">Live now${st.liveCount ? ` <span class="lnbadge">${st.liveCount}</span>` : ""}</a></div>
  </div>`;
}
function bindLiveCard() {
  const draw = () => { const box = $("#homelive"); if (!box) return; box.innerHTML = liveCardHTML(); const q = $("#qmgo"); if (q) q.onclick = () => { sfx.tap(); buzz(10); go("#/qm"); }; const kj = $("#kojoin"); if (kj) kj.onclick = () => { sfx.tap(); buzz(12); go("#/ko/quick"); }; bindJoins(box); $$("[data-online]").forEach((e) => (e.textContent = onlineText())); };
  draw();
  if (window.BAS) { const off = BAS.on(draw); onLeave(off); }
}
async function pushCardHTML(where) {
  if (!window.BAS) return "";
  let s = "off"; try { s = await BAS.push.state(); } catch (e) {}
  if (s === "on" || s === "unsupported" || s === "unavailable" || s === "denied") return "";
  if (s === "ios-install") return `<div class="card small"><b>🔔 Get notified on iPhone</b><div class="muted" style="margin-top:4px">Tap Share ⬆️ then “Add to Home Screen”, open Bible Arena from there, and turn on notifications to hear when someone is waiting for a challenger.</div></div>`;
  return `<div class="card row" style="gap:12px"><div style="font-size:26px">🔔</div><div class="grow"><b>Get a notification</b><div class="small muted">${where === "qm" ? "when someone is waiting, even when the app is closed." : "when people are looking for players. Max 3 a day, never 10 pm to 7 am."}</div></div><button class="chip on" data-push>Turn on</button></div>`;
}
/** v3.7.0: after a player's first finished game, one card: "Get notified when people are looking for players?" (asked once). */
async function pushAsk(sel) {
  const box = $(sel); if (!box || !window.BAS) return;
  try { if (localStorage.getItem("ba3:pushask")) return; } catch (e) { return; }
  let s = "off"; try { s = await BAS.push.state(); } catch (e) {}
  if ((s !== "off" && s !== "ios-install") || !$(sel)) return;
  try { localStorage.setItem("ba3:pushask", String(Date.now())); } catch (e) {}
  box.innerHTML = s === "ios-install" ? `<div class="card small"><b>🔔 Get notified when people are looking for players</b><div class="muted" style="margin-top:4px">On iPhone: tap Share ⬆️ then “Add to Home Screen”, open Bible Arena from there and turn on notifications in Me → Settings.</div></div>`
    : `<div class="card gold row" style="gap:12px"><div style="font-size:26px">🔔</div><div class="grow"><b>Get notified when people are looking for players?</b><div class="small muted">One tap. Max 3 a day, never 10 pm to 7 am.</div></div><button class="chip on" data-push>Yes</button></div>`;
  bindPush(box, () => { box.innerHTML = ""; });
}
function bindPush(el, redraw) {
  $$("[data-push]", el).forEach((b) => (b.onclick = async () => {
    b.disabled = true; b.textContent = "…";
    let r = "off"; try { r = await BAS.push.enable(); } catch (e) {}
    toast(r === "on" ? "Notifications on ✓" : r === "denied" ? "Notifications are blocked in your browser settings." : r === "ios-install" ? "On iPhone, add Bible Arena to your Home Screen first." : "Couldn't turn on notifications here.");
    if (redraw) redraw();
  }));
}
async function liveNow() {
  render(`<div class="row between" style="margin-bottom:12px"><h2>Live now</h2><a class="onlinepill big" href="#/online"><i class="dot"></i><span data-online>${onlineText()}</span></a></div>
    <div class="col" style="gap:12px">
      <div class="hero center"><div class="rays"></div><div style="font-size:40px">🎮</div><h2 style="font-family:var(--serif);margin:6px 0">Join a live game</h2><p class="small muted" style="margin:0 0 12px">Play a group knockout with people online now. It starts by itself when 3 are in. Lose a round and you watch; last one standing wins.</p><button class="btn primary block" id="kojoin">🎮 Join a live game</button><button class="btn ghost block sm" id="qmgo" style="margin-top:8px">⚡ 1v1 Quick Match</button></div>
      <div id="pushbox"></div>
      <div class="sechead"><b>🟢 Games you can join</b><span class="small muted">Group knockouts, open challenges, duels and public quiz nights. Tap to jump in.</span></div>
      <div id="lnl" class="col" style="gap:8px"><div class="muted small">Loading…</div></div>
      <a class="card row" href="/live" style="text-decoration:none;color:inherit;gap:12px"><div style="font-size:26px">📺</div><div class="grow"><b>Host a public quiz night</b><div class="small muted">Turn on “List in Live now” and anyone can join, up to 200.</div></div><div class="gold">›</div></a>
    </div>${tabbar("duels")}`);
  $("#qmgo").onclick = () => { sfx.tap(); buzz(10); go("#/qm"); };
  $("#kojoin").onclick = () => { sfx.tap(); buzz(12); go("#/ko/quick"); };
  await ensureSession();
  const drawPush = async () => { const pb = $("#pushbox"); if (!pb) return; pb.innerHTML = await pushCardHTML("live"); bindPush(pb, drawPush); };
  drawPush();
  const draw = (live) => {
    const el = $("#lnl"); if (!el) return;
    $$("[data-online]").forEach((e) => (e.textContent = onlineText()));
    el.innerHTML = live && live.length ? live.map(liveItem).join("") : `<div class="card center small muted">No live games right now.<br>Tap “Join a live game” and you'll open one: everyone online gets a pop-up to come and play.</div>`;
    bindJoins(el);
  };
  const tick = async () => { try { const r = await api("/api/v3/social/live"); if (window.BAS) BAS.st.online = r.online; draw(r.live); } catch (e) { if ($("#lnl") && $("#lnl").textContent === "Loading…") draw([]); } };
  tick(); const t = setInterval(() => { if (!document.hidden) tick(); }, 5000); onLeave(() => clearInterval(t));
}
// v3.7.0: tap on "🟢 N online" → who's online and which games are live
async function onlineNow() {
  render(`<div class="row between" style="margin-bottom:12px"><h2>Online now</h2><span class="onlinepill big"><i class="dot"></i><span data-online>${onlineText()}</span></span></div>
    <div class="col" style="gap:12px">
      <button class="btn primary block" id="kojoin">🎮 Join a live game</button>
      <div class="sechead"><b>🎮 Live games</b><span class="small muted">Tap to join. If a game is already playing, you watch and play the next one.</span></div>
      <div id="olg" class="col" style="gap:8px"><div class="muted small">Loading…</div></div>
      <div class="sechead"><b>🟢 Who's online</b><span class="small muted" id="olc"></span></div>
      <div id="olp" class="card"><div class="muted small">Loading…</div></div>
      <a class="btn ghost block sm" href="#/qm">⚡ 1v1 Quick Match</a>
    </div>${tabbar("duels")}`);
  $("#kojoin").onclick = () => { sfx.tap(); buzz(12); go("#/ko/quick"); };
  await ensureSession();
  const draw = (r) => {
    const g = $("#olg"), p = $("#olp"); if (!g || !p) return;
    if (window.BAS && r.online != null) BAS.st.online = r.online;
    $$("[data-online]").forEach((e) => (e.textContent = onlineText()));
    const live = (r.live || []).filter((x) => !x.mine);
    g.innerHTML = live.length ? live.map(liveItem).join("") : `<div class="card center small muted">No live games right now. Tap “Join a live game” to open one: everyone online gets a pop-up.</div>`;
    bindJoins(g);
    const ppl = r.people || [];
    $("#olc").textContent = `${fmt(r.online || 0)} online${ppl.filter((x) => x.busy).length ? ` · ${ppl.filter((x) => x.busy).length} playing` : ""}`;
    p.innerHTML = ppl.length || r.more ? `<div class="olppl">${ppl.map((x) => `<span class="olp ${x.busy ? "busy" : ""}"><i></i>${esc(x.name)}${x.me ? " (you)" : ""}${x.busy ? ` <em>playing</em>` : ""}</span>`).join("")}${r.more ? `<span class="olp more">+${fmt(r.more)} more</span>` : ""}</div>` : `<div class="small muted">Just you right now.</div>`;
  };
  const tick = async () => { try { draw(await api("/api/v3/social/live?people=1&pid=" + encodeURIComponent(window.BAS ? BAS.pid : ""))); } catch (e) { if ($("#olg") && $("#olg").textContent === "Loading…") draw({ live: [], people: [] }); } };
  tick(); const t = setInterval(() => { if (!document.hidden) tick(); }, 5000); onLeave(() => clearInterval(t));
}
function startMatch(r, creator) {
  sfx.win(); buzz([30, 60, 30]); toast(`Matched with ${r.opp}! ⚔️`);
  return loadBank().then(() => runRound({ ids: r.ids, tier: r.tier, mode: "duel", title: "Quick Match vs " + r.opp, duel: { code: r.code, creator: !!creator, mode: r.mode, quick: true, opp: r.opp } }));
}
async function playBot(mode, tier) {
  render(`<div class="boot"><div class="boot-mark">🤖</div><div class="boot-sub">The Arena Bot is warming up…</div></div>`);
  try {
    const [r] = await Promise.all([api("/api/v3/social/bot", { body: { mode, tier, name: S.name } }), loadBank()]);
    toast(`Beat the Arena Bot's ${fmt(r.bot.score)}! 🤖`);
    runRound({ ids: r.ids, tier: r.tier, mode: "duel", title: "vs Arena Bot 🤖", duel: { code: r.code, creator: true, mode: r.mode, bot: true } });
  } catch (e) { toast("Couldn't start the bot. Try again."); go("#/live"); }
}
async function quickMatch(q) {
  const mode = MODES[q.get("mode")] && q.get("mode") !== "sudden" ? q.get("mode") : "mixed";
  const tier = TIER[q.get("tier")] ? q.get("tier") : S.tier;
  const seq = ROUND_SEQ;
  const alive = () => seq === ROUND_SEQ;
  render(`<div class="boot"><div class="boot-mark">⚔️</div><div class="boot-sub">Finding a challenger…</div></div>`);
  await ensureSession();
  if (!alive()) return;
  const join = q.get("join");
  const taken = (msg) => render(`<div class="col center" style="padding-top:16vh;gap:12px"><div style="font-size:48px">🕊️</div><h2>${msg}</h2><p class="muted">Someone got there first. Start your own and people online will get a pop-up.</p><button class="btn primary" id="qmgo">⚡ Quick Match</button><a class="btn ghost" href="#/live">See Live now</a></div>${tabbar("duels")}`) || ($("#qmgo").onclick = () => go("#/qm"));
  let r;
  try {
    if (join) r = await api("/api/v3/social/match/" + encodeURIComponent(join) + "/join", { body: { name: S.name } });
    else {
      const body = { tier, mode, name: S.name, church: S.church, pid: window.BAS ? BAS.pid : "" };
      if (q.get("duel")) body.duel = q.get("duel");
      if (q.get("room")) { body.room = q.get("room"); body.lt = q.get("lt") || ""; }
      r = await api("/api/v3/social/match", { body });
    }
  } catch (e) {
    if (!alive()) return;
    if (e.status === 410) return taken("That challenge was just taken");
    if (e.status === 400 && e.message === "own_challenge") return go("#/qm");
    if (e.status === 409) return taken("No winner to challenge yet");
    toast("Couldn't reach the arena. Check your connection."); return go("#/live");
  }
  if (!alive()) return;
  if (r.status === "matched") return startMatch(r, r.role === "creator");
  // waiting: poll every 2.5 s; after 60 s offer the bot or solo
  const id = r.id; const t0 = Date.now(); let done = false, fallback = false;
  const cancel = () => { if (done) return; done = true; fetch("/api/v3/social/match/" + id + "/cancel", { method: "POST", credentials: "same-origin", keepalive: true, headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {}); };
  render(`<div class="row" style="margin-bottom:12px"><a class="iconbtn" href="#/live" aria-label="Back">‹</a><div class="grow tiny gold">⚡ Quick Match · ${TIER[tier].name} · ${esc(modeName(mode))}</div></div>
    <div class="col" style="gap:14px">
      <div class="hero center"><div class="rays"></div>
        <div class="radar"><i></i><i></i><i></i><div class="rc">⚔️</div></div>
        <h2 style="font-family:var(--serif);margin:10px 0 4px" id="qmh">Looking for a challenger…</h2>
        <div class="small muted" id="qms">${q.get("duel") || q.get("room") ? esc((r.text || "").replace(S.name || "\u0000", "You")) : "You'll start the moment someone joins: same questions, live scores."}</div>
        <div class="row" style="justify-content:center;gap:10px;margin-top:10px"><span class="onlinepill"><i class="dot"></i><span data-online>${onlineText()}</span></span><span class="chip" id="qmt">0:00</span></div>
        <p class="small dim" style="margin:10px 0 0">Everyone online gets a pop-up, and you're listed in Live now.</p>
      </div>
      <div id="qmfb"></div>
      <div id="pushbox"></div>
      <button class="btn ghost block" id="qmx">Cancel</button>
    </div>${tabbar("duels")}`);
  onLeave(cancel);
  $("#qmx").onclick = () => { cancel(); go("#/live"); };
  const drawPush = async () => { const pb = $("#pushbox"); if (!pb) return; pb.innerHTML = await pushCardHTML("qm"); bindPush(pb, drawPush); };
  drawPush();
  const showFallback = () => {
    fallback = true; const fb = $("#qmfb"); if (!fb) return;
    fb.innerHTML = `<div class="card gold col" style="gap:10px"><b>No challenger yet</b><div class="small muted">You're still listed in Live now. Keep waiting, or play now:</div>
      <button class="btn primary block" id="qmbot">🤖 Play the Arena Bot</button><div class="row" style="gap:8px"><button class="btn ghost grow" id="qmsolo">Play solo</button><button class="btn ghost grow" id="qmwait">Keep waiting</button></div></div>`;
    $("#qmbot").onclick = () => { cancel(); playBot(mode, tier); };
    $("#qmsolo").onclick = () => { cancel(); go("#/play/" + mode); };
    $("#qmwait").onclick = () => { fb.innerHTML = ""; };
    sfx.chip();
  };
  const tick = setInterval(() => { const el = $("#qmt"); if (!el) return clearInterval(tick); const s = Math.floor((Date.now() - t0) / 1000); el.textContent = ago(s); if (s >= 60 && !fallback) showFallback(); }, 500);
  onLeave(() => clearInterval(tick));
  const poll = async () => {
    if (done || !alive()) return;
    try {
      const s = await api("/api/v3/social/match/" + id);
      if (!alive() || done) return;
      if (s.online != null && window.BAS) { BAS.st.online = s.online; $$("[data-online]").forEach((e) => (e.textContent = onlineText())); }
      if (s.status === "matched") { done = true; return startMatch(s, true); }
      if (s.status === "gone") { done = true; toast("Your challenge timed out."); return go("#/live"); }
    } catch (e) {}
    setTimeout(poll, 2500);
  };
  setTimeout(poll, 1500);
}

// ---------- duels ----------
// Who won a duel: higher score; equal scores -> faster total time, in tenths of a second (what the
// screen shows); equal score and time -> a draw. Same rule as server/v3/duel-outcome.ts.
function duelCmp(a, b) { const sa = Number(a.score) || 0, sb = Number(b.score) || 0; if (sa !== sb) return sa > sb ? 1 : -1; const ta = Math.round(Math.max(0, Number(a.timeMs) || 0) / 100), tb = Math.round(Math.max(0, Number(b.timeMs) || 0) / 100); return ta === tb ? 0 : ta < tb ? 1 : -1; }
const secs = (ms) => (Math.round(Math.max(0, Number(ms) || 0) / 100) / 10).toFixed(1) + "s";
function duelText(code, score, tier, mode) {
  const url = origin() + "/d/" + code;
  return score != null
    ? `⚔️ ${S.name || "I"} scored ${fmt(score)} on Bible Arena (${TIER[tier].name} · ${MODES[mode] ? MODES[mode].name : "Arena"}).\nSame questions. Can you beat me? 📖\nTap: ${url}\nOr enter code ${code} in Bible Arena.`
    : `⚔️ ${S.name || "I"} challenge you to a Bible Arena duel (${TIER[tier].name}). Same questions, head to head. 📖\nTap: ${url}\nOr enter code ${code} in Bible Arena.`;
}
async function newDuel() {
  let mode = "mixed", tier = S.tier;
  const draw = () => {
    render(`<div class="row" style="margin-bottom:14px"><a class="iconbtn" href="#/duels">‹</a><h2 class="grow">Send a set to beat</h2></div>
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
    return render(`<div class="col center" style="padding-top:20vh;gap:12px"><div style="font-size:48px">🕊️</div><h2>Code not found</h2><p class="muted">No challenge with the code <b>${esc(code)}</b>. Check it and try again.</p><div style="width:100%;max-width:360px">${codeBoxHTML("nfcode")}</div>${/^[A-Z0-9]{4,8}$/.test(code) ? `<a class="small muted" href="#/c/${esc(code)}">Is it a church team code? Open it here</a>` : ""}<a class="btn primary" href="#/ko/new">⚔️ Start your own challenge</a><a class="btn ghost" href="#/">Home</a></div>`) || bindCodeBox("nfcode");
  }
  const mine = v.entries.find((e) => e.isMe);
  if (mine && mine.finished) return duelResult(v, null, null);
  if (v.creator.isMe && !mine) return duelResult(v, null, null);
  const creator = v.entries.find((e) => e.isCreator && e.finished);
  const needName = !S.onboarded;
  render(`<div class="col" style="gap:16px;padding-top:2vh">
    <div class="center"><div class="tiny gold">Bible Arena · Challenge</div></div>
    <div class="hero center"><div class="rays"></div>
      <div class="avatar" style="width:72px;height:72px;font-size:28px">${esc((v.creator.name || "?")[0].toUpperCase())}</div>
      <h2 style="font-family:var(--serif)">${esc(v.creator.name)}</h2>
      <div class="muted">challenges you to</div>
      <h1 class="title-gold" style="margin:6px 0">${esc(MODES[v.mode] ? MODES[v.mode].name : "Arena")}</h1>
      <div class="row" style="justify-content:center;gap:8px"><span class="pill-tier">${TIER[v.tier].name}</span><span class="pill-tier">${v.ids.length} questions</span></div>
      ${creator ? `<div style="margin-top:14px" class="muted">Score to beat</div><div class="bigscore" style="font-size:44px">${fmt(creator.score)}</div>` : ""}
    </div>
    ${needName ? `<div class="card col"><div class="field"><label for="nm">Your name</label><input id="nm" maxlength="40" placeholder="e.g. Ade" value="${esc(S.name)}"></div><div class="field"><label for="ch">Church or group <span class="dim">(optional)</span></label><input id="ch" maxlength="60" value="${esc(S.church)}"></div></div>` : ""}
    <p class="small muted center" style="margin:0">Same questions, same clock. Points for speed and streaks. Every answer shows its verse.</p>
    <button class="btn primary block" id="acc">Accept the challenge</button>
    ${v.entries.filter((e) => e.finished).length > 1 ? `<div class="card"><b>Already played</b>${board(v)}</div>` : ""}
  </div>`);
  $("#acc").onclick = async () => {
    if (needName && badNm($("#nm").value)) { $("#nm").focus(); return toast(KIND_NAME); }
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
  else if (me && cfg && cfg.duel && cfg.duel.quick) banner = `<h1 class="title-gold">Nice round!</h1><p class="muted" style="margin:4px 0 0">Your score: <b class="gold">${fmt(me.score)}</b>. Waiting for ${esc(cfg.duel.opp || "your opponent")} to finish…</p>`;
  else if (me && v.creator.isMe) banner = `<h1 class="title-gold">Now send it!</h1><p class="muted" style="margin:4px 0 0">Your score: <b class="gold">${fmt(me.score)}</b>. Waiting for someone to take your challenge.</p><div class="card center" style="margin-top:12px"><div class="tiny muted">Challenge code</div><div class="bigcode">${esc(v.code)}</div><div class="small muted">They tap your link, or enter this code in Bible Arena.</div></div>`;
  const botDuel = v.entries.some((e) => e.name === "Arena Bot 🤖");
  const fin = v.entries.filter((e) => e.finished).sort((a, b) => duelCmp(b, a));
  const topWin = fin.length >= 2 && duelCmp(fin[0], fin[1]) !== 0 ? fin[0] : null;
  const chw = !botDuel && topWin ? (topWin.isMe ? `<button class="btn ghost block" id="chw" style="border-color:rgba(245,185,66,.6)">🏆 Winner stays on: take on all comers</button>` : `<button class="btn ghost block" id="chw" style="border-color:rgba(245,185,66,.6)">⚔️ Challenge the winner (${esc(topWin.name)})</button>`) : "";
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
    ${me && opp && !botDuel ? `<button class="btn primary block" id="rm">🔄 Rematch (new questions)</button>` : ""}
    ${botDuel && me && opp ? `<button class="btn primary block" id="qmreal">⚡ Quick Match a real player</button>` : ""}
    ${chw}
    ${v.entries.filter((e) => e.finished).length ? `<div class="card"><b>Everyone on this challenge</b>${board(v)}</div>` : ""}
    <a class="btn ghost block" href="#/">Home</a>
  </div>${tabbar("duels")}`);
  if (cmp === 1 && r) { confetti(90); sfx.win(); }
  $("#rf").onclick = async () => { try { const nv = await api("/api/v3/duels/" + v.code); duelResult(nv, null, cfg); } catch (e) {} };
  $("#cp").onclick = async () => { try { await navigator.clipboard.writeText(url); toast("Link copied ✓"); } catch (e) { prompt("Copy this link:", url); } };
  $("#sh").onclick = () => shareCard({ score: me ? me.score : 0, correct: me ? me.correct : 0, total: n, tier: v.tier, title: "Challenge", url, text: duelText(v.code, me ? me.score : null, v.tier, v.mode), cta: cmp === 1 ? "I won this duel. Your turn?" : cmp === 0 ? "We drew this duel. Can you break the tie?" : "Can you beat me?" });
  const chb = $("#chw"); if (chb) chb.onclick = () => { sfx.tap(); go("#/qm?duel=" + v.code + "&tier=" + v.tier + "&mode=" + v.mode); };
  const qr = $("#qmreal"); if (qr) qr.onclick = () => { sfx.tap(); go("#/qm?tier=" + v.tier + "&mode=" + v.mode); };
  const rm = $("#rm"); if (rm) rm.onclick = async () => {
    rm.disabled = true; rm.textContent = "Preparing the rematch…";
    try { await loadBank(); const d = await api("/api/v3/duels", { body: { mode: v.mode, tier: v.tier, name: S.name, parent: v.code } }); runRound({ ids: d.ids, tier: v.tier, mode: "duel", title: "Rematch · " + (MODES[v.mode] ? MODES[v.mode].name : ""), duel: { code: d.code, creator: true, mode: v.mode } }); }
    catch (e) { toast("Couldn't start the rematch."); rm.disabled = false; }
  };
  if (!me || !opp) { const t = setInterval(async () => { try { const nv = await api("/api/v3/duels/" + v.code); if (nv.entries.filter((e) => e.finished).length !== v.entries.filter((e) => e.finished).length) { clearInterval(t); duelResult(nv, null, cfg); } } catch (e) {} }, cfg && cfg.duel && cfg.duel.quick ? 3000 : 8000); onLeave(() => clearInterval(t)); }
}
async function duelsScreen() {
  render(`<div class="row between" style="margin-bottom:14px"><h2>Challenges</h2><a class="btn primary" href="#/ko/new" style="min-height:42px">⚔️ New</a></div>
    <div class="card col" style="gap:10px;margin-bottom:14px"><div class="small muted">Got a code from someone? Enter it to join.</div>${codeBoxHTML("dcode")}<div class="row" style="gap:8px"><a class="btn ghost grow sm" href="#/live">🌍 Play online</a><a class="btn ghost grow sm" href="#/duel/new">📨 Send a set to beat</a></div></div>
    <div class="sechead"><b>Your sets to beat</b></div><div id="dl" class="col"><div class="muted small">Loading your challenges…</div></div>${tabbar("duels")}`);
  bindCodeBox("dcode");
  await ensureSession();
  let r; try { r = await api("/api/v3/duels/mine"); } catch (e) { if (!$("#dl")) return; $("#dl").innerHTML = `<div class="card">Couldn't load duels. Check your connection.</div>`; return; }
  const el = $("#dl"); if (!el) return;
  if (!r.duels.length) { el.innerHTML = `<div class="hero center"><div class="rays"></div><div style="font-size:42px">⚔️</div><h2 style="font-family:var(--serif)">No challenges yet</h2><p class="muted small">Challenge a friend: create a challenge, send the link, play live. Last one standing wins.</p><a class="btn primary block" href="#/ko/new">⚔️ Challenge someone</a></div>`; return; }
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
  const tabs = [["week", "This week"], ["church", "⛪ Churches"], ["rivals", "Rivals"], ["daily", "Today"], ["all", "All-time"]];
  render(`<h2 style="margin-bottom:12px">Leaderboards</h2><div class="segs">${tabs.map(([k, l]) => `<a class="chip ${tab === k ? "on" : ""}" href="#/ranks?tab=${k}">${l}</a>`).join("")}</div>${tab === "daily" ? `<p class="small muted" style="margin:0 0 10px">🌍 Global Scoreboard for today's Daily Challenge: one official try each.</p>` : ""}<div id="lb" class="card"><div class="muted small">Loading…</div></div>${tabbar("ranks")}`);
  await ensureSession();
  if (tab === "church") { const l = $("#lb"); if (l) leagueBoard(l, parseHash().q.get("p") === "all" ? "all" : "week"); return; }
  let r; try { r = await api("/api/v3/leaderboard?scope=" + tab); } catch (e) { const l = $("#lb"); if (l) l.innerHTML = "Couldn't load the board."; return; }
  const el = $("#lb"); if (!el) return;
  if (tab === "church") {
    el.innerHTML = `<div class="small muted" style="margin-bottom:8px">Churches and groups ranked by their players' total XP. ${S.church ? `You play for <b class="gold">${esc(S.church)}</b>.` : `<a href="#/me">Add your church</a> to join.`}</div>` + (r.churches.length ? r.churches.map((c, i) => `<div class="lb"><div class="pos p${i + 1}">${i + 1}</div><div class="grow"><b>⛪ ${esc(c.church)}</b><div class="small muted">${c.players} player${c.players > 1 ? "s" : ""}</div></div><div class="gold serif" style="font-weight:800">${fmt(c.score)}</div></div>`).join("") : `<div class="muted">No churches yet. Be the first!</div>`);
    return;
  }
  const rows = r.rows || [];
  const empty = { week: "No rounds this week yet. Play one and top the board!", daily: "Nobody has played today's challenge yet.", rivals: "Your rivals appear here after your first duel.", all: "No players yet." }[tab];
  el.innerHTML = rows.length ? rows.map((x, i) => `<div class="lb ${x.isMe ? "me" : ""}"><div class="pos p${i + 1}">${i + 1}</div><div class="grow"><b>${esc(x.name)}</b>${x.isMe ? ` <span class="small gold">you</span>` : ""}<div class="small muted">${esc(x.rank)}${x.church ? " · " + esc(x.church) : ""}${tab === "rivals" ? ` · You ${x.wins}–${x.losses}${x.draws ? ` · ${x.draws} draw${x.draws > 1 ? "s" : ""}` : ""}` : ""}</div></div><div class="gold serif" style="font-weight:800">${fmt(x.score)}</div></div>`).join("") : `<div class="muted">${empty}</div>${tab === "rivals" ? `<a class="btn primary block" style="margin-top:12px" href="#/ko/new">⚔️ Challenge someone</a>` : ""}`;
}

// ---------- profile & settings ----------
// v3.9: players blocked from voice games on this phone (kept in localStorage "bal:blocked" by voice.js, also on the server)
function blockedList() { try { const o = JSON.parse(localStorage.getItem("bal:blocked") || "{}"); return Object.keys(o).map((k) => ({ k, n: (o[k] && o[k].n) || "Player" })); } catch (e) { return []; } }
function blockedSheet() {
  const draw = () => {
    const L = blockedList();
    const box = document.getElementById("blksheet") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "blksheet" }));
    box.style.cssText = "position:fixed;inset:0;z-index:69;background:rgba(3,6,16,.62)";
    box.innerHTML = `<div class="card col" style="position:fixed;left:12px;right:12px;bottom:12px;max-width:480px;margin:auto;z-index:70;gap:8px;max-height:80vh;overflow:auto"><b>Blocked players</b>
      ${L.length ? L.map((x) => `<div class="setrow"><div class="grow">${esc(x.n)}</div><button class="chip" data-ub="${esc(x.k)}">Unblock</button></div>`).join("") : `<div class="small muted">No one is blocked.</div>`}
      <button class="btn ghost" id="blkx">Done</button></div>`;
    box.onclick = async (e) => {
      if (e.target.id === "blkx" || e.target === box) { box.remove(); return profile(); }
      const k = e.target.dataset && e.target.dataset.ub; if (!k) return;
      try { const o = JSON.parse(localStorage.getItem("bal:blocked") || "{}"); delete o[k]; localStorage.setItem("bal:blocked", JSON.stringify(o)); } catch (x) {}
      api("/lv/block", { body: { k, on: false } }).catch(() => {});
      toast("Unblocked"); draw();
    };
  };
  draw();
}
async function profile() {
  render(`<div id="pf"></div>${tabbar("me")}`);
  await ensureSession();
  try { const m = await api("/api/v3/churches/mine"); syncChurch(m.church); } catch (e) {}
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
      <div class="setrow"><div class="grow"><div>Church team</div><div class="small muted">${esc(S.teamName || "Not in a church team yet")}</div></div><a class="chip ${S.teamName ? "" : "on"}" href="#/church">${S.teamName ? "Open" : "Join"}</a></div>
      <div class="setrow"><div class="grow"><div>Level</div><div class="small muted">${TIER[S.tier].name}</div></div><button class="chip" id="etier">Change</button></div>
      <div class="setrow"><div>Sound</div><button class="switch ${S.sound ? "on" : ""}" id="snd" aria-label="Sound"></button></div>
      <div class="setrow"><div>Vibration</div><button class="switch ${S.haptics ? "on" : ""}" id="hap" aria-label="Vibration"></button></div>
      <div class="setrow"><div class="grow"><div>Game pop-ups</div><div class="small muted">“A live game is starting” or “someone is waiting for a challenger” while you're in the app (max 1 every 2 min)</div></div><button class="switch ${window.BAS && !BAS.muted() ? "on" : ""}" id="pops" aria-label="Challenge pop-ups"></button></div>
      <div class="setrow" id="pushrow"><div class="grow"><div>Phone notifications</div><div class="small muted" id="pushtxt">Checking…</div></div><span id="pushbtn"></span></div>
      <div class="setrow"><div class="grow"><div>Account</div><div class="small muted">${google ? "Signed in with Google ✓ (progress is safe across phones)" : "Guest on this phone. Sign in to keep your progress on any phone."}</div></div>${google ? `<button class="chip" id="out">Sign out</button>` : `<a class="chip on" href="/api/oauth/google/start">Google</a>`}</div>
      <div class="setrow"><div class="grow"><div>Blocked players</div><div class="small muted" id="blktxt">${blockedList().length ? blockedList().length + " blocked. You won't hear each other in voice." : "No one. Tap a player in a game to mute, block or report."}</div></div>${blockedList().length ? `<button class="chip" id="blk">Manage</button>` : ""}</div>
      <div class="setrow"><div class="grow"><div>Privacy policy</div><div class="small muted">What we keep and why</div></div><a class="chip" href="/privacy">Read</a></div>
      <div class="setrow"><div class="grow"><div>Delete account</div><div class="small muted">Permanently erase your profile, scores and duels</div></div><button class="chip" id="delacct" style="color:#ff8a80">Delete</button></div>
    </div>
    <div class="card"><b>More</b><div class="row" style="flex-wrap:wrap;gap:8px;margin-top:10px"><a class="chip" href="/play">🏛️ Classic app</a>${inAppShell() ? "" : `<a class="chip" href="/download">📱 Android app</a>`}<a class="chip" href="#/ranks?tab=church">⛪ Church League</a></div>
      <p class="small dim" style="margin:12px 0 0">Scripture quotations are from the King James Version (public domain). Every answer carries its reference so you can read it yourself.</p></div>
  </div>`;
  const ed = async (key, label, max) => { const v = prompt(label, S[key] || ""); if (v == null) return; if (key === "name" && badNm(v)) return toast(KIND_NAME); S[key] = v.trim().slice(0, max); save(); await savePlayer(); profile(); };
  $("#ename").onclick = () => ed("name", "Your name", 40);
  const blk = $("#blk"); if (blk) blk.onclick = () => blockedSheet();
  $("#etier").onclick = () => tierSheet(() => profile());
  $("#snd").onclick = (e) => { S.sound = !S.sound; save(); e.target.classList.toggle("on", S.sound); sfx.ok(); };
  $("#hap").onclick = (e) => { S.haptics = !S.haptics; save(); e.target.classList.toggle("on", S.haptics); buzz(30); };
  $("#pops").onclick = (e) => { if (!window.BAS) return; const on = BAS.muted(); BAS.mute(!on); e.target.classList.toggle("on", on); toast(on ? "Challenge pop-ups on" : "Challenge pop-ups muted"); };
  const drawPushRow = async () => {
    const tx = $("#pushtxt"), bt = $("#pushbtn"); if (!tx || !window.BAS) return;
    const s = await BAS.push.state().catch(() => "off"); if (!$("#pushtxt")) return;
    const T = { on: "On for this phone. Max 3 a day, never 10 pm to 7 am.", off: "When someone is waiting for a challenger and the app is closed", "ios-install": "iPhone: tap Share → “Add to Home Screen”, open it from there, then turn this on", denied: "Blocked in your browser settings for this site", unsupported: "This browser can't show notifications", unavailable: "Not available right now" };
    tx.textContent = T[s] || T.off;
    bt.innerHTML = s === "on" ? `<button class="chip" id="ptest">Test</button> <button class="chip" id="poff">Off</button>` : s === "off" ? `<button class="chip on" id="pon">Turn on</button>` : "";
    const on = $("#pon"); if (on) on.onclick = async () => { on.disabled = true; const r = await BAS.push.enable().catch(() => "off"); toast(r === "on" ? "Notifications on ✓" : r === "denied" ? "Blocked in your browser settings." : "Couldn't turn on notifications here."); drawPushRow(); };
    const off = $("#poff"); if (off) off.onclick = async () => { await BAS.push.disable().catch(() => {}); toast("Notifications off"); drawPushRow(); };
    const te = $("#ptest"); if (te) te.onclick = async () => { try { const r = await BAS.push.test(); toast(r.sent ? "Test sent. Check your notifications 🔔" : "Couldn't send a test right now."); } catch (e) { toast(e.status === 429 ? "Wait a few minutes before another test." : "Couldn't send a test right now."); } };
  };
  drawPushRow();
  $("#delacct").onclick = async () => {
    if (!confirm("Delete your Bible Arena account? This permanently erases your profile, scores, rounds and the duels you created. It cannot be undone.")) return;
    try { await api("/api/v3/account/delete", { body: { confirm: "DELETE" } }); } catch (e) { toast("Couldn't delete right now. Try again, or use bible-arena.onrender.com/delete-account"); return; }
    try { Object.keys(localStorage).forEach((k) => { if (k.indexOf("ba3:") === 0) localStorage.removeItem(k); }); } catch (e) {}
    alert("Your account and all its data have been deleted.");
    location.replace("/");
  };
  const out = $("#out"); if (out) out.onclick = async () => { await api("/api/auth/logout", { body: {} }).catch(() => {}); ME = { user: null, player: null }; await ensureSession(); toast("Signed out"); profile(); };
}

// ---------- boot ----------
(async function boot() {
  if (window.BAS) { BAS.toast = toast; BAS.onJoin = (inv) => go("#/qm?join=" + encodeURIComponent(inv.id)); BAS.onJoinKo = (code) => joinKo(code); BAS.on(() => $$("[data-online]").forEach((e) => (e.textContent = onlineText()))); }
  document.addEventListener("click", () => { const a = audio(); if (a && a.state === "suspended") a.resume(); }, { once: true });
  ensureSession().then(() => { if (ME.player) { if (!S.name && ME.player.name) S.name = ME.player.name; if (!S.church && ME.player.church) S.church = ME.player.church; save(); } });
  loadBank().catch(() => {});
  // A sleeping server can take up to a minute to answer. Show the app after 1.5 s at most (the loading screen in index.html covers the wait) and
  // refresh the home screen once the session arrives.
  if (S.onboarded) {
    let late = false;
    const sess = ensureSession().then(() => { if (late && (!location.hash || location.hash === "#/" || location.hash === "#")) route(); });
    await Promise.race([sess, new Promise((r) => setTimeout(() => { late = true; r(); }, 1500))]);
  }
  route();
})();
})();
