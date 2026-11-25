export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "UNPROCESSABLE_ENTITY"
  | "RATE_LIMITED"
  | "REQUEST_TIMEOUT"
  | "INTERNAL_ERROR"
  | "BAD_GATEWAY"
  | "SERVICE_UNAVAILABLE"
  | "GATEWAY_TIMEOUT";

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

export interface ApiErrorPayload {
  code: ApiErrorCode | string;
  message: string;
  details?: ApiErrorDetail[] | null;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}

export interface ApiResponse<T> {
  data: T;
}

export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PageMeta;
}

// ---------------------------------------------------------------------------
// Auth & Users Module
// ---------------------------------------------------------------------------

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  avatar_url?: string;
}

export interface RegisterResponse {
  user_id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UserSummary {
  user_id: number;
  username: string;
}

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: UserSummary;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token?: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  new_password_confirmation?: string;
}

export interface ProfileResponse {
  profile_id: number;
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  phone_number: string | null;
}

export interface UserMeResponse {
  user_id: number;
  username: string;
  email: string;
  created_at: string;
  updated_at: string;
  profile: ProfileResponse | null;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
}

export interface UpsertProfileRequest {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  phone_number?: string;
}

export interface UserSearchResult {
  user_id: number;
  username: string;
  email: string;
}

export interface UserSettingResponse {
  setting_id: number;
  user_id: number;
  setting_key: string;
  setting_value: string | null;
}

export interface UpsertSettingRequest {
  setting_value: string;
}

// ---------------------------------------------------------------------------
// Lookups & Enums
// ---------------------------------------------------------------------------

export interface TaskStatusLookup {
  status_id: number;
  name: "pending" | "in_progress" | "completed" | "cancelled" | string;
}

export interface TaskPriorityLookup {
  priority_id: number;
  name: "low" | "medium" | "high" | "urgent" | string;
  rank_order: number;
}

export interface ExternalAppLookup {
  app_id: number;
  name: string;
}

export type VoteType = "up" | "down";
export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type SharePermission = "view" | "comment" | "edit";
export type ConnectionStatus = "pending" | "accepted" | "blocked";
export type NotificationType = "reminder" | "comment" | "share" | "system";

export interface EnumLookups {
  vote_type: VoteType[];
  frequency: RecurrenceFrequency[];
  permission: SharePermission[];
  connection_status: ConnectionStatus[];
  notification_type: NotificationType[];
}

// ---------------------------------------------------------------------------
// Tasks Core Module
// ---------------------------------------------------------------------------

export interface TaskResponse {
  task_id: number;
  user_id: number;
  title: string;
  description: string | null;
  status_id: number;
  status: string | null;
  priority_id: number | null;
  priority: string | null;
  progress_percentage: number;
  due_date: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string | null;
  status_id: number;
  priority_id?: number | null;
  progress_percentage?: number;
  due_date?: string | null;
  tag_ids?: number[];
  category_ids?: number[];
  label_ids?: number[];
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string | null;
  status_id?: number;
  priority_id?: number | null;
  due_date?: string | null;
}

export interface UpdateProgressRequest {
  progress_percentage: number;
}

export interface TaskListQuery {
  scope?: "all" | "owned" | "shared";
  archived?: boolean;
  status_id?: number;
  priority_id?: number;
  tag_id?: number;
  category_id?: number;
  label_id?: number;
  due_before?: string;
  due_after?: string;
  search?: string;
  sort?:
    | "due_date"
    | "-due_date"
    | "created_at"
    | "-created_at"
    | "priority"
    | "-priority"
    | "-task_id";
  include?: string;
  page?: number;
  per_page?: number;
}

export interface ArchiveTaskResponse {
  task_id: number;
  archived_at: string | null;
}

export interface ProgressResponse {
  task_id: number;
  progress_percentage: number;
}

// ---------------------------------------------------------------------------
// Subtasks, Notes, Comments, Attachments, Reminders, Recurrence
// ---------------------------------------------------------------------------

export interface SubtaskResponse {
  subtask_id: number;
  task_id: number;
  title: string;
  status_id: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateSubtaskRequest {
  title: string;
  status_id: number;
}

export interface UpdateSubtaskRequest {
  title?: string;
  status_id?: number;
}

export interface NoteResponse {
  note_id: number;
  task_id: number;
  user_id?: number;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface NoteHistoryResponse {
  history_id: number;
  note_id: number;
  old_content: string;
  changed_at: string;
}

export interface CommentResponse {
  comment_id: number;
  task_id: number;
  user_id: number;
  comment: string;
  created_at: string;
  updated_at: string;
}

export interface AttachmentResponse {
  attachment_id: number;
  task_id: number;
  file_url: string;
  file_type: string | null;
  uploaded_at: string;
}

export interface ReminderResponse {
  reminder_id: number;
  task_id: number;
  reminder_time: string;
  notification_sent: boolean;
}

export interface RecurrenceResponse {
  recurrence_id: number;
  task_id: number;
  frequency: string;
  next_due_date: string;
}

// ---------------------------------------------------------------------------
// Locations, Sharing, Votes, Classifications, Integrations
// ---------------------------------------------------------------------------

export interface LocationResponse {
  location_id: number;
  location_name: string;
  latitude: number;
  longitude: number;
}

export interface TaskShareResponse {
  share_id?: number;
  task_id: number;
  user_id: number;
  permission: string;
  username?: string;
  email?: string;
}

export interface VoteSummaryResponse {
  up: number;
  down: number;
  my_vote: string | null;
}

export interface TagResponse {
  tag_id: number;
  name: string;
}

export interface CategoryResponse {
  category_id: number;
  name: string;
  description: string | null;
}

export interface LabelResponse {
  label_id: number;
  name: string;
}

export interface ExternalIntegrationResponse {
  integration_id: number;
  task_id: number;
  app_id: number;
  external_app_task_id: string;
}

// ---------------------------------------------------------------------------
// Audit History, Connections, Notifications, Activity Logs, System
// ---------------------------------------------------------------------------

export interface StatusHistoryEntry {
  history_id: number;
  task_id: number;
  old_status_id: number | null;
  new_status_id: number;
  changed_by?: number;
  changed_at: string;
}

export interface PriorityHistoryEntry {
  history_id: number;
  task_id: number;
  old_priority_id: number | null;
  new_priority_id: number | null;
  changed_by?: number;
  changed_at: string;
}

export interface LabelHistoryEntry {
  history_id: number;
  task_id: number;
  label_id: number;
  action: string;
  changed_by?: number;
  changed_at: string;
}

export interface UserConnectionResponse {
  connection_id: number;
  user_id_1: number;
  user_id_2: number;
  status: string;
  created_at?: string;
}

export interface NotificationResponse {
  notification_id: number;
  user_id: number;
  notification_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface RealtimeNotificationEvent {
  event: "notification.created" | "notification.updated" | "connected" | "pong" | string;
  notification_id?: number;
  user_id?: number;
  notification_type?: string;
  message?: string;
  is_read?: boolean;
  created_at?: string;
  transport?: "websocket" | "sse";
}

export interface UnreadCountResponse {
  unread_count: number;
}

export interface ActivityLogResponse {
  log_id: number;
  user_id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  timestamp: string;
}

export interface HealthReadyResponse {
  status: "ready" | "degraded" | "shutting_down";
  shutting_down: boolean;
  database: {
    connected: boolean;
    latency_ms: number | null;
  };
  uptime_seconds: number;
}
