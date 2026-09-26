# Bible Arena Improvement Roadmap

**Prepared:** 2026-09-26
**Repository:** `Holaoluwakintan/Bible-Arena`
**Current public GitHub main:** `b4633962 Add adaptive learning and daily Scripture habit`
**Scope:** Reconcile the attached audit with the current repository and organize every remaining improvement into practical phases.

## Executive summary

The attached audit was performed against commit `e065094`, while the current public GitHub `main` is `b4633962`. Therefore, several findings in the attachment are already resolved and should not be scheduled again:

- CORS origin reflection was replaced with an explicit allow-list.
- Client-supplied guest seeds were replaced with server-generated guest identities.
- OAuth state validation and redirect protection were added.
- Body limits and API rate limiting were added.
- SEO HTML metadata, robots, sitemap, and a not-found route were added.
- npm was made the sole package manager and `package-lock.json` is present.
- Home statistics now consume local progression state.
- Phase Eight added daily habit tracking, adaptive difficulty, focus packs, learning analytics, and richer sharing.
- The release gate passes with 14 test files and 53 tests.

The remaining work should be executed in this order:

1. **Phase 0 — Baseline correction and launch definition**
2. **Phase 1 — Competitive integrity and reliability launch gate**
3. **Phase 2 — Finish core UX and responsive commercial quality**
4. **Phase 3 — Complete social, moderation, and notification loops**
5. **Phase 4 — Content and learning expansion**
6. **Phase 5 — Growth engine for churches and groups**
7. **Phase 6 — Scale and operational maturity**
8. **Phase 7 — Premium differentiation and advanced experiences**

Do not start Phase 5–7 work until Phase 1 is complete. New features cannot compensate for an untrusted competitive foundation.

---

## Current status at a glance

| Area | Current status | Roadmap treatment |
|---|---|---|
| Package manager / lockfile | **Resolved in current main** | Verify with EAS, do not redo blindly |
| Guest authentication | **Resolved in current main** | Keep regression coverage |
| CORS | **Resolved in current main** | Add security headers in Phase 1 |
| OAuth state | **Resolved in current main** | Run live provider test before production |
| Home live statistics | **Resolved in current main** | Polish hierarchy only |
| SEO metadata | **Foundation present** | Configure real deployment origin and verify generated HTML |
| SQLite concurrency | **Still incomplete** | Enable WAL and busy timeout in Phase 1 |
| Final-question feedback | **Still incomplete** | Add explicit final feedback step in Phase 1/2 |
| Client answer-key exposure | **Still high priority** | Fix before ranked competitive launch |
| Friend challenge lifecycle | **Still incomplete** | Add server-side turns/results in Phase 1/3 |
| Desktop max-width | **Still incomplete** | Phase 2 |
| Audio feedback | **Still incomplete** | Phase 2 |
| Visual share graphic | **Still incomplete** | Phase 2 |
| In-app notification inbox | **Missing** | Phase 3 |
| Moderation decisions/audit trail | **Foundation only** | Phase 3 |
| Larger/dynamic question catalog | **Small verified bank only** | Phase 4 |
| Church/fellowship groups | **Missing** | Phase 5 |
| Live tournaments | **Missing** | Phase 6/7 after core scale work |
| Audio/oral Scripture mode | **Missing** | Phase 7 |

---

# Phase 0 — Baseline correction and launch definition

**Goal:** Remove ambiguity before implementation and establish the exact release contract.

**Priority:** P0
**Estimated effort:** 0.5–1 day
**Launch gate:** Must be completed before engineering Phase 1 starts.

## Work

### 0.1 Confirm the deployable branch

- Run the EAS/Expo build using the current `package.json` and `package-lock.json`.
- Confirm the build system selects npm rather than pnpm.
- Record the exact Android, iOS, and web build commands in `docs/production-runbook.md`.
- Treat the attached audit’s EAS failure as **historical until reproduced**; it was written against an older commit.

