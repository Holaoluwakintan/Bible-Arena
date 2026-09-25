import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useProgression } from "@/lib/progression-provider";
import { trpc } from "@/lib/trpc";

export default function ChallengesScreen() {
  const colors = useColors();
  const { state, createChallenge, joinChallenge, isAuthenticated } = useProgression();
  const remoteChallenges = trpc.challenges.list.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000 });
  const [code, setCode] = useState("");
  const [latestCode, setLatestCode] = useState<string | null>(null);

  const create = async () => {
    const challenge = await createChallenge("bible_quiz");
    setLatestCode(challenge.shareCode);
  };

  const join = async () => {
    try {
      await joinChallenge(code, "Friend Player");
      setCode("");
      Alert.alert("Challenge joined", "This local preview marked the challenge as completed. Cross-device challenge sync comes with accounts and a server boundary.");
    } catch (error) {
      Alert.alert("Could not join", error instanceof Error ? error.message : "Check the code and try again.");
    }
  };

  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={[styles.back, { color: colors.primary }]}>‹ Back to play</Text></Pressable>
    <Text style={[styles.eyebrow, { color: colors.primary }]}>FRIEND CHALLENGES</Text>
    <Text style={[styles.title, { color: colors.foreground }]}>Make knowledge social.</Text>
    <Text style={[styles.subtitle, { color: colors.muted }]}>Create a share code for a friend or join one on this device.</Text>
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: "#243650" }]}><IconSymbol name="person.2.fill" size={22} color={colors.primary} /></View>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>Create a Bible Quiz challenge</Text>
      <Text style={[styles.cardBody, { color: colors.muted }]}>The code is deterministic and expires after seven days.</Text>
      <Pressable onPress={create} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.primaryText, { color: colors.background }]}>Create share code</Text></Pressable>
      {latestCode && <View style={[styles.codeBox, { borderColor: colors.primary }]}><Text style={[styles.codeLabel, { color: colors.muted }]}>SHARE CODE</Text><Text style={[styles.code, { color: colors.primary }]}>{latestCode}</Text></View>}
    </View>
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.foreground }]}>Join a challenge</Text>
      <TextInput accessibilityLabel="Challenge share code" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="Enter 6-digit code" placeholderTextColor={colors.muted} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} />
      <Pressable disabled={!code.trim()} onPress={join} style={({ pressed }) => [styles.primaryButton, { backgroundColor: code.trim() ? colors.primary : colors.border }, pressed && styles.pressed]}><Text style={[styles.primaryText, { color: code.trim() ? colors.background : colors.muted }]}>Join challenge</Text></Pressable>
    </View>
    <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your local challenges</Text>
    {state.challenges.length === 0 && !remoteChallenges.data?.length ? <Text style={[styles.empty, { color: colors.muted }]}>No challenges yet. Create one to get started.</Text> : <>{state.challenges.map((challenge) => <View key={`local-${challenge.id}`} style={[styles.challengeRow, { borderColor: colors.border }]}><Text style={[styles.challengeCode, { color: colors.primary }]}>{challenge.shareCode}</Text><Text style={[styles.challengeStatus, { color: colors.muted }]}>local · {challenge.status}</Text></View>)}{remoteChallenges.data?.map((challenge) => <View key={`remote-${challenge.id}`} style={[styles.challengeRow, { borderColor: colors.border }]}><Text style={[styles.challengeCode, { color: colors.primary }]}>{challenge.shareCode}</Text><Text style={[styles.challengeStatus, { color: colors.success }]}>synced · {challenge.status}</Text></View>)}</>}
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingTop: 18, paddingBottom: 38, gap: 17 }, back: { fontSize: 13, fontWeight: "800" }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.7 }, title: { fontSize: 30, fontWeight: "800", lineHeight: 37, letterSpacing: -0.7 }, subtitle: { fontSize: 15, lineHeight: 22 }, card: { borderRadius: 22, borderWidth: 1, padding: 17, gap: 10 }, icon: { width: 46, height: 46, borderRadius: 15, alignItems: "center", justifyContent: "center" }, cardTitle: { fontSize: 17, fontWeight: "800" }, cardBody: { fontSize: 13, lineHeight: 19 }, primaryButton: { minHeight: 50, borderRadius: 15, paddingHorizontal: 15, alignItems: "center", justifyContent: "center", marginTop: 6 }, primaryText: { fontSize: 13, fontWeight: "800" }, codeBox: { borderWidth: 1, borderRadius: 15, padding: 14, alignItems: "center", marginTop: 4 }, codeLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4 }, code: { fontSize: 30, fontWeight: "900", letterSpacing: 5, marginTop: 5 }, input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, letterSpacing: 2 }, sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: 5 }, empty: { fontSize: 13, lineHeight: 20 }, challengeRow: { minHeight: 52, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, challengeCode: { fontSize: 16, fontWeight: "900", letterSpacing: 3 }, challengeStatus: { fontSize: 12, textTransform: "capitalize" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});
