import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Button, Card, FadeIn, IconBadge, Pill, ProgressBar, Ring, Txt, useCountUp } from "@/components/ui/kit";
import { C, R, S } from "@/constants/design";
import {
  QUESTION_TYPE_LABEL, buildRound, comboMultiplier, correctAnswerLabel, dailyDoneToday, getCategory, isAnswerCorrect,
  normalizeArena, referenceLabel, scoreAnswer, shuffle, suggestNextCategory, todayKey, windowMsFor, type ArenaStats, type RoundKind,
} from "@/domain/arena";
import type { GameResult } from "@/domain/game-engine";
import { getLevelProgress, type UnlockedAchievement } from "@/domain/progression";
import { VERIFIED_BIBLE_OR_MYTH_QUESTIONS, VERIFIED_WORD_PUZZLE_QUESTIONS, type BibleQuestion, type GameMode, type QuestionCategory } from "@/domain/questions";
import { feedback } from "@/lib/feedback";
import { useProgression } from "@/lib/progression-provider";

type Kind = RoundKind | "myth" | "puzzle";
type Phase = "intro" | "play" | "feedback" | "done";

interface Attempt { question: BibleQuestion; answerId: string | null; correct: boolean; timedOut: boolean; ms: number; points: number; mult: number }

const LETTERS = ["A", "B", "C", "D"];
const useNative = Platform.OS !== "web";

function resolveKind(params: { kind?: string; mode?: string; category?: string }): Kind {
  const k = params.kind;
  if (k === "quick" || k === "category" || k === "survival" || k === "daily" || k === "myth" || k === "puzzle") return k === "category" && !getCategory(params.category) ? "quick" : k;
  if (params.mode === "daily_challenge") return "daily";
  if (params.mode === "bible_or_myth") return "myth";
  if (params.mode === "word_puzzle") return "puzzle";
  return params.category && getCategory(params.category) ? "category" : "quick";
}

function modeFor(kind: Kind): GameMode {
  return kind === "daily" ? "daily_challenge" : kind === "myth" ? "bible_or_myth" : kind === "puzzle" ? "word_puzzle" : "bible_quiz";
}

const KIND_META: Record<Kind, { title: string; icon: string; color: string; rules: string[] }> = {
  quick: { title: "Quick Round", icon: "bolt.fill", color: C.gold, rules: ["10 questions from every category", "Answer fast for a speed bonus", "3 in a row = ×2 combo, 6 in a row = ×3"] },
  category: { title: "Category Round", icon: "book.fill", color: C.gold, rules: ["10 questions, easy to hard", "New questions come first, so you keep growing", "Every right answer raises your mastery"] },
  survival: { title: "Survival", icon: "heart.fill", color: C.heart, rules: ["You have 3 hearts", "A wrong answer or timeout costs one", "Questions get harder the further you go"] },
  daily: { title: "Daily Challenge", icon: "calendar", color: C.gold, rules: ["7 questions, the same for everyone today", "One attempt: make it count", "+100 bonus XP when you finish"] },
  myth: { title: "Bible or Myth", icon: "sparkles", color: C.success, rules: ["Is the statement in the Bible, or a popular myth?", "Each answer shows the verse", "Combos still count"] },
  puzzle: { title: "Word Puzzle", icon: "puzzlepiece.fill", color: "#60A5FA", rules: ["Unscramble the Bible word", "Type your answer and check it", "30 seconds each"] },
};

function buildQuestions(kind: Kind, category: QuestionCategory | undefined, arena: ArenaStats): BibleQuestion[] {
  if (kind === "myth") return shuffle(VERIFIED_BIBLE_OR_MYTH_QUESTIONS).slice(0, 10);
  if (kind === "puzzle") return shuffle(VERIFIED_WORD_PUZZLE_QUESTIONS).slice(0, 8);
  return buildRound({ kind, category, stats: arena });
}

async function shareText(message: string) {
  try {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      const nav = navigator as Navigator & { share?: (d: { text: string; title?: string }) => Promise<void> };
      if (nav.share) { await nav.share({ text: message, title: "Bible Arena" }); return; }
      await navigator.clipboard?.writeText(message);
      return;
    }
    await Share.share({ message, title: "Bible Arena" });
  } catch { /* dismissed */ }
}

/** Tabs keep screens mounted, so remount the round whenever params change or the screen loses focus. */
export default function QuizRoute() {
  const params = useLocalSearchParams<{ kind?: string; mode?: string; category?: string; r?: string }>();
  const [generation, setGeneration] = useState(0);
  useFocusEffect(useCallback(() => () => setGeneration((g) => g + 1), []));
  return <QuizScreen key={`${params.kind ?? params.mode ?? "q"}-${params.category ?? ""}-${params.r ?? ""}-${generation}`} params={params} />;
}

