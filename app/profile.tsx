import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Button, Card, FadeIn, IconBadge, Pill, ProgressBar, SectionHeader, Stars, Txt } from "@/components/ui/kit";
import { C, R, S } from "@/constants/design";
import { startOAuthLogin } from "@/constants/oauth";
import { getAllMastery, getCategory, normalizeArena } from "@/domain/arena";
import { ACHIEVEMENT_CATALOG, getLevelProgress } from "@/domain/progression";
import { useAuth } from "@/hooks/use-auth";
import { feedback } from "@/lib/feedback";
import { useProgression } from "@/lib/progression-provider";
import { trpc } from "@/lib/trpc";

const TIER_COLOR: Record<string, string> = { bronze: "#D19A66", silver: "#C8D1DC", gold: C.gold };

function modeLabel(mode: string, kind?: string, category?: string): string {
  if (kind === "survival") return "Survival";
  if (kind === "daily" || mode === "daily_challenge") return "Daily Challenge";
  if (kind === "category" && category) return getCategory(category)?.title ?? "Category round";
  if (mode === "bible_or_myth") return "Bible or Myth";
  if (mode === "word_puzzle") return "Word Puzzle";
  return "Quick Round";
}

export default function ProfileScreen() {
  const { state, isAuthenticated, syncStatus, setDisplayName, updateArena } = useProgression();
  const { user, logout, loginAsGuest } = useAuth();
  const seasonQuery = trpc.season.myProgress.useQuery(undefined, { enabled: isAuthenticated });
  const claimReward = trpc.season.claimReward.useMutation({ onSuccess: () => { feedback.correct(); void seasonQuery.refetch(); } });
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(state.displayName ?? "");

  const arena = normalizeArena(state.arena);
  const level = getLevelProgress(state.progression.totalXp);
  const mastery = useMemo(() => getAllMastery(arena), [arena]);
  const unlockedKeys = new Set(state.achievements.map((a) => a.key));
  const isGuestAccount = user?.loginMethod === "guest";
  const displayName = state.displayName || (user?.name && !isGuestAccount ? user.name : "") || "Bible Arena player";
  const initial = displayName.trim().charAt(0).toUpperCase() || "B";

  const stats = [
    { label: "Total XP", value: state.progression.totalXp.toLocaleString(), icon: "bolt.fill", color: C.gold },
    { label: "Day streak", value: String(state.progression.currentStreak), icon: "flame.fill", color: C.flame },
    { label: "Best streak", value: String(state.progression.bestStreak), icon: "flame.fill", color: C.flame },
    { label: "Rounds", value: String(Math.max(arena.roundsPlayed, state.sessions.length)), icon: "play.fill", color: "#60A5FA" },
    { label: "Best combo", value: String(arena.bestCombo), icon: "bolt.fill", color: C.violet },
    { label: "Survival best", value: String(arena.survivalBest), icon: "heart.fill", color: C.heart },
  ];

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <FadeIn>
          <View style={styles.headerRow}>
            <Txt variant="overline" color={C.gold}>Profile</Txt>
            <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => { feedback.tap(); router.push("/settings"); }} style={styles.iconBtn}>
              <IconSymbol name="gearshape.fill" size={20} color={C.text} />
            </Pressable>
          </View>
          <View style={styles.identity}>
            <View style={styles.avatar}><Txt variant="h1" color={C.ink}>{initial}</Txt><View style={styles.levelChip}><Txt variant="caption" color={C.ink} style={{ fontWeight: "800" }}>{level.level}</Txt></View></View>
            <View style={{ flex: 1 }}>
              {editing ? (
                <TextInput value={nameDraft} onChangeText={setNameDraft} autoFocus maxLength={24} placeholder="Your name" placeholderTextColor={C.faint} onSubmitEditing={() => { setDisplayName(nameDraft); setEditing(false); }} onBlur={() => { setDisplayName(nameDraft); setEditing(false); }} style={styles.nameInput} />
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel="Edit name" onPress={() => { setNameDraft(state.displayName ?? ""); setEditing(true); }} style={styles.nameRow}>
                  <Txt variant="h2" numberOfLines={1} style={{ flexShrink: 1 }}>{displayName}</Txt>
                  <IconSymbol name="chevron.right" size={18} color={C.faint} />
                </Pressable>
              )}
              <Txt variant="small" color={C.muted}>{level.name} · Level {level.level}</Txt>
            </View>
          </View>
          <View style={{ marginTop: S.lg, gap: 6 }}>
            <View style={styles.between}><Txt variant="caption" color={C.muted}>{state.progression.totalXp.toLocaleString()} XP</Txt><Txt variant="caption" color={C.muted}>{level.next === null ? "Max level" : `${level.toNext.toLocaleString()} to level ${level.level + 1}`}</Txt></View>
            <ProgressBar value={level.pct} />
          </View>
        </FadeIn>

        <FadeIn delay={60}>
          <Card style={{ gap: S.md }} glow={{ from: "#17233D", to: C.surface }}>
            {isAuthenticated && !isGuestAccount ? (
              <>
                <View style={styles.accountRow}>
                  <IconBadge icon="checkmark" color={C.success} tint={C.successSoft} size={40} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">Signed in{user?.email ? ` as ${user.email}` : ""}</Txt>
                    <Txt variant="caption" color={C.muted} style={{ fontWeight: "500" }}>Progress {syncStatus === "synced" ? "synced to the cloud" : syncStatus === "syncing" ? "syncing…" : syncStatus === "error" ? "will sync on your next round" : "saved"} · ranked on leaderboards</Txt>
                  </View>
                </View>
                <Button label="Sign out" variant="secondary" size="md" onPress={() => void logout()} />
              </>
            ) : (
              <>
                <View style={styles.accountRow}>
                  <IconBadge icon="shield.fill" color={C.gold} tint={C.goldSoft} size={40} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{isGuestAccount ? "Playing as guest" : "Save your progress"}</Txt>
                    <Txt variant="caption" color={C.muted} style={{ fontWeight: "500" }}>Sign in to keep your streak on any device and join the leaderboards.</Txt>
                  </View>
                </View>
                <Button label="Continue with Google" icon="globe" variant="light" onPress={() => void startOAuthLogin()} accessibilityLabel="Sign in with Google" />
                {!isAuthenticated ? <Button label="Play online as guest" variant="ghost" size="md" onPress={() => void loginAsGuest()} /> : <Button label="Sign out of guest" variant="ghost" size="md" onPress={() => void logout()} />}
              </>
            )}
          </Card>
        </FadeIn>

        <FadeIn delay={100}>
          <View style={styles.statGrid}>
            {stats.map((s0) => (
              <View key={s0.label} style={styles.stat}>
                <IconSymbol name={s0.icon} size={18} color={s0.color} />
                <Txt variant="h3" style={{ marginTop: 6 }}>{s0.value}</Txt>
                <Txt variant="caption" color={C.muted}>{s0.label}</Txt>
              </View>
            ))}
          </View>
        </FadeIn>

        <FadeIn delay={140}>
          <SectionHeader title="Mastery" />
          <Card style={{ marginTop: S.md, gap: S.lg }}>
            {mastery.map((m) => (
              <View key={m.category.id} style={styles.masteryRow}>
                <IconBadge icon={m.category.icon} color={m.category.color} tint={m.category.tint} size={36} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={styles.between}><Txt variant="smallStrong">{m.category.title}</Txt><Stars count={m.stars} size={12} /></View>
                  <ProgressBar value={m.pct} color={m.category.color} height={6} />
                </View>
                <Txt variant="caption" color={C.muted} style={{ width: 38, textAlign: "right" }}>{m.pct}%</Txt>
              </View>
            ))}
          </Card>
        </FadeIn>

        <FadeIn delay={180}>
          <SectionHeader title={`Badges · ${unlockedKeys.size}/${ACHIEVEMENT_CATALOG.length}`} />
          <View style={styles.badgeGrid}>
            {ACHIEVEMENT_CATALOG.map((badge) => {
              const got = unlockedKeys.has(badge.key);
              const color = got ? TIER_COLOR[badge.tier ?? "bronze"] : C.faint;
              return (
                <View key={badge.key} style={[styles.badge, got && { borderColor: `${color}55` }]} accessibilityLabel={`${badge.name}: ${badge.description}${got ? ", unlocked" : ", locked"}`}>
                  <IconBadge icon={got ? badge.icon : "lock.fill"} color={color} tint={got ? `${color}22` : C.surface2} size={40} radius={20} />
                  <Txt variant="caption" color={got ? C.text : C.muted} numberOfLines={1} style={{ marginTop: 6, textAlign: "center" }}>{badge.name}</Txt>
                  <Txt variant="caption" color={C.faint} numberOfLines={2} style={{ textAlign: "center", fontSize: 10, lineHeight: 13, fontWeight: "500" }}>{badge.description}</Txt>
                </View>
              );
            })}
          </View>
        </FadeIn>

        {isAuthenticated && seasonQuery.data ? (() => {
          const sp = seasonQuery.data;
          const tierColor = sp.tiers.find((t) => t.tier === sp.currentTier)?.color ?? C.gold;
          const order: Record<string, number> = { Seedling: 0, Pathfinder: 1, Scribe: 2, Elder: 3 };
          return (
            <FadeIn delay={200}>
              <SectionHeader title="Season ladder" />
              <Card style={{ marginTop: S.md, gap: S.md }}>
                <View style={styles.between}>
                  <View><Txt variant="overline" color={C.muted}>{sp.season.name} · {sp.division}</Txt><Txt variant="h3" color={tierColor}>{sp.currentTier}</Txt></View>
                  <IconSymbol name="crown.fill" size={28} color={tierColor} />
                </View>
                <ProgressBar value={sp.progressPercent} color={tierColor} />
                <Txt variant="caption" color={C.muted}>{sp.nextTier ? `${sp.pointsToNext} pts to ${sp.nextTier} · ${sp.points} total` : `Max tier · ${sp.points} pts`}</Txt>
                {sp.catalog.map((reward) => {
                  const eligible = (order[sp.currentTier] ?? 0) >= (order[reward.requiredTier] ?? 0);
                  const claimed = sp.claimedRewardIds.includes(reward.id);
                  return (
                    <View key={reward.id} style={styles.masteryRow}>
                      <IconBadge icon="rosette" color={eligible ? C.gold : C.faint} tint={eligible ? C.goldSoft : C.surface2} size={34} />
                      <View style={{ flex: 1 }}><Txt variant="smallStrong" color={eligible ? C.text : C.muted}>{reward.name}</Txt><Txt variant="caption" color={C.muted} style={{ fontWeight: "500" }}>{reward.requiredTier} · {reward.description}</Txt></View>
                      {claimed ? <Pill label="Claimed" color={C.success} bg={C.successSoft} /> : eligible ? <Button label="Claim" size="sm" onPress={() => claimReward.mutate({ seasonId: sp.season.id, rewardId: reward.id })} disabled={claimReward.isPending} /> : null}
                    </View>
                  );
                })}
              </Card>
            </FadeIn>
          );
        })() : null}

        <FadeIn delay={220}>
          <SectionHeader title="Preferences" />
          <Card padded={false} style={{ marginTop: S.md }}>
            <View style={styles.prefRow}>
              <IconSymbol name={arena.soundOn ? "speaker.wave.2.fill" : "speaker.slash.fill"} size={20} color={C.textDim} />
              <Txt variant="bodyStrong" style={{ flex: 1 }}>Sound effects</Txt>
              <Switch value={arena.soundOn} onValueChange={(v) => updateArena({ soundOn: v })} trackColor={{ true: C.gold, false: C.border }} thumbColor={C.text} accessibilityLabel="Sound effects" />
            </View>
            <View style={[styles.prefRow, styles.divider]}>
              <IconSymbol name="iphone.radiowaves" size={20} color={C.textDim} />
              <Txt variant="bodyStrong" style={{ flex: 1 }}>Vibration</Txt>
              <Switch value={arena.hapticsOn} onValueChange={(v) => updateArena({ hapticsOn: v })} trackColor={{ true: C.gold, false: C.border }} thumbColor={C.text} accessibilityLabel="Vibration" />
            </View>
            <View style={[styles.prefRow, styles.divider]}>
              <IconSymbol name="target" size={20} color={C.textDim} />
              <Txt variant="bodyStrong" style={{ flex: 1 }}>Daily goal</Txt>
              {[150, 300, 600].map((g) => (
                <Pressable key={g} accessibilityRole="button" accessibilityState={{ selected: arena.dailyGoalXp === g }} onPress={() => { feedback.tap(); updateArena({ dailyGoalXp: g }); }} style={[styles.goalChip, arena.dailyGoalXp === g && styles.goalChipActive]}>
                  <Txt variant="caption" color={arena.dailyGoalXp === g ? C.ink : C.muted}>{g}</Txt>
                </Pressable>
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={() => { feedback.tap(); router.push("/friends"); }} style={[styles.prefRow, styles.divider]}>
              <IconSymbol name="person.2.fill" size={20} color={C.textDim} />
              <Txt variant="bodyStrong" style={{ flex: 1 }}>Friends</Txt>
              <IconSymbol name="chevron.right" size={20} color={C.faint} />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => { feedback.tap(); router.push("/settings"); }} style={[styles.prefRow, styles.divider]}>
              <IconSymbol name="gearshape.fill" size={20} color={C.textDim} />
              <Txt variant="bodyStrong" style={{ flex: 1 }}>More settings</Txt>
              <IconSymbol name="chevron.right" size={20} color={C.faint} />
            </Pressable>
          </Card>
        </FadeIn>

        {state.sessions.length ? (
          <FadeIn delay={240}>
            <SectionHeader title="Recent rounds" />
            <Card padded={false} style={{ marginTop: S.md }}>
              {state.sessions.slice(0, 6).map((session, i) => (
                <View key={session.id} style={[styles.prefRow, i > 0 && styles.divider]}>
                  <IconBadge icon={session.kind === "survival" ? "heart.fill" : session.mode === "daily_challenge" ? "calendar" : "bolt.fill"} color={session.kind === "survival" ? C.heart : C.gold} tint={session.kind === "survival" ? "rgba(255,93,115,0.14)" : C.goldSoft} size={36} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="smallStrong">{modeLabel(session.mode, session.kind, session.category)}</Txt>
                    <Txt variant="caption" color={C.muted} style={{ fontWeight: "500" }}>{session.correctAnswers}/{session.totalQuestions} correct · {new Date(session.completedAt).toLocaleDateString()}</Txt>
                  </View>
                  <Txt variant="smallStrong" color={C.gold}>{session.score.toLocaleString()}</Txt>
                </View>
              ))}
            </Card>
          </FadeIn>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: S.lg, paddingBottom: 48, gap: S.xl },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.hairline },
  identity: { flexDirection: "row", alignItems: "center", gap: S.lg, marginTop: S.md },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" },
  levelChip: { position: "absolute", right: -2, bottom: -2, minWidth: 26, height: 26, borderRadius: 13, backgroundColor: C.text, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: C.bg, paddingHorizontal: 4 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  nameInput: { height: 44, borderRadius: R.md, borderWidth: 1.5, borderColor: C.gold, color: C.text, paddingHorizontal: S.md, fontSize: 20, fontWeight: "700", backgroundColor: C.surface },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accountRow: { flexDirection: "row", alignItems: "center", gap: S.md },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: S.md },
  stat: { width: "30.5%", flexGrow: 1, backgroundColor: C.surface, borderRadius: R.lg, padding: S.md, borderWidth: 1, borderColor: C.hairline },
  masteryRow: { flexDirection: "row", alignItems: "center", gap: S.md },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: S.sm, marginTop: S.md },
  badge: { width: "31.5%", flexGrow: 1, alignItems: "center", padding: S.md, borderRadius: R.lg, backgroundColor: C.surface, borderWidth: 1, borderColor: C.hairline },
  prefRow: { flexDirection: "row", alignItems: "center", gap: S.md, paddingHorizontal: S.lg, paddingVertical: 14 },
  divider: { borderTopWidth: 1, borderTopColor: C.hairline },
  goalChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.pill, backgroundColor: C.surface2 },
  goalChipActive: { backgroundColor: C.gold },
});
