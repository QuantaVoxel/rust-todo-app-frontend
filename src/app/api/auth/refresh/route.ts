import { NextResponse } from "next/server";
import {
  applyAuthCookies,
  clearAuthCookies,
  getSessionTokens,
  refreshWithSingleFlight,
} from "@/lib/auth/session";

export async function POST() {
  const { refreshToken } = await getSessionTokens();

  if (!refreshToken) {
    const response = NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Refresh token tidak ditemukan",
          details: null,
        },
      },
      { status: 401 }
    );
    clearAuthCookies(response);
    return response;
  }

  const refreshed = await refreshWithSingleFlight(refreshToken);
  if (!refreshed) {
    const response = NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Refresh token tidak valid atau telah dicabut",
          details: null,
        },
      },
      { status: 401 }
    );
    clearAuthCookies(response);
    return response;
  }

  const response = NextResponse.json(
    {
      user: refreshed.user,
      expires_in: refreshed.expires_in,
    },
    { status: 200 }
  );
  applyAuthCookies(response, refreshed);
  return response;
}
