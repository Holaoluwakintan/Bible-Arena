import type { SessionHistoryEntry } from "./local-storage";

export type LeaderboardScope = "weekly" | "all_time";

export interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  score: number;
  sessions: number;
  averageAccuracy: number;
  rank: number;
}

function startOfWeek(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getDay();
  const distanceFromMonday = (day + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - distanceFromMonday);
  return date.getTime();
}

export function buildLocalLeaderboard(
  sessions: SessionHistoryEntry[],
  options: { scope: LeaderboardScope; now?: number; playerId?: string; displayName?: string } = { scope: "all_time" },
): LeaderboardEntry[] {
  const now = options.now ?? Date.now();
  const eligible = options.scope === "weekly" ? sessions.filter((session) => session.completedAt >= startOfWeek(now)) : sessions;
  if (eligible.length === 0) return [];
  const score = eligible.reduce((total, session) => total + session.score, 0);
  const averageAccuracy = Math.round(eligible.reduce((total, session) => total + session.accuracy, 0) / eligible.length);
  return [{ playerId: options.playerId ?? "guest-local", displayName: options.displayName ?? "Guest Player", score, sessions: eligible.length, averageAccuracy, rank: 1 }];
}
