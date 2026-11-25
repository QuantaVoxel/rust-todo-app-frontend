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
    <div
      title="Priority votes"
      className="inline-flex h-7 items-center overflow-hidden rounded-[6px] border border-hairline bg-canvas"
    >
      <button
        type="button"
        onClick={() => handleToggle("up")}
        aria-label="Upvote task"
        className={cn(
          "inline-flex h-full items-center gap-1 px-2 font-mono text-[11px] tabular-nums transition-precision cursor-pointer focus-ring",
          myVote === "up"
            ? "bg-accent-tint text-accent font-semibold"
            : "text-ink-secondary hover:bg-subtle hover:text-ink-primary"
        )}
      >
        <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span>{votes?.up ?? 0}</span>
      </button>

      <span className="h-4 w-px bg-hairline" />

      <button
        type="button"
        onClick={() => handleToggle("down")}
        aria-label="Downvote task"
        className={cn(
          "inline-flex h-full items-center gap-1 px-2 font-mono text-[11px] tabular-nums transition-precision cursor-pointer focus-ring",
          myVote === "down"
            ? "bg-danger-tint text-danger font-semibold"
            : "text-ink-secondary hover:bg-subtle hover:text-ink-primary"
        )}
      >
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span>{votes?.down ?? 0}</span>
      </button>
    </div>
  );
}
