import type { MultiplayerRankingRow } from "./multiplayer-rankings";

export const MATCHMAKING_QUEUE_TTL_MS = 120_000;

export interface QueueCandidate {
  userId: number;
  seasonId: string;
  division: string;
  rating: number;
  createdAt: Date;
  expiresAt: Date;
}

export function findQueueMatch(request: QueueCandidate, candidates: QueueCandidate[], now = new Date()): QueueCandidate | null {
  return candidates.filter((candidate) => candidate.userId !== request.userId && candidate.seasonId === request.seasonId && candidate.division === request.division && candidate.expiresAt.getTime() > now.getTime()).sort((a, b) => Math.abs(a.rating - request.rating) - Math.abs(b.rating - request.rating) || a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null;
}

export interface MatchRiskInput {
  durationMs: number;
  answerCount: number;
  questionCount: number;
  sameIp?: boolean;
  repeatedPairCount?: number;
}

export function evaluateMatchRisk(input: MatchRiskInput): { isSuspicious: boolean; reason: string | null } {
  const reasons: string[] = [];
  if (input.durationMs < Math.max(3_000, input.questionCount * 700)) reasons.push("completed unusually quickly");
  if (input.answerCount < input.questionCount * 2) reasons.push("incomplete answer telemetry");
  if (input.sameIp) reasons.push("same network identity");
  if ((input.repeatedPairCount ?? 0) >= 10) reasons.push("repeated player pairing");
  return { isSuspicious: reasons.length > 0, reason: reasons.length ? reasons.join("; ") : null };
}

export function ratingFromRanking(row: Pick<MultiplayerRankingRow, "wins" | "losses" | "draws">): number {
  return Math.max(0, row.wins * 30 + row.draws * 10 - row.losses * 15);
}
