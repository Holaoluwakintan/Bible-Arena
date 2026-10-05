import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Button, Card, FadeIn, Glow, IconBadge, Txt } from "@/components/ui/kit";
import { C, R, S } from "@/constants/design";
import { ARENA_CATEGORIES } from "@/domain/arena";
import { feedback } from "@/lib/feedback";
import { useProgression } from "@/lib/progression-provider";

const GOALS = [
  { xp: 150, label: "Casual", detail: "About 5 minutes a day" },
  { xp: 300, label: "Regular", detail: "About 10 minutes a day" },
  { xp: 600, label: "Serious", detail: "About 20 minutes a day" },
];

export default function OnboardingScreen() {
  const { state, completeOnboarding, setDisplayName, updateArena } = useProgression();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(state.displayName ?? "");
  const [goal, setGoal] = useState(state.arena?.dailyGoalXp ?? 300);

  const finish = (target: "play" | "home" | "profile") => {
    feedback.levelUp();
    if (name.trim()) setDisplayName(name);
    updateArena({ dailyGoalXp: goal });
    completeOnboarding();
    if (target === "play") router.replace({ pathname: "/quiz", params: { kind: "quick", r: String(Date.now()) } });
    else if (target === "profile") router.replace("/profile");
    else router.replace("/");
  };

  return (
    <ScreenContainer>
      <View style={styles.wrap}>
        <View style={styles.top}>
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => <View key={i} style={[styles.dot, i === step && styles.dotActive, i < step && { backgroundColor: C.goldDeep }]} />)}
          </View>
          {step < 2 ? (
            <Pressable accessibilityRole="button" onPress={() => finish("home")} hitSlop={10}><Txt variant="smallStrong" color={C.muted}>Skip</Txt></Pressable>
          ) : <View />}
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {step === 0 ? (
            <FadeIn key="s0" style={{ alignItems: "center" }}>
              <View style={styles.logoWrap}>
                <Glow from="#3A2A0E" to="#0E1526" accent={C.gold} radius={56} />
                <IconSymbol name="book.fill" size={58} color={C.gold} />
              </View>
              <Txt variant="overline" color={C.gold} style={{ marginTop: S.xxl }}>Welcome to</Txt>
              <Txt variant="display" style={{ fontSize: 40, lineHeight: 46, marginTop: 4 }}>Bible Arena</Txt>
              <Txt variant="h3" color={C.textDim} style={{ textAlign: "center", marginTop: S.md, fontWeight: "600" }}>Know the Word.{"\n"}Challenge the World.</Txt>
              <View style={styles.catStrip}>
                {ARENA_CATEGORIES.map((c) => <IconBadge key={c.id} icon={c.icon} color={c.color} tint={c.tint} size={46} radius={16} />)}
              </View>
              <Txt variant="body" color={C.muted} style={{ textAlign: "center", marginTop: S.lg, maxWidth: 320 }}>Over 300 questions across five categories, each with its verse and a short explanation. Learn something every round.</Txt>
            </FadeIn>
          ) : null}

          {step === 1 ? (
            <FadeIn key="s1">
              <Txt variant="h1">Let’s set you up</Txt>
              <Txt variant="body" color={C.muted} style={{ marginTop: 6 }}>Takes ten seconds. You can change these later.</Txt>
              <Txt variant="overline" color={C.muted} style={{ marginTop: S.xxl }}>Your name</Txt>
              <TextInput value={name} onChangeText={setName} placeholder="What should we call you?" placeholderTextColor={C.faint} maxLength={24} style={styles.input} accessibilityLabel="Your name" />
              <Txt variant="overline" color={C.muted} style={{ marginTop: S.xxl }}>Daily goal</Txt>
              <View style={{ gap: S.md, marginTop: S.md }}>
                {GOALS.map((g) => {
                  const active = g.xp === goal;
                  return (
                    <Pressable key={g.xp} accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => { feedback.tap(); setGoal(g.xp); }} style={[styles.goal, active && styles.goalActive]}>
                      <View style={[styles.radio, active && { borderColor: C.gold }]}>{active ? <View style={styles.radioDot} /> : null}</View>
                      <View style={{ flex: 1 }}>
                        <Txt variant="bodyStrong">{g.label}</Txt>
                        <Txt variant="caption" color={C.muted} style={{ fontWeight: "500" }}>{g.detail}</Txt>
                      </View>
                      <Txt variant="smallStrong" color={active ? C.gold : C.muted}>{g.xp} XP</Txt>
                    </Pressable>
                  );
                })}
              </View>
            </FadeIn>
          ) : null}

          {step === 2 ? (
            <FadeIn key="s2">
              <Txt variant="h1">How you grow</Txt>
              <Txt variant="body" color={C.muted} style={{ marginTop: 6 }}>Short rounds, real learning, a reason to come back.</Txt>
              <View style={{ gap: S.md, marginTop: S.xxl }}>
                {[
                  { icon: "flame.fill", color: C.flame, title: "Daily streak", text: "Play once a day to keep the flame burning." },
                  { icon: "bolt.fill", color: C.gold, title: "Combos", text: "3 right in a row is ×2 points. 6 in a row is ×3." },
                  { icon: "book.fill", color: "#60A5FA", title: "Learn every answer", text: "Each question shows the verse and a one-line explanation." },
                  { icon: "trophy.fill", color: C.violet, title: "Levels & badges", text: "30 levels, 24 badges, plus weekly rankings when you sign in." },
                ].map((item) => (
                  <Card key={item.title} style={styles.howRow}>
                    <IconBadge icon={item.icon} color={item.color} tint={`${item.color}22`} size={44} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="bodyStrong">{item.title}</Txt>
                      <Txt variant="small" color={C.muted}>{item.text}</Txt>
                    </View>
                  </Card>
                ))}
              </View>
            </FadeIn>
          ) : null}
        </ScrollView>

        <View style={{ gap: S.md }}>
          {step < 2 ? (
            <Button label={step === 0 ? "Get started" : "Continue"} iconRight="arrow.right" onPress={() => setStep((s) => s + 1)} />
          ) : (
            <>
              <Button label="Play my first round" icon="play.fill" onPress={() => finish("play")} />
              <Button label="I have an account · Sign in" variant="ghost" onPress={() => finish("profile")} />
            </>
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingBottom: S.xl },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: S.lg },
  dots: { flexDirection: "row", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  dotActive: { width: 24, backgroundColor: C.gold },
  body: { flexGrow: 1, justifyContent: "center", paddingVertical: S.xl },
  logoWrap: { width: 112, height: 112, borderRadius: 56, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.goldLine, overflow: "hidden" },
  catStrip: { flexDirection: "row", gap: S.sm, marginTop: S.xxl },
  input: { height: 56, borderRadius: R.lg, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface, color: C.text, paddingHorizontal: S.lg, fontSize: 17, fontWeight: "600", marginTop: S.md },
  goal: { flexDirection: "row", alignItems: "center", gap: S.md, padding: S.lg, borderRadius: R.lg, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.surface },
  goalActive: { borderColor: C.gold, backgroundColor: "rgba(245,185,66,0.07)" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.faint, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.gold },
  howRow: { flexDirection: "row", alignItems: "center", gap: S.md, padding: S.lg },
});
