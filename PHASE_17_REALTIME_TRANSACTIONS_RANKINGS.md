# Bible Arena Phase 17 — Realtime Rooms, Atomic Settlement, and Multiplayer Rankings

**Status:** Complete foundation

## WebSocket room events

The room screen now opens an authenticated WebSocket subscription at `/ws/rooms`. Web clients use their shared secure session cookie; native clients may use the existing session token during the upgrade. After a player subscribes to a room, the server sends an initial snapshot and broadcasts authoritative snapshots after joins, readiness changes, answers, timeout advances, and rematches. The room screen no longer uses one-second polling; HTTP remains available for initial loading, mutation responses, and fallback recovery.

The server validates every subscription against the authenticated user and room membership. The event channel is a delivery layer only: room mutations and scoring remain protected database-backed procedures.

## Atomic match settlement

Completed match creation and both player progression updates now execute inside one database transaction. A deterministic match ID prevents repeat settlement from creating another reward record. A future production hardening step should add conditional room updates for simultaneous final-answer races.

## Multiplayer rankings

Authenticated users can switch the Leaderboards screen between **All games** and **Multiplayer**, then choose weekly or all-time scope. Multiplayer rankings aggregate wins, losses, draws, match count, and earned XP from durable match records. Ranking order is wins first, XP second, and match count third. The server returns player display names and ranks across accounts.

## Deployment note

The WebSocket server is attached to the existing Node HTTP process. Autoscale deployment can deliver this room model because state is durable in MySQL, but a high-concurrency realtime rollout should use the platform's persistent hosting option for stable long-lived connections. That option is usage-based, with a full-utilization ceiling of approximately $37.50/month for 1 vCPU and 0.5 GB RAM before the included $10 monthly credit, plus metered egress.

## Verification

The project includes transport parser tests, ranking aggregation tests, existing multiplayer token and timeout tests, and the complete regression suite. The final verification includes 25 active tests passing, TypeScript compilation, Expo web export, and the Node server bundle.
