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
  app.innerHTML = `<div class="center"><div class="mark">✦</div><div class="muted">Finding the game…</div></div>`;
  try { peek = await L.api("/lv/r/" + code + "/peek"); } catch (e) { code = ""; return enterCode(e.status === 404 ? "No game with that code. Check the screen." : e.message); }
  if (peek.phase === "final") return enterCode("That game has finished.");
  const me = store.get("bal:me", {});
  let avatar = me.avatar && peek.avatars.includes(me.avatar) ? me.avatar : peek.avatars[Math.floor(Math.random() * 12)], team = null;
  app.innerHTML = `<div class="center" style="gap:12px">
    <div class="tiny" style="color:var(--gold)">${esc(peek.church || "Bible Arena Live")}</div><h2>${esc(peek.title)}</h2>
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
    if (!name) { $("#err").textContent = "Type your name so the screen can show it."; $("#name").focus(); return; }
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
  if (typeof s.remain === "number" && s.remain > 0) deadline = performance.now() + s.remain;
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
    <p class="qtext">${esc(q.q)}</p>${q.type === "who" ? `<p class="hintw">🎭 The clues are on the big screen.</p>` : ""}
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
  if (a.ok === undefined) inner = `<div class="fb wait"><div class="ic">🔒</div><div class="big">Locked in!</div><p class="muted">You picked <b style="color:var(--ivory)">${L.OPT[a.c] ? L.OPT[a.c].s : ""} ${esc(q.o[a.c] || "")}</b>.<br>Wait for the reveal on the screen.</p></div>`;
  else if (a.ok) { inner = `<div class="fb ok"><div class="ic">✅</div><div class="big">Correct!</div><div class="pts">+${fmt(a.pts)}</div><div class="chips">${a.speed ? `<span class="chip sp">⚡ Speed bonus +${fmt(a.speed)}</span>` : ""}${a.streak ? `<span class="chip st">🔥 Streak +${fmt(a.streak)}</span>` : ""}</div></div>`; L.buzz([20, 60, 30]); }
  else { inner = `<div class="fb bad"><div class="ic">❌</div><div class="big">Not quite</div>${right !== undefined && q.o[right] ? `<p class="right">The answer: <b>${esc(q.o[right])}</b></p>` : ""}<p class="muted small">Streak reset. You'll get the next one 💪</p></div>`; L.buzz(120); }
  app.innerHTML = `${top(s)}${s.phase === "question" ? `<div class="tbar" id="tb"><div class="bar"><i id="tbi"></i></div><span class="s" id="ts"></span></div>` : ""}${inner}`;
}
function reveal(s) {
  const a = s.me && s.me.ans, q = s.q || {};
  const rk = s.me && s.me.rank ? `<p class="muted" style="margin:0">You're <b style="color:var(--ivory)">${ord(s.me.rank)}</b> of ${s.n}</p>` : "";
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
    <a class="btn ghost" href="/" style="text-decoration:none">Keep playing Bible Arena</a>
    <p class="foot"><a href="/live">Host your own quiz night</a></p></div>`;
  $("#share").onclick = () => L.shareCard(f, { name: me.name, rank: me.rank, score: me.score });
  if (!confettiDone && me.rank && me.rank <= 3) { confettiDone = true; setTimeout(() => L.confetti({ count: 140 }), 300); L.buzz([30, 80, 30, 80, 60]); }
  store.del("bal:p:" + code);
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
