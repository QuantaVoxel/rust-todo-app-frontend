import { NextResponse } from "next/server";
import {
  applyAuthCookies,
  clearAuthCookies,
  getSessionTokens,
  refreshWithSingleFlight,
} from "@/lib/auth/session";

export async function GET() {
  const { accessToken, refreshToken } = await getSessionTokens();

  if (accessToken) {
    return NextResponse.json({ access_token: accessToken }, { status: 200 });
  }

  if (refreshToken) {
    const refreshed = await refreshWithSingleFlight(refreshToken);
    if (refreshed) {
      const response = NextResponse.json(
        { access_token: refreshed.access_token },
        { status: 200 }
      );
      applyAuthCookies(response, refreshed);
      return response;
    }
  }

  const response = NextResponse.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message: "Sesi autentikasi tidak ditemukan",
        details: null,
      },
    },
    { status: 401 }
  );
  clearAuthCookies(response);
  return response;
}
