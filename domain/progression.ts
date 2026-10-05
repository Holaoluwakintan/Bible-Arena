export const LEVEL_NAMES = [
  "Seeker", "Listener", "Learner", "Word Walker", "Faithful Reader",
  "Lamp Bearer", "Scroll Keeper", "Wisdom Builder", "Psalm Singer", "Truth Seeker",
  "Disciple", "Kingdom Learner", "Steadfast", "Bereans’ Friend", "Scripture Guide",
  "Light Bearer", "Watchman", "Shepherd", "Kingdom Scholar", "Truth Keeper",
  "Faithful Steward", "Wise Builder", "Mentor", "Pillar", "Overcomer",
  "Scribe", "Teacher of the Word", "Elder", "Champion of the Word", "Arena Elder",
] as const;

/** XP needed to reach each level (index 0 = level 1). Smooth curve: 500·(L−1)^1.7. */
export const LEVEL_THRESHOLDS: readonly number[] = LEVEL_NAMES.map((_, index) => index === 0 ? 0 : Math.round((500 * Math.pow(index, 1.7)) / 50) * 50);

export interface RewardEvent {
  id: string;
  type: "correct_answer" | "session_complete" | "daily_challenge" | "bonus";
  amount: number;
  idempotencyKey: string;
  createdAt: number;
}

export interface ProgressionSnapshot {
  totalXp: number;
  currentStreak: number;
  bestStreak: number;
  lastEligibleDate: string | null;
  rewardEvents: RewardEvent[];
}

export interface AchievementDefinition {
  key: string;
  name: string;
  description: string;
  icon: string;
  tier?: "bronze" | "silver" | "gold";
}

export interface UnlockedAchievement extends AchievementDefinition {
  unlockedAt: number;
}

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  { key: "first_session", name: "First Step", description: "Finish your first round.", icon: "book.fill", tier: "bronze" },
  { key: "five_sessions", name: "Keep Showing Up", description: "Finish five rounds.", icon: "sparkles", tier: "bronze" },
  { key: "twentyfive_sessions", name: "Devoted", description: "Finish 25 rounds.", icon: "sparkles", tier: "silver" },
  { key: "perfect_session", name: "Perfect Form", description: "Get every answer right in a round.", icon: "trophy.fill", tier: "silver" },
  { key: "perfect_five", name: "Flawless", description: "Play five perfect rounds.", icon: "trophy.fill", tier: "gold" },
  { key: "combo_three", name: "On Fire", description: "Hit a ×2 combo (3 in a row).", icon: "flame.fill", tier: "bronze" },
  { key: "combo_six", name: "Unstoppable", description: "Hit a ×3 combo (6 in a row).", icon: "bolt.fill", tier: "silver" },
  { key: "combo_ten", name: "Ten in a Row", description: "Answer 10 in a row correctly.", icon: "bolt.fill", tier: "gold" },
  { key: "streak_three", name: "In Rhythm", description: "Reach a 3-day streak.", icon: "flame.fill", tier: "bronze" },
  { key: "streak_seven", name: "Week of the Word", description: "Reach a 7-day streak.", icon: "flame.fill", tier: "silver" },
  { key: "streak_thirty", name: "Rooted", description: "Reach a 30-day streak.", icon: "flame.fill", tier: "gold" },
  { key: "daily_first", name: "Daily Bread", description: "Complete a Daily Challenge.", icon: "calendar", tier: "bronze" },
  { key: "daily_seven", name: "Daily Devotee", description: "Complete 7 Daily Challenges.", icon: "calendar", tier: "silver" },
  { key: "survivor_ten", name: "Survivor", description: "Reach 10 in Survival.", icon: "heart.fill", tier: "bronze" },
  { key: "survivor_twentyfive", name: "Endurance", description: "Reach 25 in Survival.", icon: "heart.fill", tier: "gold" },
  { key: "orderly", name: "In Good Order", description: "Solve 5 order-the-events puzzles.", icon: "list.number", tier: "bronze" },
  { key: "cat_people", name: "Know the People", description: "Master half of People.", icon: "person.2.fill", tier: "silver" },
  { key: "cat_places", name: "Map Reader", description: "Master half of Places.", icon: "map.fill", tier: "silver" },
  { key: "cat_events", name: "Witness", description: "Master half of Events.", icon: "bolt.fill", tier: "silver" },
  { key: "cat_teachings", name: "Wise Heart", description: "Master half of Teachings.", icon: "lightbulb.fill", tier: "silver" },
  { key: "cat_books", name: "Bookworm", description: "Master half of Books & Words.", icon: "book.fill", tier: "silver" },
  { key: "level_five", name: "Lamp Bearer", description: "Reach level 6.", icon: "star.fill", tier: "silver" },
  { key: "level_ten", name: "Disciple", description: "Reach level 11.", icon: "star.fill", tier: "gold" },
  { key: "bible_or_myth", name: "Myth Buster", description: "Finish a Bible or Myth round.", icon: "sparkles", tier: "bronze" },
];

