# Bible Arena — Gnosis Full Product Audit

**Audit date:** 2026-09-25
**Repository:** `Holaoluwakintan/Bible-Arena`
**Verified GitHub main:** `b4633962e9a4007cb0382ab5da975bac6ca6056e`
**Local HEAD:** `b463396 Add adaptive learning and daily Scripture habit`

## 1. Executive conclusion

Bible Arena is a local-first Scripture knowledge game with short timed sessions, explanations and references, progression, seasons, friends, challenges, matchmaking, leaderboards, notifications, and realtime rooms. Its strongest product decision is the combination of **fast play plus an explanation after every answer**. Its strongest engineering decision is the preserved modular-monolith/domain-layer architecture with deterministic tests.

The repository is in a materially better state than the initial audit baseline. Phase One security controls, Phase Two migrations, Phase Three release gates, Phase Four UX, Phase Five accessibility/settings, Phase Six governance/privacy, Phase Seven production foundations, and Phase Eight product foundations are present in GitHub `main`.

The product is not yet ready to claim fully production-grade competitive integrity or complete social gameplay. The two highest-impact remaining issues are:

1. **Verified question objects, including `correctAnswer`, are shipped to the client.** A user can inspect the bundle and cheat in scored/competitive sessions even though the server recomputes submitted scores. This is a competitive-integrity problem.
2. **Friend challenge joining immediately changes the server record to `completed` without a server-side turn/result lifecycle.** The UI presents a share-code challenge, but the durable backend does not yet support the documented asynchronous two-result challenge flow.

These are evidence-based findings from the current code, not speculative vulnerabilities.

## 2. Git and release cross-check

### Git status

- Public GitHub `refs/heads/main`: `b4633962e9a4007cb0382ab5da975bac6ca6056e`
- Local `HEAD`: same commit hash.
- Local working tree: clean.
- Local tracking ref `origin/main` is stale at `985f24a`; this is only the sandbox’s last fetched tracking ref. The public remote was checked directly with `git ls-remote` and is current.
- Phase Eight commit: `b463396 Add adaptive learning and daily Scripture habit`.
- Previous audit commit: `d13e31e Complete security, production, and UX audit phases`.

### Release validation

`npm run release:check` passed:

- TypeScript: passed
- ESLint: 0 errors, 9 warnings
- Vitest: 14 files, 53 tests passed
- Fresh/idempotent/legacy migration smoke: passed
- Server production bundle: passed
- Security smoke: passed

The 9 lint warnings are non-blocking warnings in friends/onboarding/quiz/room/icon-symbol files. No Phase Eight error was introduced.

## 3. Product understanding

### Product

A Scripture-learning game for people who want short, repeatable Bible knowledge practice with friendly competition.

### Primary user

A mobile-first learner who wants to play a 5–10 question session, understand mistakes, build a streak, and optionally compete with friends or other players.

### Core value proposition

**Play quickly, learn from every answer, and build a repeatable Scripture habit.** This is supported by the home-screen “Play a quick round” action, timed sessions, per-answer explanations/references, local-first storage, streaks, and result sharing.

### Differentiation

The product is more learning-oriented than a generic quiz because explanations and Scripture references are first-class result content. This should remain the central identity rather than being diluted by too many competitive surfaces.

## 4. Classification of the current product

### 🟢 EXCELLENT — KEEP

- **Short sessions and immediate play:** `app/index.tsx` and `app/play.tsx` make Quick Play the primary action.
- **Explanation-led learning:** `app/quiz.tsx` displays explanation and reference after each answer and on the result review.
- **Local-first progression:** `domain/local-storage.ts` preserves solo use without requiring an account.
- **Domain-layer separation:** game logic, questions, progression, sharing, and Phase Eight helpers are separate from screens.
- **Deterministic test culture:** the release suite now has 53 passing tests.
- **Server-authoritative session scoring:** `server/authoritative-session.ts` validates verified question IDs, recomputes score/accuracy/XP, uses transactions, and rejects duplicate question IDs.
- **Dark visual foundation:** the visual system is coherent and was preserved rather than replaced.

