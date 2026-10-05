import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

/** Instant, cheap feedback: haptics (native + Android web vibrate) and optional synthesized sound (off by default). */
const settings = { sound: false, haptics: true };

export function configureFeedback(next: Partial<typeof settings>) {
  Object.assign(settings, next);
}

function vibrate(pattern: number | number[]) {
  if (!settings.haptics) return;
  try {
    if (Platform.OS === "web") {
      const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }) : undefined;
      nav?.vibrate?.(pattern);
    }
  } catch { /* unsupported */ }
}

let audioCtx: AudioContext | null = null;
function tone(notes: Array<[number, number]>, type: OscillatorType = "sine", gain = 0.05) {
  if (!settings.sound || Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    const Ctx = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    let t = audioCtx.currentTime;
    for (const [freq, dur] of notes) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type; osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(audioCtx.destination);
      osc.start(t); osc.stop(t + dur);
      t += dur * 0.85;
    }
  } catch { /* audio unavailable */ }
}

export const feedback = {
  tap() {
    if (Platform.OS !== "web" && settings.haptics) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => null);
    else vibrate(8);
  },
  correct(combo = 1) {
    if (Platform.OS !== "web" && settings.haptics) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
    else vibrate(combo >= 2 ? [18, 40, 18] : 18);
    tone(combo >= 3 ? [[660, 0.08], [880, 0.08], [1175, 0.16]] : combo >= 2 ? [[660, 0.08], [990, 0.14]] : [[740, 0.14]], "triangle");
  },
  wrong() {
    if (Platform.OS !== "web" && settings.haptics) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => null);
    else vibrate([40, 30, 40]);
    tone([[220, 0.12], [180, 0.18]], "sawtooth", 0.03);
  },
  levelUp() {
    if (Platform.OS !== "web" && settings.haptics) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => null);
    else vibrate([20, 50, 20, 50, 40]);
    tone([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.24]], "triangle");
  },
  tick() {
    tone([[1200, 0.03]], "square", 0.015);
  },
};