function QuizScreen({ params }: { params: { kind?: string; mode?: string; category?: string } }) {
  const { state, recordSession } = useProgression();
  const arenaAtStart = useRef(normalizeArena(state.arena)).current;
  const kind = resolveKind(params);
  const category = kind === "category" ? (params.category as QuestionCategory) : undefined;
  const cat = getCategory(category);
  const meta = KIND_META[kind];
  const dailyLocked = kind === "daily" && dailyDoneToday(arenaAtStart);

  const [questions] = useState<BibleQuestion[]>(() => buildQuestions(kind, category, arenaAtStart));
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [streak, setStreak] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [selected, setSelected] = useState<string | null>(null);
  const [orderPicks, setOrderPicks] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);
  const [result, setResult] = useState<{ game: GameResult; bonus: number; levelBefore: number; xpBefore: number } | null>(null);

  const question = questions[index];
  const windowMs = question ? windowMsFor(question) : 20_000;
  const startedAt = useRef(Date.now());
  const timerAnim = useRef(new Animated.Value(1)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const pointsAnim = useRef(new Animated.Value(0)).current;
  const [lastPoints, setLastPoints] = useState(0);
  const sessionId = useRef(`arena-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).current;

  const displayOptions = useMemo(() => {
    if (!question) return [];
    if (question.type === "multiple_choice" || question.type === "fill_verse" || question.type === "who_said") return shuffle(question.options);
    return question.options;
  }, [question]);

  /* ---------- timer ---------- */
  useEffect(() => {
    if (phase !== "play" || !question) return;
    startedAt.current = Date.now();
    setRemaining(windowMs);
    timerAnim.setValue(1);
    Animated.timing(timerAnim, { toValue: 0, duration: windowMs, easing: Easing.linear, useNativeDriver: false }).start();
    const interval = setInterval(() => {
      const left = Math.max(0, windowMs - (Date.now() - startedAt.current));
      setRemaining(left);
      if (left <= 5_000 && left > 0) feedback.tick();
    }, 1000);
    const timeout = setTimeout(() => submit(null, true), windowMs);
    return () => { clearInterval(interval); clearTimeout(timeout); timerAnim.stopAnimation(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, index]);

  /* ---------- answering ---------- */
  const submit = useCallback((answer: string | null, timedOut = false) => {
    if (phase !== "play" || !question) return;
    timerAnim.stopAnimation();
    const ms = Math.min(windowMs, Date.now() - startedAt.current);
    const normalized = question.type === "unscramble" && answer !== null ? answer.trim().toLowerCase().replace(/\s+/g, " ") : answer;
    const correct = !timedOut && isAnswerCorrect(question, normalized);
    const nextStreak = correct ? streak + 1 : 0;
    const mult = correct ? comboMultiplier(nextStreak) : 1;
    const points = scoreAnswer(question, correct, ms, nextStreak);
    setSelected(answer);
    setStreak(nextStreak);
    setBestCombo((b) => Math.max(b, nextStreak));
    setScore((s0) => s0 + points);
    setAttempts((list) => [...list, { question, answerId: normalized, correct, timedOut, ms, points, mult }]);
    if (!correct && kind === "survival") setHearts((h) => h - 1);
    setPhase("feedback");
    if (correct) {
      feedback.correct(mult);
      setLastPoints(points);
      pop.setValue(0.92);
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: useNative }).start();
      pointsAnim.setValue(0);
      Animated.timing(pointsAnim, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }).start();
    } else {
      feedback.wrong();
      shake.setValue(0);
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: useNative }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: useNative }),
        Animated.timing(shake, { toValue: 0.6, duration: 60, useNativeDriver: useNative }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: useNative }),
      ]).start();
    }
  }, [phase, question, windowMs, streak, kind, timerAnim, pop, pointsAnim, shake]);

  /* ---------- finishing ---------- */
  const finish = useCallback(async (all: Attempt[]) => {
    const correctCount = all.filter((a) => a.correct).length;
    const total = all.length;
    const comboBonus = all.reduce((t, a) => t + (a.correct ? (a.mult - 1) * 20 : 0), 0);
    const perfect = total >= 5 && correctCount === total && kind !== "survival";
    const bonus = comboBonus + (perfect ? 100 : 0);
    const mode = modeFor(kind);
    const xpBefore = state.progression.totalXp;
    const game: GameResult = {
      sessionId, mode, score: all.reduce((t, a) => t + a.points, 0), totalQuestions: total, correctAnswers: correctCount,
      accuracy: total ? Math.round((correctCount / total) * 100) : 0,
      xpEarned: 50 + correctCount * 100 + bonus + (mode === "daily_challenge" ? 100 : 0),
      completedAt: Date.now(),
      answers: all.map((a) => ({ questionId: a.question.id, answerId: a.answerId })),
    };
    setResult({ game, bonus, levelBefore: getLevelProgress(xpBefore).level, xpBefore });
    setPhase("done");
    const best = all.reduce((acc, a) => { const run = a.correct ? acc.run + 1 : 0; return { run, best: Math.max(acc.best, run) }; }, { run: 0, best: 0 }).best;
    const newBadges = await recordSession(game, {
      bonusXp: bonus,
      kind: kind === "myth" || kind === "puzzle" ? undefined : kind,
      category,
      bestCombo: best,
      arena: (arena) => {
        const correctMap = { ...arena.correct };
        const seen = { ...arena.seen };
        let orderSolved = arena.orderSolved;
        for (const a of all) {
          seen[a.question.id] = (seen[a.question.id] ?? 0) + 1;
          if (a.correct) { correctMap[a.question.id] = (correctMap[a.question.id] ?? 0) + 1; if (a.question.type === "order_events") orderSolved += 1; }
        }
        const day = todayKey();
        return {
          ...arena, correct: correctMap, seen, orderSolved,
          bestCombo: Math.max(arena.bestCombo, best),
          perfectRounds: arena.perfectRounds + (perfect ? 1 : 0),
          survivalBest: kind === "survival" ? Math.max(arena.survivalBest, correctCount) : arena.survivalBest,
          ...(kind === "daily" ? { daily: { date: day, correct: correctCount, total, score: game.score }, dailyHistory: [...arena.dailyHistory.filter((d) => d !== day), day].slice(-60) } : {}),
        };
      },
    });
    setUnlocked(newBadges);
    if (getLevelProgress(xpBefore + 1).level < getLevelProgress(xpBefore + game.xpEarned).level) feedback.levelUp();
  }, [kind, category, recordSession, sessionId, state.progression.totalXp]);

  const next = useCallback(() => {
    const all = attempts;
    const outOfHearts = kind === "survival" && hearts <= 0;
    if (outOfHearts || index >= questions.length - 1) { void finish(all); return; }
    setIndex((i) => i + 1);
    setSelected(null);
    setOrderPicks([]);
    setText("");
    setPhase("play");
  }, [attempts, kind, hearts, index, questions.length, finish]);

  const exit = () => { if (router.canGoBack()) router.back(); else router.replace("/"); };
  const replay = () => {
    const p: Record<string, string> = { kind: kind === "daily" ? "quick" : kind, ...(category ? { category } : {}), r: String(Date.now()) };
    router.replace({ pathname: "/quiz", params: p });
  };

  /* ================= RENDER ================= */

  if (phase === "intro") {
    return (
      <ScreenContainer>
        <View style={styles.introWrap}>
          <View style={styles.topRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={exit} style={styles.closeBtn}><IconSymbol name="xmark" size={22} color={C.text} /></Pressable>
          </View>
          <FadeIn style={{ flex: 1, justifyContent: "center" }}>
            <View style={{ alignItems: "center" }}>
              <IconBadge icon={cat?.icon ?? meta.icon} color={cat?.color ?? meta.color} tint={cat?.tint ?? "rgba(245,185,66,0.14)"} size={84} radius={28} />
              <Txt variant="overline" color={cat?.color ?? meta.color} style={{ marginTop: S.xl }}>{cat ? "Category round" : "Get ready"}</Txt>
              <Txt variant="display" style={{ textAlign: "center", marginTop: 6 }}>{cat?.title ?? meta.title}</Txt>
              <Txt variant="body" color={C.muted} style={{ textAlign: "center", marginTop: 6 }}>{dailyLocked ? "You’ve already played today’s challenge." : kind === "survival" ? "Up to 60 questions" : `${questions.length} questions`}</Txt>
            </View>
            {!dailyLocked ? (
              <Card style={{ marginTop: S.xxl, gap: S.md }}>
                {meta.rules.map((rule) => (
                  <View key={rule} style={styles.ruleRow}>
                    <IconSymbol name="checkmark.circle.fill" size={18} color={cat?.color ?? meta.color} />
                    <Txt variant="small" color={C.textDim} style={{ flex: 1 }}>{rule}</Txt>
                  </View>
                ))}
              </Card>
            ) : null}
          </FadeIn>
          {dailyLocked ? (
            <View style={{ gap: S.md }}>
              <Button label="Play a Quick Round instead" onPress={() => router.replace({ pathname: "/quiz", params: { kind: "quick", r: String(Date.now()) } })} />
              <Button label="Back home" variant="secondary" onPress={() => router.replace("/")} />
            </View>
          ) : (
            <Button label="Start" iconRight="arrow.right" onPress={() => { feedback.tap(); setPhase("play"); }} color={cat?.color} />
          )}
        </View>
      </ScreenContainer>
    );
  }

  if (phase === "done" && result) {
    return <Results kind={kind} category={category} attempts={attempts} result={result} bestCombo={bestCombo} unlocked={unlocked} totalXp={state.progression.totalXp} arena={normalizeArena(state.arena)} prevSurvivalBest={arenaAtStart.survivalBest} onReplay={replay} onExit={() => router.replace("/")} />;
  }

  if (!question) return null;

  const answered = phase === "feedback";
  const last = attempts[attempts.length - 1];
  const mult = comboMultiplier(streak);
  const progressPct = kind === "survival" ? 0 : ((index + (answered ? 1 : 0)) / questions.length) * 100;
  const seconds = Math.ceil(remaining / 1000);
  const qCat = getCategory(question.category);
  const isTF = question.type === "true_false";
  const isOrder = question.type === "order_events";
  const isPuzzle = question.type === "unscramble";

  const optionState = (id: string): "idle" | "correct" | "wrong" | "dim" => {
    if (!answered) return "idle";
    if (id === question.correctAnswer) return "correct";
    if (id === selected) return "wrong";
    return "dim";
  };

  return (
    <ScreenContainer>
      <View style={styles.playTop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quit round" onPress={exit} style={styles.closeBtn}><IconSymbol name="xmark" size={22} color={C.text} /></Pressable>
        {kind === "survival" ? (
          <View style={styles.heartsRow}>
            {[0, 1, 2].map((i) => <IconSymbol key={i} name={i < hearts ? "heart.fill" : "heart"} size={22} color={i < hearts ? C.heart : C.faint} />)}
            <Txt variant="smallStrong" color={C.muted} style={{ marginLeft: 6 }}>#{index + 1}</Txt>
          </View>
        ) : (
          <View style={{ flex: 1 }}><ProgressBar value={progressPct} height={10} color={cat?.color ?? C.gold} animated /></View>
        )}
        <View style={styles.scoreBox}>
          <Txt variant="bodyStrong" color={C.gold}>{score.toLocaleString()}</Txt>
          {answered && last?.correct ? (
            <Animated.View pointerEvents="none" style={[styles.pointsFloat, { opacity: pointsAnim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }), transform: [{ translateY: pointsAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -26] }) }] }]}>
              <Txt variant="smallStrong" color={C.success}>+{lastPoints}</Txt>
            </Animated.View>
          ) : null}
        </View>
      </View>

      <View style={styles.timerTrack}>
        <Animated.View style={[styles.timerFill, { backgroundColor: seconds <= 5 && !answered ? C.error : C.gold, width: timerAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]} />
      </View>

      <ScrollView contentContainerStyle={styles.playContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.metaRow}>
          {qCat ? <Pill label={qCat.title} icon={qCat.icon} color={qCat.color} bg={qCat.tint} /> : null}
          <Pill label={question.difficulty} color={question.difficulty === "hard" ? C.error : question.difficulty === "medium" ? C.gold : C.success} />
          <View style={{ flex: 1 }} />
          {streak >= 3 ? (
            <Animated.View style={{ transform: [{ scale: pop }] }}>
              <Pill label={`×${mult} combo`} icon="flame.fill" color={C.ink} bg={C.flame} />
            </Animated.View>
          ) : !answered ? <Txt variant="smallStrong" color={seconds <= 5 ? C.error : C.muted}>{seconds}s</Txt> : null}
        </View>

        <FadeIn key={question.id} from={8}>
          <Txt variant="overline" color={C.muted}>{QUESTION_TYPE_LABEL[question.type] ?? "Question"}{kind !== "survival" ? ` · ${index + 1} of ${questions.length}` : ""}</Txt>
          <Txt variant={question.prompt.length > 110 ? "h3" : "h2"} style={{ marginTop: S.sm }}>{question.prompt}</Txt>
          {isOrder && !answered ? <Txt variant="small" color={C.muted} style={{ marginTop: 6 }}>Tap them in order, earliest first. Tap again to undo.</Txt> : null}
        </FadeIn>

        <Animated.View style={{ gap: S.md, marginTop: S.xl, transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-10, 10] }) }] }}>
          {isPuzzle ? (
            <View style={{ gap: S.md }}>
              <TextInput
                value={text}
                onChangeText={setText}
                editable={!answered}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="Type your answer"
                placeholderTextColor={C.faint}
                onSubmitEditing={() => text.trim() && submit(text)}
                style={[styles.input, answered && { borderColor: last?.correct ? C.success : C.error }]}
                accessibilityLabel="Your answer"
              />
              {answered && !last?.correct ? <Txt variant="bodyStrong" color={C.success}>Answer: {question.correctAnswer.toUpperCase()}</Txt> : null}
            </View>
          ) : isTF ? (
            <View style={styles.tfRow}>
              {displayOptions.map((option) => {
                const st = optionState(option.id);
                const positive = option.id === "true" || option.id === "bible";
                return (
                  <Pressable key={option.id} accessibilityRole="button" accessibilityLabel={option.label} disabled={answered} onPress={() => submit(option.id)}
                    style={({ pressed }) => [styles.tfBtn, st === "correct" && styles.optCorrect, st === "wrong" && styles.optWrong, st === "dim" && styles.optDim, pressed && styles.pressed]}>
                    <IconSymbol name={positive ? "checkmark" : "xmark"} size={28} color={st === "correct" ? C.success : st === "wrong" ? C.error : positive ? C.success : C.error} />
                    <Txt variant="h3">{option.label}</Txt>
                  </Pressable>
                );
              })}
            </View>
          ) : isOrder ? (
            displayOptions.map((option) => {
              const pickIndex = orderPicks.indexOf(option.id);
              const correctPos = question.correctAnswer.split(">").indexOf(option.id);
              const ok = answered && last?.correct;
              return (
                <Pressable key={option.id} accessibilityRole="button" accessibilityLabel={option.label} disabled={answered}
                  onPress={() => { feedback.tap(); setOrderPicks((picks) => picks.includes(option.id) ? picks.filter((p) => p !== option.id) : [...picks, option.id]); }}
                  style={({ pressed }) => [styles.option, pickIndex >= 0 && !answered && styles.optPicked, answered && (pickIndex === correctPos ? styles.optCorrect : styles.optWrong), pressed && styles.pressed]}>
                  <View style={[styles.letter, pickIndex >= 0 && { backgroundColor: C.gold, borderColor: C.gold }, answered && { backgroundColor: pickIndex === correctPos ? C.success : C.error, borderColor: "transparent" }]}>
                    <Txt variant="smallStrong" color={pickIndex >= 0 || answered ? C.ink : C.muted}>{answered ? correctPos + 1 : pickIndex >= 0 ? pickIndex + 1 : "·"}</Txt>
                  </View>
                  <Txt variant="bodyStrong" style={{ flex: 1 }}>{option.label}</Txt>
                  {answered && !ok ? <Txt variant="caption" color={C.muted}>you: {pickIndex + 1}</Txt> : null}
                </Pressable>
              );
            })
          ) : (
            displayOptions.map((option, i) => {
              const st = optionState(option.id);
              return (
                <Pressable key={option.id} accessibilityRole="button" accessibilityLabel={option.label} disabled={answered} onPress={() => submit(option.id)}
                  style={({ pressed }) => [styles.option, st === "correct" && styles.optCorrect, st === "wrong" && styles.optWrong, st === "dim" && styles.optDim, pressed && styles.pressed]}>
                  <View style={[styles.letter, st === "correct" && { backgroundColor: C.success, borderColor: C.success }, st === "wrong" && { backgroundColor: C.error, borderColor: C.error }]}>
                    {st === "correct" ? <IconSymbol name="checkmark" size={16} color={C.ink} /> : st === "wrong" ? <IconSymbol name="xmark" size={16} color={C.ink} /> : <Txt variant="smallStrong" color={C.muted}>{LETTERS[i]}</Txt>}
                  </View>
                  <Txt variant="bodyStrong" style={{ flex: 1 }}>{option.label}</Txt>
                </Pressable>
              );
            })
          )}
        </Animated.View>

        {answered && last ? (
          <FadeIn from={16}>
            <View style={[styles.explain, { borderColor: last.correct ? "rgba(52,211,153,0.35)" : "rgba(248,113,113,0.35)", backgroundColor: last.correct ? "rgba(52,211,153,0.08)" : "rgba(248,113,113,0.08)" }]}>
              <View style={styles.explainHead}>
                <IconSymbol name={last.correct ? "checkmark.circle.fill" : last.timedOut ? "clock" : "xmark.circle.fill"} size={22} color={last.correct ? C.success : C.error} />
                <Txt variant="h3" color={last.correct ? C.success : C.error} style={{ flex: 1 }}>
                  {last.correct ? (last.mult >= 3 ? "Unstoppable!" : last.mult === 2 ? "On fire!" : "Correct!") : last.timedOut ? "Time’s up" : "Not quite"}
                </Txt>
                {last.correct ? <Txt variant="bodyStrong" color={C.success}>+{last.points}{last.mult > 1 ? ` (×${last.mult})` : ""}</Txt> : kind === "survival" ? <Txt variant="smallStrong" color={C.heart}>−1 heart</Txt> : null}
              </View>
              {!last.correct && !isPuzzle ? <Txt variant="smallStrong" color={C.text} style={{ marginTop: S.sm }}>Answer: {correctAnswerLabel(question)}</Txt> : null}
              <Txt variant="body" color={C.textDim} style={{ marginTop: S.sm }}>{question.explanation}</Txt>
              <View style={styles.refRow}>
                <IconSymbol name="book.fill" size={14} color={C.gold} />
                <Txt variant="smallStrong" color={C.gold}>{referenceLabel(question)}</Txt>
              </View>
            </View>
          </FadeIn>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        {answered ? (
          <Button label={kind === "survival" && hearts <= 0 ? "See results" : index >= questions.length - 1 ? "See results" : "Continue"} iconRight="arrow.right" onPress={next} color={last?.correct ? C.success : undefined} />
        ) : isOrder ? (
          <View style={{ flexDirection: "row", gap: S.md }}>
            <Button label="Reset" variant="secondary" onPress={() => setOrderPicks([])} style={{ flex: 1 }} disabled={!orderPicks.length} />
            <Button label="Check order" onPress={() => submit(orderPicks.join(">"))} style={{ flex: 2 }} disabled={orderPicks.length !== question.options.length} />
          </View>
        ) : isPuzzle ? (
          <Button label="Check" onPress={() => submit(text)} disabled={!text.trim()} />
        ) : (
          <Txt variant="caption" color={C.faint} style={{ textAlign: "center" }}>{streak >= 1 ? `${streak} in a row${streak < 3 ? ` · ${3 - streak} more for ×2` : streak < 6 ? ` · ${6 - streak} more for ×3` : " · max combo"}` : "Answer quickly for a speed bonus"}</Txt>
        )}
      </View>
    </ScreenContainer>
  );
}

/* ================= RESULTS ================= */

function Results({ kind, category, attempts, result, bestCombo, unlocked, totalXp, arena, prevSurvivalBest, onReplay, onExit }: {
  kind: Kind; category?: QuestionCategory; attempts: Attempt[]; result: { game: GameResult; bonus: number; levelBefore: number; xpBefore: number };
  bestCombo: number; unlocked: UnlockedAchievement[]; totalXp: number; arena: ArenaStats; prevSurvivalBest: number; onReplay: () => void; onExit: () => void;
}) {
  const { game, bonus, levelBefore } = result;
  const shownScore = useCountUp(game.score, 1100);
  const level = getLevelProgress(totalXp);
  const leveledUp = level.level > levelBefore;
  const perfect = game.correctAnswers === game.totalQuestions && game.totalQuestions >= 5;
  const nextCat = suggestNextCategory(arena, category);
  const [showReview, setShowReview] = useState(false);
  const title = kind === "survival" ? (game.correctAnswers > prevSurvivalBest ? "New personal best!" : "You survived!") : perfect ? "Perfect round!" : game.accuracy >= 80 ? "Excellent!" : game.accuracy >= 50 ? "Good work!" : "Keep going!";
  const subtitle = kind === "survival" ? `${game.correctAnswers} correct before the hearts ran out` : perfect ? "Every answer right. That’s mastery." : game.accuracy >= 50 ? "You’re growing in the Word." : "Every miss is a verse learned.";
  const xpRows = [
    { label: "Correct answers", value: game.correctAnswers * 100 },
    { label: "Round complete", value: 50 },
    ...(bonus - (perfect && kind !== "survival" ? 100 : 0) > 0 ? [{ label: "Combo bonus", value: bonus - (perfect && kind !== "survival" ? 100 : 0) }] : []),
    ...(perfect && kind !== "survival" ? [{ label: "Perfect round", value: 100 }] : []),
    ...(kind === "daily" ? [{ label: "Daily Challenge", value: 100 }] : []),
  ];
  const share = () => shareText(`I scored ${game.score.toLocaleString()} in Bible Arena (${game.correctAnswers}/${game.totalQuestions} correct${bestCombo >= 3 ? `, ${bestCombo} in a row` : ""}). Can you beat me? https://bible-arena.onrender.com`);

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
        <FadeIn>
          <View style={{ alignItems: "center", paddingTop: S.xl }}>
            <IconBadge icon={perfect ? "crown.fill" : kind === "survival" ? "heart.fill" : "trophy.fill"} color={kind === "survival" ? C.heart : C.gold} tint={kind === "survival" ? "rgba(255,93,115,0.14)" : C.goldSoft} size={76} radius={38} />
            <Txt variant="display" style={{ marginTop: S.lg, textAlign: "center" }}>{title}</Txt>
            <Txt variant="body" color={C.muted} style={{ textAlign: "center", marginTop: 4 }}>{subtitle}</Txt>
          </View>
        </FadeIn>

        <FadeIn delay={80}>
          <Card glow={{ from: "#17233D", to: "#101827", accent: C.gold }}>
            <View style={styles.scoreRow}>
              <View style={{ flex: 1 }}>
                <Txt variant="overline" color={C.muted}>Score</Txt>
                <Txt variant="number" color={C.gold}>{shownScore.toLocaleString()}</Txt>
              </View>
              <Ring value={game.accuracy} size={86} stroke={8} color={game.accuracy >= 80 ? C.success : C.gold}>
                <Txt variant="h3" style={{ lineHeight: 22 }}>{game.accuracy}%</Txt>
                <Txt variant="caption" color={C.muted} style={{ fontSize: 10 }}>accuracy</Txt>
              </Ring>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.stat}><Txt variant="h3">{game.correctAnswers}/{game.totalQuestions}</Txt><Txt variant="caption" color={C.muted}>correct</Txt></View>
              <View style={styles.stat}><Txt variant="h3" color={C.flame}>{bestCombo}</Txt><Txt variant="caption" color={C.muted}>best streak</Txt></View>
              <View style={styles.stat}><Txt variant="h3" color={C.gold}>+{game.xpEarned}</Txt><Txt variant="caption" color={C.muted}>XP</Txt></View>
            </View>
          </Card>
        </FadeIn>

        {leveledUp ? (
          <FadeIn delay={140}>
            <Card accent={C.goldLine} glow={{ from: "#3A2A0E", to: "#1A1710", accent: C.gold }} style={{ alignItems: "center" }}>
              <Txt variant="overline" color={C.gold}>Level up</Txt>
              <Txt variant="h2" style={{ marginTop: 4 }}>Level {level.level} · {level.name}</Txt>
            </Card>
          </FadeIn>
        ) : null}

        <FadeIn delay={180}>
          <Card style={{ gap: S.md }}>
            <Txt variant="overline" color={C.muted}>XP earned</Txt>
            {xpRows.map((row) => (
              <View key={row.label} style={styles.xpRow}>
                <Txt variant="small" color={C.textDim}>{row.label}</Txt>
                <Txt variant="smallStrong" color={C.gold}>+{row.value}</Txt>
              </View>
            ))}
            <View style={{ marginTop: S.sm, gap: 6 }}>
              <View style={styles.xpRow}>
                <Txt variant="smallStrong">Level {level.level} · {level.name}</Txt>
                <Txt variant="caption" color={C.muted}>{level.next === null ? "Max" : `${level.toNext.toLocaleString()} XP to go`}</Txt>
              </View>
              <ProgressBar value={level.pct} />
            </View>
          </Card>
        </FadeIn>

        {unlocked.length ? (
          <FadeIn delay={220}>
            <Card accent="rgba(167,139,250,0.4)" style={{ gap: S.md }}>
              <Txt variant="overline" color={C.violet}>New badge{unlocked.length > 1 ? "s" : ""}</Txt>
              {unlocked.map((badge) => (
                <View key={badge.key} style={styles.badgeRow}>
                  <IconBadge icon={badge.icon} color={C.gold} tint={C.goldSoft} size={44} radius={22} />
                  <View style={{ flex: 1 }}>
                    <Txt variant="bodyStrong">{badge.name}</Txt>
                    <Txt variant="caption" color={C.muted} style={{ fontWeight: "500" }}>{badge.description}</Txt>
                  </View>
                </View>
              ))}
            </Card>
          </FadeIn>
        ) : null}

        <FadeIn delay={260}>
          <View style={{ gap: S.md }}>
            <Button label="One more round" icon="arrow.clockwise" onPress={onReplay} />
            {kind !== "myth" && kind !== "puzzle" ? (
              <Button label={`Next up: ${nextCat.title}`} variant="secondary" icon={nextCat.icon} onPress={() => router.replace({ pathname: "/quiz", params: { kind: "category", category: nextCat.id, r: String(Date.now()) } })} />
            ) : null}
            <View style={{ flexDirection: "row", gap: S.md }}>
              <Button label="Share" variant="secondary" icon="square.and.arrow.up" size="md" onPress={share} style={{ flex: 1 }} />
              <Button label="Home" variant="secondary" icon="house.fill" size="md" onPress={onExit} style={{ flex: 1 }} />
            </View>
          </View>
        </FadeIn>

        <Pressable accessibilityRole="button" onPress={() => setShowReview((v) => !v)} style={styles.reviewToggle}>
          <Txt variant="smallStrong" color={C.gold}>{showReview ? "Hide answers" : "Review your answers"}</Txt>
          <IconSymbol name={showReview ? "chevron.up" : "chevron.down"} size={20} color={C.gold} />
        </Pressable>
        {showReview ? attempts.map((a, i) => (
          <View key={`${a.question.id}-${i}`} style={styles.reviewItem}>
            <IconSymbol name={a.correct ? "checkmark.circle.fill" : "xmark.circle.fill"} size={20} color={a.correct ? C.success : C.error} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt variant="smallStrong">{a.question.prompt}</Txt>
              <Txt variant="caption" color={C.success}>{correctAnswerLabel(a.question)}</Txt>
              <Txt variant="caption" color={C.muted} style={{ fontWeight: "500" }}>{a.question.explanation} ({referenceLabel(a.question)})</Txt>
            </View>
          </View>
        )) : null}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  introWrap: { flex: 1, paddingBottom: S.xxl },
  topRow: { flexDirection: "row", paddingTop: S.md },
  closeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.hairline },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: S.md },
  playTop: { flexDirection: "row", alignItems: "center", gap: S.md, paddingTop: S.md },
  heartsRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  scoreBox: { minWidth: 56, alignItems: "flex-end" },
  pointsFloat: { position: "absolute", right: 0, top: -4 },
  timerTrack: { height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.07)", marginTop: S.md, overflow: "hidden" },
  timerFill: { height: 4, borderRadius: 2 },
  playContent: { paddingTop: S.lg, paddingBottom: S.xxl },
  metaRow: { flexDirection: "row", alignItems: "center", gap: S.sm, marginBottom: S.lg },
  option: { flexDirection: "row", alignItems: "center", gap: S.md, minHeight: 60, paddingHorizontal: S.lg, paddingVertical: 12, borderRadius: R.lg, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border },
  optCorrect: { borderColor: C.success, backgroundColor: "rgba(52,211,153,0.12)" },
  optWrong: { borderColor: C.error, backgroundColor: "rgba(248,113,113,0.12)" },
  optDim: { opacity: 0.5 },
  optPicked: { borderColor: C.gold, backgroundColor: "rgba(245,185,66,0.08)" },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  letter: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.border, backgroundColor: C.bg2 },
  tfRow: { flexDirection: "row", gap: S.md },
  tfBtn: { flex: 1, height: 120, borderRadius: R.xl, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.surface, borderWidth: 1.5, borderColor: C.border },
  input: { height: 58, borderRadius: R.lg, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface, color: C.text, paddingHorizontal: S.lg, fontSize: 20, fontWeight: "700", letterSpacing: 2 },
  explain: { marginTop: S.xl, padding: S.lg, borderRadius: R.lg, borderWidth: 1 },
  explainHead: { flexDirection: "row", alignItems: "center", gap: S.sm },
  refRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: S.md },
  bottomBar: { paddingTop: S.md, paddingBottom: S.lg, borderTopWidth: 1, borderTopColor: C.hairline, minHeight: 56, justifyContent: "center" },
  resultContent: { paddingBottom: 48, gap: S.xl },
  scoreRow: { flexDirection: "row", alignItems: "center" },
  statsRow: { flexDirection: "row", marginTop: S.xl, paddingTop: S.lg, borderTopWidth: 1, borderTopColor: C.hairline },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  xpRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: S.md },
  reviewToggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: S.sm },
  reviewItem: { flexDirection: "row", gap: S.md, padding: S.lg, backgroundColor: C.surface, borderRadius: R.lg, borderWidth: 1, borderColor: C.hairline },
});
