/* Bible Arena Live — phone controller: join with a code, big colour buttons, instant feedback. */
(function () {
"use strict";
const L = window.BALive, { $, $$, esc, fmt, ord } = L;
const app = $("#app");
const toast = (m, ms) => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), ms || 2800); };
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
let code = "", sess = null, S = null, conn = null, scene = "", deadline = 0, shownAt = 0, myPick = null, fbShown = "", peek = null, net = "live", confettiDone = false;

function boot() {
  const m = location.pathname.match(/^\/live\/r\/(\d{6})/);
  if (m) return results(m[1]);
  const j = location.pathname.match(/^\/j\/(\d{6})/);
  const q = new URLSearchParams(location.search).get("code");
  code = (j && j[1]) || (q && q.replace(/\D/g, "").slice(0, 6)) || "";
  if (code) { sess = store.get("bal:p:" + code, null); if (sess && sess.token) return rejoin(); return profile(); }
  enterCode();
}

/* ---------- join ---------- */
function enterCode(err) {
  try { window.BAVoice && window.BAVoice.detach(); } catch (e) {}
  app.innerHTML = `<div class="center"><div class="logo">BIBLE ARENA<span>LIVE</span></div>
    <h1 style="margin-top:10px">Enter the game code</h1><p class="muted small" style="margin:0">It's on the big screen.</p>
    <input class="codein" id="code" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" maxlength="6" placeholder="••••••" value="${esc(code)}">
    <div class="err" id="err">${esc(err || "")}</div>
    <button class="btn primary" id="go">Join</button>
    <p class="foot">No app, no account. <a href="/">Play Bible Arena</a> · <a href="/live">Host a quiz night</a></p></div>`;
  const inp = $("#code");
  inp.focus();
  inp.oninput = () => { inp.value = inp.value.replace(/\D/g, "").slice(0, 6); if (inp.value.length === 6) go(); };
  const go = async () => {
    const c = inp.value; if (c.length !== 6) { $("#err").textContent = "The code has 6 digits."; return; }
    $("#go").disabled = true; $("#err").textContent = "";
    code = c; sess = store.get("bal:p:" + code, null);
    history.replaceState(null, "", "/j/" + code);
    if (sess && sess.token) return rejoin();
    profile();
  };
  $("#go").onclick = go;
  inp.onkeydown = (e) => { if (e.key === "Enter") go(); };
}

async function profile() {
  try { window.BAVoice && window.BAVoice.detach(); } catch (e) {}
  app.innerHTML = `<div class="center"><div class="mark">✦</div><div class="muted">Finding the game…</div></div>`;
  try { peek = await L.api("/lv/r/" + code + "/peek"); } catch (e) { code = ""; return enterCode(e.status === 404 ? "No game with that code. Check the screen." : e.message); }
  if (peek.phase === "final" && !peek.ko) return enterCode("That game has finished.");
  const me = store.get("bal:me", {});
  if (!me.name) { const app3 = store.get("ba3:v1", {}); if (app3 && app3.name) me.name = String(app3.name).slice(0, 18); }
  let avatar = me.avatar && peek.avatars.includes(me.avatar) ? me.avatar : peek.avatars[Math.floor(Math.random() * 12)], team = null;
  app.innerHTML = `<div class="center" style="gap:12px">
    ${peek.ko ? `<div class="tiny" style="color:var(--gold)">⚔️ Bible knockout</div><h2>${esc(peek.ko.host)} challenges you!</h2><p class="muted small" style="margin:0">${peek.n} in so far · ${peek.phase === "lobby" ? "waiting to start" : "game on: you'll watch this one and play the next"}</p>`
      : `<div class="tiny" style="color:var(--gold)">${esc(peek.church || "Bible Arena Live")}</div><h2>${esc(peek.title)}</h2>`}
    <input class="namein" id="name" maxlength="18" placeholder="Your name" value="${esc(me.name || "")}" autocomplete="nickname" enterkeyhint="go">
    <div class="avs" id="avs">${peek.avatars.map((a) => `<button data-a="${a}" class="${a === avatar ? "on" : ""}" aria-label="avatar ${a}">${a}</button>`).join("")}</div>
    ${peek.teams ? `<div class="tiny muted" style="margin-top:4px">Pick your team</div><div class="teams" id="teams">${peek.teams.map((t) => `<button data-t="${t.id}" style="--tc:${t.color}"><span class="dot"></span>${t.emoji} ${esc(t.name)}</button>`).join("")}</div>` : ""}
    <div class="err" id="err"></div>
    <button class="btn primary" id="join">I'm in! 🙌</button>
    <p class="foot">${peek.n} playing · <a href="/join" id="other">different code</a></p></div>`;
  $$("#avs button").forEach((b) => (b.onclick = () => { avatar = b.dataset.a; $$("#avs button").forEach((x) => x.classList.toggle("on", x === b)); L.buzz(8); }));
  $$("#teams button").forEach((b) => (b.onclick = () => { team = b.dataset.t; $$("#teams button").forEach((x) => x.classList.toggle("on", x === b)); L.buzz(8); }));
  $("#other").onclick = (e) => { e.preventDefault(); code = ""; history.replaceState(null, "", "/join"); enterCode(); };
  const join = async () => {
    const name = $("#name").value.trim();
    if (!name) { $("#err").textContent = peek.ko ? "Type your name so the others can see you." : "Type your name so the screen can show it."; $("#name").focus(); return; }
    if (peek.teams && !team) { $("#err").textContent = "Pick your team."; return; }
    $("#join").disabled = true; $("#err").textContent = "";
    try {
      const r = await joinReq({ name, avatar, team });
      store.set("bal:me", { name, avatar });
      sess = { token: r.token, id: r.id }; store.set("bal:p:" + code, sess);
      L.buzz([10, 40, 20]);
      live(r.state);
    } catch (e) { $("#err").textContent = e.message; $("#join").disabled = false; }
  };
  $("#join").onclick = join;
  $("#name").onkeydown = (e) => { if (e.key === "Enter") join(); };
}
async function joinReq(body) {
  let last;
  for (let i = 0; i < 4; i++) {
    try { return await L.api("/lv/r/" + code + "/join", body, { timeout: 15000 }); }
    catch (e) { last = e; if (e.status && e.status < 500) throw e; await new Promise((r) => setTimeout(r, 700 * (i + 1))); }
  }
  throw last;
}
async function rejoin() {
  app.innerHTML = `<div class="center"><div class="mark">✦</div><div class="muted">Reconnecting…</div></div>`;
  try { const r = await joinReq({ token: sess.token }); live(r.state); }
  catch (e) {
    if (e.status === 404 && /No game/.test(e.message)) { store.del("bal:p:" + code); code = ""; return enterCode("That game is no longer running."); }
    if (e.code === "kicked") { store.del("bal:p:" + code); return enterCode(e.message); }
    if (e.status && e.status < 500) { store.del("bal:p:" + code); return profile(); }
    app.innerHTML = `<div class="center"><div style="font-size:48px">📶</div><h2>Weak connection</h2><p class="muted">We'll keep your place. Tap to try again.</p><button class="btn primary" id="retry">Try again</button></div>`;
    $("#retry").onclick = rejoin;
  }
}

