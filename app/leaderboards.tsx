import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Button, Card, FadeIn, IconBadge, Txt } from "@/components/ui/kit";
import { C, R, S } from "@/constants/design";
import { startOAuthLogin } from "@/constants/oauth";
import { buildLocalLeaderboard, type LeaderboardScope } from "@/domain/leaderboards";
import type { MultiplayerRankingScope } from "@/domain/multiplayer-rankings";
import { useAuth } from "@/hooks/use-auth";
import { feedback } from "@/lib/feedback";
import { useProgression } from "@/lib/progression-provider";
import { trpc } from "@/lib/trpc";

type Board = "sessions" | "multiplayer" | "friends";
interface Row { playerId: string; displayName: string; rank: number; value: number; unit: string; meta: string }

const MEDAL = ["#F5B942", "#C8D1DC", "#D19A66"];

export default function RanksScreen() {
  const { state, isAuthenticated, createChallenge } = useProgression();
  const { user } = useAuth();
  const [board, setBoard] = useState<Board>("sessions");
  const [scope, setScope] = useState<LeaderboardScope>("weekly");
  const [mpScope, setMpScope] = useState<MultiplayerRankingScope>("season");
  const local = useMemo(() => buildLocalLeaderboard(state.sessions, { scope, displayName: state.displayName || "You" }), [state.sessions, scope, state.displayName]);
  const remote = trpc.leaderboards.list.useQuery({ scope }, { enabled: isAuthenticated && board === "sessions", staleTime: 30_000 });
  const mp = trpc.multiplayerRankings.list.useQuery({ scope: mpScope }, { enabled: isAuthenticated && board === "multiplayer", staleTime: 30_000 });
  const friends = trpc.friends.leaderboard.useQuery(undefined, { enabled: isAuthenticated && board === "friends", staleTime: 15_000 });

  const rows: Row[] = useMemo(() => {
    if (board === "multiplayer") return (mp.data ?? []).slice(0, 25).map((r) => ({ playerId: String(r.playerId), displayName: r.displayName, rank: r.rank, value: r.xp, unit: "XP", meta: `${r.division} · ${r.wins}W ${r.losses}L ${r.draws}D` }));
    if (board === "friends") return (friends.data ?? []).map((r) => ({ playerId: String(r.playerId), displayName: r.displayName, rank: r.rank, value: r.totalXp, unit: "XP", meta: `${r.currentStreak}-day streak` }));
    const src = isAuthenticated && remote.data ? remote.data : local;
    return src.slice(0, 50).map((r) => ({ playerId: String(r.playerId), displayName: r.displayName, rank: r.rank, value: r.score, unit: "pts", meta: `${r.sessions} rounds · ${r.averageAccuracy}% accuracy` }));
  }, [board, mp.data, friends.data, remote.data, local, isAuthenticated]);

  const loading = isAuthenticated && ((board === "sessions" && remote.isLoading) || (board === "multiplayer" && mp.isLoading) || (board === "friends" && friends.isLoading));
  const myId = user?.id != null ? String(user.id) : null;
  const podium = rows.length >= 3 ? rows.slice(0, 3) : [];
  const rest = rows.length >= 3 ? rows.slice(3) : rows;

  const duel = async () => {
    try { const challenge = await createChallenge("bible_quiz"); router.push({ pathname: "/challenges", params: { code: challenge.shareCode } }); }
    catch { router.push("/challenges"); }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FadeIn>
          <Txt variant="overline" color={C.gold}>Compete</Txt>
          <Txt variant="h1" style={{ marginTop: 4 }}>Rankings</Txt>
          <Txt variant="body" color={C.muted} style={{ marginTop: 4 }}>{isAuthenticated ? "Climb the board one round at a time." : "Your rounds on this device. Sign in to rank against everyone."}</Txt>
        </FadeIn>

        <View style={styles.segment}>
          {(["sessions", "multiplayer", "friends"] as Board[]).map((b) => (
            <Pressable key={b} accessibilityRole="tab" accessibilityState={{ selected: board === b }} onPress={() => { feedback.tap(); setBoard(b); }} style={[styles.segBtn, board === b && styles.segActive]}>
              <Txt variant="smallStrong" color={board === b ? C.ink : C.muted}>{b === "sessions" ? "Global" : b === "multiplayer" ? "Live" : "Friends"}</Txt>
            </Pressable>
          ))}
        </View>

        {board !== "friends" ? (
          <View style={styles.scopeRow}>
            {(board === "multiplayer" ? (["season", "weekly", "all_time"] as const) : (["weekly", "all_time"] as const)).map((s0) => {
              const selected = board === "multiplayer" ? mpScope === s0 : scope === s0;
              return (
                <Pressable key={s0} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { feedback.tap(); if (board === "multiplayer") setMpScope(s0 as MultiplayerRankingScope); else setScope(s0 as LeaderboardScope); }} style={[styles.scopeChip, selected && styles.scopeActive]}>
                  <Txt variant="caption" color={selected ? C.gold : C.muted}>{s0 === "all_time" ? "All time" : s0 === "season" ? "Season" : "This week"}</Txt>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!isAuthenticated && board !== "sessions" ? (
          <Card style={{ alignItems: "center", gap: S.md }}>
            <IconBadge icon="lock.fill" size={52} />
            <Txt variant="h3">Sign in to see {board === "friends" ? "your friends" : "live rankings"}</Txt>
            <Txt variant="small" color={C.muted} style={{ textAlign: "center" }}>Your streak and XP follow you to any device.</Txt>
            <Button label="Continue with Google" icon="globe" variant="light" onPress={() => void startOAuthLogin()} style={{ alignSelf: "stretch" }} />
          </Card>
        ) : loading ? (
          <Card><Txt variant="small" color={C.muted}>Loading rankings…</Txt></Card>
        ) : rows.length === 0 ? (
          <Card style={{ alignItems: "center", gap: S.md }}>
            <IconBadge icon="trophy.fill" size={52} />
            <Txt variant="h3">{board === "friends" ? "No friends yet" : "The board is empty"}</Txt>
            <Txt variant="small" color={C.muted} style={{ textAlign: "center" }}>{board === "friends" ? "Add friends to compare XP and send duels." : board === "multiplayer" ? "Finish a live room match to appear here." : "Play a round to put your name on it."}</Txt>
            <Button label={board === "friends" ? "Find friends" : "Play a round"} onPress={() => board === "friends" ? router.push("/friends") : router.push({ pathname: "/quiz", params: { kind: "quick", r: String(Date.now()) } })} style={{ alignSelf: "stretch" }} />
          </Card>
        ) : (
          <>
            {podium.length ? <FadeIn delay={60}>
              <View style={styles.podium}>
                {[1, 0, 2].map((pos) => {
                  const row = podium[pos];
                  if (!row) return <View key={pos} style={{ flex: 1 }} />;
                  const tall = pos === 0 ? 132 : pos === 1 ? 108 : 92;
                  return (
                    <View key={row.playerId} style={styles.podiumCol}>
                      <View style={[styles.podiumAvatar, { borderColor: MEDAL[pos] }]}><Txt variant="h3">{row.displayName.charAt(0).toUpperCase()}</Txt></View>
                      <Txt variant="smallStrong" numberOfLines={1} style={{ marginTop: 6, maxWidth: 100, textAlign: "center" }}>{row.playerId === myId ? "You" : row.displayName}</Txt>
                      <Txt variant="caption" color={C.muted}>{row.value.toLocaleString()} {row.unit}</Txt>
                      <View style={[styles.podiumBlock, { height: tall, borderColor: `${MEDAL[pos]}55` }]}>
                        <Txt variant="h1" color={MEDAL[pos]}>{pos + 1}</Txt>
                      </View>
                    </View>
                  );
                })}
              </View>
            </FadeIn> : null}
            <View style={{ gap: S.sm }}>
              {rest.map((row) => {
                const me = row.playerId === myId;
                return (
                  <View key={row.playerId} style={[styles.row, me && styles.rowMe]}>
                    <Txt variant="bodyStrong" color={C.muted} style={{ width: 28 }}>{row.rank}</Txt>
                    <View style={styles.rowAvatar}><Txt variant="smallStrong">{row.displayName.charAt(0).toUpperCase()}</Txt></View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="smallStrong" numberOfLines={1}>{me ? "You" : row.displayName}</Txt>
                      <Txt variant="caption" color={C.muted} numberOfLines={1} style={{ fontWeight: "500" }}>{row.meta}</Txt>
                    </View>
                    <Txt variant="smallStrong" color={C.gold}>{row.value.toLocaleString()}</Txt>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <Card style={styles.duel} onPress={duel} accessibilityLabel="Challenge a friend">
          <IconBadge icon="person.2.fill" color={C.violet} tint="rgba(167,139,250,0.14)" />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">Challenge a friend</Txt>
            <Txt variant="caption" color={C.muted} style={{ fontWeight: "500" }}>Send a code, play the same questions, compare.</Txt>
          </View>
          <IconSymbol name="chevron.right" size={22} color={C.faint} />
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: S.lg, paddingBottom: 48, gap: S.xl },
  segment: { flexDirection: "row", backgroundColor: C.surface, borderRadius: R.lg, padding: 4, borderWidth: 1, borderColor: C.hairline },
  segBtn: { flex: 1, height: 40, borderRadius: R.md, alignItems: "center", justifyContent: "center" },
  segActive: { backgroundColor: C.gold },
  scopeRow: { flexDirection: "row", gap: S.sm, marginTop: -S.sm },
  scopeChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: R.pill, borderWidth: 1, borderColor: C.border },
  scopeActive: { borderColor: C.gold, backgroundColor: C.goldSoft },
  podium: { flexDirection: "row", alignItems: "flex-end", gap: S.sm },
  podiumCol: { flex: 1, alignItems: "center" },
  podiumAvatar: { width: 54, height: 54, borderRadius: 27, borderWidth: 2.5, alignItems: "center", justifyContent: "center", backgroundColor: C.surface2 },
  podiumBlock: { alignSelf: "stretch", marginTop: S.sm, borderTopLeftRadius: R.lg, borderTopRightRadius: R.lg, backgroundColor: C.surface, borderWidth: 1, borderBottomWidth: 0, alignItems: "center", paddingTop: S.md },
  row: { flexDirection: "row", alignItems: "center", gap: S.md, padding: S.md, borderRadius: R.lg, backgroundColor: C.surface, borderWidth: 1, borderColor: C.hairline },
  rowMe: { borderColor: C.goldLine, backgroundColor: "rgba(245,185,66,0.07)" },
  rowAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center" },
  duel: { flexDirection: "row", alignItems: "center", gap: S.md },
});
