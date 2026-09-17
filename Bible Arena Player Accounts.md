# Bible Arena Player Accounts

**Status:** Phase 12 — Player Accounts  
**Version:** 0.1

## Account model

The provider-neutral `PlayerAccount` model contains a stable account ID, display name, optional email, avatar initials, locale, timezone, guest state, and timestamps. `AuthSession` contains only the active account ID and sign-in timestamp. This keeps UI and domain code independent from a future authentication provider.

The prototype begins with a durable guest account. Profile editing updates the display name and derives initials automatically. The profile shows whether the active identity is a guest and explains that its data remains on the current device.

## Persistence and identity

Accounts and the active session are stored in versioned browser `localStorage` records. Progression and achievements are now keyed by account ID, so changing the active identity will not mix XP, levels, streaks, or badges. Friend Challenge ownership and result recording use the active account ID instead of a hard-coded guest identifier.

The current sign-out action clears the session and starts a fresh guest session for the local prototype. A production implementation should replace this behavior with a real unauthenticated state and a protected sign-in flow.

## Security boundary

No passwords or authentication secrets are stored by this prototype. The account store is a local identity boundary only. Production authentication must use a trusted provider, secure session handling, server-side authorization, and account ownership checks for progression and challenges.

## Phase 12 acceptance criteria

Phase 12 is complete when the app has a typed account and auth-session contract, a durable guest profile, editable display name and initials, sign-out behavior, account-scoped progression and badges, and account-aware challenge ownership.

## Next handoff

Phase 13 should add leaderboard views backed by account IDs and period-scoped ranking data. The current profile and challenge boundaries provide the player identity needed for ranking queries.
