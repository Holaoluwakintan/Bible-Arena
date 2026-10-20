/* Bible Arena voice chat (v3.8.0): talk to the other players in a group (knockout) game.
   WebRTC audio, phone to phone (full mesh, up to 8 in voice). The server only relays the small signaling
   messages over the game's own live stream. Mic is OFF until the player taps it; "Voice off" = no mic, no audio.
   Nothing here can block the quiz: every step is async, wrapped, and failures only show a short note. */
(function () {
"use strict";
const L = window.BALive;
const V = (window.BAVoice = {});
const PREF = "bal:voice";
const esc = L.esc;
const prefOn = () => { try { return localStorage.getItem(PREF) !== "off"; } catch (e) { return true; } };
const setPref = (on) => { try { localStorage.setItem(PREF, on ? "on" : "off"); } catch (e) {} };
const toast = (m) => { const t = document.getElementById("toast"); if (!t) return; t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 3600); };
const supported = !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

let C = null;                 // { code, token, myId, conn }
let roster = [], max = 8, inVoice = false, full = false, joining = false;
let ice = null, mic = null, micOn = false, micBusy = false, micDenied = false;
let actx = null, analyser = null, abuf = null, myLevel = 0;
let pollT = 0, levelT = 0, slowT = 0, outbox = [], sending = false, flushT = 0, needTap = false, lastHTML = "";
const peers = new Map();      // id -> peer
const mutedByMe = new Set();  // players I muted for myself
const warned = new Set();
const talkAt = new Map();     // id -> last time their level was up

/* ---------- server ---------- */
async function call(a, extra) {
  if (!C) return null;
  const c = C;
  try {
    const r = await L.api("/lv/r/" + c.code + "/vc", Object.assign({ t: c.token, a }, extra || {}), { timeout: 12000 });
    if (C !== c) return null;
    if (r && r.roster) onMsg(r.roster);
    if (r && r.box) r.box.forEach(onMsg);
    return r;
  } catch (e) {
    if (C !== c) return null;
    if (e.code === "full") { full = true; inVoice = false; if (e.roster) onMsg(e.roster); render(); }
    if (e.code === "out" && prefOn()) { inVoice = false; setTimeout(() => join(), 500); }
    throw e;
  }
}
function send(to, d) { outbox.push({ to, d }); if (!flushT) flushT = setTimeout(flush, 60); }
async function flush() {
  flushT = 0;
  if (sending || !outbox.length || !C) return;
  sending = true;
  const list = outbox.splice(0, 40);
  try { await call("sig", { list }); } catch (e) { if (!e.status || e.status >= 500) outbox.unshift(...list); }
  sending = false;
  if (outbox.length) flushT = setTimeout(flush, outbox.length ? 30 : 60);
}
async function getIce() {
  if (ice) return ice;
  try { ice = await L.api("/lv/ice", undefined, { timeout: 8000 }); } catch (e) { ice = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }], max: 8 }; }
  max = ice.max || 8;
  return ice;
}

/* ---------- messages from the server (SSE event "vc", or the mailbox) ---------- */
function onMsg(m) {
  if (!m || !C) return;
  if (m.type === "roster") return setRoster(m);
  if (m.type === "sig") return onSig(m.from, m.d).catch(() => {});
}
L.onVc = onMsg;

function setRoster(m) {
  roster = Array.isArray(m.list) ? m.list : [];
  max = m.max || max;
  const was = inVoice;
  inVoice = roster.some((x) => x.id === C.myId);
  if (inVoice) full = false;
  if (was && !inVoice && prefOn() && !joining) setTimeout(() => join(), 800); // the server dropped us (weak data): come back
  if (inVoice) {
    const ids = new Set(roster.map((x) => x.id));
    for (const id of [...peers.keys()]) if (!ids.has(id)) closePeer(id);
    for (const x of roster) if (x.id !== C.myId && !peers.has(x.id)) newPeer(x.id);
  } else for (const id of [...peers.keys()]) closePeer(id);
  render();
}

