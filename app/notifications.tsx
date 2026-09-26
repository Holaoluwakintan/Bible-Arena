import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useProgression } from "@/lib/progression-provider";
import { trpc } from "@/lib/trpc";

export default function NotificationsScreen() {
  const colors = useColors();
  const { isAuthenticated } = useProgression();
  const query = trpc.notifications.list.useQuery(undefined, { enabled: isAuthenticated });
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => void query.refetch() });
  const notifications = query.data ?? [];
  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}><Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text></Pressable>
    <Text style={[styles.eyebrow, { color: colors.primary }]}>INBOX</Text>
    <View style={styles.headerRow}><View><Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text><Text style={[styles.subtitle, { color: colors.muted }]}>Your challenges, fellowship, and learning updates.</Text></View>{notifications.some((item) => item.unread) && <Pressable accessibilityRole="button" accessibilityLabel="Mark all notifications as read" onPress={() => markRead.mutate({})}><Text style={[styles.markAll, { color: colors.primary }]}>Mark all read</Text></Pressable>}</View>
    {!isAuthenticated ? <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sign in to use your inbox</Text><Text style={[styles.emptyBody, { color: colors.muted }]}>Your notifications follow your account across devices.</Text></View> : query.isLoading ? <Text style={[styles.emptyBody, { color: colors.muted }]}>Loading inbox…</Text> : notifications.length === 0 ? <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.emptyTitle, { color: colors.foreground }]}>You’re all caught up</Text><Text style={[styles.emptyBody, { color: colors.muted }]}>Friend requests and challenge updates will appear here.</Text></View> : notifications.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}${item.unread ? ', unread' : ''}`} onPress={() => item.unread && markRead.mutate({ ids: [item.id] })} style={[styles.card, { backgroundColor: item.unread ? "#203957" : colors.surface, borderColor: item.unread ? colors.primary : colors.border }]}><View style={styles.row}><View style={[styles.dot, { backgroundColor: item.unread ? colors.primary : colors.border }]} /><View style={styles.copy}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text><Text style={[styles.cardBody, { color: colors.muted }]}>{item.body}</Text></View></View></Pressable>)}
  </ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({ content: { paddingTop: 18, paddingBottom: 38, gap: 16 }, back: { fontSize: 13, fontWeight: "800" }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.7 }, headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }, title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.7 }, subtitle: { fontSize: 14, lineHeight: 20, marginTop: 7 }, markAll: { fontSize: 12, fontWeight: "800", paddingVertical: 8 }, card: { borderRadius: 18, borderWidth: 1, padding: 15 }, row: { flexDirection: "row", gap: 12, alignItems: "flex-start" }, dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 }, copy: { flex: 1, gap: 5 }, cardTitle: { fontSize: 15, fontWeight: "800" }, cardBody: { fontSize: 13, lineHeight: 19 }, emptyCard: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 8 }, emptyTitle: { fontSize: 17, fontWeight: "800" }, emptyBody: { fontSize: 13, lineHeight: 20 } });
