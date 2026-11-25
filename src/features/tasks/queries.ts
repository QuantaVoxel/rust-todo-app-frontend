import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  ArchiveTaskResponse,
  CategoryResponse,
  CreateTaskRequest,
  EnumLookups,
  LabelResponse,
  PaginatedResponse,
  ProgressResponse,
  TagResponse,
  TaskListQuery,
  TaskPriorityLookup,
  TaskResponse,
  TaskShareResponse,
  TaskStatusLookup,
  UpdateTaskRequest,
  UserMeResponse,
  UserSearchResult,
} from "@/lib/api/types";

export const lookupKeys = {
  statuses: ["lookups", "statuses"] as const,
  priorities: ["lookups", "priorities"] as const,
  enums: ["lookups", "enums"] as const,
  tags: ["classifications", "tags"] as const,
  categories: ["classifications", "categories"] as const,
  labels: ["classifications", "labels"] as const,
  me: ["users", "me"] as const,
};

export const taskKeys = {
  all: ["tasks"] as const,
  list: (query: TaskListQuery) => ["tasks", "list", query] as const,
  detail: (taskId: number) => ["tasks", "detail", taskId] as const,
  shares: (taskId: number) => ["tasks", "shares", taskId] as const,
};

export function useCurrentUser() {
  return useQuery({
    queryKey: lookupKeys.me,
    queryFn: () => apiFetch<UserMeResponse>(endpoints.me()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserDirectory() {
  const { data: me } = useCurrentUser();
  const { data: users = [] } = useQuery({
    queryKey: ["users", "directory"],
    queryFn: () => apiFetch<UserSearchResult[]>(endpoints.usersSearch()),
    staleTime: 5 * 60 * 1000,
  });

  const userMap = new Map<number, { username: string; email: string }>();
  if (me) {
    userMap.set(me.user_id, { username: me.username, email: me.email });
  }
  for (const u of users) {
    userMap.set(u.user_id, { username: u.username, email: u.email });
  }

  return userMap;
}

export function useStatusesLookup() {
  return useQuery({
    queryKey: lookupKeys.statuses,
    queryFn: () => apiFetch<TaskStatusLookup[]>(endpoints.statuses()),
    staleTime: Infinity,
  });
}

export function usePrioritiesLookup() {
  return useQuery({
    queryKey: lookupKeys.priorities,
    queryFn: () => apiFetch<TaskPriorityLookup[]>(endpoints.priorities()),
    staleTime: Infinity,
  });
}

export function useEnumsLookup() {
  return useQuery({
    queryKey: lookupKeys.enums,
    queryFn: () => apiFetch<EnumLookups>(endpoints.enums()),
    staleTime: Infinity,
  });
}

export function useTagsList() {
  return useQuery({
    queryKey: lookupKeys.tags,
    queryFn: () => apiFetch<TagResponse[]>(endpoints.tags()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategoriesList() {
  return useQuery({
    queryKey: lookupKeys.categories,
    queryFn: () => apiFetch<CategoryResponse[]>(endpoints.categories()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useLabelsList() {
  return useQuery({
    queryKey: lookupKeys.labels,
    queryFn: () => apiFetch<LabelResponse[]>(endpoints.labels()),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTasksList(query: TaskListQuery) {
  return useQuery({
    queryKey: taskKeys.list(query),
    queryFn: () =>
      apiFetch<PaginatedResponse<TaskResponse>>(endpoints.tasks(query)),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useTaskDetail(taskId: number | null) {
  return useQuery({
    queryKey: taskId ? taskKeys.detail(taskId) : ["tasks", "detail", "none"],
    queryFn: () => apiFetch<TaskResponse>(endpoints.task(taskId!)),
    enabled: Boolean(taskId),
  });
}

export function useTaskShares(taskId: number | null, enabled = true) {
  return useQuery({
    queryKey: taskId ? taskKeys.shares(taskId) : ["tasks", "shares", "none"],
    queryFn: () => apiFetch<TaskShareResponse[]>(endpoints.taskShares(taskId!)),
    enabled: Boolean(taskId) && enabled,
    staleTime: 60 * 1000,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskRequest) =>
      apiFetch<TaskResponse>(endpoints.tasks(), {
        method: "POST",
        body: payload,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      taskId: number;
      payload: UpdateTaskRequest;
    }) =>
      apiFetch<TaskResponse>(endpoints.task(taskId), {
        method: "PATCH",
        body: payload,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(taskKeys.detail(updated.task_id), updated);
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useUpdateTaskProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      progress_percentage,
    }: {
      taskId: number;
      progress_percentage: number;
    }) =>
      apiFetch<ProgressResponse>(endpoints.taskProgress(taskId), {
        method: "PUT",
        body: { progress_percentage },
      }),
    onSuccess: (res) => {
      queryClient.setQueryData<TaskResponse>(
        taskKeys.detail(res.task_id),
        (prev) =>
          prev ? { ...prev, progress_percentage: res.progress_percentage } : prev
      );
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useArchiveTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, archived }: { taskId: number; archived: boolean }) =>
      apiFetch<ArchiveTaskResponse>(
        archived ? endpoints.taskUnarchive(taskId) : endpoints.taskArchive(taskId),
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: number) =>
      apiFetch<string>(endpoints.task(taskId), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
