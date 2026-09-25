import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  STREAK_REMINDER_ID,
} from "../domain/notifications";

describe("Notifications and Streak Reminder Engine", () => {
  it("defines sensible default notification preferences", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES.dailyStreakReminder).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.soundEnabled).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.reminderHour).toBe(20);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.reminderMinute).toBe(0);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.pushToken).toBeNull();
  });

  it("uses a unique stable identifier for the streak reminder", () => {
    expect(STREAK_REMINDER_ID).toBe("bible-arena:daily-streak-reminder");
  });
});
