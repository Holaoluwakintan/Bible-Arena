import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { GameResult } from "@/domain/game-engine";
import { createFriendChallenge, joinFriendChallenge, type FriendChallenge } from "@/domain/competitive";
import { applyCompletedSession, unlockAchievements } from "@/domain/progression";
import { EMPTY_PROGRESS_STATE, loadProgressState, saveProgressState, toHistoryEntry, type LocalProgressState } from "@/domain/local-storage";
import type { GameMode } from "@/domain/questions";
import { mergeCloudState, toRemoteProgress, toRemoteSession } from "@/domain/cloud-sync";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

interface ProgressionContextValue {
  state: LocalProgressState;
  isLoading: boolean;
  isAuthenticated: boolean;
  syncStatus: "local" | "syncing" | "synced" | "error";
  refreshCloud: () => void;
  recordSession: (result: GameResult) => Promise<void>;
  createChallenge: (mode: GameMode) => Promise<FriendChallenge>;
  joinChallenge: (shareCode: string, opponentName: string) => Promise<FriendChallenge>;
}

const ProgressionContext = createContext<ProgressionContextValue | null>(null);

export function ProgressionProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<LocalProgressState>(EMPTY_PROGRESS_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<ProgressionContextValue["syncStatus"]>("local");
  const syncedUserId = useRef<number | null>(null);
  const syncQuery = trpc.sync.get.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000 });
  const migrateMutation = trpc.sync.migrate.useMutation();
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
    void migrateMutation.mutateAsync({ progress: toRemoteProgress(merged), sessions: merged.sessions.map(toRemoteSession) })
      .then(() => setSyncStatus("synced"))
      .catch(() => setSyncStatus("error"));
  }, [isLoading, isAuthenticated, user, syncQuery.data, state, migrateMutation]);

  const recordSession = useCallback(async (result: GameResult) => {
    let nextState: LocalProgressState | null = null;
    setState((current) => {
      if (current.sessions.some((session) => session.id === result.sessionId)) return current;
      const sessions = [toHistoryEntry(result), ...current.sessions].slice(0, 20);
      const progression = applyCompletedSession(current.progression, { sessionId: result.sessionId, mode: result.mode, correctAnswers: result.correctAnswers, xpEarned: result.xpEarned, completedAt: result.completedAt });
      nextState = { progression, sessions, achievements: unlockAchievements(current.achievements, { progression, sessions }, result.completedAt), challenges: current.challenges };
      void saveProgressState(nextState);
      return nextState;
    });
    if (isAuthenticated && nextState) {
      setSyncStatus("syncing");
      try { await recordMutation.mutateAsync({ progress: toRemoteProgress(nextState), session: toRemoteSession(toHistoryEntry(result)) }); setSyncStatus("synced"); }
      catch { setSyncStatus("error"); }
    }
  }, [isAuthenticated, recordMutation]);

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

  const value = useMemo(() => ({ state, isLoading, isAuthenticated, syncStatus, refreshCloud, recordSession, createChallenge, joinChallenge }), [state, isLoading, isAuthenticated, syncStatus, refreshCloud, recordSession, createChallenge, joinChallenge]);
  return <ProgressionContext.Provider value={value}>{children}</ProgressionContext.Provider>;
}

export function useProgression(): ProgressionContextValue {
  const value = useContext(ProgressionContext);
  if (!value) throw new Error("useProgression must be used within ProgressionProvider");
  return value;
}
