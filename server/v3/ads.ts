// Bible Arena v3.8.3: opt-in rewarded ads, relay only (Android app 1.4.0+; the website itself shows no ads).
// The app's native ad screen reports how an ad ended for a one-time nonce the page made: open / reward / dismiss / unavailable.
// The page polls GET /api/v3/ads/relay?n=NONCE and gives its reward only on "reward".
// Rewards are practice-only (a hint in Practice, a just-for-fun bonus life in Sudden Death with the score frozen at the miss),
// so nothing here touches XP, ranks, leagues, duels or boards, and the server never needs to trust it for scoring.
// In memory only (a few minutes per nonce); a restart just means "no answer", which the page treats as no reward.
// SSV hook: the app sets AdMob server-side-verification customData = "<nonce>:<reason>"; with SSV on for the real ad unit,
// Google's signed callback can be verified here later.
import type { Express, Request, Response, RequestHandler } from "express";

export const AD_STATES = ["open", "reward", "dismiss", "unavailable"] as const;
type AdState = (typeof AD_STATES)[number];
const NONCE = /^[A-Za-z0-9_-]{16,64}$/;
const REASON = /^[a-z0-9_-]{1,24}$/;
const TTL_MS = 15 * 60_000;
const MAX = 5000;

export type Relay = { set(n: string, s: string, r?: string, now?: number): AdState | null; get(n: string, now?: number): AdState | null; size(): number };

export function makeRelay(): Relay {
  const m = new Map<string, { s: AdState; r: string; t: number }>();
  const prune = (now: number) => {
    for (const [k, v] of m) { if (now - v.t > TTL_MS) m.delete(k); else break; }
    while (m.size >= MAX) { const k = m.keys().next().value as string; m.delete(k); }
  };
  return {
    set(n, s, r = "reward", now = Date.now()) {
      if (!NONCE.test(n) || !(AD_STATES as readonly string[]).includes(s)) return null;
      prune(now);
      const cur = m.get(n);
      // "reward" is final; a late "open" never overwrites an ending.
      if (cur && cur.s === "reward") return "reward";
      if (cur && cur.s !== "open" && s === "open") return cur.s;
      m.delete(n);
      m.set(n, { s: s as AdState, r: REASON.test(r) ? r : "reward", t: now });
      return s as AdState;
    },
    get(n, now = Date.now()) {
      if (!NONCE.test(n)) return null;
      const cur = m.get(n);
      if (!cur || now - cur.t > TTL_MS) return null;
      return cur.s;
    },
    size: () => m.size,
  };
}

export function registerAds(app: Express, limitPost: RequestHandler, limitGet: RequestHandler, relay: Relay = makeRelay()): Relay {
  app.post("/api/v3/ads/relay", limitPost, (req: Request, res: Response) => {
    const b = (req.body || {}) as Record<string, unknown>;
    const s = relay.set(String(b.n || ""), String(b.s || ""), String(b.r || ""));
    res.setHeader("Cache-Control", "no-store");
    if (!s) return res.status(400).json({ ok: false });
    res.status(200).json({ ok: true, s });
  });
  app.get("/api/v3/ads/relay", limitGet, (req: Request, res: Response) => {
    const n = String(req.query.n || "");
    res.setHeader("Cache-Control", "no-store");
    if (!NONCE.test(n)) return res.status(400).json({ ok: false });
    res.status(200).json({ ok: true, s: relay.get(n) });
  });
  return relay;
}
