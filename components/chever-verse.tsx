import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { Card, Txt } from "@/components/ui/kit";
import { C, S } from "@/constants/design";
import { verseOfTheDay } from "@/domain/arena";
import { msUntilLagosMidnight } from "../web-v3/daily-verse.mjs";

export function CheverVerse() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      const timestamp = Date.now();
      setNow(timestamp);
      timer = setTimeout(refresh, msUntilLagosMidnight(timestamp));
    };
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") refresh(); });
    refresh();
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []);
  const verse = verseOfTheDay(now);
  return <Card>
    <Txt variant="overline" color={C.gold}>Verse of the day</Txt>
    <Txt variant="h3" style={{ fontWeight: "600", lineHeight: 26, marginTop: S.sm }}>{verse.text}</Txt>
    <Txt variant="smallStrong" color={C.muted} style={{ marginTop: S.md }}>{verse.ref} · KJV</Txt>
  </Card>;
}
