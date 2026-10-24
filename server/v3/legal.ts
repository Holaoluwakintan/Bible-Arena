// Bible Arena: privacy policy, account deletion page and the delete endpoint (Play Store requirements).
import type { Express, Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { rateLimit } from "../_core/rate-limit";
import { logger } from "../_core/logger";
import { getUserByOpenId, deleteUserAccount } from "../db";
import { snapshotNow } from "../persist";
import { baPool, SCH } from "./pg";
import { deleteChurchData } from "./churches";
import { deleteSocialData } from "./social";
import { deleteReportData } from "./report";

const CONTACT = process.env.SUPPORT_EMAIL || "michaelolaoluwagab@gmail.com";
const UPDATED = "24 October 2026";

function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.cookie || "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return undefined;
}
async function who(req: Request): Promise<{ openId: string } | null> {
  const auth = req.headers.authorization;
  const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7).trim() : readCookie(req, COOKIE_NAME);
  const s = await sdk.verifySession(token).catch(() => null);
  return s ? { openId: s.openId } : null;
}

/** Deletes every record tied to this account. Returns counts for the log. */
export async function deleteAccountData(openId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const pool = baPool();
  if (pool) {
    const c = await pool.connect();
    try {
      await c.query("begin");
      const own = `select code from ${SCH}.duels where creator_open_id=$1`;
      out.duel_entries = (await c.query(`delete from ${SCH}.duel_entries where open_id=$1 or code in (${own})`, [openId])).rowCount || 0;
      out.duels = (await c.query(`delete from ${SCH}.duels where creator_open_id=$1`, [openId])).rowCount || 0;
      out.rounds = (await c.query(`delete from ${SCH}.rounds where open_id=$1`, [openId])).rowCount || 0;
      out.players = (await c.query(`delete from ${SCH}.players where open_id=$1`, [openId])).rowCount || 0;
      await c.query("commit");
    } catch (error) {
      await c.query("rollback").catch(() => {});
      throw error;
    } finally {
      c.release();
    }
  }
  out.church_memberships = deleteChurchData(openId);
  out.push_subscriptions = deleteSocialData(openId);
  out.book_tallies = deleteReportData(openId);
  const user = await getUserByOpenId(openId);
  if (user) { deleteUserAccount((user as any).id); out.users = 1; }
  snapshotNow("account-delete").catch(() => {});
  return out;
}

