# Bible Arena v2 — premium redesign

Live: https://bible-arena.onrender.com

## What changed
- **Structure:** tabs are Home · Play · Ranks · Profile. Internal routes (groups, moderation, notifications, +not-found, quiz, settings…) are hidden from the tab bar. Every screen has 20 px side margins (`ScreenContainer` now applies them).
- **Engagement loop:** onboarding (name + daily XP goal) → Home (daily-goal ring, streak, level bar, Daily Challenge, "Up next" category, badges within reach, verse of the day) → rounds → results ("One more round", "Next up: <category>") → back to Home.
- **Rounds** (`app/quiz.tsx`): Quick Round, Category rounds, Survival (3 hearts, gets harder), Daily Challenge (7 questions, same for everyone, +100 XP), plus the existing Bible or Myth and Word Puzzle. Timer per question, speed bonus, combo multiplier (×2 after 3 in a row, ×3 after 6), hard questions worth more, instant correct/wrong animation, vibration on Android (and native haptics), optional sound (off by default), verse + one-line explanation after every answer.
- **Progress:** 30 named levels (`domain/progression.ts`), daily streak, daily XP goal, per-category mastery with stars, 24 badges, survival best, best combo. Local-first; signed-in players still sync verified sessions to the server (server re-scores against the verified bank).
- **Question bank v2** (`domain/question-bank.ts`, source in `question-bank-source.json`): 248 new questions, 44–53 per category (People, Places, Events, Teachings, Books & Words), easy/medium/hard, five types: multiple choice, true/false, fill-the-verse, who-said-it, order-the-events. KJV wording, every item has a reference and explanation. Old question ids are unchanged.
- **Design system:** `constants/design.ts` (Midnight & Gold colours, type scale, spacing, radii), `components/ui/kit.tsx` (Txt, Card, Button, Pill, ProgressBar, Ring, Stars, IconBadge, FadeIn, TopBar), `lib/feedback.ts` (haptics/sound). Font: Plus Jakarta Sans from Google Fonts (`public/index.html`).
- Google sign-in is unchanged (`/api/oauth/google/*`, env `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).

## Making it permanent in GitHub
Render currently applies these changes at build time from a private overlay (secret file `render-overlay.b64`). To move them into the repo:
1. `git apply bible-arena-v2.patch` on `main` (or unzip the source over the repo), commit, push.
2. In Render → Settings → Build Command, use:
   `npm ci --no-audit --no-fund && NODE_OPTIONS=--max-old-space-size=1536 CI=1 npx expo export --platform web --output-dir dist-web && npm run build`
3. Delete the secret file `render-overlay.b64`.
Until then, edits in GitHub to any file listed in the patch will be overwritten by the overlay on deploy.