**Evidence:** Current `package.json` declares `packageManager: npm@10.9.2`; the repository has `package-lock.json` and no `pnpm-lock.yaml`.

### 0.2 Define product release tiers

Separate the product into:

- **Offline practice:** local questions, local scoring, local progress.
- **Authenticated learning:** cloud sync and personal progress.
- **Competitive ranked play:** server-issued questions, server-verified answers, anti-cheat controls.
- **Social play:** friend challenges, groups, realtime rooms.

This prevents the product from promising ranked integrity where the current client question model is still inspectable.

### 0.3 Establish measurement and acceptance criteria

Define launch metrics before adding analytics:

- First-session completion rate
- Second-session return rate
- Daily challenge completion rate
- Explanation/reference view rate
- Challenge creation-to-completion rate
- Error and reconnect rate
- Median and p95 API latency

**Do not add a large analytics platform yet.** First define the decisions the data must support.

---

# Phase 1 — Competitive integrity and reliability launch gate

**Goal:** Make competitive play trustworthy and make the SQLite server resilient under concurrent requests.

**Priority:** P0
**Estimated effort:** 3–7 engineering days
**Must be complete before:** ranked public launch, public leaderboards, or marketing “fair competition.”

## 1.1 Remove answer keys from competitive client payloads

**Problem:** `domain/questions.ts` exports verified question objects containing `correctAnswer`, and `app/quiz.tsx` imports those objects into the client. The server recomputes score, but a player can inspect the bundle and obtain answers before submitting.

**Change:**

- Create a public question type without `correctAnswer` and server-only question type with answer keys.
- Add a server-issued competitive session/question-set endpoint.
- Send only question ID, prompt, options, mode, and session metadata to the client.
- Submit answer attempts to the server.
- Verify question ownership, timing, answer IDs, and session state server-side.
- Keep local answer-key use only for explicitly labeled offline practice, or move all scored sessions behind the server.

**Dependencies:** Existing `recordAuthoritativeSession`, verified question bank, tRPC contracts.

**Tests:** Bundle/API contract test proving `correctAnswer` is absent from competitive payloads; tampered answer and replay tests; timing boundary tests.

**Risk:** Offline play must not silently lose functionality. Label the distinction clearly.

## 1.2 Add WAL and busy timeout

**Problem:** `server/db.ts` opens `DatabaseSync` and applies migrations but does not visibly set SQLite WAL mode or a busy timeout.

**Change:** On connection initialization, apply:

```sql
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
```

Verify the settings after opening the database. Do not run `journal_mode = WAL` on every request; run it once per connection.

**Dependencies:** Migration runner and backup procedure.

**Tests:** Concurrent read/write smoke test, locked-writer retry test, fresh database test, backup smoke test.

**Risk:** WAL creates `-wal` and `-shm` files; deployment backup procedures must capture a consistent snapshot.

## 1.3 Complete friend challenge server lifecycle

**Problem:** `joinCloudChallenge` currently assigns an opponent and sets the challenge status to `completed` immediately. The documented two-turn challenge flow is not represented durably.

**Change:** Add either a `friend_challenge_turns` table or equivalent result columns containing:

- challenge ID
- player ID
- turn state
- verified session/result ID
- score and completion timestamp, if denormalized
- unique `(challengeId, playerId)` constraint

Use server transitions:

```text
open → in_progress → complete
open → expired
in_progress → expired
```

Joining must never mean completing. The result must be derived from two verified server sessions.

**Dependencies:** Answer-key separation and authoritative session records.

**Tests:** creator turn, opponent turn, duplicate submission, expiry, unauthorized player, rematch, partial completion, replay.

## 1.4 Add baseline web security headers

Add tested middleware for:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- frame protection / CSP `frame-ancestors`
- HSTS only when deployed over HTTPS
- a CSP compatible with Expo web assets and OAuth redirects

Do not add a strict CSP without testing the generated web build.

## 1.5 Verify production auth and OAuth

