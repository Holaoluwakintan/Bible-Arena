# Bible Arena Phase 16 — Authoritative Rounds, Timeouts, Rewards, and Match History

**Status:** Complete foundation

## Round security

Every active round now has a server-generated token and a 20-second deadline stored with the room. Answer mutations must provide the current token, active question index, and canonical answer option. The server rejects stale tokens, expired rounds, duplicate answers, non-members, and inactive room states.

When both players answer, the server advances the room and rotates the token and deadline. When a deadline expires, a protected timeout mutation or the next room poll advances the round without trusting client time. The final expired round completes the match using the scores already earned.

## Rewards and history

Completed matches are stored in `multiplayer_matches` with both players, final scores, winner or draw, completion reason, and XP awarded. Victories award 100 XP, defeats award 50 XP, and draws award 75 XP to each player. The reward write is tied to a deterministic match record ID so repeat requests do not intentionally create another match reward.

The Profile screen displays authenticated recent multiplayer matches, result, score, completion reason, and awarded XP. The progression provider exposes a cloud refresh action so a completed room updates the local profile without requiring an app restart.

## Verification

The multiplayer protocol tests cover readiness, token-bound answers, duplicate and stale rejection, round advancement, timeout transition, winner and draw XP values, final completion, and rematch reset. The current suite has 23 active tests passing; the existing auth logout test remains skipped.

## Next hardening

For a production tournament environment, wrap match completion and both progression writes in one database transaction, add a reward-applied marker, add server-side round event timestamps, and move room updates to conditional database writes or a single authoritative realtime worker to prevent simultaneous final-answer races.
