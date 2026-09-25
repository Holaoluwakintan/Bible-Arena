import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

type UseAuthOptions = {
  autoFetch?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const { autoFetch = true } = options ?? {};
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (Platform.OS === "web") {
        const apiUser = await Api.getMe();
        if (apiUser) {
          const userInfo: Auth.User = {
            id: apiUser.id,
            openId: apiUser.openId,
            name: apiUser.name,
            email: apiUser.email,
            loginMethod: apiUser.loginMethod,
            lastSignedIn: new Date(apiUser.lastSignedIn),
          };
          setUser(userInfo);
          await Auth.setUserInfo(userInfo);
        } else {
          // Check local storage cached user for guest mode
          const cached = await Auth.getUserInfo();
          if (cached) {
            setUser(cached);
          } else {
            setUser(null);
          }
        }
        return;
      }

      const sessionToken = await Auth.getSessionToken();
      if (!sessionToken) {
        setUser(null);
        return;
      }

      const cachedUser = await Auth.getUserInfo();
      if (cachedUser) {
        setUser(cachedUser);
      } else {
        setUser(null);
      }
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Failed to fetch user");
      setError(e);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loginAsGuest = useCallback(async () => {
    try {
      setLoading(true);
      const res = await Api.loginAsGuest();
      if (res.user) {
        const userInfo: Auth.User = {
          id: res.user.id,
          openId: res.user.openId,
          name: res.user.name ?? "Guest Player",
          email: res.user.email ?? null,
          loginMethod: "guest",
          lastSignedIn: new Date(),
        };
        setUser(userInfo);
        await Auth.setUserInfo(userInfo);
      }
      return res;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Failed to login as guest");
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);

  useEffect(() => {
    if (autoFetch) {
      void fetchUser();
    } else {
      setLoading(false);
    }
  }, [autoFetch, fetchUser]);

  return {
    user,
    loading,
    error,
    isAuthenticated,
    refresh: fetchUser,
    loginAsGuest,
    logout,
  };
}
