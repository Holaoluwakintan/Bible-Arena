import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, createTRPCClient } from "@/lib/trpc";
import { ProgressionProvider } from "@/lib/progression-provider";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

export default function RootLayout() {
  const colors = useColors();
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

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ProgressionProvider>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: colors.primary,
              tabBarInactiveTintColor: colors.muted,
              tabBarButton: HapticTab,
              tabBarStyle: {
                height: 62 + bottomPadding,
                paddingTop: 8,
                paddingBottom: bottomPadding,
                backgroundColor: colors.background,
                borderTopColor: colors.border,
                borderTopWidth: 0.5,
              },
              tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: "Home",
                tabBarIcon: ({ color }) => <IconSymbol name="house.fill" size={22} color={color} />,
              }}
            />
            <Tabs.Screen
              name="play"
              options={{
                title: "Play",
                tabBarIcon: ({ color }) => <IconSymbol name="play.fill" size={22} color={color} />,
              }}
            />
            <Tabs.Screen
              name="profile"
              options={{
                title: "Profile",
                tabBarIcon: ({ color }) => (
                  <IconSymbol name="person.crop.circle.fill" size={22} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="settings"
              options={{
                title: "Settings",
                tabBarIcon: ({ color }) => <IconSymbol name="gearshape.fill" size={22} color={color} />,
              }}
            />
            <Tabs.Screen name="quiz" options={{ href: null }} />
            <Tabs.Screen name="room" options={{ href: null }} />
            <Tabs.Screen name="challenges" options={{ href: null }} />
            <Tabs.Screen name="ai-battle" options={{ href: null }} />
            <Tabs.Screen name="leaderboards" options={{ href: null }} />
            <Tabs.Screen name="callback" options={{ href: null }} />
          </Tabs>
        </ProgressionProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
