import type { Express } from "express";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import * as db from "../db";
import { COOKIE_NAME } from "../../shared/const";

const GUEST_OPEN_ID_PREFIX = "guest_";

function generateGuestId(seed?: string): string {
  const id = seed ?? Math.random().toString(36).slice(2, 10);
  return `${GUEST_OPEN_ID_PREFIX}${id}`;
}

export function registerGuestAuth(app: Express): void {
  app.post("/api/auth/guest", async (req, res) => {
    try {
      const seed: string | undefined = req.body?.seed;
      const openId = generateGuestId(seed);

      await db.upsertUser({
        openId,
        name: "Guest Player",
        loginMethod: "guest",
        lastSignedIn: new Date(),
      });

      const token = await sdk.createSessionToken(openId, { name: "Guest Player" });
      const cookieOptions = getSessionCookieOptions(req);

      res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      const user = await db.getUserByOpenId(openId);
      res.json({ ok: true, token, user });
    } catch (error) {
      console.error("[GuestAuth] Failed to authenticate guest:", error);
      res.status(500).json({ error: "Failed to create guest session" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req as never).catch(() => null);
      res.json({ user: user || null });
    } catch {
      res.json({ user: null });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    res.json({ ok: true });
  });
}
