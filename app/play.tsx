import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { CONTENT_PACKS } from "@/domain/phase8";

const MODES = [
  { icon: "book.fill" as const, title: "Bible Quiz", subtitle: "10 questions · timed", accent: "primary" as const, available: true },
  { icon: "sparkles" as const, title: "Who Am I?", subtitle: "Deduce the figure from clues", accent: "warning" as const, available: true },
  { icon: "sparkles" as const, title: "Bible or Myth", subtitle: "Spot truth from tradition", accent: "success" as const, available: true },
  { icon: "puzzlepiece.fill" as const, title: "Word Puzzle", subtitle: "Unscramble Scripture words", accent: "warning" as const, available: true },
  { icon: "flame.fill" as const, title: "Daily Challenge", subtitle: "A shared daily session", accent: "primary" as const, available: true },
  { icon: "trophy.fill" as const, title: "AI Battle", subtitle: "Choose your rival's difficulty", accent: "primary" as const, available: true },
  { icon: "person.2.fill" as const, title: "Challenge a Friend", subtitle: "Create a share code", accent: "primary" as const, available: true },
  { icon: "bolt.fill" as const, title: "Live Multiplayer", subtitle: "Private realtime room", accent: "success" as const, available: true },
  { icon: "chart.bar.fill" as const, title: "Leaderboards", subtitle: "Weekly and all-time rankings", accent: "primary" as const, available: true },
];

function tapFeedback() {
  if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export default function PlayScreen() {
  const colors = useColors();

  const handleModePress = (mode: (typeof MODES)[number]) => {
    tapFeedback();
    if (mode.available) {
      if (mode.title === "Who Am I?") {
        router.push("/who-am-i");
        return;
      }
      if (mode.title === "AI Battle") {
        router.push("/ai-battle");
        return;
      }
      if (mode.title === "Challenge a Friend") {
        router.push("/challenges");
        return;
      }
      if (mode.title === "Leaderboards") {
        router.push("/leaderboards");
        return;
      }
      if (mode.title === "Live Multiplayer") {
        router.push("/room");
        return;
      }
      const modeParam = mode.title === "Bible or Myth" ? "bible_or_myth" : mode.title === "Word Puzzle" ? "word_puzzle" : mode.title === "Daily Challenge" ? "daily_challenge" : "bible_quiz";
      router.push(modeParam === "bible_quiz" ? "/quiz" : { pathname: "/quiz", params: { mode: modeParam } });
      return;
    }
    Alert.alert("Coming next", `${mode.title} is part of the Bible Arena roadmap and will plug into the shared game engine.`);
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>THE ARENA</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Choose your challenge.</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Every mode is built to help you learn, improve, and come back stronger.</Text>
        </View>

        <View style={[styles.featured, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.featuredTop}>
            <View style={[styles.featuredIcon, { backgroundColor: colors.primary }]}>
              <IconSymbol name="book.fill" size={24} color={colors.background} />
            </View>
            <View style={styles.featuredCopy}>
              <Text style={[styles.featuredLabel, { color: colors.primary }]}>START HERE</Text>
            <Text style={[styles.featuredTitle, { color: colors.foreground }]}>Play a quick round</Text>
            </View>
            <Text style={[styles.duration, { color: colors.muted }]}>~5 min</Text>
          </View>
          <Text style={[styles.featuredBody, { color: colors.muted }]}>A focused ten-question Bible Quiz session with feedback after every answer.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play a quick round"
            onPress={() => handleModePress(MODES[0])}
            style={({ pressed }) => [styles.startButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
          >
            <Text style={[styles.startButtonText, { color: colors.background }]}>Play a quick round</Text>
            <IconSymbol name="chevron.right" size={18} color={colors.background} />
          </Pressable>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Focus packs</Text>
          <Text style={[styles.sectionCaption, { color: colors.muted }]}>Learn by theme</Text>
        </View>
        <View style={styles.packList}>
          {CONTENT_PACKS.map((pack) => (
            <Pressable key={pack.id} accessibilityRole="button" accessibilityLabel={`Open ${pack.title} focus pack`} onPress={() => router.push({ pathname: "/quiz", params: { pack: pack.id } })} style={({ pressed }) => [styles.packCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
              <View style={[styles.packIcon, { backgroundColor: "#203957" }]}><IconSymbol name="book.fill" size={18} color={colors.primary} /></View>
              <View style={styles.modeCopy}><Text style={[styles.modeTitle, { color: colors.foreground }]}>{pack.title}</Text><Text style={[styles.modeSubtitle, { color: colors.muted }]}>{pack.subtitle}</Text></View>
              <IconSymbol name="chevron.right" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>More ways to play</Text>
          <Text style={[styles.sectionCaption, { color: colors.muted }]}>Explore after your first round</Text>
        </View>

        <View style={styles.modeList}>
          {MODES.slice(1).map((mode) => (
            <Pressable
              key={mode.title}
              accessibilityRole="button"
              accessibilityLabel={`Open ${mode.title}`}
              onPress={() => handleModePress(mode)}
              style={({ pressed }) => [styles.modeCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
            >
              <View style={[styles.modeIcon, { backgroundColor: mode.accent === "success" ? "#1C3C38" : mode.accent === "warning" ? "#3E321F" : "#203957" }]}>
                <IconSymbol name={mode.icon} size={22} color={mode.accent === "success" ? colors.success : mode.accent === "warning" ? colors.warning : colors.primary} />
              </View>
              <View style={styles.modeCopy}>
                <Text style={[styles.modeTitle, { color: colors.foreground }]}>{mode.title}</Text>
                <Text style={[styles.modeSubtitle, { color: colors.muted }]}>{mode.subtitle}</Text>
              </View>
              <IconSymbol name="chevron.right" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Return to home"
          onPress={() => { tapFeedback(); router.push("/"); }}
          style={({ pressed }) => [styles.homeLink, pressed && styles.pressed]}
        >
          <Text style={[styles.homeLinkText, { color: colors.primary }]}>Back to home</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 36, gap: 22 },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 2.2 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.7, marginTop: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 340 },
  featured: { borderRadius: 25, borderWidth: 1, padding: 18 },
  featuredTop: { flexDirection: "row", alignItems: "center" },
  featuredIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  featuredCopy: { flex: 1, marginLeft: 12 },
  featuredLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  featuredTitle: { fontSize: 22, fontWeight: "800", marginTop: 2 },
  duration: { fontSize: 12 },
  featuredBody: { fontSize: 14, lineHeight: 21, marginTop: 18 },
  startButton: { borderRadius: 15, padding: 14, marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  startButtonText: { fontSize: 13, fontWeight: "800" },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  sectionTitle: { fontSize: 19, fontWeight: "800" },
  sectionCaption: { fontSize: 12 },
  modeList: { gap: 10 },
  packList: { gap: 10 },
  packCard: { minHeight: 70, borderRadius: 19, borderWidth: 1, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  packIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  modeCard: { minHeight: 78, borderRadius: 19, borderWidth: 1, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 },
  modeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modeCopy: { flex: 1 },
  modeTitle: { fontSize: 15, fontWeight: "800" },
  modeSubtitle: { fontSize: 12, marginTop: 4 },
  homeLink: { alignSelf: "center", padding: 8 },
  homeLinkText: { fontSize: 13, fontWeight: "800" },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
