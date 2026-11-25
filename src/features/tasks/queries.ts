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
  CreateTaskRequest,
  PaginatedResponse,
  ProgressResponse,
  TaskListQuery,
  TaskPriorityLookup,
  TaskResponse,
  TaskStatusLookup,
  UpdateTaskRequest,
  UserMeResponse,
} from "@/lib/api/types";

export const lookupKeys = {
  statuses: ["lookups", "statuses"] as const,
  priorities: ["lookups", "priorities"] as const,
  me: ["users", "me"] as const,
};

export const taskKeys = {
  all: ["tasks"] as const,
  list: (query: TaskListQuery) => ["tasks", "list", query] as const,
  detail: (taskId: number) => ["tasks", "detail", taskId] as const,
};

export function useCurrentUser() {
  return useQuery({
    queryKey: lookupKeys.me,
    queryFn: () => apiFetch<UserMeResponse>(endpoints.me()),
    staleTime: 5 * 60 * 1000,
  });
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

export function useTasksList(query: TaskListQuery) {
  return useQuery({
    queryKey: taskKeys.list(query),
    queryFn: () => apiFetch<PaginatedResponse<TaskResponse>>(endpoints.tasks(query)),
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
    onSuccess: () => {
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
