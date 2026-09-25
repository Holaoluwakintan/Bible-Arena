import { randomBytes } from "node:crypto";
import type { Express } from "express";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import * as db from "../db";
import { COOKIE_NAME } from "../../shared/const";
import { ENV } from "./env";
import { rateLimit } from "./rate-limit";

const pendingStates = new Map<string, { redirectUri: string; expiresAt: number }>();

function decodeState(state: string): { redirectUri: string; nonce: string } | null {
  try {
    const value = JSON.parse(Buffer.from(state, "base64").toString("utf8"));
    if (typeof value.redirectUri !== "string" || typeof value.nonce !== "string") return null;
    return value;
  } catch {
    return null;
  }
}

function isAllowedRedirect(redirectUri: string, req: { headers: Record<string, unknown> }): boolean {
  if (redirectUri.startsWith("manus") || redirectUri.startsWith("exp://")) return true;
  try {
    const url = new URL(redirectUri);
    const configured = new Set(ENV.allowedOrigins);
    const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : "";
    if (requestOrigin) configured.add(requestOrigin);
    return configured.has(url.origin) && url.pathname === "/api/oauth/callback";
  } catch {
    return false;
  }
}

function consumeState(state: string, req: { headers: Record<string, unknown> }): boolean {
  const decoded = decodeState(state);
  const pending = pendingStates.get(state);
  pendingStates.delete(state);
  if (!decoded || !pending || pending.expiresAt < Date.now()) return false;
  return pending.redirectUri === decoded.redirectUri && isAllowedRedirect(decoded.redirectUri, req);
}

async function exchangeAndCreateSession(code: string, state: string) {
  const tokenResponse = await sdk.exchangeCodeForToken(code, state);
  const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
  if (!userInfo.openId) throw new Error("OAuth provider did not return a user identity");
  await db.upsertUser({ openId: userInfo.openId, name: userInfo.name ?? null, email: userInfo.email ?? null, loginMethod: userInfo.loginMethod ?? null, lastSignedIn: new Date() });
  const sessionToken = await sdk.createSessionToken(userInfo.openId, { name: userInfo.name ?? "" });
  return { sessionToken, user: await db.getUserByOpenId(userInfo.openId) };
}

export function registerOAuthRoutes(app: Express): void {
  if (!ENV.oAuthServerUrl) {
    console.log("[OAuth] OAUTH_SERVER_URL not set — OAuth routes disabled. Guest login is active.");
    return;
  }
  const oauthLimit = rateLimit({ windowMs: 60_000, max: 20, name: "oauth" });

  app.get("/api/oauth/state", oauthLimit, (req, res) => {
    const redirectUri = typeof req.query.redirectUri === "string" ? req.query.redirectUri : "";
    if (!redirectUri || !isAllowedRedirect(redirectUri, req)) {
      res.status(400).json({ error: "Invalid OAuth redirect" });
      return;
    }
    const nonce = randomBytes(24).toString("base64url");
    const state = Buffer.from(JSON.stringify({ redirectUri, nonce }), "utf8").toString("base64");
    pendingStates.set(state, { redirectUri, expiresAt: Date.now() + 10 * 60_000 });
    res.json({ state });
  });

  app.get("/api/oauth/callback", oauthLimit, async (req, res) => {
    try {
      const { code, state } = req.query as { code?: string; state?: string };
      if (!code || !state || !consumeState(state, req)) { res.status(400).json({ error: "Invalid or expired OAuth state" }); return; }
      const { sessionToken } = await exchangeAndCreateSession(code, state);
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: 365 * 24 * 60 * 60 * 1000 });
      res.redirect("/");
    } catch (error) {
      console.error("[OAuth] Callback error:", error);
      res.status(400).json({ error: "OAuth callback failed" });
    }
  });

  app.get("/api/oauth/mobile", oauthLimit, async (req, res) => {
    try {
      const { code, state } = req.query as { code?: string; state?: string };
      if (!code || !state || !consumeState(state, req)) { res.status(400).json({ error: "Invalid or expired OAuth state" }); return; }
      const { sessionToken, user } = await exchangeAndCreateSession(code, state);
      res.json({ app_session_id: sessionToken, user });
    } catch (error) {
      console.error("[OAuth] Mobile callback error:", error);
      res.status(400).json({ error: "OAuth mobile callback failed" });
    }
  });

  app.post("/api/auth/session", oauthLimit, async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) { res.status(401).json({ error: "Missing token" }); return; }
    const token = authHeader.slice(7).trim();
    if (!await sdk.verifySession(token)) { res.status(401).json({ error: "Invalid token" }); return; }
    res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: 365 * 24 * 60 * 60 * 1000 });
    res.json({ ok: true });
  });
}
