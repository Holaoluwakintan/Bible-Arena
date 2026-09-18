export interface MultiplayerMatchLike {
  hostUserId: number;
  guestUserId: number;
  hostXp: number;
  guestXp: number;
  winnerUserId: number | null;
}

export interface MultiplayerRankingRow {
  playerId: string;
  displayName: string;
  wins: number;
  losses: number;
  draws: number;
  xp: number;
  matches: number;
  rank: number;
  division: "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond";
}

export type MultiplayerRankingScope = "weekly" | "season" | "all_time";

export function getRankedDivision(wins: number, draws: number): MultiplayerRankingRow["division"] {
  const points = wins * 3 + draws;
  if (points >= 25) return "Diamond";
  if (points >= 15) return "Platinum";
  if (points >= 8) return "Gold";
  if (points >= 3) return "Silver";
  return "Bronze";
}

export function aggregateMultiplayerRankings(matches: MultiplayerMatchLike[], names: Map<number, string>): MultiplayerRankingRow[] {
  const aggregate = new Map<number, Omit<MultiplayerRankingRow, "playerId" | "displayName" | "rank" | "division">>();
  for (const match of matches) {
    const host = aggregate.get(match.hostUserId) ?? { wins: 0, losses: 0, draws: 0, xp: 0, matches: 0 };
    const guest = aggregate.get(match.guestUserId) ?? { wins: 0, losses: 0, draws: 0, xp: 0, matches: 0 };
    host.matches++; guest.matches++; host.xp += match.hostXp; guest.xp += match.guestXp;
    if (match.winnerUserId === null) { host.draws++; guest.draws++; } else if (match.winnerUserId === match.hostUserId) { host.wins++; guest.losses++; } else { guest.wins++; host.losses++; }
    aggregate.set(match.hostUserId, host); aggregate.set(match.guestUserId, guest);
  }
  return Array.from(aggregate.entries()).map(([userId, stats]) => ({ playerId: String(userId), displayName: names.get(userId) ?? "Bible Arena Player", ...stats, rank: 0, division: getRankedDivision(stats.wins, stats.draws) })).sort((a, b) => b.wins - a.wins || b.xp - a.xp || b.matches - a.matches).map((row, index) => ({ ...row, rank: index + 1 }));
}
