import AsyncStorage from "@react-native-async-storage/async-storage";

import type { GameResult } from "./game-engine";
import type { GameMode } from "./questions";
import type { ProgressionSnapshot, UnlockedAchievement } from "./progression";
import type { FriendChallenge } from "./competitive";

export interface SessionHistoryEntry {
  id: string;
  mode: GameMode;
  score: number;
  accuracy: number;
  correctAnswers: number;
  totalQuestions: number;
  xpEarned: number;
  completedAt: number;
}

export interface LocalProgressState {
  progression: ProgressionSnapshot;
  sessions: SessionHistoryEntry[];
  achievements: UnlockedAchievement[];
  challenges: FriendChallenge[];
  hasCompletedOnboarding?: boolean;
}

const STORAGE_KEY = "bible-arena:local-progress:v1";

export const EMPTY_PROGRESS_STATE: LocalProgressState = {
  progression: { totalXp: 0, currentStreak: 0, bestStreak: 0, lastEligibleDate: null, rewardEvents: [] },
  sessions: [],
  achievements: [],
  challenges: [],
  hasCompletedOnboarding: false,
};

export function toHistoryEntry(result: GameResult): SessionHistoryEntry {
  return {
    id: result.sessionId,
    mode: result.mode,
    score: result.score,
    accuracy: result.accuracy,
    correctAnswers: result.correctAnswers,
    totalQuestions: result.totalQuestions,
    xpEarned: result.xpEarned,
    completedAt: result.completedAt,
  };
}

export async function loadProgressState(): Promise<LocalProgressState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_PROGRESS_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalProgressState>;
    return {
      progression: { ...EMPTY_PROGRESS_STATE.progression, ...parsed.progression },
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      challenges: Array.isArray(parsed.challenges) ? parsed.challenges : [],
      hasCompletedOnboarding: Boolean(parsed.hasCompletedOnboarding),
    };
  } catch {
    return EMPTY_PROGRESS_STATE;
  }
}

export async function saveProgressState(state: LocalProgressState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export async function setOnboardingCompleted(completed = true): Promise<void> {
  const current = await loadProgressState();
  await saveProgressState({ ...current, hasCompletedOnboarding: completed });
}
