import { router } from "expo-router";
import { useMemo, useState, useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { AI_DIFFICULTIES, getAiAnswer, type AiDifficulty } from "@/domain/ai-battle";
import { calculateResult, createGameSession, getCurrentQuestion, submitAnswer, type GameResult, type GameSession } from "@/domain/game-engine";
import { getVerifiedQuestions } from "@/domain/questions";
import { useProgression } from "@/lib/progression-provider";
import { calculateLevel } from "@/domain/progression";
import { shareGameResult } from "@/lib/share";

export default function AiBattleScreen() {
  const colors = useColors();
  const { recordSession, state } = useProgression();
  const progression = state.progression;
  const questions = useMemo(() => getVerifiedQuestions(5), []);
  const [difficulty, setDifficulty] = useState<AiDifficulty>("medium");
  const [started, setStarted] = useState(false);
  const [session, setSession] = useState<GameSession | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [aiScore, setAiScore] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const question = session ? getCurrentQuestion(session) : null;

  useEffect(() => { if (result) void recordSession(result); }, [result, recordSession]);

  const startBattle = () => {
    setSession(createGameSession(questions, { mode: "bible_quiz" }));
    setAiScore(0);
    setSelectedAnswer(null);
    setResult(null);
    setStarted(true);
  };

  const submit = () => {
    if (!session || !question || !selectedAnswer) return;
    const ai = getAiAnswer(question, difficulty, session.currentIndex);
    const outcome = submitAnswer(session, selectedAnswer, 4_000);
    setSession(outcome.session);
    setAiScore((score) => score + (ai.isCorrect ? 100 : 0));
    setSelectedAnswer(null);
    if (outcome.session.status === "complete") setResult(calculateResult(outcome.session));
  };

  if (!started || !session) {
    return (
      <ScreenContainer className="px-5" containerClassName="bg-background">
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to play" onPress={() => router.back()}><Text style={[styles.back, { color: colors.primary }]}>‹ Back to play</Text></Pressable>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>AI BATTLE</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Test your knowledge against a rival.</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>The opponent is deterministic, so every difficulty is predictable and fair.</Text>
          <View style={styles.difficultyList}>
            {(Object.keys(AI_DIFFICULTIES) as AiDifficulty[]).map((level) => {
              const profile = AI_DIFFICULTIES[level];
              const selected = level === difficulty;
              return <Pressable key={level} onPress={() => setDifficulty(level)} style={({ pressed }) => [styles.difficultyCard, { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }, pressed && styles.pressed]}>
                <View style={[styles.difficultyIcon, { backgroundColor: selected ? colors.background : "#243650" }]}><IconSymbol name="trophy.fill" size={20} color={selected ? colors.primary : colors.primary} /></View>
                <View style={styles.difficultyCopy}><Text style={[styles.difficultyTitle, { color: selected ? colors.background : colors.foreground }]}>{profile.label}</Text><Text style={[styles.difficultyMeta, { color: selected ? colors.background : colors.muted }]}>{level} · {Math.round(profile.accuracy * 100)}% accuracy target</Text></View>
                {selected && <Text style={[styles.check, { color: colors.background }]}>✓</Text>}
              </Pressable>;
            })}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Start AI battle" onPress={startBattle} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.primaryButtonText, { color: colors.background }]}>Start battle</Text><IconSymbol name="chevron.right" size={18} color={colors.background} /></Pressable>
        </ScrollView>
      </ScreenContainer>
    );
  }

  if (result) {
    return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.resultIcon, { backgroundColor: colors.primary }]}><IconSymbol name="trophy.fill" size={32} color={colors.background} /></View>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>BATTLE COMPLETE</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>{result.score >= aiScore ? "You held your ground." : "Your rival edged ahead."}</Text>
      <View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.scoreLine, { color: colors.foreground }]}>You <Text style={{ color: colors.primary }}>{result.score}</Text></Text><Text style={[styles.scoreLine, { color: colors.foreground }]}>AI <Text style={{ color: colors.muted }}>{aiScore}</Text></Text><Text style={[styles.resultMeta, { color: colors.muted }]}>{result.accuracy}% accuracy · +{result.xpEarned} XP</Text></View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Share your AI battle result"
        onPress={() => {
          void shareGameResult({
            modeName: `AI Battle (${AI_DIFFICULTIES[difficulty].label})`,
            score: result.score,
            accuracy: result.accuracy,
            streak: progression.currentStreak,
            level: calculateLevel(progression.totalXp),
          });
        }}
        style={({ pressed }) => [styles.shareButton, { backgroundColor: colors.surface, borderColor: colors.primary }, pressed && styles.pressed]}
      >
        <IconSymbol name="sparkles" size={18} color={colors.primary} />
        <Text style={[styles.shareButtonText, { color: colors.primary }]}>Share Result</Text>
      </Pressable>
      <Pressable onPress={startBattle} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.primaryButtonText, { color: colors.background }]}>Rematch</Text></Pressable>
    </ScrollView></ScreenContainer>;
  }

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.topRow}><Text style={[styles.eyebrow, { color: colors.primary }]}>AI BATTLE · {AI_DIFFICULTIES[difficulty].label.toUpperCase()}</Text><Text style={[styles.questionCount, { color: colors.muted }]}>{session.currentIndex + 1}/{session.questions.length}</Text></View>
    <View style={[styles.matchup, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.matchupName, { color: colors.foreground }]}>You {session.score}</Text><Text style={[styles.vs, { color: colors.primary }]}>VS</Text><Text style={[styles.matchupName, { color: colors.foreground }]}>AI {aiScore}</Text></View>
    {question && <><Text style={[styles.question, { color: colors.foreground }]}>{question.prompt}</Text><View style={styles.options}>{question.options.map((option, index) => { const selected = selectedAnswer === option.id; return <Pressable key={option.id} onPress={() => setSelectedAnswer(option.id)} style={({ pressed }) => [styles.option, { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border }, pressed && styles.pressed]}><View style={[styles.letter, { backgroundColor: colors.background }]}><Text style={[styles.letterText, { color: selected ? colors.primary : colors.muted }]}>{String.fromCharCode(65 + index)}</Text></View><Text style={[styles.optionText, { color: selected ? colors.background : colors.foreground }]}>{option.label}</Text></Pressable>; })}</View><Pressable disabled={!selectedAnswer} onPress={submit} style={({ pressed }) => [styles.primaryButton, { backgroundColor: selectedAnswer ? colors.primary : colors.border }, pressed && styles.pressed]}><Text style={[styles.primaryButtonText, { color: selectedAnswer ? colors.background : colors.muted }]}>Lock answer</Text></Pressable></>}
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 38, gap: 18 }, back: { fontSize: 13, fontWeight: "800" }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.7 }, title: { fontSize: 30, fontWeight: "800", lineHeight: 37, letterSpacing: -0.7 }, subtitle: { fontSize: 15, lineHeight: 22 }, difficultyList: { gap: 10, marginTop: 10 }, difficultyCard: { minHeight: 76, borderRadius: 19, borderWidth: 1, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 }, difficultyIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" }, difficultyCopy: { flex: 1 }, difficultyTitle: { fontSize: 15, fontWeight: "800" }, difficultyMeta: { fontSize: 12, marginTop: 4 }, check: { fontSize: 18, fontWeight: "800" }, primaryButton: { minHeight: 54, borderRadius: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, primaryButtonText: { fontSize: 13, fontWeight: "800" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] }, resultIcon: { width: 66, height: 66, borderRadius: 23, alignItems: "center", justifyContent: "center", alignSelf: "center" }, scoreCard: { borderRadius: 22, borderWidth: 1, padding: 20, gap: 10 }, scoreLine: { fontSize: 20, fontWeight: "800" }, resultMeta: { fontSize: 13, marginTop: 5 }, topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, questionCount: { fontSize: 13, fontWeight: "800" }, matchup: { borderRadius: 20, borderWidth: 1, padding: 16, flexDirection: "row", justifyContent: "space-around", alignItems: "center" }, matchupName: { fontSize: 17, fontWeight: "800" }, vs: { fontSize: 12, fontWeight: "900", letterSpacing: 1.4 }, question: { fontSize: 27, lineHeight: 35, fontWeight: "800", letterSpacing: -0.5, marginTop: 12 }, options: { gap: 10 }, option: { minHeight: 64, borderRadius: 17, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }, letter: { width: 33, height: 33, borderRadius: 10, alignItems: "center", justifyContent: "center" }, letterText: { fontSize: 13, fontWeight: "800" }, optionText: { flex: 1, fontSize: 15, fontWeight: "700" },
  shareButton: { minHeight: 52, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 10 },
  shareButtonText: { fontSize: 14, fontWeight: "800" },
});
