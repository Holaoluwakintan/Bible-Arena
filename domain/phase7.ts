import { getInspirationalVerse } from "./share";

export type StreakIdentity = {
  milestone: 0 | 3 | 7 | 30 | 100;
  title: string;
  message: string;
  nextMilestone: number | null;
  graceMessage: string;
};

export function getStreakIdentity(streak: number, completedToday = true): StreakIdentity {
  const safeStreak = Math.max(0, Math.floor(streak));
  const milestone = safeStreak >= 100 ? 100 : safeStreak >= 30 ? 30 : safeStreak >= 7 ? 7 : safeStreak >= 3 ? 3 : 0;
  const identity = milestone === 100 ? ["Faithful Guide", "One hundred days of returning to the Word."] : milestone === 30 ? ["Steady Scribe", "A month of making space for Scripture."] : milestone === 7 ? ["Weekly Walker", "A full week of steady practice."] : milestone === 3 ? ["Bright Beginning", "Three days of showing up with intention."] : ["New Beginning", "Every session is a fresh invitation to learn."];
  const nextMilestone = safeStreak < 3 ? 3 : safeStreak < 7 ? 7 : safeStreak < 30 ? 30 : safeStreak < 100 ? 100 : null;
  return {
    milestone: milestone as 0 | 3 | 7 | 30 | 100,
    title: identity[0],
    message: identity[1],
    nextMilestone,
    graceMessage: completedToday ? "Your rhythm is active. Keep it gentle and consistent." : "A missed day is not a failure. Return when you are ready—your progress still matters.",
  };
}

export function getPerfectRoundCelebration(score: number, streak: number, reference?: string) {
  return {
    title: "Perfect round",
    subtitle: streak >= 3 ? `${streak}-day rhythm · every answer landed.` : "Every answer landed. Let the learning settle.",
    verse: getInspirationalVerse(score),
    reference: reference ?? "Psalm 119:105",
    shareText: `Bible Arena · Perfect round\nScore: ${score.toLocaleString()} pts\n${getInspirationalVerse(score)}\n${reference ?? "Psalm 119:105"}\nKeep building a gentle Scripture rhythm.`,
  };
}
