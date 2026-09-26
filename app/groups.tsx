import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useProgression } from "@/lib/progression-provider";
import { trpc } from "@/lib/trpc";

export default function GroupsScreen() {
  const colors = useColors();
  const { isAuthenticated } = useProgression();
  const groups = trpc.groups.list.useQuery(undefined, { enabled: isAuthenticated });
  const create = trpc.groups.create.useMutation({ onSuccess: () => { setName(""); void groups.refetch(); } });
  const join = trpc.groups.join.useMutation({ onSuccess: (group) => { setCode(""); void groups.refetch(); Alert.alert("Joined fellowship", `${group.name} is now in your groups.`); } });
  const leave = trpc.groups.leave.useMutation({ onSuccess: () => void groups.refetch() });
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}><Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text></Pressable>
    <Text style={[styles.eyebrow, { color: colors.primary }]}>FELLOWSHIP CIRCLES</Text>
    <Text style={[styles.title, { color: colors.foreground }]}>Learn together.</Text>
    <Text style={[styles.subtitle, { color: colors.muted }]}>Create a private circle for your church, small group, or friends.</Text>
    {!isAuthenticated ? <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Sign in to create a group</Text><Text style={[styles.cardBody, { color: colors.muted }]}>Groups are account-based so membership and leaderboards stay private.</Text></View> : <>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Create a fellowship</Text><TextInput accessibilityLabel="Fellowship group name" value={name} onChangeText={setName} maxLength={60} placeholder="e.g. Sunday youth group" placeholderTextColor={colors.muted} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} /><Pressable accessibilityRole="button" accessibilityLabel="Create fellowship group" disabled={!name.trim() || create.isPending} onPress={() => create.mutate({ name: name.trim(), privacy: "invite_only" })} style={({ pressed }) => [styles.primary, { backgroundColor: name.trim() ? colors.primary : colors.border }, pressed && styles.pressed]}><Text style={[styles.primaryText, { color: name.trim() ? colors.background : colors.muted }]}>{create.isPending ? "Creating…" : "Create group"}</Text></Pressable>{create.error && <Text style={[styles.error, { color: colors.error }]}>{create.error.message}</Text>}</View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Join with an invite code</Text><TextInput accessibilityLabel="Six-digit fellowship invite code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="Enter six-digit code" placeholderTextColor={colors.muted} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} /><Pressable accessibilityRole="button" accessibilityLabel="Join fellowship group" disabled={code.length !== 6 || join.isPending} onPress={() => join.mutate({ inviteCode: code })} style={({ pressed }) => [styles.primary, { backgroundColor: code.length === 6 ? colors.primary : colors.border }, pressed && styles.pressed]}><Text style={[styles.primaryText, { color: code.length === 6 ? colors.background : colors.muted }]}>{join.isPending ? "Joining…" : "Join group"}</Text></Pressable>{join.error && <Text style={[styles.error, { color: colors.error }]}>{join.error.message}</Text>}</View>
      <Text style={[styles.section, { color: colors.foreground }]}>Your fellowships</Text>
      {groups.isLoading ? <Text style={[styles.cardBody, { color: colors.muted }]}>Loading groups…</Text> : !groups.data?.length ? <Text style={[styles.cardBody, { color: colors.muted }]}>No groups yet. Create one or use an invite code.</Text> : groups.data.map((group) => <View key={group.id} style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.groupCopy}><Text style={[styles.groupTitle, { color: colors.foreground }]}>{group.name}</Text><Text style={[styles.cardBody, { color: colors.muted }]}>{group.memberCount} members · {group.role}</Text><Text style={[styles.code, { color: colors.primary }]}>Invite code {group.inviteCode}</Text></View>{group.role !== "owner" && <Pressable accessibilityRole="button" accessibilityLabel={`Leave ${group.name}`} onPress={() => leave.mutate({ groupId: group.id })}><Text style={[styles.leave, { color: colors.error }]}>Leave</Text></Pressable>}</View>)}
    </>}
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingTop: 18, paddingBottom: 38, gap: 16 }, back: { fontSize: 13, fontWeight: "800" }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.7 }, title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.7 }, subtitle: { fontSize: 15, lineHeight: 22 }, card: { borderRadius: 20, borderWidth: 1, padding: 17, gap: 10 }, cardTitle: { fontSize: 17, fontWeight: "800" }, cardBody: { fontSize: 13, lineHeight: 20 }, input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 16 }, primary: { minHeight: 50, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 15 }, primaryText: { fontSize: 13, fontWeight: "800" }, error: { fontSize: 12 }, section: { fontSize: 19, fontWeight: "800", marginTop: 4 }, group: { borderRadius: 18, borderWidth: 1, padding: 15, flexDirection: "row", alignItems: "center", gap: 10 }, groupCopy: { flex: 1, gap: 4 }, groupTitle: { fontSize: 16, fontWeight: "800" }, code: { fontSize: 12, fontWeight: "800", marginTop: 3 }, leave: { fontSize: 12, fontWeight: "800", padding: 8 }, pressed: { opacity: 0.78 } });
