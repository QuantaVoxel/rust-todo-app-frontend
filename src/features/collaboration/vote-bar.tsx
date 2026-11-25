"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import { apiFetch } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { VoteSummaryResponse, VoteType } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";

export const voteKeys = {
  summary: (taskId: number) => ["tasks", taskId, "votes"] as const,
};

export function VoteBar({ taskId }: { taskId: number }) {
  const queryClient = useQueryClient();

  const { data: votes } = useQuery({
    queryKey: voteKeys.summary(taskId),
    queryFn: () => apiFetch<VoteSummaryResponse>(endpoints.taskVotes(taskId)),
  });

  const castVote = useMutation({
    mutationFn: (vote_type: VoteType) =>
      apiFetch<VoteSummaryResponse>(endpoints.taskVote(taskId), {
        method: "PUT",
        body: { vote_type },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(voteKeys.summary(taskId), updated);
    },
  });

  const removeVote = useMutation({
    mutationFn: () =>
      apiFetch<string>(endpoints.taskVote(taskId), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: voteKeys.summary(taskId) });
    },
  });

  const myVote = votes?.my_vote?.toLowerCase();

  const handleToggle = (type: VoteType) => {
    if (myVote === type) {
      removeVote.mutate();
    } else {
      castVote.mutate(type);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-[8px] border border-hairline bg-canvas px-3 py-2">
      <span className="text-[12px] font-medium text-ink-secondary">
        Priority votes
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleToggle("up")}
          aria-label="Upvote task"
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-[6px] border px-2 font-mono text-[12px] tabular-nums transition-precision cursor-pointer",
            myVote === "up"
              ? "border-accent bg-accent-tint text-accent"
              : "border-hairline bg-surface text-ink-secondary hover:text-ink-primary"
          )}
        >
          <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>{votes?.up ?? 0}</span>
        </button>

        <button
          type="button"
          onClick={() => handleToggle("down")}
          aria-label="Downvote task"
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-[6px] border px-2 font-mono text-[12px] tabular-nums transition-precision cursor-pointer",
            myVote === "down"
              ? "border-danger bg-danger-tint text-danger"
              : "border-hairline bg-surface text-ink-secondary hover:text-ink-primary"
          )}
        >
          <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>{votes?.down ?? 0}</span>
        </button>
      </div>
    </div>
  );
}