The local security smoke suite passes, but live provider exchange remains unverified.

- Run a deployment-environment OAuth test with real configured provider credentials.
- Confirm callback origins and cookies in web and mobile flows.
- Confirm logout invalidates the session cookie.
- Confirm production secrets fail fast.

## Exit criteria

- No competitive payload contains answer keys.
- Friend challenge has two durable verified turns/results.
- WAL and busy timeout are verified.
- Security headers pass a deployed HTTP inspection.
- EAS build succeeds from a clean checkout.
- Release gate remains green.

---

# Phase 2 — Core UX and commercial-quality polish

**Goal:** Make every major interaction clear, complete, responsive, and emotionally satisfying.

**Priority:** P1
**Estimated effort:** 3–6 engineering days
**Depends on:** Phase 1 data contracts where relevant.

## 2.1 Fix the final-question feedback transition

**Current issue:** `app/quiz.tsx` sets `result` as soon as the final answer is submitted. This bypasses the normal “read feedback, then continue” moment for the last question.

**Change:** Keep the final `feedback` visible and show a primary action:

```text
View session results
```

Only after that action should the result review render.

**Tests:** final correct answer, final wrong answer, timeout, keyboard activation, back navigation, session recording exactly once.

## 2.2 Add responsive web framing

`components/screen-container.tsx` currently uses a full-width flex container. Add a web-only centered content frame, for example 600–720 px depending on screen type, while preserving full-width backgrounds.

- Keep mobile layout unchanged.
- Use `maxWidth` and centered alignment on web.
- Verify home, quiz, results, profile, friends, room, and settings at 320 px, 768 px, 1440 px, and 1920 px.

## 2.3 Correct feature-status language and information architecture

In `app/play.tsx`, working routes should not display `Soon`.

Group modes by intent:

- **Learn:** Quick Play, Daily Challenge, Focus Packs, Bible or Myth, Word Puzzle, Who Am I?
- **Compete:** Live Multiplayer, Ranked Matchmaking, Leaderboards
- **Social:** Friends, Challenge a Friend
- **Practice:** AI Battle / Practice Opponent

Every card must match its actual availability and route.

## 2.4 Add reconnect and failure states to live rooms

`app/room.tsx` should visibly communicate:

- Connecting
- Connected
- Reconnecting
- Reconnected
- Connection failed
- Opponent disconnected
- Match resumed or forfeited

Add retry and safe exit actions. Preserve round token/idempotency behavior.

## 2.5 Add premium but restrained audio/haptics

Use `expo-audio` only for short, optional cues:

- answer correct
- answer incorrect
- countdown warning
- level up
- session complete

Settings must include a sound toggle and respect reduced-motion/accessibility preferences. Do not make sound a requirement for comprehension.

## 2.6 Improve share output

Add a visual result card for supported platforms with:

- score
- accuracy
- level/streak
- one Scripture reference or learning takeaway
- Bible Arena branding
- no unnecessary personal data

Keep plain-text sharing as a fallback. Do not claim a “5× click-through” result until measured.

## Exit criteria

- Final answer feedback is readable before results.
- Web content is centered and tested on large screens.
- No working mode is labeled “Soon.”
- Room reconnect state is understandable.
- Audio is optional, bounded, and tested.
- Share card has platform fallback behavior.

---

# Phase 3 — Social, moderation, and notification loops

**Goal:** Turn existing social foundations into complete, safe, repeatable user journeys.

**Priority:** P1
**Estimated effort:** 1–2 weeks
**Depends on:** Phase 1 friend challenge lifecycle.

## 3.1 Finish friend challenges in the UI

- Show creator/opponent status.
- Show whose turn it is.
- Notify the opponent when a turn is ready.
- Show partial completion state.
- Show verified final comparison and rematch.
- Handle expiry and duplicate links.
- Deep-link invite codes into the correct screen.

## 3.2 Add an in-app notification inbox

Include:

- friend requests
- challenge invitations
- turn ready
- challenge result
- season reward
- moderation outcome where appropriate

