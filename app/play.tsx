import { router } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, FadeIn, IconBadge, Pill, ProgressBar, SectionHeader, Stars, Txt } from "@/components/ui/kit";
import { C, R, S } from "@/constants/design";
import { dailyDoneToday, getAllMastery, normalizeArena } from "@/domain/arena";
import { useProgression } from "@/lib/progression-provider";

const MORE_MODES = [
  { icon: "person.fill", title: "Who Am I?", subtitle: "Guess the figure from clues", color: "#A78BFA", route: "/who-am-i" },
  { icon: "sparkles", title: "Bible or Myth", subtitle: "Is it really in the Bible?", color: "#34D399", route: "/quiz?kind=myth" },
  { icon: "puzzlepiece.fill", title: "Word Puzzle", subtitle: "Unscramble Scripture words", color: "#60A5FA", route: "/quiz?kind=puzzle" },
  { icon: "shield.fill", title: "AI Battle", subtitle: "Duel a rival: Novice to Scribe", color: "#FB7185", route: "/ai-battle" },
  { icon: "person.2.fill", title: "Challenge a Friend", subtitle: "Send a code, compare scores", color: "#FBBF24", route: "/challenges" },
  { icon: "globe", title: "Live Room", subtitle: "Real-time 1-v-1 (sign in)", color: "#2DD4BF", route: "/room" },
] as const;

export default function PlayScreen() {
  const { state } = useProgression();
  const arena = normalizeArena(state.arena);
  const mastery = useMemo(() => getAllMastery(arena), [arena]);
  const dailyDone = dailyDoneToday(arena);
  const play = (params: Record<string, string>) => router.push({ pathname: "/quiz", params: { ...params, r: String(Date.now()) } });

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <FadeIn>
          <Txt variant="overline" color={C.gold}>The Arena</Txt>
          <Txt variant="h1" style={{ marginTop: 4 }}>Choose your challenge</Txt>
          <Txt variant="body" color={C.muted} style={{ marginTop: 4 }}>Combos multiply your score. Hard questions are worth double.</Txt>
        </FadeIn>

        <FadeIn delay={60}>
          <Card glow={{ from: "#3A2A0E", to: "#161722", accent: C.gold }} accent={C.goldLine} onPress={() => play({ kind: "quick" })} accessibilityLabel="Quick round">
            <View style={styles.featureRow}>
              <View style={{ flex: 1, gap: 6 }}>
                <Pill label="Most played" icon="bolt.fill" color={C.ink} bg={C.gold} />
                <Txt variant="h2" style={{ marginTop: 6 }}>Quick Round</Txt>
                <Txt variant="small" color={C.textDim}>10 questions from every category, easy to hard, with combo multipliers up to ×3.</Txt>
              </View>
              <View style={styles.bigPlay}><IconSymbol name="play.fill" size={30} color={C.ink} /></View>
            </View>
          </Card>
        </FadeIn>

        <FadeIn delay={100}>
          <View style={styles.row}>
            <Card style={styles.half} onPress={() => play({ kind: "survival" })} accessibilityLabel="Survival">
              <View style={styles.hearts}>{[0, 1, 2].map((i) => <IconSymbol key={i} name="heart.fill" size={18} color={C.heart} />)}</View>
              <Txt variant="bodyStrong" style={{ marginTop: S.md }}>Survival</Txt>
              <Txt variant="caption" color={C.muted}>{arena.survivalBest ? `Your best: ${arena.survivalBest} correct` : "Three hearts. How far can you go?"}</Txt>
            </Card>
            <Card style={styles.half} onPress={dailyDone ? undefined : () => play({ kind: "daily" })} accessibilityLabel="Daily challenge" accent={dailyDone ? undefined : C.goldLine}>
              <IconSymbol name={dailyDone ? "checkmark.circle.fill" : "calendar"} size={22} color={dailyDone ? C.success : C.gold} />
              <Txt variant="bodyStrong" style={{ marginTop: S.md }}>Daily</Txt>
              <Txt variant="caption" color={C.muted}>{dailyDone ? "Done. Back tomorrow" : "7 questions · +100 XP"}</Txt>
            </Card>
          </View>
        </FadeIn>

        <FadeIn delay={140}>
          <SectionHeader title="Categories" />
          <View style={styles.grid}>
            {mastery.map((m) => (
              <Card key={m.category.id} style={styles.catCard} onPress={() => play({ kind: "category", category: m.category.id })} accessibilityLabel={`Play ${m.category.title}`} glow={{ from: "#141E33", to: C.surface, accent: m.category.color }}>
                <View style={styles.catTop}>
                  <IconBadge icon={m.category.icon} color={m.category.color} tint={m.category.tint} size={42} />
                  <Stars count={m.stars} size={13} />
                </View>
                <Txt variant="bodyStrong" style={{ marginTop: S.md }}>{m.category.title}</Txt>
                <Txt variant="caption" color={C.muted} numberOfLines={2} style={{ minHeight: 32, fontWeight: "500" }}>{m.category.tagline}</Txt>
                <ProgressBar value={m.pct} color={m.category.color} height={6} style={{ marginTop: S.md }} />
                <Txt variant="caption" color={C.muted} style={{ marginTop: 6 }}>{m.pct}% · {m.total} questions</Txt>
              </Card>
            ))}
          </View>
        </FadeIn>

        <FadeIn delay={180}>
          <SectionHeader title="More ways to play" />
          <Card padded={false} style={{ marginTop: S.md }}>
            {MORE_MODES.map((mode, index) => (
              <Card key={mode.title} padded={false} style={[styles.modeRow, index > 0 && styles.divider]} onPress={() => router.push(mode.route as never)} accessibilityLabel={mode.title}>
                <IconBadge icon={mode.icon} color={mode.color} tint={`${mode.color}22`} size={40} />
                <View style={{ flex: 1 }}>
                  <Txt variant="bodyStrong">{mode.title}</Txt>
                  <Txt variant="caption" color={C.muted} style={{ fontWeight: "500" }}>{mode.subtitle}</Txt>
                </View>
                <IconSymbol name="chevron.right" size={22} color={C.faint} />
              </Card>
            ))}
          </Card>
        </FadeIn>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: S.lg, paddingBottom: 48, gap: S.xl },
  featureRow: { flexDirection: "row", alignItems: "center", gap: S.lg },
  bigPlay: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: S.md },
  half: { flex: 1, padding: S.lg },
  hearts: { flexDirection: "row", gap: 3 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: S.md, marginTop: S.md },
  catCard: { width: "47.5%", flexGrow: 1, padding: S.lg, borderRadius: R.lg },
  catTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  modeRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingHorizontal: S.lg, paddingVertical: 14, borderRadius: 0, borderWidth: 0, backgroundColor: "transparent" },
  divider: { borderTopWidth: 1, borderTopColor: C.hairline },
});
