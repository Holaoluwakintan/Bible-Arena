import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import express from "express";
import type { AddressInfo } from "node:net";
import * as E from "../server/v3/live-engine";
import * as S from "../server/v3/safety";
import { badName } from "../server/v3/names";
import { registerLive } from "../server/v3/live";

// v3.9.0 player safety: names, device tags, block, report, voice roster filtering (Google Play UGC rules)

describe("badName (player display names)", () => {
  it("catches rude names, spaced and leet spellings", () => {
    for (const n of ["fuck", "F u c k", "B1tch", "sh1t", "BigFuck99", "ashawo", "Olosho King", "s3x", "nigga", "p0rn star", "dick", "Mumu"]) expect(badName(n), n).toBe(true);
  });
  it("keeps Bible and ordinary names", () => {
    for (const n of ["Shittim", "Grace", "Grape Vine", "Dickson", "Sussex", "Peniel", "Hittite", "Esther", "Michael", "Ade Johnson", "Cockpit Crew", "Scunthorpe Saints", "Player 2", "Analysis", "Skillful"]) expect(badName(n), n).toBe(false);
  });
  it("live rooms refuse a rude name", () => {
    const r = E.createRoom({ code: "111111", title: "t", questions: [{ id: "q", type: "mc", q: "?", o: ["a", "b"], a: 0 }], timer: 20, now: 1 });
    expect(E.joinRoom(r, { name: "B1tch" }, 1).ok).toBe(false);
    expect(E.joinRoom(r, { name: "Shittim" }, 1).ok).toBe(true);
  });
});

describe("device tags, blocks, reports (in-memory store)", () => {
  beforeAll(() => S._setStore(S.memoryStore()));
  it("tags are stable, one-way and need a real id", () => {
    const a = S.deviceTag("abcdefghijklmnopqrstuv");
    expect(a).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(S.deviceTag("abcdefghijklmnopqrstuv")).toBe(a);
    expect(S.deviceTag("short")).toBe("");
    expect(a).not.toContain("abcdefgh");
  });
  it("a block works both ways and can be undone", () => {
    expect(S.blockedPair("aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb")).toBe(false);
    S.setBlock("aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb", true);
    expect(S.blockedPair("aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb")).toBe(true);
    expect(S.blockedPair("bbbbbbbbbbbbbbbb", "aaaaaaaaaaaaaaaa")).toBe(true);
    expect(S.blockedPair("", "")).toBe(false);
    S.setBlock("aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb", false);
    expect(S.blockedPair("aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb")).toBe(false);
  });
  it("blocks survive a restart (reloaded from the store)", () => {
    const st = S.memoryStore();
    S._setStore(st); S.setBlock("cccccccccccccccc", "dddddddddddddddd", true);
    S._setStore(st); // fresh in-memory map, same storage
    expect(S.blockedPair("dddddddddddddddd", "cccccccccccccccc")).toBe(true);
  });
  it("reports are saved once per 10 minutes per reporter/player/room; reasons and notes are cleaned", () => {
    const st = S.memoryStore(); S._setStore(st);
    const base = { room: "123456", reporter_tag: "r1", reporter_name: "Ada", target_id: "p1", target_tag: "t1", target_name: "Bob", in_voice: 1 };
    expect(S.addReport({ ...base, reason: S.cleanReason("bullying"), note: S.cleanNote("  said <b>bad</b>\n things ") }, 1000).dup).toBe(false);
    expect(S.addReport({ ...base, reason: "other", note: "" }, 2000).dup).toBe(true);
    expect(S.addReport({ ...base, reason: "other", note: "" }, 1000 + 601_000).dup).toBe(false);
    expect(st.reports[0].note).toBe("said b bad /b things");
    expect(S.cleanReason("nonsense")).toBe("other");
    expect(S.listReports(10, "open").length).toBe(2);
    expect(S.setReportStatus(st.reports[0].id, "done")).toBe(true);
    expect(S.listReports(10, "open").length).toBe(1);
  });
  it("3 different reporters in one room = out of that room's voice", () => {
    expect(S.noteRoomReport("222222", "x", "r1")).toBe(1);
    expect(S.noteRoomReport("222222", "x", "r1")).toBe(1);
    S.noteRoomReport("222222", "x", "r2");
    expect(S.voiceBanned("222222", "x")).toBe(false);
    S.noteRoomReport("222222", "x", "r3");
    expect(S.voiceBanned("222222", "x")).toBe(true);
    expect(S.voiceBanned("333333", "x")).toBe(false);
  });
});