/* ---------- peers ---------- */
function opusTune(sdp) { // voice-friendly Opus: no data during silence, ~28 kbps cap (mobile data)
  const m = sdp.match(/a=rtpmap:(\d+) opus\/48000/i);
  if (!m) return sdp;
  return sdp.replace(new RegExp("a=fmtp:" + m[1] + " ([^\\r\\n]*)"), (all, p) => "a=fmtp:" + m[1] + " " + p + (/usedtx/.test(p) ? "" : ";usedtx=1") + (/maxaveragebitrate/.test(p) ? "" : ";maxaveragebitrate=28000"));
}
function newPeer(id) {
  const p = { id, pc: null, gen: 0, init: C.myId < id, state: "connecting", tries: 0, pend: [], audio: null, timer: 0, level: 0, helloT: 0 };
  const a = document.createElement("audio");
  a.autoplay = true; a.setAttribute("playsinline", ""); a.muted = mutedByMe.has(id);
  audioBox().appendChild(a); p.audio = a;
  peers.set(id, p);
  if (p.init) start(p);
  else p.helloT = setTimeout(() => { if (peers.get(id) === p && !p.pc) send(id, { k: "hello" }); }, 6000);
  return p;
}
function audioBox() { let b = document.getElementById("vaudio"); if (!b) { b = document.createElement("div"); b.id = "vaudio"; b.style.display = "none"; document.body.appendChild(b); } return b; }
function makePC(p) {
  try { p.pc && p.pc.close(); } catch (e) {}
  const pc = new RTCPeerConnection({ iceServers: ice.iceServers, bundlePolicy: "max-bundle" });
  p.pc = pc;
  const gen = p.gen;
  pc.onicecandidate = (e) => { if (e.candidate && p.pc === pc) send(p.id, { k: "ice", c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate, g: gen }); };
  pc.ontrack = (e) => { if (p.pc !== pc) return; p.audio.srcObject = (e.streams && e.streams[0]) || new MediaStream([e.track]); play(p); };
  pc.onconnectionstatechange = () => {
    if (p.pc !== pc) return;
    const st = pc.connectionState;
    if (st === "connected") { p.state = "on"; p.tries = 0; clearTimeout(p.timer); warned.delete(p.id); play(p); render(); }
    else if (st === "failed") trouble(p);
    else if (st === "disconnected") { clearTimeout(p.timer); p.timer = setTimeout(() => { if (p.pc === pc && pc.connectionState !== "connected") trouble(p); }, 6000); }
  };
  clearTimeout(p.timer);
  p.timer = setTimeout(() => { if (p.pc === pc && pc.connectionState !== "connected") trouble(p); }, 20000);
  return pc;
}
async function start(p) { // the lower id makes the offer (no glare)
  await getIce();
  if (peers.get(p.id) !== p || !C) return;
  p.gen = Date.now() % 1e9; p.pend = []; p.state = "connecting";
  const pc = makePC(p);
  const tr = pc.addTransceiver("audio", { direction: "sendrecv" });
  if (mic && micOn) tr.sender.replaceTrack(mic.getAudioTracks()[0]).catch(() => {});
  const o = await pc.createOffer();
  await pc.setLocalDescription({ type: "offer", sdp: opusTune(o.sdp) });
  send(p.id, { k: "offer", sdp: pc.localDescription.sdp, g: p.gen });
  render();
}
function trouble(p) {
  if (peers.get(p.id) !== p) return;
  clearTimeout(p.timer);
  p.tries++;
  if (p.tries > 3) {
    p.state = "fail";
    try { p.pc && p.pc.close(); } catch (e) {}
    p.pc = null;
    if (!warned.has(p.id)) { warned.add(p.id); const x = roster.find((r) => r.id === p.id); toast(`Voice couldn't connect for ${x ? x.name : "one player"}. The game continues.`); }
    render();
    return;
  }
  p.state = "connecting"; render();
  setTimeout(() => { if (peers.get(p.id) !== p) return; if (p.init) start(p).catch(() => trouble(p)); else send(p.id, { k: "hello" }); }, 1500 * p.tries);
}
async function onSig(from, d) {
  if (!inVoice || !d) return;
  let p = peers.get(from);
  if (!p) p = newPeer(from); // the server only relays from players in voice; the roster may still be on its way
  if (d.k === "hello") { if (p.init) { p.tries = Math.min(p.tries, 2); start(p).catch(() => trouble(p)); } return; }
  if (d.k === "offer" && !p.init) {
    await getIce();
    clearTimeout(p.helloT);
    p.gen = d.g; p.state = "connecting";
    const early = p.pend.filter((x) => x.g === d.g); p.pend = [];
    const pc = makePC(p);
    await pc.setRemoteDescription({ type: "offer", sdp: d.sdp });
    const tr = pc.getTransceivers()[0];
    if (tr) { tr.direction = "sendrecv"; if (mic && micOn) tr.sender.replaceTrack(mic.getAudioTracks()[0]).catch(() => {}); }
    const a = await pc.createAnswer();
    await pc.setLocalDescription({ type: "answer", sdp: opusTune(a.sdp) });
    send(from, { k: "answer", sdp: pc.localDescription.sdp, g: d.g });
    for (const x of early) pc.addIceCandidate(x.c).catch(() => {});
    render();
    return;
  }
  if (d.k === "answer" && p.init && p.pc && d.g === p.gen && p.pc.signalingState === "have-local-offer") {
    await p.pc.setRemoteDescription({ type: "answer", sdp: d.sdp });
    const q = p.pend.filter((x) => x.g === d.g); p.pend = [];
    for (const x of q) p.pc.addIceCandidate(x.c).catch(() => {});
    return;
  }
  if (d.k === "ice" && d.c) {
    if (p.pc && d.g === p.gen && p.pc.remoteDescription) p.pc.addIceCandidate(d.c).catch(() => {});
    else if (!p.pc || d.g >= p.gen || !p.init) { p.pend.push({ g: d.g, c: d.c }); if (p.pend.length > 60) p.pend.shift(); }
  }
}
function closePeer(id) {
  const p = peers.get(id); if (!p) return;
  peers.delete(id);
  clearTimeout(p.timer); clearTimeout(p.helloT);
  try { p.pc && p.pc.close(); } catch (e) {}
  try { p.audio.srcObject = null; p.audio.remove(); } catch (e) {}
}
function play(p) {
  if (!p.audio || !p.audio.srcObject) return;
  const r = p.audio.play();
  if (r && r.catch) r.catch(() => { needTap = true; render(); });
}
function unlockAudio() { if (!needTap) return; needTap = false; peers.forEach(play); render(); }

