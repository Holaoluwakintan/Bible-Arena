import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Card, Txt } from "@/components/ui/kit";
import { C, R, S } from "@/constants/design";
import { feedback } from "@/lib/feedback";

export const APK_PATH = "/download/bible-arena.apk";

type AppOffer = { show: boolean; android: boolean };

/** Web only: offer the Android app, except inside the installed app itself (it opens with ?app=android). */
export function useAndroidAppOffer(): AppOffer {
  const [offer, setOffer] = useState<AppOffer>({ show: false, android: false });
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    let inApp = false;
    try {
      inApp = window.localStorage.getItem("ba-in-app") === "1" || /[?&]app=android/.test(window.location.search) || (document.referrer || "").indexOf("android-app://") === 0;
      if (inApp) window.localStorage.setItem("ba-in-app", "1");
    } catch {}
    const android = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent || "");
    setOffer({ show: !inApp, android });
  }, []);
  return offer;
}

export function openApkDownload() {
  feedback.tap();
  if (typeof window !== "undefined") window.location.href = APK_PATH;
}

/** Home screen card, shown to Android browsers only. */
export function GetAndroidAppCard() {
  const { show, android } = useAndroidAppOffer();
  if (!show || !android) return null;
  return (
    <Card onPress={openApkDownload} accessibilityLabel="Get the Android app" style={styles.card}>
      <View style={styles.row}>
        <View style={styles.dot}><IconSymbol name="arrow.down.circle" size={22} color={C.ink} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="bodyStrong">Get the Android app</Txt>
          <Txt variant="small" color={C.muted}>Full screen, one tap from your home screen</Txt>
        </View>
        <IconSymbol name="chevron.right" size={20} color={C.faint} />
      </View>
    </Card>
  );
}

/** Profile preferences row, shown on the web (not inside the app). */
export function GetAndroidAppRow({ style }: { style?: any }) {
  const { show } = useAndroidAppOffer();
  if (!show) return null;
  return (
    <Pressable accessibilityRole="button" onPress={openApkDownload} style={style}>
      <IconSymbol name="arrow.down.circle" size={20} color={C.textDim} />
      <Txt variant="bodyStrong" style={{ flex: 1 }}>Get the Android app</Txt>
      <IconSymbol name="chevron.right" size={20} color={C.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderColor: "rgba(245,185,66,0.35)", borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: S.md },
  dot: { width: 40, height: 40, borderRadius: R.pill, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" },
});
