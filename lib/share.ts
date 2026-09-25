import { Share, Platform } from "react-native";
import * as Haptics from "expo-haptics";

import {
  type ShareResultOptions,
  generateShareMessage,
  getInspirationalVerse,
  INSPIRATIONAL_VERSES,
} from "../domain/share";

export * from "../domain/share";

export async function shareGameResult(options: ShareResultOptions): Promise<boolean> {
  if (Platform.OS !== "web") {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  const message = generateShareMessage(options);

  try {
    const result = await Share.share(
      {
        message,
        title: "My Bible Arena Result",
      },
      {
        dialogTitle: "Share your Bible Arena score",
      }
    );
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}
