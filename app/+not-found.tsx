import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

export default function NotFoundScreen() {
  const colors = useColors();
  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <View style={styles.content}>
        <Text style={[styles.code, { color: colors.primary }]}>404</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>That page is not in the Arena.</Text>
        <Text style={[styles.body, { color: colors.muted }]}>The link may be outdated or the page may have moved.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Return to Bible Arena home" onPress={() => router.replace("/")} style={[styles.button, { backgroundColor: colors.primary }]}>
          <Text style={[styles.buttonText, { color: colors.background }]}>Return home</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  code: { fontSize: 64, fontWeight: "900" },
  title: { fontSize: 26, lineHeight: 33, fontWeight: "800", textAlign: "center" },
  body: { fontSize: 15, lineHeight: 22, textAlign: "center", maxWidth: 320 },
  button: { minHeight: 52, borderRadius: 15, paddingHorizontal: 22, alignItems: "center", justifyContent: "center", marginTop: 8 },
  buttonText: { fontSize: 14, fontWeight: "800" },
});
