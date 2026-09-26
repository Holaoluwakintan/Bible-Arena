import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";

process.env.NODE_ENV = "test";
process.env.SQLITE_PATH = `/tmp/bible-arena-security-${randomUUID()}.sqlite`;
process.env.ALLOWED_ORIGINS = "http://localhost:3000,http://localhost:8081";

async function main() {
  const [{ createApp }, { ENV }, { sdk }, db, { recordAuthoritativeSession }, { getVerifiedQuestionById }] = await Promise.all([
    import("../server/_core/index"),
    import("../server/_core/env"),
    import("../server/_core/sdk"),
    import("../server/db"),
    import("../server/authoritative-session"),
    import("../domain/questions"),
  ]);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Security smoke failure: ${message}`);
}

  const app = createApp();
  const sqlite = db.getDb();
  assert(String((sqlite.prepare("PRAGMA journal_mode").get() as any).journal_mode).toLowerCase() === "wal", "SQLite WAL mode must be enabled");
  assert(Number((sqlite.prepare("PRAGMA busy_timeout").get() as any).timeout) >= 5000, "SQLite busy timeout must be at least five seconds");
  const server = app.listen(0);
try {
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address !== "string", "test server did not expose a port");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const request = (path: string, options?: RequestInit) => fetch(`${baseUrl}${path}`, options);

  const allowed = await request("/api/health", { headers: { Origin: "http://localhost:3000" } });
  assert(allowed.status === 200, "health endpoint should be available");
  assert(allowed.headers.get("access-control-allow-origin") === "http://localhost:3000", "configured CORS origin should be reflected");
  const denied = await request("/api/health", { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
  assert(denied.status === 403, "unconfigured CORS preflight should be rejected");

  const login = await request("/api/auth/guest", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Client-Platform": "web" },
    body: "{}",
  });
  assert(login.status === 200, "guest login should succeed");
  const loginBody = await login.json() as { token?: string; user?: { id: number; openId: string; loginMethod: string } };
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert(cookie, "guest login should set a cookie");
  assert(!loginBody.token, "web guest login must not expose a bearer token");
  assert(loginBody.user?.loginMethod === "guest" && /^guest_[0-9a-f-]{36}$/.test(loginBody.user.openId), "guest identity must be server-generated");
  assert(/HttpOnly/i.test(login.headers.get("set-cookie") ?? ""), "session cookie must be HttpOnly");

  const me = await request("/api/auth/me", { headers: { Cookie: cookie } });
  assert((await me.json()).user?.openId === loginBody.user?.openId, "cookie session must authenticate the same guest");
  const unauthorized = await request("/api/trpc/notifications.registerToken", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ json: { token: "unauthorized" } }) });
  assert(unauthorized.status >= 401 && unauthorized.status < 500, "protected notification mutation must reject unauthenticated callers");

  const validToken = await sdk.createSessionToken("guest_claim_test", { name: "Test" });
  assert((await sdk.verifySession(validToken))?.openId === "guest_claim_test", "valid session should verify");
  const forgedToken = await new SignJWT({ openId: "guest_claim_test", appId: ENV.appId, name: "Test" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject("different-subject")
    .setIssuer("bible-arena")
    .setAudience(ENV.appId)
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(ENV.cookieSecret));
  assert((await sdk.verifySession(forgedToken)) === null, "mismatched JWT subject must be rejected");

  const question = getVerifiedQuestionById("bible_quiz", "bq-001");
  assert(question, "verified question bank should contain bq-001");
  const first = recordAuthoritativeSession({ userId: loginBody.user!.id, id: "security-session", mode: "bible_quiz", answers: [{ questionId: question.id, answerId: question.correctAnswer }] });
  const replay = recordAuthoritativeSession({ userId: loginBody.user!.id, id: "security-session", mode: "bible_quiz", answers: [{ questionId: question.id, answerId: question.correctAnswer }] });
  assert(first.xpEarned === 150 && replay.id === first.id, "authoritative session must recompute expected XP");
  assert(Number((db.getDb().prepare("SELECT count(*) AS count FROM session_records WHERE id = ?").get("security-session") as any).count) === 1, "replayed session must not duplicate records");
  assert(Number((db.getDb().prepare("SELECT totalXp FROM player_progress WHERE userId = ?").get(loginBody.user!.id) as any).totalXp) === 150, "replayed session must not duplicate XP");
  try {
    recordAuthoritativeSession({ userId: loginBody.user!.id, id: "tampered-session", mode: "bible_quiz", answers: [{ questionId: "not-verified", answerId: "a" }] });
    throw new Error("unknown question was accepted");
  } catch (error) {
    assert(String(error).includes("verified server question bank"), "unknown question IDs must be rejected");
  }
  await db.upsertUser({ openId: "second-security-player", name: "Second Player", loginMethod: "guest", lastSignedIn: new Date() });
  const second = await db.getUserByOpenId("second-security-player");
  assert(second, "second test user should exist");
  const group = db.createFellowshipGroup({ ownerUserId: loginBody.user!.id, name: "Security Fellowship" });
  const joined = db.joinFellowshipGroup(group.inviteCode, second.id);
  assert(joined.id === group.id, "second player should join fellowship group by invite code");
  assert(db.listFellowshipGroups(second.id).some((item: { id: string }) => item.id === group.id), "joined fellowship should appear in member list");
  const notification = db.createNotification({ userId: second.id, type: "test", title: "Smoke test", body: "Notification inbox is working." });
  assert(db.listNotifications(second.id).some((item: { id: string }) => item.id === notification.id), "notification should appear in inbox");
  db.markNotificationsRead(second.id, [notification.id]);
  assert(db.listNotifications(second.id).find((item: { id: string }) => item.id === notification.id)?.unread === false, "notification should be markable as read");
  try {
    recordAuthoritativeSession({ userId: second.id, id: "security-session", mode: "bible_quiz", answers: [{ questionId: question.id, answerId: "wrong" }] });
    throw new Error("cross-user replay was accepted");
  } catch (error) {
    assert(String(error).includes("another user"), "session IDs must be owned by the original user");
  }

  let rateLimited = false;
  for (let i = 0; i < 12; i++) {
    const response = await request("/api/auth/guest", { method: "POST", headers: { "Content-Type": "application/json", "X-Client-Platform": "web" }, body: "{}" });
    if (response.status === 429) rateLimited = true;
  }
  assert(rateLimited, "guest login rate limit should activate");
    console.log("Security smoke passed: CORS, guest auth, JWT claims, protected API, replay, tampering, and rate limiting.");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
