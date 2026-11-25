import { format, isPast, parseISO } from "date-fns";

const ASSET_BASE_URL =
  process.env.NEXT_PUBLIC_ASSET_BASE_URL ?? "http://localhost:8080";

/**
 * Resolve relative `/uploads/{uuid}.{ext}` paths returned by the Rust backend
 * into full URLs pointing to the backend asset origin.
 */
export function resolveAssetUrl(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  const normalizedBase = ASSET_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function formatShortDate(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  try {
    return format(parseISO(isoDate), "dd MMM yyyy");
  } catch {
    return isoDate;
  }
}

export function formatDateTime(isoDate: string | null | undefined): string {
  if (!isoDate) return "";
  try {
    return format(parseISO(isoDate), "dd MMM yyyy, HH:mm");
  } catch {
    return isoDate;
  }
}

export function isOverdue(
  dueDate: string | null | undefined,
  statusName: string | null | undefined
): boolean {
  if (!dueDate) return false;
  if (statusName?.toLowerCase() === "completed") return false;
  if (statusName?.toLowerCase() === "cancelled") return false;
  try {
    return isPast(parseISO(dueDate));
  } catch {
    return false;
  }
}

export function getInitials(
  firstName?: string | null,
  lastName?: string | null,
  fallbackUsername?: string
): string {
  const f = firstName?.trim().charAt(0) ?? "";
  const l = lastName?.trim().charAt(0) ?? "";
  if (f || l) return `${f}${l}`.toUpperCase();
  if (fallbackUsername) return fallbackUsername.slice(0, 2).toUpperCase();
  return "??";
}
