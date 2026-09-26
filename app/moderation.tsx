import { router } from "expo-router";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useProgression } from "@/lib/progression-provider";
import { trpc } from "@/lib/trpc";

export default function ModerationScreen() {
  const colors = useColors();
  const { isAuthenticated } = useProgression();
  const flags = trpc.moderation.openFlags.useQuery(undefined, { enabled: isAuthenticated });
  const resolve = trpc.moderation.resolve.useMutation({ onSuccess: () => void flags.refetch() });
  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}><Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text></Pressable>
    <Text style={[styles.eyebrow, { color: colors.primary }]}>MODERATION</Text>
    <Text style={[styles.title, { color: colors.foreground }]}>Review queue</Text>
    <Text style={[styles.subtitle, { color: colors.muted }]}>Only administrator accounts can view or resolve these reports.</Text>
    {!isAuthenticated ? <Text style={[styles.body, { color: colors.muted }]}>Sign in with an administrator account to continue.</Text> : flags.isLoading ? <Text style={[styles.body, { color: colors.muted }]}>Loading reports…</Text> : flags.error ? <Text style={[styles.error, { color: colors.error }]}>{flags.error.message}</Text> : !flags.data?.length ? <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Queue clear</Text><Text style={[styles.body, { color: colors.muted }]}>There are no open moderation flags.</Text></View> : flags.data.map((flag) => <View key={flag.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{flag.reason.replaceAll("_", " ")}</Text><Text style={[styles.body, { color: colors.muted }]}>Created {new Date(Number(flag.createdAt) * 1000).toLocaleString()}</Text><Text style={[styles.body, { color: colors.muted }]}>Match: {flag.matchId ?? "Not attached"}</Text><View style={styles.actions}><Pressable accessibilityRole="button" accessibilityLabel="Dismiss moderation report" disabled={resolve.isPending} onPress={() => resolve.mutate({ flagId: flag.id, status: "dismissed", reason: "Reviewed by administrator." })} style={[styles.action, { borderColor: colors.border }]}><Text style={[styles.actionText, { color: colors.muted }]}>Dismiss</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Action moderation report" disabled={resolve.isPending} onPress={() => { Alert.alert("Action recorded", "This flag will be marked for action."); resolve.mutate({ flagId: flag.id, status: "actioned", reason: "Action recorded by administrator." }); }} style={[styles.action, { backgroundColor: colors.primary, borderColor: colors.primary }]}><Text style={[styles.actionText, { color: colors.background }]}>Action</Text></Pressable></View></View>)}
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingTop: 18, paddingBottom: 38, gap: 16 }, back: { fontSize: 13, fontWeight: "800" }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.7 }, title: { fontSize: 30, fontWeight: "800" }, subtitle: { fontSize: 14, lineHeight: 20 }, body: { fontSize: 13, lineHeight: 20 }, error: { fontSize: 13 }, empty: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 8 }, card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8 }, cardTitle: { fontSize: 16, fontWeight: "800", textTransform: "capitalize" }, actions: { flexDirection: "row", gap: 10, marginTop: 8 }, action: { minHeight: 44, flex: 1, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" }, actionText: { fontSize: 12, fontWeight: "800" } });
