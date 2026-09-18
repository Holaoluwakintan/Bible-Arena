import { PlatformPressable } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import type { ComponentProps } from "react";

export function HapticTab(props: ComponentProps<typeof PlatformPressable>) {
  return (
    <PlatformPressable
      {...props}
      onPressIn={(ev) => {
        if (Platform.OS !== "web") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        props.onPressIn?.(ev);
      }}
    />
  );
}
