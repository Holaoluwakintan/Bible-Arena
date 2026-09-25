import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import * as db from "../db";
import { COOKIE_NAME } from "../../shared/const";
import { rateLimit } from "./rate-limit";

const GUEST_OPEN_ID_PREFIX = "guest_";

export function registerGuestAuth(app: Express): void {
  app.post("/api/auth/guest", rateLimit({ windowMs: 60_000, max: 10, name: "guest-login" }), async (req, res) => {
    try {
      const openId = `${GUEST_OPEN_ID_PREFIX}${randomUUID()}`;
      await db.upsertUser({ openId, name: "Guest Player", loginMethod: "guest", lastSignedIn: new Date() });
      const token = await sdk.createSessionToken(openId, { name: "Guest Player" });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
      const user = await db.getUserByOpenId(openId);
      const isWeb = req.headers["x-client-platform"] === "web";
      res.json({ ok: true, ...(isWeb ? {} : { token }), user });
    } catch (error) {
      console.error("[GuestAuth] Failed to authenticate guest:", error);
      res.status(500).json({ error: "Failed to create guest session" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const user = await sdk.authenticateRequest(req as never).catch(() => null);
    res.json({ user: user || null });
  });

  app.post("/api/auth/logout", rateLimit({ windowMs: 60_000, max: 20, name: "logout" }), (req, res) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ ok: true });
  });
}
