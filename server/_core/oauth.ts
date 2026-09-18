import type { Express } from "express";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import * as db from "../db";
import { COOKIE_NAME } from "../../shared/const";
import { ENV } from "./env";

export function registerOAuthRoutes(app: Express): void {
  if (!ENV.oAuthServerUrl) {
    console.log("[OAuth] OAUTH_SERVER_URL not set — OAuth routes disabled. Guest login is active.");
    return;
  }

  app.get("/api/oauth/callback", async (req, res) => {
    try {
      const { code, state } = req.query as { code?: string; state?: string };
      if (!code || !state) {
        res.status(400).json({ error: "Missing code or state" });
        return;
      }

      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name ?? null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, { name: userInfo.name ?? "" });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
      res.redirect("/");
    } catch (error) {
      console.error("[OAuth] Callback error:", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });

  app.get("/api/oauth/mobile", async (req, res) => {
    try {
      const { code, state } = req.query as { code?: string; state?: string };
      if (!code || !state) {
        res.status(400).json({ error: "Missing code or state" });
        return;
      }
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name ?? null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? null,
        lastSignedIn: new Date(),
      });
      const app_session_id = await sdk.createSessionToken(userInfo.openId, { name: userInfo.name ?? "" });
      const user = await db.getUserByOpenId(userInfo.openId);
      res.json({ app_session_id, user });
    } catch (error) {
      console.error("[OAuth] Mobile callback error:", error);
      res.status(500).json({ error: "OAuth mobile callback failed" });
    }
  });

  app.post("/api/auth/session", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing token" });
        return;
      }
      const token = authHeader.slice(7);
      const session = await sdk.verifySession(token);
      if (!session) {
        res.status(401).json({ error: "Invalid token" });
        return;
      }
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: 365 * 24 * 60 * 60 * 1000 });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to set session" });
    }
  });
}