### 🔵 GOOD — POLISH

- Daily habit and adaptive difficulty now exist, but their user explanation is minimal. Add a short “why this level?” explanation rather than making tuning feel opaque.
- Profile analytics are useful and privacy-preserving, but currently only cover local summaries and a small set of dimensions.
- Web SEO metadata, robots, sitemap, and 404 handling are present, but the production origin remains deployment configuration.
- JSON request logging is a good foundation, but it is not yet a full metrics/alerting system.

### 🟡 AVERAGE — IMPROVE

- Play mode cards show a `Soon` pill for every item after the featured card even when `available: true` and the handler opens a functioning route. This creates avoidable trust and discoverability friction in `app/play.tsx`.
- The Play screen mixes working modes, roadmap-like AI Battle, social areas, and leaderboards in one flat list. It needs clearer grouping: Learn, Compete, Social, and Progress.
- Phase Eight content packs are currently topic filters over the existing verified bank. They are useful but not yet true translation/tradition-specific packs.
- Local date handling is duplicated across progression and Phase Eight helpers and uses device-local time. A shared date-key helper would reduce boundary inconsistencies.

### 🟠 WEAK — PRIORITY

- Friend challenges have a misleading backend lifecycle. `server/db.ts` sets `status = 'completed'` immediately when a second player joins, while `drizzle/schema.ts` has only `open`, `completed`, and `expired`; there are no durable creator/opponent results in that table. This conflicts with `docs/FRIEND_CHALLENGES.md`, which describes `open → in_progress → complete` and two recorded results.
- AI Battle is described as an AI feature, but repository documentation identifies the opponent as a predictable local opponent. The label should say “Practice opponent” unless a real configurable server-side AI exists.
- There is no complete moderation decision/action workflow; there is report intake and admin open-flag listing, but no reviewed/resolved mutation and audit trail UI.
- The app has no real external product analytics or funnel instrumentation. This is acceptable for privacy and early development, but it limits evidence-based product decisions.

### 🔴 CRITICAL — FIX NOW

No verified unauthenticated account takeover, wildcard CORS, production-default-secret, or server-side score-recalculation failure remains in the inspected code. However, the client answer-key exposure below is **HIGH for competitive launch** and should be treated as a launch blocker for ranked/competitive scoring.

### ⚫ MISSING

- Server-side challenge turn/result records for asynchronous friend challenges.
- Server-side question delivery that omits `correctAnswer` until answer verification.
- Review/resolution moderation procedures and immutable moderation audit events.
- Production monitoring/alerting integration.
- A real shared realtime backplane for multi-instance deployment.

## 5. Security audit

### HIGH — Client receives answer keys in scored sessions

**Evidence:** `domain/questions.ts` defines client-imported verified question objects with `correctAnswer`; `app/quiz.tsx` imports question sets and calculates feedback locally before calling `recordSession`; `server/authoritative-session.ts` independently verifies answers afterward.

**Why it matters:** A player can inspect the JavaScript bundle or runtime object and obtain every correct answer before submission. Server recomputation prevents forged XP but does not prevent a player from playing honestly-looking perfect sessions.

**Fix:** Split question delivery into a public play shape without `correctAnswer` and a server-only answer-key shape. For competitive modes, issue a server session/question-set ID and submit answer attempts. Keep local-first solo mode explicitly labeled as practice if it must retain local answer data.

**Before launch:** Required before ranked or leaderboard-sensitive competitive play. Less urgent for clearly labeled offline practice.

### MEDIUM — Missing standard web security headers

**Evidence:** `server/_core/index.ts` disables `x-powered-by`, but the inspected middleware does not add HSTS, CSP, `X-Content-Type-Options`, frame-ancestors/frame protection, or a referrer policy.

**Why it matters:** This increases browser attack surface and weakens defense-in-depth for the web build.

