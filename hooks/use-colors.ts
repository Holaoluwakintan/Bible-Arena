import { useColorScheme } from "react-native";
import { Colors, type ThemeColorPalette } from "@/lib/_core/theme";

export function useColors(): ThemeColorPalette {
  const scheme = useColorScheme() ?? "dark";
  return Colors[scheme] ?? Colors.dark;
}
