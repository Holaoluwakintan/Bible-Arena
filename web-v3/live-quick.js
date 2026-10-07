/* Bible Arena Live — "quick quiz" text format, so a host can type this Sunday's questions fast.
   One question per block (blank line between). Mark the right answer with * (or ✓). Optional (Ref) at the end of the question.
     Who was swallowed by a great fish? (Jonah 1:17)
     *Jonah
     Peter
     Elijah
   "True"/"False" works too. 2–4 answers per question. */
(function (root) {
  "use strict";
  function parseQuick(text) {
    const out = [], errors = [];
    const blocks = String(text || "").replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean)).filter((b) => b.length);
    blocks.forEach((lines, bi) => {
      let q = lines[0].replace(/^(?:q(?:uestion)?\s*)?\d+\s*[.):-]\s*/i, "").trim();
      let r = "";
      const m = q.match(/\(([1-3]?\s?[A-Za-z][A-Za-z ]+\s\d+(?::\d+(?:[-–]\d+)?)?)\)\s*$/);
      if (m) { r = m[1].trim(); q = q.slice(0, m.index).trim(); }
      const o = []; let a = -1;
      lines.slice(1).forEach((raw) => {
        const refm = raw.match(/^(?:ref|reference|verse)\s*[:\-]\s*(.+)$/i);
        if (refm) { r = refm[1].trim(); return; }
        let s = raw.replace(/^[-•]\s*/, "").replace(/^[A-Da-d1-4]\s*[.)]\s+/, "");
        let mark = false;
        if (/^\*/.test(s) || /^✓/.test(s)) { mark = true; s = s.replace(/^[*✓]\s*/, ""); }
        if (/\*$/.test(s) || /✓$/.test(s) || /\((correct|answer)\)$/i.test(s)) { mark = true; s = s.replace(/\s*(\*|✓|\((correct|answer)\))$/i, ""); }
        s = s.trim();
        if (!s) return;
        if (mark && a === -1) a = o.length;
        o.push(s);
      });
      const n = bi + 1;
      if (!q) { errors.push(`Question ${n}: it has no question line.`); return; }
      if (o.length < 2) { errors.push(`Question ${n}: add at least 2 answers, one per line.`); return; }
      if (o.length > 4) { errors.push(`Question ${n}: at most 4 answers (it has ${o.length}).`); return; }
      if (a < 0) { errors.push(`Question ${n}: mark the right answer with * at the start, like *Jonah.`); return; }
      out.push({ q: q.slice(0, 240), o: o.map((x) => x.slice(0, 90)), a, r: r.slice(0, 60) });
    });
    return { questions: out, errors };
  }
  if (typeof module === "object" && module.exports) module.exports = { parseQuick };
  else root.parseQuick = parseQuick;
})(typeof window !== "undefined" ? window : globalThis);