const STYLE = `<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#070C1A;color:#E8E6DF;font:16px/1.6 -apple-system,Segoe UI,Roboto,Inter,sans-serif}
main{max-width:720px;margin:0 auto;padding:28px 20px 60px}h1{font:700 30px/1.2 Georgia,"Playfair Display",serif;color:#F3E7C8;margin:8px 0 4px}
h2{font:700 19px/1.3 Georgia,serif;color:#E2B65A;margin:28px 0 6px}a{color:#E2B65A}.muted{color:#9AA3B8;font-size:14px}
ul{padding-left:20px}li{margin:4px 0}.card{background:#0F1730;border:1px solid #223055;border-radius:14px;padding:16px 18px;margin:16px 0}
.btn{display:inline-block;border:0;border-radius:999px;padding:12px 20px;font:600 16px Inter,sans-serif;cursor:pointer;text-decoration:none}
.danger{background:#B3261E;color:#fff}.ghost{background:#1B2547;color:#E8E6DF}.back{font-size:14px}
</style>`;
const shell = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Bible Arena</title><meta name="theme-color" content="#070C1A"><meta name="robots" content="index,follow">${STYLE}</head>
<body><main><a class="back" href="/">← Bible Arena</a>${body}</main></body></html>`;

const PRIVACY = shell("Privacy Policy", `
<h1>Privacy Policy</h1><p class="muted">Bible Arena · last updated ${UPDATED}</p>
<p>Bible Arena is a Bible quiz game made by Olaoluwa Michael ("we"). This policy explains what the app and the website at bible-arena.onrender.com collect, why, and how you can delete it. It covers the Android app and the website, which are the same game.</p>
<h2>What we collect</h2>
<ul>
<li><b>Your display name</b>, which you type in or which comes from your Google profile if you sign in with Google.</li>
<li><b>Your email address</b>, only if you sign in with Google. We ask Google for your basic profile and email address and nothing else.</li>
<li><b>Your church or group name</b>, if you choose to add one (used for the Church League).</li>
<li><b>Your game activity</b>: rounds played, answers, scores, times, streaks (and streak saves), achievements, duels you send or accept, and your level. For your weekly report card we also keep, per week, how many questions you got right in each book of the Bible (kept 5 weeks).</li>
<li><b>Game-room entries</b>: the nickname, team and answers you use when you join a quiz night, a challenge or a live game room.</li>
<li><b>A guest ID</b>: if you play without signing in, we create a guest account with a random ID, kept in a sign-in cookie on your phone, so your progress is saved.</li>
<li><b>A random phone ID for safety</b>: a random code made on your phone (not your name, number or advertising ID). We keep only a scrambled version of it, so a player you block stays blocked in every game.</li>
<li><b>Story and Endless progress</b>: the stars you earn on each Story level, how many new-level tries you used today, and your highest Endless level are saved with your profile so they follow you to another phone. Your display name and highest Endless level appear on the Endless board. Deleted with your account.</li>
<li><b>Voice answers (optional)</b>: on quiz questions you can tap 🎤 and say your answer instead of tapping it. The mic only listens after you tap it, for one answer. Your browser's own speech service turns what you say into text (in Chrome on Android that is Google's speech service, under Google's privacy policy). Bible Arena only gets the text, uses it on your phone to pick the matching answer, and does not record, store or send your voice or the text to our server. It can mishear Bible names and accents, Nigerian English included, so it only answers by itself when the match is clear, and tapping always works. Turn it off in Me → Settings.</li>
<li><b>Phone notifications (optional)</b>: if you turn them on, your browser gives us a push address (from Google's or your browser's push service) and two keys to encrypt the message. We use it only to tell you when someone is waiting for a challenger, when a live game is starting, and for the daily 7 PM reminder if you haven't played the Daily Challenge yet. Max 3 a day, never 10 pm to 7 am (Lagos time). Turn them, or just the 7 PM reminder, off in Me → Settings; the address is deleted when you turn notifications off or delete your account.</li>
<li><b>Reports</b>: if you report a player, we keep the game code, your nickname, their nickname, the reason and any note you write, so we can review it.</li>
<li><b>Tester sign-ups (optional)</b>: if you sign up at bible-arena.onrender.com/test to test the Android app, we keep the email you give, and your name and phone model if you add them, and whether you use Android or iPhone. We use them only to invite you to the Google Play test (the email goes on our Google Play tester list) and to tell you about Bible Arena, for example when the iPhone version is ready. We don't sell them. Email us to be removed.</li>
<li><b>Technical data</b>: a sign-in cookie that keeps you logged in, and your IP address, which is used briefly in memory to stop abuse (rate limiting) and is not stored with your profile.</li>
</ul>
<p>We do <b>not</b> collect your location, contacts, photos, files, payment details or advertising ID. The website has <b>no ads</b>, and Bible Arena has <b>no analytics or tracking tools</b>. The only ads are optional rewarded ads in the Android app (see below).</p>
<p><b>Voice chat (optional).</b> In group games (challenges and live games) you can talk to the other players. The microphone is used only after you tap the mic button, and only while it is on; in the Android app, Android asks for microphone permission the first time. Your voice goes between the players' phones as encrypted audio (WebRTC). When two phones cannot connect directly, the encrypted audio passes through a relay server (Metered or ExpressTURN) that forwards it in real time and cannot listen to it. Bible Arena's own server only passes the small connection messages. Nobody records, stores or listens to the audio.</p>
<p><b>Safety tools.</b> In any game room you can tap a player to mute them for yourself, block them (you won't hear each other in voice in any game) or report them. Blocks are kept on your phone and on our server, linked only to the scrambled phone ID. Player names are checked against a list of offensive words.</p>
<p><b>Rewarded ads (Android app only, optional).</b> The website has no ads. In the Android app you can choose to watch a short ad for a practice hint, extra time on a question in solo games, or a just-for-fun bonus life. Ads are never shown in online or multiplayer games. Ads appear only when you tap that button. They are shown by Google AdMob, which may use your device&#39;s advertising ID and basic device information to show and measure ads (Google&#39;s policy: https://policies.google.com/technologies/ads). You can reset or delete the advertising ID in your phone&#39;s settings. We only receive a one-time code saying whether the ad finished, and we keep it for a few minutes.</p>
<h2>How we use it</h2>
<ul><li>To run the game: score rounds, keep your progress, run duels, daily challenges, leaderboards and quiz nights.</li>
<li>To keep your progress safe across phones when you sign in with Google.</li>
<li>To protect the service and other players from abuse (rate limits, name checks, blocks and reports).</li></ul>
<h2>What other players can see</h2>
<p>Your display name, church or group, level and scores appear on leaderboards, in duels you take part in and in the Church League. Your quiz-night nickname and score appear on the host's screen and on that night's results page. Your email address is never shown to anyone.</p>
<h2>Who we share it with</h2>
<p>We do not sell or rent your data, and we do not share it with advertisers. It is processed only by the services that run the game: our server host (Render) and our database host (Supabase). Google handles the sign-in step if you choose Google. In the Android app, Google AdMob shows a rewarded ad only when you choose to watch one. Data is sent over encrypted connections (HTTPS).</p>
<h2>Community rules</h2>
<p>Be kind. No bad language, bullying, hate, threats, sexual talk, spam, or asking for or sharing personal details (phone numbers, addresses, social media). Use a name you would be happy for anyone to see. Players who break these rules can be taken out of voice (this happens automatically when several players in one game report the same person) and offensive names are blocked. To report someone, tap them in the game and choose Report, or email us with the game code.</p>
<h2>How long we keep it</h2>
<p>We keep your profile and game history until you delete your account. Game rooms expire after 12 hours. Reports are deleted after 180 days. Blocks stay until you unblock (Me → Blocked players). Quiz-night results pages (nicknames and scores) are kept so the church can share them; email us to have one removed. Automatic backups are rotated and older copies are overwritten over time.</p>
<h2>Deleting your account and data</h2>
<p>In the app, open <b>Me → Delete account</b> (the Me tab at the bottom). Or go to <a href="/delete-account">bible-arena.onrender.com/delete-account</a>. This permanently deletes your profile, email, church, scores, rounds and the duels you created. If you cannot open the app, email <a href="mailto:${CONTACT}?subject=Bible%20Arena%20account%20deletion">${CONTACT}</a> with your display name and, if you used Google, your email. We will delete your account within 30 days.</p>
<h2>Children</h2>
<p>Bible Arena is meant for people aged 13 and over. We do not knowingly collect data from children under 13. If you believe a child under 13 has created an account, email us and we will delete it.</p>
<h2>Your rights</h2>
<p>You can ask for a copy of your data, ask us to correct it, or ask us to delete it, under the Nigeria Data Protection Act 2023 and, where it applies, the GDPR. Email <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>
<h2>Changes</h2>
<p>If this policy changes, we will update this page and the date above.</p>
<h2>Contact</h2>
<p>Olaoluwa Michael · <a href="mailto:${CONTACT}">${CONTACT}</a></p>`);

const DELETE = shell("Delete your account", `
<h1>Delete your Bible Arena account</h1><p class="muted">Bible Arena by Olaoluwa Michael</p>
<p>Deleting your account permanently removes your profile, display name, email address (if you signed in with Google), church or group, level, scores, rounds, achievements and the duels you created. Your entries in other players' duels are removed too. This cannot be undone.</p>
<div class="card" id="box"><p class="muted">Checking whether you are signed in on this browser…</p></div>
<h2>Other ways to delete</h2>
<ul><li><b>In the app:</b> open the <b>Me</b> tab, then <b>Delete account</b>.</li>
<li><b>By email:</b> if you can't open the app, email <a href="mailto:${CONTACT}?subject=Bible%20Arena%20account%20deletion">${CONTACT}</a> with your display name and, if you used Google, the Google email. We delete it within 30 days and reply to confirm.</li></ul>
<p class="muted">Quiz-night rooms expire on their own after 12 hours. Read the <a href="/privacy">privacy policy</a>.</p>
<script>
(async function(){
  var box=document.getElementById("box");
  var me=null; try{var r=await fetch("/api/v3/me",{credentials:"same-origin"}); if(r.ok) me=await r.json();}catch(e){}
  var signed = me && me.user;
  if(!signed){ box.innerHTML='<p>You are not signed in on this browser. Open the Bible Arena app and go to <b>Me → Delete account</b> (the Me tab at the bottom), or <a href="/">open Bible Arena here</a>, sign in, then come back to this page. You can also email us (below).</p>'; return; }
  var name=(me.player&&me.player.name)||me.user.name||"your account";
  box.innerHTML='<p>Signed in as <b></b>.</p><button class="btn danger" id="del">Delete my account</button>';
  box.querySelector("b").textContent=name;
  document.getElementById("del").onclick=async function(){
    if(!confirm("Delete your Bible Arena account and all its data? This cannot be undone.")) return;
    this.disabled=true; this.textContent="Deleting…";
    try{ var d=await fetch("/api/v3/account/delete",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirm:"DELETE"})});
      if(!d.ok) throw new Error("http "+d.status);
      try{ Object.keys(localStorage).forEach(function(k){ if(k.indexOf("ba3:")===0) localStorage.removeItem(k); }); }catch(e){}
      box.innerHTML='<p><b>Your account has been deleted.</b> All your Bible Arena data is gone. Thank you for playing.</p>';
    }catch(e){ this.disabled=false; this.textContent="Delete my account"; alert("Sorry, that didn't work. Please try again or email us."); }
  };
})();
</script>`);

export function registerLegal(app: Express): void {
  const send = (html: string) => (_req: Request, res: Response) => { res.setHeader("Cache-Control", "public, max-age=600"); res.type("html").send(html); };
  app.get(["/privacy", "/privacy-policy", "/privacy.html"], send(PRIVACY));
  app.get(["/delete-account", "/account/delete", "/delete-account.html"], send(DELETE));
  app.post("/api/v3/account/delete", rateLimit({ windowMs: 60_000, max: 5, name: "v3-delete" }), async (req, res) => {
    try {
      if ((req.body || {}).confirm !== "DELETE") { res.status(400).json({ error: "confirm_required" }); return; }
      const me = await who(req);
      if (!me) { res.status(401).json({ error: "sign_in_required" }); return; }
      const counts = await deleteAccountData(me.openId);
      logger.info("v3_account_deleted", { counts });
      res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(req), maxAge: -1 });
      res.json({ ok: true });
    } catch (error) {
      logger.error("v3_account_delete_failed", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "server_error" });
    }
  });
}
