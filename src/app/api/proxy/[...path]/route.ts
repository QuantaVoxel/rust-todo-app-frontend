import { NextResponse, type NextRequest } from "next/server";
import type { AuthTokenResponse } from "@/lib/api/types";
import {
  applyAuthCookies,
  clearAuthCookies,
  getSessionTokens,
  refreshWithSingleFlight,
  RUST_API_V1,
} from "@/lib/auth/session";

const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "etag",
  "cache-control",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
];

async function forwardToBackend(
  request: NextRequest,
  targetUrl: string,
  accessToken: string | undefined,
  rawBody: ArrayBuffer | undefined
): Promise<Response> {
  const headers = new Headers();

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const accept = request.headers.get("accept");
  if (accept) {
    headers.set("accept", accept);
  }

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) {
    headers.set("if-none-match", ifNoneMatch);
  }

  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  return fetch(targetUrl, {
    method: request.method,
    headers,
    body: rawBody && rawBody.byteLength > 0 ? rawBody : undefined,
    cache: "no-store",
  });
}

function buildProxyResponse(
  backendRes: Response,
  bodyBuffer: ArrayBuffer,
  refreshedTokens: AuthTokenResponse | null,
  shouldClearCookies: boolean
): NextResponse {
  const response =
    backendRes.status === 204 || backendRes.status === 304
      ? new NextResponse(null, { status: backendRes.status })
      : new NextResponse(bodyBuffer, { status: backendRes.status });

  for (const headerName of FORWARDED_RESPONSE_HEADERS) {
    const val = backendRes.headers.get(headerName);
    if (val) {
      response.headers.set(headerName, val);
    }
  }

  if (refreshedTokens) {
    applyAuthCookies(response, refreshedTokens);
  } else if (shouldClearCookies) {
    clearAuthCookies(response);
  }

  return response;
}

async function handleProxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await context.params;
  const joinedPath = path.join("/");
  const search = request.nextUrl.search;
  const targetUrl = `${RUST_API_V1}/${joinedPath}${search}`;

  const rawBody =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const { accessToken, refreshToken } = await getSessionTokens();

  try {
    let backendRes = await forwardToBackend(
      request,
      targetUrl,
      accessToken,
      rawBody
    );
    let refreshedTokens: AuthTokenResponse | null = null;
    let shouldClearCookies = false;

    if (backendRes.status === 401 && refreshToken) {
      refreshedTokens = await refreshWithSingleFlight(refreshToken);
      if (refreshedTokens) {
        backendRes = await forwardToBackend(
          request,
          targetUrl,
          refreshedTokens.access_token,
          rawBody
        );
      } else {
        shouldClearCookies = true;
      }
    }

    const bodyBuffer =
      backendRes.status === 204 || backendRes.status === 304
        ? new ArrayBuffer(0)
        : await backendRes.arrayBuffer();

    return buildProxyResponse(
      backendRes,
      bodyBuffer,
      refreshedTokens,
      shouldClearCookies
    );
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

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
