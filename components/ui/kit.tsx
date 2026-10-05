import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

import { C, R, S, T, type TextVariant } from "@/constants/design";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { feedback } from "@/lib/feedback";

const useNative = Platform.OS !== "web";

/* ---------- Text ---------- */
export function Txt({ variant = "body", color = C.text, style, children, ...rest }: TextProps & { variant?: TextVariant; color?: string; style?: StyleProp<TextStyle>; children?: ReactNode }) {
  return <Text {...rest} style={[T[variant], { color }, style]}>{children}</Text>;
}

/* ---------- Gradient backdrop (SVG: cheap, cross-platform) ---------- */
let gradientSeq = 0;
export function Glow({ from = "#1B2A4A", to = C.surface, accent, radius = R.xl, style }: { from?: string; to?: string; accent?: string; radius?: number; style?: StyleProp<ViewStyle> }) {
  const id = useRef(`g${(gradientSeq += 1)}`).current;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }, style]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
          {accent ? (
            <RadialGradient id={`${id}r`} cx="0.9" cy="0.05" r="0.75">
              <Stop offset="0" stopColor={accent} stopOpacity="0.38" />
              <Stop offset="1" stopColor={accent} stopOpacity="0" />
            </RadialGradient>
          ) : null}
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}l)`} />
        {accent ? <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}r)`} /> : null}
      </Svg>
    </View>
  );
}

/* ---------- Card ---------- */
export function Card({ children, style, padded = true, accent, glow, onPress, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean; accent?: string; glow?: { from?: string; to?: string; accent?: string }; onPress?: () => void; accessibilityLabel?: string }) {
  const content = (
    <>
      {glow ? <Glow {...glow} /> : null}
      {children}
    </>
  );
  const base = [styles.card, padded && styles.cardPad, accent ? { borderColor: accent } : null, style];
  if (!onPress) return <View style={base}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => { feedback.tap(); onPress(); }} style={({ pressed }) => [base, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

/* ---------- Button ---------- */
type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "light";
export function Button({ label, onPress, variant = "primary", icon, iconRight, size = "lg", disabled, style, accessibilityLabel, color }: { label: string; onPress: () => void; variant?: ButtonVariant; icon?: string; iconRight?: string; size?: "sm" | "md" | "lg"; disabled?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel?: string; color?: string }) {
  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: color ?? C.gold, fg: C.ink, border: color ?? C.gold },
    secondary: { bg: C.surface2, fg: C.text, border: C.border },
    ghost: { bg: "transparent", fg: color ?? C.gold, border: "transparent" },
    danger: { bg: C.errorSoft, fg: C.error, border: "rgba(248,113,113,0.35)" },
    light: { bg: C.text, fg: C.ink, border: C.text },
  };
  const p = palette[variant];
  const height = size === "lg" ? 56 : size === "md" ? 46 : 36;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => { feedback.tap(); onPress(); }}
      style={({ pressed }) => [styles.button, { height, backgroundColor: p.bg, borderColor: p.border, paddingHorizontal: size === "sm" ? 14 : 20, borderRadius: size === "sm" ? R.md : R.lg }, variant === "primary" && styles.buttonShadow, disabled && { opacity: 0.45 }, pressed && styles.pressed, style]}
    >
      {icon ? <IconSymbol name={icon} size={size === "sm" ? 16 : 20} color={p.fg} /> : null}
      <Txt variant={size === "lg" ? "bodyStrong" : "smallStrong"} color={p.fg} style={{ fontSize: size === "lg" ? 16 : size === "md" ? 14 : 13 }}>{label}</Txt>
      {iconRight ? <IconSymbol name={iconRight} size={size === "sm" ? 16 : 20} color={p.fg} /> : null}
    </Pressable>
  );
}

