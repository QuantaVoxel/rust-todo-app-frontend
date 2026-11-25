import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { AuthTokenResponse } from "@/lib/api/types";

export const ACCESS_TOKEN_COOKIE = "todo_access_token";
export const REFRESH_TOKEN_COOKIE = "todo_refresh_token";

const RAW_BASE_URL =
  process.env.RUST_API_BASE_URL ?? "http://localhost:8080";
export const RUST_API_V1 = `${RAW_BASE_URL.replace(/\/+$/, "")}/api/v1`;

const IS_PROD = process.env.NODE_ENV === "production";

export function applyAuthCookies(
  response: NextResponse,
  tokens: { access_token: string; refresh_token: string; expires_in?: number }
): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, tokens.access_token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: tokens.expires_in && tokens.expires_in > 0 ? tokens.expires_in : 3600,
  });

  response.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionTokens(): Promise<{
  accessToken: string | undefined;
  refreshToken: string | undefined;
}> {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_TOKEN_COOKIE)?.value,
    refreshToken: store.get(REFRESH_TOKEN_COOKIE)?.value,
  };
}

// Single-flight lock to prevent parallel refresh token rotation races
const inFlightRefreshes = new Map<string, Promise<AuthTokenResponse | null>>();

export async function refreshWithSingleFlight(
  refreshToken: string
): Promise<AuthTokenResponse | null> {
  const existing = inFlightRefreshes.get(refreshToken);
  if (existing) {
    return existing;
  }

  const promise = (async (): Promise<AuthTokenResponse | null> => {
    try {
      const res = await fetch(`${RUST_API_V1}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      });

      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as AuthTokenResponse;
      if (!data.access_token || !data.refresh_token) {
        return null;
      }
      return data;
    } catch {
      return null;
    } finally {
      inFlightRefreshes.delete(refreshToken);
    }
  })();

  inFlightRefreshes.set(refreshToken, promise);
  return promise;
}