**Fix:** Add a small explicit security-header middleware or a narrowly justified header dependency. Configure CSP after verifying Expo web asset requirements.

**Before launch:** Recommended before public web launch; CSP should be tested rather than blindly enabled.

### MEDIUM — In-memory rate limiting is instance-local

**Evidence:** `server/_core/rate-limit.ts` stores buckets in process memory while `ENV.REALTIME_BACKPLANE` defaults to `local`.

**Why it matters:** Multiple instances do not share abuse counters or room state.

**Fix:** Keep the current low-complexity limiter for single-instance deployment. Before horizontal scaling, move rate-limit counters and realtime fanout to a shared service.

**Before launch:** Not required for one instance; required before multi-instance production.

### LOW — Tracked empty `.env.txt`

**Evidence:** `.env.txt` is tracked but verified to be zero bytes. `.env.example` is the actual template.

**Why it matters:** An empty environment file can encourage unsafe local conventions and is unnecessary repository noise.

**Fix:** Remove `.env.txt` and add an ignore rule if it is intended as a local-only file.

**Before launch:** Cleanup, not an active secret exposure.

### Security controls confirmed

- Production `COOKIE_SECRET` validation is present in `server/_core/env.ts`.
- Explicit origin allow-list and credentialed CORS are present.
- JSON body limit is 1 MB; URL-encoded limit is 256 KB.
- Guest identity is server-generated.
- Protected tRPC procedures enforce authenticated context.
- Notification mutations are protected.
- OAuth state and JWT claim validation were implemented earlier.
- Security smoke tests pass.

## 6. Database and data architecture

### Strong now

- Drizzle is the schema source of truth.
- Canonical migrations and legacy upgrade smoke tests pass.
- Foreign keys, indexes, checks, and idempotent session insertion are present.
- Leaderboard SQL uses aggregation and `LIMIT 50`.
- User lists and match history are bounded to 50 rows.

### High-value database issue

The `friend_challenges` table cannot represent the documented two-turn workflow. Add challenge result fields or, preferably, a `friend_challenge_turns` table with:

- challenge ID
- player ID
- turn status
- verified session/result ID
- submitted/completed timestamps
- server-selected question-set ID

Use a unique `(challengeId, playerId)` constraint and a server transition function.

### Scale boundaries

- **100–1,000 users:** current SQLite/modular monolith is reasonable.
- **10,000 users:** shared rate limits, backups/restores, better query observability, and question-answer secrecy become important.
- **100,000 users:** SQLite write contention, realtime fanout, and analytics aggregation need a deliberate migration plan.
- **1,000,000+ users:** requires a different storage/realtime architecture, but premature redesign is not justified now.

## 7. Performance and reliability

### Confirmed good

- Server rankings are SQL-bounded rather than loading the entire match set into application memory.
- Local history is capped to 20 sessions in the progression provider.
- Cloud lists are capped to 50 rows.
- WebSocket payloads and connection counts are bounded.
- Migrations and backups have repeatable smoke coverage.

### Remaining concerns

- `getQuestionsForPack` scans a small in-memory seed bank, which is appropriate now.
- `buildLearningAnalytics` linearly searches the small question bank for each answer. This is fine for current scale; build a map only if the bank becomes large.
- No browser performance trace, mobile device profile, bundle-size budget, or production latency percentile was available.
- **UNVERIFIED — requires further inspection:** real-device cold start, low-end Android performance, desktop layout behavior, WebSocket behavior through a production proxy, and backup restoration under production load.

## 8. UX and first-impression review

### First 5 seconds

The user sees “BIBLE ARENA,” a strong Quick Play card, and a clear CTA. This is effective. The daily habit card also communicates a reason to return.

### First 30 seconds

The product explains that sessions are timed and reference-backed. However, the Play screen’s flat list and `Soon` labels can make working features appear unavailable.

### First 2 minutes

The user can complete a session, receive explanations, see a result review, share a result, and view progression. This is the product’s strongest journey.

### Largest UX friction