Use read/unread state, pagination/retention rules, and notification preferences. Push notifications remain a delivery channel, not the source of truth.

## 3.3 Complete moderation workflow

Current reporting and open-flag listing are foundations, not a full workflow.

Add:

- `open`
- `investigating`
- `resolved`
- `rejected`
- reviewer ID
- decision reason
- timestamps
- immutable moderation audit event

Add admin UI only after role checks and mutation authorization are tested.

## 3.4 Improve abuse prevention

- Rate-limit report creation.
- Prevent self-report and duplicate spam where appropriate.
- Add challenge invite abuse controls.
- Add suspicious-match review links.
- Keep evidence access restricted to authorized moderators.

## 3.5 Add privacy-safe activity feed only if needed

Do not create a feed merely because social products have feeds. Add it only if it improves friend challenge return behavior and has clear privacy controls.

## Exit criteria

- Friend challenges can be completed across two accounts.
- Notifications remain recoverable in-app.
- Moderators can resolve reports with an audit trail.
- Abuse controls have tests and rate limits.

---

# Phase 4 — Content quality and adaptive learning expansion

**Goal:** Make the product useful for months, not just the first week.

**Priority:** P1/P2
**Estimated effort:** 2–4 weeks, including editorial review
**Depends on:** Phase 1 answer secrecy and Phase Eight analytics.

## 4.1 Expand the verified question catalog

The current bank is appropriate for early testing but can be exhausted quickly by daily users.

Build a governed content pipeline with:

- 500–1,000+ reviewed questions as the first target
- category, difficulty, testament/book, topic, audience, and sensitivity metadata
- source/reference validation
- explanation review
- duplicate detection
- translation/tradition metadata
- versioned content packs
- safe rollback for flawed questions

Never generate unsupervised doctrinal content directly into production.

## 4.2 Build real content packs

The existing Phase Eight packs are verified topic filters. Expand them into reviewed packs such as:

- Parables
- Old Testament heroes
- Gospels
- Acts and the early church
- Psalms and wisdom
- Epistles
- Family/youth level
- Church study group packs

Translation/tradition-specific packs require editorial ownership and transparent source labeling.

## 4.3 Convert analytics into a learning path

Use existing local analytics to recommend:

- one weak category
- one short review pack
- one Scripture reference revisit
- one follow-up session

Add spaced review only after question quality and answer secrecy are reliable.

## 4.4 Add content feedback loops

- “Report question” already exists; connect resolutions back to content versions.
- Track question-level error rates.
- Detect ambiguous or unusually failed questions.
- Provide editorial dashboards later, not in the player client.

## Exit criteria

- Content has review ownership and versioning.
- Packs are meaningfully different, not only labels over the same small bank.
- Recommendations are explainable.
- Question reports can result in corrected content.

---

# Phase 5 — Church and fellowship growth engine

**Goal:** Build the highest-leverage differentiated growth loop for the stated audience.

**Priority:** P2 / strategic
**Estimated effort:** 3–6 weeks
**Depends on:** Phases 1–4, especially auth, moderation, notifications, and content governance.

## 5.1 Fellowship circles

Allow a leader to create a group in under one minute:

- group name
- short code/deep link
- invite permissions
- privacy setting
- member roles
- remove/leave controls
- group-specific leaderboard

Roles should include owner, leader/moderator, and member.

## 5.2 Group challenges and weekly study mode

- weekly challenge window
- leader-selected or curated pack
- group progress, not only rank
- configurable question count
- results visible according to privacy settings
- reset/season boundaries

## 5.3 Leader and safeguarding controls

- report/remove member
- mute or restrict invitations
- age-sensitive group policy if children are a target audience
- no public exposure of personal email or unnecessary identity data

## 5.4 Viral but respectful invitations

Share a group invite, not private personal data. Deep links must expire or be revocable. Measure invite acceptance and group retention rather than assuming virality.

## Exit criteria

