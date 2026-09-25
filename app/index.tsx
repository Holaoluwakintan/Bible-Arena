import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { ScrollView, Pressable, StyleSheet, Text, View, Platform } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { loadProgressState } from "@/domain/local-storage";

function tapFeedback() {
  if (Platform.OS !== "web") {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export default function HomeScreen() {
  const colors = useColors();
  const [onboardingNeeded, setOnboardingNeeded] = useState(false);

  useEffect(() => {
    void loadProgressState().then((state) => {
      if (!state.hasCompletedOnboarding) {
        setOnboardingNeeded(true);
      }
    });
  }, []);

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>BIBLE ARENA</Text>
            <Text style={[styles.greeting, { color: colors.foreground }]}>Welcome to Bible Arena</Text>
            <Text style={[styles.subtle, { color: colors.muted }]}>Local progress · ready to grow</Text>
          </View>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.background }]}>G</Text>
          </View>
        </View>

        {onboardingNeeded && (
          <View style={[styles.onboardingBanner, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <View style={[styles.onboardingBadge, { backgroundColor: colors.primary }]}>
              <IconSymbol name="sparkles" size={16} color={colors.background} />
            </View>
            <View style={styles.onboardingCopy}>
              <Text style={[styles.onboardingTitle, { color: colors.foreground }]}>New to the Arena?</Text>
              <Text style={[styles.onboardingSubtitle, { color: colors.muted }]}>Take the 60s interactive tour & claim +100 Starter XP!</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start onboarding tour"
              onPress={() => { tapFeedback(); router.push("/onboarding"); }}
              style={({ pressed }) => [styles.onboardingBtn, { backgroundColor: colors.primary }, pressed && styles.pressed]}
            >
              <Text style={[styles.onboardingBtnText, { color: colors.background }]}>Start</Text>
              <IconSymbol name="chevron.right" size={14} color={colors.background} />
            </Pressable>
          </View>
        )}

        <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.heroCopy}>
            <View style={styles.kickerRow}>
              <IconSymbol name="sparkles" size={16} color={colors.primary} />
            <Text style={[styles.kicker, { color: colors.primary }]}>START HERE</Text>
            </View>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>Play a quick round.</Text>
            <Text style={[styles.heroBody, { color: colors.muted }]}>Ten timed Bible questions with an explanation and Scripture reference after every answer.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Play a quick round"
              onPress={() => { tapFeedback(); router.push("/quiz"); }}
              style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
            >
              <Text style={[styles.primaryButtonText, { color: colors.background }]}>Play a quick round</Text>
              <IconSymbol name="chevron.right" size={18} color={colors.background} />
            </Pressable>
          </View>
          <View style={[styles.heroMark, { borderColor: colors.primary }]}>
            <IconSymbol name="book.fill" size={38} color={colors.primary} />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Today at a glance</Text>
          <Text style={[styles.sectionCaption, { color: colors.muted }]}>Build your rhythm</Text>
        </View>
        <View style={styles.statGrid}>
          {[
            { icon: "flame.fill" as const, label: "Streak", value: "Not started" },
            { icon: "trophy.fill" as const, label: "Level", value: "Ready to earn" },
            { icon: "chart.bar.fill" as const, label: "Accuracy", value: "No sessions" },
          ].map((stat) => (
            <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name={stat.icon} size={20} color={colors.primary} />
              <Text style={[styles.statLabel, { color: colors.muted }]}>{stat.label}</Text>
              <Text style={[styles.statValue, { color: colors.foreground }]}>{stat.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Keep learning</Text>
          <Text style={[styles.sectionCaption, { color: colors.muted }]}>Choose your pace</Text>
        </View>
        <View style={[styles.challengeCard, { backgroundColor: colors.primary }]}>
          <View style={styles.challengeIcon}>
            <IconSymbol name="sparkles" size={22} color={colors.primary} />
          </View>
          <View style={styles.challengeCopy}>
            <Text style={[styles.challengeTitle, { color: colors.background }]}>Daily Challenge</Text>
            <Text style={[styles.challengeBody, { color: colors.background }]}>One focused session. A stronger streak.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open daily challenge"
            onPress={() => { tapFeedback(); router.push("/play"); }}
            style={({ pressed }) => [styles.roundButton, { backgroundColor: colors.background }, pressed && styles.pressed]}
          >
            <IconSymbol name="chevron.right" size={18} color={colors.primary} />
          </Pressable>
        </View>

        <View style={[styles.quoteCard, { borderColor: colors.border }]}>
          <Text style={[styles.quoteMark, { color: colors.primary }]}>“</Text>
          <Text style={[styles.quoteText, { color: colors.foreground }]}>Learn the Bible. Test yourself. Become better.</Text>
          <Text style={[styles.quoteCaption, { color: colors.muted }]}>The Bible Arena promise</Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 36, gap: 22 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 2.2 },
  greeting: { fontSize: 30, fontWeight: "800", letterSpacing: -0.7, marginTop: 6 },
  subtle: { fontSize: 14, marginTop: 4 },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "800" },
  heroCard: { borderRadius: 28, borderWidth: 1, padding: 22, flexDirection: "row", minHeight: 238, overflow: "hidden" },
  heroCopy: { flex: 1, paddingRight: 12 },
  kickerRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  kicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  heroTitle: { fontSize: 31, fontWeight: "800", letterSpacing: -0.8, marginTop: 18 },
  heroBody: { fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 225 },
  heroMark: { width: 74, height: 74, borderRadius: 37, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 10 },
  primaryButton: { borderRadius: 15, paddingVertical: 14, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, maxWidth: 205 },
  primaryButtonText: { fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  sectionTitle: { fontSize: 19, fontWeight: "800" },
  sectionCaption: { fontSize: 12 },
  statGrid: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, minHeight: 112, borderRadius: 18, borderWidth: 1, padding: 14, justifyContent: "space-between" },
  statLabel: { fontSize: 11, fontWeight: "600", marginTop: 10 },
  statValue: { fontSize: 13, fontWeight: "800", lineHeight: 17 },
  challengeCard: { borderRadius: 22, padding: 16, flexDirection: "row", alignItems: "center", gap: 13 },
  challengeIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFF6E6", alignItems: "center", justifyContent: "center" },
  challengeCopy: { flex: 1 },
  challengeTitle: { fontSize: 16, fontWeight: "800" },
  challengeBody: { fontSize: 12, lineHeight: 17, marginTop: 3, opacity: 0.82 },
  roundButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  quoteCard: { borderRadius: 22, borderWidth: 1, padding: 18 },
  quoteMark: { fontSize: 38, lineHeight: 30, fontWeight: "800" },
  quoteText: { fontSize: 17, fontWeight: "700", lineHeight: 24, marginTop: 4 },
  quoteCaption: { fontSize: 12, marginTop: 10 },
  onboardingBanner: { borderRadius: 20, borderWidth: 1.5, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  onboardingBadge: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  onboardingCopy: { flex: 1 },
  onboardingTitle: { fontSize: 14, fontWeight: "800" },
  onboardingSubtitle: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  onboardingBtn: { borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 4 },
  onboardingBtnText: { fontSize: 12, fontWeight: "800" },
});
