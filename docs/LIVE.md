# Bible Arena Live (v3.1)

Church quiz nights on a projector or TV. Up to 200 players join on their phones with a 6-digit code. No accounts.

## Pages
- `/live` — host: set up the quiz on a laptop, then the stage show (lobby with code + QR, question reveal, countdown, answer bars, leaderboard, podium finale with confetti and sound).
- `/join` and `/j/CODE` — players (the QR code opens `/j/CODE`).
- `/live/r/CODE` — shareable results page; its WhatsApp preview uses the results card the host screen uploads.

## Running a quiz night
1. Open `https://bible-arena.onrender.com/live` on a laptop connected to the projector.
2. Name the event and church, pick "everyone for themselves", Youth vs Choir, Men vs Women or your own 2–4 teams.
3. Questions: the bank (category, difficulty, Old/New Testament), by book, or "Your own quiz" (type questions, `*` marks the right answer; can top up from the sermon's book).
4. Choose 10–30 questions and 10–45 s per question. "Instant feedback" shows right/wrong on phones as soon as they tap; turn it off for strict competitions. Auto-play moves on by itself.
5. Open the lobby, press F for full screen. People scan the QR or type the code at `/join`.
6. Press Space (or a presenter clicker) to start and to move on. M mutes. The ⋯ menu: +10 s, lock the room, remove a player, end now.
7. At the end: podium and confetti, then "Share results" for the WhatsApp card and link.

If the laptop refreshes, `/live` resumes the same game (the host key is kept on that computer). Phones that lose data rejoin with their place and score.

## How it works
- `server/v3/live-engine.ts`: pure state machine (lobby → intro → question → reveal → board → … → final), scoring, teams, ranks.
- Scoring: a right answer is 500–1000 points (faster is more), plus a streak bonus of +100 per answer in a row from the second (capped at +500). Answer time is measured by the server; a phone may claim back up to 2.5 s for slow data.
- Teams are ranked by average points per player, so team size gives no advantage.
- `server/v3/live.ts`: HTTP under `/lv/*` (outside `/api`, so a whole church on one Wi-Fi IP is not rate-limited together; per-token limits instead). Real time via Server-Sent Events with long-poll fallback (`/lv/r/CODE/sse`, `/lv/r/CODE/poll`). Rooms live in memory and are snapshotted to Postgres (`bible_arena.live_rooms`) every 3 s and on shutdown; an unknown code is restored from there (a question that was running restarts its intro). Results go to `bible_arena.live_results` (with the uploaded card JPEG).
- `server/v3/live-bank.ts`: turns the 951-item v3 bank into 2–4 button questions (Complete the Verse uses the exact KJV word with the gap decoys; Bible or Myth is Fact/Myth; Who Am I shows the clues on the big screen).
- Client: `web-v3/live.html` + `live-host.js` + `live.css` (host), `play.html` + `live-play.js` + `play.css` (phones, system fonts, ~20 KB), `live-common.js` (transport, synthesized sound, confetti, share card), `live-quick.js` (quick-quiz parser), `qrcode.min.js` (MIT).

## Church Premium (shown as "coming soon")
Saved quiz sets, church branding, more than 200 players.

## Tests
- `npx vitest run tests/live.test.ts` — lifecycle, scoring, reconnect, team totals, bank conversion, quick-quiz parser.
- `node scripts/live-sim.mjs <base-url> [players] [questions]` — simulated quiz night with headless players (SSE and long-poll mixes, drops and rejoins); checks every score and team total.
