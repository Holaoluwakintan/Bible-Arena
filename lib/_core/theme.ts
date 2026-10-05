// Bible Arena v2 "Midnight & Gold": one premium dark palette for both schemes.
export const ThemeColors = {
  primary: { light: "#F5B942", dark: "#F5B942" },
  background: { light: "#0A1020", dark: "#0A1020" },
  surface: { light: "#121B2E", dark: "#121B2E" },
  foreground: { light: "#F6F1E7", dark: "#F6F1E7" },
  muted: { light: "#8E9AB0", dark: "#8E9AB0" },
  border: { light: "#22304A", dark: "#22304A" },
  success: { light: "#34D399", dark: "#34D399" },
  warning: { light: "#FBBF24", dark: "#FBBF24" },
  error: { light: "#F87171", dark: "#F87171" },
} as const;

export type ColorScheme = "light" | "dark";

export type ThemeColorPalette = {
  primary: string;
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  border: string;
  success: string;
  warning: string;
  error: string;
};

export const Colors: Record<ColorScheme, ThemeColorPalette> = {
  light: {
    primary: ThemeColors.primary.light,
    background: ThemeColors.background.light,
    surface: ThemeColors.surface.light,
    foreground: ThemeColors.foreground.light,
    muted: ThemeColors.muted.light,
    border: ThemeColors.border.light,
    success: ThemeColors.success.light,
    warning: ThemeColors.warning.light,
    error: ThemeColors.error.light,
  },
  dark: {
    primary: ThemeColors.primary.dark,
    background: ThemeColors.background.dark,
    surface: ThemeColors.surface.dark,
    foreground: ThemeColors.foreground.dark,
    muted: ThemeColors.muted.dark,
    border: ThemeColors.border.dark,
    success: ThemeColors.success.dark,
    warning: ThemeColors.warning.dark,
    error: ThemeColors.error.dark,
  },
};

export const SchemeColors = Colors;

export const Fonts = {
  regular: "System",
  medium: "System",
  bold: "System",
};
