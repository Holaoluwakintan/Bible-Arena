// Bible Arena v3 end-to-end smoke test: two guest players, a scored round, a pastor duel
// (create, live progress, both submit, compare, rematch), leaderboards and the share page.
// Usage: node scripts/v3-smoke.mjs https://bible-arena.onrender.com   (prints JSON; exit code 1 on failure)
const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const WORD = /[A-Za-z\u2019]+/g;
const results = [];
const ok = (name, cond, info) => { results.push({ name, ok: !!cond, info }); if (!cond) console.error("FAIL", name, info ?? ""); };
function client(label) {
  let cookie = "";
  return {
    label,
    async call(path, body) {
      const r = await fetch(BASE + path, { method: body ? "POST" : "GET", headers: { "content-type": "application/json", "x-client-platform": "web", cookie }, body: body ? JSON.stringify(body) : undefined, redirect: "manual" });
      const set = r.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
      let data = null; try { data = await r.json(); } catch {}
      return { status: r.status, data };
    },
  };
}
const bank = (await (await fetch(BASE + "/v3/bank.json")).json()).items;
const BY = Object.fromEntries(bank.map((i) => [i.id, i]));
ok("bank loads", bank.length > 600, bank.length);
const right = (it, tier) => it.k === "gap" ? it.g[tier].blanks.map((i) => it.text.match(WORD)[i]) : it.a;
const answersFor = (ids, tier, wrong = []) => ids.map((id, n) => {
  const it = BY[id]; let c = right(it, tier);
  if (wrong.includes(n)) c = it.k === "gap" ? ["zzz"] : it.k === "tf" ? (c === "myth" ? "fact" : "myth") : typeof c === "number" ? (c + 1) % it.o.length : "0>1>2>3";
  return { id, choice: c, ms: 4000 + n * 300, clues: 2 };
});
const A = client("A"), B = client("B");
for (const [c, name] of [[A, "Smoke Test Pastor A"], [B, "Smoke Test Pastor B"]]) {
  const g = await c.call("/api/auth/guest", {});
  ok(`${c.label} guest session`, g.status === 200, g.status);
  const p = await c.call("/api/v3/player", { name, church: "Smoke Test Church", tier: "t" });
  ok(`${c.label} player saved`, p.status === 200 && p.data.player.name === name, p.status);
}
const ids = bank.filter((i) => i.m === "gap").slice(0, 2).map((i) => i.id).concat(bank.filter((i) => i.m === "who" && i.tiers.includes("t")).slice(0, 2).map((i) => i.id));
const round = await A.call("/api/v3/round", { mode: "mixed", tier: "t", answers: answersFor(ids, "t", [1]) });
ok("round scored server-side", round.status === 200 && round.data.correct === 3 && round.data.total === 4, round.data && { score: round.data.score, correct: round.data.correct });
const duel = await A.call("/api/v3/duels", { mode: "mixed", tier: "t", name: "Smoke Test Pastor A" });
ok("duel created", duel.status === 200 && duel.data.ids.length === 10, duel.data);
const code = duel.data.code;
const subA = await A.call(`/api/v3/duels/${code}/submit`, { name: "Smoke Test Pastor A", answers: answersFor(duel.data.ids, "t", [2, 5]) });
ok("creator submitted", subA.status === 200 && subA.data.correct === 8, subA.data && subA.data.correct);
const share = await fetch(`${BASE}/d/${code}`).then((r) => r.text());
ok("share page has OG preview", /og:title" content="Smoke Test Pastor A scored/.test(share) && /og:image" content="https?:\/\/[^"]+og-duel\.jpg"/.test(share));
const view = await B.call(`/api/v3/duels/${code}`);
ok("challenger sees the same questions", view.status === 200 && view.data.ids.join() === duel.data.ids.join());
await B.call(`/api/v3/duels/${code}/progress`, { i: 3, score: 600, correct: 3, name: "Smoke Test Pastor B" });
const live = await A.call(`/api/v3/duels/${code}`);
ok("live progress visible to creator", live.data.entries.some((e) => !e.isMe && e.progress === 3 && !e.finished));
const subB = await B.call(`/api/v3/duels/${code}/submit`, { name: "Smoke Test Pastor B", answers: answersFor(duel.data.ids, "t", [4]) });
ok("challenger submitted + compare", subB.status === 200 && subB.data.duel.entries.filter((e) => e.finished).length === 2, subB.data && subB.data.duel.entries.map((e) => [e.name, e.score]));
ok("challenger won (9 vs 8 correct)", subB.data.duel.entries[0].isMe && subB.data.player.stats.duelsWon === 1, subB.data.player.stats);
const again = await B.call(`/api/v3/duels/${code}/submit`, { answers: [] });
ok("no double submit", again.status === 409);
const rm = await B.call("/api/v3/duels", { mode: "mixed", tier: "t", parent: code, name: "Smoke Test Pastor B" });
ok("rematch created", rm.status === 200 && rm.data.code !== code);
for (const scope of ["week", "all", "church", "rivals", "daily"]) {
  const lb = await A.call(`/api/v3/leaderboard?scope=${scope}`);
  ok(`leaderboard ${scope}`, lb.status === 200, lb.status);
}
const riv = await A.call("/api/v3/leaderboard?scope=rivals");
ok("rivals shows head-to-head", riv.data.rows.some((r) => r.name === "Smoke Test Pastor B" && r.losses === 1), riv.data.rows);
const mine = await A.call("/api/v3/duels/mine");
ok("my duels lists it", mine.data.duels.some((d) => d.code === code));
const daily = await B.call("/api/v3/daily");
ok("daily set of 10", daily.status === 200 && daily.data.ids.length === 10);
console.log(JSON.stringify({ base: BASE, code, rematch: rm.data.code, passed: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results }, null, 1));
process.exit(results.every((r) => r.ok) ? 0 : 1);
