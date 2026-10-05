import { Colors, type ThemeColorPalette } from "@/lib/_core/theme";

/** Bible Arena v2 uses one premium dark palette regardless of the device scheme. */
export function useColors(): ThemeColorPalette {
  return Colors.dark;
}