/* ---------- mic ---------- */
async function micToggle() {
  if (micBusy) return;
  if (!supported) { toast("Voice chat doesn't work in this browser. Open the game in Chrome."); return; }
  micBusy = true;
  try {
    if (!prefOn()) setPref(true);
    if (!inVoice) await join();
    if (!inVoice) return;
    if (!mic) {
      try {
        mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }, video: false });
        micDenied = false;
        meter();
      } catch (e) {
        micDenied = true; render();
        // The app's built-in viewer (phones without Chrome) sends "BibleArenaApp/x.y.z". Before app 1.3.0 it had no mic access at all;
        // from 1.3.0 it asks Android for the mic, so a refusal there is a phone setting (v3.8.1).
        const appV = (navigator.userAgent.match(/BibleArenaApp\/(\d+)\.(\d+)/) || []).slice(1).map(Number);
        const oldAppView = appV.length === 2 && (appV[0] < 1 || (appV[0] === 1 && appV[1] < 3));
        const appView = appV.length === 2 && !oldAppView;
        toast(oldAppView ? "Talking needs Chrome on this phone. You can still listen here."
          : e && e.name === "NotAllowedError" ? (appView ? "Microphone blocked. Allow it for Bible Arena in your phone settings (Apps > Bible Arena > Permissions) to talk. You can still listen." : "Microphone blocked. Allow it for this site in your browser settings to talk. You can still listen.")
          : "Couldn't start your microphone. You can still listen.");
        return;
      }
    }
    setMic(!micOn);
    if (L.buzz) L.buzz(12);
  } finally { micBusy = false; render(); }
}
function setMic(on) {
  micOn = !!on && !!mic;
  const t = mic && mic.getAudioTracks()[0];
  if (t) t.enabled = micOn;
  peers.forEach((p) => { const tr = p.pc && p.pc.getTransceivers()[0]; if (tr && tr.sender) tr.sender.replaceTrack(micOn ? t : null).catch(() => {}); });
  call("mute", { m: !micOn }).catch(() => {});
  render();
}
function meter() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC || !mic) return;
    actx = actx || new AC();
    if (actx.state === "suspended") actx.resume();
    const src = actx.createMediaStreamSource(mic);
    analyser = actx.createAnalyser(); analyser.fftSize = 512; abuf = new Uint8Array(analyser.fftSize);
    src.connect(analyser);
  } catch (e) { analyser = null; }
}
function levels() {
  if (!C || !inVoice) return;
  if (analyser && micOn) {
    analyser.getByteTimeDomainData(abuf); let s = 0;
    for (let i = 0; i < abuf.length; i++) { const v = (abuf[i] - 128) / 128; s += v * v; }
    myLevel = Math.sqrt(s / abuf.length);
  } else myLevel = 0;
  peers.forEach((p) => {
    p.level = 0;
    try { const r = p.pc && p.pc.getReceivers()[0]; const ss = r && r.getSynchronizationSources ? r.getSynchronizationSources() : []; if (ss[0] && Date.now() - ss[0].timestamp < 600) p.level = ss[0].audioLevel || 0; } catch (e) {}
  });
  const d = document.getElementById("vdock"); if (!d) return;
  const now = Date.now();
  // audioLevel is 0..1 (linear); ~0.012 ≈ -38 dBov, above the near-zero floor that noise suppression leaves
  if (myLevel > 0.02) talkAt.set(C.myId, now);
  peers.forEach((p) => { if (p.level > 0.012) talkAt.set(p.id, now); });
  d.querySelectorAll(".vchip").forEach((el) => {
    const id = el.dataset.id;
    // light stays on ~0.5 s after the last loud moment, so it glows while someone talks instead of flickering
    el.classList.toggle("talk", now - (talkAt.get(id) || 0) < 500 && !(id !== C.myId && mutedByMe.has(id)));
  });
}

