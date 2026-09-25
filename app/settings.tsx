import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { trpc } from "@/lib/trpc";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  scheduleDailyStreakReminder,
  cancelDailyStreakReminder,
} from "@/lib/notifications";

function toggleFeedback() {
  if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export default function SettingsScreen() {
  const colors = useColors();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const exportQuery = trpc.privacy.export.useQuery(undefined, { enabled: false });
  const deleteMutation = trpc.privacy.deleteAccount.useMutation({ onSuccess: () => router.replace("/onboarding") });

  useEffect(() => {
    void getNotificationPreferences().then((p) => {
      setNotificationsEnabled(p.dailyStreakReminder);
      setSoundEnabled(p.soundEnabled);
      setSettingsLoaded(true);
    });
  }, []);

  const handleToggleReminders = async (enabled: boolean) => {
    toggleFeedback();
    setNotificationsEnabled(enabled);
    if (enabled) {
      const scheduled = await scheduleDailyStreakReminder(20, 0);
      if (!scheduled) setNotificationsEnabled(false);
    } else {
      await cancelDailyStreakReminder();
    }
  };

  const handleToggleSound = async (enabled: boolean) => {
    toggleFeedback();
    setSoundEnabled(enabled);
    await saveNotificationPreferences({ soundEnabled: enabled });
    if (notificationsEnabled) await scheduleDailyStreakReminder(20, 0);
  };

  const exportData = async () => {
    const result = await exportQuery.refetch();
    if (result.data) await Share.share({ title: "Bible Arena data export", message: JSON.stringify(result.data, null, 2) });
  };

  const confirmDelete = () => {
    Alert.alert("Delete account?", "This permanently removes your cloud profile, progress, sessions, friendships, and match history.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete permanently", style: "destructive", onPress: () => deleteMutation.mutate() },
    ]);
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>SETTINGS</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Make it yours.</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Your preferences are saved on this device and apply to future reminders.</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Preferences</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: "#243650" }]}>
                <IconSymbol name="sparkles" size={19} color={colors.primary} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>Reminder sound</Text>
                <Text style={[styles.rowSubtitle, { color: colors.muted }]}>Play a sound with scheduled streak reminders</Text>
              </View>
              <Switch
                accessibilityLabel="Toggle reminder sound"
                value={soundEnabled}
                disabled={!settingsLoaded}
                onValueChange={handleToggleSound}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.foreground}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: "#243650" }]}>
                <IconSymbol name="flame.fill" size={19} color={colors.primary} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>Daily reminders</Text>
                <Text style={[styles.rowSubtitle, { color: colors.muted }]}>Protect your learning rhythm</Text>
              </View>
              <Switch
                accessibilityLabel="Toggle daily reminders"
                value={notificationsEnabled}
                onValueChange={handleToggleReminders}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.foreground}
              />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Review onboarding walkthrough"
              onPress={() => { toggleFeedback(); router.push("/onboarding"); }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={[styles.rowIcon, { backgroundColor: "#243650" }]}>
                <IconSymbol name="sparkles" size={19} color={colors.primary} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>Onboarding tour</Text>
                <Text style={[styles.rowSubtitle, { color: colors.muted }]}>Replay the 3-step interactive intro</Text>
              </View>
              <IconSymbol name="chevron.right" size={16} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Account</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: "#243650" }]}>
                <IconSymbol name="person.crop.circle.fill" size={19} color={colors.primary} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>Guest profile</Text>
                <Text style={[styles.rowSubtitle, { color: colors.muted }]}>Stored on this device for now</Text>
              </View>
              <Text style={[styles.status, { color: colors.success }]}>Active</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: "#243650" }]}>
                <IconSymbol name="chevron.left.forwardslash.chevron.right" size={18} color={colors.primary} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>Build foundation</Text>
                <Text style={[styles.rowSubtitle, { color: colors.muted }]}>Phase 1 · navigation and design system</Text>
              </View>
              <Text style={[styles.status, { color: colors.muted }]}>Ready</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable accessibilityRole="button" accessibilityLabel="Export my Bible Arena data" disabled={exportQuery.isFetching} onPress={exportData} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={[styles.rowIcon, { backgroundColor: "#243650" }]}><IconSymbol name="arrow.down.circle" size={19} color={colors.primary} /></View>
              <View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.foreground }]}>Export my data</Text><Text style={[styles.rowSubtitle, { color: colors.muted }]}>Share a copy of your account and progress data</Text></View>
              <Text style={[styles.status, { color: colors.primary }]}>{exportQuery.isFetching ? "Preparing…" : "Export"}</Text>
            </Pressable>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Pressable accessibilityRole="button" accessibilityLabel="Delete my Bible Arena account" disabled={deleteMutation.isPending} onPress={confirmDelete} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View style={[styles.rowIcon, { backgroundColor: "#3B2728" }]}><IconSymbol name="trash" size={19} color={colors.error} /></View>
              <View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.error }]}>Delete account</Text><Text style={[styles.rowSubtitle, { color: colors.muted }]}>Permanently remove your cloud data</Text></View>
              <Text style={[styles.status, { color: colors.error }]}>{deleteMutation.isPending ? "Deleting…" : "Delete"}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.footer, { color: colors.muted }]}>Bible Arena · Know the Word. Challenge the World.</Text>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 36, gap: 22 },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 2.2 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.7, marginTop: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 8 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  card: { borderRadius: 21, borderWidth: 1, paddingHorizontal: 15 },
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  rowCopy: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: "800" },
  rowSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  status: { fontSize: 11, fontWeight: "800" },
  divider: { height: 1 },
  footer: { textAlign: "center", fontSize: 11, lineHeight: 17, marginTop: 6 },
  pressed: { opacity: 0.8 },
});
