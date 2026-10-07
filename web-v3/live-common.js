/* Bible Arena Live — shared client bits: live transport (SSE → long-poll fallback), sound, confetti, share card. */
(function () {
"use strict";
const L = (window.BALive = {});
L.$ = (s, el) => (el || document).querySelector(s);
L.$$ = (s, el) => Array.from((el || document).querySelectorAll(s));
L.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
L.fmt = (n) => Number(n || 0).toLocaleString("en-US");
L.ord = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
L.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
L.OPT = [
  { c: "#E5394F", s: "▲", n: "red" }, { c: "#2E7CF6", s: "◆", n: "blue" },
  { c: "#E8A317", s: "●", n: "gold" }, { c: "#1FA971", s: "■", n: "green" },
];

L.api = async function (url, body, opts) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), (opts && opts.timeout) || 12000);
  try {
    const r = await fetch(url, body === undefined ? { signal: ctl.signal, cache: "no-store" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error((j && j.error) || "Network problem. Try again."); err.status = r.status; err.code = j && j.code; throw err; }
    return j;
  } finally { clearTimeout(t); }
};

/* Live state: SSE first; after repeated errors (or a silent stream) fall back to long-polling,
   and keep trying SSE again every minute. onState gets every snapshot; onNet gets "live"|"poll"|"down". */
L.connect = function (base, qs, onState, onNet, onGone) {
  let es = null, mode = "sse", v = -1, errors = 0, lastMsg = Date.now(), stopped = false, pollBusy = false, backoff = 1000, sseRetryAt = 0;
  const handle = (s) => { if (!s || typeof s !== "object") return; lastMsg = Date.now(); if (typeof s.v === "number") v = s.v; onState(s); };
  function openSSE() {
    if (stopped || !window.EventSource) { mode = "poll"; return poll(); }
    try { es && es.close(); } catch (e) {}
    es = new EventSource(base + "/sse?" + qs);
    es.onmessage = (e) => { errors = 0; backoff = 1000; onNet("live"); try { handle(JSON.parse(e.data)); } catch (x) {} };
    es.onopen = () => { lastMsg = Date.now(); onNet("live"); };
    es.onerror = () => {
      errors++;
      onNet(errors > 1 ? "down" : "live");
      if (es && es.readyState === 2) { // closed for good (e.g. 404): check why
        fetch(base + "/poll?" + qs + "&v=-1", { cache: "no-store" }).then((r) => { if (r.status === 404 || r.status === 403) { stopped = true; onGone && onGone(r.status); } else toPoll(); }).catch(toPoll);
        return;
      }
      if (errors >= 3) toPoll();
    };
  }
  function toPoll() { if (stopped || mode === "poll") return; mode = "poll"; try { es && es.close(); } catch (e) {} es = null; sseRetryAt = Date.now() + 60000; onNet("poll"); poll(); }
  async function poll() {
    if (stopped || pollBusy || mode !== "poll") return;
    pollBusy = true;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 26000);
      const r = await fetch(base + "/poll?" + qs + "&v=" + v, { cache: "no-store", signal: ctl.signal });
      clearTimeout(t);
      if (r.status === 404 || r.status === 403) { stopped = true; onGone && onGone(r.status); return; }
      if (!r.ok) throw new Error("http " + r.status);
      handle(await r.json()); backoff = 1000; onNet("poll");
    } catch (e) { onNet("down"); await new Promise((res) => setTimeout(res, backoff)); backoff = Math.min(8000, backoff * 2); }
    finally { pollBusy = false; }
    if (!stopped && mode === "poll") {
      if (Date.now() > sseRetryAt && window.EventSource) { mode = "sse"; errors = 0; openSSE(); } else poll();
    }
  }
  // a stream that goes silent (proxy hiccup, phone slept) is reopened
  const watchdog = setInterval(() => { if (!stopped && mode === "sse" && Date.now() - lastMsg > 40000) { errors = 0; openSSE(); } }, 5000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !stopped) { if (mode === "sse") { errors = 0; openSSE(); } else poll(); } });
  window.addEventListener("online", () => { if (!stopped) { mode = "sse"; errors = 0; openSSE(); } });
  if (/[?&]poll=1/.test(location.search)) { mode = "poll"; poll(); } else openSSE();
  return { stop() { stopped = true; clearInterval(watchdog); try { es && es.close(); } catch (e) {} }, get mode() { return mode; }, refresh() { if (mode === "poll") poll(); else { errors = 0; openSSE(); } } };
};

