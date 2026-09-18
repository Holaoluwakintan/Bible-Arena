import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { buildLocalLeaderboard, type LeaderboardScope } from "@/domain/leaderboards";
import type { MultiplayerRankingScope } from "@/domain/multiplayer-rankings";
import { useProgression } from "@/lib/progression-provider";
import { trpc } from "@/lib/trpc";

type Board = "sessions" | "multiplayer";

export default function LeaderboardsScreen() {
  const colors = useColors();
  const { state, isAuthenticated, syncStatus } = useProgression();
  const [scope, setScope] = useState<LeaderboardScope>("weekly");
  const [multiplayerScope, setMultiplayerScope] = useState<MultiplayerRankingScope>("season");
  const [board, setBoard] = useState<Board>("sessions");
  const entries = useMemo(() => buildLocalLeaderboard(state.sessions, { scope, displayName: "Guest Player" }), [state.sessions, scope]);
  const remoteEntries = trpc.leaderboards.list.useQuery({ scope }, { enabled: isAuthenticated && board === "sessions", staleTime: 30_000 });
  const multiplayerEntries = trpc.multiplayerRankings.list.useQuery({ scope: multiplayerScope }, { enabled: isAuthenticated && board === "multiplayer", staleTime: 30_000 });
  const visibleEntries = isAuthenticated && remoteEntries.data ? remoteEntries.data : entries;
  const scopeOptions = board === "multiplayer" ? (["season", "weekly", "all_time"] as MultiplayerRankingScope[]) : (["weekly", "all_time"] as LeaderboardScope[]);

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text></Pressable>
    <Text style={[styles.eyebrow, { color: colors.primary }]}>COMPETE</Text><Text style={[styles.title, { color: colors.foreground }]}>{board === "multiplayer" ? "Arena rankings." : "Leaderboards."}</Text><Text style={[styles.subtitle, { color: colors.muted }]}>{isAuthenticated ? `Server-backed rankings · ${syncStatus}` : "Local preview · sign in to compete across devices."}</Text>
    <View style={[styles.boardTabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>{(["sessions", "multiplayer"] as Board[]).map((item) => <Pressable key={item} onPress={() => setBoard(item)} style={[styles.boardTab, board === item && { backgroundColor: colors.primary }]}><Text style={[styles.scopeText, { color: board === item ? colors.background : colors.muted }]}>{item === "sessions" ? "All games" : "Multiplayer"}</Text></Pressable>)}</View>
    <View style={[styles.scopeTabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>{scopeOptions.map((item) => { const selected = board === "multiplayer" ? multiplayerScope === item : scope === item; const label = item === "all_time" ? "All time" : item === "season" ? "Season" : "This week"; return <Pressable key={item} onPress={() => board === "multiplayer" ? setMultiplayerScope(item as MultiplayerRankingScope) : setScope(item as LeaderboardScope)} style={[styles.scopeTab, selected && { backgroundColor: colors.primary }]}><Text style={[styles.scopeText, { color: selected ? colors.background : colors.muted }]}>{label}</Text></Pressable>; })}</View>
    {board === "multiplayer" ? <>{multiplayerEntries.data?.length ? multiplayerEntries.data.slice(0, 10).map((row) => <View key={row.playerId} style={[styles.entry, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.rank, { color: colors.primary }]}>{row.rank}</Text><View style={styles.entryCopy}><Text style={[styles.name, { color: colors.foreground }]}>{row.displayName}</Text><Text style={[styles.meta, { color: colors.muted }]}>{row.division} · {row.wins}W · {row.losses}L · {row.draws}D · {row.matches} matches</Text></View><View style={styles.pointsCopy}><Text style={[styles.points, { color: colors.foreground }]}>{row.xp}</Text><Text style={[styles.meta, { color: colors.primary }]}>XP</Text></View></View>) : <View style={[styles.empty, { borderColor: colors.border }]}><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{isAuthenticated ? "No multiplayer ranking yet" : "Sign in to rank"}</Text><Text style={[styles.emptyBody, { color: colors.muted }]}>Complete a private room match to appear in Arena rankings.</Text></View>}</> : <>{visibleEntries.length ? visibleEntries.slice(0, 10).map((row) => <View key={row.playerId} style={[styles.entry, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.rank, { color: colors.primary }]}>{row.rank}</Text><View style={styles.entryCopy}><Text style={[styles.name, { color: colors.foreground }]}>{row.displayName}</Text><Text style={[styles.meta, { color: colors.muted }]}>{row.sessions} sessions · {row.averageAccuracy}% average accuracy</Text></View><Text style={[styles.points, { color: colors.foreground }]}>{row.score}</Text></View>) : <View style={[styles.empty, { borderColor: colors.border }]}><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No ranking yet</Text><Text style={[styles.emptyBody, { color: colors.muted }]}>Complete a game session to appear on your leaderboard.</Text></View>}</>}
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingTop: 18, paddingBottom: 38, gap: 17 }, back: { fontSize: 13, fontWeight: "800" }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.7 }, title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.7 }, subtitle: { fontSize: 15, lineHeight: 22 }, boardTabs: { borderRadius: 15, borderWidth: 1, padding: 4, flexDirection: "row" }, boardTab: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" }, scopeTabs: { borderRadius: 15, borderWidth: 1, padding: 4, flexDirection: "row" }, scopeTab: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" }, scopeText: { fontSize: 12, fontWeight: "800" }, entry: { minHeight: 76, borderRadius: 19, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }, rank: { fontSize: 20, fontWeight: "900", width: 22 }, entryCopy: { flex: 1 }, name: { fontSize: 15, fontWeight: "800" }, meta: { fontSize: 11, marginTop: 4 }, pointsCopy: { alignItems: "flex-end" }, points: { fontSize: 17, fontWeight: "900" }, empty: { borderRadius: 22, borderWidth: 1, padding: 22, alignItems: "center" }, emptyTitle: { fontSize: 17, fontWeight: "800" }, emptyBody: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6 },
});
