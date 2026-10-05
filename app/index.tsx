import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Button, Card, FadeIn, IconBadge, Pill, ProgressBar, Ring, SectionHeader, Stars, Txt } from "@/components/ui/kit";
import { C, R, S } from "@/constants/design";
import { ACHIEVEMENT_CATALOG, getLevelProgress } from "@/domain/progression";
import { dailyDoneToday, getAllMastery, msUntilTomorrow, normalizeArena, suggestNextCategory, verseOfTheDay, xpToday } from "@/domain/arena";
import { useAuth } from "@/hooks/use-auth";
import { useProgression } from "@/lib/progression-provider";
import { feedback } from "@/lib/feedback";

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function formatCountdown(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function HomeScreen() {
  const { state, isLoading } = useProgression();
  const { user } = useAuth();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!isLoading && !state.hasCompletedOnboarding) router.replace("/onboarding");
  }, [isLoading, state.hasCompletedOnboarding]);

  const arena = normalizeArena(state.arena);
  const level = getLevelProgress(state.progression.totalXp);
  const today = xpToday(arena, now);
  const goalPct = Math.min(100, Math.round((today / arena.dailyGoalXp) * 100));
  const dailyDone = dailyDoneToday(arena, now);
  const next = suggestNextCategory(arena);
  const mastery = useMemo(() => getAllMastery(arena), [arena]);
  const nextMastery = mastery.find((m) => m.category.id === next.id)!;
  const verse = verseOfTheDay(now);
  const streak = state.progression.currentStreak;
  const name = state.displayName || (user?.name && !/^guest/i.test(user.name) ? user.name.split(" ")[0] : "") || "friend";
  const unlocked = new Set(state.achievements.map((a) => a.key));
  const inReach = ACHIEVEMENT_CATALOG.filter((a) => !unlocked.has(a.key)).slice(0, 3);

  const play = (params: Record<string, string>) => { router.push({ pathname: "/quiz", params: { ...params, r: String(Date.now()) } }); };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FadeIn>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Txt variant="small" color={C.muted}>{greeting()},</Txt>
              <Txt variant="h1" numberOfLines={1} style={{ textTransform: "capitalize" }}>{name}</Txt>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`${streak} day streak`} onPress={() => { feedback.tap(); router.push("/profile"); }} style={styles.streakChip}>
              <IconSymbol name="flame.fill" size={20} color={streak > 0 ? C.flame : C.faint} />
              <Txt variant="bodyStrong" color={streak > 0 ? C.text : C.muted}>{streak}</Txt>
            </Pressable>
          </View>
        </FadeIn>

        <FadeIn delay={60}>
          <Card glow={{ from: "#17233D", to: "#101827", accent: C.gold }} style={styles.todayCard}>
            <View style={styles.todayRow}>
              <Ring value={goalPct} size={92} stroke={9} color={goalPct >= 100 ? C.success : C.gold}>
                <Txt variant="h3" style={{ lineHeight: 22 }}>{today}</Txt>
                <Txt variant="caption" color={C.muted} style={{ fontSize: 10 }}>/ {arena.dailyGoalXp} XP</Txt>
              </Ring>
              <View style={{ flex: 1, gap: 6 }}>
                <Txt variant="overline" color={C.gold}>Today’s goal</Txt>
                <Txt variant="h3">{goalPct >= 100 ? "Goal reached. Well done!" : streak > 0 ? `Keep your ${streak}-day streak alive` : "Start your streak today"}</Txt>
                <Txt variant="small" color={C.muted}>{goalPct >= 100 ? "Every extra round sharpens you." : `${Math.max(0, arena.dailyGoalXp - today)} XP to go · about one round`}</Txt>
              </View>
            </View>
            <View style={styles.levelRow}>
              <View style={styles.levelBadge}><Txt variant="smallStrong" color={C.ink}>{level.level}</Txt></View>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={styles.levelText}>
                  <Txt variant="smallStrong">{level.name}</Txt>
                  <Txt variant="caption" color={C.muted}>{level.next === null ? "Max level" : `${level.toNext.toLocaleString()} XP to level ${level.level + 1}`}</Txt>
                </View>
                <ProgressBar value={level.pct} height={7} />
              </View>
            </View>
          </Card>
        </FadeIn>

        <FadeIn delay={120}>
          <Card glow={{ from: dailyDone ? "#123227" : "#3A2A0E", to: dailyDone ? "#0F1D1A" : "#1A1710", accent: dailyDone ? C.success : C.gold }} accent={dailyDone ? "rgba(52,211,153,0.3)" : C.goldLine} onPress={dailyDone ? undefined : () => play({ kind: "daily" })} accessibilityLabel="Play the Daily Challenge">
            <View style={styles.dailyTop}>
              <IconBadge icon={dailyDone ? "checkmark" : "calendar"} color={dailyDone ? C.success : C.gold} tint={dailyDone ? C.successSoft : C.goldSoft} />
              <View style={{ flex: 1 }}>
                <Txt variant="overline" color={dailyDone ? C.success : C.gold}>Daily Challenge</Txt>
                <Txt variant="h3">{dailyDone ? `Done · ${arena.daily?.correct}/${arena.daily?.total} correct` : "7 questions, one shot"}</Txt>
              </View>
              {!dailyDone ? <Pill label="+100 XP" icon="bolt.fill" color={C.ink} bg={C.gold} /> : null}
            </View>
            <Txt variant="small" color={C.textDim} style={{ marginTop: S.md }}>
              {dailyDone ? `A fresh challenge unlocks in ${formatCountdown(msUntilTomorrow(now))}. Everyone gets the same questions.` : "Every category, easy to hard. Same questions for everyone today, so compare with friends."}
            </Txt>
            {!dailyDone ? <Button label="Start today’s challenge" iconRight="arrow.right" onPress={() => play({ kind: "daily" })} style={{ marginTop: S.lg }} /> : null}
          </Card>
        </FadeIn>

        <FadeIn delay={180}>
          <SectionHeader title="Up next for you" />
          <Card onPress={() => play({ kind: "category", category: next.id })} accessibilityLabel={`Play ${next.title}`} style={{ marginTop: S.md }} glow={{ from: "#141F35", to: C.surface, accent: next.color }}>
            <View style={styles.nextRow}>
              <IconBadge icon={next.icon} color={next.color} tint={next.tint} size={54} />
              <View style={{ flex: 1, gap: 4 }}>
                <Txt variant="h3">{next.title}</Txt>
                <Txt variant="small" color={C.muted} numberOfLines={1}>{next.tagline}</Txt>
                <View style={styles.inline}>
                  <Stars count={nextMastery.stars} />
                  <Txt variant="caption" color={C.muted}>{nextMastery.pct}% mastered</Txt>
                </View>
              </View>
              <View style={[styles.playDot, { backgroundColor: next.color }]}>
                <IconSymbol name="play.fill" size={22} color={C.ink} />
              </View>
            </View>
          </Card>
        </FadeIn>

        <FadeIn delay={220}>
          <View style={styles.quickRow}>
            <Card style={styles.quickCard} onPress={() => play({ kind: "quick" })} accessibilityLabel="Quick round">
              <IconBadge icon="bolt.fill" color={C.gold} tint={C.goldSoft} size={40} />
              <Txt variant="bodyStrong" style={{ marginTop: S.md }}>Quick Round</Txt>
              <Txt variant="caption" color={C.muted}>10 mixed · combos</Txt>
            </Card>
            <Card style={styles.quickCard} onPress={() => play({ kind: "survival" })} accessibilityLabel="Survival mode">
              <IconBadge icon="heart.fill" color={C.heart} tint="rgba(255,93,115,0.14)" size={40} />
              <Txt variant="bodyStrong" style={{ marginTop: S.md }}>Survival</Txt>
              <Txt variant="caption" color={C.muted}>{arena.survivalBest ? `Best: ${arena.survivalBest}` : "3 hearts · go far"}</Txt>
            </Card>
          </View>
        </FadeIn>

        <FadeIn delay={260}>
          <SectionHeader title="Your categories" action="See all" onAction={() => router.push("/play")} />
          <Card style={{ marginTop: S.md, gap: S.lg }}>
            {mastery.map((m) => (
              <Pressable key={m.category.id} accessibilityRole="button" accessibilityLabel={`Play ${m.category.title}`} onPress={() => { feedback.tap(); play({ kind: "category", category: m.category.id }); }} style={styles.catRow}>
                <IconBadge icon={m.category.icon} color={m.category.color} tint={m.category.tint} size={36} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={styles.levelText}>
                    <Txt variant="smallStrong">{m.category.title}</Txt>
                    <Txt variant="caption" color={C.muted}>{m.mastered}/{m.total}</Txt>
                  </View>
                  <ProgressBar value={m.pct} color={m.category.color} height={6} />
                </View>
              </Pressable>
            ))}
          </Card>
        </FadeIn>

        {inReach.length ? (
          <FadeIn delay={300}>
            <SectionHeader title="Badges within reach" action="All badges" onAction={() => router.push("/profile")} />
            <View style={styles.badgeRow}>
              {inReach.map((badge) => (
                <View key={badge.key} style={styles.badge}>
                  <IconBadge icon={badge.icon} color={C.muted} tint={C.surface2} size={44} radius={22} />
                  <Txt variant="caption" style={{ textAlign: "center", marginTop: 8 }} numberOfLines={1}>{badge.name}</Txt>
                  <Txt variant="caption" color={C.muted} style={{ textAlign: "center", fontSize: 11, fontWeight: "500" }} numberOfLines={2}>{badge.description}</Txt>
                </View>
              ))}
            </View>
          </FadeIn>
        ) : null}

        <FadeIn delay={340}>
          <Card style={styles.verse}>
            <IconSymbol name="quote" size={26} color={C.gold} />
            <Txt variant="h3" style={{ fontWeight: "600", lineHeight: 26, marginTop: S.sm }}>{verse.text}</Txt>
            <Txt variant="smallStrong" color={C.gold} style={{ marginTop: S.md }}>{verse.ref} · KJV</Txt>
          </Card>
        </FadeIn>
        <Txt variant="caption" color={C.faint} style={{ textAlign: "center", marginTop: S.sm }}>Know the Word. Challenge the World.</Txt>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: S.lg, paddingBottom: 48, gap: S.xl },
  header: { flexDirection: "row", alignItems: "center", gap: S.md },
  streakChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 40, borderRadius: R.pill, backgroundColor: C.surface, borderWidth: 1, borderColor: C.hairline },
  todayCard: { gap: S.xl },
  todayRow: { flexDirection: "row", alignItems: "center", gap: S.lg },
  levelRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingTop: S.lg, borderTopWidth: 1, borderTopColor: C.hairline },
  levelBadge: { width: 34, height: 34, borderRadius: 12, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" },
  levelText: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8 },
  dailyTop: { flexDirection: "row", alignItems: "center", gap: S.md },
  nextRow: { flexDirection: "row", alignItems: "center", gap: S.lg },
  inline: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  playDot: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  quickRow: { flexDirection: "row", gap: S.md },
  quickCard: { flex: 1, padding: S.lg },
  catRow: { flexDirection: "row", alignItems: "center", gap: S.md },
  badgeRow: { flexDirection: "row", gap: S.md, marginTop: S.md },
  badge: { flex: 1, alignItems: "center", backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.hairline, padding: S.md },
  verse: { backgroundColor: "#111A2B" },
});
