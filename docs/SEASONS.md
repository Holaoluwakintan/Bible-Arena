# Bible Arena Seasons

**Status:** Phase 15 — Seasons  
**Version:** 0.1

## Season model

The season domain defines a stable season ID, display name, subtitle, start and end dates, and ordered competitive tiers. The initial season is **Autumn Ascension**, running from September 1 through December 1, 2026. A deterministic fallback keeps the current prototype usable outside the configured date range.

The initial tiers are Seedling, Pathfinder, Scribe, and Elder. Each tier has a minimum season-point threshold and a presentation color. Tier selection always chooses the highest threshold the player has reached.

## Progression

Completed results award season points based on score, with a minimum of one point per valid result. Season progress tracks points, completed matches, best score, and last-played timestamp. Progress is account-scoped and resets when the active season changes.

The Profile screen displays the current season, tier, points, match count, progress track, and points remaining to the next tier. The existing leaderboard remains available as the score-ranking surface; season progress is the competitive progression layer above individual records.

## Persistence boundary

Season progress is stored in a versioned local record keyed by account ID. The store ignores duplicate completion timestamps and refuses to apply a result to a progress record from an inactive season. Production should move season state to a server-authoritative account record with season IDs, reward grants, and anti-replay validation.

## Phase 15 acceptance criteria

Phase 15 is complete when the project has deterministic season definitions and boundaries, tier calculation, account-scoped progress, score-based season awards, duplicate-safe updates, and a profile presentation for the current season.

## Next handoff

Phase 16 should add season rewards and a reward-claim boundary. Tier milestones can then unlock cosmetic titles, badge variants, and future profile customization.
