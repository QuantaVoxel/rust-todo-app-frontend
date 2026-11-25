import type { TaskListQuery } from "./types";

function buildQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      sp.set(key, String(value));
    }
  }
  const str = sp.toString();
  return str ? `?${str}` : "";
}

export const endpoints = {
  // System
  healthReady: () => "/health/ready",
  metrics: () => "/metrics",
  seedDemo: () => "/seed/demo",

  // Auth
  register: () => "/auth/register",
  login: () => "/auth/login",
  refresh: () => "/auth/refresh",
  logout: () => "/auth/logout",
  changePassword: () => "/auth/change-password",

  // Users, Profile, Settings
  usersSearch: (search?: string) => `/users${buildQuery({ search })}`,
  me: () => "/users/me",
  meProfile: () => "/users/me/profile",
  meSettings: () => "/users/me/settings",
  meSettingKey: (key: string) =>
    `/users/me/settings/${encodeURIComponent(key)}`,

  // Lookups
  statuses: () => "/statuses",
  priorities: () => "/priorities",
  externalApps: () => "/external-apps",
  enums: () => "/enums",

  // Tasks Core
  tasks: (query?: TaskListQuery) =>
    `/tasks${query ? buildQuery(query as Record<string, unknown>) : ""}`,
  task: (taskId: number) => `/tasks/${taskId}`,
  taskArchive: (taskId: number) => `/tasks/${taskId}/archive`,
  taskUnarchive: (taskId: number) => `/tasks/${taskId}/unarchive`,
  taskProgress: (taskId: number) => `/tasks/${taskId}/progress`,

  // Subtasks
  taskSubtasks: (taskId: number) => `/tasks/${taskId}/subtasks`,
  subtask: (subtaskId: number) => `/subtasks/${subtaskId}`,

  // Notes
  taskNotes: (taskId: number) => `/tasks/${taskId}/notes`,
  note: (noteId: number) => `/notes/${noteId}`,
  noteHistory: (noteId: number) => `/notes/${noteId}/history`,

  // Comments
  taskComments: (taskId: number) => `/tasks/${taskId}/comments`,
  comment: (commentId: number) => `/comments/${commentId}`,

  // Attachments
  taskAttachments: (taskId: number) => `/tasks/${taskId}/attachments`,
  attachment: (attachmentId: number) => `/attachments/${attachmentId}`,

  // Reminders
  taskReminders: (taskId: number) => `/tasks/${taskId}/reminders`,
  reminder: (reminderId: number) => `/reminders/${reminderId}`,

  // Recurrence
  taskRecurrence: (taskId: number) => `/tasks/${taskId}/recurrence`,

  // Locations
  locations: () => "/locations",
  taskLocations: (taskId: number) => `/tasks/${taskId}/locations`,
  taskLocation: (taskId: number, locationId: number) =>
    `/tasks/${taskId}/locations/${locationId}`,

  // Sharing & Votes
  taskShares: (taskId: number) => `/tasks/${taskId}/shares`,
  taskShareUser: (taskId: number, userId: number) =>
    `/tasks/${taskId}/shares/${userId}`,
  taskVotes: (taskId: number) => `/tasks/${taskId}/votes`,
  taskVote: (taskId: number) => `/tasks/${taskId}/vote`,

  // Audit History
  taskHistoryStatus: (taskId: number) => `/tasks/${taskId}/history/status`,
  taskHistoryPriority: (taskId: number) => `/tasks/${taskId}/history/priority`,
  taskHistoryLabels: (taskId: number) => `/tasks/${taskId}/history/labels`,

  // Integrations
  taskIntegrations: (taskId: number) => `/tasks/${taskId}/integrations`,
  integration: (integrationId: number) => `/integrations/${integrationId}`,

  // Classifications
  tags: () => "/tags",
  tag: (tagId: number, force = false) =>
    `/tags/${tagId}${force ? "?force=true" : ""}`,
  taskTag: (taskId: number, tagId: number) => `/tasks/${taskId}/tags/${tagId}`,

  categories: () => "/categories",
  category: (categoryId: number, force = false) =>
    `/categories/${categoryId}${force ? "?force=true" : ""}`,
  taskCategory: (taskId: number, categoryId: number) =>
    `/tasks/${taskId}/categories/${categoryId}`,

  labels: () => "/labels",
  label: (labelId: number, force = false) =>
    `/labels/${labelId}${force ? "?force=true" : ""}`,
  taskLabel: (taskId: number, labelId: number) =>
    `/tasks/${taskId}/labels/${labelId}`,

  // Connections
  connections: (status?: string) => `/connections${buildQuery({ status })}`,
  connection: (connectionId: number) => `/connections/${connectionId}`,

  // Notifications
  notifications: (isRead?: boolean) =>
    `/notifications${buildQuery({ is_read: isRead })}`,
  notificationsUnreadCount: () => "/notifications/unread-count",
  notification: (notificationId: number) => `/notifications/${notificationId}`,
  notificationsReadAll: () => "/notifications/read-all",

  // Activity Logs
  activityLogs: (params?: Record<string, unknown>) =>
    `/activity-logs${params ? buildQuery(params) : ""}`,
} as const;
