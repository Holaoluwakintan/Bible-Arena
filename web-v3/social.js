/* Bible Arena social client (v3.5.0): presence heartbeat ("🟢 N online now"), the Live now list, challenge pop-ups and
 * Web Push opt-in. Shared by the app (/) and the Live phone page (/join). Heartbeats only while the page is open, visible
 * and in use (no taps for 5 minutes = not online), so idle tabs never keep the free server awake.
 */
(function () {
  if (window.BAS) return;
  var LSP = "ba3:pid", LSO = "ba3:social";
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var pid = lsGet(LSP, "");
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(pid || "")) { pid = "p" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); lsSet(LSP, pid); }
  var cfg = Object.assign({ mute: false }, lsGet(LSO, {}) || {});
  var st = { online: null, liveCount: 0, live: null, busy: false, wantLive: false, pushKey: undefined };
  var subs = [];
  var lastAct = Date.now(), timer = null, inflight = false, lastHb = 0;
  ["pointerdown", "keydown", "touchstart", "scroll"].forEach(function (ev) { addEventListener(ev, function () { var idle = Date.now() - lastAct > 5 * 60e3; lastAct = Date.now(); if (idle) hb(true); }, { passive: true }); });
  function emit() { subs.slice().forEach(function (f) { try { f(st); } catch (e) {} }); }
  function post(path, body) {
    return fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "x-client-platform": "web" }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) { var e = new Error(d.error || "http_" + r.status); e.status = r.status; e.data = d; throw e; } return d; }); });
  }
  function hb(force) {
    if (document.hidden || inflight) return;
    if (!force && Date.now() - lastAct > 5 * 60e3) return;
    if (!force && Date.now() - lastHb < 4000) return;
    inflight = true; lastHb = Date.now();
    var busy = st.busy || !!(window.BA_BUSY && window.BA_BUSY());
    post("/api/v3/social/hb", { pid: pid, busy: busy, mute: !!cfg.mute, live: st.wantLive, wantKey: st.pushKey === undefined })
      .then(function (d) {
        st.online = d.online; st.liveCount = d.liveCount || 0; if (d.live) st.live = d.live; if (d.pushKey !== undefined) st.pushKey = d.pushKey;
        emit();
        if (d.invite) popup(d.invite);
      }).catch(function () {}).then(function () { inflight = false; });
  }
  function schedule() { clearInterval(timer); timer = setInterval(function () { hb(false); }, 25000); }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) hb(true); });
  setTimeout(function () { hb(true); }, 1200);
  schedule();

  // ---------- pop-up ----------
  var css = ".bas-pop{position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:9999;max-width:460px;margin:0 auto;background:linear-gradient(160deg,#1b2650,#0f1734);border:1px solid rgba(245,185,66,.55);border-radius:18px;padding:14px;box-shadow:0 18px 50px rgba(0,0,0,.55);color:#F4EFE3;font-family:'Plus Jakarta Sans',-apple-system,Segoe UI,Roboto,sans-serif;transform:translateY(140%);transition:transform .35s cubic-bezier(.2,.9,.3,1.2)}" +
    ".bas-pop.in{transform:none}.bas-pop .r{display:flex;gap:12px;align-items:center}.bas-pop .av{width:44px;height:44px;border-radius:14px;background:#F5B942;color:#1a1200;display:grid;place-items:center;font-weight:900;font-size:20px;flex:none}" +
    ".bas-pop .t{font-size:15px;line-height:1.35}.bas-pop .s{font-size:12.5px;color:#aab3c8;margin-top:2px}.bas-pop .b{display:flex;gap:8px;margin-top:12px}.bas-pop button{flex:1;border:0;border-radius:12px;min-height:44px;font-weight:800;font-size:15px;font-family:inherit;cursor:pointer}" +
    ".bas-pop .y{background:linear-gradient(180deg,#FFD36B,#F5B942);color:#1a1200}.bas-pop .n{background:rgba(255,255,255,.08);color:#F4EFE3}.bas-pop .m{flex:none;background:none;color:#8e97ad;font-size:12.5px;font-weight:600;min-height:0;padding:6px 0 0}" +
    ".bas-pop .live{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.08em;color:#3DDC97}";
  var TN = { b: "Believer", s: "Scholar", t: "Theologian" }, MN = { mixed: "Mixed Arena", arena: "Arena Quiz", gap: "Fill in the Gap", who: "Who Am I", myth: "Bible or Myth" };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var popEl = null, popT = null;
  function closePop() { if (!popEl) return; var el = popEl; popEl = null; clearTimeout(popT); el.classList.remove("in"); setTimeout(function () { el.remove(); }, 400); }
  function popup(inv) {
    if (cfg.mute) return;
    if (!document.getElementById("bas-css")) { var s = document.createElement("style"); s.id = "bas-css"; s.textContent = css; document.head.appendChild(s); }
    closePop();
    var el = document.createElement("div"); el.className = "bas-pop"; el.setAttribute("role", "alertdialog");
    var who = esc(inv.name || "Someone");
    var text = esc(inv.text || (inv.name + " is waiting for a challenger")).replace(who, "<b>" + who + "</b>");
    el.innerHTML = '<div class="r"><div class="av">' + esc((inv.name || "?")[0].toUpperCase()) + '</div><div style="flex:1"><div class="live">● LIVE NOW</div><div class="t">' + text + '</div><div class="s">' + esc(TN[inv.tier] || "") + " · " + esc(MN[inv.mode] || "Duel") + ' · same questions, live scores</div></div></div>' +
      '<div class="b"><button class="n" data-x>Not now</button><button class="y" data-j>Join ⚔️</button></div><button class="m" data-m>🔕 Mute these pop-ups</button>';
    document.body.appendChild(el); popEl = el;
    requestAnimationFrame(function () { el.classList.add("in"); });
    try { if (navigator.vibrate) navigator.vibrate([20, 40, 20]); } catch (e) {}
    el.querySelector("[data-x]").onclick = closePop;
    el.querySelector("[data-m]").onclick = function () { api.mute(true); closePop(); if (api.toast) api.toast("Pop-ups muted. Turn them back on in Me → Settings."); };
    el.querySelector("[data-j]").onclick = function () { closePop(); api.onJoin(inv); };
    popT = setTimeout(closePop, 25000);
  }

  // ---------- Web Push ----------
  function b64ToBytes(b) { var p = "=".repeat((4 - (b.length % 4)) % 4); var raw = atob((b + p).replace(/-/g, "+").replace(/_/g, "/")); var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out; }
  var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  function supported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
  function reg() { return navigator.serviceWorker.getRegistration("/").then(function (r) { return r || navigator.serviceWorker.register("/sw.js"); }).then(function () { return navigator.serviceWorker.ready; }); }
  function key() { if (st.pushKey) return Promise.resolve(st.pushKey); return fetch("/api/v3/push/key", { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (d) { st.pushKey = d.key || null; return st.pushKey; }); }
  var push = {
    /** "unsupported" | "ios-install" | "denied" | "on" | "off" | "unavailable" */
    state: function () {
      if (!supported()) return Promise.resolve(isIOS && !standalone ? "ios-install" : "unsupported");
      if (Notification.permission === "denied") return Promise.resolve("denied");
      return key().then(function (k) {
        if (!k) return "unavailable";
        return reg().then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) { return s && Notification.permission === "granted" ? "on" : "off"; });
      }).catch(function () { return "off"; });
    },
    /** Must be called from a tap (the browser asks for permission). */
    enable: function () {
      if (!supported()) return Promise.resolve(isIOS && !standalone ? "ios-install" : "unsupported");
      return Promise.resolve(Notification.requestPermission()).then(function (p) {
        if (p !== "granted") return p === "denied" ? "denied" : "off";
        return key().then(function (k) {
          if (!k) return "unavailable";
          return reg().then(function (r) { return r.pushManager.getSubscription().then(function (s) { return s || r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(k) }); }); })
            .then(function (s) { return post("/api/v3/push/subscribe", { sub: s.toJSON() }); }).then(function () { return "on"; });
        });
      });
    },
    disable: function () {
      if (!supported()) return Promise.resolve("off");
      return reg().then(function (r) { return r.pushManager.getSubscription(); }).then(function (s) {
        if (!s) return "off";
        var ep = s.endpoint; return s.unsubscribe().catch(function () {}).then(function () { return post("/api/v3/push/unsubscribe", { endpoint: ep }).catch(function () {}); }).then(function () { return "off"; });
      });
    },
    test: function () { return post("/api/v3/push/test", {}); },
  };

  var api = {
    st: st, pid: pid, post: post, push: push, isIOS: isIOS, standalone: standalone,
    on: function (f) { subs.push(f); return function () { subs = subs.filter(function (x) { return x !== f; }); }; },
    setBusy: function (b) { st.busy = !!b; if (b) closePop(); },
    watchLive: function (on) { var was = st.wantLive; st.wantLive = !!on; if (on && !was) hb(true); },
    refresh: function () { hb(true); },
    muted: function () { return !!cfg.mute; },
    mute: function (b) { cfg.mute = !!b; lsSet(LSO, cfg); hb(true); },
    onJoin: function (inv) { location.href = "/#/qm?join=" + encodeURIComponent(inv.id); },
    toast: null,
    _popup: popup,
  };
  window.BAS = api;
})();