- A leader can create and invite a group without support.
- Group challenges work across accounts.
- Moderation and privacy controls are present.
- Group retention is measured.

---

# Phase 6 — Scale and operational maturity

**Goal:** Scale only when measured usage requires it.

**Priority:** P2/P3
**Estimated effort:** staged over 1–3 months
**Depends on:** real traffic evidence and Phase 5 usage.

## 6.1 Operational observability

Add:

- structured error tracking
- p50/p95/p99 API latency
- SQLite lock/error rate
- WebSocket disconnect/reconnect rate
- migration duration
- backup success and restore drill status
- challenge completion errors
- alert thresholds

Do not confuse logs with monitoring; the current logger is only the foundation.

## 6.2 Backup and restore discipline

- Keep scheduled snapshots.
- Test restore regularly.
- Verify WAL-aware backup consistency.
- Document RPO/RTO.
- Store backups outside the application host before production reliance.

## 6.3 Shared infrastructure when justified

Before multiple API instances:

- move realtime fanout to Redis or managed pub/sub
- move rate-limit counters to a shared store
- coordinate WebSocket routing/stickiness
- add distributed job delivery if notifications become asynchronous

Do not add Redis or microservices while one instance and SQLite meet measured demand.

## 6.4 Database migration path

At growing write volume:

- benchmark SQLite with WAL under realistic concurrent workloads
- move SQLite to persistent NVMe if still appropriate
- evaluate managed PostgreSQL or libSQL only from measured bottlenecks
- preserve domain contracts and migration tests

## 6.5 Dynamic question delivery

A remote content service/CDN becomes worthwhile when:

- the verified bank is large enough to affect bundle size
- content updates need to ship independently of the app
- packs are versioned and signed
- offline caching and rollback are implemented

## Exit criteria

- Restore drills pass.
- Alerts catch real failure modes.
- Scaling decisions are based on measured thresholds.
- No multi-instance deployment uses local-only state accidentally.

---

# Phase 7 — Premium differentiation and advanced experiences

**Goal:** Add high-leverage experiences only after trust, reliability, and content depth are strong.

**Priority:** P3 / strategic
**Estimated effort:** individual initiatives from 2 weeks to several months

## 7.1 Oral Scripture / audio clue mode

- short, high-quality voice clues
- captions and transcript fallback
- accessible answer interaction
- consent and data/bandwidth considerations
- human review of generated or recorded content

This expands accessibility and family use, but it should not precede content and answer-integrity work.

## 7.2 Scheduled tournaments

Start with small, measurable events rather than a 64-player system immediately:

1. scheduled 8-player bracket
2. reliable results and reconnects
3. moderation and anti-cheat
4. event notifications
5. larger bracket only after load evidence

## 7.3 Premium Scripture celebration

- restrained streak milestone animations
- verse celebration card after perfect rounds
- save/share wallpaper output
- reduced-motion alternative

## 7.4 Dynamic streak identity

Use 3, 7, 30, and 100-day milestones only if they remain encouraging rather than guilt-inducing. Always provide grace/recovery behavior for missed days.

## 7.5 Monetization, only if necessary

Potential ethical options:

- paid curated study packs
- group leader tools
- optional supporter tier
- no pay-to-win ranked advantages
- transparent privacy and content provenance

Do not add monetization until retention and value are demonstrated.

---

# Deferred or rejected work

These should **not** be started merely because they appear in the audit:

- Microservices without measured scaling pressure
- A 64-player tournament before smaller events work
- A large analytics platform before defining product decisions
- Remote content infrastructure before content governance and versioning exist
- A complex notification queue before in-app notification truth exists
- A full AI opponent before the practice experience and anti-cheat boundaries are clear
- Broad redesign of the visual theme
- Rewriting the pure domain layer

For every new infrastructure proposal, answer:

1. What measured problem does it solve?
2. What is the simplest implementation that solves it?
3. What operational burden does it introduce?
4. What is the rollback plan?

---