export interface AchievementProgressInput {
  progression: ProgressionSnapshot;
  sessions: Array<{ mode: string; accuracy: number }>;
  /** Optional arena stats (structural, to avoid a circular import). */
  arena?: {
    roundsPlayed: number; perfectRounds: number; bestCombo: number; survivalBest: number;
    orderSolved: number; dailyHistory: string[];
    masteryPct?: Record<string, number>;
  };
}

export function unlockAchievements(
  unlocked: UnlockedAchievement[],
  input: AchievementProgressInput,
  unlockedAt: number,
): UnlockedAchievement[] {
  const keys = new Set(unlocked.map((achievement) => achievement.key));
  const arena = input.arena;
  const completed = Math.max(input.sessions.length, arena?.roundsPlayed ?? 0);
  const streak = Math.max(input.progression.currentStreak, input.progression.bestStreak);
  const level = getLevelForXp(input.progression.totalXp);
  const mastery = arena?.masteryPct ?? {};
  const rules: Record<string, boolean> = {
    first_session: completed >= 1,
    five_sessions: completed >= 5,
    twentyfive_sessions: completed >= 25,
    perfect_session: input.sessions.some((session) => session.accuracy === 100) || (arena?.perfectRounds ?? 0) >= 1,
    perfect_five: (arena?.perfectRounds ?? 0) >= 5,
    combo_three: (arena?.bestCombo ?? 0) >= 3,
    combo_six: (arena?.bestCombo ?? 0) >= 6,
    combo_ten: (arena?.bestCombo ?? 0) >= 10,
    streak_three: streak >= 3,
    streak_seven: streak >= 7,
    streak_thirty: streak >= 30,
    daily_first: (arena?.dailyHistory.length ?? 0) >= 1,
    daily_seven: (arena?.dailyHistory.length ?? 0) >= 7,
    survivor_ten: (arena?.survivalBest ?? 0) >= 10,
    survivor_twentyfive: (arena?.survivalBest ?? 0) >= 25,
    orderly: (arena?.orderSolved ?? 0) >= 5,
    cat_people: (mastery.people ?? 0) >= 50,
    cat_places: (mastery.places ?? 0) >= 50,
    cat_events: (mastery.events ?? 0) >= 50,
    cat_teachings: (mastery.teachings ?? 0) >= 50,
    cat_books: (mastery.books ?? 0) >= 50,
    level_five: level >= 6,
    level_ten: level >= 11,
    bible_or_myth: input.sessions.some((session) => session.mode === "bible_or_myth"),
  };

  return [
    ...unlocked,
    ...ACHIEVEMENT_CATALOG.filter((achievement) => rules[achievement.key] && !keys.has(achievement.key)).map((achievement) => ({
      ...achievement,
      unlockedAt,
    })),
  ];
}

