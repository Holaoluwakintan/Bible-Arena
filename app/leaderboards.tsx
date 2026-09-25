import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { buildLocalLeaderboard, type LeaderboardScope } from "@/domain/leaderboards";
import type { MultiplayerRankingScope } from "@/domain/multiplayer-rankings";
import { useProgression } from "@/lib/progression-provider";
import { trpc } from "@/lib/trpc";

type Board = "sessions" | "multiplayer" | "friends";

export default function LeaderboardsScreen() {
  const colors = useColors();
  const { state, isAuthenticated, syncStatus, createChallenge } = useProgression();
  const [scope, setScope] = useState<LeaderboardScope>("weekly");
  const [multiplayerScope, setMultiplayerScope] = useState<MultiplayerRankingScope>("season");
  const [board, setBoard] = useState<Board>("sessions");
  const entries = useMemo(() => buildLocalLeaderboard(state.sessions, { scope, displayName: "Guest Player" }), [state.sessions, scope]);
  const remoteEntries = trpc.leaderboards.list.useQuery({ scope }, { enabled: isAuthenticated && board === "sessions", staleTime: 30_000 });
  const multiplayerEntries = trpc.multiplayerRankings.list.useQuery({ scope: multiplayerScope }, { enabled: isAuthenticated && board === "multiplayer", staleTime: 30_000 });
  const friendsEntries = trpc.friends.leaderboard.useQuery(undefined, { enabled: isAuthenticated && board === "friends", staleTime: 15_000 });
  const visibleEntries = isAuthenticated && remoteEntries.data ? remoteEntries.data : entries;
  const scopeOptions = board === "multiplayer" ? (["season", "weekly", "all_time"] as MultiplayerRankingScope[]) : (["weekly", "all_time"] as LeaderboardScope[]);

  const handleChallenge = async () => {
    try {
      const challenge = await createChallenge("bible_quiz");
      router.push({ pathname: "/challenges", params: { code: challenge.shareCode } });
    } catch {
      router.push("/challenges");
    }
  };

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.headerRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}><Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Open Friends Hub" onPress={() => router.push("/friends")} style={[styles.friendsShortcut, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.friendsShortcutText, { color: colors.primary }]}>Friends Hub</Text>
      </Pressable>
    </View>

    <Text style={[styles.eyebrow, { color: colors.primary }]}>COMPETE</Text>
    <Text style={[styles.title, { color: colors.foreground }]}>{board === "multiplayer" ? "Arena rankings." : board === "friends" ? "Friends circle." : "Leaderboards."}</Text>
    <Text style={[styles.subtitle, { color: colors.muted }]}>{board === "friends" ? "Friends leaderboard · compare with your circle." : board === "multiplayer" ? `${multiplayerScope === "season" ? "Season" : multiplayerScope === "weekly" ? "Weekly" : "Global"} rankings · ${isAuthenticated ? syncStatus : "sign in to sync"}` : `${isAuthenticated ? "Global leaderboard" : "Local leaderboard"} · ${isAuthenticated ? syncStatus : "this device only"}.`}</Text>

    <View style={[styles.boardTabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {(["sessions", "multiplayer", "friends"] as Board[]).map((item) => (
        <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: board === item }} accessibilityLabel={`Show ${item === "sessions" ? "all games" : item} leaderboard`} onPress={() => setBoard(item)} style={[styles.boardTab, board === item && { backgroundColor: colors.primary }]}>
          <Text style={[styles.scopeText, { color: board === item ? colors.background : colors.muted }]}>
            {item === "sessions" ? "All games" : item === "multiplayer" ? "Multiplayer" : "Friends"}
          </Text>
        </Pressable>
      ))}
    </View>

    {board !== "friends" && (
      <View style={[styles.scopeTabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {scopeOptions.map((item) => {
          const selected = board === "multiplayer" ? multiplayerScope === item : scope === item;
          const label = item === "all_time" ? "All time" : item === "season" ? "Season" : "This week";
          return (
            <Pressable key={item} onPress={() => board === "multiplayer" ? setMultiplayerScope(item as MultiplayerRankingScope) : setScope(item as LeaderboardScope)} style={[styles.scopeTab, selected && { backgroundColor: colors.primary }]}>
              <Text style={[styles.scopeText, { color: selected ? colors.background : colors.muted }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    )}

    {board === "friends" ? (
      <>
        {friendsEntries.data?.length ? (
          friendsEntries.data.map((row) => (
            <View key={row.playerId} style={[styles.entry, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.rank, { color: colors.primary }]}>{row.rank}</Text>
              <View style={styles.entryCopy}>
                <Text style={[styles.name, { color: colors.foreground }]}>{row.displayName}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>{row.currentStreak} day streak</Text>
              </View>
              <View style={styles.pointsCopy}>
                <Text style={[styles.points, { color: colors.foreground }]}>{row.totalXp}</Text>
                <Text style={[styles.meta, { color: colors.primary }]}>XP</Text>
              </View>
              <Pressable onPress={handleChallenge} style={[styles.challengeButton, { backgroundColor: colors.primary }]}>
                <Text style={[styles.challengeButtonText, { color: colors.background }]}>Duel</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{isAuthenticated ? "No friends on leaderboard" : "Sign in to rank"}</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>Add fellow disciples to compare weekly Scripture XP and challenge them to duels.</Text>
            <Pressable onPress={() => router.push("/friends")} style={[styles.actionButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.actionButtonText, { color: colors.background }]}>Find Friends</Text>
            </Pressable>
          </View>
        )}
      </>
    ) : board === "multiplayer" ? (
      <>
        {multiplayerEntries.data?.length ? (
          multiplayerEntries.data.slice(0, 10).map((row) => (
            <View key={row.playerId} style={[styles.entry, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.rank, { color: colors.primary }]}>{row.rank}</Text>
              <View style={styles.entryCopy}>
                <Text style={[styles.name, { color: colors.foreground }]}>{row.displayName}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>{row.division} · {row.wins}W · {row.losses}L · {row.draws}D · {row.matches} matches</Text>
              </View>
              <View style={styles.pointsCopy}>
                <Text style={[styles.points, { color: colors.foreground }]}>{row.xp}</Text>
                <Text style={[styles.meta, { color: colors.primary }]}>XP</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{isAuthenticated ? "No multiplayer ranking yet" : "Sign in to rank"}</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>Complete a private room match to appear in Arena rankings.</Text>
          </View>
        )}
      </>
    ) : (
      <>
        {visibleEntries.length ? (
          visibleEntries.slice(0, 10).map((row) => (
            <View key={row.playerId} style={[styles.entry, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.rank, { color: colors.primary }]}>{row.rank}</Text>
              <View style={styles.entryCopy}>
                <Text style={[styles.name, { color: colors.foreground }]}>{row.displayName}</Text>
                <Text style={[styles.meta, { color: colors.muted }]}>{row.sessions} sessions · {row.averageAccuracy}% average accuracy</Text>
              </View>
              <Text style={[styles.points, { color: colors.foreground }]}>{row.score}</Text>
            </View>
          ))
        ) : (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No ranking yet</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>Complete a game session to appear on your leaderboard.</Text>
          </View>
        )}
      </>
    )}
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 38, gap: 17 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  back: { fontSize: 13, fontWeight: "800" },
  friendsShortcut: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, justifyContent: "center" },
  friendsShortcutText: { fontSize: 12, fontWeight: "800" },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.7 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.7 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  boardTabs: { borderRadius: 15, borderWidth: 1, padding: 4, flexDirection: "row" },
  boardTab: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  scopeTabs: { borderRadius: 15, borderWidth: 1, padding: 4, flexDirection: "row" },
  scopeTab: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  scopeText: { fontSize: 12, fontWeight: "800" },
  entry: { minHeight: 76, borderRadius: 19, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  rank: { fontSize: 20, fontWeight: "900", width: 22 },
  entryCopy: { flex: 1 },
  name: { fontSize: 15, fontWeight: "800" },
  meta: { fontSize: 11, marginTop: 4 },
  pointsCopy: { alignItems: "flex-end" },
  points: { fontSize: 17, fontWeight: "900" },
  challengeButton: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9, marginLeft: 8, justifyContent: "center" },
  challengeButtonText: { fontSize: 11, fontWeight: "800" },
  empty: { borderRadius: 22, borderWidth: 1, padding: 22, alignItems: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 6 },
  actionButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, marginTop: 12 },
  actionButtonText: { fontSize: 13, fontWeight: "800" },
});
