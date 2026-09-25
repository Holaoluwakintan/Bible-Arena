import type { GameMode } from "./questions";
import type { LocalProgressState, SessionHistoryEntry } from "./local-storage";

export interface CloudSession {
  id: string;
  mode: string;
  score: number;
  accuracy: number;
  correctAnswers: number;
  totalQuestions: number;
  xpEarned: number;
  completedAt: Date;
  answers?: Array<{ questionId: string; answerId: string | null }>;
}

export interface CloudSyncResult {
  progress: {
    totalXp: number;
    currentStreak: number;
    bestStreak: number;
    lastEligibleDate: string | null;
    achievements: unknown[];
  } | null;
  sessions: CloudSession[];
}

export function toRemoteProgress(state: LocalProgressState) {
  return {
    totalXp: state.progression.totalXp,
    currentStreak: state.progression.currentStreak,
    bestStreak: state.progression.bestStreak,
    lastEligibleDate: state.progression.lastEligibleDate,
    achievementsJson: JSON.stringify(state.achievements),
  };
}

export function toRemoteSession(session: SessionHistoryEntry) {
  return { ...session, completedAt: new Date(session.completedAt) };
}

export function mergeCloudState(local: LocalProgressState, cloud: CloudSyncResult): LocalProgressState {
  const validModes: GameMode[] = ["bible_quiz", "bible_or_myth", "word_puzzle", "daily_challenge"];
  const remoteSessions = cloud.sessions
    .filter((session) => validModes.includes(session.mode as GameMode))
    .map((session) => ({ ...session, mode: session.mode as GameMode, completedAt: new Date(session.completedAt).getTime() }));
  const sessions = [...local.sessions, ...remoteSessions]
    .filter((session, index, all) => all.findIndex((item) => item.id === session.id) === index)
    .sort((a, b) => b.completedAt - a.completedAt).slice(0, 20);
  const cloudProgress = cloud.progress;
  const cloudAchievements = (cloudProgress?.achievements ?? []) as LocalProgressState["achievements"];
  const achievements = [...local.achievements, ...cloudAchievements]
    .filter((achievement, index, all) => all.findIndex((item) => item.key === achievement.key) === index);
  return {
    ...local,
    sessions,
    achievements,
    progression: cloudProgress ? {
      ...local.progression,
      totalXp: Math.max(local.progression.totalXp, cloudProgress.totalXp),
      currentStreak: Math.max(local.progression.currentStreak, cloudProgress.currentStreak),
      bestStreak: Math.max(local.progression.bestStreak, cloudProgress.bestStreak),
      lastEligibleDate: local.progression.lastEligibleDate ?? cloudProgress.lastEligibleDate,
    } : local.progression,
  };
}