/* ---------- Icon badge ---------- */
export function IconBadge({ icon, color = C.gold, tint, size = 44, iconSize, radius }: { icon: string; color?: string; tint?: string; size?: number; iconSize?: number; radius?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius ?? size * 0.32, backgroundColor: tint ?? "rgba(245,185,66,0.14)", alignItems: "center", justifyContent: "center" }}>
      <IconSymbol name={icon} size={iconSize ?? Math.round(size * 0.5)} color={color} />
    </View>
  );
}

/* ---------- Pill ---------- */
export function Pill({ label, icon, color = C.textDim, bg = C.surface2, style }: { label: string; icon?: string; color?: string; bg?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      {icon ? <IconSymbol name={icon} size={13} color={color} /> : null}
      <Txt variant="caption" color={color}>{label}</Txt>
    </View>
  );
}

/* ---------- Progress bar ---------- */
export function ProgressBar({ value, color = C.gold, track = "rgba(255,255,255,0.08)", height = 8, style, animated = true }: { value: number; color?: string; track?: string; height?: number; style?: StyleProp<ViewStyle>; animated?: boolean }) {
  const anim = useRef(new Animated.Value(animated ? 0 : value)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: Math.max(0, Math.min(100, value)), duration: animated ? 650 : 0, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [value, animated, anim]);
  return (
    <View style={[{ height, borderRadius: height, backgroundColor: track, overflow: "hidden" }, style]}>
      <Animated.View style={{ height, borderRadius: height, backgroundColor: color, width: anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) }} />
    </View>
  );
}

/* ---------- Ring ---------- */
export function Ring({ value, size = 64, stroke = 7, color = C.gold, track = "rgba(255,255,255,0.08)", children }: { value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const shown = useCountUp(Math.max(0, Math.min(100, value)), 800);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {shown > 0 ? <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - shown / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} /> : null}
      </Svg>
      {children}
    </View>
  );
}

/* ---------- Stars ---------- */
export function Stars({ count, size = 14, color = C.gold }: { count: number; size?: number; color?: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[0, 1, 2].map((i) => <IconSymbol key={i} name={i < count ? "star.fill" : "star"} size={size} color={i < count ? color : C.faint} />)}
    </View>
  );
}

/* ---------- Section header ---------- */
export function SectionHeader({ title, action, onAction, style }: { title: string; action?: string; onAction?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.sectionHeader, style]}>
      <Txt variant="h3">{title}</Txt>
      {action && onAction ? (
        <Pressable accessibilityRole="button" onPress={() => { feedback.tap(); onAction(); }} hitSlop={10}>
          <Txt variant="smallStrong" color={C.gold}>{action}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ---------- Entrance animation ---------- */
export function FadeIn({ children, delay = 0, from = 12, style }: { children: ReactNode; delay?: number; from?: number; style?: StyleProp<ViewStyle> }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 420, delay, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }).start();
  }, [anim, delay]);
  return (
    <Animated.View style={[style, { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/* ---------- Count-up number ---------- */
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = Date.now();
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

/* ---------- Top bar for pushed screens ---------- */
export function TopBar({ title, onBack, right }: { title?: string; onBack: () => void; right?: ReactNode }) {
  return (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => { feedback.tap(); onBack(); }} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]} hitSlop={8}>
        <IconSymbol name="chevron.left" size={24} color={C.text} />
      </Pressable>
      {title ? <Txt variant="h3" style={{ flex: 1, textAlign: "center" }} numberOfLines={1}>{title}</Txt> : <View style={{ flex: 1 }} />}
      <View style={{ minWidth: 40, alignItems: "flex-end" }}>{right}</View>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: { backgroundColor: C.surface, borderRadius: R.xl, borderWidth: 1, borderColor: C.hairline, overflow: "hidden" },
  cardPad: { padding: S.xl },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderWidth: 1 },
  buttonShadow: Platform.select({ web: { boxShadow: "0 8px 24px rgba(245,185,66,0.25)" } as unknown as ViewStyle, default: { elevation: 3 } }) as ViewStyle,
  pill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, alignSelf: "flex-start" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topBar: { flexDirection: "row", alignItems: "center", paddingVertical: S.md, gap: S.sm },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: C.hairline },
});