The biggest UX problem is not the visual foundation; it is **status clarity**. A user should never see a working route labeled “Soon,” or a challenge labeled completed immediately after joining when no answer turn has happened.

## 9. Accessibility and responsiveness

### Confirmed improvements

- Many buttons have `accessibilityRole` and `accessibilityLabel`.
- Touch targets were raised on friends, leaderboards, challenges, and rooms.
- Emoji-only meaning was reduced.
- Long answer explanations use scrollable result content.

### Remaining

- The web app needs an actual keyboard/focus audit, especially for Pressable cards and custom navigation.
- Contrast was reviewed by code-level color usage but not measured with an automated WCAG contrast tool.
- **UNVERIFIED — requires further inspection:** small mobile, tablet, desktop, and large-desktop rendered layouts; screen-reader traversal; keyboard focus order; reduced-motion behavior.

## 10. SEO and web quality

### Present

`app/+html.tsx` includes title, description, Open Graph, Twitter card, canonical URL, theme color, and sitemap link. `public/robots.txt`, `public/sitemap.xml`, and `app/+not-found.tsx` exist.

### Deployment-dependent

`EXPO_PUBLIC_WEB_ORIGIN` defaults to localhost and must be set at build time. The sitemap currently contains a relative root placeholder rather than a verified production absolute URL. This cannot be finalized without the actual deployment hostname.

**UNVERIFIED — requires further inspection:** generated production HTML, deployed share preview cards, absolute sitemap validation, Google/Bing indexing, structured-data benefit, and Core Web Vitals.

## 11. Documentation and maintainability

The code has substantial project documentation, but some documents are stale relative to the implementation. In particular, `docs/FRIEND_CHALLENGES.md` says the current interface supports complete asynchronous turns while the server route currently marks a joined challenge completed immediately. The product should either update the code or clearly mark the document as a prototype specification.

The tracked `package.json` name remains `app-template`, which is a small but visible professionalism issue. Rename only if package identity is not relied on by deployment tooling.

## 12. Priority matrix

| Priority | Finding | Category | Impact | Effort | Recommendation |
|---|---|---|---|---|---|
| P0 | Client receives `correctAnswer` in scored sessions | Security / competitive integrity | Very high | Medium | Separate public question payloads from server answer keys; block ranked launch until addressed |
| P0 | Friend challenge join marks challenge completed with no result turns | Product / data integrity | High | Medium–High | Add challenge turns and server-controlled lifecycle before promoting asynchronous challenges |
| P1 | Missing security headers | Web security | Medium–High | Low–Medium | Add tested headers and a CSP compatible with Expo web |
| P1 | Play cards show “Soon” for working routes | UX / trust | Medium | Low | Show “Play,” “Open,” or no pill based on actual availability |
| P1 | Moderation has intake but no review decision/audit trail | Governance | Medium | Medium | Add review/resolution mutations, reviewer identity, timestamps, and admin UI |
| P1 | Realtime/rate limiting are single-instance | Scalability / abuse prevention | High at scale | Medium | Add shared backplane only when deploying multiple instances |
| P2 | SEO sitemap/OG origin requires deployment configuration | SEO | Medium | Low | Set real origin and validate generated deployment artifacts |
| P2 | Tracked empty `.env.txt` | Maintainability | Low | Low | Remove and ignore local environment files |
| P2 | External analytics absent | Product learning | Medium | Medium | Add privacy-conscious events after consent and a defined decision framework |
| P3 | Content packs are topic filters, not full translation/tradition catalogs | Content/product | Medium | High | Add reviewed content operations and source metadata before expanding catalogs |

## 13. Do-not-touch list

1. **Quick Play as the primary action.** It directly serves the core value proposition.
2. **Short 5–10 question sessions.** This is a retention advantage, not a limitation to remove.
3. **Explanation and reference after every answer.** This is the clearest differentiator.
4. **Local-first solo flow.** Do not force account creation before the first meaningful session.
5. **Domain-layer game engine and deterministic tests.** Avoid moving scoring rules into screens.
6. **Existing dark visual foundation.** Improve hierarchy and status clarity rather than replacing the identity.
7. **Modular monolith.** Do not introduce microservices without measured operational need.

