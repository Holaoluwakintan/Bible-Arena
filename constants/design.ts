import { Platform, type TextStyle } from "react-native";

/** Bible Arena v2 design tokens — "Midnight & Gold". */
export const C = {
  bg: "#0A1020",
  bg2: "#0D1526",
  surface: "#121B2E",
  surface2: "#17223A",
  raised: "#1C2945",
  border: "#22304A",
  hairline: "rgba(255,255,255,0.07)",
  text: "#F6F1E7",
  textDim: "#C8CFDC",
  muted: "#8E9AB0",
  faint: "#5D6982",
  gold: "#F5B942",
  goldDeep: "#D99A2B",
  goldSoft: "rgba(245,185,66,0.14)",
  goldLine: "rgba(245,185,66,0.35)",
  success: "#34D399",
  successSoft: "rgba(52,211,153,0.14)",
  error: "#F87171",
  errorSoft: "rgba(248,113,113,0.14)",
  flame: "#FF8A3D",
  heart: "#FF5D73",
  violet: "#A78BFA",
  ink: "#0A1020",
} as const;

export const S = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 44 } as const;
export const R = { sm: 10, md: 14, lg: 18, xl: 24, xxl: 30, pill: 999 } as const;
export const PAGE_X = 20;

export const FONT_FAMILY = Platform.select({
  web: '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  default: undefined,
});

const base = (size: number, line: number, weight: TextStyle["fontWeight"], extra: TextStyle = {}): TextStyle => ({
  fontSize: size, lineHeight: line, fontWeight: weight, ...(FONT_FAMILY ? { fontFamily: FONT_FAMILY } : {}), ...extra,
});

export const T = {
  display: base(34, 40, "800", { letterSpacing: -1 }),
  h1: base(28, 34, "800", { letterSpacing: -0.7 }),
  h2: base(22, 28, "800", { letterSpacing: -0.4 }),
  h3: base(18, 24, "700", { letterSpacing: -0.2 }),
  body: base(15, 22, "500"),
  bodyStrong: base(15, 22, "700"),
  small: base(13, 18, "500"),
  smallStrong: base(13, 18, "700"),
  caption: base(12, 16, "600"),
  overline: base(11, 14, "800", { letterSpacing: 1.6, textTransform: "uppercase" }),
  number: base(40, 44, "800", { letterSpacing: -1.5 }),
} as const;

export type TextVariant = keyof typeof T;
