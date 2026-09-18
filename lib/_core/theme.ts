export const ThemeColors = {
  primary: { light: "#B7791F", dark: "#E3A94F" },
  background: { light: "#F7F1E6", dark: "#0C1726" },
  surface: { light: "#FFFDF8", dark: "#142438" },
  foreground: { light: "#182536", dark: "#F7F3EA" },
  muted: { light: "#6F756F", dark: "#9BA9B9" },
  border: { light: "#E7DDCD", dark: "#28405A" },
  success: { light: "#2F8F66", dark: "#59C28D" },
  warning: { light: "#B7791F", dark: "#F1C46D" },
  error: { light: "#B94A48", dark: "#F08080" },
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
