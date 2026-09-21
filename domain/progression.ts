export const LEVEL_THRESHOLDS = [0, 500, 1_200, 2_200, 3_500, 5_200, 7_400, 10_000] as const;
export const LEVEL_NAMES = [
  "Scripture Seeker",
  "Word Walker",
  "Faithful Reader",
  "Wisdom Builder",
  "Kingdom Scholar",
  "Truth Keeper",
  "Scripture Guide",
  "Arena Elder",
] as const;

export interface RewardEvent {
  id: string;
  type: "correct_answer" | "session_complete" | "daily_challenge";
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
  icon: "sparkles" | "flame.fill" | "trophy.fill" | "book.fill";
}

export interface UnlockedAchievement extends AchievementDefinition {
  unlockedAt: number;
}

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  { key: "first_session", name: "First Step", description: "Complete your first game session.", icon: "book.fill" },
  { key: "perfect_session", name: "Perfect Form", description: "Complete a session with 100% accuracy.", icon: "trophy.fill" },
  { key: "five_sessions", name: "Keep Showing Up", description: "Complete five game sessions.", icon: "sparkles" },
  { key: "streak_three", name: "In Rhythm", description: "Reach a three-day streak.", icon: "flame.fill" },
  { key: "bible_or_myth", name: "Myth Buster", description: "Complete a Bible or Myth session.", icon: "sparkles" },
];

export interface AchievementProgressInput {
  progression: ProgressionSnapshot;
  sessions: Array<{ mode: string; accuracy: number }>;
}

export function unlockAchievements(
  unlocked: UnlockedAchievement[],
  input: AchievementProgressInput,
  unlockedAt: number,
): UnlockedAchievement[] {
  const keys = new Set(unlocked.map((achievement) => achievement.key));
  const completed = input.sessions.length;
  const rules: Record<string, boolean> = {
    first_session: completed >= 1,
    perfect_session: input.sessions.some((session) => session.accuracy === 100),
    five_sessions: completed >= 5,
    streak_three: input.progression.currentStreak >= 3,
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
  input: { sessionId: string; mode?: string; correctAnswers: number; xpEarned: number; completedAt: number },
): ProgressionSnapshot {
  const completionKey = `session:${input.sessionId}:complete`;
  if (snapshot.rewardEvents.some((event) => event.idempotencyKey === completionKey)) return snapshot;

  const createdAt = input.completedAt;
  const currentDate = toLocalDateKey(createdAt);
  const sameDay = snapshot.lastEligibleDate === currentDate;
  const dailyReward: RewardEvent[] = input.mode === "daily_challenge" && !sameDay ? [{
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
  ];
  const eventXp = sessionRewards.reduce((total, event) => total + event.amount, 0);
  const nextStreak = sameDay ? snapshot.currentStreak : isPreviousCalendarDate(snapshot.lastEligibleDate, currentDate) ? snapshot.currentStreak + 1 : 1;

  return {
    totalXp: snapshot.totalXp + eventXp,
    currentStreak: nextStreak,
    bestStreak: Math.max(snapshot.bestStreak, nextStreak),
    lastEligibleDate: currentDate,
    rewardEvents: [...snapshot.rewardEvents, ...sessionRewards],
  };
}
