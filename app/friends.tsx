import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { getPlayerDisplayName, isAlreadyFriend } from "@/domain/friends";
import { useProgression } from "@/lib/progression-provider";
import { trpc } from "@/lib/trpc";

export default function FriendsScreen() {
  const colors = useColors();
  const { isAuthenticated, createChallenge } = useProgression();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "search">("friends");

  const friendsQuery = trpc.friends.list.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 10_000,
  });

  const searchResults = trpc.friends.search.useQuery(
    { query: searchQuery },
    { enabled: isAuthenticated && searchQuery.trim().length >= 2, staleTime: 5_000 }
  );

  const requestMutation = trpc.friends.request.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        Alert.alert("Request Sent", "Your friend request has been sent!");
        void friendsQuery.refetch();
      } else {
        Alert.alert("Notice", res.error ?? "Could not send friend request.");
      }
    },
  });

  const respondMutation = trpc.friends.respond.useMutation({
    onSuccess: () => {
      void friendsQuery.refetch();
    },
  });

  const friendList = friendsQuery.data?.friends ?? [];
  const pendingRequests = friendsQuery.data?.pending ?? [];
  const friendUserIds = useMemo(() => friendList.map((f) => f.friendId), [friendList]);

  const handleChallenge = async () => {
    try {
      const challenge = await createChallenge("bible_quiz");
      router.push({ pathname: "/challenges", params: { code: challenge.shareCode } });
    } catch {
      router.push("/challenges");
    }
  };

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()}>
          <Text style={[styles.back, { color: colors.primary }]}>‹ Back</Text>
        </Pressable>

        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>FELLOWSHIP</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Friends & Duels.</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {isAuthenticated
              ? "Connect with fellow disciples, duel in challenges, and climb the leaderboard together."
              : "Sign in to add friends, send challenge invites, and track fellowship rankings."}
          </Text>
        </View>

        {/* Tab Navigation */}
        <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "friends" }}
            accessibilityLabel={`Friends tab, ${friendList.length} friends`}
            onPress={() => setActiveTab("friends")}
            style={[styles.tab, activeTab === "friends" && { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.tabText, { color: activeTab === "friends" ? colors.background : colors.muted }]}>
              Friends ({friendList.length})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "requests" }}
            accessibilityLabel={`Friend requests tab, ${pendingRequests.length} pending`}
            onPress={() => setActiveTab("requests")}
            style={[styles.tab, activeTab === "requests" && { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.tabText, { color: activeTab === "requests" ? colors.background : colors.muted }]}>
              Requests {pendingRequests.length > 0 ? `(${pendingRequests.length})` : ""}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "search" }}
            accessibilityLabel="Find players tab"
            onPress={() => setActiveTab("search")}
            style={[styles.tab, activeTab === "search" && { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.tabText, { color: activeTab === "search" ? colors.background : colors.muted }]}>
              Find Players
            </Text>
          </Pressable>
        </View>

        {/* Friends Tab */}
        {activeTab === "friends" && (
          <View style={styles.list}>
            {friendList.length === 0 ? (
              <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No friends yet</Text>
                <Text style={[styles.emptyBody, { color: colors.muted }]}>
                  Search for disciples by username or invite friends to compete in Bible Arena!
                </Text>
                <Pressable
                  onPress={() => setActiveTab("search")}
                  style={[styles.primaryAction, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.actionText, { color: colors.background }]}>Find Players</Text>
                </Pressable>
              </View>
            ) : (
              friendList.map((friend) => (
                <View
                  key={friend.id}
                  style={[styles.playerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.playerInfo}>
                    <Text style={[styles.playerName, { color: colors.foreground }]}>
                      {getPlayerDisplayName(friend.friendName, friend.friendOpenId)}
                    </Text>
                    <Text style={[styles.playerMeta, { color: colors.muted }]}>
                      {friend.friendOpenId.slice(0, 16)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Challenge ${getPlayerDisplayName(friend.friendName, friend.friendOpenId)}`}
                    onPress={handleChallenge}
                    style={[styles.duelButton, { backgroundColor: colors.primary }]}
                  >
                      <Text style={[styles.duelButtonText, { color: colors.background }]}>Challenge</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}

        {/* Requests Tab */}
        {activeTab === "requests" && (
          <View style={styles.list}>
            {pendingRequests.length === 0 ? (
              <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No pending requests</Text>
                <Text style={[styles.emptyBody, { color: colors.muted }]}>
                  When other players send you a friend invite, they will appear here.
                </Text>
              </View>
            ) : (
              pendingRequests.map((req) => (
                <View
                  key={req.id}
                  style={[styles.playerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.playerInfo}>
                    <Text style={[styles.playerName, { color: colors.foreground }]}>
                      {getPlayerDisplayName(req.fromName, req.fromOpenId)}
                    </Text>
                    <Text style={[styles.playerMeta, { color: colors.muted }]}>
                      Wants to connect
                    </Text>
                  </View>
                  <View style={styles.requestActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Accept friend request from ${getPlayerDisplayName(req.fromName, req.fromOpenId)}`}
                      onPress={() => respondMutation.mutate({ requestId: req.id, accept: true })}
                      style={[styles.acceptButton, { backgroundColor: colors.primary }]}
                    >
                      <Text style={[styles.buttonText, { color: colors.background }]}>Accept</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Decline friend request from ${getPlayerDisplayName(req.fromName, req.fromOpenId)}`}
                      onPress={() => respondMutation.mutate({ requestId: req.id, accept: false })}
                      style={[styles.declineButton, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.buttonText, { color: colors.muted }]}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Search Tab */}
        {activeTab === "search" && (
          <View style={styles.searchSection}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by player name or ID..."
              placeholderTextColor={colors.muted}
              style={[
                styles.searchInput,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {searchResults.isLoading && (
              <ActivityIndicator color={colors.primary} style={styles.loader} />
            )}

            {searchQuery.trim().length >= 2 && searchResults.data?.length === 0 && (
              <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No players found</Text>
                <Text style={[styles.emptyBody, { color: colors.muted }]}>
                  Try searching with a different name.
                </Text>
              </View>
            )}

            <View style={styles.list}>
              {searchResults.data?.map((user) => {
                const already = isAlreadyFriend(friendUserIds, user.id);
                return (
                  <View
                    key={user.id}
                    style={[styles.playerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={styles.playerInfo}>
                      <Text style={[styles.playerName, { color: colors.foreground }]}>
                        {getPlayerDisplayName(user.name, user.openId)}
                      </Text>
                      <Text style={[styles.playerMeta, { color: colors.muted }]}>
                        {user.openId.slice(0, 16)}
                      </Text>
                    </View>
                    {already ? (
                      <View style={[styles.tag, { borderColor: colors.border }]}>
                        <Text style={[styles.tagText, { color: colors.muted }]}>Friends ✓</Text>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${getPlayerDisplayName(user.name, user.openId)} as a friend`}
                        onPress={() => requestMutation.mutate({ addresseeId: user.id })}
                        disabled={requestMutation.isPending}
                        style={[styles.addButton, { backgroundColor: colors.primary }]}
                      >
                        <Text style={[styles.buttonText, { color: colors.background }]}>+ Add Friend</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 38, gap: 17 },
  back: { fontSize: 13, fontWeight: "800" },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.7 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.7 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 4 },
  tabs: { borderRadius: 15, borderWidth: 1, padding: 4, flexDirection: "row" },
  tab: { flex: 1, minHeight: 42, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  tabText: { fontSize: 12, fontWeight: "800" },
  list: { gap: 12, marginTop: 4 },
  playerCard: {
    minHeight: 68,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playerInfo: { flex: 1 },
  playerName: { fontSize: 15, fontWeight: "800" },
  playerMeta: { fontSize: 11, marginTop: 3 },
  duelButton: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, justifyContent: "center" },
  duelButtonText: { fontSize: 12, fontWeight: "800" },
  requestActions: { flexDirection: "row", gap: 8 },
  acceptButton: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, justifyContent: "center" },
  declineButton: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9, borderWidth: 1, justifyContent: "center" },
  buttonText: { fontSize: 12, fontWeight: "800" },
  searchSection: { gap: 14 },
  searchInput: {
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  loader: { marginVertical: 12 },
  addButton: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, justifyContent: "center" },
  tag: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  tagText: { fontSize: 11, fontWeight: "700" },
  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  emptyBody: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  primaryAction: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 12, marginTop: 8 },
  actionText: { fontSize: 13, fontWeight: "800" },
});
