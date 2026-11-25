import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  CreateSubtaskRequest,
  SubtaskResponse,
  UpdateSubtaskRequest,
} from "@/lib/api/types";

export const subtaskKeys = {
  list: (taskId: number) => ["tasks", taskId, "subtasks"] as const,
};

export function useSubtasks(taskId: number | null) {
  return useQuery({
    queryKey: taskId ? subtaskKeys.list(taskId) : ["tasks", "none", "subtasks"],
    queryFn: () => apiFetch<SubtaskResponse[]>(endpoints.taskSubtasks(taskId!)),
    enabled: Boolean(taskId),
  });
}

export function useCreateSubtask(taskId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSubtaskRequest) =>
      apiFetch<SubtaskResponse>(endpoints.taskSubtasks(taskId), {
        method: "POST",
        body: payload,
      }),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: subtaskKeys.list(taskId) });
      const previous = queryClient.getQueryData<SubtaskResponse[]>(
        subtaskKeys.list(taskId)
      );
      const optimistic: SubtaskResponse = {
        subtask_id: -Date.now(),
        task_id: taskId,
        title: payload.title,
        status_id: payload.status_id,
      };
      queryClient.setQueryData<SubtaskResponse[]>(
        subtaskKeys.list(taskId),
        (old = []) => [...old, optimistic]
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(subtaskKeys.list(taskId), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: subtaskKeys.list(taskId) });
    },
  });
}

export function useUpdateSubtask(taskId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      subtaskId,
      payload,
    }: {
      subtaskId: number;
      payload: UpdateSubtaskRequest;
    }) =>
      apiFetch<SubtaskResponse>(endpoints.subtask(subtaskId), {
        method: "PATCH",
        body: payload,
      }),
    onMutate: async ({ subtaskId, payload }) => {
      await queryClient.cancelQueries({ queryKey: subtaskKeys.list(taskId) });
      const previous = queryClient.getQueryData<SubtaskResponse[]>(
        subtaskKeys.list(taskId)
      );
      queryClient.setQueryData<SubtaskResponse[]>(
        subtaskKeys.list(taskId),
        (old = []) =>
          old.map((item) =>
            item.subtask_id === subtaskId ? { ...item, ...payload } : item
          )
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(subtaskKeys.list(taskId), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: subtaskKeys.list(taskId) });
    },
  });
}

export function useDeleteSubtask(taskId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subtaskId: number) =>
      apiFetch<string>(endpoints.subtask(subtaskId), { method: "DELETE" }),
    onMutate: async (subtaskId) => {
      await queryClient.cancelQueries({ queryKey: subtaskKeys.list(taskId) });
      const previous = queryClient.getQueryData<SubtaskResponse[]>(
        subtaskKeys.list(taskId)
      );
      queryClient.setQueryData<SubtaskResponse[]>(
        subtaskKeys.list(taskId),
        (old = []) => old.filter((item) => item.subtask_id !== subtaskId)
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(subtaskKeys.list(taskId), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: subtaskKeys.list(taskId) });
    },
  });
}
