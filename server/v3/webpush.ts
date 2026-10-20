// Bible Arena: standard Web Push (RFC 8030) with VAPID (RFC 8292) and aes128gcm payload encryption (RFC 8291),
// written on node:crypto so no extra package is needed. Keys come from the environment only:
//   VAPID_PUBLIC_KEY  (65-byte uncompressed P-256 point, base64url)
//   VAPID_PRIVATE_KEY (32-byte P-256 private scalar, base64url)
//   VAPID_SUBJECT     (mailto: or https: contact; defaults to the site URL)
// Nothing here logs a key.
import crypto from "node:crypto";

const b64u = (b: Buffer) => b.toString("base64url");
const fromB64u = (s: string) => Buffer.from(String(s || "").replace(/=+$/, ""), "base64url");

function hmac(key: Buffer, data: Buffer): Buffer { return crypto.createHmac("sha256", key).update(data).digest(); }

export interface PushSub { endpoint: string; p256dh: string; auth: string }

/** Encrypts a payload for one subscription (RFC 8291 aes128gcm, single record). Salt and server key are injectable for test vectors. */
export function encryptPayload(payload: Buffer, sub: { p256dh: string; auth: string }, opts?: { salt?: Buffer; asPrivate?: Buffer }): Buffer {
  const uaPublic = fromB64u(sub.p256dh);
  const authSecret = fromB64u(sub.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error("bad_subscription_keys");
  const ecdh = crypto.createECDH("prime256v1");
  if (opts?.asPrivate) ecdh.setPrivateKey(opts.asPrivate); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = opts?.salt || crypto.randomBytes(16);
  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info" || 0x00 || ua_public || as_public, 32)
  const prkKey = hmac(authSecret, shared);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]);
  const ikm = hmac(prkKey, keyInfo);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

/** Receiver side of RFC 8291, used only by tests to prove a message decrypts. */
export function decryptPayload(msg: Buffer, uaPrivate: Buffer, authSecretB64: string): Buffer {
  const salt = msg.subarray(0, 16);
  const idlen = msg[20];
  const asPublic = msg.subarray(21, 21 + idlen);
  const ct = msg.subarray(21 + idlen);
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(uaPrivate);
  const uaPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(asPublic);
  const authSecret = fromB64u(authSecretB64);
  const prkKey = hmac(authSecret, shared);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12);
  const d = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
  d.setAuthTag(ct.subarray(ct.length - 16));
  const out = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]);
  let end = out.length - 1;
  while (end >= 0 && out[end] === 0) end--;
  if (out[end] !== 2) throw new Error("bad_padding");
  return out.subarray(0, end);
}

// ---------- VAPID ----------
interface Vapid { publicKey: string; key: crypto.KeyObject; subject: string }
let vapid: Vapid | null | undefined;
export function vapidFromEnv(env = process.env): Vapid | null {
  const pub = String(env.VAPID_PUBLIC_KEY || "").trim();
  const priv = String(env.VAPID_PRIVATE_KEY || "").trim();
  if (!pub || !priv) return null;
  try {
    const p = fromB64u(pub), d = fromB64u(priv);
    if (p.length !== 65 || p[0] !== 4 || d.length !== 32) return null;
    const key = crypto.createPrivateKey({ key: { kty: "EC", crv: "P-256", d: b64u(d), x: b64u(p.subarray(1, 33)), y: b64u(p.subarray(33, 65)) }, format: "jwk" });
    const subject = String(env.VAPID_SUBJECT || "https://bible-arena.onrender.com").trim();
    return { publicKey: b64u(p), key, subject };
  } catch { return null; }
}
function getVapid(): Vapid | null { if (vapid === undefined) vapid = vapidFromEnv(); return vapid; }
export function _setVapid(v: Vapid | null) { vapid = v; }
export function vapidPublicKey(): string | null { return getVapid()?.publicKey || null; }

export function vapidJwt(audience: string, v: Vapid, now = Date.now()): string {
  const enc = (o: unknown) => b64u(Buffer.from(JSON.stringify(o)));
  const unsigned = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: v.subject });
  const sig = crypto.sign("sha256", Buffer.from(unsigned), { key: v.key, dsaEncoding: "ieee-p1363" });
  return unsigned + "." + b64u(sig);
}

// Only real browser push services, so a stored endpoint can never point the server at an arbitrary host.
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.apple\.com$/];
export function endpointOk(endpoint: unknown): boolean {
  try {
    const u = new URL(String(endpoint));
    return u.protocol === "https:" && !u.port && PUSH_HOSTS.some((r) => r.test(u.hostname)) && String(endpoint).length <= 800;
  } catch { return false; }
}

export type PushResult = { ok: boolean; status: number; gone: boolean };
/** Sends one notification. gone = the subscription is dead (404/410) and should be deleted. */
export async function sendPush(sub: PushSub, data: Record<string, unknown>, opts?: { ttl?: number; urgency?: "normal" | "high"; topic?: string; fetchImpl?: typeof fetch }): Promise<PushResult> {
  const v = getVapid();
  if (!v) return { ok: false, status: 0, gone: false };
  if (!endpointOk(sub.endpoint)) return { ok: false, status: 0, gone: true };
  const body = encryptPayload(Buffer.from(JSON.stringify(data)), sub);
  const aud = new URL(sub.endpoint).origin;
  const headers: Record<string, string> = {
    TTL: String(opts?.ttl ?? 600), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
    Authorization: `vapid t=${vapidJwt(aud, v)}, k=${v.publicKey}`, Urgency: opts?.urgency || "high",
  };
  if (opts?.topic) headers.Topic = opts.topic.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10_000);
  try {
    const r = await (opts?.fetchImpl || fetch)(sub.endpoint, { method: "POST", headers, body, signal: ctl.signal });
    return { ok: r.status >= 200 && r.status < 300, status: r.status, gone: r.status === 404 || r.status === 410 };
  } catch {
    return { ok: false, status: 0, gone: false };
  } finally { clearTimeout(t); }
}
