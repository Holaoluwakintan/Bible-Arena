import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { GameResult } from "@/domain/game-engine";
import { createFriendChallenge, joinFriendChallenge, type FriendChallenge } from "@/domain/competitive";
import { applyCompletedSession, unlockAchievements, type UnlockedAchievement } from "@/domain/progression";
import { getAllMastery, normalizeArena, todayKey, type ArenaStats } from "@/domain/arena";
import { EMPTY_PROGRESS_STATE, loadProgressState, saveProgressState, toHistoryEntry, type LocalProgressState } from "@/domain/local-storage";
import type { GameMode } from "@/domain/questions";
import { mergeCloudState } from "@/domain/cloud-sync";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

interface ProgressionContextValue {
  state: LocalProgressState;
  isLoading: boolean;
  isAuthenticated: boolean;
  syncStatus: "local" | "syncing" | "synced" | "error";
  refreshCloud: () => void;
  recordSession: (result: GameResult, extras?: RecordExtras) => Promise<UnlockedAchievement[]>;
  updateArena: (patch: Partial<ArenaStats>) => void;
  setDisplayName: (name: string) => void;
  completeOnboarding: () => void;
  createChallenge: (mode: GameMode) => Promise<FriendChallenge>;
  joinChallenge: (shareCode: string, opponentName: string) => Promise<FriendChallenge>;
}

export interface RecordExtras {
  bonusXp?: number;
  kind?: "quick" | "category" | "survival" | "daily";
  category?: string;
  bestCombo?: number;
  /** Apply round facts (seen/correct ids, combos, survival, daily) to arena stats. */
  arena?: (arena: ArenaStats) => ArenaStats;
}

function withAchievements(state: LocalProgressState, at: number): LocalProgressState {
  const arena = normalizeArena(state.arena);
  const masteryPct: Record<string, number> = {};
  for (const m of getAllMastery(arena)) masteryPct[m.category.id] = m.pct;
  const achievements = unlockAchievements(state.achievements, { progression: state.progression, sessions: state.sessions, arena: { ...arena, masteryPct } }, at);
  return { ...state, achievements };
}

const ProgressionContext = createContext<ProgressionContextValue | null>(null);

