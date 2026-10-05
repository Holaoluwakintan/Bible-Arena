import { randomBytes } from "node:crypto";
import type { Express, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import * as db from "../db";
import { COOKIE_NAME } from "../../shared/const";
import { ENV } from "./env";
import { rateLimit } from "./rate-limit";
import { logger } from "./logger";

/**
 * Google OAuth 2.0 (authorization code flow, server side).
 * Configure with GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and PUBLIC_URL
 * (e.g. https://bible-arena.onrender.com). The redirect URI registered in
 * Google Cloud Console must be exactly `${PUBLIC_URL}/api/oauth/google/callback`.
 */
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const STATE_COOKIE = "ba_google_state";
const STATE_TTL_SECONDS = 600;
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function clientId() { return process.env.GOOGLE_CLIENT_ID?.trim() || ""; }
function clientSecret() { return process.env.GOOGLE_CLIENT_SECRET?.trim() || ""; }
export function isGoogleConfigured() { return Boolean(clientId() && clientSecret()); }

function publicUrl(req: Request): string {
  const configured = process.env.PUBLIC_URL?.trim() || process.env.RENDER_EXTERNAL_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return `${req.protocol}://${req.get("host")}`;
}

export function googleRedirectUri(req: Request) {
  return `${publicUrl(req)}/api/oauth/google/callback`;
}

function stateKey() {
  return new TextEncoder().encode(`google-state:${ENV.oauthStateSecret || ENV.cookieSecret}`);
}

// Native apps may only be sent back to their own deep-link schemes.
function isAllowedNativeReturn(value: string): boolean {
  try {
    const url = new URL(value);
    const scheme = url.protocol.replace(/:$/, "").toLowerCase();
    const extra = (process.env.NATIVE_RETURN_SCHEMES || "").split(",").map((s: string) => s.trim().toLowerCase()).filter(Boolean);
    return scheme.startsWith("manus") || scheme === "exp" || scheme === "biblearena" || extra.includes(scheme);
  } catch {
    return false;
  }
}

function page(res: Response, status: number, title: string, body: string) {
  res.status(status).setHeader("Cache-Control", "no-store");
  res.type("html").send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;background:#0f1115;color:#f2f2f2;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0"><div style="max-width:420px;padding:24px;text-align:center"><h2>${title}</h2><p style="color:#b8b8b8">${body}</p><p><a style="color:#e8b84a" href="/">Back to Bible Arena</a></p></div></body></html>`);
}

export function registerGoogleOAuth(app: Express): void {
  app.get("/api/oauth/config", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ google: isGoogleConfigured() });
  });

  app.get("/api/oauth/google/start", rateLimit({ windowMs: 60_000, max: 30, name: "google-start" }), async (req, res) => {
    if (!isGoogleConfigured()) {
      page(res, 503, "Google sign-in isn't set up yet", "The app owner still needs to add the Google client ID and secret. You can play as a guest meanwhile.");
      return;
    }
    const platform = req.query.platform === "native" ? "native" : "web";
    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "";
    if (platform === "native" && !isAllowedNativeReturn(returnTo)) {
      page(res, 400, "Sign-in link is invalid", "The app's return address was not recognised.");
      return;
    }
    const nonce = randomBytes(16).toString("hex");
    const state = await new SignJWT({ nonce, platform, returnTo: platform === "native" ? returnTo : "" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${STATE_TTL_SECONDS}s`)
      .sign(stateKey());
    // Bind the flow to this browser (CSRF protection).
    res.cookie(STATE_COOKIE, nonce, { ...getSessionCookieOptions(req), maxAge: STATE_TTL_SECONDS * 1000 });
    const url = new URL(GOOGLE_AUTH_URL);
    url.searchParams.set("client_id", clientId());
    url.searchParams.set("redirect_uri", googleRedirectUri(req));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    res.redirect(302, url.toString());
  });

  app.get("/api/oauth/google/callback", rateLimit({ windowMs: 60_000, max: 30, name: "google-callback" }), async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (typeof req.query.error === "string") {
      page(res, 400, "Google sign-in was cancelled", "No account was created. You can try again any time.");
      return;
    }
    if (!isGoogleConfigured() || !code || !state) {
      page(res, 400, "Sign-in could not finish", "The sign-in response was incomplete. Please try again.");
      return;
    }
    let payload: { nonce?: string; platform?: string; returnTo?: string };
    try {
      payload = (await jwtVerify(state, stateKey(), { algorithms: ["HS256"] })).payload as typeof payload;
    } catch {
      page(res, 400, "Sign-in expired", "That sign-in link expired. Please start again.");
      return;
    }
    const cookieNonce = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(`${STATE_COOKIE}=`))?.slice(STATE_COOKIE.length + 1);
    res.clearCookie(STATE_COOKIE, { ...getSessionCookieOptions(req), maxAge: -1 });
    if (payload.platform !== "native" && (!cookieNonce || cookieNonce !== payload.nonce)) {
      page(res, 400, "Sign-in could not be verified", "Please start sign-in again from the same browser.");
      return;
    }
    try {
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId(),
          client_secret: clientSecret(),
          redirect_uri: googleRedirectUri(req),
          grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) {
        logger.warn("google_token_exchange_failed", { status: tokenRes.status });
        page(res, 502, "Google sign-in failed", "Google did not accept the sign-in. Please try again.");
        return;
      }
      const tokens = (await tokenRes.json()) as { access_token?: string };
      const infoRes = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
      if (!infoRes.ok) {
        logger.warn("google_userinfo_failed", { status: infoRes.status });
        page(res, 502, "Google sign-in failed", "Could not read your Google profile. Please try again.");
        return;
      }
      const info = (await infoRes.json()) as { sub?: string; email?: string; email_verified?: boolean; name?: string; given_name?: string };
      if (!info.sub) {
        page(res, 502, "Google sign-in failed", "Google returned no account id.");
        return;
      }
      const openId = `google_${info.sub}`;
      const name = (info.name || info.given_name || (info.email ? info.email.split("@")[0] : "") || "Player").slice(0, 80);
      await db.upsertUser({
        openId,
        name,
        email: info.email_verified ? info.email ?? null : null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });
      const token = await sdk.createSessionToken(openId, { name, expiresInMs: SESSION_MAX_AGE_MS });
      if (payload.platform === "native" && payload.returnTo && isAllowedNativeReturn(payload.returnTo)) {
        const user = await db.getUserByOpenId(openId);
        const back = new URL(payload.returnTo);
        back.searchParams.set("sessionToken", token);
        if (user) back.searchParams.set("user", Buffer.from(JSON.stringify(user)).toString("base64"));
        res.redirect(302, back.toString());
        return;
      }
      res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: SESSION_MAX_AGE_MS });
      res.redirect(302, "/profile");
    } catch (error) {
      logger.error("google_oauth_failed", { error: error instanceof Error ? error.message : String(error) });
      page(res, 500, "Google sign-in failed", "Something went wrong on our side. Please try again.");
    }
  });
}
