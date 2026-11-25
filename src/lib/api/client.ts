import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ApiErrorDetail, ApiErrorResponse } from "./types";

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: ApiErrorDetail[] | null;
  public readonly rateLimitReset?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    details: ApiErrorDetail[] | null = null,
    rateLimitReset?: number
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.rateLimitReset = rateLimitReset;
  }
}

/**
 * Unwrap Rust backend responses uniformly:
 * - Standard endpoints wrap in `{ data: T }`
 * - Root-level endpoints (`/auth/login`, `/auth/register`, `/auth/refresh`, `POST /tasks`)
 *   return `T` directly.
 * - Paginated endpoints (`{ data: T[], meta: ... }`) are preserved as-is.
 */
export function unwrapData<T>(payload: { data?: T } | T): T {
  if (
    payload !== null &&
    typeof payload === "object" &&
    "data" in payload &&
    !("meta" in payload)
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

/**
 * Map `400 VALIDATION_ERROR` field details directly into React Hook Form.
 */
export function applyApiValidationErrors<TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>
): boolean {
  if (!(error instanceof ApiClientError)) return false;
  if (!error.details || error.details.length === 0) return false;

  for (const detail of error.details) {
    setError(detail.field as Path<TFieldValues>, {
      type: "server",
      message: detail.issue,
    });
  }
  return true;
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Client-side fetch wrapper targeting the Next.js BFF proxy `/api/proxy/...`.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `/api/proxy${normalizedPath}`;

  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;

  if (options.body instanceof FormData) {
    // Let the browser set multipart/form-data boundary automatically
    body = options.body;
  } else if (options.body !== undefined) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    body,
    credentials: "same-origin",
  });

  if (!response.ok) {
    let errorCode = "INTERNAL_ERROR";
    let errorMessage = `Request failed with status ${response.status}`;
    let errorDetails: ApiErrorDetail[] | null = null;

    try {
      const json = (await response.json()) as Partial<ApiErrorResponse>;
      if (json?.error) {
        errorCode = json.error.code ?? errorCode;
        errorMessage = json.error.message ?? errorMessage;
        errorDetails = json.error.details ?? null;
      }
    } catch {
      // Fallback if response body is not JSON
    }

    const resetHeader = response.headers.get("X-RateLimit-Reset");
    const rateLimitReset = resetHeader ? Number(resetHeader) : undefined;

    throw new ApiClientError(
      response.status,
      errorCode,
      errorMessage,
      errorDetails,
      Number.isFinite(rateLimitReset) ? rateLimitReset : undefined
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  const parsed = JSON.parse(text) as unknown;
  return unwrapData<T>(parsed as { data?: T } | T);
}