/* ---------- join / leave ---------- */
async function join() {
  if (!C || joining || inVoice || !supported || !prefOn()) return;
  joining = true; render();
  try { await getIce(); await call("join"); } catch (e) { if (e.code !== "full" && C) toast("Voice couldn't connect right now. The game continues."); }
  finally { joining = false; render(); }
}
function leave(keepalive) {
  const c = C;
  for (const id of [...peers.keys()]) closePeer(id);
  if (mic) { try { mic.getTracks().forEach((t) => t.stop()); } catch (e) {} }
  mic = null; micOn = false; analyser = null;
  if (actx) { try { actx.close(); } catch (e) {} actx = null; }
  outbox = []; clearTimeout(flushT); flushT = 0;
  if (c && inVoice) {
    try { fetch("/lv/r/" + c.code + "/vc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: c.token, a: "leave" }), keepalive: !!keepalive }).catch(() => {}); } catch (e) {}
  }
  inVoice = false; full = false;
}
function voiceOff() { leave(); setPref(false); render(); toast("Voice is off. No mic, no sound. Tap Voice to turn it back on."); }
function voiceOn() { setPref(true); render(); join(); }

/* ---------- the dock (fixed at the bottom; the quiz screens redraw under it) ---------- */
function chip(x, me) {
  const p = peers.get(x.id) || {};
  const mineMuted = !me && mutedByMe.has(x.id);
  const st = me ? "" : p.state === "fail" ? "fail" : p.state === "on" ? "" : "wait";
  // badge: 🔇 muted for me · ⚠️ couldn't connect · … connecting · 🎙️ their mic is on
  const badge = mineMuted ? "🔇" : st === "fail" ? "⚠️" : st === "wait" ? "…" : !x.muted ? "🎙️" : "";
  return `<button class="vchip ${mineMuted ? "mute " : ""}${st}${x.muted ? " micoff" : ""}" data-id="${esc(x.id)}" aria-label="${esc(x.name)}${me ? " (you)" : mineMuted ? ", muted for you. Tap to unmute" : ". Tap to mute for you"}">
    <span class="va">${esc(x.avatar || "🙂")}</span>${badge ? `<span class="vb">${badge}</span>` : ""}<span class="vn">${me ? "You" : esc(x.name)}</span></button>`;
}
function render() {
  let d = document.getElementById("vdock");
  if (!C) { if (d) d.remove(); document.body.classList.remove("vd-on"); lastHTML = ""; return; }
  if (!d) { d = document.createElement("div"); d.id = "vdock"; d.setAttribute("role", "region"); d.setAttribute("aria-label", "Voice chat"); document.body.appendChild(d); bindDock(d); }
  document.body.classList.add("vd-on");
  let h;
  const others = roster.filter((x) => x.id !== C.myId);
  if (!supported) h = `<div class="vmsg">🔇 Voice chat needs Chrome on this phone.</div>`;
  else if (!prefOn()) h = `<button class="vpill" data-v="on">🔈 Voice off · <b>turn on</b></button>${roster.length ? `<span class="vmsg">${roster.length} in voice</span>` : ""}`;
  else {
    const mcls = micDenied ? "denied" : micOn ? "on" : "";
    const mtxt = micDenied ? "Mic blocked" : micOn ? "Mic on" : joining ? "Joining…" : "Tap to talk";
    const meX = roster.find((x) => x.id === C.myId);
    h = `<button id="vmic" class="vmic ${mcls}" aria-pressed="${micOn}" aria-label="${micOn ? "Mute your mic" : "Unmute your mic"}"><span class="vi">${micDenied ? "🚫" : micOn ? "🎙️" : "🎤"}</span><span class="vt">${mtxt}</span></button>
      <div class="vchips">${full && !inVoice ? `<span class="vmsg">Voice is full (${max}). You can still play.</span>`
        : !inVoice ? `<span class="vmsg">${joining ? "Connecting voice…" : "Voice not connected"}</span>`
        : (meX ? chip(meX, true) : "") + (others.length ? others.map((x) => chip(x, false)).join("") : `<span class="vmsg">No one else in voice yet</span>`)}</div>
      ${needTap ? `<button class="vpill tap" data-v="tap">🔊 Tap to hear</button>` : ""}
      <button class="vx" data-v="off" aria-label="Turn voice chat off">🔊<span>Voice</span></button>`;
  }
  if (h !== lastHTML) { d.innerHTML = h; lastHTML = h; levels(); }
}
function bindDock(d) {
  d.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    unlockAudio();
    if (b.id === "vmic") return micToggle();
    const v = b.dataset.v;
    if (v === "on") return voiceOn();
    if (v === "off") return voiceOff();
    if (v === "tap") return;
    const id = b.dataset.id;
    if (id && C && id !== C.myId) {
      const p = peers.get(id);
      if (p && p.state === "fail") { p.tries = 0; p.state = "connecting"; warned.delete(id); if (p.init) start(p).catch(() => trouble(p)); else send(id, { k: "hello" }); render(); return; }
      const x = roster.find((r) => r.id === id);
      if (mutedByMe.has(id)) { mutedByMe.delete(id); toast(`${x ? x.name : "Player"} unmuted`); } else { mutedByMe.add(id); toast(`${x ? x.name : "Player"} muted for you`); }
      if (p && p.audio) p.audio.muted = mutedByMe.has(id);
      render();
    } else if (id && C && id === C.myId) micToggle();
  });
}