/* ---------- live game ---------- */
function live(first) {
  scene = ""; S = null;
  if (conn) conn.stop();
  if (first) onState(first);
  conn = L.connect("/lv/r/" + code, "t=" + encodeURIComponent(sess.token), onState, (n) => { net = n; const el = $("#net"); if (el) el.className = "net " + (n === "live" ? "" : n); },
    () => { store.del("bal:p:" + code); enterCode("That game is no longer running."); });
}
function top(s) {
  const me = s.me || {};
  const tm = s.teams && me.team ? s.teams.find((t) => t.id === me.team) : null;
  return `<div class="top"><span class="net ${net === "live" ? "" : net}" id="net"></span><span class="me"><span class="av">${me.avatar || ""}</span><span class="nm">${esc(me.name || "")}</span></span>${tm ? `<span class="tag" style="--tc:${tm.color};padding:4px 10px;font-size:13px">${tm.emoji} ${esc(tm.name)}</span>` : ""}<span class="sp"></span><span class="pts" id="pts">${fmt(me.score || 0)}</span></div>`;
}
function onState(s) {
  if (!s) return;
  if (s.me && s.me.kicked) { store.del("bal:p:" + code); conn && conn.stop(); return enterCode("The host removed you from this game."); }
  const prev = S; S = s;
  if (window.BAS) window.BAS.setBusy(s.phase !== "final");
  // v3.8.0 voice chat: group (knockout) rooms only; never lets an error reach the game
  try { if (window.BAVoice) { if (s.ko && s.me && s.me.id) window.BAVoice.attach({ code, token: sess.token, myId: s.me.id, conn }); else window.BAVoice.detach(); } } catch (e) {}
  if (typeof s.remain === "number" && s.remain > 0) deadline = performance.now() + s.remain;
  if (s.ko) return koState(s, prev);
  const key = s.phase + ":" + s.qi;
  if (key === scene) { const p = $("#pts"); if (p && s.me) p.textContent = fmt(s.me.score); if (s.phase === "lobby") lobbyUpdate(s); return; }
  scene = key;
  if (s.phase === "lobby") return lobby(s);
  if (s.phase === "intro") return intro(s);
  if (s.phase === "question") return question(s, prev);
  if (s.phase === "reveal") return reveal(s);
  if (s.phase === "board") return board(s);
  if (s.phase === "final") return final(s);
}
function lobby(s) {
  const me = s.me || {}, tm = s.teams && me.team ? s.teams.find((t) => t.id === me.team) : null;
  app.innerHTML = `${top(s)}<div class="center"><div class="bigav">${me.avatar}</div><h1>You're in!</h1>
    <p class="muted" style="margin:0">Look for <b style="color:var(--ivory)">${esc(me.name)}</b> on the big screen.</p>
    ${tm ? `<span class="tag" style="--tc:${tm.color}">${tm.emoji} Team ${esc(tm.name)}</span>` : ""}
    <div class="card" style="width:100%;margin-top:8px"><div class="tiny muted">Waiting for the host to start</div><div style="font-size:30px;font-weight:900;margin-top:6px" id="pn">${s.n}</div><div class="small muted">players so far</div></div>
    <p class="foot">Tip: keep this screen open. If your data drops, you keep your place.</p></div>`;
}
function lobbyUpdate(s) { const pn = $("#pn"); if (pn) pn.textContent = s.n; }
function intro(s) {
  myPick = null; fbShown = "";
  app.innerHTML = `${top(s)}<div class="center"><div class="tiny" style="color:var(--gold)">Question ${s.qi + 1} of ${s.qn}</div>
    <h1>Eyes on the screen 👀</h1><p class="qmini">${esc(s.q ? s.q.q : "")}</p>
    <div class="bar" style="max-width:280px"><i id="ib" style="transform:scaleX(0)"></i></div><p class="muted small">Answers coming up…</p></div>`;
  const total = Math.max(300, s.remain || 3000), t0 = performance.now();
  const step = () => { const el = $("#ib"); if (!el || !S || S.phase !== "intro") return; el.style.transform = `scaleX(${Math.min(1, (performance.now() - t0) / total)})`; requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function question(s) {
  const q = s.q || { o: [] };
  const ans = s.me && s.me.ans;
  shownAt = performance.now();
  if (ans) { myPick = ans.c; return feedback(s, ans); }
  app.innerHTML = `${top(s)}<div class="tbar" id="tb"><div class="bar"><i id="tbi"></i></div><span class="s" id="ts">${Math.ceil((s.remain || 0) / 1000)}</span></div>
    ${s.ko ? `<div class="tiny muted" style="margin:-4px 0 6px">${koRoundLabel(s)} · Question ${s.ko.rq} of ${s.ko.rlen}</div>` : ""}<p class="qtext">${esc(q.q)}</p>${s.ko && q.clues && q.clues.length ? `<div class="clues">${q.clues.map((c) => `<div>🎭 ${esc(c)}</div>`).join("")}</div>` : q.type === "who" ? `<p class="hintw">🎭 The clues are on the big screen.</p>` : ""}
    <div class="btns ${q.o.length === 2 ? "two" : ""}" id="btns">${q.o.map((o, i) => `<button class="ab" data-i="${i}" style="--oc:${L.OPT[i].c}"><span class="sh">${L.OPT[i].s}</span><span>${esc(o)}</span></button>`).join("")}</div>`;
  $$("#btns .ab").forEach((b) => (b.onclick = () => pick(+b.dataset.i, b)));
}
async function pick(i, el) {
  if (myPick !== null || !S || S.phase !== "question") return;
  myPick = i;
  const ms = Math.round(performance.now() - shownAt), qi = S.qi;
  L.buzz(25);
  el.classList.add("pick"); $("#btns").classList.add("done");
  let r = null;
  for (let k = 0; k < 5 && !r; k++) {
    try { r = await L.api("/lv/r/" + code + "/answer", { t: sess.token, qi, c: i, ms }, { timeout: 8000 }); }
    catch (e) {
      if (e.status === 409) { toast(e.message); if (e.code === "closed") break; myPick = null; return; }
      if (e.status && e.status < 500 && e.status !== 429) { toast(e.message); break; }
      await new Promise((res) => setTimeout(res, 500 * (k + 1)));
    }
  }
  if (!S || S.qi !== qi || S.phase !== "question") return;
  if (!r) { toast("Your answer didn't reach the game. Check your data."); return; }
  feedback(S, r.correct === undefined ? { c: r.c } : { c: r.c, ok: r.correct, pts: r.pts, speed: r.speed, streak: r.streakBonus, right: r.a });
  if (r.score !== undefined) { const p = $("#pts"); if (p) L.countUp(p, Math.max(0, r.score - (r.pts || 0)), r.score, 700); }
}
function feedback(s, a) {
  const q = s.q || { o: [] };
  const key = s.qi + ":" + (a.ok === undefined ? "w" : a.ok ? "y" : "n");
  if (fbShown === key) return; fbShown = key;
  const right = a.right !== undefined ? a.right : q.a;
  let inner;
  if (a.ok === undefined) inner = `<div class="fb wait"><div class="ic">🔒</div><div class="big">Locked in!</div><p class="muted">You picked <b style="color:var(--ivory)">${L.OPT[a.c] ? L.OPT[a.c].s : ""} ${esc(q.o[a.c] || "")}</b>.<br>${s.ko ? "Wait for the answer." : "Wait for the reveal on the screen."}</p></div>`;
  else if (a.ok) { inner = `<div class="fb ok"><div class="ic">✅</div><div class="big">Correct!</div><div class="pts">+${fmt(a.pts)}</div><div class="chips">${a.speed ? `<span class="chip sp">⚡ Speed bonus +${fmt(a.speed)}</span>` : ""}${a.streak ? `<span class="chip st">🔥 Streak +${fmt(a.streak)}</span>` : ""}</div></div>`; L.buzz([20, 60, 30]); }
  else { inner = `<div class="fb bad"><div class="ic">❌</div><div class="big">Not quite</div>${right !== undefined && q.o[right] ? `<p class="right">The answer: <b>${esc(q.o[right])}</b></p>` : ""}<p class="muted small">Streak reset. You'll get the next one 💪</p></div>`; L.buzz(120); }
  app.innerHTML = `${top(s)}${s.phase === "question" ? `<div class="tbar" id="tb"><div class="bar"><i id="tbi"></i></div><span class="s" id="ts"></span></div>` : ""}${inner}`;
}
function reveal(s) {
  const a = s.me && s.me.ans, q = s.q || {};
  const rk = s.ko ? (s.ko.mePos ? `<p class="muted" style="margin:0">${s.ko.final ? "Final" : "This round"}: you're <b style="color:var(--ivory)">${ord(s.ko.mePos)}</b> of ${s.ko.left}${!s.ko.final && s.ko.rq === s.ko.rlen ? "" : ""}</p>` : "")
    : s.me && s.me.rank ? `<p class="muted" style="margin:0">You're <b style="color:var(--ivory)">${ord(s.me.rank)}</b> of ${s.n}</p>` : "";
  let inner;
  if (!a) inner = `<div class="fb bad"><div class="ic">⏰</div><div class="big">Time's up</div>${q.o && q.o[q.a] ? `<p class="right">The answer: <b>${esc(q.o[q.a])}</b></p>` : ""}${rk}</div>`;
  else if (a.ok) inner = `<div class="fb ok"><div class="ic">✅</div><div class="big">Correct!</div><div class="pts">+${fmt(a.pts)}</div><div class="chips">${a.speed ? `<span class="chip sp">⚡ +${fmt(a.speed)}</span>` : ""}${a.streak ? `<span class="chip st">🔥 +${fmt(a.streak)}</span>` : ""}</div>${rk}</div>`;
  else inner = `<div class="fb bad"><div class="ic">❌</div><div class="big">Not quite</div>${q.o && q.o[q.a] ? `<p class="right">The answer: <b>${esc(q.o[q.a])}</b></p>` : ""}${rk}</div>`;
  if (fbShown === s.qi + ":" + (a && a.ok ? "y" : "n") && a) { const p = $("#tb"); if (p) p.remove(); const rkEl = document.createElement("div"); rkEl.innerHTML = rk; const fb = $(".fb"); if (fb && rk) fb.appendChild(rkEl.firstChild); return; }
  fbShown = s.qi + ":" + (a && a.ok ? "y" : "n");
  if (a && !s.instant) { a.ok ? L.buzz([20, 60, 30]) : L.buzz(120); }
  app.innerHTML = `${top(s)}${inner}`;
}
function board(s) {
  const me = s.me || {};
  const tpos = s.teams && me.team ? s.teams.findIndex((t) => t.id === me.team) : -1;
  const tm = tpos >= 0 ? s.teams[tpos] : null;
  app.innerHTML = `${top(s)}<div class="center"><div class="tiny muted">After question ${s.qi + 1}</div>
    <div class="rank">${me.rank ? ord(me.rank) : "–"}</div><div class="muted">of ${s.n} players · <b style="color:var(--ivory)">${fmt(me.score)}</b> pts</div>
    ${me.streak >= 2 ? `<span class="chip st">🔥 ${me.streak} in a row</span>` : ""}
    ${tm ? `<div class="card" style="width:100%"><div class="tiny muted">Your team</div><div style="font-size:20px;font-weight:900;margin-top:4px">${tm.emoji} ${esc(tm.name)} is ${tpos === 0 ? "winning! 🎉" : ord(tpos + 1)}</div><div class="small muted">${fmt(tm.avg)} average points per player</div></div>` : ""}
    <p class="muted small">Next question soon. Eyes on the screen.</p></div>`;
}
function final(s) {
  const me = s.me || {}, f = s.final || {};
  const medal = me.rank === 1 ? "🥇" : me.rank === 2 ? "🥈" : me.rank === 3 ? "🥉" : "🎉";
  const tw = f.teams && f.teams[0];
  const mine = f.teams && me.team ? f.teams.find((t) => t.id === me.team) : null;
  app.innerHTML = `${top(s)}<div class="center" style="gap:10px"><div class="medal">${medal}</div>
    <h1>${me.rank ? ord(me.rank) + " place" : "Thanks for playing"}</h1><div class="muted">${fmt(me.score)} pts · ${s.n} players</div>
    ${tw ? `<div class="tag" style="--tc:${tw.color}">${tw.emoji} ${esc(tw.name)} won the team battle${mine && mine.id === tw.id ? " — that's you! 🎉" : ""}</div>` : ""}
    <div class="podl">${(f.podium || []).map((p, i) => `<div>${["🥇", "🥈", "🥉"][i]} ${p.avatar} ${esc(p.name)}<b>${fmt(p.score)}</b></div>`).join("")}</div>
    <button class="btn primary" id="share" style="margin-top:6px">📲 Share my result</button>
    ${f.podium && f.podium.length > 1 ? `<a class="btn ghost" id="chw" href="/#/qm?room=${encodeURIComponent(code)}&lt=${encodeURIComponent(sess && sess.token || "")}" style="text-decoration:none;border-color:rgba(245,185,66,.6)">${me.rank === 1 ? "🏆 Winner stays on: take on all comers" : `⚔️ Challenge the winner (${esc(f.podium[0].name)})`}</a>` : ""}
    <a class="btn ghost" href="/" style="text-decoration:none">Keep playing Bible Arena</a>
    <p class="foot"><a href="/live">Host your own quiz night</a></p></div>`;
  $("#share").onclick = () => L.shareCard(f, { name: me.name, rank: me.rank, score: me.score });
  if (!confettiDone && me.rank && me.rank <= 3) { confettiDone = true; setTimeout(() => L.confetti({ count: 140 }), 300); L.buzz([30, 80, 30, 80, 60]); }
  store.del("bal:p:" + code);
}


/* ---------- knockout ("Challenge someone", v3.6.0): no big screen, everything on the phone ---------- */
let koAgainBusy = false;
function koUrl() { return location.origin + "/j/" + code; }
function koShareText(s) {
  const h = s.ko.host ? s.ko.host.name : "I";
  return `⚔️ ${h} challenges you on Bible Arena!\nLive Bible knockout: answer fast, lose a round and you're out. Last one standing wins. 📖\nTap to join: ${koUrl()}\nOr enter code ${code} in Bible Arena.`;
}
let koCdEnd = 0, koAgEnd = 0, koAloneSince = 0, koBoxKey = "";
function koClock(s) {
  const k = s.ko;
  koCdEnd = s.phase === "lobby" && k.startsIn != null ? performance.now() + k.startsIn : 0;
  koAgEnd = s.phase === "final" && k.again != null ? performance.now() + k.again : 0;
  if (s.phase === "lobby" && k.auto && (k.here || 0) < 2) koAloneSince = koAloneSince || Date.now(); else koAloneSince = 0;
}
const mmss = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); };
/** v3.7.0 lobby status: countdown, or "waiting for players" in a live game lobby (with Arena Bot / solo after a while alone) */
function koBoxState(s) {
  const k = s.ko;
  if (k.startsIn != null) return "cd" + k.here;
  if (k.auto && (k.here || 0) < 2) return koAloneSince && Date.now() - koAloneSince > 45000 ? "alone2" : "alone";
  if (k.auto) return "two";
  return "";
}
function koBoxHTML(s) {
  const k = s.ko, st = koBoxState(s);
  if (st.slice(0, 2) === "cd") return `<div class="card kocd"><div class="tiny muted">Game starts in</div><div class="kc" id="kocd">${mmss(k.startsIn)}</div><div class="small muted">${k.here} players here. Anyone can still join until it starts.</div></div>`;
  if (st === "alone" || st === "alone2") return `<div class="card kocd"><div class="tiny" style="color:#3DDC97">● Live game lobby</div><h2 style="margin:6px 0 4px">Waiting for players…</h2><div class="small muted">Everyone online gets a pop-up. It starts by itself once 3 are in (or 2 after a minute).</div>${st === "alone2" ? `<div class="small muted" style="margin-top:10px">Nobody yet? Play now and come back:</div><div class="row2" style="margin-top:8px"><a class="btn ghost" href="/#/bot">🤖 Arena Bot</a><a class="btn ghost" href="/#/play/mixed">▶ Play solo</a></div>` : ""}</div>`;
  return "";
}
function koPubHTML(s) {
  const k = s.ko;
  if (!k.isHost) return "";
  return `<div class="card kopubrow"><div class="grow" style="text-align:left"><b>Show in Live now (public)</b><div class="small muted" id="kopubtxt">${k.pub ? "Everyone online can see this game and join." : "Private: only people with your link or code can join."}</div></div><button class="kosw ${k.pub ? "on" : ""}" id="kopub" aria-label="Show in Live now"></button></div>`;
}
function koBindPub() {
  const b = $("#kopub"); if (!b) return;
  b.onclick = async () => {
    const on = !b.classList.contains("on"); b.classList.toggle("on", on); L.buzz(8);
    try { const r = await L.api("/lv/r/" + code + "/ko", { t: sess.token, action: "pub", on }); if (r && r.state) { S = r.state; koRefreshList(r.state); } toast(on ? "Listed in Live now 🟢" : "Private: link or code only 🔒"); }
    catch (e) { b.classList.toggle("on", !on); toast(e.message); }
  };
}
setInterval(() => {
  const c = $("#kocd"); if (c && koCdEnd) c.textContent = mmss(koCdEnd - performance.now());
  const g = $("#koag"); if (g && koAgEnd) g.textContent = Math.max(0, Math.ceil((koAgEnd - performance.now()) / 1000));
  if (S && S.ko && S.phase === "lobby" && koBoxKey !== koBoxState(S)) { const box = $("#kobox"); if (box) { koBoxKey = koBoxState(S); box.innerHTML = koBoxHTML(S); } }
}, 250);
function koState(s, prev) {
  koClock(s);
  const key = s.phase + ":" + s.qi + ":" + s.ko.game + (s.phase === "lobby" ? ":" + s.ko.per + ":" + (s.ko.isHost ? 1 : 0) : "");
  if (key === scene) {
    const p = $("#pts"); if (p && s.me) p.textContent = fmt(s.me.score);
    if (s.phase === "lobby" || s.phase === "final" || s.phase === "board") return koRefreshList(s);
    if (s.ko.meOut && (s.phase === "question" || s.phase === "reveal")) return koRefreshList(s);
    return;
  }
  scene = key;
  if (s.phase === "lobby") { confettiDone = false; return koLobby(s); }
  if (s.phase === "final") return koFinal(s);
  if (s.phase === "board") return koBoard(s);
  if (s.ko.meOut) return koWatch(s);
  if (s.phase === "intro") return koIntro(s);
  if (s.phase === "question") return question(s, prev);
  if (s.phase === "reveal") return reveal(s);
}
function koRoundLabel(s) { return s.ko.final ? "🏆 FINAL" : "Round " + s.ko.round; }
function koList(s, opts) {
  const o = opts || {};
  const rows = s.ko.list.filter((x) => (o.alive ? !x.out : true)).slice(0, o.limit || 60);
  return `<div class="kol">${rows.map((x, i) => `<div class="${x.me ? "me " : ""}${x.out ? "out " : ""}${x.justOut ? "just " : ""}${x.on ? "" : "off"}">
    <span class="kp">${o.lobby ? "" : x.out ? "❌" : i + 1}</span><span class="ka">${x.avatar}</span><span class="kn">${esc(x.name)}${x.host ? " 👑" : ""}${x.me ? " (you)" : ""}</span>
    <b>${o.lobby ? (x.on ? "" : "away") : x.out ? (x.out === -1 ? "watching" : s.phase === "final" && x.out === s.ko.round ? "2nd 🥈" : "out R" + x.out) : o.round ? "+" + fmt(x.rp) : fmt(x.score)}</b></div>`).join("")}</div>`;
}
function koRefreshList(s) {
  const el = $("#kolist"); if (el) el.innerHTML = koList(s, el.dataset.mode === "lobby" ? { lobby: true } : el.dataset.mode === "round" ? { round: true } : {});
  const n = $("#kon"); if (n) n.textContent = s.ko.left;
  const st = $("#kostart"); if (st) koStartBtn(s);
  const box = $("#kobox"); if (box && koBoxKey !== koBoxState(s)) { koBoxKey = koBoxState(s); box.innerHTML = koBoxHTML(s); }
  const pb = $("#kopub"); if (pb) { pb.classList.toggle("on", !!s.ko.pub); const t = $("#kopubtxt"); if (t) t.textContent = s.ko.pub ? "Everyone online can see this game and join." : "Private: only people with your link or code can join."; }
}
function koStartBtn(s) {
  const b = $("#kostart"); if (!b) return;
  const on = s.ko.list.filter((x) => x.on).length;
  b.disabled = on < 2; b.textContent = on < 2 ? "Waiting for 1 more player…" : s.ko.startsIn != null ? `▶ Start now (${on} players)` : `▶ Start (${on} players)`;
}
function koShareButtons() {
  return `<div class="row2"><a class="btn wa" id="kowa" href="https://wa.me/?text=${encodeURIComponent(koShareText(S))}" target="_blank" rel="noopener">📲 WhatsApp</a><button class="btn ghost" id="kocopy">🔗 Copy invite</button></div>`;
}
function koBindShare(s) {
  const c = $("#kocopy"); if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(koShareText(s)); toast("Link copied. Paste it anywhere 👍"); } catch (e) { toast(koUrl()); } };
  const w = $("#kowa"); if (w && navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) w.onclick = (e) => { e.preventDefault(); navigator.share({ title: "Bible Arena challenge", text: koShareText(s) }).catch(() => { location.href = "https://wa.me/?text=" + encodeURIComponent(koShareText(s)); }); };
}
async function koAction(action, btn) {
  if (btn) btn.disabled = true;
  try { const r = await L.api("/lv/r/" + code + "/ko", { t: sess.token, action }); if (r && r.state) onState(r.state); }
  catch (e) { toast(e.message); if (btn) btn.disabled = false; }
}
function koLobby(s) {
  const k = s.ko, host = k.host || {};
  app.innerHTML = `${top(s)}<div class="center" style="justify-content:flex-start;gap:12px">
    <div class="tiny" style="color:var(--gold);margin-top:6px">⚔️ Bible knockout${k.game > 1 ? " · game " + k.game : ""}</div>
    <h1>${k.auto ? "Live game lobby" : k.isHost ? "Your challenge is ready" : esc(host.name || "") + "'s challenge"}</h1>
    <div id="kobox" style="width:100%">${koBoxHTML(s)}</div>
    <div class="card kocode"><div class="tiny muted">Challenge code</div><div class="kc">${esc(code)}</div><div class="small muted">Friends tap your link, or enter this code in Bible Arena.</div></div>
    ${koShareButtons()}
    ${koPubHTML(s)}
    <div class="card" style="width:100%;text-align:left"><div class="row3"><b><span id="kon">${k.left}</span> joined</b><span class="small muted">up to ${k.max}</span></div><div id="kolist" data-mode="lobby">${koList(s, { lobby: true })}</div></div>
    ${k.isHost ? `<div class="card" style="width:100%"><div class="tiny muted">Questions per round</div><div class="perpick">${(k.choices || [5, 7, 10]).map((c) => `<button data-per="${c}" class="${c === k.per ? "on" : ""}">${c}</button>`).join("")}</div><div class="small muted" style="margin-top:6px">The final is ${k.finalLen} questions.</div></div>
      <button class="btn primary" id="kostart"></button>` : k.auto ? "" : `<div class="card" style="width:100%"><div class="tiny muted">Waiting for ${esc(host.name || "the host")} to start</div><div class="small muted" style="margin-top:6px">Keep this screen open. ${host.on === false ? `<a href="#" id="kotake">${esc(host.name || "The host")} left? Start it yourself</a>` : ""}</div></div>`}
    <div class="card small muted" style="width:100%;text-align:left">📜 <b style="color:var(--ivory)">How it works:</b> ${esc(k.rule)}</div>
    <p class="foot"><a href="/">Bible Arena home</a></p></div>`;
  koBindShare(s); koBindPub(); koBoxKey = koBoxState(s);
  const st = $("#kostart"); if (st) { koStartBtn(s); st.onclick = () => { L.buzz(15); koAction("start", st); }; }
  const tk = $("#kotake"); if (tk) tk.onclick = (e) => { e.preventDefault(); koAction("start"); };
  $$(".perpick button").forEach((b) => (b.onclick = async () => {
    L.buzz(8); $$(".perpick button").forEach((x) => x.classList.toggle("on", x === b));
    try { const r = await L.api("/lv/r/" + code + "/ko", { t: sess.token, action: "per", n: +b.dataset.per }); if (r && r.state) { S = r.state; scene = ""; koState(r.state); } } catch (e) { toast(e.message); }
  }));
}
function koIntro(s) {
  myPick = null; fbShown = "";
  const q = s.q || {};
  app.innerHTML = `${top(s)}<div class="center"><div class="tiny" style="color:var(--gold)">${koRoundLabel(s)} · Question ${s.ko.rq} of ${s.ko.rlen}</div>
    ${s.ko.rq === 1 ? `<h1>${s.ko.final ? "The final! 🔥" : s.ko.round === 1 ? "Here we go!" : "You made it through!"}</h1><p class="muted small" style="margin:0">${s.ko.left} still in${s.ko.final ? `. Most points in ${s.ko.rlen} questions wins.` : `. ${s.ko.rlen} questions, then the bottom half is out.`}</p>` : `<h1>Get ready</h1>`}
    <p class="qmini">${esc(q.q || "")}</p>${q.clues && q.clues.length ? `<div class="clues">${q.clues.map((c) => `<div>🎭 ${esc(c)}</div>`).join("")}</div>` : ""}
    <div class="bar" style="max-width:280px"><i id="ib" style="transform:scaleX(0)"></i></div></div>`;
  const total = Math.max(300, s.remain || 3000), t0 = performance.now();
  const step = () => { const el = $("#ib"); if (!el || !S || S.phase !== "intro") return; el.style.transform = `scaleX(${Math.min(1, (performance.now() - t0) / total)})`; requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function koWatch(s) {
  const q = s.q || { o: [] }, k = s.ko;
  const showAns = s.phase === "reveal";
  app.innerHTML = `${top(s)}<div class="kowatch"><div class="tiny" style="color:#FF8A9A">👀 ${k.meOut === -1 ? "You joined mid-game: watching this one" : "You're out (round " + k.meOut + "): watching"}</div>
    <div class="tiny muted" style="margin-top:6px">${koRoundLabel(s)} · Question ${k.rq} of ${k.rlen}</div>
    ${s.phase === "question" ? `<div class="tbar" id="tb"><div class="bar"><i id="tbi"></i></div><span class="s" id="ts"></span></div>` : ""}
    <p class="qtext">${esc(q.q || "")}</p>${q.clues && q.clues.length ? `<div class="clues">${q.clues.map((c) => `<div>🎭 ${esc(c)}</div>`).join("")}</div>` : ""}
    ${q.o && q.o.length ? `<div class="wopts">${q.o.map((o, i) => `<div class="${showAns && i === q.a ? "ok" : ""}">${L.OPT[i].s} ${esc(o)}${showAns && i === q.a ? " ✅" : ""}</div>`).join("")}</div>` : ""}
    <div class="card" style="text-align:left;margin-top:10px"><div class="row3"><b>Still in: <span id="kon">${k.left}</span></b><span class="small muted">points this round</span></div><div id="kolist" data-mode="round">${koList(s, { round: true })}</div></div>
    <p class="foot">You'll play again in the next challenge. Stay here!</p></div>`;
}
function koBoard(s) {
  const k = s.ko, justOut = k.meOut === k.round;
  const next = k.left <= 2 ? "the FINAL" : "round " + (k.round + 1);
  app.innerHTML = `${top(s)}<div class="center" style="justify-content:flex-start;gap:12px;padding-top:8px">
    <div class="tiny" style="color:var(--gold)">Round ${k.round} results</div>
    ${justOut ? `<div class="medal">😢</div><h1>You're out!</h1><p class="muted" style="margin:0">Good fight. Stay and watch who wins, then play the next one.</p>`
      : k.meOut ? `<div class="medal">👀</div><h1>${k.left} left</h1>`
      : `<div class="medal">🔥</div><h1>You're through to ${next}!</h1>`}
    ${k.lastOut.length ? `<div class="card" style="width:100%"><div class="tiny" style="color:#FF8A9A">Knocked out</div><div class="koout">${k.lastOut.map((x) => `<span>${x.avatar} ${esc(x.name)}</span>`).join("")}</div></div>` : ""}
    <div class="card" style="width:100%;text-align:left"><div class="row3"><b>Still in: <span id="kon">${k.left}</span></b><span class="small muted">${next} starts soon</span></div><div id="kolist" data-mode="round">${koList(s, { alive: true, round: true })}</div></div></div>`;
  if (!justOut && !k.meOut) L.buzz([20, 60, 30]); else if (justOut) L.buzz(150);
}
function koFinal(s) {
  const k = s.ko, w = k.winner || {}, me = s.me || {};
  const iWon = w.id && me.id === w.id;
  app.innerHTML = `${top(s)}<div class="center" style="justify-content:flex-start;gap:10px;padding-top:8px">
    <div class="medal">🏆</div><div class="tiny" style="color:var(--gold)">Winner</div>
    <h1 class="kowin">${w.avatar || ""} ${esc(w.name || "")}</h1>
    <p class="muted" style="margin:0">${iWon ? "That's you! Last one standing 🎉" : k.meOut > 0 && k.meOut === k.round ? "So close! You made the final and came 2nd 🥈" : k.meOut > 0 ? `You were knocked out in round ${k.meOut}. Next time!` : k.meOut === -1 ? "You'll play in the next one." : "So close! You made the final 💪"}</p>
    ${k.again != null ? `<div class="card small" style="width:100%">🔁 Next game starts in <b id="koag">${Math.ceil(k.again / 1000)}</b>s. Stay here to play!</div>` : ""}
    <div id="pushask" style="width:100%"></div>
    ${k.isHost ? `<button class="btn primary" id="koagain">🔁 Play again (everyone)</button>` : k.again != null ? "" : `<div class="card small muted" style="width:100%">Waiting for ${esc(k.host ? k.host.name : "the host")} to start the next challenge. ${k.host && k.host.on === false ? `<a href="#" id="kotake">They left? Start it yourself</a>` : ""}</div>`}
    ${koShareButtons()}
    <div class="card" style="width:100%;text-align:left"><div class="row3"><b>Final standings</b><span class="small muted">${k.list.length} players</span></div><div id="kolist" data-mode="">${koList(s)}</div></div>
    <a class="btn ghost" href="/" style="text-decoration:none">Bible Arena home</a></div>`;
  koBindShare(s);
  const a = $("#koagain"); if (a) a.onclick = () => { L.buzz(15); koAction("again", a); };
  const tk = $("#kotake"); if (tk) tk.onclick = (e) => { e.preventDefault(); koAction("again"); };
  if (!confettiDone) { confettiDone = true; setTimeout(() => L.confetti({ count: iWon ? 200 : 120 }), 300); if (iWon) L.buzz([30, 80, 30, 80, 60]); }
  koPushAsk();
}
/** v3.7.0: after the first finished game, ask once: "Get notified when people are looking for players?" */
async function koPushAsk() {
  const box = $("#pushask"); if (!box || !window.BAS) return;
  try { if (localStorage.getItem("ba3:pushask")) return; } catch (e) { return; }
  let st = "off"; try { st = await window.BAS.push.state(); } catch (e) {}
  if (st !== "off" || !$("#pushask")) return;
  try { localStorage.setItem("ba3:pushask", String(Date.now())); } catch (e) {}
  box.innerHTML = `<div class="card kopubrow"><div class="grow" style="text-align:left"><b>🔔 Get notified when people are looking for players?</b><div class="small muted">Max 3 a day, never 10 pm to 7 am.</div></div><button class="btn primary" id="pushyes" style="width:auto;padding:10px 16px">Yes</button></div>`;
  $("#pushyes").onclick = async () => {
    let r = "off"; try { r = await window.BAS.push.enable(); } catch (e) {}
    toast(r === "on" ? "Notifications on ✓" : r === "denied" ? "Notifications are blocked in your browser settings." : "Couldn't turn on notifications here.");
    box.innerHTML = "";
  };
}

/* phone countdown */
setInterval(() => {
  if (!S || S.phase !== "question") return;
  const i = $("#tbi"), sEl = $("#ts"), tb = $("#tb"); if (!i) return;
  const left = Math.max(0, deadline - performance.now());
  i.style.transform = `scaleX(${left / (S.timer * 1000)})`;
  if (sEl) sEl.textContent = Math.ceil(left / 1000);
  if (tb) tb.classList.toggle("hot", left < 5000);
}, 200);

/* ---------- shared results page (/live/r/CODE) ---------- */
async function results(c) {
  app.innerHTML = `<div class="center"><div class="mark">✦</div></div>`;
  let f;
  try { f = await L.api("/lv/results/" + c); } catch (e) { app.innerHTML = `<div class="center"><h2>Results not found</h2><p class="muted">${esc(e.message)}</p><a class="btn primary" href="/live" style="text-decoration:none">Host a quiz night</a></div>`; return; }
  const tw = f.teams && f.teams[0];
  app.innerHTML = `<div class="center" style="gap:12px"><div class="logo">BIBLE ARENA<span>LIVE</span></div>
    <div class="tiny" style="color:var(--gold)">${esc(f.church || "")}</div><h1>${esc(f.title)}</h1>
    <div class="muted small">${new Date(f.at).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · ${f.players} players · ${f.questions} questions</div>
    <div class="medal">🏆</div>
    ${tw ? `<div class="tag" style="--tc:${tw.color}">${tw.emoji} ${esc(tw.name)} won the team battle</div>` : ""}
    <div class="podl">${(f.top || f.podium || []).map((p, i) => `<div>${i < 3 ? ["🥇", "🥈", "🥉"][i] : `<span style="width:22px;text-align:center;color:var(--muted)">${p.rank || i + 1}</span>`} ${p.avatar} ${esc(p.name)}<b>${fmt(p.score)}</b></div>`).join("")}</div>
    <div class="muted small">🎯 ${f.accuracy}% answered right${f.fastest ? ` · ⚡ fastest: ${esc(f.fastest.name)} ${(f.fastest.ms / 1000).toFixed(1)} s` : ""}</div>
    <button class="btn primary" id="share">📲 Share on WhatsApp</button>
    <a class="btn ghost" href="/live" style="text-decoration:none">Host your own quiz night (free)</a></div>`;
  $("#share").onclick = () => L.shareCard(f);
}

boot();
})();