/* ---------- sound: synthesised with WebAudio, no files to download ---------- */
const snd = (L.snd = { on: true, ctx: null, master: null, loop: null });
snd.init = function () {
  if (snd.ctx) { if (snd.ctx.state === "suspended") snd.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  snd.ctx = new AC(); snd.master = snd.ctx.createGain(); snd.master.gain.value = snd.on ? 0.55 : 0; snd.master.connect(snd.ctx.destination);
};
snd.setOn = function (on) { snd.on = on; if (snd.master) snd.master.gain.setTargetAtTime(on ? 0.55 : 0, snd.ctx.currentTime, 0.05); };
function tone(f, t0, dur, type, vol, glide) {
  const c = snd.ctx; if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || "sine"; o.frequency.setValueAtTime(f, t0); if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(snd.master); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(t0, dur, vol, freq) {
  const c = snd.ctx; if (!c) return;
  const b = c.createBuffer(1, Math.max(1, c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = b; f.type = "bandpass"; f.frequency.value = freq || 1200; f.Q.value = 0.8;
  g.gain.setValueAtTime(vol || 0.2, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(snd.master); s.start(t0);
}
const now = () => (snd.ctx ? snd.ctx.currentTime : 0);
snd.pop = () => { const t = now(); tone(520 + Math.random() * 240, t, 0.12, "sine", 0.18, 900); };
snd.tick = (hi) => { const t = now(); tone(hi ? 1320 : 880, t, 0.05, "square", 0.06); };
snd.whoosh = () => { const t = now(); noise(t, 0.5, 0.18, 900); tone(220, t, 0.5, "sine", 0.1, 660); };
snd.reveal = () => { const t = now(); [523.25, 659.25, 783.99].forEach((f, i) => tone(f, t + i * 0.07, 0.6, "triangle", 0.16)); noise(t, 0.25, 0.12, 3000); };
snd.correct = () => { const t = now(); tone(880, t, 0.12, "sine", 0.2); tone(1318.5, t + 0.1, 0.3, "sine", 0.2); };
snd.wrong = () => { const t = now(); tone(180, t, 0.35, "sawtooth", 0.08, 120); };
snd.timeup = () => { const t = now(); tone(392, t, 0.25, "square", 0.1); tone(262, t + 0.22, 0.45, "square", 0.1); };
snd.swoosh = () => { const t = now(); noise(t, 0.35, 0.14, 1800); };
snd.drumroll = (secs) => { const t = now(); const n = Math.floor(secs * 18); for (let i = 0; i < n; i++) noise(t + i / 18, 0.08, 0.05 + 0.12 * (i / n), 300 + 200 * (i / n)); };
snd.fanfare = () => {
  const t = now(); const seq = [[523.25, 0], [659.25, 0.14], [783.99, 0.28], [1046.5, 0.42], [783.99, 0.62], [1046.5, 0.76]];
  seq.forEach(([f, d]) => { tone(f, t + d, 0.5, "sawtooth", 0.07); tone(f / 2, t + d, 0.5, "triangle", 0.08); });
  [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, t + 0.95, 1.6, "triangle", 0.09));
  noise(t + 0.95, 1.2, 0.08, 6000);
};
/* soft lobby music: a slow arpeggio over a pad (stops when the game starts) */
snd.startLoop = function () {
  if (snd.loop || !snd.ctx) return;
  const prog = [[261.63, 329.63, 392], [220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]];
  let bar = 0;
  const play = () => {
    const ch = prog[bar++ % prog.length], t = now() + 0.05;
    ch.forEach((f) => tone(f / 2, t, 2.3, "sine", 0.035));
    [0, 1, 2, 1, 0, 1, 2, 1].forEach((k, i) => tone(ch[k] * 2, t + i * 0.28, 0.35, "triangle", 0.03));
  };
  play(); snd.loop = setInterval(play, 2250);
};
snd.stopLoop = () => { if (snd.loop) { clearInterval(snd.loop); snd.loop = null; } };
L.buzz = (p) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

/* ---------- confetti ---------- */
L.confetti = function (opts) {
  if (L.reduced) return;
  const o = opts || {};
  const cv = document.createElement("canvas"); cv.className = "confetti";
  document.body.appendChild(cv);
  const ctx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = (cv.width = innerWidth * dpr), H = (cv.height = innerHeight * dpr);
  const colors = o.colors || ["#F5B942", "#FFD98A", "#F6F1E7", "#FF5D73", "#5AB8FF", "#3DDC97", "#9B8CFF"];
  const N = o.count || 220, parts = [];
  for (let i = 0; i < N; i++) {
    const fromLeft = i % 2 === 0;
    parts.push({ x: fromLeft ? -20 : W + 20, y: H * (0.55 + Math.random() * 0.35), vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 11) * dpr, vy: -(10 + Math.random() * 14) * dpr,
      w: (6 + Math.random() * 8) * dpr, h: (8 + Math.random() * 12) * dpr, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, c: colors[i % colors.length], d: Math.random() * 30 });
  }
  const t0 = performance.now(), life = o.ms || 6500;
  (function frame(t) {
    const el = t - t0; ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      if (p.d > 0) { p.d--; continue; }
      p.vy += 0.32 * dpr; p.vx *= 0.99; p.vy *= 0.995; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.max(0, 1 - el / life);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); ctx.restore();
    }
    if (el < life) requestAnimationFrame(frame); else cv.remove();
  })(t0);
};

/* count-up for scores */
L.countUp = function (el, from, to, ms) {
  if (L.reduced || from === to) { el.textContent = L.fmt(to); return; }
  const t0 = performance.now(), d = ms || 900;
  (function f(t) { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = L.fmt(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(f); })(t0);
};

/* ---------- share card (canvas) ---------- */
function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function fit(ctx, text, max, size, weight, family) { let s = size; do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > max && s > 12); return s + 2; }
/* s: results summary; w,h: size; me: optional {name, rank, score} for a player's own card */
L.drawCard = async function (s, w, h, me) {
  try { await document.fonts.ready; } catch (e) {}
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const c = cv.getContext("2d"), U = Math.min(w, h) / 100, serif = "Cinzel, Georgia, serif", sans = "'Plus Jakarta Sans', system-ui, sans-serif";
  const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, "#111B3D"); bg.addColorStop(1, "#060A16"); c.fillStyle = bg; c.fillRect(0, 0, w, h);
  // spotlights
  [[0.2, -0.1, "rgba(245,185,66,.22)"], [0.8, -0.1, "rgba(90,184,255,.16)"], [0.5, 1.1, "rgba(201,138,27,.20)"]].forEach(([x, y, col]) => {
    const g = c.createRadialGradient(w * x, h * y, 0, w * x, h * y, Math.max(w, h) * 0.7); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  c.fillStyle = "rgba(255,255,255,.5)"; for (let i = 0; i < 70; i++) { const x = (i * 97.3) % w, y = (i * 53.7 * 1.7) % (h * 0.6); c.fillRect(x, y, 1.6, 1.6); }
  c.strokeStyle = "rgba(245,185,66,.35)"; c.lineWidth = U * 0.35; rr(c, U * 3, U * 3, w - U * 6, h - U * 6, U * 3); c.stroke();
  c.textAlign = "center"; c.textBaseline = "alphabetic";
  const wide = w / h > 1.4;
  c.fillStyle = "#F5B942"; c.font = `800 ${U * 3.2}px ${sans}`; c.fillText("✦  BIBLE ARENA LIVE  ✦", w / 2, U * (wide ? 11 : 10));
  const title = s.title || "Bible Quiz Night";
  const ts = fit(c, title, w - U * 14, U * (wide ? 7.5 : 7.2), 800, serif);
  const gold = c.createLinearGradient(0, U * 12, 0, U * 22); gold.addColorStop(0, "#FFE7AE"); gold.addColorStop(0.6, "#F5B942"); gold.addColorStop(1, "#C98A1B");
  c.fillStyle = gold; c.font = `800 ${ts}px ${serif}`; c.fillText(title, w / 2, U * (wide ? 21 : 20));
  if (s.church) { c.fillStyle = "#C9D2EA"; c.font = `600 ${U * 3.4}px ${sans}`; c.fillText(s.church, w / 2, U * (wide ? 27 : 26)); }
  // podium
  const pod = s.podium || [];
  const baseY = wide ? h - U * 17 : h * 0.66, colW = wide ? U * 30 : U * 27;
  const order = [1, 0, 2], heights = [U * (wide ? 20 : 22), U * (wide ? 14 : 16), U * (wide ? 10 : 12)], medals = ["🥇", "🥈", "🥉"], cols = ["#F5B942", "#C9D2EA", "#E08A4B"];
  order.forEach((idx, k) => {
    const p = pod[idx]; if (!p) return;
    const x = w / 2 + (k - 1) * (colW + U * 2), top = baseY - heights[idx];
    const g = c.createLinearGradient(0, top, 0, baseY); g.addColorStop(0, cols[idx]); g.addColorStop(1, "rgba(255,255,255,.04)");
    c.fillStyle = g; c.globalAlpha = 0.9; rr(c, x - colW / 2, top, colW, heights[idx], U * 1.6); c.fill(); c.globalAlpha = 1;
    c.fillStyle = "#0A1124"; c.font = `800 ${U * 5}px ${serif}`; c.fillText(String(idx + 1), x, top + U * 6.5);
    c.font = `${U * 6}px ${sans}`; c.fillText(p.avatar || medals[idx], x, top - U * 9.5);
    c.fillStyle = "#F6F1E7"; const ns = fit(c, p.name, colW - U, U * 3.6, 800, sans); c.font = `800 ${ns}px ${sans}`; c.fillText(p.name, x, top - U * 4.8);
    c.fillStyle = cols[idx]; c.font = `700 ${U * 2.6}px ${sans}`; c.fillText(L.fmt(p.score) + " pts", x, top - U * 1.6);
  });
  // footer line
  const bits = [];
  if (s.teams && s.teams.length) bits.push(`${s.teams[0].emoji} ${s.teams[0].name} won the team battle`);
  bits.push(`${s.players} players · ${s.questions} questions · ${s.accuracy}% right`);
  c.fillStyle = "#F6F1E7"; c.font = `700 ${U * 3}px ${sans}`;
  if (me) { c.fillStyle = "#FFD98A"; c.font = `800 ${U * 3.6}px ${sans}`; c.fillText(`${me.name}: ${L.ord(me.rank)} place · ${L.fmt(me.score)} pts`, w / 2, baseY + U * (wide ? 6 : 8)); }
  else c.fillText(bits[0], w / 2, baseY + U * (wide ? 6 : 8));
  c.fillStyle = "#9AA6C2"; c.font = `600 ${U * 2.5}px ${sans}`; c.fillText(me ? bits[0] : (bits[1] || ""), w / 2, baseY + U * (wide ? 10.5 : 13));
  if (!wide) { c.fillStyle = "#9AA6C2"; c.fillText(me ? (bits[1] || "") : "", w / 2, baseY + U * 17); }
  c.fillStyle = "#F5B942"; c.font = `700 ${U * 2.4}px ${sans}`; c.fillText("Host your own quiz night free · bible-arena.onrender.com/live", w / 2, h - U * 6);
  return cv;
};
L.shareCard = async function (s, me) {
  const url = location.origin + "/live/r/" + s.code;
  const text = me ? `I came ${L.ord(me.rank)} at ${s.title}${s.church ? " (" + s.church + ")" : ""} on Bible Arena Live! 🏆 ${url}`
    : `🏆 ${s.title}${s.church ? " · " + s.church : ""}: the winners!\n${(s.podium || []).map((p, i) => ["🥇", "🥈", "🥉"][i] + " " + p.name + " (" + L.fmt(p.score) + ")").join("\n")}${s.teams && s.teams.length ? "\n" + s.teams[0].emoji + " " + s.teams[0].name + " won the team battle" : ""}\n\nSee the results: ${url}`;
  const cv = await L.drawCard(s, 1080, 1080, me);
  const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
  const file = blob && new File([blob], "bible-arena-live-results.png", { type: "image/png" });
  try {
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text, title: s.title }); return "shared"; }
  } catch (e) { if (e && e.name === "AbortError") return "cancelled"; }
  // desktop / older phones: save the picture, open WhatsApp with the text
  if (blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "bible-arena-live-results.png"; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank");
  return "fallback";
};
})();
