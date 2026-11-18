import { ScrollView } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { CheverVerse } from "@/components/chever-verse";
import { Txt } from "@/components/ui/kit";
import { C, S } from "@/constants/design";

export default function BibleScreen() {
  return <ScreenContainer>
    <ScrollView contentContainerStyle={{ padding: S.xl, gap: S.md }}>
      <Txt accessibilityRole="header" variant="h1">Bible</Txt>
      <Txt variant="body" color={C.muted}>Daily Scripture in the King James Version</Txt>
      <CheverVerse />
    </ScrollView>
  </ScreenContainer>;
}
