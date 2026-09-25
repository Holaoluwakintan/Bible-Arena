# Bible Arena Product Specification

**Status:** Phase 0 — Product Foundation  
**Version:** 0.1  
**Working name:** Bible Arena  
**Working tagline:** *Know the Word. Challenge the World.*

## 1. Product Summary

Bible Arena is a mobile-first, competitive Bible knowledge game. It combines short quiz sessions, puzzle-based play, immediate explanations, progression, and social competition. The first release must feel like a polished modern game rather than a Bible study application with a quiz attached.

The product promise is:

> **Learn the Bible. Test yourself. Challenge others. Become better.**

The initial product will prioritize fast, understandable gameplay. Future capabilities such as live multiplayer, groups, tournaments, user-generated quizzes, and advanced personalization will be added only after the core loop is stable.

## 2. Target Players

| Audience | Need | Product response |
|---|---|---|
| Christians and regular Bible readers | Test and deepen existing knowledge | Verified questions, explanations, references, and progression |
| Teenagers and young adults | Short, social, game-like engagement | Quick sessions, streaks, ranks, challenges, and shareable results |
| Families and Bible study groups | Play and learn together | Friend challenges and group-ready session design |
| Churches and Christian schools | Structured knowledge competition | Extensible challenge, leaderboard, and event architecture |
| General trivia players | Accessible knowledge game | Clear rules, varied modes, and a low-friction first session |

The product must remain welcoming to players with different levels of Bible familiarity. A player should be able to start without knowing specialist terminology or belonging to a particular denomination.

## 3. Core Loop

The core loop is:

**Play → Answer → Learn → Improve → Compete → Rank → Share → Return**

| Step | Player experience | Required product behavior |
|---|---|---|
| Play | Select a mode and begin quickly | Present a clear mode entry point and minimal setup |
| Answer | Respond under light time pressure | Make the question, options, timer, and progress obvious |
| Learn | See whether the answer was correct and why | Show an explanation and Scripture reference after each answer |
| Improve | Notice weak categories and repeat play | Track results by session and category |
| Compete | Compare performance with others or an AI opponent | Support AI play in the MVP and design for future challenges |
| Rank | Earn XP, levels, streak progress, and leaderboard position | Persist progression and show meaningful feedback |
| Share | Turn a result into an invitation | Produce a privacy-safe shareable result summary |
| Return | Have a reason to play again | Provide a daily challenge, streak protection through consistent play, and varied questions |

## 4. MVP Scope

The MVP is complete when a player can enter the app, play the initial game modes, learn from every answer, earn progression, compare results, and invite a friend without requiring live multiplayer infrastructure.

| Capability | MVP definition | Priority |
|---|---|---:|
| Bible Quiz | Ten-question multiple-choice session with timer, progress, score, and explanations | P0 |
| Bible or Myth | True/false statements with explanation and Scripture reference where applicable | P0 |
| Word Puzzle | Short Bible-related word puzzle using a reusable puzzle session flow | P0 |
| Who Am I? | Character identification from progressive clues | P0 |
| Daily Challenge | One rotating daily session with a completion state and streak contribution | P0 |
| XP and levels | Award XP for completed play and correct answers; calculate level from XP | P0 |
| Streaks | Track consecutive daily participation using the player's local calendar day and server timestamps when accounts exist | P0 |
| Leaderboard | Show a weekly or all-time ranking based on earned competitive score or XP, with privacy-safe display names | P0 |
| Friend challenge | Create a challenge payload that another player can open and complete asynchronously | P0 |
| AI opponent | Provide a deterministic, difficulty-configured opponent for supported modes | P0 |
| Answer explanations | Display a concise explanation and reference after every submitted answer | P0 |
| Shareable results | Generate a share summary without exposing private account information | P0 |

The MVP excludes live multiplayer, public chat, payments, advertising, church administration, school administration, user-generated public quizzes, and automated publication of unverified Bible content.

## 5. Screen Map

### Entry and navigation

