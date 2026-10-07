/* Bible Arena Live — host app: quiz setup on the laptop, then the stage show on the projector. */
(function () {
"use strict";
const L = window.BALive, { $, $$, esc, fmt, ord, snd } = L;
const app = $("#app");
const KEY = "bal:host";
const CFG = "bal:cfg";
const DRAFT = "bal:draft";
let meta = null, room = null, S = null, conn = null, scene = "", deadline = 0, lastTick = -1, finalShown = false, cardSent = false, seenPlayers = new Set();
const toast = (m, ms) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), ms || 2600); };
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
snd.on = store.get("bal:sound", true);
const joinHost = location.host.replace(/^www\./, "");

/* ================= SETUP ================= */
const defaults = { title: "", church: "", teams: "none", teamNames: ["Ushers", "Choir", "Youth"], tab: "bank", cats: ["people", "events", "places", "who", "myth", "verse", "said"], tiers: ["b", "s"], testament: "", books: [], count: 15, timer: 20, instant: true, auto: false, quick: "", topup: false };
let cfg = Object.assign({}, defaults, store.get(CFG, {}));
cfg.quick = store.get(DRAFT, "") || cfg.quick || "";

async function setup() {
  document.body.classList.remove("onstage");
  if (conn) { conn.stop(); conn = null; }
  snd.stopLoop();
  app.innerHTML = `<div class="setup"><div class="brand"><div class="logo">BIBLE ARENA</div><span class="livepill">LIVE</span></div>
    <p class="lede">Church quiz night on the big screen. Put this page on the projector, everyone joins on their phone with a code. No app, no accounts, up to 200 players.</p>
    <div class="grid"><div id="left"></div><div id="right"></div></div>
    <div class="launch"><div class="sum" id="sum">Loading the question bank…</div><button class="btn primary big" id="go" disabled>Open the lobby ▶</button></div></div>`;
  if (!meta) { try { meta = await L.api("/lv/meta"); } catch (e) { $("#sum").textContent = "Could not load questions. Check the connection and refresh."; return; } }
  drawSetup();
}

