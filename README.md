# Bible Arena ⚔️📖

A competitive, real-time Bible trivia game built with **React Native / Expo** and an **Express + tRPC** backend.

---

## 🚀 Quick Start (Local Preview)

### 1. Prerequisites
- **Node.js**: v20 or newer (built with Node v24)
- **Package manager**: npm or pnpm

### 2. Install Dependencies
```bash
npm install --legacy-peer-deps
# or
pnpm install
```

### 3. Run the App (Frontend + Backend)
```bash
npm run dev
# or
pnpm dev
```
This starts both:
- 🌐 **Backend server** on `http://localhost:3000` (Express + tRPC + WebSockets + SQLite)
- 📱 **Expo Metro bundler** on `http://localhost:8081` (Web & Mobile)

Open **[http://localhost:8081](http://localhost:8081)** in your browser!

---

## 🎮 Features & How to Test

### Single Player Modes (No Account Needed)
- **Bible Quiz**: 10 timed, canonical Scripture questions with instant scoring and accuracy calculation.
- **Bible or Myth**: Spot biblical truth from cultural tradition (5 curated statements).
- **Word Puzzle**: Unscramble Scripture words with letter verification.
- **Daily Challenge**: A deterministic daily quiz shared across players.
- **AI Battle**: Challenge an AI rival with configurable difficulties (Novice, Scholar, Scribe).

### Cloud & Multiplayer Modes (Demo / Guest Mode Included)
1. Navigate to the **Profile** tab.
2. Click **"Enable Cloud Sync (Demo)"**.
   - Creates a local guest session instantly.
   - Connects to the local SQLite database.
   - Syncs XP, achievements, levels, and completed game sessions.
3. Once enabled, you can:
   - **Challenge a Friend**: Generate a 6-digit share code or join a friend's challenge.
   - **Live Multiplayer**: Create or join real-time private rooms with WebSocket-synchronized rounds, countdown timers, and live scores.
   - **Leaderboards**: View weekly and all-time rankings.

---

## 🔌 Switching to Production (Database & OAuth)

The architecture is modular and ready for production without code changes:

### 1. Database
- **Local development**: Automatically uses SQLite stored at `./bible_arena_dev.sqlite`.
- **Production (MySQL)**: Set `DATABASE_URL` in `.env`:
  ```env
  DATABASE_URL=mysql://user:password@hostname:3306/bible_arena
  ```

### 2. Authentication (Google / GitHub OAuth)
- **Local development**: Click "Play as Demo Guest" or "Enable Cloud Sync (Demo)".
- **Production OAuth**: Add your OAuth portal credentials to `.env`:
  ```env
  OAUTH_SERVER_URL=https://auth.yourdomain.com
  EXPO_PUBLIC_OAUTH_PORTAL_URL=https://auth.yourdomain.com
  EXPO_PUBLIC_APP_ID=your-registered-app-id
  ```
  The OAuth flow in `app/profile.tsx` and `app/callback.tsx` is already fully wired to use these variables when set.

---

## 📁 Project Structure

```
├── app/                    # Expo Router screens (Tabs, Quiz, Room, etc.)
│   ├── _layout.tsx         # Root layout with QueryClient, tRPC & tab bar
│   ├── index.tsx           # Home screen
│   ├── play.tsx            # Game mode selector
│   ├── quiz.tsx            # Interactive quiz session
│   ├── room.tsx            # Live multiplayer room
│   ├── profile.tsx         # User profile, XP, levels & auth
│   ├── leaderboards.tsx    # Weekly & all-time leaderboards
│   ├── challenges.tsx      # Friend challenge codes
│   ├── ai-battle.tsx       # AI rival battle mode
│   └── settings.tsx        # Audio, theme & app settings
├── components/             # Reusable UI components
│   ├── screen-container.tsx
│   ├── themed-view.tsx
│   ├── haptic-tab.tsx
│   └── ui/icon-symbol.tsx  # Cross-platform icon component
├── domain/                 # Pure game logic & domain models
│   ├── questions.ts        # Verified question bank & validation
│   ├── game-engine.ts      # Scoring, timer, session lifecycle
│   ├── progression.ts      # Levels, XP curves & achievements
│   ├── multiplayer.ts      # Room state transitions & answer evaluation
│   ├── ranked-competition.ts
│   └── local-storage.ts    # Device-level offline cache
├── server/                 # Express backend
│   ├── _core/index.ts      # Server entry point with tRPC & WebSocket upgrade
│   ├── _core/guest-auth.ts # Demo / guest authentication
│   ├── _core/sdk.ts        # JWT session creation & verification
│   ├── db.ts               # Database layer (SQLite / MySQL)
│   ├── routers.ts          # tRPC API router
│   └── ws.ts               # WebSocket room synchronization
├── drizzle/                # Database schema
│   └── schema.ts
├── hooks/                  # React hooks (useAuth, useColors)
├── lib/                    # Client libraries (tRPC client, progression provider)
└── tests/                  # Automated test suite (vitest)
```

---

## 🧪 Testing

Run unit tests:
```bash
npm test
```
