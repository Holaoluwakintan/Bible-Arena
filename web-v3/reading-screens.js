/* Shared reading plan (Chever, preview). Five screens: invite (join with a code, or start a plan), pick (portion),
   progress (today, streak, plan progress, the shared view), finish, and the duel hand-off through opts.startDuel.
   Loaded only when window.BA_FLAGS.sharedReading === true. Nothing sets that flag, and no page loads this file
   unless the flag is set, so the live site does not change. The plan lives on the server (/api/v3/reading/*),
   with up to 50 members per plan; the quiz itself is not touched. */
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
    "[hidden]{display:none!important}.br-books{max-height:14rem;overflow:auto;border:1px solid #C9D3E6;border-radius:10px;padding:6px 10px;display:grid;grid-template-columns:1fr 1fr;gap:2px 8px;margin:6px 0}" +
    ".br-bk{display:flex;gap:6px;align-items:center;font-size:15px;color:#0B1F4B}" +
    ".br-lens button[aria-pressed=true]{outline:2px solid #c9a54a}" +
    ".br-code{font-size:32px;letter-spacing:.2em;font-weight:800;margin:12px 0}" +
    ".br-small{opacity:.7;font-size:14px}" +
    ".br-note{color:#f3c969;margin-top:12px}" +
    ".br-bar{height:8px;border-radius:4px;background:#1b2740;overflow:hidden;margin:12px 0}" +
    ".br-bar span{display:block;height:100%;background:#c9a54a}" +
    ".br-days{padding-left:0;list-style:none}.br-days li{padding:6px 0;border-bottom:1px solid #1b2740}" +
    ".br-done{opacity:.6}.br-tick{display:inline-block;vertical-align:middle;margin-left:4px;color:#c9a54a}" +
    ".br-eyebrow{margin:8px 0 0;color:#0648C2;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}" +
    ".br-screen .br-range{margin:2px 0 0;font-size:30px;font-weight:800;color:#0B1F4B;line-height:1.15}" +
    ".br-screen .br-title{margin:6px 0 0;font-size:32px;font-weight:800;color:#0B1F4B;line-height:1.15}" +
    ".br-sub{margin:4px 0 0;color:#5B6478;font-size:15px}" +
    ".br-today{margin:16px 0 0;padding:16px}" +
    ".br-today .br-cta{margin:12px 0 2px}" +
    ".br-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px}" +
    ".br-pill{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:#EEF4FE;color:#0648C2;font-size:13px;font-weight:700;white-space:nowrap}" +
    ".br-codecard{cursor:pointer}" +
    ".br-screen .br-cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin:14px 0 6px;padding:15px;border:0;border-radius:16px;background:#0648C2;color:#fff;font-weight:800;font-size:17px}" +
    ".br-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}" +
    ".br-card{background:#fff;border:1px solid #E3E8F2;border-radius:16px;padding:14px;margin:10px 0;color:#0B1F4B;box-shadow:0 1px 4px rgba(11,31,75,.04)}" +
    ".br-cards .br-card{margin:0}" +
    ".br-ico{display:inline-grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#EEF4FE;color:#0648C2}" +
    ".br-cardlabel{display:block;font-size:13px;color:#5B6478;margin-top:8px}" +
    ".br-cardnum{display:block;font-size:22px;color:#0B1F4B}" +
    ".br-codecard{display:flex;gap:12px;align-items:center}" +
    ".br-code-s{display:block;font-size:24px;letter-spacing:.2em;color:#0B1F4B;margin-top:4px}" +
    ".br-h3{font-size:16px;margin:18px 0 6px;color:#0B1F4B}" +
    ".br-screen .br-bar{background:#E3E8F2;height:8px;margin:8px 0 4px}.br-screen .br-bar span{background:#0648C2}" +
    ".br-screen .br-days li{border-bottom:1px solid #E3E8F2}.br-screen .br-tick{color:#0648C2}";
  STYLE += ".br-screen input,.br-screen select{background:#fff!important;color:#0B1F4B!important;border:1px solid #C9D3E6!important}" +
    ".br-secondary{background:transparent!important;color:#0648C2!important;border:1px solid #0648C2!important}" +
    ".br-readers{display:block;margin-top:2px;color:#5B6478;font-size:13px}" +
    ".br-people{list-style:none;padding:0;margin:8px 0 0}.br-people li{padding:8px 0;border-bottom:1px solid #E3E8F2}";
  if (!document.getElementById("br-style")) {
    var st = document.createElement("style");
    st.id = "br-style";
    st.textContent = STYLE;
    document.head.appendChild(st);
  }

  var LENGTHS = [1, 3, 7, 14, 30];
  var UNITS = ["hours", "days", "weeks", "months", "years"];
  var MAX_DAYS = 3650; // 10 years
  var DAYS_PER_UNIT = { days: 1, weeks: 7, months: 30, years: 365 }; // hours: under a day counts as one day
  var VERSIONS = [{ code: "KJV", quiz: true }, { code: "NLT", quiz: false }, { code: "MSG", quiz: false }];
  var BOOKS = "Genesis 50;Exodus 40;Leviticus 27;Numbers 36;Deuteronomy 34;Joshua 24;Judges 21;Ruth 4;1 Samuel 31;2 Samuel 24;1 Kings 22;2 Kings 25;1 Chronicles 29;2 Chronicles 36;Ezra 10;Nehemiah 13;Esther 10;Job 42;Psalms 150;Proverbs 31;Ecclesiastes 12;Song of Solomon 8;Isaiah 66;Jeremiah 52;Lamentations 5;Ezekiel 48;Daniel 12;Hosea 14;Joel 3;Amos 9;Obadiah 1;Jonah 4;Micah 7;Nahum 3;Habakkuk 3;Zephaniah 3;Haggai 2;Zechariah 14;Malachi 4;Matthew 28;Mark 16;Luke 24;John 21;Acts 28;Romans 16;1 Corinthians 16;2 Corinthians 13;Galatians 6;Ephesians 6;Philippians 4;Colossians 4;1 Thessalonians 5;2 Thessalonians 3;1 Timothy 6;2 Timothy 4;Titus 3;Philemon 1;Hebrews 13;James 5;1 Peter 5;2 Peter 3;1 John 5;2 John 1;3 John 1;Jude 1;Revelation 22"
    .split(";").map(function (s) { var m = s.match(/^(.*) (\d+)$/); return { name: m[1], chapters: Number(m[2]) }; });
  var MEMBER_CAP = 50;
  var NT_FROM = 39; // BOOKS[0..38] are the Old Testament, the rest the New
  var SCOPES = [{ code: "book", label: "One book" }, { code: "books", label: "Several books" }, { code: "nt", label: "New Testament" }, { code: "ot", label: "Old Testament" }, { code: "bible", label: "Whole Bible" }];

  // Icons are inline SVG, no emoji. Same set as before.
  var ICON = {
    flame: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M12 2.5c.8 3.2 4.6 5 4.6 9.6a4.6 4.6 0 0 1-9.2 0c0-2.1 1-3.6 2.1-4.7.2 1.7.9 2.7 1.9 3.2-.3-3 .2-5.6.6-8.1z" fill="currentColor"/></svg>',
    book: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5zM20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/></g></svg>',
    check: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function bookNamed(n) { for (var i = 0; i < BOOKS.length; i++) if (BOOKS[i].name === n) return BOOKS[i]; return null; }
  function refOf(p) {
    if (p.books || p.names) return p.book; // several books, a testament or the whole Bible: the label
    return p.book + " " + (p.startChapter === p.endChapter ? p.startChapter : p.startChapter + "–" + p.endChapter);
  }
  // The run of chapters a scope covers, in Bible order. Several books, a testament or the whole Bible run 1 to the total.
  function scopePortion(d) {
    if (d.scope === "book") return { book: d.book, startChapter: d.startChapter, endChapter: d.endChapter, names: null };
    var list = d.scope === "nt" ? BOOKS.slice(NT_FROM) : d.scope === "ot" ? BOOKS.slice(0, NT_FROM) : d.scope === "bible" ? BOOKS.slice()
      : BOOKS.filter(function (b) { return d.booksChosen.indexOf(b.name) >= 0; });
    var names = list.map(function (b) { return b.name; });
    var total = list.reduce(function (n, b) { return n + b.chapters; }, 0);
    var label = d.scope === "nt" ? "New Testament" : d.scope === "ot" ? "Old Testament" : d.scope === "bible" ? "The whole Bible"
      : names.length === 1 ? names[0] : names.length <= 3 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names.length + " books";
    return { book: names.length ? label : "", startChapter: 1, endChapter: total, names: names };
  }

  // Same rule as dailySplit in domain/reading-plan.ts (earlier days take the extra chapters). The server uses the same rule.
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
    if (p.names) {
      if (p.names.length === 0) return "Pick at least one book.";
    } else {
      var b = bookNamed(p.book);
      if (!b) return "Pick a book.";
      if (!Number.isInteger(p.startChapter) || !Number.isInteger(p.endChapter)) return "Chapters must be whole numbers.";
      if (p.startChapter < 1 || p.endChapter > b.chapters) return p.book + " has chapters 1 to " + b.chapters + ".";
      if (p.endChapter < p.startChapter) return "The last chapter comes before the first.";
    }
    if (!Number.isInteger(p.lengthDays) || p.lengthDays < 1 || p.lengthDays > MAX_DAYS) return "Length must be a whole number of days, 1 to 3650 (10 years).";
    return null;
  }

  // One request to the plan server. A first request with no session gets a guest session, as the rest of the app does.
  function call(method, path, body) {
    var hd = { "Content-Type": "application/json", "x-client-platform": "web" };
    var text = body ? JSON.stringify(body) : undefined;
    function go() { return fetch(path, { method: method, credentials: "same-origin", headers: hd, body: text }); }
    function parse(r) {
      return r.json().catch(function () { return null; }).then(function (data) {
        if (!r.ok) {
          var err = new Error((data && data.message) || "That didn't go through. Try again.");
          err.status = r.status; err.code = data && data.error; throw err;
        }
        return data;
      });
    }
    return go().then(function (r) {
      if (r.status !== 401) return parse(r);
      return fetch("/api/auth/guest", { method: "POST", credentials: "same-origin", headers: hd, body: "{}" }).then(function () { return go(); }).then(parse);
    });
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

  function mount(el, opts) {
    if (!el) return;
    opts = opts || {};
    var draft = { book: "Matthew", startChapter: 1, endChapter: 7, lengthDays: 7, custom: false, customAmount: "", customUnit: "weeks", version: "KJV", name: "",
      scope: "book", booksChosen: [], pace: false, paceAmount: "" };
    var notice = "";
    var view = null;        // the server's plan view for this person, or null when they are in no plan
    var loaded = false;     // false until the first read comes back
    var starting = false;   // true while the person is picking a portion for a new plan
    var busy = false;

    // The server's answer to "my plan". Everything on screen comes from it; nothing is kept on the device.
    function refresh() {
      return call("GET", "/api/v3/reading/plan").then(function (data) {
        view = data && data.plan ? data.plan : null;
        if (view) starting = false;
        loaded = true;
      }, function () {
        loaded = true;
        notice = "Reading plans aren't reachable right now. Try again in a moment.";
      });
    }

    function myDone() { return view ? view.myTicks : []; }
    // The first day not yet ticked by this person; a fresh reading starts at day 1.
    function firstOpenDay(days, ticks) {
      for (var i = 0; i < days.length; i++) if (ticks.indexOf(days[i].day) < 0) return i;
      return days.length - 1;
    }
    // Days ticked in a row up to the latest tick; a missed day breaks the run.
    function streakOf(days, ticks) {
      var last = 0;
      for (var j = 0; j < days.length; j++) if (ticks.indexOf(days[j].day) >= 0) last = j + 1;
      var run = 0;
      for (var m = last; m >= 1 && ticks.indexOf(m) >= 0; m--) run++;
      return run;
    }

    function lensHTML() {
      var lens = LENGTHS.map(function (n) {
        return '<button type="button" data-act="len" data-len="' + n + '" aria-pressed="' + (!draft.custom && !draft.pace && n === draft.lengthDays) + '">' + n + (n === 1 ? " day" : " days") + "</button>";
      }).join("") +
        '<button type="button" data-act="custom" aria-pressed="' + draft.custom + '">Custom</button>' +
        '<button type="button" data-act="pace" aria-pressed="' + draft.pace + '">Chapters a day</button>';
      return lens;
    }

    function inviteHTML() {
      return '<h2>Read with others</h2>' +
        '<p>Start a shared plan and send its code to up to ' + MEMBER_CAP + ' people, or enter a code someone sent you.</p>' +
        '<label>Your name<input id="br-name" maxlength="24" autocomplete="given-name" value="' + esc(draft.name) + '" placeholder="How the group sees you"></label>' +
        '<label>Plan code<input id="br-partner-code" maxlength="6" autocomplete="off" autocapitalize="characters"></label>' +
        '<button type="button" data-act="join">Join plan</button>' +
        '<p class="br-small">Or</p>' +
        '<button type="button" class="br-secondary" data-act="start">Start a new plan</button>';
    }

    function pickHTML() {
      var bookOpts = BOOKS.map(function (b) {
        return '<option value="' + esc(b.name) + '"' + (b.name === draft.book ? " selected" : "") + ">" + esc(b.name) + "</option>";
      }).join("");
      var customRow = draft.custom
        ? '<div class="br-row"><label>Number<input id="br-custom-n" type="number" min="1" step="1" inputmode="numeric" value="' + esc(draft.customAmount) + '"></label>' +
          '<label>Unit<select id="br-custom-unit">' + UNITS.map(function (u) {
            return '<option value="' + u + '"' + (u === draft.customUnit ? " selected" : "") + ">" + u + "</option>";
          }).join("") + "</select></label></div>"
        : "";
      var paceRow = draft.pace
        ? '<div class="br-row"><label>Chapters a day<input id="br-pace-n" type="number" min="1" step="1" inputmode="numeric" value="' + esc(draft.paceAmount) + '"></label></div>'
        : "";
      var vers = VERSIONS.map(function (v) {
        return '<option value="' + v.code + '"' + (v.code === draft.version ? " selected" : "") + ">" + v.code + (v.quiz ? "" : " (no duel yet)") + "</option>";
      }).join("");
      var scopeOpts = SCOPES.map(function (s2) {
        return '<option value="' + s2.code + '"' + (s2.code === draft.scope ? " selected" : "") + ">" + esc(s2.label) + "</option>";
      }).join("");
      var bookChecks = BOOKS.map(function (b) {
        return '<label class="br-bk"><input type="checkbox" value="' + esc(b.name) + '"' + (draft.booksChosen.indexOf(b.name) >= 0 ? " checked" : "") + "> " + esc(b.name) + "</label>";
      }).join("");
      return '<h2>Pick a portion</h2>' +
        '<label>Scope<select id="br-scope">' + scopeOpts + "</select></label>" +
        '<div id="br-sec-book"' + (draft.scope === "book" ? "" : " hidden") + ">" +
          '<label>Book<select id="br-book">' + bookOpts + "</select></label>" +
          '<div class="br-row"><label>From chapter<input id="br-from" type="number" min="1" value="' + draft.startChapter + '"></label>' +
          '<label>To chapter<input id="br-to" type="number" min="1" value="' + draft.endChapter + '"></label></div>' +
        "</div>" +
        '<div id="br-sec-books"' + (draft.scope === "books" ? "" : " hidden") + ">" +
          '<p class="br-small">Tick the books. They are read in Bible order.</p>' +
          '<div id="br-books" class="br-books">' + bookChecks + "</div>" +
        "</div>" +
        '<div class="br-lens" role="group" aria-label="Length">' + lensHTML() + "</div>" + customRow + paceRow +
        '<label>Version<select id="br-version">' + vers + "</select></label>" +
        '<p class="br-summary" id="br-summary"></p>' +
        '<button type="button" data-act="choose">Create this plan</button>' +
        '<p class="br-small">You become the plan owner. Everyone who joins with the code reads the same chapters.</p>';
    }

    function progressHTML() {
      var p = view.portion, days = view.days, ticks = myDone(), n = ticks.length;
      var today = firstOpenDay(days, ticks), td = days[today];
      var chapters = td.endChapter >= td.startChapter ? td.endChapter - td.startChapter + 1 : 0;
      var todayRef = chapters ? td.ref : "Catch-up day";
      var todayMeta = chapters ? chapters + (chapters === 1 ? " chapter" : " chapters") : "No new chapters today";
      var members = view.memberCount;
      var todayReaders = (view.days[today] || {}).readCount || 0;
      // Long plans: show a window of about 60 days around today, not every day.
      var from = Math.max(0, Math.min(today - 3, days.length - 60)), to = Math.min(days.length, from + 60);
      var rows = days.slice(from, to).map(function (d, k) {
        var i = from + k;
        var txt = d.endChapter >= d.startChapter ? d.ref : "Catch-up day";
        var readers = (view.days[i] || {}).readers || [];
        var mine = ticks.indexOf(d.day) >= 0;
        return '<li class="' + (mine ? "br-done" : "") + '">Day ' + d.day + ": " + esc(txt) +
          (mine ? ' <span class="br-tick" role="img" aria-label="done">' + ICON.check + "</span>" : "") +
          (readers.length ? '<span class="br-readers">' + readers.length + " of " + members + " read: " + esc(readers.join(", ")) + "</span>" : "") + "</li>";
      }).join("");
      var listNote = days.length > to - from
        ? '<p class="br-small">Showing days ' + (from + 1) + " to " + to + " of " + days.length + ".</p>" : "";
      var pct = Math.round((100 * n) / days.length), streak = streakOf(days, ticks);
      var action = '<button type="button" class="br-cta" data-act="day" data-day="' + td.day + '"' + (busy ? " disabled" : "") + ">" + ICON.check + " Mark as Read</button>";
      var invite = '<div class="br-card br-codecard" data-act="copy" role="button" tabindex="0" aria-label="Copy the plan code"><span class="br-ico">' + ICON.share + '</span><div><span class="br-cardlabel">Plan code</span><b class="br-code-s">' + esc(view.code) + '</b><span class="br-small">Tap code to copy. Up to ' + MEMBER_CAP + ' people can join with it.</span></div></div>';
      var people = view.members.map(function (m) {
        return '<li>' + esc(m.name) + (m.isYou ? " (you)" : "") + (m.role === "owner" ? ", plan owner" : "") + ": " + m.daysRead + " of " + days.length + (days.length === 1 ? " day" : " days") + "</li>";
      }).join("");
      return '<h2 class="br-title">Reading Plan</h2>' +
        '<p class="br-sub">Grow your faith. One chapter at a time.</p>' +
        '<div class="br-card br-today">' +
          '<p class="br-eyebrow">Today’s reading</p>' +
          '<h2 class="br-range">' + esc(todayRef) + "</h2>" +
          '<div class="br-meta"><span class="br-small">' + esc(todayMeta) + '</span><span class="br-pill">Day ' + td.day + " of " + days.length + "</span></div>" +
          '<p class="br-small">' + todayReaders + " of " + members + (members === 1 ? " member has" : " members have") + " read today.</p>" +
          action +
        "</div>" +
        '<div class="br-cards">' +
          '<div class="br-card"><span class="br-ico">' + ICON.flame + '</span><span class="br-cardlabel">Current streak</span><b class="br-cardnum">' + streak + (streak === 1 ? " day" : " days") + '</b><span class="br-small">Ticked in a row</span></div>' +
          '<div class="br-card"><span class="br-ico">' + ICON.book + '</span><span class="br-cardlabel">Plan progress</span><b class="br-cardnum">' + pct + '%</b><div class="br-bar" aria-hidden="true"><span style="width:' + pct + '%"></span></div><span class="br-small">' + n + " of " + days.length + (days.length === 1 ? " day" : " days") + "</span></div>" +
        "</div>" +
        invite +
        '<h3 class="br-h3">' + esc(refOf(p)) + " · " + esc(lengthLabelOf(p)) + "</h3>" +
        '<ol class="br-days">' + rows + "</ol>" + listNote +
        '<h3 class="br-h3">Shared progress</h3>' +
        '<p class="br-small">' + members + " of " + view.memberCap + " members in this plan.</p>" +
        '<ul class="br-people">' + people + "</ul>";
    }

    function finishHTML() {
      var p = view.portion;
      var quizOK = VERSIONS.some(function (v) { return v.code === p.version && v.quiz; });
      var duel = quizOK
        ? '<button type="button" data-act="duel">Start the reading duel</button>'
        : '<p class="br-small">Duels are KJV only for now. Switch this reading to KJV to duel.</p>';
      return '<h2>Finished ' + esc(refOf(p)) + "</h2>" +
        '<p>You read all ' + esc(lengthLabelOf(p)) + " of this portion.</p>" + duel;
    }

    function summary() {
      var el2 = document.getElementById("br-summary");
      if (!el2) return;
      var p = readDraft();
      var sb = document.getElementById("br-sec-book"), sm = document.getElementById("br-sec-books");
      if (sb) sb.hidden = draft.scope !== "book";
      if (sm) sm.hidden = draft.scope !== "books";
      var err = lengthFromDraft().error || portionError(p);
      if (err) { el2.textContent = err; return; }
      el2.textContent = refOf(p) + ": " + perDayText(p) + ", " + lengthLabelOf(p) + ", " + p.version + "." +
        (dailySplit(p).some(function (d) { return d.endChapter < d.startChapter; }) ? " Days after the last chapter are catch-up days." : "");
    }

    // The length as the person typed it, or the preset. Returns days, a label and an error if any.
    function lengthFromDraft() {
      if (draft.pace) {
        var chapters = scopePortion(draft).endChapter - scopePortion(draft).startChapter + 1;
        var raw0 = String(draft.paceAmount == null ? "" : draft.paceAmount).trim();
        if (!/^\d+$/.test(raw0) || Number(raw0) < 1) return { days: 0, label: "", pace: 0, error: "Enter a whole number of chapters a day, 1 or more." };
        var k = Number(raw0), days0 = Math.ceil(chapters / k);
        if (!(chapters >= 1)) return { days: 0, label: "", pace: k, error: "Pick the chapters first." };
        if (days0 > MAX_DAYS) return { days: days0, label: "", pace: k, error: "At this pace the plan runs past 10 years, so read more chapters a day." };
        return { days: days0, label: k + (k === 1 ? " chapter" : " chapters") + " a day", pace: k, error: null };
      }
      if (!draft.custom) return { days: draft.lengthDays, label: draft.lengthDays + (draft.lengthDays === 1 ? " day" : " days"), pace: null, error: null };
      var raw = String(draft.customAmount == null ? "" : draft.customAmount).trim();
      if (!/^\d+$/.test(raw) || Number(raw) < 1) return { days: 0, label: "", pace: null, error: "Enter a whole number of 1 or more for the length." };
      var n = Number(raw), u = draft.customUnit;
      if (UNITS.indexOf(u) < 0) return { days: 0, label: "", pace: null, error: "Pick hours, days, weeks, months or years." };
      var days = u === "hours" ? Math.ceil(n / 24) : n * DAYS_PER_UNIT[u];
      if (days > MAX_DAYS) return { days: days, label: "", pace: null, error: "A custom length goes up to 10 years." };
      var word = n === 1 ? u.replace(/s$/, "") : u;
      var note = u === "hours" || u === "months" || u === "years" ? " (" + days + (days === 1 ? " day" : " days") + ")" : "";
      return { days: days, label: n + " " + word + note, pace: null, error: null };
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
      if (g("br-scope") !== null) draft.scope = g("br-scope");
      if (g("br-pace-n") !== null) draft.paceAmount = g("br-pace-n");
      if (document.getElementById("br-books")) draft.booksChosen = Array.prototype.map.call(document.querySelectorAll("#br-books input:checked"), function (x) { return x.value; });
      if (g("br-name") !== null) draft.name = g("br-name");
      var sp = scopePortion(draft);
      var len = lengthFromDraft();
      return { scope: draft.scope, book: sp.book, startChapter: sp.startChapter, endChapter: sp.endChapter, names: sp.names,
        lengthDays: len.days, lengthLabel: len.label || undefined, chaptersPerDay: len.pace || undefined, version: draft.version };
    }

    function render() {
      var screen, html;
      var allDone = !!(view && view.days.length && myDone().length >= view.days.length);
      if (!loaded) { screen = "loading"; html = '<p class="br-small">Loading your reading…</p>'; }
      else if (view && !starting) { screen = allDone ? "finish" : "progress"; html = allDone ? finishHTML() : progressHTML(); }
      else if (starting) { screen = "pick"; html = pickHTML(); }
      else { screen = "invite"; html = inviteHTML(); }
      el.innerHTML = '<section class="br-screen br-' + screen + '" data-screen="' + screen + '">' +
        html + (notice ? '<p class="br-note" role="status">' + esc(notice) + "</p>" : "") + "</section>";
      notice = "";
    }

    // Each action: run the request, show a plain message on refusal, then redraw from the server's answer.
    function act(promise, after) {
      busy = true; render();
      return promise.then(function (data) {
        busy = false;
        if (data && data.plan !== undefined) { view = data.plan; }
        if (view) starting = false;
        if (after) after(data);
        render(); summary();
      }, function (err) {
        busy = false;
        notice = err.message || "That didn't go through. Try again.";
        render(); summary();
      });
    }

    el.addEventListener("click", function (ev) {
      var t = ev.target.closest ? ev.target.closest("[data-act]") : null;
      if (!t || busy) return;
      var a = t.getAttribute("data-act");
      if (a === "len") {
        readDraft(); draft.custom = false; draft.pace = false; draft.lengthDays = Number(t.getAttribute("data-len")); render(); summary(); return;
      }
      if (a === "custom") { readDraft(); draft.custom = true; draft.pace = false; render(); summary(); return; }
      if (a === "pace") { readDraft(); draft.custom = false; draft.pace = true; render(); summary(); return; }
      if (a === "start") { readDraft(); starting = true; notice = ""; render(); summary(); return; }
      if (a === "join") {
        var code = String((document.getElementById("br-partner-code") || {}).value || "").trim().toUpperCase();
        var nm = String((document.getElementById("br-name") || {}).value || "").trim();
        draft.name = nm;
        if (code.length !== 6) { notice = "Enter the six-letter plan code."; render(); return; }
        act(call("POST", "/api/v3/reading/join", { code: code, name: nm }));
        return;
      }
      if (a === "choose") {
        var p = readDraft(), err = lengthFromDraft().error || portionError(p);
        if (err) { notice = err; render(); summary(); return; }
        act(call("POST", "/api/v3/reading/plans", { name: draft.name, scope: p.scope, book: p.book, startChapter: p.startChapter, endChapter: p.endChapter, books: p.names || undefined, lengthDays: p.lengthDays, chaptersPerDay: p.chaptersPerDay, lengthLabel: p.lengthLabel || "", version: p.version }));
        return;
      }
      if (a === "day") {
        var day = Number(t.getAttribute("data-day"));
        act(call("POST", "/api/v3/reading/tick", { day: day }));
        return;
      }
      if (a === "copy") {
        var copied = function (ok) { notice = ok ? "Code copied." : "Copying isn't available here. The code is " + view.code + "."; render(); summary(); };
        try { navigator.clipboard.writeText(view.code).then(function () { copied(true); }, function () { copied(false); }); } catch (e) { copied(false); }
        return;
      }
      if (a === "duel") {
        if (typeof opts.startDuel === "function") opts.startDuel(view.portion);
        else { notice = "The duel is not connected to the quiz yet, so nothing has started."; render(); }
        return;
      }
    });
    el.addEventListener("change", summary);
    el.addEventListener("input", summary);

    render();
    refresh().then(function () { render(); summary(); });
  }

  window.BAReading = {
    screens: ["invite", "pick", "progress", "finish"],
    mount: mount,
  };
})();
