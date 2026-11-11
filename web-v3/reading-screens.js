/* Shared reading, step 2: the four screens (partner, portion, progress, finish and duel hand-off).
   Loaded only when window.BA_FLAGS.sharedReading === true. Nothing sets that flag, and no page loads this
   file, so the live site does not change. No network calls: pairing is on this device until the server
   step exists. The quiz itself is not touched; the duel hands off to the page through opts.startDuel. */
(function () {
  var flags = window.BA_FLAGS || {};
  if (flags.sharedReading !== true) return;

  // Minimal look for the four screens, scoped to .br-screen and added only when the flag is on (app.css is not touched).
  var STYLE = ".br-screen{max-width:520px;margin:0 auto;padding:16px;line-height:1.5}" +
    ".br-screen h2{margin:0 0 8px;font-size:22px}" +
    ".br-screen label{display:block;margin:12px 0}" +
    ".br-row{display:flex;gap:12px}.br-row label{flex:1}" +
    ".br-screen input,.br-screen select{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px;border-radius:10px;border:1px solid #3a4a6b;background:#0d1730;color:inherit;font:inherit}" +
    ".br-screen button{margin:12px 0 4px;padding:12px 18px;border-radius:12px;border:0;background:#c9a54a;color:#070C1A;font:inherit;font-weight:700;cursor:pointer}" +
    ".br-lens{display:flex;gap:8px;flex-wrap:wrap}.br-lens button{margin:8px 0}" +
    ".br-lens button[aria-pressed=true]{outline:2px solid #c9a54a}" +
    ".br-code{font-size:32px;letter-spacing:.2em;font-weight:800;margin:12px 0}" +
    ".br-small{opacity:.7;font-size:14px}" +
    ".br-note{color:#f3c969;margin-top:12px}" +
    ".br-bar{height:8px;border-radius:4px;background:#1b2740;overflow:hidden;margin:12px 0}" +
    ".br-bar span{display:block;height:100%;background:#c9a54a}" +
    ".br-days{padding-left:0;list-style:none}.br-days li{padding:6px 0;border-bottom:1px solid #1b2740}" +
    ".br-done{opacity:.6}.br-tick{display:inline-block;vertical-align:middle;margin-left:4px;color:#c9a54a}";
  if (!document.getElementById("br-style")) {
    var st = document.createElement("style");
    st.id = "br-style";
    st.textContent = STYLE;
    document.head.appendChild(st);
  }

  var KEY = "ba:reading:v1";
  var LENGTHS = [1, 3, 7, 14, 30];
  var UNITS = ["hours", "days", "weeks", "months", "years"];
  var MAX_DAYS = 3650; // 10 years
  var DAYS_PER_UNIT = { days: 1, weeks: 7, months: 30, years: 365 }; // hours: under a day counts as one day
  var VERSIONS = [{ code: "KJV", quiz: true }, { code: "NLT", quiz: false }, { code: "MSG", quiz: false }];
  var BOOKS = "Genesis 50;Exodus 40;Leviticus 27;Numbers 36;Deuteronomy 34;Joshua 24;Judges 21;Ruth 4;1 Samuel 31;2 Samuel 24;1 Kings 22;2 Kings 25;1 Chronicles 29;2 Chronicles 36;Ezra 10;Nehemiah 13;Esther 10;Job 42;Psalms 150;Proverbs 31;Ecclesiastes 12;Song of Solomon 8;Isaiah 66;Jeremiah 52;Lamentations 5;Ezekiel 48;Daniel 12;Hosea 14;Joel 3;Amos 9;Obadiah 1;Jonah 4;Micah 7;Nahum 3;Habakkuk 3;Zephaniah 3;Haggai 2;Zechariah 14;Malachi 4;Matthew 28;Mark 16;Luke 24;John 21;Acts 28;Romans 16;1 Corinthians 16;2 Corinthians 13;Galatians 6;Ephesians 6;Philippians 4;Colossians 4;1 Thessalonians 5;2 Thessalonians 3;1 Timothy 6;2 Timothy 4;Titus 3;Philemon 1;Hebrews 13;James 5;1 Peter 5;2 Peter 3;1 John 5;2 John 1;3 John 1;Jude 1;Revelation 22"
    .split(";").map(function (s) { var m = s.match(/^(.*) (\d+)$/); return { name: m[1], chapters: Number(m[2]) }; });

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function bookNamed(n) { for (var i = 0; i < BOOKS.length; i++) if (BOOKS[i].name === n) return BOOKS[i]; return null; }
  function refOf(p) { return p.book + " " + (p.startChapter === p.endChapter ? p.startChapter : p.startChapter + "–" + p.endChapter); }

  // Same rule as dailySplit in domain/reading-plan.ts (earlier days take the extra chapters).
  function dailySplit(p) {
    var out = [], cursor = p.startChapter;
    for (var d = 1; d <= p.lengthDays; d++) {
      var remC = p.endChapter - cursor + 1, remD = p.lengthDays - d + 1;
      var n = remC > 0 ? Math.ceil(remC / remD) : 0;
      out.push({ day: d, startChapter: cursor, endChapter: cursor + n - 1 });
      cursor += n;
    }
    return out;
  }
  // Same checks as portionError in domain/reading-plan.ts.
  function portionError(p) {
    var b = bookNamed(p.book);
    if (!b) return "Pick a book.";
    if (!Number.isInteger(p.startChapter) || !Number.isInteger(p.endChapter)) return "Chapters must be whole numbers.";
    if (p.startChapter < 1 || p.endChapter > b.chapters) return p.book + " has chapters 1 to " + b.chapters + ".";
    if (p.endChapter < p.startChapter) return "The last chapter comes before the first.";
    if (!Number.isInteger(p.lengthDays) || p.lengthDays < 1 || p.lengthDays > MAX_DAYS) return "Length must be a whole number of days, 1 to 3650 (10 years).";
    return null;
  }

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  function newCode() {
    var a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", s = "";
    for (var i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
  }
  function newPairing() {
    return { inviteCode: newCode(), partnerCode: null, state: "invited", portion: null, done: [], createdAt: new Date().toISOString() };
  }

  // Which screen a pairing belongs on. The states come from domain/reading-plan.ts.
  function screenFor(s) {
    if (!s.partnerCode) return "invite";
    if (s.state === "invited") return "pick";
    if (s.state === "portion_chosen" || s.state === "reading") return "progress";
    return "finish";
  }

  function mount(el, opts) {
    if (!el) return;
    opts = opts || {};
    var draft = { book: "Matthew", startChapter: 1, endChapter: 7, lengthDays: 7, custom: false, customAmount: "", customUnit: "weeks", version: "KJV" };
    var notice = "";

    // The first read of this device creates the pairing and keeps it, so the invite code stays put.
    function state() { var s = load(); if (!s) { s = newPairing(); save(s); } return s; }

    function render() {
      var s = state();
      var screen = screenFor(s);
      var html = "";
      if (screen === "invite") html = inviteHTML(s);
      else if (screen === "pick") html = pickHTML();
      else if (screen === "progress") html = progressHTML(s);
      else html = finishHTML(s);
      el.innerHTML = '<section class="br-screen br-' + screen + '" data-screen="' + screen + '">' +
        html + (notice ? '<p class="br-note" role="status">' + esc(notice) + "</p>" : "") + "</section>";
      notice = "";
    }

    function inviteHTML(s) {
      return '<h2>Read with a partner</h2>' +
        '<p>Share this code with the person you want to read with.</p>' +
        '<p class="br-code" aria-label="Your invite code">' + esc(s.inviteCode) + "</p>" +
        '<label>Or enter their code<input id="br-partner-code" maxlength="6" autocomplete="off" autocapitalize="characters"></label>' +
        '<button type="button" data-act="accept">Pair up</button>' +
        '<p class="br-small">Pairing lives on this device until the server step is built.</p>';
    }

    function pickHTML() {
      var bookOpts = BOOKS.map(function (b) {
        return '<option value="' + esc(b.name) + '"' + (b.name === draft.book ? " selected" : "") + ">" + esc(b.name) + "</option>";
      }).join("");
      var lens = LENGTHS.map(function (n) {
        return '<button type="button" data-act="len" data-len="' + n + '" aria-pressed="' + (!draft.custom && n === draft.lengthDays) + '">' + n + (n === 1 ? " day" : " days") + "</button>";
      }).join("") +
        '<button type="button" data-act="custom" aria-pressed="' + draft.custom + '">Custom</button>';
      var customRow = draft.custom
        ? '<div class="br-row"><label>Number<input id="br-custom-n" type="number" min="1" step="1" inputmode="numeric" value="' + esc(draft.customAmount) + '"></label>' +
          '<label>Unit<select id="br-custom-unit">' + UNITS.map(function (u) {
            return '<option value="' + u + '"' + (u === draft.customUnit ? " selected" : "") + ">" + u + "</option>";
          }).join("") + "</select></label></div>"
        : "";
      var vers = VERSIONS.map(function (v) {
        return '<option value="' + v.code + '"' + (v.code === draft.version ? " selected" : "") + ">" + v.code + (v.quiz ? "" : " (no duel yet)") + "</option>";
      }).join("");
      return '<h2>Pick a portion</h2>' +
        '<label>Book<select id="br-book">' + bookOpts + "</select></label>" +
        '<div class="br-row"><label>From chapter<input id="br-from" type="number" min="1" value="' + draft.startChapter + '"></label>' +
        '<label>To chapter<input id="br-to" type="number" min="1" value="' + draft.endChapter + '"></label></div>' +
        '<div class="br-lens" role="group" aria-label="Length">' + lens + "</div>" + customRow +
        '<label>Version<select id="br-version">' + vers + "</select></label>" +
        '<p class="br-summary" id="br-summary"></p>' +
        '<button type="button" data-act="choose">Choose this reading</button>';
    }

    // The first day not yet ticked; a fresh reading starts at day 1.
    function firstOpenDay(days, done) {
      for (var i = 0; i < days.length; i++) if (!done[i]) return i;
      return days.length - 1;
    }

    function progressHTML(s) {
      var p = s.portion, days = dailySplit(p), done = s.done || [], n = days.filter(function (_, i) { return done[i]; }).length;
      var today = firstOpenDay(days, done);
      // Long plans: show a window of about 60 days around today, not every day.
      var from = Math.max(0, Math.min(today - 3, days.length - 60)), to = Math.min(days.length, from + 60);
      var rows = days.slice(from, to).map(function (d, k) {
        var i = from + k;
        var txt = d.endChapter >= d.startChapter ? p.book + " " + (d.startChapter === d.endChapter ? d.startChapter : d.startChapter + "–" + d.endChapter) : "Catch-up day";
        return '<li class="' + (done[i] ? "br-done" : "") + '">Day ' + d.day + ": " + esc(txt) +
          (done[i] ? ' <span class="br-tick" role="img" aria-label="done"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' : "") + "</li>";
      }).join("");
      var listNote = days.length > to - from
        ? '<p class="br-small">Showing days ' + (from + 1) + " to " + to + " of " + days.length + ".</p>" : "";
      var action = s.state === "portion_chosen"
        ? '<button type="button" data-act="begin">Start reading</button>'
        : '<button type="button" data-act="day" data-i="' + today + '">Mark day ' + (today + 1) + " read</button>";
      return '<h2>' + esc(refOf(p)) + "</h2>" +
        '<p class="br-small">' + esc(p.version) + " · " + esc(lengthLabelOf(p)) + " · " + n + " of " + days.length + (days.length === 1 ? " day" : " days") + " done</p>" +
        '<p class="br-small">' + esc(perDayText(p)) + "</p>" +
        '<div class="br-bar" aria-hidden="true"><span style="width:' + Math.round((100 * n) / days.length) + '%"></span></div>' +
        "<ol class=\"br-days\">" + rows + "</ol>" + listNote + action +
        '<p class="br-small">Your partner’s progress shows here once pairing is on the server.</p>';
    }

    function finishHTML(s) {
      var p = s.portion;
      var quizOK = VERSIONS.some(function (v) { return v.code === p.version && v.quiz; });
      var duel = s.state === "duel_ready"
        ? '<p>Duel ready. Your partner gets the same questions.</p>'
        : (quizOK
          ? '<button type="button" data-act="duel">Start the reading duel</button>'
          : '<p class="br-small">Duels are KJV only for now. Switch this reading to KJV to duel.</p>');
      return '<h2>Finished ' + esc(refOf(p)) + "</h2>" +
        '<p>You read all ' + esc(lengthLabelOf(p)) + " of this portion.</p>" + duel;
    }

    function summary() {
      var el2 = document.getElementById("br-summary");
      if (!el2) return;
      var p = readDraft();
      var err = lengthFromDraft().error || portionError(p);
      if (err) { el2.textContent = err; return; }
      el2.textContent = refOf(p) + ": " + perDayText(p) + ", " + lengthLabelOf(p) + ", " + p.version + "." +
        (dailySplit(p).some(function (d) { return d.endChapter < d.startChapter; }) ? " Days after the last chapter are catch-up days." : "");
    }

    // The length as the person typed it, or the preset. Returns days, a label and an error if any.
    function lengthFromDraft() {
      if (!draft.custom) return { days: draft.lengthDays, label: draft.lengthDays + (draft.lengthDays === 1 ? " day" : " days"), error: null };
      var raw = String(draft.customAmount == null ? "" : draft.customAmount).trim();
      if (!/^\d+$/.test(raw) || Number(raw) < 1) return { days: 0, label: "", error: "Enter a whole number of 1 or more for the length." };
      var n = Number(raw), u = draft.customUnit;
      if (UNITS.indexOf(u) < 0) return { days: 0, label: "", error: "Pick hours, days, weeks, months or years." };
      var days = u === "hours" ? Math.ceil(n / 24) : n * DAYS_PER_UNIT[u];
      if (days > MAX_DAYS) return { days: days, label: "", error: "A custom length goes up to 10 years." };
      var word = n === 1 ? u.replace(/s$/, "") : u;
      var note = u === "hours" || u === "months" || u === "years" ? " (" + days + (days === 1 ? " day" : " days") + ")" : "";
      return { days: days, label: n + " " + word + note, error: null };
    }

    function lengthLabelOf(p) {
      return p.lengthLabel || (p.lengthDays + (p.lengthDays === 1 ? " day" : " days"));
    }

    // Chapters a day, as a person reads it. Under one chapter a day says so, not "about 0".
    function perDayText(p) {
      var chapters = p.endChapter - p.startChapter + 1, perDay = chapters / p.lengthDays;
      return perDay >= 1 ? "about " + Math.ceil(perDay) + " chapter" + (Math.ceil(perDay) === 1 ? "" : "s") + " a day"
        : "under one chapter a day";
    }

    function readDraft() {
      var g = function (id) { var x = document.getElementById(id); return x ? x.value : null; };
      if (g("br-book") !== null) {
        draft.book = g("br-book");
        draft.startChapter = Number(g("br-from"));
        draft.endChapter = Number(g("br-to"));
        draft.version = g("br-version");
        if (g("br-custom-n") !== null) draft.customAmount = g("br-custom-n");
        if (g("br-custom-unit") !== null) draft.customUnit = g("br-custom-unit");
      }
      var len = lengthFromDraft();
      return { book: draft.book, startChapter: draft.startChapter, endChapter: draft.endChapter, lengthDays: len.days, lengthLabel: len.label || undefined, version: draft.version };
    }

    el.addEventListener("click", function (ev) {
      var t = ev.target.closest ? ev.target.closest("[data-act]") : null;
      if (!t) return;
      var act = t.getAttribute("data-act"), s = state();
      if (act === "accept") {
        var code = (document.getElementById("br-partner-code") || {}).value || "";
        code = code.trim().toUpperCase();
        if (code.length !== 6) notice = "Enter the six-letter code.";
        else if (code === s.inviteCode) notice = "That is your own code.";
        else { s.partnerCode = code; save(s); }
      } else if (act === "len") {
        readDraft();
        draft.custom = false;
        draft.lengthDays = Number(t.getAttribute("data-len"));
        render(); summary(); return;
      } else if (act === "custom") {
        readDraft();
        draft.custom = true;
        render(); summary(); return;
      } else if (act === "choose") {
        var p = readDraft(), err = lengthFromDraft().error || portionError(p);
        if (err) notice = err;
        else { s.portion = p; s.state = "portion_chosen"; s.done = []; save(s); }
      } else if (act === "begin") {
        s.state = "reading"; s.done = dailySplit(s.portion).map(function () { return false; }); save(s);
      } else if (act === "day") {
        var i = Number(t.getAttribute("data-i"));
        s.done[i] = true;
        if (s.done.every(Boolean)) s.state = "finished";
        save(s);
      } else if (act === "duel") {
        if (typeof opts.startDuel === "function") { s.state = "duel_ready"; save(s); opts.startDuel(s.portion); }
        else notice = "The duel is not connected to the quiz yet, so nothing has started.";
      }
      render();
      summary();
    });
    el.addEventListener("change", summary);
    el.addEventListener("input", summary);

    render();
    summary();
  }

  window.BAReading = {
    screens: ["invite", "pick", "progress", "finish"],
    mount: mount,
  };
})();