1. **Welcome / onboarding:** Explain the value proposition and allow the player to start quickly.
2. **Home:** Show the primary play action, daily challenge, XP and level, streak, and a compact leaderboard preview.
3. **Mode selection:** Present Bible Quiz, Bible or Myth, Word Puzzle, Who Am I?, Daily Challenge, and AI Battle.
4. **Profile:** Show display name, level, XP, streak, achievement summary, and recent performance.
5. **Leaderboard:** Show ranking scope, the player's position, and nearby players.

### Gameplay

6. **Pre-game setup:** Show mode, question count, expected duration, and rules. AI Battle also shows opponent difficulty.
7. **Game session:** Show question content, answer controls, timer where applicable, progress, and current score.
8. **Answer feedback:** Show correct or incorrect state, explanation, Scripture reference, and a continue action.
9. **Results:** Show score, accuracy, XP earned, streak change, category performance, and replay/share/challenge actions.

### Social and supporting states

10. **Challenge creation:** Create a challenge from a supported mode and produce a shareable link or code.
11. **Challenge join:** Resolve a link or code, explain the challenge rules, and start the session.
12. **Settings:** Manage sound, notifications, display name, privacy, and account state.
13. **Loading, empty, error, and offline states:** Every network-dependent screen must provide a clear recoverable state.

The first implementation should use a small number of reusable components instead of one bespoke component per screen.

## 6. Game Rules

### 6.1 Shared session rules

A session has a mode, a question set, a player, a start time, an answer sequence, and a result. The server or trusted game layer must determine the question set and validate submitted answers when persistent accounts are available. The client may render state but must not be trusted to award unrestricted XP or alter the correct answer.

Each question has exactly one canonical answer for competitive scoring. Questions with ambiguous wording, disputed answers, missing references, or incomplete explanations must not enter the competitive pool.

### 6.2 Bible Quiz

A Quick Play session contains ten questions. Each question has four options and a default response window of twenty seconds. A correct answer earns 100 base points before any future speed or difficulty modifiers. An incorrect answer earns zero question points. The player sees feedback after submitting an answer or after the timer expires.

### 6.3 Bible or Myth

The player classifies a statement as Bible or Myth. A statement marked **Bible** must be supported by a source reference. A statement marked **Myth** must include an explanation that distinguishes the popular claim from what the biblical text does or does not say. The feedback screen must avoid presenting an interpretation as an uncontested fact when the issue is genuinely interpretive.

### 6.4 Word Puzzle

The first version supports one short puzzle format, such as unscrambling a verified Bible-related word. The puzzle must define the accepted answer, normalize harmless differences in capitalization and whitespace, and show an explanation after submission.

### 6.5 Who Am I?

The player receives up to three clues about a biblical person and selects or enters the identity. Earlier answers are worth more than later answers. The first version may use fixed scoring values of 300, 200, and 100 points for correct answers after clue one, two, or three respectively.

### 6.6 Daily Challenge

The daily challenge is the same challenge for all players in the configured content locale and calendar day. A player can submit it once for leaderboard and streak purposes. Replays may be allowed for learning but must not award duplicate competitive rewards.

### 6.7 AI opponent

The AI opponent does not need generative AI in the MVP. It should use configured accuracy and response-time distributions so that difficulty is predictable, testable, and fair. The opponent's behavior must not reveal the correct answer before the player submits.

## 7. Progression Rules

XP rewards learning and completed participation. The initial reward policy is intentionally simple and configurable:

| Event | XP |
|---|---:|
| Correct Bible Quiz answer | 100 |
| Correct answer in another mode | 100 |
| Completed session | 50 |
| First daily challenge completion of the day | 100 |

The implementation must store reward events or an auditable equivalent so duplicate submissions cannot award duplicate rewards. Level thresholds must be defined in one configuration module rather than scattered across the UI.

A streak increments when the player completes at least one eligible session on a new consecutive calendar day. A player who plays multiple eligible sessions on the same day does not gain multiple streak days. Time-zone behavior must be explicit before account-based streaks are released.

## 8. Content and Verification Requirements

Bible Arena must treat question content as a moderated domain. Every question record requires a question, canonical answer, explanation, Scripture reference when applicable, content type, category, difficulty, source, and verification status.

