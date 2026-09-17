import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useProgression } from "@/lib/progression-provider";
import {
  calculateResult,
  createGameSession,
  getCurrentQuestion,
  submitAnswer,
  type AnswerFeedback,
  type GameResult,
  type GameSession,
} from "@/domain/game-engine";
import { getVerifiedQuestionsForMode, type GameMode } from "@/domain/questions";

const RESPONSE_WINDOW_MS = 20_000;

export default function BibleQuizScreen() {
  const colors = useColors();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const gameMode: GameMode = mode === "bible_or_myth" || mode === "word_puzzle" || mode === "daily_challenge" ? mode : "bible_quiz";
  const isBibleOrMyth = gameMode === "bible_or_myth";
  const isWordPuzzle = gameMode === "word_puzzle";
  const isDailyChallenge = gameMode === "daily_challenge";
  const { recordSession } = useProgression();
  const questions = useMemo(() => getVerifiedQuestionsForMode(gameMode, gameMode === "bible_quiz" ? 10 : 5), [gameMode]);
  const [session, setSession] = useState<GameSession>(() => createGameSession(questions, { mode: gameMode }));
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [remainingMs, setRemainingMs] = useState(RESPONSE_WINDOW_MS);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);

  useEffect(() => {
    if (result) void recordSession(result);
  }, [result, recordSession]);

  const question = getCurrentQuestion(session);

  const handleSubmit = (answerId: string | null) => {
    if (!question || feedback || result) return;
    const responseMs = Math.min(RESPONSE_WINDOW_MS, Math.max(0, Date.now() - questionStartedAt));
    const normalizedAnswer = isWordPuzzle ? answerId?.trim().toLowerCase() ?? null : answerId;
    const outcome = submitAnswer(session, normalizedAnswer, responseMs);
    setSession(outcome.session);
    setFeedback(outcome.feedback);
    if (outcome.session.status === "complete") setResult(calculateResult(outcome.session));
  };

  useEffect(() => {
    if (!question || feedback || result) return;
    const timer = setInterval(() => {
      const elapsed = Date.now() - questionStartedAt;
      const nextRemaining = Math.max(0, RESPONSE_WINDOW_MS - elapsed);
      setRemainingMs(nextRemaining);
      if (nextRemaining <= 0) {
        clearInterval(timer);
        handleSubmit(null);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [question?.id, questionStartedAt, feedback, result]);

  const continueToNext = () => {
    setFeedback(null);
    setSelectedAnswer(null);
    setTextAnswer("");
    setQuestionStartedAt(Date.now());
    setRemainingMs(RESPONSE_WINDOW_MS);
  };

  if (result) {
    return (
      <ScreenContainer className="px-5" containerClassName="bg-background">
        <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.resultIcon, { backgroundColor: colors.primary }]}>
            <IconSymbol name="trophy.fill" size={34} color={colors.background} />
          </View>
          <Text style={[styles.resultEyebrow, { color: colors.primary }]}>SESSION COMPLETE</Text>
          <Text style={[styles.resultTitle, { color: colors.foreground }]}>A strong finish.</Text>
          <Text style={[styles.resultSubtitle, { color: colors.muted }]}>Every answer is a step toward deeper knowledge.</Text>

          <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.scoreLabel, { color: colors.muted }]}>FINAL SCORE</Text>
            <Text style={[styles.scoreValue, { color: colors.foreground }]}>{result.score}</Text>
            <View style={styles.resultStats}>
              <View style={styles.resultStat}><Text style={[styles.resultStatValue, { color: colors.foreground }]}>{result.accuracy}%</Text><Text style={[styles.resultStatLabel, { color: colors.muted }]}>Accuracy</Text></View>
              <View style={styles.resultStat}><Text style={[styles.resultStatValue, { color: colors.foreground }]}>{result.correctAnswers}/{result.totalQuestions}</Text><Text style={[styles.resultStatLabel, { color: colors.muted }]}>Correct</Text></View>
              <View style={styles.resultStat}><Text style={[styles.resultStatValue, { color: colors.primary }]}>+{result.xpEarned}</Text><Text style={[styles.resultStatLabel, { color: colors.muted }]}>XP earned</Text></View>
            </View>
          </View>

          {feedback && (
            <View style={[styles.feedbackCard, { backgroundColor: feedback.isCorrect ? "#173A35" : colors.surface, borderColor: feedback.isCorrect ? colors.success : colors.border }]}>
              <Text style={[styles.feedbackTitle, { color: feedback.isCorrect ? colors.success : colors.foreground }]}>{feedback.isCorrect ? "You got it." : "Keep going."}</Text>
              <Text style={[styles.feedbackBody, { color: feedback.isCorrect ? "#D5F0E3" : colors.muted }]}>{feedback.explanation}</Text>
              <Text style={[styles.reference, { color: colors.primary }]}>{feedback.reference}</Text>
            </View>
          )}

          <Pressable accessibilityRole="button" accessibilityLabel="Return to play" onPress={() => router.replace("/play")} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
            <Text style={[styles.primaryButtonText, { color: colors.background }]}>Play again</Text>
            <IconSymbol name="chevron.right" size={18} color={colors.background} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Return to home" onPress={() => router.replace("/")} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border }, pressed && styles.pressed]}>
            <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>Back to home</Text>
          </Pressable>
        </ScrollView>
      </ScreenContainer>
    );
  }

  if (!question) return null;

  const questionNumber = session.currentIndex + 1;
  const progress = questionNumber / session.questions.length;
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Exit quiz" onPress={() => router.back()} style={({ pressed }) => [styles.exitButton, { borderColor: colors.border }, pressed && styles.pressed]}>
            <Text style={[styles.exitText, { color: colors.muted }]}>Exit</Text>
          </Pressable>
          <Text style={[styles.modeLabel, { color: colors.primary }]}>{isBibleOrMyth ? "BIBLE OR MYTH" : isWordPuzzle ? "WORD PUZZLE" : isDailyChallenge ? "DAILY CHALLENGE" : "BIBLE QUIZ"}</Text>
          <Text style={[styles.questionCount, { color: colors.muted }]}>{questionNumber}/{session.questions.length}</Text>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress * 100}%` }]} />
        </View>

        <View style={styles.timerRow}>
          <Text style={[styles.category, { color: colors.muted }]}>{question.category.toUpperCase()} · {question.difficulty.toUpperCase()}</Text>
          <View style={[styles.timerPill, { borderColor: seconds <= 5 ? colors.error : colors.border }]}>
            <View style={[styles.timerDot, { backgroundColor: seconds <= 5 ? colors.error : colors.primary }]} />
            <Text style={[styles.timerText, { color: seconds <= 5 ? colors.error : colors.foreground }]}>{seconds}s</Text>
          </View>
        </View>

        <View style={styles.questionBlock}>
          <Text style={[styles.questionTitle, { color: colors.foreground }]}>{question.prompt}</Text>
          <Text style={[styles.questionHint, { color: colors.muted }]}>{isWordPuzzle ? "Type the word you think the letters spell." : isBibleOrMyth ? "Classify the statement." : "Choose the best answer."}</Text>
        </View>

        {isWordPuzzle ? (
          <TextInput
            accessibilityLabel="Word puzzle answer"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Type your answer"
            placeholderTextColor={colors.muted}
            value={textAnswer}
            onChangeText={setTextAnswer}
            style={[styles.textAnswer, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
          />
        ) : (
          <View style={styles.options}>
            {question.options.map((option, index) => {
              const isSelected = selectedAnswer === option.id;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Answer ${option.label}`}
                  onPress={() => setSelectedAnswer(option.id)}
                  style={({ pressed }) => [styles.option, { backgroundColor: isSelected ? colors.primary : colors.surface, borderColor: isSelected ? colors.primary : colors.border }, pressed && styles.pressed]}
                >
                  <View style={[styles.optionLetter, { backgroundColor: colors.background, borderColor: isSelected ? colors.background : colors.border }]}>
                    <Text style={[styles.optionLetterText, { color: isSelected ? colors.primary : colors.muted }]}>{String.fromCharCode(65 + index)}</Text>
                  </View>
                  <Text style={[styles.optionText, { color: isSelected ? colors.background : colors.foreground }]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {feedback ? (
          <View style={[styles.feedbackCard, { backgroundColor: feedback.isCorrect ? "#173A35" : colors.surface, borderColor: feedback.isCorrect ? colors.success : colors.border }]}>
            <Text style={[styles.feedbackTitle, { color: feedback.isCorrect ? colors.success : colors.foreground }]}>{feedback.isCorrect ? `Correct · +${feedback.points}` : feedback.timedOut ? "Time's up" : "Not quite"}</Text>
            <Text style={[styles.feedbackBody, { color: feedback.isCorrect ? "#D5F0E3" : colors.muted }]}>{feedback.explanation}</Text>
            <Text style={[styles.reference, { color: colors.primary }]}>{feedback.reference}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Continue to next question" onPress={continueToNext} style={({ pressed }) => [styles.continueButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
              <Text style={[styles.primaryButtonText, { color: colors.background }]}>{session.status === "complete" ? "See results" : "Next question"}</Text>
              <IconSymbol name="chevron.right" size={18} color={colors.background} />
            </Pressable>
          </View>
        ) : (
          <Pressable accessibilityRole="button" accessibilityLabel="Submit answer" disabled={isWordPuzzle ? !textAnswer.trim() : !selectedAnswer} onPress={() => handleSubmit(isWordPuzzle ? textAnswer : selectedAnswer)} style={({ pressed }) => [styles.submitButton, { backgroundColor: (isWordPuzzle ? textAnswer.trim() : selectedAnswer) ? colors.primary : colors.border }, pressed && (isWordPuzzle ? textAnswer.trim() : selectedAnswer) && styles.pressed]}>
            <Text style={[styles.primaryButtonText, { color: selectedAnswer ? colors.background : colors.muted }]}>Submit answer</Text>
          </Pressable>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 14, paddingBottom: 38, gap: 20 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  exitButton: { borderWidth: 1, borderRadius: 11, paddingVertical: 8, paddingHorizontal: 11 },
  exitText: { fontSize: 12, fontWeight: "700" },
  modeLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1.6 },
  questionCount: { fontSize: 13, fontWeight: "700" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  timerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  category: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2 },
  timerPill: { borderWidth: 1, borderRadius: 11, paddingVertical: 7, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  timerDot: { width: 7, height: 7, borderRadius: 4 },
  timerText: { fontSize: 12, fontWeight: "800" },
  questionBlock: { marginTop: 12 },
  questionTitle: { fontSize: 28, fontWeight: "800", lineHeight: 36, letterSpacing: -0.6 },
  questionHint: { fontSize: 14, marginTop: 8 },
  options: { gap: 10 },
  textAnswer: { minHeight: 58, borderRadius: 17, borderWidth: 1, paddingHorizontal: 16, fontSize: 17, fontWeight: "700" },
  option: { minHeight: 66, borderRadius: 17, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  optionLetter: { width: 34, height: 34, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  optionLetterText: { fontSize: 13, fontWeight: "800" },
  optionText: { flex: 1, fontSize: 15, fontWeight: "700" },
  submitButton: { minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryButton: { minHeight: 54, borderRadius: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  primaryButtonText: { fontSize: 13, fontWeight: "800" },
  secondaryButton: { minHeight: 54, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 13, fontWeight: "800" },
  continueButton: { minHeight: 48, borderRadius: 14, paddingHorizontal: 15, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  feedbackCard: { borderRadius: 20, borderWidth: 1, padding: 17, gap: 7 },
  feedbackTitle: { fontSize: 17, fontWeight: "800" },
  feedbackBody: { fontSize: 13, lineHeight: 19 },
  reference: { fontSize: 12, fontWeight: "800", marginTop: 2 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  resultContent: { paddingTop: 34, paddingBottom: 38, gap: 18 },
  resultIcon: { width: 68, height: 68, borderRadius: 24, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  resultEyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.7, textAlign: "center", marginTop: 8 },
  resultTitle: { fontSize: 32, fontWeight: "800", letterSpacing: -0.8, textAlign: "center" },
  resultSubtitle: { textAlign: "center", fontSize: 14, lineHeight: 21, marginTop: -6 },
  scoreCard: { borderRadius: 24, borderWidth: 1, padding: 20, alignItems: "center", marginTop: 8 },
  scoreLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  scoreValue: { fontSize: 54, lineHeight: 62, fontWeight: "800", marginTop: 4 },
  resultStats: { flexDirection: "row", width: "100%", justifyContent: "space-around", marginTop: 14 },
  resultStat: { alignItems: "center", gap: 4 },
  resultStatValue: { fontSize: 16, fontWeight: "800" },
  resultStatLabel: { fontSize: 11 },
});
