import { Colors, type ThemeColorPalette } from "@/lib/_core/theme";

/** Chever v2 uses one premium dark palette regardless of the device scheme. */
export function useColors(): ThemeColorPalette {
  return Colors.dark;
}