## 14. Three-stage 10× roadmap

### Stage 1 — FIX

#### A. Protect competitive integrity

- **Change:** deliver question prompts/options without answer keys; verify answers on the server.
- **Why:** prevents bundle inspection from producing perfect ranked sessions.
- **Benefit:** credible leaderboards and fair competition.
- **Difficulty:** medium.
- **Dependencies:** server question-set/session API, answer-attempt contract.
- **Risk:** local practice must be labeled or supported through a separate offline mode.
- **Before launch:** yes for ranked play.

#### B. Finish friend challenges

- **Change:** add challenge turns and server result lifecycle.
- **Why:** current join operation completes the challenge before anyone plays.
- **Benefit:** social feature becomes trustworthy and replayable.
- **Difficulty:** medium–high.
- **Dependencies:** verified session records and challenge-state transitions.
- **Risk:** migration and compatibility for existing challenge rows.
- **Before launch:** yes if friend challenges are marketed as a completed feature.

#### C. Correct status language

- **Change:** remove `Soon` from working modes and group modes by purpose.
- **Why:** current labels contradict actual navigation.
- **Benefit:** better discoverability and trust with minimal effort.
- **Difficulty:** low.
- **Dependencies:** accurate feature availability map.
- **Risk:** low.
- **Before launch:** recommended.

### Stage 2 — POLISH

#### D. Add web security headers

- **Change:** tested baseline security headers and CSP.
- **Why:** defense-in-depth for the web surface.
- **Benefit:** stronger production posture.
- **Difficulty:** low–medium.
- **Dependencies:** verify Expo asset and OAuth requirements.
- **Risk:** an overly strict CSP can break web assets.
- **Before launch:** recommended.

#### E. Complete moderation workflow

- **Change:** open → investigating → resolved/rejected, reviewer identity, reason, timestamps, admin UI.
- **Why:** reports without resolution do not protect the community.
- **Benefit:** safer multiplayer and accountable governance.
- **Difficulty:** medium.
- **Dependencies:** moderation schema migration and admin policy.
- **Risk:** need clear role management.
- **Before launch:** before broad public multiplayer.

#### F. Make learning feedback more actionable

- **Change:** after a session, show one recommended pack and one reference-based review action.
- **Why:** analytics should lead to the next learning behavior.
- **Benefit:** stronger retention than adding more modes.
- **Difficulty:** low–medium.
- **Dependencies:** Phase Eight analytics already present.
- **Risk:** avoid over-gamifying Scripture learning.
- **Before launch:** no.

### Stage 3 — 10×

#### G. A trusted adaptive Scripture curriculum

- **Change:** combine verified content packs, category mastery, spaced review, and adaptive difficulty into a personal learning path.
- **Why:** this turns a quiz into a durable learning product without requiring massive feature expansion.
- **Benefit:** higher repeat value and measurable learning progress.
- **Difficulty:** high.
- **Dependencies:** answer-key separation, richer content metadata, reviewed question catalog, privacy-consented analytics.
- **Risk:** poor content quality or opaque recommendations could damage trust.
- **Before launch:** no; build after integrity foundations.

#### H. Social learning loops

- **Change:** asynchronous friend challenges, fair rematches, weekly study circles, and shared learning cards.
- **Why:** social accountability can increase return frequency more than generic leaderboards.
- **Benefit:** stronger retention and organic sharing.
- **Difficulty:** high.
- **Dependencies:** trusted challenge backend, moderation, notifications, abuse controls.
- **Risk:** competitive pressure can conflict with the learning mission.
- **Before launch:** no.

#### I. Evidence-based product analytics

