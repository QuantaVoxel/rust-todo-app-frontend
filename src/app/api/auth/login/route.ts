import { NextResponse } from "next/server";
import type { AuthTokenResponse } from "@/lib/api/types";
import { applyAuthCookies, RUST_API_V1 } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const backendRes = await fetch(`${RUST_API_V1}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await backendRes.json();

    if (!backendRes.ok) {
      return NextResponse.json(data, { status: backendRes.status });
    }

    const tokens = data as AuthTokenResponse;
    const response = NextResponse.json(
      {
        user: tokens.user,
        expires_in: tokens.expires_in,
      },
      { status: 200 }
    );

    applyAuthCookies(response, tokens);
    return response;
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "BAD_GATEWAY",
          message: "Tidak dapat terhubung ke server backend",
          details: null,
        },
      },
      { status: 502 }
    );
  }
}
