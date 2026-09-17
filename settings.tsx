import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

function toggleFeedback() {
  if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export default function SettingsScreen() {
  const colors = useColors();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>SETTINGS</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>Make it yours.</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Tune the experience now. Account sync and notification delivery come later.</Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Preferences</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}>
              <View style={[styles.rowIcon, { backgroundColor: "#243650" }]}>
                <IconSymbol name="sparkles" size={19} color={colors.primary} />
              </View>
              <View style={styles.rowCopy}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>Game sound</Text>
                <Text style={[styles.rowSubtitle, { color: colors.muted }]}>Feedback and session sounds</Text>
              </View>
              <Switch
                accessibilityLabel="Toggle game sound"
                value={soundEnabled}
                onValueChange={(value) => { toggleFeedback(); setSoundEnabled(value); }}
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
                onValueChange={(value) => { toggleFeedback(); setNotificationsEnabled(value); }}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.foreground}
              />
            </View>
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
});
