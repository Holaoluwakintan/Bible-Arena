import { describe, it, expect, vi } from "vitest";
import { SignJWT, jwtVerify } from "jose";

// sdk pulls in the whole server (SQLite, axios); this stand-in signs/verifies exactly like sdk.signSession/verifySession.
const KEY = new TextEncoder().encode("local-test-secret-0123456789abcdef");
vi.mock("../server/_core/sdk", () => ({
  sdk: {
    createSessionToken: async (openId: string, o: { name?: string; expiresInMs?: number } = {}) =>
      new SignJWT({ openId, appId: "app", name: o.name || "" }).setSubject(openId).setIssuer("bible-arena").setAudience("app")
        .setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(Math.floor((Date.now() + (o.expiresInMs ?? 365 * 864e5)) / 1000)).sign(KEY),
    verifySession: async (t?: string) => { if (!t) return null; try { const { payload } = await jwtVerify(t, KEY, { issuer: "bible-arena", audience: "app" }); return { openId: String(payload.openId), appId: "app", name: String(payload.name || "") }; } catch { return null; } },
  },
}));

describe("v3.12.0 sliding session", () => {
  it("re-issues an old (30-day) session for a year, re-sets a long one's cookie, ignores bad cookies and Bearer", async () => {
    const { sdk } = await import("../server/_core/sdk");
    const { renewSession } = await import("../server/_core/session-renew");
    const { COOKIE_NAME } = await import("../shared/const");
    const mk = (cookie: string) => ({ headers: { cookie }, protocol: "https", get: () => "x" } as any);
    const res = () => { const r: any = { set: [] as any[] }; r.cookie = (n: string, v: string, o: any) => r.set.push({ n, v, o }); return r; };
    const old = await sdk.createSessionToken("guest_test", { name: "Guest Player", expiresInMs: 30 * 864e5 });
    const r1 = res(); expect(await renewSession(mk(`a=1; ${COOKIE_NAME}=${old}`), r1)).toBe(true);
    expect(r1.set[0].n).toBe(COOKIE_NAME); expect(r1.set[0].o.maxAge).toBeGreaterThan(360 * 864e5); expect(r1.set[0].o.httpOnly).toBe(true);
    const again = await sdk.verifySession(r1.set[0].v); expect(again?.openId).toBe("guest_test");
    // a 1-year token in a 30-day cookie (how guest sessions were made before 3.12.0): the same token, cookie extended
    const r2 = res(); expect(await renewSession(mk(`${COOKIE_NAME}=${r1.set[0].v}`), r2)).toBe(true);
    expect(r2.set[0].v).toBe(r1.set[0].v); expect(r2.set[0].o.maxAge).toBeGreaterThan(360 * 864e5); expect(r2.set[0].o.maxAge).toBeLessThanOrEqual(365 * 864e5);
    const r3 = res(); expect(await renewSession(mk(`${COOKIE_NAME}=garbage`), r3)).toBe(false); expect(r3.set.length).toBe(0);
    const r4 = res(); expect(await renewSession({ headers: { authorization: `Bearer ${old}` } } as any, r4)).toBe(false);
  });
});