export function ProgressionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<LocalProgressState>(EMPTY_PROGRESS_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<ProgressionContextValue["syncStatus"]>("local");
  const syncedUserId = useRef<number | null>(null);
  const syncQuery = trpc.sync.get.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000 });
  const recordMutation = trpc.sync.recordSession.useMutation();
  const createChallengeMutation = trpc.challenges.create.useMutation();
  const joinChallengeMutation = trpc.challenges.join.useMutation();
  const refreshCloud = useCallback(() => { if (isAuthenticated) { syncedUserId.current = null; void syncQuery.refetch(); } }, [isAuthenticated, syncQuery]);

  useEffect(() => {
    let mounted = true;
    void loadProgressState().then((stored) => { if (mounted) { setState(stored); setIsLoading(false); } });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user || !syncQuery.data || syncedUserId.current === user.id) return;
    syncedUserId.current = user.id;
    setSyncStatus("syncing");
    const merged = mergeCloudState(state, syncQuery.data);
    setState(merged);
    void saveProgressState(merged);
    // Existing local summaries are intentionally not uploaded: they have no server-verifiable answer evidence.
    setSyncStatus("synced");
  }, [isLoading, isAuthenticated, user, syncQuery.data, state]);

  const stateRef = useRef(state);
  stateRef.current = state;

  const commit = useCallback((next: LocalProgressState) => {
    stateRef.current = next;
    setState(next);
    void saveProgressState(next);
  }, []);

  const recordSession = useCallback(async (result: GameResult, extras: RecordExtras = {}) => {
    const current = stateRef.current;
    if (current.sessions.some((session) => session.id === result.sessionId)) return [];
    const entry = { ...toHistoryEntry(result), kind: extras.kind, category: extras.category, bestCombo: extras.bestCombo };
    const sessions = [entry, ...current.sessions].slice(0, 30);
    const before = current.progression.totalXp;
    const progression = applyCompletedSession(current.progression, { sessionId: result.sessionId, mode: result.mode, correctAnswers: result.correctAnswers, xpEarned: result.xpEarned, completedAt: result.completedAt, bonusXp: extras.bonusXp });
    let arena = normalizeArena(current.arena);
    if (extras.arena) arena = extras.arena(arena);
    const gained = progression.totalXp - before;
    const day = todayKey(result.completedAt);
    arena = { ...arena, roundsPlayed: arena.roundsPlayed + 1, xpByDay: { ...arena.xpByDay, [day]: (arena.xpByDay[day] ?? 0) + gained } };
    const knownKeys = new Set(current.achievements.map((a) => a.key));
    const nextState = withAchievements({ ...current, progression, sessions, arena }, result.completedAt);
    commit(nextState);
    const unlocked = nextState.achievements.filter((a) => !knownKeys.has(a.key));
    if (isAuthenticated) {
      setSyncStatus("syncing");
      try {
        if (!result.answers?.length) throw new Error("This session has no server-verifiable answer evidence.");
        await recordMutation.mutateAsync({ id: result.sessionId, mode: result.mode, answers: result.answers.slice(0, 20) });
        setSyncStatus("synced");
      }
      catch { setSyncStatus("error"); }
    }
    return unlocked;
  }, [isAuthenticated, recordMutation, commit]);

  const updateArena = useCallback((patch: Partial<ArenaStats>) => {
    const current = stateRef.current;
    commit({ ...current, arena: { ...normalizeArena(current.arena), ...patch } });
  }, [commit]);

  const setDisplayName = useCallback((name: string) => {
    commit({ ...stateRef.current, displayName: name.trim().slice(0, 24) || undefined });
  }, [commit]);

  const completeOnboarding = useCallback(() => {
    commit({ ...stateRef.current, hasCompletedOnboarding: true });
  }, [commit]);

  const createChallenge = useCallback(async (mode: GameMode) => {
    const challenge = createFriendChallenge({ creatorName: user?.name ?? "Guest Player", mode });
    setState((current) => { const next = { ...current, challenges: [challenge, ...current.challenges].slice(0, 20) }; void saveProgressState(next); return next; });
    if (isAuthenticated) {
      await createChallengeMutation.mutateAsync({ id: challenge.id, shareCode: challenge.shareCode, mode: challenge.mode, expiresAt: new Date(challenge.expiresAt) });
    }
    return challenge;
  }, [createChallengeMutation, isAuthenticated, user?.name]);

  const joinChallenge = useCallback(async (shareCode: string, opponentName: string) => {
    if (isAuthenticated) {
      const remote = await joinChallengeMutation.mutateAsync({ shareCode: shareCode.trim() });
      const challenge: FriendChallenge = { id: remote.id, shareCode: remote.shareCode, creatorName: "Bible Arena Player", opponentName, mode: remote.mode as GameMode, status: remote.status, createdAt: new Date(remote.createdAt).getTime(), expiresAt: new Date(remote.expiresAt).getTime() };
      setState((current) => { const next = { ...current, challenges: [challenge, ...current.challenges.filter((item) => item.id !== challenge.id)] }; void saveProgressState(next); return next; });
      return challenge;
    }
    let joined: FriendChallenge | null = null;
    setState((current) => {
      const challenge = current.challenges.find((item) => item.shareCode === shareCode.trim());
      if (!challenge) throw new Error("Challenge code not found on this device.");
      joined = joinFriendChallenge(challenge, opponentName);
      const next = { ...current, challenges: current.challenges.map((item) => item.id === challenge.id ? joined as FriendChallenge : item) }; void saveProgressState(next); return next;
    });
    if (!joined) throw new Error("Challenge could not be joined.");
    return joined;
  }, [isAuthenticated, joinChallengeMutation]);

  const value = useMemo(() => ({ state, isLoading, isAuthenticated, syncStatus, refreshCloud, recordSession, updateArena, setDisplayName, completeOnboarding, createChallenge, joinChallenge }), [state, isLoading, isAuthenticated, syncStatus, refreshCloud, recordSession, updateArena, setDisplayName, completeOnboarding, createChallenge, joinChallenge]);
  return <ProgressionContext.Provider value={value}>{children}</ProgressionContext.Provider>;
}

export function useProgression(): ProgressionContextValue {
  const value = useContext(ProgressionContext);
  if (!value) throw new Error("useProgression must be used within ProgressionProvider");
  return value;
}
