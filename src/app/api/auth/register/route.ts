import { NextResponse } from "next/server";
import { RUST_API_V1 } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const backendRes = await fetch(`${RUST_API_V1}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
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
