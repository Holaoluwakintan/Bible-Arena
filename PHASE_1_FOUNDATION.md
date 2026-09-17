# Bible Arena Phase 1 — Technical and Design Foundation

**Status:** Complete

Bible Arena now has a native Expo and React Native foundation with typed routing, mobile-safe screen containers, NativeWind-compatible theme tokens, and a first navigation shell for the core product journey.

## Implemented scope

The project uses Expo SDK 54, React Native, TypeScript, Expo Router, NativeWind, and the existing server/database-capable template. Phase 1 intentionally keeps the player experience local while the question system and game engine are built.

The current tab shell contains:

| Route | Purpose |
|---|---|
| `/` | Home dashboard with the product promise, progression preview, daily challenge entry point, and session CTA |
| `/play` | Game mode selection with Quick Play as the first active milestone and roadmap modes clearly marked |
| `/profile` | Local guest identity, level preview, progression state, and empty learning history |
| `/settings` | Sound and reminder preferences plus explicit local-account and foundation boundaries |

## Design system

The visual direction uses a dark navy foundation, warm parchment surfaces, restrained amber actions, teal success states, accessible muted text, and compact rounded cards. The palette is centralized in `theme.config.js` so NativeWind and runtime colors share one source of truth.

Primary interactions include mobile press feedback and haptics on supported native platforms. Every screen uses `ScreenContainer` for safe-area handling, and the tab bar maintains bottom inset spacing for notched devices and the home indicator.

## Verification

The completed Phase 1 foundation has been verified with:

- TypeScript compilation using `pnpm exec tsc --noEmit`.
- Unit tests using Vitest for the design-token contract.
- Expo web export using `pnpm exec expo export --platform web`.
- Static route generation for Home, Play, Profile, and Settings.

The first skipped authentication test is inherited from the template because no authentication behavior has been implemented yet.

## Next milestone

Phase 2 should establish the typed question contract, verified seed content, content validation rules, and a provider-neutral question repository. The UI should continue to consume question data through domain modules rather than embedding correct answers inside screens.
