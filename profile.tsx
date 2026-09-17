import * as Haptics from "expo-haptics";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { getLevelForXp, getLevelName, getXpToNextLevel } from "@/domain/progression";
import { useProgression } from "@/lib/progression-provider";
import { useAuth } from "@/hooks/use-auth";
import { startOAuthLogin } from "@/constants/oauth";
import { trpc } from "@/lib/trpc";

function tapFeedback() {
  if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function modeLabel(mode: string): string {
  if (mode === "bible_or_myth") return "Bible or Myth";
  if (mode === "word_puzzle") return "Word Puzzle";
  if (mode === "daily_challenge") return "Daily Challenge";
  return "Bible Quiz";
}

export default function ProfileScreen() {
  const colors = useColors();
  const { state, isLoading, isAuthenticated, syncStatus } = useProgression();
  const { user, logout } = useAuth();
  const matchHistory = trpc.matches.list.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000 });
  const progression = state.progression;
  const level = getLevelForXp(progression.totalXp);
  const levelName = getLevelName(level);
  const nextLevelXp = getXpToNextLevel(progression.totalXp);
  const latestSession = state.sessions[0];

  return (
    <ScreenContainer className="px-5" containerClassName="bg-background">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR PROFILE</Text>
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.background }]}>G</Text>
          </View>
          <View style={styles.identity}>
            <Text style={[styles.name, { color: colors.foreground }]}>{user?.name ?? "Guest Player"}</Text>
            <Text style={[styles.identityMeta, { color: colors.muted }]}>{isAuthenticated ? `${user?.email ?? "Account connected"} · ${syncStatus}` : "Local profile · sync across devices"}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isAuthenticated ? "Log out" : "Edit profile"}
            onPress={() => { tapFeedback(); if (isAuthenticated) void logout(); }}
            style={({ pressed }) => [styles.editButton, { borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Text style={[styles.editText, { color: colors.primary }]}>{isAuthenticated ? "Log out" : "Edit"}</Text>
          </Pressable>
        </View>

        {!isAuthenticated && (
          <Pressable accessibilityRole="button" accessibilityLabel="Sign in and sync progress" onPress={() => void startOAuthLogin()} style={({ pressed }) => [styles.accountCard, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}>
            <View style={[styles.accountIcon, { backgroundColor: "#243650" }]}><IconSymbol name="person.fill" size={20} color={colors.primary} /></View>
            <View style={styles.accountCopy}><Text style={[styles.accountTitle, { color: colors.foreground }]}>Protect your progress</Text><Text style={[styles.accountBody, { color: colors.muted }]}>Sign in to sync XP, challenges, history, and rankings.</Text></View>
            <IconSymbol name="chevron.right" size={18} color={colors.primary} />
          </Pressable>
        )}

        <View style={[styles.levelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={styles.levelTop}>
            <View>
              <Text style={[styles.levelLabel, { color: colors.muted }]}>LEVEL {level}</Text>
              <Text style={[styles.levelTitle, { color: colors.foreground }]}>{levelName}</Text>
            </View>
            <IconSymbol name="trophy.fill" size={30} color={colors.primary} />
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.min(100, (progression.totalXp / Math.max(1, progression.totalXp + nextLevelXp)) * 100)}%` }]} />
          </View>
          <Text style={[styles.progressText, { color: colors.muted }]}>
            {isLoading ? "Loading your progress…" : nextLevelXp > 0 ? `${nextLevelXp} XP until the next level.` : "You have reached the highest configured level."}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{progression.totalXp}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Total XP</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{progression.currentStreak}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Day streak</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{state.sessions.length}</Text>
            <Text style={[styles.statLabel, { color: colors.muted }]}>Sessions</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent sessions</Text>
          <Text style={[styles.sectionCaption, { color: colors.muted }]}>{progression.bestStreak} best streak</Text>
        </View>
        {latestSession ? (
          <View style={[styles.historyList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {state.sessions.slice(0, 5).map((session) => (
              <View key={session.id} style={styles.historyRow}>
                <View style={[styles.historyIcon, { backgroundColor: session.mode === "bible_or_myth" ? "#1C3C38" : session.mode === "word_puzzle" ? "#3E321F" : "#243650" }]}>
                  <IconSymbol name={session.mode === "bible_or_myth" ? "sparkles" : session.mode === "word_puzzle" ? "puzzlepiece.fill" : "book.fill"} size={18} color={session.mode === "bible_or_myth" ? colors.success : session.mode === "word_puzzle" ? colors.warning : colors.primary} />
                </View>
                <View style={styles.historyCopy}>
                  <Text style={[styles.historyTitle, { color: colors.foreground }]}>{modeLabel(session.mode)}</Text>
                  <Text style={[styles.historyMeta, { color: colors.muted }]}>{session.correctAnswers}/{session.totalQuestions} correct · {session.accuracy}% accuracy</Text>
                </View>
                <View style={styles.historyScore}>
                  <Text style={[styles.historyPoints, { color: colors.foreground }]}>{session.score}</Text>
                  <Text style={[styles.historyXp, { color: colors.primary }]}>+{session.xpEarned} XP</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={[styles.emptyCard, { borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
              <IconSymbol name="sparkles" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your story starts here</Text>
            <Text style={[styles.emptyBody, { color: colors.muted }]}>Complete a session to unlock accuracy insights, achievements, and competitive history.</Text>
          </View>
        )}

        {isAuthenticated && <>
          <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Live match history</Text><Text style={[styles.sectionCaption, { color: colors.muted }]}>{matchHistory.data?.length ?? 0} matches</Text></View>
          <View style={[styles.matchList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {matchHistory.data?.length ? matchHistory.data.slice(0, 5).map((match) => { const isHost = match.hostUserId === user?.id; const myScore = isHost ? match.hostScore : match.guestScore; const opponentScore = isHost ? match.guestScore : match.hostScore; const result = match.winnerUserId === null ? "Draw" : match.winnerUserId === user?.id ? "Victory" : "Defeat"; return <View key={match.id} style={styles.matchRow}><View style={[styles.matchIcon, { backgroundColor: result === "Victory" ? "#1C3C38" : result === "Defeat" ? "#3B2728" : "#3E321F" }]}><IconSymbol name="bolt.fill" size={17} color={result === "Victory" ? colors.success : result === "Defeat" ? colors.error : colors.warning} /></View><View style={styles.historyCopy}><Text style={[styles.historyTitle, { color: colors.foreground }]}>{result}</Text><Text style={[styles.historyMeta, { color: colors.muted }]}>{myScore}–{opponentScore} · {match.resultReason === "timeout" ? "Timeout" : "Completed"}</Text></View><View style={styles.historyScore}><Text style={[styles.historyPoints, { color: colors.primary }]}>+{isHost ? match.hostXp : match.guestXp}</Text><Text style={[styles.historyXp, { color: colors.muted }]}>XP</Text></View></View>; }) : <Text style={[styles.achievementEmpty, { color: colors.muted }]}>Complete a private room match to see your results here.</Text>}
          </View>
        </>}

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Achievements</Text>
          <Text style={[styles.sectionCaption, { color: colors.muted }]}>{state.achievements.length} unlocked</Text>
        </View>
        <View style={[styles.achievementList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {state.achievements.length > 0 ? state.achievements.map((achievement) => (
            <View key={achievement.key} style={styles.achievementRow}>
              <View style={[styles.achievementIcon, { backgroundColor: "#3E321F" }]}>
                <IconSymbol name={achievement.icon} size={18} color={colors.primary} />
              </View>
              <View style={styles.historyCopy}>
                <Text style={[styles.historyTitle, { color: colors.foreground }]}>{achievement.name}</Text>
                <Text style={[styles.historyMeta, { color: colors.muted }]}>{achievement.description}</Text>
              </View>
              <Text style={[styles.unlockedText, { color: colors.success }]}>Unlocked</Text>
            </View>
          )) : (
            <Text style={[styles.achievementEmpty, { color: colors.muted }]}>Complete a session to unlock your first badge.</Text>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 36, gap: 22 },
  eyebrow: { fontSize: 12, fontWeight: "800", letterSpacing: 2.2 },
  profileHeader: { flexDirection: "row", alignItems: "center", marginTop: -4 },
  avatar: { width: 64, height: 64, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 25, fontWeight: "800" },
  identity: { flex: 1, marginLeft: 13 },
  name: { fontSize: 22, fontWeight: "800" },
  identityMeta: { fontSize: 13, marginTop: 4 },
  editButton: { borderRadius: 12, borderWidth: 1, paddingVertical: 9, paddingHorizontal: 12 },
  editText: { fontSize: 12, fontWeight: "800" },
  accountCard: { borderRadius: 20, borderWidth: 1, padding: 14, flexDirection: "row", alignItems: "center", gap: 11 },
  accountIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  accountCopy: { flex: 1 },
  accountTitle: { fontSize: 14, fontWeight: "800" },
  accountBody: { fontSize: 11, lineHeight: 17, marginTop: 3 },
  levelCard: { borderRadius: 22, borderWidth: 1, padding: 18 },
  levelTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  levelLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
  levelTitle: { fontSize: 20, fontWeight: "800", marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden", marginTop: 20 },
  progressFill: { height: "100%", borderRadius: 4 },
  progressText: { fontSize: 12, lineHeight: 18, marginTop: 10 },
  statsRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, minHeight: 88, borderRadius: 18, borderWidth: 1, padding: 14, justifyContent: "space-between" },
  statValue: { fontSize: 25, fontWeight: "800" },
  statLabel: { fontSize: 11 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  sectionTitle: { fontSize: 19, fontWeight: "800" },
  sectionCaption: { fontSize: 12 },
  historyList: { borderRadius: 21, borderWidth: 1, paddingHorizontal: 14 },
  historyRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: "rgba(155,169,185,0.18)" },
  historyIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  historyCopy: { flex: 1 },
  historyTitle: { fontSize: 14, fontWeight: "800" },
  historyMeta: { fontSize: 11, marginTop: 4 },
  historyScore: { alignItems: "flex-end" },
  historyPoints: { fontSize: 14, fontWeight: "800" },
  historyXp: { fontSize: 11, fontWeight: "800", marginTop: 3 },
  achievementList: { borderRadius: 21, borderWidth: 1, paddingHorizontal: 14 },
  matchList: { borderRadius: 21, borderWidth: 1, paddingHorizontal: 14 },
  matchRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: "rgba(155,169,185,0.18)" },
  matchIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  achievementRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 11, borderBottomWidth: 1, borderBottomColor: "rgba(155,169,185,0.18)" },
  achievementIcon: { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  unlockedText: { fontSize: 10, fontWeight: "800" },
  achievementEmpty: { fontSize: 12, lineHeight: 18, paddingVertical: 18 },
  emptyCard: { borderRadius: 22, borderWidth: 1, padding: 20, alignItems: "center" },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "800", marginTop: 14 },
  emptyBody: { fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 6, maxWidth: 290 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
