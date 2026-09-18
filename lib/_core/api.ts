import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "./auth";

export async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const sessionToken = await Auth.getSessionToken();
  if (sessionToken) {
    headers["Authorization"] = `Bearer ${sessionToken}`;
  }

  const baseUrl = getApiBaseUrl();
  const cleanBaseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = baseUrl ? `${cleanBaseUrl}${cleanEndpoint}` : endpoint;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch {}
      throw new Error(errorMessage || `API call failed: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return (await response.json()) as T;
    }

    const text = await response.text();
    return (text ? JSON.parse(text) : {}) as T;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Unknown error occurred");
  }
}

export async function exchangeOAuthCode(
  code: string,
  state: string,
): Promise<{ sessionToken: string; user: any }> {
  const params = new URLSearchParams({ code, state });
  const result = await apiCall<{ app_session_id: string; user: any }>(
    `/api/oauth/mobile?${params.toString()}`,
  );
  return {
    sessionToken: result.app_session_id,
    user: result.user,
  };
}

export async function loginAsGuest(seed?: string): Promise<{ sessionToken?: string; user: any }> {
  const result = await apiCall<{ ok: boolean; token?: string; user: any }>("/api/auth/guest", {
    method: "POST",
    body: JSON.stringify({ seed }),
  });
  if (result.token) {
    await Auth.setSessionToken(result.token);
  }
  if (result.user) {
    await Auth.setUserInfo(result.user);
  }
  return {
    sessionToken: result.token,
    user: result.user,
  };
}

export async function logout(): Promise<void> {
  await apiCall<void>("/api/auth/logout", {
    method: "POST",
  });
  await Auth.removeSessionToken();
  await Auth.clearUserInfo();
}

export async function getMe(): Promise<{
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  lastSignedIn: string;
} | null> {
  try {
    const result = await apiCall<{ user: any }>("/api/auth/me");
    return result.user || null;
  } catch {
    return null;
  }
}

export async function establishSession(token: string): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/auth/session`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      credentials: "include",
    });
    return response.ok;
  } catch {
    return false;
  }
}
