/* Chever duel, ranked/join and results screens (preview). Flag-gated: nothing in the committed code sets
   window.BA_FLAGS.chever2Duels, and no page loads this file unless it is set, so the live site does not change.
   Pure logic lives on window.BADuel.logic (tests read it); the three renderers return HTML strings that app.js puts on
   the page and binds. Icons are inline SVG. No emoji on these screens: lint for it is in tests/duel-screens.test.ts. */
(function (root) {
  "use strict";

  // ---------- icons (inline SVG, stroke-based, no emoji) ----------
  var PATHS = {
    back: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
    duel: '<path d="M4.5 4.5 14 14"/><path d="M19.5 4.5 10 14"/><path d="M9.5 14.5 5 19"/><path d="M14.5 14.5 19 19"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5.2A2.7 2.7 0 0 0 8 10.5M16 6h2.8A2.7 2.7 0 0 1 16 10.5"/><path d="M12 13v4M8.5 20h7M9.5 17h5"/>',
    check: '<path d="M5 12.5 10 17.5 19 7.5"/>',
    cross: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    chat: '<path d="M4 5.5h16v10.5H9.5L5 20v-4H4z"/>',
    shield: '<path d="M12 3.5 19 6.2v5.3c0 4.4-2.9 7.9-7 9-4.1-1.1-7-4.6-7-9V6.2z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    hash: '<path d="M4.5 9h15M4.5 15h15M9.5 5l-2 14M16.5 5l-2 14"/>',
    user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.8 20c.9-3.7 3.7-5.8 7.2-5.8s6.3 2.1 7.2 5.8"/>',
    users: '<circle cx="9" cy="8.2" r="3.2"/><path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><circle cx="16.5" cy="8.5" r="2.6"/><path d="M16 14.5c2.6 0 4.6 1.6 5 4.6"/>',
    bolt: '<path d="M13 3.5 5.5 14H12l-1 6.5L18.5 10H12z"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
    share: '<path d="M12 4v11"/><path d="M7.5 8.5 12 4l4.5 4.5"/><path d="M5 13v6h14v-6"/>'
  };
  function ico(name, cls) {
    return '<svg class="' + (cls || "cvd-i") + '" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (PATHS[name] || "") + "</svg>";
  }

  // ---------- pure logic ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  // Names from the server can carry emoji (the bot's name does); the screens show plain words.
  function plainName(s) {
    var t = String(s == null ? "" : s).replace(/\p{Extended_Pictographic}/gu, "").replace(/\s+/g, " ").trim();
    return t || "Player";
  }
  function firstName(s) { return plainName(s).split(" ")[0]; }
  function tenths(ms) { return Math.round(Math.max(0, Number(ms) || 0) / 100); }
  // Same rule the duel list and the results use: higher score wins; equal score, the faster time (to 0.1 s) wins.
  function cmpDuel(a, b) {
    var sa = Number(a.score) || 0, sb = Number(b.score) || 0;
    if (sa !== sb) return sa > sb ? 1 : -1;
    var ta = tenths(a.timeMs), tb = tenths(b.timeMs);
    return ta === tb ? 0 : ta < tb ? 1 : -1;
  }
  // "play" = I have not finished my set; "waiting" = I finished, the other has not; then "won", "lost" or "draw".
  function duelState(me, opp) {
    if (!me || !me.finished) return "play";
    if (!opp || !opp.finished) return "waiting";
    var c = cmpDuel(me, opp);
    return c === 1 ? "won" : c === -1 ? "lost" : "draw";
  }
  function secsLabel(ms) { return (tenths(ms) / 10).toFixed(1) + "s"; }
  function gapLabel(a, b) { return secsLabel(Math.abs(tenths(a) - tenths(b)) * 100); }
  function percent(done, total) {
    if (!(total > 0)) return 0;
    return Math.max(0, Math.min(100, Math.round((done / total) * 100)));
  }
  // One dot per question: right, wrong, or still open. answers holds true/false per answered question.
  function gridOf(answers, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      if (answers && i < answers.length) out.push(answers[i] ? "right" : "wrong");
      else out.push("open");
    }
    return out;
  }
  // A duel code is 4 to 12 letters or digits. A pasted link or a /d/ path goes to the app's own parser unchanged.
  function normalizeCode(raw) {
    var s = String(raw == null ? "" : raw).trim();
    if (/[\/.:]/.test(s)) return { ok: true, link: true, code: null, raw: s };
    var c = s.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (c.length < 4 || c.length > 12) return { ok: false, link: false, code: c, message: "Type the code you were sent, like 482913." };
    return { ok: true, link: false, code: c, raw: s };
  }
  function headlineFor(state, ctx) {
    ctx = ctx || {};
    var opp = firstName(ctx.oppName || "your opponent");
    if (state === "won") return { title: "You won", sub: ctx.tie ? "Same score. You were " + ctx.gap + " faster." : "You knew the Word better this time." };
    if (state === "lost") return { title: opp + " took this one", sub: ctx.tie ? "Same score. " + opp + " was " + ctx.gap + " faster." : "Send a rematch and get it back." };
    if (state === "draw") return { title: "A draw", sub: "Same score, same time. Honours shared." };
    if (state === "waiting") return { title: "Now send it", sub: ctx.quick ? "Nice round. Waiting for " + opp + " to finish." : "Your score is in. Waiting for someone to take your challenge." };
    return { title: "", sub: "" };
  }

  // ---------- renderers ----------
  // A player's face (their own, from this phone's saved choice) or the initial when there is none.
  // Only the "You" side carries a face: the other player's face is not stored with the duel yet.
  var FACE = /^face-(0[1-9]|[1-2]\d|3\d|40)$/;
  function myFace() {
    try { var a = JSON.parse(localStorage.getItem("bal:me") || "{}").avatar; return FACE.test(a || "") ? a : null; } catch (e) { return null; }
  }
  function avInner(s) {
    if (s.avatar && FACE.test(s.avatar)) return '<img src="/v3/avatars/' + s.avatar + '.svg" alt="" width="256" height="256" style="width:100%;height:100%;border-radius:50%">';
    return esc(plainName(s.name).charAt(0).toUpperCase());
  }
  function sideHTML(s, win, label) {
    return '<div class="cvd-side' + (win ? " win" : "") + '">' +
      '<div class="cvd-av">' + avInner(s) + "</div>" +
      "<b>" + esc(s.label || plainName(s.name)) + "</b>" +
      '<div class="cvd-big">' + esc(s.score == null ? "–" : s.score) + "</div>" +
      '<div class="cvd-sub">' + esc(s.sub || "") + "</div>" +
      (label ? '<span class="cvd-tag">' + esc(label) + "</span>" : "") + "</div>";
  }
  function dotsHTML(list, who) {
    return '<div class="cvd-row"><span class="cvd-who">' + esc(who) + '</span><div class="cvd-dots" role="img" aria-label="' + esc(who) + ' question by question">' +
      list.map(function (k, i) {
        var lab = k === "right" ? "right" : k === "wrong" ? "wrong" : "not answered";
        return '<i class="' + k + '" title="Question ' + (i + 1) + ': ' + lab + '">' + (k === "right" ? ico("check", "cvd-di") : k === "wrong" ? ico("cross", "cvd-di") : "") + "</i>";
      }).join("") + "</div></div>";
  }

  // Duel screen: the challenge to accept (before my set is played).
  function renderDuel(m) {
    var needName = !!m.needName;
    return '<div class="cvd cvd-duel">' +
      '<div class="cvd-top"><a class="cvd-back" href="#/duels" aria-label="Back">' + ico("back") + "</a>" +
      '<div class="cvd-kick">Challenge · ' + esc(m.code) + "</div><span class=\"cvd-spacer\"></span></div>" +
      '<div class="cvd-mode">' + ico("book") + "<span><b>" + esc(m.modeName) + "</b> · " + esc(m.tierName) + " · " + esc(m.count) + " questions</span></div>" +
      '<section class="cvd-card cvd-vs">' +
      sideHTML({ name: m.creatorName, label: m.creatorName, score: m.scoreToBeat, sub: m.scoreToBeat == null ? "not played yet" : "score to beat" }, false, "Challenger") +
      '<div class="cvd-vsx" aria-hidden="true">VS</div>' +
      sideHTML({ name: "You", avatar: myFace(), label: "You", score: null, sub: "not played yet" }, false, "") +
      "</section>" +
      '<p class="cvd-note">Same questions, same clock. Points for speed and streaks. Every answer shows its verse.</p>' +
      (needName ? '<section class="cvd-card cvd-form"><label class="cvd-lab" for="nm">Your name</label><input id="nm" class="cvd-in" maxlength="40" placeholder="e.g. Ade" value="' + esc(m.nameVal || "") + '">' +
        '<label class="cvd-lab" for="ch">Church or group <span class="cvd-dim">(optional)</span></label><input id="ch" class="cvd-in" maxlength="60" value="' + esc(m.churchVal || "") + '"></section>' : "") +
      '<button class="cvd-btn primary" id="acc" type="button">' + ico("bolt") + "Accept and play</button>" +
      (m.boardHTML || "") +
      '<a class="cvd-btn ghost" href="#/">Home</a>' +
      "</div>" + (m.tabbarHTML || "");
  }

  // Ranked and join-by-code screen.
  function renderRankedJoin(m) {
    return '<div class="cvd cvd-rj">' +
      '<div class="cvd-top"><span class="cvd-spacer"></span><div class="cvd-kick">Play</div><span class="cvd-spacer"></span></div>' +
      '<h1 class="cvd-h">Play Chever</h1>' +
      '<section class="cvd-card cvd-rank"><div class="cvd-badge">' + ico("shield") + "</div><div class=\"cvd-grow\">" +
      '<div class="cvd-kick">Ranked</div><b>' + esc(m.rankLabel || "Seeker") + '</b><div class="cvd-sub">' + esc(m.xpLabel || "Play online to climb") + "</div></div></section>" +
      '<a class="cvd-btn primary" href="#/online">' + ico("users") + "Find an opponent</a>" +
      '<section class="cvd-card cvd-join"><div class="cvd-kick">Join by code</div>' +
      "<p>Got a code from a friend? Enter it to take their challenge.</p>" +
      '<form id="cvj" class="cvd-joinrow" autocomplete="off"><input name="c" class="cvd-in" maxlength="40" placeholder="Enter code" autocapitalize="characters" spellcheck="false" aria-label="Challenge code" value="' + esc(m.prefill || "") + '">' +
      '<button class="cvd-btn primary" type="submit">' + ico("hash") + "Join</button></form>" +
      '<div class="cvd-err" id="cvj-err" role="alert">' + esc(m.joinError || "") + "</div></section>" +
      '<div class="cvd-sec"><b>Your sets to beat</b></div>' + (m.setsHTML || '<div class="cvd-sub">No challenges yet.</div>') +
      "</div>" + (m.tabbarHTML || "");
  }

  // Results screen: both sets in, or my set in and the other still to play.
  function renderResults(m) {
    var st = m.outcome;
    var badge = st === "won" ? ico("trophy") : st === "lost" ? ico("cross") : st === "draw" ? ico("users") : st === "waiting" ? ico("clock") : ico("check");
    var n = m.count || 0;
    var waBtn = '<a class="cvd-btn wa" id="wa" href="' + esc(m.waHref) + '" target="_blank" rel="noopener">' + ico("chat") + "Send on WhatsApp</a>";
    return '<div class="cvd cvd-res cvd-' + esc(st) + '">' +
      '<div class="cvd-top"><a class="cvd-back" href="#/duels" aria-label="Back">' + ico("back") + "</a>" +
      '<div class="cvd-kick">Result · ' + esc(m.code) + "</div><span class=\"cvd-spacer\"></span></div>" +
      '<section class="cvd-hero"><div class="cvd-badge big">' + badge + "</div>" +
      "<h1>" + esc(m.headline) + "</h1><p class=\"cvd-sub\">" + esc(m.sub) + "</p></section>" +
      '<section class="cvd-card cvd-scores">' +
      sideHTML({ name: "You", avatar: myFace(), label: "You", score: m.me.score, sub: m.me.correct + "/" + m.me.total + " · " + m.me.time }, st === "won" || st === "draw", st === "won" ? "Winner" : "") +
      '<div class="cvd-vsx" aria-hidden="true">VS</div>' +
      (m.opp ? sideHTML({ name: m.oppName, label: firstName(m.oppName), score: m.opp.score, sub: m.opp.correct + "/" + m.opp.total + " · " + m.opp.time }, st === "lost" || st === "draw", st === "lost" ? "Winner" : "") :
        sideHTML({ name: "Waiting", label: "Waiting", score: null, sub: "send the link" }, false, "")) +
      "</section>" +
      (m.opp ? '<section class="cvd-card"><div class="cvd-kick">Question by question</div>' + dotsHTML(m.myGrid, "You") + dotsHTML(m.oppGrid, firstName(m.oppName)) + "</section>" : "") +
      (m.extraHTML || "") +
      (m.xpLine ? '<p class="cvd-foot">' + esc(m.xpLine) + "</p>" : "") +
      (m.achievementsHTML || "") +
      waBtn +
      '<div class="cvd-row2"><button class="cvd-btn ghost" id="cp" type="button">' + ico("link") + "Copy link</button>" +
      '<button class="cvd-btn ghost" id="sh" type="button">' + ico("share") + "Share card</button></div>" +
      (m.rematch ? '<button class="cvd-btn primary" id="rm" type="button">' + ico("bolt") + "Rematch with new questions</button>" : "") +
      (m.qm ? '<button class="cvd-btn primary" id="qmreal" type="button">' + ico("users") + "Quick Match a real player</button>" : "") +
      (m.chwLabel ? '<button class="cvd-btn ghost" id="' + esc(m.chwId || "chw") + '" type="button">' + ico("trophy") + esc(m.chwLabel) + "</button>" : "") +
      (m.boardHTML || "") +
      '<a class="cvd-btn ghost" href="#/">Home</a>' +
      "</div>" + (m.tabbarHTML || "") + (n ? "" : "");
  }

  // Everyone on the challenge: finished rows by place, then the ones still playing.
  function renderBoard(rows) {
    return '<section class="cvd-card"><div class="cvd-kick">Everyone on this challenge</div>' + rows.map(function (r) {
      return '<div class="cvd-lrow' + (r.me ? " me" : "") + '"><span class="cvd-pos">' + esc(r.pos) + "</span>" +
        '<div class="cvd-grow"><b>' + esc(plainName(r.name)) + "</b>" + (r.tag ? ' <span class="cvd-tag">' + esc(r.tag) + "</span>" : "") +
        '<div class="cvd-sub">' + esc(r.sub || "") + "</div></div>" +
        '<div class="cvd-lscore">' + esc(r.score == null ? "" : r.score) + "</div></div>";
    }).join("") + "</section>";
  }

  // ---------- style (scoped to .cvd; injected once by the app when the flag is on) ----------
  var CSS = ".cvd{color:#0B1F4B;font-family:var(--sans);display:flex;flex-direction:column;gap:14px;padding-bottom:110px}" +
    ".cvd-top{display:flex;align-items:center;justify-content:space-between;gap:12px}.cvd-spacer{width:40px}" +
    ".cvd-back{width:40px;height:40px;border-radius:50%;background:#fff;border:1px solid #E3E8F2;display:flex;align-items:center;justify-content:center;color:#0B1F4B}" +
    ".cvd-kick{font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;color:#0648C2}" +
    ".cvd-h{font-size:26px;margin:0;font-weight:800}.cvd h1{font-size:26px;margin:6px 0 2px;font-weight:800}" +
    ".cvd-mode{display:flex;align-items:center;gap:10px;color:#0B1F4B;font-size:15px}.cvd-mode .cvd-i{color:#0648C2}" +
    ".cvd-scores{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}" +
    ".cvd-card{background:#fff;border:1px solid #E3E8F2;border-radius:20px;box-shadow:0 2px 10px rgba(11,31,75,.06);padding:16px}" +
    ".cvd-vs{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}" +
    ".cvd-side{flex:1;text-align:center;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}.cvd-side b{font-size:15px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".cvd-av{width:52px;height:52px;border-radius:50%;background:#EEF4FE;color:#0648C2;font-weight:800;font-size:22px;display:flex;align-items:center;justify-content:center}" +
    ".cvd-side.win .cvd-av{background:#0648C2;color:#fff}" +
    ".cvd-big{font-size:30px;font-weight:800;color:#0B1F4B;margin-top:4px}.cvd-sub{font-size:13px;color:#5B6478}" +
    ".cvd-tag{font-size:11px;font-weight:800;color:#0648C2;letter-spacing:.04em;text-transform:uppercase}" +
    ".cvd-vsx{align-self:center;width:40px;height:40px;border-radius:50%;background:#0B1F4B;color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:13px;flex:none}" +
    ".cvd-note{margin:0;font-size:14px;color:#5B6478;text-align:center}.cvd-dim{color:#8A93A6}" +
    ".cvd-form{display:flex;flex-direction:column;gap:8px}.cvd-lab{font-size:13px;font-weight:700;color:#0B1F4B}" +
    ".cvd-in{width:100%;min-height:48px;border:1.5px solid #DDE3EE;border-radius:14px;padding:10px 14px;font:inherit;font-size:16px;color:#0B1F4B;background:#fff}" +
    ".cvd-btn{display:flex;align-items:center;justify-content:center;gap:8px;min-height:54px;padding:0 18px;border-radius:16px;font-weight:800;font-size:16px;text-decoration:none;border:0;cursor:pointer;color:#0B1F4B;background:#fff;border:1.5px solid #DDE3EE;font-family:inherit}" +
    ".cvd-btn.primary{background:#0648C2;color:#fff;border-color:#0648C2}.cvd-btn.ghost{background:#fff}" +
    ".cvd-btn.wa{background:#1F9D5C;color:#fff;border-color:#1F9D5C}" +
    ".cvd-btn .cvd-i{flex:none}.cvd-btn:focus-visible{outline:2px solid #0648C2;outline-offset:2px}" +
    ".cvd-row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}" +
    ".cvd-rank{display:flex;align-items:center;gap:14px}.cvd-grow{flex:1;min-width:0}" +
    ".cvd-badge{width:48px;height:48px;border-radius:50%;background:#EEF4FE;color:#0648C2;display:flex;align-items:center;justify-content:center;flex:none}" +
    ".cvd-badge.big{width:64px;height:64px;margin:0 auto}.cvd-badge .cvd-i{width:28px;height:28px}" +
    ".cvd-join p{margin:4px 0 10px;font-size:14px;color:#5B6478}.cvd-joinrow{display:flex;gap:8px}.cvd-joinrow .cvd-in{flex:1}.cvd-joinrow .cvd-btn{min-width:110px}" +
    ".cvd-err{min-height:18px;margin-top:8px;font-size:13px;color:#D64545;font-weight:700}" +
    ".cvd-sec{font-size:15px;margin-top:4px}.cvd-hero{text-align:center;padding:4px 0}" +
    ".cvd-scores .cvd-vsx{width:34px;height:34px;font-size:12px}" +
    ".cvd-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px}.cvd-who{font-size:13px;font-weight:700;color:#0B1F4B;min-width:52px}" +
    ".cvd-dots{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.cvd-dots i{width:18px;height:18px;border-radius:50%;border:1.5px solid #B8C3D6;display:inline-flex;align-items:center;justify-content:center;color:#fff}" +
    ".cvd-dots i.right{background:#1F9D5C;border-color:#1F9D5C}.cvd-dots i.wrong{background:#D64545;border-color:#D64545}.cvd-dots i.open{background:#fff}" +
    ".cvd-di{width:10px;height:10px}.cvd-foot{text-align:center;margin:0;font-size:13px;color:#5B6478}" +
    ".cvd-res.cvd-won .cvd-badge{background:#FFF6DC;color:#9A6A00}.cvd-res.cvd-lost .cvd-badge{background:#FDF0F0;color:#D64545}" +
    ".cvd-lrow{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid #EEF1F6}.cvd-lrow:first-of-type{border-top:0}" +
    ".cvd-lrow.me b{color:#0648C2}.cvd-pos{width:30px;height:30px;border-radius:50%;background:#EEF4FE;color:#0648C2;font-weight:800;font-size:14px;display:flex;align-items:center;justify-content:center;flex:none}" +
    ".cvd-lscore{font-weight:800;font-size:18px;color:#0B1F4B}.cvd-bigcode{font-size:30px;font-weight:800;letter-spacing:.14em;text-align:center;margin:6px 0;color:#0B1F4B}" +
    ".cvd-setrow{display:flex;align-items:center;gap:12px;text-decoration:none;color:#0B1F4B}.cvd-setrow .cvd-badge{width:40px;height:40px}" +
    ".cvd-status{font-size:13px;font-weight:800;color:#5B6478;text-align:right}.cvd-status.on{color:#0648C2}" +
    ".cvd-hint{font-size:13px;color:#5B6478}";

  function ensureStyle(doc) {
    doc = doc || (typeof document !== "undefined" ? document : null);
    if (!doc || doc.getElementById("cvd-style")) return;
    var s = doc.createElement("style"); s.id = "cvd-style"; s.textContent = CSS; doc.head.appendChild(s);
  }

  root.BADuel = {
    logic: {
      esc: esc, plainName: plainName, firstName: firstName, cmpDuel: cmpDuel, duelState: duelState, secsLabel: secsLabel,
      gapLabel: gapLabel, percent: percent, gridOf: gridOf, normalizeCode: normalizeCode, headlineFor: headlineFor
    },
    renderDuel: renderDuel, renderRankedJoin: renderRankedJoin, renderResults: renderResults, renderBoard: renderBoard,
    ico: ico, css: CSS, ensureStyle: ensureStyle
  };
})(typeof window !== "undefined" ? window : globalThis);
