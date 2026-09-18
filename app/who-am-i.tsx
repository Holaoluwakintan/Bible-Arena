import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useProgression } from "@/lib/progression-provider";
import {
  calculateWhoAmIPoints,
  calculateWhoAmIResult,
  createWhoAmISession,
  revealNextClue,
  submitWhoAmIGuess,
  VERIFIED_WHO_AM_I_QUESTIONS,
  type WhoAmIResult,
  type WhoAmISession,
} from "@/domain/who-am-i";

function tapFeedback() {
  if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function successFeedback() {
  if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

function errorFeedback() {
  if (Platform.OS !== "web") void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export default function WhoAmIScreen() {
  const colors = useColors();
  const { recordSession } = useProgression();

  // Shuffle and pick 5 questions for variety
  const questions = useMemo(() => {
    const pool = [...VERIFIED_WHO_AM_I_QUESTIONS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 5);
  }, []);

  const [session, setSession] = useState<WhoAmISession>(() => createWhoAmISession(questions));
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    points: number;
    person: string;
    explanation: string;
    reference: string;
  } | null>(null);
  const [result, setResult] = useState<WhoAmIResult | null>(null);

  useEffect(() => {
    if (result) {
      void recordSession({
        sessionId: result.sessionId,
        mode: "who_am_i" as any,
        score: result.score,
        totalQuestions: result.totalQuestions,
        correctAnswers: result.correctAnswers,
        accuracy: result.accuracy,
        xpEarned: result.xpEarned,
        completedAt: result.completedAt,
      });
    }
  }, [result, recordSession]);

  const currentQuestion = session.questions[session.currentIndex];
  const currentPotentialPoints = calculateWhoAmIPoints(session.cluesRevealed, true);

  const handleRevealClue = () => {
    tapFeedback();
    setSession((prev) => revealNextClue(prev));
  };

  const handleSubmit = () => {
    if (!selectedOption || feedback || result) return;
    tapFeedback();
    const outcome = submitWhoAmIGuess(session, selectedOption);
    setSession(outcome.session);
    setFeedback(outcome.feedback);
    if (outcome.feedback.isCorrect) {
      successFeedback();
    } else {
      errorFeedback();
    }
    if (outcome.session.status === "complete") {
      setResult(calculateWhoAmIResult(outcome.session));
    }
  };

  const handleContinue = () => {
    tapFeedback();
    setSelectedOption(null);
    setFeedback(null);
  };

  const handlePlayAgain = () => {
    tapFeedback();
    const pool = [...VERIFIED_WHO_AM_I_QUESTIONS].sort(() => Math.random() - 0.5).slice(0, 5);
    setSession(createWhoAmISession(pool));
    setSelectedOption(null);
    setFeedback(null);
    setResult(null);
  };

  if (result) {
    return (
      <ScreenContainer className="px-5" containerClassName="bg-background">
        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.resultIcon, { backgroundColor: result.accuracy >= 80 ? "#1C3C38" : "#243650" }]}>
            <IconSymbol
              name={result.accuracy >= 80 ? "sparkles" : "trophy.fill"}
              size={36}
              color={result.accuracy >= 80 ? colors.success : colors.primary}
            />
          </View>
          <Text style={[styles.resultEyebrow, { color: colors.primary }]}>SESSION COMPLETE</Text>
          <Text style={[styles.resultTitle, { color: colors.foreground }]}>
            {result.accuracy === 100 ? "Master Detective!" : result.accuracy >= 60 ? "Great Deduction!" : "Keep Studying!"}
          </Text>
          <Text style={[styles.resultSubtitle, { color: colors.muted }]}>
            You identified {result.correctAnswers} of {result.totalQuestions} biblical figures.
          </Text>

          <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.scoreLabel, { color: colors.muted }]}>FINAL SCORE</Text>
            <Text style={[styles.scoreValue, { color: colors.foreground }]}>{result.score}</Text>
            <View style={styles.resultStats}>
              <View style={styles.resultStat}>
                <Text style={[styles.resultStatValue, { color: colors.foreground }]}>{result.accuracy}%</Text>
                <Text style={[styles.resultStatLabel, { color: colors.muted }]}>Accuracy</Text>
              </View>
              <View style={styles.resultStat}>
                <Text style={[styles.resultStatValue, { color: colors.primary }]}>+{result.xpEarned} XP</Text>
                <Text style={[styles.resultStatLabel, { color: colors.muted }]}>Progression</Text>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Play Who Am I Again"
            onPress={handlePlayAgain}
            style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>Play again</Text>
            <IconSymbol name="arrow.clockwise" size={18} color={colors.background} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to Arena"
            onPress={() => { tapFeedback(); router.replace("/play"); }}
            style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Return to Arena</Text>
          </Pressable>
        </ScrollView>
      </ScreenContainer>
    );
  }

  const progressPercent = ((session.currentIndex + 1) / session.questions.length) * 100;

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top Header */}
        <View style={styles.topRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exit Who Am I"
            onPress={() => { tapFeedback(); router.back(); }}
            style={({ pressed }) => [styles.exitButton, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Text style={[styles.exitText, { color: colors.muted }]}>Exit</Text>
          </Pressable>
          <Text style={[styles.modeLabel, { color: colors.primary }]}>WHO AM I?</Text>
          <Text style={[styles.questionCount, { color: colors.foreground }]}>
            {session.currentIndex + 1}/{session.questions.length}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progressPercent}%` }]} />
        </View>

        {/* Clue Status & Potential Points Pill */}
        <View style={styles.statusRow}>
          <View style={[styles.badge, { backgroundColor: "#203957", borderColor: colors.primary }]}>
            <Text style={[styles.badgeText, { color: colors.primary }]}>
              CLUE {session.cluesRevealed} OF 3
            </Text>
          </View>
          <View style={[styles.pointsPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="sparkles" size={14} color={colors.warning} />
            <Text style={[styles.pointsText, { color: colors.warning }]}>
              +{currentPotentialPoints} pts
            </Text>
          </View>
        </View>

        {/* Question Title */}
        <View style={styles.titleBlock}>
          <Text style={[styles.headline, { color: colors.foreground }]}>Guess the Biblical Figure</Text>
          <Text style={[styles.subheadline, { color: colors.muted }]}>
            Each extra clue revealed lowers the round points. Guess early for max score!
          </Text>
        </View>

        {/* Clues Card Container */}
        <View style={styles.cluesContainer}>
          {currentQuestion.clues.slice(0, session.cluesRevealed).map((clue, index) => (
            <View
              key={index}
              style={[
                styles.clueCard,
                { backgroundColor: colors.surface, borderColor: index === session.cluesRevealed - 1 ? colors.primary : colors.border },
              ]}
            >
              <View style={styles.clueHeader}>
                <View style={[styles.clueDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.clueNumber, { color: colors.primary }]}>CLUE #{index + 1}</Text>
              </View>
              <Text style={[styles.clueText, { color: colors.foreground }]}>{clue}</Text>
            </View>
          ))}

          {/* Reveal Next Clue Action */}
          {!feedback && session.cluesRevealed < 3 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reveal next clue"
              onPress={handleRevealClue}
              style={({ pressed }) => [
                styles.revealButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.revealCopy}>
                <IconSymbol name="eye.fill" size={18} color={colors.primary} />
                <Text style={[styles.revealText, { color: colors.foreground }]}>
                  Need a hint? Reveal Clue #{session.cluesRevealed + 1}
                </Text>
              </View>
              <Text style={[styles.revealCost, { color: colors.muted }]}>-100 pts</Text>
            </Pressable>
          )}
        </View>

        {/* Character Selection Options */}
        <View style={styles.optionsBlock}>
          <Text style={[styles.optionsHeading, { color: colors.muted }]}>SELECT YOUR ANSWER</Text>
          <View style={styles.optionsGrid}>
            {currentQuestion.options.map((option, index) => {
              const letter = ["A", "B", "C", "D"][index];
              const isSelected = selectedOption === option;
              const isCorrectTarget = feedback && option.toLowerCase() === currentQuestion.person.toLowerCase();
              const isWrongSelected = feedback && !feedback.isCorrect && isSelected;

              let optionBg = colors.surface;
              let optionBorder = colors.border;
              if (isSelected && !feedback) {
                optionBg = "#203957";
                optionBorder = colors.primary;
              } else if (isCorrectTarget) {
                optionBg = "#173A35";
                optionBorder = colors.success;
              } else if (isWrongSelected) {
                optionBg = "#3D1E1E";
                optionBorder = colors.error;
              }

              return (
                <Pressable
                  key={option}
                  disabled={Boolean(feedback)}
                  accessibilityRole="button"
                  accessibilityLabel={`Option ${letter}: ${option}`}
                  onPress={() => {
                    tapFeedback();
                    setSelectedOption(option);
                  }}
                  style={({ pressed }) => [
                    styles.optionButton,
                    { backgroundColor: optionBg, borderColor: optionBorder },
                    pressed && !feedback && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.optionBadge,
                      {
                        backgroundColor: isSelected && !feedback ? colors.primary : colors.background,
                        borderColor: isSelected && !feedback ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionBadgeText,
                        { color: isSelected && !feedback ? colors.background : colors.foreground },
                      ]}
                    >
                      {letter}
                    </Text>
                  </View>
                  <Text style={[styles.optionName, { color: colors.foreground }]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Feedback Card or Submit Button */}
        {feedback ? (
          <View
            style={[
              styles.feedbackCard,
              {
                backgroundColor: feedback.isCorrect ? "#173A35" : colors.surface,
                borderColor: feedback.isCorrect ? colors.success : colors.border,
              },
            ]}
          >
            <View style={styles.feedbackHeader}>
              <IconSymbol
                name={feedback.isCorrect ? "checkmark.circle.fill" : "xmark.circle.fill"}
                size={22}
                color={feedback.isCorrect ? colors.success : colors.error}
              />
              <Text
                style={[
                  styles.feedbackTitle,
                  { color: feedback.isCorrect ? colors.success : colors.foreground },
                ]}
              >
                {feedback.isCorrect ? `Correct! It was ${feedback.person} (+${feedback.points} pts)` : `It was ${feedback.person}`}
              </Text>
            </View>
            <Text style={[styles.feedbackBody, { color: feedback.isCorrect ? "#D5F0E3" : colors.muted }]}>
              {feedback.explanation}
            </Text>
            <Text style={[styles.reference, { color: colors.primary }]}>{feedback.reference}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue to next round"
              onPress={handleContinue}
              style={({ pressed }) => [
                styles.continueButton,
                { backgroundColor: colors.primary },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.primaryButtonText, { color: colors.background }]}>
                {session.status === "complete" ? "See Results" : "Next Round"}
              </Text>
              <IconSymbol name="chevron.right" size={18} color={colors.background} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Submit Guess"
            disabled={!selectedOption}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              { backgroundColor: selectedOption ? colors.primary : colors.border },
              pressed && selectedOption && styles.pressed,
            ]}
          >
            <Text style={[styles.primaryButtonText, { color: selectedOption ? colors.background : colors.muted }]}>
              Submit Guess
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 14, paddingBottom: 40, gap: 16 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  exitButton: { borderWidth: 1, borderRadius: 11, paddingVertical: 7, paddingHorizontal: 12 },
  exitText: { fontSize: 12, fontWeight: "700" },
  modeLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.6 },
  questionCount: { fontSize: 13, fontWeight: "700" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { borderWidth: 1, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 9 },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  pointsPill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingVertical: 5, paddingHorizontal: 10 },
  pointsText: { fontSize: 12, fontWeight: "800" },
  titleBlock: { gap: 4 },
  headline: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  subheadline: { fontSize: 13, lineHeight: 18 },
  cluesContainer: { gap: 10 },
  clueCard: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 6 },
  clueHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  clueDot: { width: 6, height: 6, borderRadius: 3 },
  clueNumber: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  clueText: { fontSize: 15, fontWeight: "600", lineHeight: 22 },
  revealButton: { minHeight: 48, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  revealCopy: { flexDirection: "row", alignItems: "center", gap: 8 },
  revealText: { fontSize: 13, fontWeight: "700" },
  revealCost: { fontSize: 12, fontWeight: "800" },
  optionsBlock: { gap: 10, marginTop: 6 },
  optionsHeading: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  optionsGrid: { gap: 10 },
  optionButton: { minHeight: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  optionBadge: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  optionBadgeText: { fontSize: 13, fontWeight: "800" },
  optionName: { flex: 1, fontSize: 16, fontWeight: "700" },
  submitButton: { minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 6 },
  primaryButton: { minHeight: 52, borderRadius: 16, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  primaryButtonText: { fontSize: 14, fontWeight: "800" },
  secondaryButton: { minHeight: 52, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 14, fontWeight: "800" },
  continueButton: { minHeight: 48, borderRadius: 14, paddingHorizontal: 16, marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  feedbackCard: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8, marginTop: 6 },
  feedbackHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  feedbackTitle: { fontSize: 16, fontWeight: "800" },
  feedbackBody: { fontSize: 13, lineHeight: 19 },
  reference: { fontSize: 12, fontWeight: "800", marginTop: 2 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  resultContent: { paddingTop: 34, paddingBottom: 40, gap: 18 },
  resultIcon: { width: 68, height: 68, borderRadius: 24, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  resultEyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.7, textAlign: "center", marginTop: 8 },
  resultTitle: { fontSize: 32, fontWeight: "800", letterSpacing: -0.8, textAlign: "center" },
  resultSubtitle: { textAlign: "center", fontSize: 14, lineHeight: 21, marginTop: -6 },
  scoreCard: { borderRadius: 22, borderWidth: 1, padding: 20, alignItems: "center", marginTop: 6 },
  scoreLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  scoreValue: { fontSize: 52, lineHeight: 60, fontWeight: "800", marginTop: 4 },
  resultStats: { flexDirection: "row", width: "100%", justifyContent: "space-around", marginTop: 14 },
  resultStat: { alignItems: "center", gap: 4 },
  resultStatValue: { fontSize: 16, fontWeight: "800" },
  resultStatLabel: { fontSize: 11 },
});