| Verification status | Meaning | Eligible for competitive play |
|---|---|---:|
| Draft | Content is being authored | No |
| Review | Content awaits human review | No |
| Verified | Content passed review and has required evidence | Yes |
| Rejected | Content is not approved | No |

AI may assist with drafting, classification, or explanation suggestions. AI output must not automatically establish biblical authority. Human review is required before content becomes competitive.

## 9. Initial Data Model

The schema should remain relational and provider-neutral during Phase 0. Phase 1 will select the concrete persistence and authentication implementation.

| Entity | Purpose | Minimum fields |
|---|---|---|
| Player | Persistent identity and progression owner | id, display_name, avatar_url, locale, timezone, created_at, updated_at |
| Question | Canonical content unit | id, type, prompt, options, correct_answer, category, difficulty, explanation, book, chapter, verse, translation, source, status |
| GameSession | One playable attempt | id, player_id, mode, question_set_id, status, started_at, completed_at, score, accuracy |
| SessionQuestion | Question order and answer state | id, session_id, question_id, position, presented_at, answer, is_correct, response_ms, points |
| RewardEvent | Auditable progression change | id, player_id, session_id, event_type, amount, idempotency_key, created_at |
| Streak | Daily participation summary | player_id, current_count, best_count, last_eligible_date |
| Challenge | Asynchronous invitation between players | id, creator_id, mode, session_configuration, share_code, status, expires_at, created_at |
| LeaderboardEntry | Materialized ranking view or query source | id, scope, scope_key, player_id, score, rank, period_start, period_end |
| Achievement | Defined milestone | id, key, name, description, icon_key |
| PlayerAchievement | Player milestone completion | player_id, achievement_id, unlocked_at |

Correct answers should not be sent to an untrusted client before submission. Content APIs should expose only the fields required for the current play state.

## 10. Design Direction

The visual identity should be **premium, energetic, intelligent, game-like, and Biblical**. It should avoid stereotypical church graphics, excessive cross imagery, generic Bible backgrounds, and gold-heavy decoration.

The initial design system should define a dark navy foundation, warm parchment or ivory content surfaces, a restrained accent color for actions, a success color, an error color, typography hierarchy, spacing scale, corner radii, and accessible contrast states. Components must support touch targets of at least 44 points, readable text, keyboard navigation where relevant, and reduced-motion preferences where the platform supports them.

The interface should make three facts immediately visible during play: what the question asks, what the player can do, and how much progress remains.

## 11. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Mobile-first | Core play must be usable on small phone screens before tablet or desktop enhancements |
| Reliability | A completed answer must not be silently lost; retry behavior must be explicit |
| Security | Secrets remain server-side; reward and answer validation cannot rely solely on client state |
| Accessibility | Text, contrast, touch targets, focus state, and non-color feedback must be considered from the first UI implementation |
| Performance | Home and gameplay screens should avoid unnecessary network requests and heavy assets |
| Content integrity | Competitive questions must have verification status and source metadata |
| Observability | Errors and important session transitions should be diagnosable without logging private answer data unnecessarily |
| Scalability | Use modular boundaries so content, game rules, progression, and social features can evolve independently |

## 12. Phase 0 Acceptance Criteria

Phase 0 is complete when the team can answer the following without guessing:

- What Bible Arena is and who it serves.
- What the first release includes and explicitly excludes.
- What screens are required for the first playable journey.
- How the first four game modes score and progress.
- What information is required to verify question content.
- What entities and relationships the technical foundation must support.
- What security, accessibility, reliability, and performance constraints apply.
- What work belongs in Phase 1 rather than being prematurely implemented now.

## 13. Phase 1 Handoff

Phase 1 should audit the repository and then establish the technical and design foundation. It should select the application framework, package manager, navigation approach, state boundaries, environment strategy, authentication plan, persistence approach, API boundaries, and reusable design-system components. Phase 1 must preserve the content verification and server-trust requirements defined here.

## References

[1]: https://github.com/Holaoluwakintan/Bible-Arena "Bible Arena repository"