export function getLevelForXp(xp: number): number {
  let level = 1;
  LEVEL_THRESHOLDS.forEach((threshold, index) => {
    if (xp >= threshold) level = index + 1;
  });
  return level;
}

export const calculateLevel = getLevelForXp;

export function getLevelName(level: number): string {
  return LEVEL_NAMES[Math.min(Math.max(level - 1, 0), LEVEL_NAMES.length - 1)];
}

export function getLevelProgress(xp: number): { level: number; name: string; floor: number; next: number | null; pct: number; toNext: number } {
  const level = getLevelForXp(xp);
  const floor = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next = LEVEL_THRESHOLDS[level] ?? null;
  const pct = next === null ? 100 : Math.min(100, Math.max(0, Math.round(((xp - floor) / (next - floor)) * 100)));
  return { level, name: getLevelName(level), floor, next, pct, toNext: next === null ? 0 : next - xp };
}

export function getXpToNextLevel(xp: number): number {
  const nextThreshold = LEVEL_THRESHOLDS.find((threshold) => threshold > xp);
  return nextThreshold === undefined ? 0 : nextThreshold - xp;
}

export function toLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isPreviousCalendarDate(previousDate: string | null, currentDate: string): boolean {
  if (!previousDate) return false;
  const previous = new Date(`${previousDate}T12:00:00`);
  const current = new Date(`${currentDate}T12:00:00`);
  return Math.round((current.getTime() - previous.getTime()) / 86_400_000) === 1;
}

export function applyCompletedSession(
  snapshot: ProgressionSnapshot,
  input: { sessionId: string; mode?: string; correctAnswers: number; xpEarned: number; completedAt: number; bonusXp?: number },
): ProgressionSnapshot {
  const completionKey = `session:${input.sessionId}:complete`;
  if (snapshot.rewardEvents.some((event) => event.idempotencyKey === completionKey)) return snapshot;

  const createdAt = input.completedAt;
  const currentDate = toLocalDateKey(createdAt);
  const sameDay = snapshot.lastEligibleDate === currentDate;
  const dailyAlreadyRewarded = snapshot.rewardEvents.some((event) => event.idempotencyKey === `daily:${currentDate}`);
  const dailyReward: RewardEvent[] = input.mode === "daily_challenge" && !dailyAlreadyRewarded ? [{
    id: `session:${input.sessionId}:daily:event`,
    type: "daily_challenge",
    amount: 100,
    idempotencyKey: `daily:${currentDate}`,
    createdAt,
  }] : [];
  const sessionRewards: RewardEvent[] = [
    { id: `${completionKey}:event`, type: "session_complete", amount: 50, idempotencyKey: completionKey, createdAt },
    ...Array.from({ length: input.correctAnswers }, (_, index) => ({
      id: `session:${input.sessionId}:correct:${index}:event`,
      type: "correct_answer" as const,
      amount: 100,
      idempotencyKey: `session:${input.sessionId}:correct:${index}`,
      createdAt,
    })),
    ...dailyReward,
    ...(input.bonusXp && input.bonusXp > 0 ? [{ id: `session:${input.sessionId}:bonus:event`, type: "bonus" as const, amount: Math.round(input.bonusXp), idempotencyKey: `session:${input.sessionId}:bonus`, createdAt }] : []),
  ];
  const eventXp = sessionRewards.reduce((total, event) => total + event.amount, 0);
  const nextStreak = sameDay ? snapshot.currentStreak : isPreviousCalendarDate(snapshot.lastEligibleDate, currentDate) ? snapshot.currentStreak + 1 : 1;

  return {
    totalXp: snapshot.totalXp + eventXp,
    currentStreak: nextStreak,
    bestStreak: Math.max(snapshot.bestStreak, nextStreak),
    lastEligibleDate: currentDate,
    // Keep the reward ledger bounded on-device; recent keys are enough for idempotency.
    rewardEvents: [...snapshot.rewardEvents, ...sessionRewards].slice(-400),
  };
}
