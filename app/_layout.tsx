import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient } from "@/lib/trpc";
import { ProgressionProvider } from "@/lib/progression-provider";
import { useAuth } from "@/hooks/use-auth";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { C, FONT_FAMILY } from "@/constants/design";
import { configureFeedback } from "@/lib/feedback";
import { useProgression } from "@/lib/progression-provider";

/** Internal routes that must never appear in the tab bar. */
const HIDDEN_ROUTES = ["settings", "quiz", "who-am-i", "onboarding", "room", "challenges", "ai-battle", "friends", "callback", "groups", "moderation", "notifications", "+not-found"];
const IMMERSIVE_ROUTES = ["quiz", "onboarding", "who-am-i", "callback"];

function FeedbackSync() {
  const { state } = useProgression();
  useEffect(() => {
    configureFeedback({ sound: !!state.arena?.soundOn, haptics: state.arena?.hapticsOn !== false });
  }, [state.arena?.soundOn, state.arena?.hapticsOn]);
  return null;
}
import {
  getNotificationPreferences,
  registerForPushNotificationsAsync,
  scheduleDailyStreakReminder,
} from "@/lib/notifications";

export default function RootLayout() {
  const { isAuthenticated } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  useEffect(() => {
    void (async () => {
      const prefs = await getNotificationPreferences();
      if (prefs.dailyStreakReminder) {
        void scheduleDailyStreakReminder(prefs.reminderHour, prefs.reminderMinute);
      }
      const token = isAuthenticated ? await registerForPushNotificationsAsync() : null;
      if (token && isAuthenticated) {
        trpcClient.notifications.registerToken.mutate({ token, platform: Platform.OS }).catch(() => null);
      }
    })();
  }, [isAuthenticated, trpcClient]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ProgressionProvider>
          <FeedbackSync />
          <Tabs
            screenOptions={{
              headerShown: false,
              sceneStyle: { backgroundColor: C.bg },
              tabBarActiveTintColor: C.gold,
              tabBarInactiveTintColor: C.faint,
              tabBarButton: HapticTab,
              tabBarStyle: {
                height: 64 + bottomPadding,
                paddingTop: 8,
                paddingBottom: bottomPadding,
                backgroundColor: "#0B1222",
                borderTopColor: C.hairline,
                borderTopWidth: 1,
              },
              tabBarLabelStyle: { fontSize: 11, fontWeight: "700", ...(FONT_FAMILY ? { fontFamily: FONT_FAMILY } : {}) },
            }}
          >
            <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color }) => <IconSymbol name="house.fill" size={24} color={color} /> }} />
            <Tabs.Screen name="play" options={{ title: "Play", tabBarIcon: ({ color }) => <IconSymbol name="play.fill" size={26} color={color} /> }} />
            <Tabs.Screen name="leaderboards" options={{ title: "Ranks", tabBarIcon: ({ color }) => <IconSymbol name="trophy.fill" size={22} color={color} /> }} />
            <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <IconSymbol name="person.crop.circle.fill" size={24} color={color} /> }} />
            {HIDDEN_ROUTES.map((name) => (
              <Tabs.Screen key={name} name={name} options={{ href: null, ...(IMMERSIVE_ROUTES.includes(name) ? { tabBarStyle: { display: "none" } } : {}) }} />
            ))}
          </Tabs>
        </ProgressionProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
