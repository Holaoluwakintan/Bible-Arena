# Bible Arena Progression

**Status:** Phase 5 — XP, Levels, and Streaks  
**Version:** 0.1

## Progression model

A player progression record contains total XP, current level, level title, current streak, best streak, last eligible calendar date, completed session identifiers, and an update timestamp. Level thresholds are centralized in `src/progression/progression.ts` so product tuning does not require UI changes.

The initial levels are New Seeker, Curious Reader, Word Explorer, Scripture Student, Faithful Learner, Bible Scholar, and Scripture Seeker. The current level is the highest configured threshold that does not exceed the player’s total XP.

## XP awards

Completed Bible Quiz results already contain `xpEarned` from the Phase 3 result engine. Phase 5 adds that XP to the player progression only once per session identifier. The completed-session identifier list provides an idempotency guard while the app uses local persistence. A server implementation must enforce the same rule with a unique reward or session constraint.

## Streak rules

An eligible completed session increments the streak when its calendar date is one day after the previous eligible date. Repeated sessions on the same calendar date do not increase the streak. A gap of more than one calendar day resets the current streak to one. The best streak is retained. Calendar dates are derived with an explicit timezone parameter so account-based behavior can later use the player’s configured timezone.

## Storage boundary

`src/progression/progressionStore.ts` persists the guest progression record in browser `localStorage` using a versioned key and falls back safely when storage is unavailable or malformed. This is appropriate for a local prototype, but it is not authoritative for competitive play. Phase 12 should move account progression to trusted persistence and reconcile local guest progress during account creation.

## Phase 5 acceptance criteria

Phase 5 is complete when a completed quiz updates XP and streak state, duplicate completion cannot award duplicate XP, level thresholds and progress can be calculated, a missed day resets the active streak while preserving the best streak, and the result is retained between browser sessions when local storage is available.

## Next handoff

Phase 6 can add Bible or Myth as a second mode using the same game engine. Progression should remain mode-agnostic and consume only the completed result contract.
