import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { getApiBaseUrl, startOAuthLogin } from "@/constants/oauth";
import { getVerifiedQuestions } from "@/domain/questions";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { useProgression } from "@/lib/progression-provider";
import { trpc } from "@/lib/trpc";
import * as Auth from "@/lib/_core/auth";

export default function MultiplayerRoomScreen() {
  const colors = useColors();
  const { isAuthenticated, refreshCloud } = useProgression();
  const { user, loginAsGuest } = useAuth();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [socketStatus, setSocketStatus] = useState<"connecting" | "connected" | "reconnecting" | "offline">("offline");
  const timeoutSent = useRef<string | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questions = useMemo(() => getVerifiedQuestions(5), []);
  const roomQuery = trpc.rooms.get.useQuery({ roomId: roomId ?? "" }, { enabled: Boolean(roomId) && isAuthenticated });
  type RoomSnapshot = NonNullable<typeof roomQuery.data>;
  const [realtimeRoom, setRealtimeRoom] = useState<RoomSnapshot | null>(null);
  const createMutation = trpc.rooms.create.useMutation({ onSuccess: (room) => setRoomId(room.id) });
  const joinMutation = trpc.rooms.join.useMutation({ onSuccess: (room) => setRoomId(room.id) });
  const readyMutation = trpc.rooms.ready.useMutation({ onSuccess: () => void roomQuery.refetch() });
  const answerMutation = trpc.rooms.answer.useMutation({ onSuccess: (result) => { if (result.status === "complete") refreshCloud(); void roomQuery.refetch(); } });
  const timeoutMutation = trpc.rooms.timeout.useMutation({ onSuccess: (result) => { if (result.status === "complete") refreshCloud(); void roomQuery.refetch(); } });
  const rematchMutation = trpc.rooms.rematch.useMutation({ onSuccess: () => void roomQuery.refetch() });
  const [queueElapsed, setQueueElapsed] = useState(0);
  const queueStatusQuery = trpc.matchmaking.status.useQuery(undefined, {
    enabled: isAuthenticated && !roomId,
    refetchInterval: (query) => (query.state.data?.status === "waiting" ? 2000 : false),
  });
  const joinQueueMutation = trpc.matchmaking.join.useMutation({
    onSuccess: (res) => {
      if (res.status === "matched" && res.roomId) setRoomId(res.roomId);
      else void queueStatusQuery.refetch();
    },
  });
  const leaveQueueMutation = trpc.matchmaking.leave.useMutation({ onSuccess: () => void queueStatusQuery.refetch() });
  const isQueued = queueStatusQuery.data?.status === "waiting";

  useEffect(() => {
    if (!isQueued) { setQueueElapsed(0); return; }
    const timer = setInterval(() => setQueueElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isQueued]);

  useEffect(() => {
    if (queueStatusQuery.data?.status === "matched" && queueStatusQuery.data.matchedRoomId) setRoomId(queueStatusQuery.data.matchedRoomId);
  }, [queueStatusQuery.data]);
  const room = roomQuery.data;
  const displayedRoom = realtimeRoom ?? room;
  const busy = createMutation.isPending || joinMutation.isPending || readyMutation.isPending || answerMutation.isPending || timeoutMutation.isPending || rematchMutation.isPending;

  useEffect(() => {
    if (!roomId || !isAuthenticated) return;
    let active = true;
    let socket: WebSocket | null = null;
    let attempts = 0;
    const connect = async () => {
      if (!active) return;
      setSocketStatus(attempts === 0 ? "connecting" : "reconnecting");
      const token = await Auth.getSessionToken();
      if (!active) return;
      const api = getApiBaseUrl();
      const base = api ? api.replace(/^http/, "ws") : "ws://localhost:3000";
      const url = new URL(`${base}/ws/rooms`);
      if (token && Platform.OS !== "web") url.searchParams.set("token", token);
      socket = new WebSocket(url.toString());
      socket.onopen = () => { attempts = 0; setSocketStatus("connected"); socket?.send(JSON.stringify({ type: "subscribe", roomId })); };
      socket.onmessage = (event) => { try { const message = JSON.parse(event.data as string) as { type?: string; room?: RoomSnapshot }; if (message.type === "room" && message.room) setRealtimeRoom(message.room); } catch { /* Ignore malformed event payloads. */ } };
      socket.onerror = () => setSocketStatus("offline");
      socket.onclose = () => { if (!active) return; setSocketStatus("reconnecting"); attempts++; reconnectTimer.current = setTimeout(() => void connect(), Math.min(1_000 * 2 ** Math.min(attempts, 4), 10_000)); };
    };
    void connect();
    return () => { active = false; if (reconnectTimer.current) clearTimeout(reconnectTimer.current); socket?.close(); setRealtimeRoom(null); setSocketStatus("offline"); };
  }, [roomId, isAuthenticated]);

  useEffect(() => {
    if (!displayedRoom || displayedRoom.status !== "playing" || !displayedRoom.roundDeadline || !displayedRoom.roundToken) { setSecondsLeft(0); return; }
    const deadline = displayedRoom.roundDeadline;
    const tick = () => {
      const left = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1_000));
      setSecondsLeft(left);
      if (left === 0 && timeoutSent.current !== displayedRoom.roundToken && !timeoutMutation.isPending) { timeoutSent.current = displayedRoom.roundToken; timeoutMutation.mutate({ roomId: displayedRoom.id, roundToken: displayedRoom.roundToken, roomVersion: displayedRoom.roomVersion }); }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [displayedRoom, timeoutMutation]);

  if (!isAuthenticated) return <ScreenContainer className="px-5" containerClassName="bg-background"><View style={styles.center}><View style={[styles.heroIcon, { backgroundColor: colors.primary }]}><IconSymbol name="person.2.fill" size={28} color={colors.background} /></View><Text style={[styles.title, { color: colors.foreground }]}>Sign in to play live.</Text><Text style={[styles.subtitle, { color: colors.muted }]}>Private rooms use your account so scores, timeouts, and rewards stay secure.</Text><Pressable accessibilityRole="button" accessibilityLabel="Play as demo guest" onPress={() => void loginAsGuest()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, marginBottom: 10 }, pressed && styles.pressed]}><Text style={[styles.primaryText, { color: colors.background }]}>Play as Demo Guest</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Sign in with OAuth" onPress={() => void startOAuthLogin()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.primaryText, { color: colors.foreground }]}>Sign in with OAuth</Text></Pressable></View></ScreenContainer>;

  if (!displayedRoom) return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={styles.content}><Pressable accessibilityRole="button" accessibilityLabel="Go back to play" onPress={() => router.back()}><Text style={[styles.back, { color: colors.primary }]}>‹ Back to play</Text></Pressable><Text style={[styles.eyebrow, { color: colors.primary }]}>LIVE MULTIPLAYER</Text><Text style={[styles.title, { color: colors.foreground }]}>Private rooms. Same questions.</Text><Text style={[styles.subtitle, { color: colors.muted }]}>Create a room and share the six-digit code, or join a friend&apos;s room.</Text>{isQueued ? <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 2 }]}><View style={[styles.heroIcon, { backgroundColor: "#1C3C38" }]}><IconSymbol name="bolt.fill" size={24} color={colors.success} /></View><Text style={[styles.cardTitle, { color: colors.foreground }]}>Finding Ranked Match…</Text><Text style={[styles.cardBody, { color: colors.muted }]}>Searching for an opponent in division: {queueStatusQuery.data?.division ?? "Bronze"}</Text><Text style={[styles.reward, { color: colors.primary }]}>In Queue: {Math.floor(queueElapsed / 60)}:{String(queueElapsed % 60).padStart(2, "0")}</Text><Pressable accessibilityRole="button" accessibilityLabel="Cancel ranked search" disabled={leaveQueueMutation.isPending} onPress={() => leaveQueueMutation.mutate()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, pressed && styles.pressed]}><Text style={[styles.primaryText, { color: colors.foreground }]}>{leaveQueueMutation.isPending ? "Cancelling…" : "Cancel Search"}</Text></Pressable></View> : <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary }]}><View style={[styles.heroIcon, { backgroundColor: "#243650" }]}><IconSymbol name="bolt.fill" size={22} color={colors.primary} /></View><Text style={[styles.cardTitle, { color: colors.foreground }]}>Ranked Matchmaking</Text><Text style={[styles.cardBody, { color: colors.muted }]}>Auto-match with players in your division for competitive season points and division ranking.</Text><Pressable accessibilityRole="button" accessibilityLabel="Find ranked match" disabled={busy || joinQueueMutation.isPending} onPress={() => joinQueueMutation.mutate()} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.primaryText, { color: colors.background }]}>{joinQueueMutation.isPending ? "Entering Queue…" : "Find Ranked Match"}</Text></Pressable></View>}<View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={[styles.heroIcon, { backgroundColor: "#243650" }]}><IconSymbol name="person.2.fill" size={22} color={colors.primary} /></View><Text style={[styles.cardTitle, { color: colors.foreground }]}>Create a room</Text><Text style={[styles.cardBody, { color: colors.muted }]}>Each round gets a server-issued token and deadline.</Text><Pressable accessibilityRole="button" accessibilityLabel="Create private multiplayer room" disabled={busy} onPress={() => createMutation.mutate({ mode: "bible_quiz" })} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.primaryText, { color: colors.background }]}>{createMutation.isPending ? "Creating…" : "Create private room"}</Text></Pressable></View><View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>Join a room</Text><TextInput accessibilityLabel="Six-digit room code" value={roomCode} onChangeText={setRoomCode} keyboardType="number-pad" maxLength={6} placeholder="Enter 6-digit room code" placeholderTextColor={colors.muted} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} /><Pressable accessibilityRole="button" accessibilityLabel="Join multiplayer room" disabled={busy || roomCode.length !== 6} onPress={() => joinMutation.mutate({ roomCode })} style={({ pressed }) => [styles.primaryButton, { backgroundColor: roomCode.length === 6 ? colors.primary : colors.border }, pressed && styles.pressed]}><Text style={[styles.primaryText, { color: roomCode.length === 6 ? colors.background : colors.muted }]}>{joinMutation.isPending ? "Joining…" : "Join room"}</Text></Pressable></View>{(createMutation.error || joinMutation.error) && <Text style={[styles.error, { color: colors.error }]}>{createMutation.error?.message ?? joinMutation.error?.message}</Text>}</ScrollView></ScreenContainer>;

  const roomState = displayedRoom;
  const isHost = roomState.hostUserId === user?.id;
  const myReady = isHost ? roomState.hostReady === 1 : roomState.guestReady === 1;
  const myAnswered = isHost ? roomState.hostAnsweredIndex === roomState.currentQuestionIndex : roomState.guestAnsweredIndex === roomState.currentQuestionIndex;
  const liveQuestion = roomState.status === "playing" ? questions[roomState.currentQuestionIndex % questions.length] : null;
  const socketLabel = socketStatus === "connected" ? "Live connection active" : socketStatus === "reconnecting" ? "Reconnecting…" : socketStatus === "connecting" ? "Connecting…" : "Offline · retrying automatically";
  const socketColor = socketStatus === "connected" ? colors.success : socketStatus === "offline" ? colors.error : colors.warning;
  return <ScreenContainer className="px-5" containerClassName="bg-background"><ScrollView contentContainerStyle={styles.content}><View style={styles.topRow}><Text style={[styles.eyebrow, { color: colors.primary }]}>ROOM {roomState.roomCode}</Text><Text accessibilityRole="text" style={[styles.status, { color: roomState.status === "complete" ? colors.success : colors.muted }]}>{roomState.status === "lobby" ? "Waiting room" : roomState.status === "playing" ? "In progress" : "Complete"}</Text></View><View accessibilityRole="text" accessibilityLiveRegion="polite" style={[styles.connectionBanner, { borderColor: socketColor, backgroundColor: `${socketColor}18` }]}><View style={[styles.connectionDot, { backgroundColor: socketColor }]} /><Text style={[styles.connection, { color: socketColor }]}>{socketLabel}</Text></View><View style={[styles.scoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={styles.scoreSide}><Text style={[styles.scoreLabel, { color: colors.muted }]}>YOU</Text><Text style={[styles.score, { color: colors.foreground }]}>{isHost ? roomState.hostScore : roomState.guestScore}</Text><Text style={[styles.ready, { color: myReady ? colors.success : colors.muted }]}>{myReady ? "Ready" : "Not ready"}</Text></View><Text style={[styles.vs, { color: colors.primary }]}>VS</Text><View style={styles.scoreSide}><Text style={[styles.scoreLabel, { color: colors.muted }]}>FRIEND</Text><Text style={[styles.score, { color: colors.foreground }]}>{isHost ? roomState.guestScore : roomState.hostScore}</Text><Text style={[styles.ready, { color: roomState.guestUserId ? colors.success : colors.muted }]}>{roomState.guestUserId ? "Connected" : "Waiting"}</Text></View></View>{roomState.status === "lobby" && <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{roomState.guestUserId ? "Both players ready?" : "Share this room code"}</Text><Text style={[styles.roomCode, { color: colors.primary }]}>{roomState.roomCode}</Text><Text style={[styles.cardBody, { color: colors.muted }]}>{roomState.guestUserId ? "When both players are ready, the match starts automatically." : "Your friend can join from Live Multiplayer with this code."}</Text><Pressable accessibilityRole="button" accessibilityLabel={myReady ? "Cancel ready status" : "Mark ready"} disabled={!roomState.guestUserId || busy} onPress={() => readyMutation.mutate({ roomId: roomState.id, ready: !myReady, roomVersion: roomState.roomVersion })} style={({ pressed }) => [styles.primaryButton, { backgroundColor: roomState.guestUserId ? colors.primary : colors.border }, pressed && styles.pressed]}><Text style={[styles.primaryText, { color: roomState.guestUserId ? colors.background : colors.muted }]}>{myReady ? "Cancel ready" : "Ready up"}</Text></Pressable></View>}{roomState.status === "playing" && liveQuestion && <View style={styles.game}><View style={styles.roundTop}><Text style={[styles.questionCount, { color: colors.muted }]}>Question {roomState.currentQuestionIndex + 1} of 5</Text><Text style={[styles.timer, { color: secondsLeft <= 5 ? colors.error : colors.primary }]}>{secondsLeft}s</Text></View><Text style={[styles.question, { color: colors.foreground }]}>{liveQuestion.prompt}</Text><View style={styles.options}>{liveQuestion.options.map((option, index) => <Pressable key={option.id} accessibilityRole="button" accessibilityLabel={`Answer ${option.label}`} disabled={myAnswered || busy} onPress={() => answerMutation.mutate({ roomId: roomState.id, questionIndex: roomState.currentQuestionIndex, answerId: option.id, roundToken: roomState.roundToken, roomVersion: roomState.roomVersion })} style={({ pressed }) => [styles.option, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}><View style={[styles.letter, { backgroundColor: colors.background }]}><Text style={[styles.letterText, { color: colors.primary }]}>{String.fromCharCode(65 + index)}</Text></View><Text style={[styles.optionText, { color: colors.foreground }]}>{option.label}</Text></Pressable>)}</View><Text style={[styles.waiting, { color: colors.muted }]}>{myAnswered ? "Answer locked. Waiting for your friend…" : "Realtime room updates are active."}</Text></View>}{roomState.status === "complete" && <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.cardTitle, { color: colors.foreground }]}>{roomState.winnerUserId === null ? "It’s a draw." : roomState.winnerUserId === (isHost ? roomState.hostUserId : roomState.guestUserId) ? "You win." : "Your friend wins."}</Text><Text style={[styles.cardBody, { color: colors.muted }]}>Final score · {isHost ? roomState.hostScore : roomState.guestScore} to {isHost ? roomState.guestScore : roomState.hostScore}</Text><Text style={[styles.reward, { color: colors.success }]}>Match XP has been added to both profiles.</Text><Pressable accessibilityRole="button" accessibilityLabel="Start a rematch" disabled={busy} onPress={() => rematchMutation.mutate({ roomId: roomState.id, roomVersion: roomState.roomVersion })} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.primaryText, { color: colors.background }]}>Rematch</Text></Pressable></View>}{(roomQuery.error || answerMutation.error || timeoutMutation.error) && <Text style={[styles.error, { color: colors.error }]}>{roomQuery.error?.message ?? answerMutation.error?.message ?? timeoutMutation.error?.message}</Text>}</ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 18, paddingBottom: 38, gap: 17 }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, gap: 14 }, back: { fontSize: 13, fontWeight: "800" }, eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1.7 }, title: { fontSize: 30, lineHeight: 37, fontWeight: "800", letterSpacing: -0.7 }, subtitle: { fontSize: 15, lineHeight: 22 }, card: { borderRadius: 22, borderWidth: 1, padding: 17, gap: 10 }, heroIcon: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" }, cardTitle: { fontSize: 17, fontWeight: "800" }, cardBody: { fontSize: 13, lineHeight: 19 }, input: { minHeight: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, fontSize: 16, letterSpacing: 2 }, primaryButton: { minHeight: 50, borderRadius: 15, paddingHorizontal: 15, alignItems: "center", justifyContent: "center", marginTop: 6 }, primaryText: { fontSize: 13, fontWeight: "800" }, pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] }, error: { fontSize: 12, lineHeight: 18 }, topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, status: { fontSize: 12, fontWeight: "800", textTransform: "capitalize" }, connectionBanner: { minHeight: 38, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 }, connectionDot: { width: 8, height: 8, borderRadius: 4 }, connection: { fontSize: 12, fontWeight: "800" }, scoreCard: { borderWidth: 1, borderRadius: 21, padding: 18, flexDirection: "row", justifyContent: "space-around", alignItems: "center" }, scoreSide: { alignItems: "center", gap: 3 }, scoreLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }, score: { fontSize: 32, fontWeight: "900" }, ready: { fontSize: 11, fontWeight: "700" }, vs: { fontSize: 12, fontWeight: "900", letterSpacing: 1.4 }, roomCode: { fontSize: 32, fontWeight: "900", letterSpacing: 6 }, game: { gap: 13 }, roundTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, questionCount: { fontSize: 12, fontWeight: "800" }, timer: { fontSize: 18, fontWeight: "900" }, question: { fontSize: 26, lineHeight: 34, fontWeight: "800" }, options: { gap: 10 }, option: { minHeight: 64, borderRadius: 17, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }, letter: { width: 33, height: 33, borderRadius: 10, alignItems: "center", justifyContent: "center" }, letterText: { fontSize: 13, fontWeight: "800" }, optionText: { flex: 1, fontSize: 15, fontWeight: "700" }, waiting: { fontSize: 12, textAlign: "center" }, reward: { fontSize: 12, fontWeight: "800" },
});
