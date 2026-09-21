export const STREAK_REMINDER_ID = "bible-arena:daily-streak-reminder";
export const NOTIFICATION_PREF_KEY = "bible-arena:notification-preferences:v1";

export interface NotificationPreferences {
  dailyStreakReminder: boolean;
  reminderHour: number; // 0-23, default 20 (8 PM)
  reminderMinute: number; // 0-59, default 0
  pushToken: string | null;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  dailyStreakReminder: true,
  reminderHour: 20,
  reminderMinute: 0,
  pushToken: null,
};
