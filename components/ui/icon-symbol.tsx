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
