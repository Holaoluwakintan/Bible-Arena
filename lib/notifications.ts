import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  STREAK_REMINDER_ID,
  NOTIFICATION_PREF_KEY,
  type NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from "../domain/notifications";

export * from "../domain/notifications";

// Configure foreground notification behavior safely
if (Platform.OS !== "web") {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPresentAlert: true,
      }),
    });
  } catch {
    // Safe fallback if native module isn't ready
  }
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_PREF_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFERENCES;
    return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export async function saveNotificationPreferences(
  prefs: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences();
  const updated = { ...current, ...prefs };
  await AsyncStorage.setItem(NOTIFICATION_PREF_KEY, JSON.stringify(updated));
  return updated;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
    const token = tokenData?.data ?? null;

    if (token) {
      await saveNotificationPreferences({ pushToken: token });
    }

    return token;
  } catch {
    return null;
  }
}

export async function scheduleDailyStreakReminder(
  hour = 20,
  minute = 0,
): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    // Cancel existing reminder first
    await cancelDailyStreakReminder();

    await Notifications.scheduleNotificationAsync({
      identifier: STREAK_REMINDER_ID,
      content: {
        title: "🔥 Keep Your Daily Flame Burning!",
        body: "Your daily Bible Arena streak is waiting. Complete 1 quick session to protect your streak and earn today's XP!",
        data: { route: "/play" },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });

    await saveNotificationPreferences({
      dailyStreakReminder: true,
      reminderHour: hour,
      reminderMinute: minute,
    });

    return true;
  } catch {
    return false;
  }
}

export async function cancelDailyStreakReminder(): Promise<void> {
  if (Platform.OS === "web") return;

  try {
    await Notifications.cancelScheduledNotificationAsync(STREAK_REMINDER_ID);
    await saveNotificationPreferences({ dailyStreakReminder: false });
  } catch {
    // Graceful no-op
  }
}