- **Change:** privacy-conscious funnel events for onboarding → first round → second round → daily return → challenge participation.
- **Why:** current code cannot prove where users abandon or which features create learning value.
- **Benefit:** better product decisions and less speculative development.
- **Difficulty:** medium.
- **Dependencies:** consent model, event schema, retention policy, dashboard.
- **Risk:** collecting unnecessary personal data.
- **Before launch:** no, unless required by a specific launch decision.

## 15. Product health scorecard

| Area | Status | Evidence-based conclusion |
|---|---|---|
| Product | Strong | Clear core value: quick Scripture quiz plus explanations; social lifecycle gaps prevent “complete” status. |
| UX | Good | First action and result learning loop are strong; status contradictions and flat Play information architecture hold it back. |
| UI | Good | Coherent dark foundation and improved hierarchy; visual rendering across all device classes is unverified. |
| Engineering | Strong | Modular domain architecture, tRPC/Zod, migrations, transactions, tests, and release gate are strong. |
| Security | Good | Major initial P0 issues were fixed; answer-key exposure remains high for competitive integrity, and headers are incomplete. |
| Performance | Good | Current data sizes and bounded queries are appropriate; real-device and production latency measurements are unverified. |
| Scalability | Average | Single-instance SQLite/local realtime is appropriate now but not a multi-instance solution. |
| Accessibility | Good | Labels and touch targets improved; keyboard/screen-reader/device verification is unverified. |
| SEO | Good | Metadata foundation is present; production hostname and generated output still require deployment verification. |
| Reliability | Strong | Release checks, migration smoke, backup command, health/readiness, and security smoke pass. |
| Maintainability | Good | Domain boundaries and docs are useful, but stale challenge docs and a tracked empty `.env.txt` should be cleaned up. |

## 16. Final answers

### 1. Strongest part

The strongest part is the learning loop: a user can start immediately, answer a short question, see why it is correct, and receive a Scripture reference. That is more defensible than a generic trivia wrapper.

### 2. Biggest current blocker

The product is held back most by incomplete trust and lifecycle boundaries around competitive/social features: answer keys are client-visible and friend challenges do not yet have a true two-turn result lifecycle.

### 3. Biggest technical risk

The biggest technical risk is allowing client-visible answer keys to coexist with server-authoritative scoring. It creates the appearance of integrity while leaving ranked play trivially inspectable.

### 4. Biggest UX problem

Contradictory feature status: working routes are labeled “Soon,” while friend challenge state can appear completed before gameplay.

### 5. Biggest security concern

Answer-key exposure in the client for scored sessions. This is not an account-takeover vulnerability, but it directly undermines competitive fairness.

### 6. Biggest scalability concern

The local realtime map and in-memory rate limiter do not coordinate across instances. This is not urgent for one instance, but it must be addressed before horizontal scaling.

### 7. Biggest opportunity

Build a trusted adaptive Scripture curriculum that turns mistakes, references, packs, and spaced review into a coherent personal learning path.

### 8. What should absolutely not change

Do not remove local-first play, short sessions, explanation/reference feedback, the domain game engine, or the dark visual identity. Do not introduce microservices prematurely.

### 9. What should be fixed before real users

Before allowing real ranked users: hide answer keys from the client, complete friend challenge state/results, add baseline web security headers, set the real web origin, and verify backup restoration.

### 10. Three changes with the largest improvement

1. **Trusted competitive question delivery and verification.**
2. **Complete asynchronous friend challenges with real result records.**
3. **Turn Phase Eight analytics/content packs into a guided adaptive learning path.**

## Verification boundaries

The following could not be fully verified from the sandbox and are explicitly marked rather than guessed:

- Actual rendered visual quality on physical mobile devices, tablets, and desktop browsers.
- Keyboard navigation and screen-reader traversal in the deployed web build.
- Live OAuth provider exchange with production credentials.
- Production deployment headers, absolute sitemap, social share previews, and Core Web Vitals.
- Backup restoration on a production-sized database.
- Multi-instance WebSocket behavior behind a production load balancer.
- Real user retention, funnel conversion, and learning outcomes because no production analytics dataset was available.