/* ---------- public ---------- */
/** Called on every knockout-room state; cheap and idempotent. */
V.attach = function (o) {
  if (!o || !o.code || !o.token || !o.myId) return;
  if (C && (C.code !== o.code || C.token !== o.token)) V.detach();
  if (C) { C.conn = o.conn; return; }
  C = { code: o.code, token: o.token, myId: o.myId, conn: o.conn };
  roster = []; needTap = false; micDenied = false;
  render();
  clearInterval(levelT); levelT = setInterval(levels, 200);
  // long-poll fallback: when the live stream is not SSE, fetch voice messages every 1.5 s; a slow safety net otherwise
  clearInterval(pollT); pollT = setInterval(() => { if (C && inVoice && C.conn && C.conn.mode !== "sse") poll(); }, 1500);
  clearInterval(slowT); slowT = setInterval(() => { if (C) poll(); }, 15000);
  if (prefOn() && supported) join(); else poll();
};
let polling = false;
async function poll() {
  if (!C || polling) return; polling = true;
  const c = C;
  try { const r = await L.api("/lv/r/" + c.code + "/vc?t=" + encodeURIComponent(c.token), undefined, { timeout: 10000 }); if (C === c && r) { if (r.roster) onMsg(r.roster); (r.box || []).forEach(onMsg); } } catch (e) {}
  polling = false;
}
/** Leave voice and remove every connection (left the room, room ended, other room, page closed). */
V.detach = function (keepalive) {
  if (!C) return;
  leave(keepalive);
  clearInterval(levelT); clearInterval(pollT); clearInterval(slowT);
  C = null; roster = [];
  render();
};
V.state = () => ({ on: !!C, pref: prefOn(), inVoice, micOn, micDenied, roster: roster.map((x) => x.id), peers: [...peers.values()].map((p) => ({ id: p.id, state: p.state, pc: p.pc ? p.pc.connectionState : "none", mutedByMe: mutedByMe.has(p.id) })) });
/** For tests / diagnostics: inbound and outbound audio bytes per peer. */
V.stats = async () => {
  const out = [];
  for (const p of peers.values()) {
    const r = { id: p.id, pc: p.pc ? p.pc.connectionState : "none", in: 0, out: 0, pin: 0, relay: false };
    if (p.pc) try { (await p.pc.getStats()).forEach((s) => {
      if (s.type === "inbound-rtp" && s.kind === "audio") { r.in += s.bytesReceived || 0; r.pin += s.packetsReceived || 0; }
      if (s.type === "outbound-rtp" && s.kind === "audio") r.out += s.bytesSent || 0;
      if (s.type === "candidate-pair" && s.nominated && s.state === "succeeded") r.pair = s.localCandidateId;
      if (s.type === "local-candidate" && s.candidateType === "relay") r.relay = true;
    }); } catch (e) {}
    out.push(r);
  }
  return out;
};
window.addEventListener("pagehide", () => V.detach(true));
document.addEventListener("click", unlockAudio, true);
})();