describe("HTTP: voice rooms with block and report", () => {
  let base = "", srv: any;
  const bank = JSON.parse(fs.readFileSync(new URL("../web-v3/bank.json", import.meta.url), "utf8")).items;
  beforeAll(async () => {
    S._setStore(S.memoryStore());
    const app = express(); app.use(express.json());
    registerLive(app, () => bank, new URL("../web-v3/", import.meta.url).pathname);
    await new Promise<void>((ok) => { srv = app.listen(0, "127.0.0.1", () => ok()); });
    base = "http://127.0.0.1:" + (srv.address() as AddressInfo).port;
  });
  afterAll(() => srv && srv.close());
  const post = async (path: string, body: unknown, dev?: string) => {
    const r = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json", ...(dev ? { "x-ba-d": dev } : {}) }, body: JSON.stringify(body) });
    return { status: r.status, j: await r.json() as any };
  };
  const D = (c: string) => c.repeat(22);
  it("block hides two players from each other's voice roster and drops signals; report saves; 3 reports remove from voice", async () => {
    const c = await post("/lv/ko", { name: "Ada", tier: "s" }, D("a"));
    expect(c.status).toBe(200);
    const code = c.j.code;
    const A = { t: c.j.token, id: c.j.id };
    const jb = await post(`/lv/r/${code}/join`, { name: "Bola" }, D("b")); const B = { t: jb.j.token, id: jb.j.id };
    const jc = await post(`/lv/r/${code}/join`, { name: "Chi" }, D("c")); const Cc = { t: jc.j.token, id: jc.j.id };
    const jd = await post(`/lv/r/${code}/join`, { name: "Dayo" }, D("d")); const Dd = { t: jd.j.token, id: jd.j.id };
    for (const p of [A, B, Cc, Dd]) expect((await post(`/lv/r/${code}/vc`, { t: p.t, a: "join" })).status).toBe(200);
    let r = await post(`/lv/r/${code}/vc`, { t: A.t, a: "mute", m: true });
    expect(r.j.roster.list.map((x: any) => x.id).sort()).toEqual([A.id, B.id, Cc.id, Dd.id].sort());
    const bTag = r.j.roster.list.find((x: any) => x.id === B.id).k;
    expect(bTag).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(bTag).toBe(S.deviceTag(D("b")));
    // A blocks B
    expect((await post("/lv/block", { k: bTag, on: true, code }, D("a"))).j.ok).toBe(true);
    r = await post(`/lv/r/${code}/vc`, { t: A.t, a: "mute", m: true });
    expect(r.j.roster.list.map((x: any) => x.id)).not.toContain(B.id);
    r = await post(`/lv/r/${code}/vc`, { t: B.t, a: "mute", m: true });
    expect(r.j.roster.list.map((x: any) => x.id)).not.toContain(A.id);
    expect(r.j.roster.list.map((x: any) => x.id)).toContain(Cc.id);
    // a signal from B to A is dropped; B to C goes through
    await post(`/lv/r/${code}/vc`, { t: B.t, a: "sig", list: [{ to: A.id, d: { k: "hello" } }, { to: Cc.id, d: { k: "hello" } }] });
    const boxA = (await fetch(`${base}/lv/r/${code}/vc?t=${A.t}`).then((x) => x.json())) as any;
    expect(boxA.box.filter((m: any) => m.type === "sig" && m.from === B.id).length).toBe(0);
    const boxC = (await fetch(`${base}/lv/r/${code}/vc?t=${Cc.t}`).then((x) => x.json())) as any;
    expect(boxC.box.filter((m: any) => m.type === "sig" && m.from === B.id).length).toBe(1);
    // the block follows B into a NEW room (same phone ids)
    const c2 = await post("/lv/ko", { name: "Ada", tier: "s" }, D("a"));
    const b2 = await post(`/lv/r/${c2.j.code}/join`, { name: "Bola" }, D("b"));
    await post(`/lv/r/${c2.j.code}/vc`, { t: c2.j.token, a: "join" });
    const rb = await post(`/lv/r/${c2.j.code}/vc`, { t: b2.j.token, a: "join" });
    expect(rb.j.roster.list.map((x: any) => x.id)).not.toContain(c2.j.id);
    // reports: bad input, then 3 different reporters take D out of voice
    expect((await post(`/lv/r/${code}/report`, { t: A.t, to: A.id, reason: "spam" }, D("a"))).status).toBe(400);
    expect((await post(`/lv/r/${code}/report`, { t: "nope", to: Dd.id, reason: "spam" }, D("a"))).status).toBe(404);
    expect((await post(`/lv/r/${code}/report`, { t: A.t, to: Dd.id, reason: "language", note: "swore" }, D("a"))).j).toEqual({ ok: true, dup: false });
    expect((await post(`/lv/r/${code}/report`, { t: A.t, to: Dd.id, reason: "language" }, D("a"))).j.dup).toBe(true);
    await post(`/lv/r/${code}/report`, { t: B.t, to: Dd.id, reason: "bullying" }, D("b"));
    r = await post(`/lv/r/${code}/vc`, { t: A.t, a: "mute", m: true });
    expect(r.j.roster.list.map((x: any) => x.id)).toContain(Dd.id);
    await post(`/lv/r/${code}/report`, { t: Cc.t, to: Dd.id, reason: "hate" }, D("c"));
    r = await post(`/lv/r/${code}/vc`, { t: A.t, a: "mute", m: true });
    expect(r.j.roster.list.map((x: any) => x.id)).not.toContain(Dd.id);
    const back = await post(`/lv/r/${code}/vc`, { t: Dd.t, a: "join" });
    expect(back.status).toBe(403); expect(back.j.code).toBe("banned");
    expect(S.listReports(50, "open").filter((x) => x.room === code).length).toBe(3);
    // batch re-sync of blocks from the phone; unblock
    expect((await post("/lv/block", { list: [bTag, "bad"], on: true }, D("a"))).j.added).toBe(0);
    expect((await post("/lv/block", { k: bTag, on: false }, D("a"))).j.on).toBe(false);
    r = await post(`/lv/r/${code}/vc`, { t: A.t, a: "mute", m: true });
    expect(r.j.roster.list.map((x: any) => x.id)).toContain(B.id);
    expect((await post("/lv/block", { k: bTag }, undefined)).status).toBe(400);
  });
  it("a body-supplied dk is ignored (only the header counts)", async () => {
    const c = await post("/lv/ko", { name: "Eve", tier: "s" }, D("e"));
    const j = await post(`/lv/r/${c.j.code}/join`, { name: "Fola", dk: "aaaaaaaaaaaaaaaa" });
    await post(`/lv/r/${c.j.code}/vc`, { t: j.j.token, a: "join" });
    const r = await post(`/lv/r/${c.j.code}/vc`, { t: j.j.token, a: "mute", m: true });
    expect(r.j.roster.list.find((x: any) => x.id === j.j.id).k).toBe("");
  });
});
