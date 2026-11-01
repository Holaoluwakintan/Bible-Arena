// v3.12.0: sliding sessions. Before, the session cookie (guest and Google) lived 30 days from sign-in and was never renewed,
// so on day 31 the app silently started a brand-new empty guest: a guest's record was then unreachable, and a Google
// player had to find "Sign in" again. Now every app open (/api/v3/me) re-issues a one-year session when the current one
// has less than ~11 months left (so it is not re-signed on every request).
import type { Request, Response } from "express";
import { decodeJwt } from "jose";
import { sdk } from "./sdk";
import { getSessionCookieOptions } from "./cookies";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const";

export const SESSION_MS = ONE_YEAR_MS;
const RENEW_WHEN_LEFT_MS = 335 * 24 * 60 * 60 * 1000;

function readCookie(req: Request, name: string): string | undefined {
  for (const part of String(req.headers.cookie || "").split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) { try { return decodeURIComponent(part.slice(i + 1)); } catch { return part.slice(i + 1); } }
  }
  return undefined;
}

/** Re-issue the session cookie for another year when it is getting old. Cookie sessions only (Bearer tokens are the native app's). Never throws. */
export async function renewSession(req: Request, res: Response, now = Date.now()): Promise<boolean> {
  try {
    if (typeof req.headers.authorization === "string" && req.headers.authorization.startsWith("Bearer ")) return false;
    const token = readCookie(req, COOKIE_NAME);
    const s = await sdk.verifySession(token);
    if (!s || !token) return false;
    const exp = Number(decodeJwt(token).exp || 0) * 1000;
    if (exp - now > RENEW_WHEN_LEFT_MS) return false;
    const fresh = await sdk.createSessionToken(s.openId, { name: s.name, expiresInMs: SESSION_MS });
    res.cookie(COOKIE_NAME, fresh, { ...getSessionCookieOptions(req), maxAge: SESSION_MS });
    return true;
  } catch {
    return false;
  }
}