# Master priority matrix

| Priority | Work | Category | Impact | Effort | Before launch? |
|---|---|---|---:|---:|---|
| P0 | Hide answer keys from ranked competitive clients | Security / integrity | Very high | Medium | Yes for ranked |
| P0 | Complete friend challenge turn/result lifecycle | Product / data integrity | High | Medium–High | Yes if advertised |
| P0 | Enable WAL, busy timeout, foreign keys | Reliability | High | Low | Yes for concurrent production |
| P0 | Verify clean EAS build from current main | Deployment | High | Low | Yes for app-store launch |
| P1 | Preserve final answer feedback | UX | High | Low | Strongly recommended |
| P1 | Add security headers | Web security | Medium–High | Low–Medium | Recommended |
| P1 | Fix desktop max-width and feature status labels | UX / web | Medium | Low | Recommended |
| P1 | Add reconnect states to live rooms | Reliability / UX | High | Medium | Yes for promoted realtime play |
| P1 | Finish moderation decisions and audit trail | Safety | High | Medium | Before broad social launch |
| P1 | Expand governed question bank | Content | High | High | Not before first launch, yes for retention |
| P2 | In-app notification inbox | Retention | Medium–High | Medium | No |
| P2 | Visual share cards | Growth | Medium–High | Medium | No |
| P2 | Real fellowship circles | Growth | Very high | High | No |
| P2 | Dynamic reviewed content delivery | Content / scale | High | High | No |
| P3 | Shared realtime backplane | Scale | High at scale | Medium–High | Only before multi-instance |
| P3 | External monitoring and restore drills | Operations | High | Medium | Before serious growth |
| P3 | Oral Scripture mode | Accessibility / differentiation | High | High | No |
| P3 | Scheduled tournaments | Growth / competition | High | Very high | No |

---

# Do-not-touch list

1. Pure `domain/` architecture and deterministic game rules.
2. Local-first progression and offline storage.
3. The authoritative WebSocket round-token and timeout protocol.
4. Quick Play as the primary action.
5. Short sessions with explanation and Scripture reference after every answer.
6. The dark midnight-blue/gold visual foundation.
7. Modular monolith architecture until measurements justify distributed services.
8. Server-side recomputation and idempotent progression writes.

---

# Recommended execution order

## First release gate

1. Verify EAS build from current main.
2. Add SQLite WAL/busy timeout.
3. Hide answer keys from ranked sessions.
4. Finish friend challenge server lifecycle.
5. Add final-question feedback transition.
6. Add security headers and run deployment smoke tests.

## Then commercial polish

7. Fix desktop framing.
8. Remove incorrect “Soon” labels and regroup Play modes.
9. Add reconnect UI.
10. Add restrained sound feedback.
11. Add visual scorecard sharing.

## Then retention and growth

12. Finish notification inbox and moderation workflow.
13. Expand governed content packs.
14. Build fellowship circles.
15. Measure group retention and challenge completion.

## Then scale and differentiation

16. Add observability and restore drills.
17. Introduce shared infrastructure only at measured thresholds.
18. Add oral Scripture mode and small scheduled tournaments.
19. Consider advanced monetization only after demonstrated user value.

---

# Final decision summary

The attached audit correctly identified the original project’s major weaknesses, but it is stale relative to current `main`. The project should **not** redo the already-completed security, SEO, package-manager, and home-dashboard work.

The next engineering phase should focus on **competitive answer secrecy, SQLite concurrency, friend challenge correctness, final-question feedback, and EAS verification**. These are the highest-leverage fixes because they protect trust and release readiness.

The next product phase should focus on **commercial clarity and retention**, not immediately on a larger feature count. After that, fellowship circles are the most strategically aligned growth opportunity for the product’s Christian audience.

The core product should remain a fast, reverent, explanation-led Scripture learning game. The goal is not to turn it into an overbuilt social network; the goal is to make the existing learning loop trustworthy, polished, repeatable, and meaningfully communal.
