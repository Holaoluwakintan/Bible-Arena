# Bible Arena — Accounts and Cloud Sync

**Status:** Complete foundation

## Authentication

The existing Manus OAuth flow is now surfaced from Profile. Guests can sign in without losing their local progress. Authenticated users see their account identity, sync status, and a logout control.

## Guest migration

When an authenticated user is detected, the progression provider loads the local guest state and the server state, merges sessions and achievements by stable identifiers, preserves the highest local/cloud XP and streak values, persists the merged state locally, and sends an idempotent migration payload to the server.

The migration boundary is intentionally explicit. It prevents duplicate session records and duplicate achievement keys while keeping the device usable if the network is temporarily unavailable.

## Cloud tables

The database migration adds:

- `player_progress` — one progression snapshot per authenticated user.
- `session_records` — idempotent completed-session history used for trusted rankings.
- `friend_challenges` — server-owned share codes, participants, lifecycle, and expiry.

The generated migration is `drizzle/0001_oval_boomerang.sql`, and the corresponding schema is in `drizzle/schema.ts`.

## Protected API

The tRPC server now exposes:

| Router | Procedures | Purpose |
|---|---|---|
| `sync` | `get`, `migrate`, `recordSession` | Read and write authenticated progression and session data |
| `challenges` | `list`, `create`, `join` | Cross-device challenge lifecycle |
| `leaderboards` | `list` | Weekly and all-time server aggregation |

All user-specific procedures use `protectedProcedure`. Unauthenticated guests continue to use the local AsyncStorage adapter.

## Leaderboards

Authenticated leaderboard screens query server aggregation by week or all-time scope. The server groups completed session records by user and ranks by total score. Local ranking remains available as a fallback for guests or when the account has not yet synced.

## Current boundary

The server currently accepts completed-session results from the trusted authenticated client boundary. Before public competitive launch, add server-side answer verification or signed game results so clients cannot submit arbitrary scores. Add rate limits and abuse monitoring before opening leaderboards broadly.

## Verification

The phase was verified with:

- 16 active unit tests passing; one pre-existing auth logout test remains skipped.
- TypeScript compilation passing.
- Expo web export passing with all existing and competitive routes.
- Server bundle build passing.
- Database migration applied successfully to the project database.

## Next handoff

The next phase is Live Multiplayer: authoritative rooms, matchmaking, presence, synchronized timers, rematches, and server-verified answer events.
