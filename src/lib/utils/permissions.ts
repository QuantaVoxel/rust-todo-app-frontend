import type { SharePermission } from "@/lib/api/types";

export type TaskAccessLevel = "owner" | SharePermission;

export interface TaskPermissions {
  level: TaskAccessLevel;
  canView: boolean;
  canVote: boolean;
  canComment: boolean;
  canEditTask: boolean;
  canManageSubtasksAndNotes: boolean;
  canManageSharing: boolean;
  canArchive: boolean;
  canDeleteTask: boolean;
  canDeleteAnyComment: boolean;
}

/**
 * Compute UI capabilities for a user on a task, strictly matching
 * the Rust backend RBAC matrix in PRD.md & tasks/services.rs.
 */
export function getTaskPermissions(
  taskOwnerId: number,
  currentUserId: number | null | undefined,
  sharedPermission?: SharePermission | string | null
): TaskPermissions {
  if (currentUserId && taskOwnerId === currentUserId) {
    return {
      level: "owner",
      canView: true,
      canVote: true,
      canComment: true,
      canEditTask: true,
      canManageSubtasksAndNotes: true,
      canManageSharing: true,
      canArchive: true,
      canDeleteTask: true,
      canDeleteAnyComment: true,
    };
  }

  const normalized = sharedPermission?.toLowerCase() as
    | SharePermission
    | undefined;

  if (normalized === "edit") {
    return {
      level: "edit",
      canView: true,
      canVote: true,
      canComment: true,
      canEditTask: true,
      canManageSubtasksAndNotes: true,
      canManageSharing: false,
      canArchive: false,
      canDeleteTask: false,
      canDeleteAnyComment: false,
    };
  }

  if (normalized === "comment") {
    return {
      level: "comment",
      canView: true,
      canVote: true,
      canComment: true,
      canEditTask: false,
      canManageSubtasksAndNotes: false,
      canManageSharing: false,
      canArchive: false,
      canDeleteTask: false,
      canDeleteAnyComment: false,
    };
  }

  return {
    level: "view",
    canView: true,
    canVote: true,
    canComment: false,
    canEditTask: false,
    canManageSubtasksAndNotes: false,
    canManageSharing: false,
    canArchive: false,
    canDeleteTask: false,
    canDeleteAnyComment: false,
  };
}

export function canEditComment(
  commentUserId: number,
  currentUserId: number | null | undefined
): boolean {
  return Boolean(currentUserId && commentUserId === currentUserId);
}

export function canDeleteComment(
  commentUserId: number,
  taskOwnerId: number,
  currentUserId: number | null | undefined
): boolean {
  if (!currentUserId) return false;
  return commentUserId === currentUserId || taskOwnerId === currentUserId;
}
