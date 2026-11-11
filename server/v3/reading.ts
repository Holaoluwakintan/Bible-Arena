// Chever v3: shared reading plan routes. Same sign-in as the rest of the app (the guest or account session the web app
// already holds); the plan and tick rows live in reading-store.ts. Sends a plain message on every refusal.
import type { Express } from "express";
import { getDb } from "../db";
import { snapshotNow } from "../persist";
import { rateLimit } from "../_core/rate-limit";
import { createPlan, ensureReadingTables, joinPlan, planViewFor, tickDay, type ReadingResult } from "./reading-store";

type Me = { openId: string; name: string };
type Guard = (fn: (req: any, res: any, me: Me) => Promise<void>, needAuth?: boolean) => (req: any, res: any) => Promise<void>;
type Send = (res: any, status: number, body: unknown) => void;

let tablesReady = false;
function db() {
  const d = getDb();
  if (!tablesReady) { ensureReadingTables(d); tablesReady = true; }
  return d;
}
function persistSoon(reason: string) { snapshotNow(reason).catch(() => {}); }

export function registerReading(app: Express, guard: Guard, send: Send): void {
  const limitWrite = rateLimit({ windowMs: 60_000, max: 60, name: "v3-reading-write" });
  const limitRead = rateLimit({ windowMs: 60_000, max: 240, name: "v3-reading-read" });

  const answer = (res: any, r: ReadingResult<unknown>, ok: (v: any) => unknown) => {
    if (r.ok) return send(res, 200, ok(r.value));
    return send(res, r.status, { error: r.error, message: r.message });
  };

  app.get("/api/v3/reading/plan", limitRead, guard(async (_req, res, me) => {
    send(res, 200, planViewFor(db(), me.openId));
  }));

  app.post("/api/v3/reading/plans", limitWrite, guard(async (req, res, me) => {
    const b = req.body || {};
    const r = createPlan(db(), me.openId, b, Date.now());
    if (r.ok) persistSoon("reading-plan-create");
    answer(res, r, () => planViewFor(db(), me.openId));
  }));

  app.post("/api/v3/reading/join", limitWrite, guard(async (req, res, me) => {
    const b = req.body || {};
    const r = joinPlan(db(), me.openId, b.code, b.name, Date.now());
    if (r.ok && !r.value.already) persistSoon("reading-plan-join");
    answer(res, r, () => planViewFor(db(), me.openId));
  }));

  app.post("/api/v3/reading/tick", limitWrite, guard(async (req, res, me) => {
    const r = tickDay(db(), me.openId, (req.body || {}).day, Date.now());
    if (r.ok && r.value.newlyTicked) persistSoon("reading-tick");
    answer(res, r, () => planViewFor(db(), me.openId));
  }));
}
