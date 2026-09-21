import { router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { setOnboardingCompleted } from "@/domain/local-storage";
import { useProgression } from "@/lib/progression-provider";

interface OnboardingSlide {
  title: string;
  subtitle: string;
  icon: "book.fill" | "flame.fill" | "bolt.fill";
  badge: string;
  points: string[];
}

const SLIDES: OnboardingSlide[] = [
  {
    badge: "LEARN & TEST",
    title: "Master Scripture Through Play",
    subtitle: "Engage with God's Word through 8 dynamic game modes designed for memorization, deduction, and understanding.",
    icon: "book.fill",
    points: [
      "100+ verified questions with verse references",
      "Signature 'Who Am I?' biblical deduction",
      "Daily Challenge for your morning devotion",
    ],
  },
  {
    badge: "HABIT & REWARD",
    title: "Ignite Your Daily Streak",
    subtitle: "Transform Bible study into an enduring daily habit. Earn XP, maintain your streak, and earn Seasonal prestige.",
    icon: "flame.fill",
    points: [
      "Daily streak flame counter & milestones",
      "Ascend from Seedling to Scribe and Elder",
      "Earn exclusive seasonal profile badges",
    ],
  },
  {
    badge: "COMMUNITY & ARENA",
    title: "Fellowship & Ranked Play",
    subtitle: "Challenge family and friends with instant share codes, or test your skills in live multiplayer rooms.",
    icon: "bolt.fill",
    points: [
      "Real-time head-to-head multiplayer rooms",
      "Asynchronous 6-character Friend Challenges",
      "Global Weekly and All-Time Leaderboards",
    ],
  },
];

function tapFeedback() {
  if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function successFeedback() {
  if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export default function OnboardingScreen() {
  const colors = useColors();
  const { recordSession } = useProgression();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    tapFeedback();
    if (currentSlide < SLIDES.length - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    successFeedback();
    await setOnboardingCompleted(true);

    // Grant 100 Starter XP bonus session
    void recordSession({
      sessionId: `onboarding-${Date.now()}`,
      mode: "bible_quiz",
      score: 100,
      totalQuestions: 1,
      correctAnswers: 1,
      accuracy: 100,
      xpEarned: 100,
      completedAt: Date.now(),
    });

    router.replace("/play");
  };

  const slide = SLIDES[currentSlide];

  return (
    <ScreenContainer className="px-6" containerClassName="bg-background">
      <View style={styles.container}>
        {/* Header with Skip button */}
        <View style={styles.topBar}>
          <Text style={[styles.stepIndicator, { color: colors.muted }]}>
            Step {currentSlide + 1} of {SLIDES.length}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            onPress={handleComplete}
            style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
          >
            <Text style={[styles.skipText, { color: colors.muted }]}>Skip</Text>
          </Pressable>
        </View>

        {/* Slide Content */}
        <ScrollView contentContainerStyle={styles.slideContent} showsVerticalScrollIndicator={false}>
          {/* Big Hero Icon Card */}
          <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: currentSlide === 1 ? colors.warning : currentSlide === 2 ? colors.success : colors.primary }]}>
              <IconSymbol name={slide.icon} size={44} color={colors.background} />
            </View>
            <View style={[styles.badgePill, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>{slide.badge}</Text>
            </View>
          </View>

          {/* Text Info */}
          <Text style={[styles.slideTitle, { color: colors.foreground }]}>{slide.title}</Text>
          <Text style={[styles.slideSubtitle, { color: colors.muted }]}>{slide.subtitle}</Text>

          {/* Bullet points */}
          <View style={styles.pointsList}>
            {slide.points.map((point) => (
              <View key={point} style={[styles.pointItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                  <Text style={styles.checkMark}>✓</Text>
                </View>
                <Text style={[styles.pointText, { color: colors.foreground }]}>{point}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Bottom Navigation */}
        <View style={styles.bottomNav}>
          {/* Dot indicators */}
          <View style={styles.dots}>
            {SLIDES.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === currentSlide ? colors.primary : colors.border,
                    width: index === currentSlide ? 28 : 8,
                  },
                ]}
              />
            ))}
          </View>

          {/* Primary Action Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={currentSlide === SLIDES.length - 1 ? "Enter Arena with 100 XP" : "Continue to next step"}
            onPress={handleNext}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.actionButtonText, { color: colors.background }]}>
              {currentSlide === SLIDES.length - 1 ? "Enter Arena (+100 XP Bonus)" : "Continue"}
            </Text>
            <IconSymbol name="chevron.right" size={18} color={colors.background} />
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "space-between", paddingTop: 12, paddingBottom: 24 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  stepIndicator: { fontSize: 13, fontWeight: "700" },
  skipButton: { paddingHorizontal: 12, paddingVertical: 6 },
  skipText: { fontSize: 13, fontWeight: "600" },
  slideContent: { alignItems: "center", paddingBottom: 24 },
  heroCard: { width: "100%", borderRadius: 28, borderWidth: 1, paddingVertical: 36, alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 24 },
  iconCircle: { width: 88, height: 88, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  badgePill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  slideTitle: { fontSize: 26, fontWeight: "800", textAlign: "center", letterSpacing: -0.5, marginBottom: 10 },
  slideSubtitle: { fontSize: 14, lineHeight: 22, textAlign: "center", marginBottom: 24, paddingHorizontal: 12 },
  pointsList: { width: "100%", gap: 10 },
  pointItem: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, borderWidth: 1, gap: 12 },
  checkCircle: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  checkMark: { color: "#000", fontSize: 13, fontWeight: "900" },
  pointText: { flex: 1, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  bottomNav: { gap: 18, paddingTop: 12 },
  dots: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  dot: { height: 8, borderRadius: 4 },
  actionButton: { borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionButtonText: { fontSize: 15, fontWeight: "800" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
});
