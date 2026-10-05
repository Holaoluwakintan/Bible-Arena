import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<string, ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING: IconMapping = {
  "house.fill": "home",
  "play.fill": "play-arrow",
  "person.crop.circle.fill": "account-circle",
  "person.fill": "person",
  "gearshape.fill": "settings",
  "trophy.fill": "emoji-events",
  "flame.fill": "local-fire-department",
  "sparkles": "auto-awesome",
  "book.fill": "menu-book",
  "puzzlepiece.fill": "extension",
  "person.2.fill": "people",
  "chart.bar.fill": "bar-chart",
  "bolt.fill": "bolt",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "arrow.down.circle": "file-download",
  "trash": "delete-outline",
  "map.fill": "map",
  "lightbulb.fill": "lightbulb",
  "calendar": "event",
  "heart.fill": "favorite",
  "heart": "favorite-border",
  "list.number": "format-list-numbered",
  "star.fill": "star",
  "star": "star-border",
  "xmark": "close",
  "checkmark": "check",
  "checkmark.circle.fill": "check-circle",
  "xmark.circle.fill": "cancel",
  "clock": "schedule",
  "arrow.right": "arrow-forward",
  "arrow.clockwise": "refresh",
  "chevron.left": "chevron-left",
  "chevron.up": "keyboard-arrow-up",
  "chevron.down": "keyboard-arrow-down",
  "speaker.wave.2.fill": "volume-up",
  "speaker.slash.fill": "volume-off",
  "iphone.radiowaves": "vibration",
  "square.and.arrow.up": "ios-share",
  "target": "track-changes",
  "crown.fill": "workspace-premium",
  "shield.fill": "shield",
  "quote": "format-quote",
  "rosette": "military-tech",
  "globe": "public",
  "lock.fill": "lock",
  "envelope.fill": "mail",
  "chart.line": "insights",
  "infinity": "all-inclusive",
  "hand.raised.fill": "pan-tool",
  "flag.fill": "flag",
  "list.bullet": "list",
  "figure.walk": "directions-walk",
  "bell.fill": "notifications",
  "square.and.arrow.down": "file-download",
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: string;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const iconName = MAPPING[name] || "help-outline";
  return <MaterialIcons color={color} size={size} name={iconName} style={style} />;
}