function drawSetup() {
  const left = $("#left"), right = $("#right");
  const teamOpt = (id, e, b, s) => `<button class="opt-card ${cfg.teams === id ? "on" : ""}" data-team="${id}"><span class="e">${e}</span><b>${b}</b><span>${s}</span></button>`;
  left.innerHTML = `
    <section class="panel"><h3><span class="n">1</span>Your event</h3><p class="hint">This shows on the big screen and on the share card afterwards.</p>
      <div class="fields"><label class="f">Event name<input id="title" maxlength="60" placeholder="Youth Quiz Night" value="${esc(cfg.title)}"></label>
      <label class="f">Church or group<input id="church" maxlength="60" placeholder="Grace Chapel" value="${esc(cfg.church)}"></label></div></section>
    <section class="panel"><h3><span class="n">2</span>How do people play?</h3><p class="hint">Teams are scored by average points per player, so a bigger team has no advantage.</p>
      <div class="seg">${teamOpt("none", "🙋", "Everyone for themselves", "Classic leaderboard")}${teamOpt("youth-choir", "🔥🎶", "Youth vs Choir", "Two teams")}${teamOpt("men-women", "🛡️👑", "Men vs Women", "Two teams")}${teamOpt("custom", "⛪", "Your own teams", "2 to 4 teams")}</div>
      ${cfg.teams === "custom" ? `<div class="fields" style="margin-top:12px;grid-template-columns:repeat(4,1fr)">${[0, 1, 2, 3].map((i) => `<label class="f">Team ${i + 1}<input class="tname" data-i="${i}" maxlength="18" placeholder="${i < 2 ? "Required" : "Optional"}" value="${esc(cfg.teamNames[i] || "")}"></label>`).join("")}</div>` : ""}
    </section>
    <section class="panel"><h3><span class="n">3</span>Questions</h3><p class="hint">From our ${fmt(meta.total)} checked questions (every answer with its verse), or write your own for this Sunday's text.</p>
      <div class="tabs">${[["bank", "📚 Question bank"], ["book", "📖 By book"], ["custom", "✍️ Your own quiz"]].map(([k, l]) => `<button data-tab="${k}" class="${cfg.tab === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <div id="src"></div>
      <div class="countline" id="countline">…</div>
    </section>`;
  right.innerHTML = `
    <section class="panel"><h3>⏱️ Game settings</h3>
      <div class="sub">Number of questions</div><div class="chips" id="cnt">${[10, 15, 20, 30].map((n) => `<button class="chip ${cfg.count === n ? "on" : ""}" data-n="${n}">${n}</button>`).join("")}</div>
      <div class="sub">Time per question</div><div class="chips" id="tmr">${[10, 15, 20, 30, 45].map((n) => `<button class="chip ${cfg.timer === n ? "on" : ""}" data-n="${n}">${n} s</button>`).join("")}</div>
      <div style="margin-top:12px">
      <div class="switchrow"><div><b>Instant feedback on phones</b><span>Right or wrong shows the moment they tap. Turn off for strict competitions.</span></div><button class="sw ${cfg.instant ? "on" : ""}" id="sw-instant" aria-label="Instant feedback"></button></div>
      <div class="switchrow"><div><b>Auto-play</b><span>Moves from answer to leaderboard to next question by itself. Off means you press Next (or Space).</span></div><button class="sw ${cfg.auto ? "on" : ""}" id="sw-auto" aria-label="Auto-play"></button></div>
      </div></section>
    <section class="panel"><h3>📽️ On the night</h3><div class="howto">
      <div><i>1</i><span>Connect this laptop to the projector or TV and open the lobby.</span></div>
      <div><i>2</i><span>People scan the QR code or go to <b>${esc(joinHost)}/join</b> and type the code.</span></div>
      <div><i>3</i><span>Press <b>Space</b> (or a presenter clicker) to move on. <b>M</b> mutes, <b>F</b> goes full screen.</span></div>
      <div><i>4</i><span>At the end: podium, confetti, and a results card for your WhatsApp group.</span></div></div></section>
    <section class="panel premium"><h3>💎 Church Premium</h3><p class="hint" style="margin:0">For churches that run quiz nights often.</p>
      <div class="prem-list">
        <div class="prem"><span class="e">🗂️</span><div><b>Saved quiz sets</b><span>Keep and reuse your own quizzes</span></div><span class="soon">Coming soon</span></div>
        <div class="prem"><span class="e">🎨</span><div><b>Church branding</b><span>Your logo and colours on the stage</span></div><span class="soon">Coming soon</span></div>
        <div class="prem"><span class="e">🏟️</span><div><b>More than 200 players</b><span>Conventions, camps, crusades</span></div><span class="soon">Coming soon</span></div>
      </div></section>`;
  drawSource();
  $("#title").oninput = (e) => { cfg.title = e.target.value; save(); };
  $("#church").oninput = (e) => { cfg.church = e.target.value; save(); };
  $$("[data-team]").forEach((b) => (b.onclick = () => { cfg.teams = b.dataset.team; save(); drawSetup(); }));
  $$(".tname").forEach((i) => (i.oninput = () => { cfg.teamNames[+i.dataset.i] = i.value; save(); }));
  $$("[data-tab]").forEach((b) => (b.onclick = () => { cfg.tab = b.dataset.tab; save(); drawSetup(); }));
  $$("#cnt .chip").forEach((b) => (b.onclick = () => { cfg.count = +b.dataset.n; save(); drawSetup(); }));
  $$("#tmr .chip").forEach((b) => (b.onclick = () => { cfg.timer = +b.dataset.n; save(); drawSetup(); }));
  $("#sw-instant").onclick = () => { cfg.instant = !cfg.instant; save(); drawSetup(); };
  $("#sw-auto").onclick = () => { cfg.auto = !cfg.auto; save(); drawSetup(); };
  $("#go").onclick = launch;
}
function save() { const c = Object.assign({}, cfg); delete c.quick; store.set(CFG, c); store.set(DRAFT, cfg.quick); }

function bankPick() {
  if (cfg.tab === "book") return { books: cfg.books, tiers: cfg.tiers, count: cfg.count };
  if (cfg.tab === "custom") return cfg.topup && cfg.books.length ? { books: cfg.books, count: Math.max(0, cfg.count - parsed().questions.length) } : null;
  return { cats: cfg.cats, tiers: cfg.tiers, testament: cfg.testament, count: cfg.count };
}
const parsed = () => window.parseQuick(cfg.quick);

function drawSource() {
  const box = $("#src");
  const tierChips = `<div class="sub">Difficulty</div><div class="chips" id="tiers">${Object.entries(meta.levels).map(([k, v]) => `<button class="chip ${cfg.tiers.includes(k) ? "on" : ""}" data-t="${k}">${{ b: "🕊️", s: "📜", t: "👑" }[k]} ${v}</button>`).join("")}</div>`;
  if (cfg.tab === "bank") {
    box.innerHTML = `<div class="sub" style="margin-top:0">Categories</div><div class="chips" id="cats">${meta.cats.map((c) => `<button class="chip ${cfg.cats.includes(c.id) ? "on" : ""}" data-c="${c.id}">${c.icon} ${esc(c.name)} <small>${c.counts.all}</small></button>`).join("")}</div>
      ${tierChips}<div class="sub">Testament</div><div class="chips" id="test">${[["", "Whole Bible"], ["ot", "Old Testament"], ["nt", "New Testament"]].map(([k, l]) => `<button class="chip ${cfg.testament === k ? "on" : ""}" data-k="${k}">${l}</button>`).join("")}</div>`;
    $$("#cats .chip").forEach((b) => (b.onclick = () => { toggle(cfg.cats, b.dataset.c); save(); drawSource(); }));
    $$("#test .chip").forEach((b) => (b.onclick = () => { cfg.testament = b.dataset.k; save(); drawSource(); }));
  } else if (cfg.tab === "book") {
    box.innerHTML = `<div class="row" style="display:flex;gap:10px;align-items:center"><input id="bq" placeholder="Search books…" style="flex:1;background:#0A1230;border:1px solid var(--line2);border-radius:12px;padding:10px 12px"><button class="chip" id="bclear">Clear</button></div>
      <div class="sub">Old Testament</div><div class="chips books" id="ot"></div><div class="sub">New Testament</div><div class="chips books" id="nt"></div>${tierChips}`;
    const drawBooks = (f) => {
      ["ot", "nt"].forEach((t) => { $("#" + t).innerHTML = meta.books.filter((b) => b.t === t && (!f || b.name.toLowerCase().includes(f))).map((b) => `<button class="chip ${cfg.books.includes(b.name) ? "on" : ""}" data-b="${esc(b.name)}">${esc(b.name)} <small>${b.count}</small></button>`).join(""); });
      $$("[data-b]").forEach((b) => (b.onclick = () => { toggle(cfg.books, b.dataset.b); save(); b.classList.toggle("on"); recount(); }));
    };
    drawBooks("");
    $("#bq").oninput = (e) => drawBooks(e.target.value.trim().toLowerCase());
    $("#bclear").onclick = () => { cfg.books = []; save(); drawSource(); };
  } else {
    const p = parsed();
    box.innerHTML = `<p class="hint" style="margin:0 0 8px">Type or paste. One question per block, a blank line between. Put <b>*</b> before the right answer. A verse in brackets is shown at the reveal.</p>
      <textarea class="quick" id="quick" spellcheck="false" placeholder="Who was swallowed by a great fish? (Jonah 1:17)\n*Jonah\nPeter\nElijah\nPaul\n\nJonah first ran away to Tarshish.\n*True\nFalse">${esc(cfg.quick)}</textarea>
      <div id="perr"></div><div class="parsed" id="parsed"></div>
      <div class="switchrow" style="margin-top:8px"><div><b>Top up from the question bank</b><span>Fill the rest of the ${cfg.count} with bank questions from the sermon's book(s).</span></div><button class="sw ${cfg.topup ? "on" : ""}" id="sw-topup"></button></div>
      ${cfg.topup ? `<div class="chips books" style="max-height:140px">${meta.books.map((b) => `<button class="chip ${cfg.books.includes(b.name) ? "on" : ""}" data-b="${esc(b.name)}">${esc(b.name)} <small>${b.count}</small></button>`).join("")}</div>` : ""}`;
    const showParsed = () => {
      const r = parsed();
      $("#parsed").innerHTML = r.questions.map((q, i) => `<div class="pq"><b>${i + 1}.</b> ${esc(q.q)} <span class="ok">✓ ${esc(q.o[q.a])}</span>${q.r ? ` <span class="small" style="color:var(--muted)">· ${esc(q.r)}</span>` : ""}</div>`).join("");
      $("#perr").innerHTML = r.errors.slice(0, 4).map((e) => `<div class="err">⚠️ ${esc(e)}</div>`).join("");
    };
    showParsed();
    let t;
    $("#quick").oninput = (e) => { cfg.quick = e.target.value; clearTimeout(t); t = setTimeout(() => { save(); showParsed(); recount(); }, 250); };
    $("#sw-topup").onclick = () => { cfg.topup = !cfg.topup; save(); drawSource(); };
    $$("[data-b]").forEach((b) => (b.onclick = () => { toggle(cfg.books, b.dataset.b); save(); b.classList.toggle("on"); recount(); }));
    void p;
  }
  $$("#tiers .chip").forEach((b) => (b.onclick = () => { toggle(cfg.tiers, b.dataset.t); if (!cfg.tiers.length) cfg.tiers = [b.dataset.t]; save(); drawSource(); }));
  recount();
}
function toggle(arr, v) { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }

let rc = 0;
async function recount() {
  const id = ++rc, line = $("#countline"), sum = $("#sum"), go = $("#go");
  if (!line) return;
  let n = 0, custom = 0;
  if (cfg.tab === "custom") custom = parsed().questions.length;
  const pick = bankPick();
  if (pick && (cfg.tab !== "book" || cfg.books.length)) { try { n = (await L.api("/lv/count", pick)).count; } catch (e) {} }
  if (id !== rc) return;
  const avail = custom + n, playing = Math.min(cfg.count, avail);
  const want = cfg.tab === "custom" ? Math.min(50, custom + Math.min(n, Math.max(0, cfg.count - custom))) : playing;
  line.classList.toggle("low", want < 3);
  if (cfg.tab === "book" && !cfg.books.length) line.innerHTML = `<span>Pick one or more books above.</span>`;
  else if (cfg.tab === "custom") line.innerHTML = `<span>${custom} of your own question${custom === 1 ? "" : "s"}${cfg.topup && cfg.books.length ? ` + up to ${Math.min(n, Math.max(0, cfg.count - custom))} from ${cfg.books.length} book(s)` : ""}</span><b>${want} in the game</b>`;
  else line.innerHTML = `<span>${fmt(avail)} questions match</span><b>${playing} in the game</b>`;
  const teamTxt = cfg.teams === "none" ? "everyone for themselves" : cfg.teams === "custom" ? cfg.teamNames.filter(Boolean).slice(0, 4).join(" vs ") : cfg.teams === "youth-choir" ? "Youth vs Choir" : "Men vs Women";
  sum.innerHTML = `<b>${want} questions</b> · ${cfg.timer} s each · ${esc(teamTxt)}`;
  go.disabled = want < 1;
}

async function launch() {
  const go = $("#go"); go.disabled = true; go.textContent = "Opening…";
  snd.init();
  const body = { title: cfg.title || "Bible Quiz Night", church: cfg.church, timer: cfg.timer, instant: cfg.instant, auto: cfg.auto,
    teams: cfg.teams === "none" ? null : cfg.teams, teamNames: cfg.teamNames, bank: bankPick(), custom: cfg.tab === "custom" ? parsed().questions : [] };
  if (cfg.tab === "custom" && body.bank && !body.bank.count) body.bank = null;
  try {
    const r = await L.api("/lv/rooms", body);
    room = { code: r.code, key: r.hostKey };
    store.set(KEY, room);
    history.replaceState(null, "", "/live#" + r.code);
    stage();
  } catch (e) { toast(e.message); go.disabled = false; go.textContent = "Open the lobby ▶"; }
}

/* ================= STAGE ================= */
function stage() {
  document.body.classList.add("onstage");
  finalShown = false; cardSent = false; scene = ""; seenPlayers = new Set();
  app.innerHTML = `<div class="stage"><div class="hud">
      <span class="net" id="net" title="Connection"></span><span class="t" id="ht"></span><span class="c" id="hc"></span><span class="sp"></span>
      <span class="qcount" id="qc" hidden></span><span class="codepill" id="cp" hidden>Code <b></b></span>
      <button class="ctl" id="c-lock" title="Lock the room (no new players)">🔓</button>
      <button class="ctl" id="c-auto" title="Auto-play">⏩</button>
      <button class="ctl" id="c-snd" title="Sound (M)">🔊</button>
      <button class="ctl" id="c-fs" title="Full screen (F)">⛶</button>
      <button class="ctl" id="c-menu" title="More">⋯</button>
    </div><div class="body" id="body"></div><div class="nextbar" id="nb"></div></div>`;
  $("#c-snd").onclick = toggleSound; syncSound();
  $("#c-fs").onclick = fullscreen;
  $("#c-lock").onclick = () => act("lock", { on: !(S && S.locked) });
  $("#c-auto").onclick = () => act("auto", { on: !(S && S.auto) });
  $("#c-menu").onclick = menu;
  conn = L.connect("/lv/r/" + room.code, "key=" + encodeURIComponent(room.key), onState, (n) => { const el = $("#net"); if (el) el.className = "net " + (n === "live" ? "" : n); },
    () => { toast("That game has ended or expired."); localStorage.removeItem(KEY); setTimeout(setup, 1500); });
}
function syncSound() { const b = $("#c-snd"); if (b) { b.textContent = snd.on ? "🔊" : "🔇"; b.classList.toggle("on", !snd.on); } }
function toggleSound() { snd.init(); snd.setOn(!snd.on); store.set("bal:sound", snd.on); syncSound(); if (snd.on && S && S.phase === "lobby") snd.startLoop(); if (!snd.on) snd.stopLoop(); }
function fullscreen() { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {} }
async function act(action, extra) {
  snd.init();
  try { const s = await L.api("/lv/r/" + room.code + "/host", Object.assign({ key: room.key, action }, extra || {})); onState(s); }
  catch (e) { toast(e.message); }
}
function menu() {
  const ov = document.createElement("div"); ov.className = "overlay";
  ov.innerHTML = `<div class="modal"><h3 style="margin:0 0 10px">Game controls</h3>
    <div class="switchrow"><div><b>Instant feedback on phones</b><span>Players see right/wrong the moment they tap</span></div><button class="sw ${S && S.instant ? "on" : ""}" data-a="instant"></button></div>
    <div class="switchrow"><div><b>Auto-play</b><span>Advance automatically after each reveal</span></div><button class="sw ${S && S.auto ? "on" : ""}" data-a="auto"></button></div>
    <div class="switchrow"><div><b>Lock the room</b><span>No new players can join</span></div><button class="sw ${S && S.locked ? "on" : ""}" data-a="lock"></button></div>
    ${S && S.phase === "question" ? `<div class="switchrow"><div><b>+10 seconds</b><span>Give everyone a little more time</span></div><button class="btn ghost" data-x="extend">+10 s</button></div>` : ""}
    <div class="sub">Remove a player</div><div class="plist" id="plist">${(S && S.players ? S.players : []).map((p) => `<button data-pid="${p.id}">${p.avatar} ${esc(p.name)} ✕</button>`).join("") || `<span class="hint">Open on the lobby or leaderboard to see players.</span>`}</div>
    <div class="acts"><button class="btn ghost" data-x="close">Close</button>${S && S.phase !== "final" ? `<button class="btn ghost" data-x="end" style="border-color:rgba(255,93,115,.5)">End game now</button>` : ""}<button class="btn ghost" data-x="new">New game</button></div></div>`;
  document.body.appendChild(ov);
  ov.onclick = (e) => {
    const t = e.target.closest("button"); if (e.target === ov) return ov.remove(); if (!t) return;
    if (t.dataset.a) { act(t.dataset.a, { on: !t.classList.contains("on") }); t.classList.toggle("on"); }
    if (t.dataset.pid && confirm("Remove " + t.textContent.replace(" ✕", "") + " from the game?")) { act("kick", { pid: t.dataset.pid }); t.remove(); }
    if (t.dataset.x === "close") ov.remove();
    if (t.dataset.x === "extend") { act("extend"); ov.remove(); }
    if (t.dataset.x === "end" && confirm("End the game and show the podium now?")) { act("end"); ov.remove(); }
    if (t.dataset.x === "new" && confirm("Leave this game and set up a new one?")) { ov.remove(); localStorage.removeItem(KEY); history.replaceState(null, "", "/live"); setup(); }
  };
}

const wordsHTML = (t, d0) => esc(t).split(/(\s+)/).map((w, i) => (/^\s+$/.test(w) ? w : `<span class="w" style="animation-delay:${(d0 || 0) + i * 0.035}s">${w}</span>`)).join("");
const lenClass = (t) => (t.length > 170 ? "xlong" : t.length > 95 ? "long" : "");
const CAT = { people: "👤 People", events: "⚡ Events", places: "🗺️ Places", teachings: "📖 Teachings", numbers: "🔢 Numbers", books: "📚 Books", said: "💬 Who said it?", who: "🎭 Who am I?", myth: "🧐 Bible or Myth?", verse: "✍️ Complete the verse", custom: "⛪ This Sunday" };

function onState(s) {
  const prev = S; S = s;
  if (typeof s.remain === "number") deadline = performance.now() + s.remain;
  $("#ht").textContent = s.title; $("#hc").textContent = s.church ? "· " + s.church : "";
  const qc = $("#qc"); qc.hidden = s.phase === "lobby" || s.phase === "final"; qc.textContent = `Question ${s.qi + 1} / ${s.qn}`;
  const cp = $("#cp"); cp.hidden = s.phase === "lobby"; cp.querySelector("b").textContent = s.code;
  $("#c-lock").textContent = s.locked ? "🔒" : "🔓"; $("#c-lock").classList.toggle("on", !!s.locked);
  $("#c-auto").classList.toggle("on", !!s.auto);
  const key = s.phase + ":" + s.qi;
  if (key !== scene) { const was = scene; scene = key; enter(s, prev, was); } else update(s, prev);
  nextBar(s);
}

function nextBar(s) {
  const nb = $("#nb"); if (!nb) return;
  const last = s.qi >= s.qn - 1;
  const label = { lobby: s.n ? "Start the quiz ▶" : "Waiting for players…", intro: "Show answers ▶", question: "Reveal now ▶", reveal: last ? "Final results 🏆" : "Leaderboard ▶", board: "Next question ▶" }[s.phase];
  if (!label) { nb.innerHTML = ""; return; }
  const dis = s.phase === "lobby" && !s.n;
  nb.innerHTML = `${s.auto && (s.phase === "reveal" || s.phase === "board") ? `<span class="keyhint">auto-play on</span>` : `<span class="keyhint">Space ▸</span>`}<button class="btn primary nextbtn" id="next" ${dis ? "disabled" : ""}>${label}</button>`;
  $("#next").onclick = next;
}
function next() {
  if (!S) return;
  if (S.phase === "lobby" && !S.n) return;
  if (S.phase === "final") return;
  snd.init();
  act("next");
}

function enter(s, prev, was) {
  const body = $("#body");
  document.body.classList.toggle("onfinal", s.phase === "final");
  if (s.phase !== "lobby") snd.stopLoop();
  if (s.phase === "lobby") { body.innerHTML = lobbyHTML(s); drawQR(s.code); seenPlayers = new Set(); updateLobby(s, true); if (snd.on && snd.ctx) snd.startLoop(); return; }
  if (s.phase === "intro") {
    snd.whoosh();
    body.innerHTML = `<div class="scene intro"><div class="qn">QUESTION ${s.qi + 1}</div>${s.q.cat ? `<span class="cat">${CAT[s.q.cat] || ""}</span>` : ""}
      <div class="qbig ${lenClass(s.q.q)}">${wordsHTML(s.q.q, 0.25)}</div><div class="readbar"><i style="animation-duration:${Math.max(0.5, s.remain / 1000)}s"></i></div></div>`;
    return;
  }
  if (s.phase === "question" || s.phase === "reveal") {
    const fromQuestion = was === "question:" + s.qi;
    if (s.phase === "reveal" && fromQuestion) { toReveal(s); return; }
    body.innerHTML = questionHTML(s);
    fitQ();
    if (s.phase === "question") { snd.swoosh(); lastTick = -1; }
    else toReveal(s, true);
    update(s, prev);
    return;
  }
  if (s.phase === "board") { snd.swoosh(); body.innerHTML = boardHTML(s); animateBoard(s); return; }
  if (s.phase === "final") { finale(s); }
}

function update(s) {
  if (s.phase === "lobby") updateLobby(s);
  if (s.phase === "question") {
    const a = $("#ansn"); if (a) { a.textContent = s.answered; const bar = $("#ansbar"); if (bar) bar.style.width = (s.n ? (100 * s.answered) / s.n : 0) + "%"; const of = $("#ansof"); if (of) of.textContent = `of ${s.n} answered`; }
  }
}

/* ---- lobby ---- */
function lobbyHTML(s) {
  const digits = String(s.code).split("").map((d) => `<i>${d}</i>`).join("");
  const crowd = s.teams
    ? `<div class="teamcols" style="grid-template-columns:repeat(${s.teams.length},1fr)">${s.teams.map((t) => `<div class="teamcol" style="--tc:${t.color}" data-tid="${t.id}"><h4>${t.emoji} ${esc(t.name)}<small class="tn">0</small></h4><div class="wall"></div></div>`).join("")}</div>`
    : `<div class="wall" id="wall"></div>`;
  return `<div class="scene lobby"><div class="joinbox">
      <div class="step">Join on your phone</div>
      <div class="url">${esc(joinHost)}<span>/join</span></div>
      <div class="step" style="margin-top:6px">Game code</div>
      <div class="bigcode">${digits}</div>
      <div class="qrrow"><div class="qr" id="qr"></div><p><b>Scan with your camera</b> to jump straight in.<br>No app. No account. Free.</p></div>
    </div>
    <div class="crowd"><div class="crowdhead"><span class="num" id="pn">0</span><span class="lbl">players</span><span class="of">/ ${s.max}</span></div>
      ${crowd}<div class="waiting" id="waitmsg">Waiting for players to join…</div></div></div>`;
}
function drawQR(code) {
  const el = $("#qr"); if (!el) return;
  const url = location.origin + "/j/" + code;
  const draw = () => {
    try { const q = window.qrcode(0, "M"); q.addData(url); q.make(); el.innerHTML = q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
    catch (e) { el.innerHTML = `<div style="color:#000;font-weight:800;padding:10px;font-size:14px">${esc(url)}</div>`; }
  };
  if (window.qrcode) draw(); else setTimeout(() => drawQR(code), 200);
}
function updateLobby(s, first) {
  const pn = $("#pn"); if (!pn) return;
  const players = s.players || [];
  pn.textContent = s.n;
  $("#waitmsg").style.display = players.length ? "none" : "";
  const chip = (p) => `<span class="pl ${p.on ? "" : "off"}" data-id="${p.id}" title="Click to remove"><span class="av">${p.avatar}</span>${esc(p.name)}</span>`;
  const ids = new Set(players.map((p) => p.id));
  $$(".pl").forEach((el) => { if (!ids.has(el.dataset.id)) el.remove(); });
  let popped = 0;
  players.forEach((p) => {
    const existing = $(`.pl[data-id="${p.id}"]`);
    if (existing) { existing.classList.toggle("off", !p.on); return; }
    const wall = s.teams ? $(`.teamcol[data-tid="${p.team}"] .wall`) : $("#wall");
    if (!wall) return;
    wall.insertAdjacentHTML("beforeend", chip(p));
    if (!first && !seenPlayers.has(p.id) && popped++ < 4) snd.pop();
    seenPlayers.add(p.id);
  });
  if (s.teams) s.teams.forEach((t) => { const el = $(`.teamcol[data-tid="${t.id}"] .tn`); if (el) el.textContent = t.members; });
  $$(".pl").forEach((el) => (el.onclick = () => { if (confirm("Remove " + el.textContent + " from the game?")) act("kick", { pid: el.dataset.id }); }));
}

/* ---- question / reveal ---- */
function questionHTML(s) {
  const q = s.q, two = q.o.length === 2;
  const small = q.o.some((o) => o.length > 34);
  const clues = q.clues && q.clues.length ? `<div class="clues">${q.clues.map((c, i) => `<div class="clue" style="animation-delay:${s.phase === "reveal" ? 0 : 0.2 + i * 0.8}s"><b>Clue ${i + 1}</b> ${esc(c)}</div>`).join("")}</div>` : "";
  return `<div class="scene qwrap" id="qw">
    <div class="qbox ${clues ? "who" : ""}"><h1 class="${clues ? "" : lenClass(q.q)}">${esc(q.q)}</h1>${clues}</div>
    <div class="qmid">
      <div class="ring" id="ring"><svg viewBox="0 0 100 100"><circle class="bgc" cx="50" cy="50" r="44"/><circle class="fg" id="ringfg" cx="50" cy="50" r="44" stroke-dasharray="276.46" stroke-dashoffset="0"/></svg><div class="num" id="rnum">${s.timer}</div></div>
      <div class="mid" id="mid"></div>
      <div class="answered" id="side"><div class="big" id="ansn">${s.answered}</div><div class="lbl" id="ansof">of ${s.n} answered</div><div class="bar"><i id="ansbar" style="width:0"></i></div></div>
    </div>
    <div class="optgrid ${two ? "two" : ""}">${q.o.map((o, i) => `<div class="ot ${small ? "small" : ""}" data-i="${i}" style="--oc:${L.OPT[i].c};animation-delay:${0.1 + i * 0.08}s"><span class="sh">${L.OPT[i].s}</span><span class="tx">${esc(o)}</span><span class="cnt"></span></div>`).join("")}</div>
  </div>`;
}
function toReveal(s, instant) {
  const qw = $("#qw"); if (!qw) return;
  if (!instant) { if (performance.now() >= deadline - 250) snd.timeup(); setTimeout(() => snd.reveal(), instant ? 0 : 350); }
  qw.classList.add("reveal");
  const total = (s.dist || []).reduce((a, b) => a + b, 0);
  $$(".ot", qw).forEach((el) => {
    const i = +el.dataset.i, n = (s.dist || [])[i] || 0;
    el.classList.add(i === s.q.a ? "yes" : "no");
    el.querySelector(".cnt").textContent = n;
    if (!el.querySelector(".fill")) el.insertAdjacentHTML("afterbegin", `<i class="fill" style="width:${total ? (100 * n) / total : 0}%;animation-delay:${0.2 + i * 0.08}s"></i>`);
  });
  const ring = $("#ring"); if (ring) ring.style.visibility = "hidden";
  const pct = s.n ? Math.round((100 * (s.correctN || 0)) / s.n) : 0;
  $("#side").innerHTML = "";
  $("#mid").innerHTML = `<div class="revealrow"><div class="pctbox"><div class="pct">${pct}%</div><div class="pctl">got it right · ${total} answered</div></div>${s.fastest ? `<div class="fast">⚡ Fastest<b>${s.fastest.avatar} ${esc(s.fastest.name)}</b>${(s.fastest.ms / 1000).toFixed(1)} s</div>` : ""}</div>`;
  if (s.q.r || s.q.x) {
    const ref = document.createElement("div"); ref.className = "refline";
    ref.innerHTML = `${s.q.r ? `<b>📖 ${esc(s.q.r)}</b>` : ""}${s.q.x ? ` · ${esc(s.q.x)}` : ""}`;
    qw.querySelector(".qbox").appendChild(ref);
  }
  fitQ();
}

/* shrink the question card and tiles until the whole question fits the screen (long verses, 4 clues) */
function fitQ() {
  const qw = $("#qw"); if (!qw) return;
  let k = 1; qw.style.setProperty("--k", "1");
  for (let i = 0; i < 9 && qw.scrollHeight > qw.clientHeight + 2; i++) { k -= 0.07; qw.style.setProperty("--k", k.toFixed(2)); }
}
addEventListener("resize", () => fitQ());

/* ---- leaderboard ---- */
function boardHTML(s) {
  const teams = s.teams && s.teams.length;
  return `<div class="scene board ${teams ? "withteams" : ""}"><div><div class="boardh">LEADERBOARD</div><div class="rows" id="rows"></div></div>
    ${teams ? `<div class="teamboard"><div class="boardh" style="font-size:calc(var(--u)*3)">TEAMS</div><div class="tbnote">Average points per player</div>${s.teams.map((t) => `<div class="tb" style="--tc:${t.color}"><div class="h">${t.emoji} ${esc(t.name)}<span class="avg" data-avg="${t.avg}">0</span></div><div class="track"><i style="width:0"></i></div><div class="m">${t.members} players · ${fmt(t.total)} total</div></div>`).join("")}</div>` : ""}</div>`;
}
function animateBoard(s) {
  const rowsEl = $("#rows"); if (!rowsEl) return;
  const top = (s.players || []).slice(0, 8);
  const avail = Math.max(200, innerHeight - rowsEl.getBoundingClientRect().top - Math.min(innerWidth / 100, innerHeight / 56.25) * 8);
  const H = Math.min(innerHeight * 0.085, innerWidth * 0.05, avail / (Math.max(5, top.length) * 1.18)), gap = H * 0.18;
  rowsEl.style.height = top.length * (H + gap) + "px";
  const tcol = {}; (s.teams || []).forEach((t) => (tcol[t.id] = t.color));
  rowsEl.innerHTML = top.map((p, i) => {
    const from = p.prev ? Math.min(p.prev - 1, top.length) : top.length;
    const move = p.prev ? p.prev - p.rank : 0;
    return `<div class="row ${p.rank === 1 ? "r1" : ""}" style="height:${H}px;top:${from * (H + gap)}px" data-to="${i * (H + gap)}">
      <span class="pos">${p.rank}</span><span class="av">${p.avatar}</span>${p.team && tcol[p.team] ? `<span class="tm" style="background:${tcol[p.team]}"></span>` : ""}<span class="nm">${esc(p.name)}</span>
      ${p.streak >= 3 ? `<span class="fl">🔥${p.streak}</span>` : ""}${move > 0 ? `<span class="up">▲${move}</span>` : move < 0 ? `<span class="dn">▼${-move}</span>` : ""}
      ${p.last ? `<span class="gain">+${fmt(p.last)}</span>` : ""}<span class="sc" data-from="${p.score - (p.last || 0)}" data-to="${p.score}">${fmt(p.score - (p.last || 0))}</span></div>`;
  }).join("");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    $$(".row", rowsEl).forEach((r, i) => { setTimeout(() => { r.style.top = r.dataset.to + "px"; }, 120 + i * 60); });
    $$(".sc", rowsEl).forEach((el) => L.countUp(el, +el.dataset.from, +el.dataset.to, 1100));
    const maxAvg = Math.max(1, ...(s.teams || []).map((t) => t.avg));
    $$(".tb").forEach((tb, i) => { const t = s.teams[i]; tb.querySelector(".track i").style.width = (100 * t.avg) / maxAvg + "%"; L.countUp(tb.querySelector(".avg"), 0, t.avg, 1200); });
  }));
}

/* ---- finale ---- */
function finale(s) {
  const f = s.final || {};
  const pod = f.podium || [];
  const body = $("#body");
  body.innerHTML = `<div class="scene final"><div class="fh">${esc(s.title)}</div><div class="fs">${s.church ? esc(s.church) + " · " : ""}${f.players || 0} players · ${f.questions || 0} questions</div>
    ${f.teams && f.teams.length ? `<div class="teamwin" id="tw" style="--tc:${f.teams[0].color};opacity:0">${f.teams[0].emoji} ${esc(f.teams[0].name)} win the team battle! <span style="opacity:.75;font-weight:700">(${fmt(f.teams[0].avg)} avg${f.teams[1] ? " vs " + fmt(f.teams[1].avg) : ""})</span></div>` : ""}
    <div class="podium">${[1, 0, 2].map((i) => pod[i] ? `<div class="pod p${i + 1}" id="pod${i + 1}"><div class="who">${i === 0 ? `<div class="crown">👑</div>` : ""}<div class="av">${pod[i].avatar}</div><div class="nm">${i === 0 ? "👑 " : ""}${esc(pod[i].name)}</div><div class="sc">${fmt(pod[i].score)} pts</div></div><div class="blk">${i + 1}</div></div>` : "").join("")}</div>
    <div class="finalbar" id="fbar"><span class="stat">🎯 <b>${f.accuracy || 0}%</b> answered right</span>${f.fastest ? `<span class="stat">⚡ Fastest answer <b>${esc(f.fastest.name)}</b> ${(f.fastest.ms / 1000).toFixed(1)} s</span>` : ""}${f.hardest ? `<span class="stat">🧠 Hardest question: only <b>${f.hardest.pct}%</b> got it</span>` : ""}</div>
    <div class="finalact" id="fact" style="opacity:0"><button class="btn primary" id="share">📲 Share results</button><button class="btn ghost" id="again">🔁 New game</button></div></div>`;
  const seq = finalShown ? [0, 0, 0, 0] : [3200, 4600, 6200, 7400];
  if (!finalShown) snd.drumroll(3);
  finalShown = true;
  setTimeout(() => { const p = $("#pod3"); if (p) { p.classList.add("go"); snd.pop(); } }, seq[0]);
  setTimeout(() => { const p = $("#pod2"); if (p) { p.classList.add("go"); snd.pop(); } }, seq[1]);
  setTimeout(() => { const p = $("#pod1"); if (p) p.classList.add("go"); if (seq[2]) { snd.fanfare(); L.confetti({ count: 260 }); setTimeout(() => L.confetti({ count: 160 }), 1400); } }, seq[2]);
  setTimeout(() => { const b = $("#fbar"); if (b) b.classList.add("go"); const tw = $("#tw"); if (tw) { tw.style.transition = "opacity .6s"; tw.style.opacity = 1; } const a = $("#fact"); if (a) a.style.opacity = 1; uploadCard(s); }, seq[3]);
  $("#share").onclick = () => shareModal(s);
  $("#again").onclick = () => { localStorage.removeItem(KEY); history.replaceState(null, "", "/live"); setup(); };
}
async function uploadCard(s) {
  if (cardSent || !s.final) return; cardSent = true;
  try { const cv = await L.drawCard(s.final, 1200, 630); await L.api("/lv/r/" + room.code + "/card", { key: room.key, jpeg: cv.toDataURL("image/jpeg", 0.86) }, { timeout: 20000 }); } catch (e) { cardSent = false; }
}
async function shareModal(s) {
  const f = s.final; const url = location.origin + "/live/r/" + s.code;
  const cv = await L.drawCard(f, 1080, 1080);
  const ov = document.createElement("div"); ov.className = "overlay";
  ov.innerHTML = `<div class="modal" style="max-width:560px"><h3 style="margin:0 0 12px">Share the results</h3><img alt="Results card" src="${cv.toDataURL("image/png")}">
    <div class="acts"><button class="btn primary" id="sh-wa">WhatsApp</button><button class="btn ghost" id="sh-dl">Download picture</button><button class="btn ghost" id="sh-cp">Copy link</button><button class="btn ghost" id="sh-x">Close</button></div>
    <p class="hint" style="margin:10px 0 0">The link shows the winners with this picture in WhatsApp: <a href="${url}" target="_blank">${esc(url.replace(/^https?:\/\//, ""))}</a></p></div>`;
  document.body.appendChild(ov);
  $("#sh-wa").onclick = () => L.shareCard(f);
  $("#sh-dl").onclick = () => { const a = document.createElement("a"); a.href = cv.toDataURL("image/png"); a.download = "bible-arena-live-results.png"; a.click(); };
  $("#sh-cp").onclick = async () => { try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch (e) { prompt("Copy this link", url); } };
  $("#sh-x").onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
}

/* ---- clock: countdown ring and ticks ---- */
setInterval(() => {
  if (!S || S.phase !== "question") return;
  const left = Math.max(0, deadline - performance.now()), secs = Math.ceil(left / 1000);
  const fg = $("#ringfg"), num = $("#rnum"), ring = $("#ring");
  if (!fg) return;
  fg.style.strokeDashoffset = String(276.46 * (1 - left / (S.timer * 1000)));
  if (num.textContent !== String(secs)) { num.textContent = secs; if (secs <= 5 && secs > 0 && secs !== lastTick) { snd.tick(secs <= 3); lastTick = secs; } }
  ring.classList.toggle("hot", secs <= 5);
}, 100);

document.addEventListener("keydown", (e) => {
  if (!document.body.classList.contains("onstage") || /input|textarea/i.test(e.target.tagName) || $(".overlay")) return;
  if (e.key === " " || e.key === "Enter" || e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); next(); }
  else if (e.key === "m" || e.key === "M") toggleSound();
  else if (e.key === "f" || e.key === "F") fullscreen();
});
document.addEventListener("pointerdown", () => snd.init(), { once: true });

/* resume a game on refresh: /live#123456 with the host key saved on this computer */
const saved = store.get(KEY, null), want = location.hash.replace("#", "");
if (saved && saved.code && (!want || want === saved.code)) { room = saved; history.replaceState(null, "", "/live#" + saved.code); stage(); }
else setup();
})();
