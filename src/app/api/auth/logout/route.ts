import { NextResponse } from "next/server";
import {
  clearAuthCookies,
  getSessionTokens,
  RUST_API_V1,
} from "@/lib/auth/session";

export async function POST() {
  const { accessToken, refreshToken } = await getSessionTokens();

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    await fetch(`${RUST_API_V1}/auth/logout`, {
      method: "POST",
      headers,
      body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
      cache: "no-store",
    });
  } catch {
    // Always clear cookies even if backend is unreachable
  }

  const response = NextResponse.json({ data: "Logout berhasil" }, { status: 200 });
  clearAuthCookies(response);
  return response;
}
