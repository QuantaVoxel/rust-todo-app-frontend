"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { CommentResponse } from "@/lib/api/types";
import { formatDateTime } from "@/lib/utils/format";
import { canDeleteComment, canEditComment } from "@/lib/utils/permissions";

export const commentKeys = {
  list: (taskId: number) => ["tasks", taskId, "comments"] as const,
};

export function CommentThread({
  taskId,
  taskOwnerId,
  currentUserId,
  canComment,
}: {
  taskId: number;
  taskOwnerId: number;
  currentUserId?: number | null;
  canComment: boolean;
}) {
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBody, setEditBody] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: commentKeys.list(taskId),
    queryFn: () => apiFetch<CommentResponse[]>(endpoints.taskComments(taskId)),
  });

  const createComment = useMutation({
    mutationFn: (comment: string) =>
      apiFetch<CommentResponse>(endpoints.taskComments(taskId), {
        method: "POST",
        body: { comment },
      }),
    onSuccess: () => {
      setNewComment("");
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
    onError: (err) => {
      setFormError(
        err instanceof ApiClientError ? err.message : "Failed to post comment."
      );
    },
  });

  const updateComment = useMutation({
    mutationFn: ({ commentId, comment }: { commentId: number; comment: string }) =>
      apiFetch<CommentResponse>(endpoints.comment(commentId), {
        method: "PATCH",
        body: { comment },
      }),
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
  });

  const deleteComment = useMutation({
    mutationFn: (commentId: number) =>
      apiFetch<string>(endpoints.comment(commentId), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentKeys.list(taskId) });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) {
      setFormError("Comment cannot be empty.");
      return;
    }
    createComment.mutate(trimmed);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold text-ink-secondary">
          Comments
        </h3>
        {comments.length > 0 && (
          <span className="font-mono text-[11px] text-ink-muted tabular-nums">
            {comments.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : comments.length === 0 ? (
        <p className="rounded-[6px] border border-hairline bg-canvas px-3 py-2.5 text-[12px] text-ink-muted">
          No comments yet.
        </p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => {
            const isAuthor = canEditComment(c.user_id, currentUserId);
            const allowDelete = canDeleteComment(
              c.user_id,
              taskOwnerId,
              currentUserId
            );
            const isEditing = editingId === c.comment_id;

            return (
              <div
                key={c.comment_id}
                className="rounded-[6px] border border-hairline bg-canvas p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[11px] text-ink-muted">
                  <span className="font-mono text-ink-secondary tabular-nums">
                    User #{c.user_id}
                  </span>
                  <span className="font-mono tabular-nums">
                    {formatDateTime(c.created_at)}
                  </span>
                </div>

                {isEditing ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      rows={2}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      className="w-full rounded-[6px] border border-strong bg-surface p-2 text-[13px] text-ink-primary focus-ring"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        disabled={!editBody.trim() || updateComment.isPending}
                        onClick={() =>
                          updateComment.mutate({
                            commentId: c.comment_id,
                            comment: editBody.trim(),
                          })
                        }
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-primary">
                      {c.comment}
                    </p>
                    {(isAuthor || allowDelete) && (
                      <div className="flex shrink-0 items-center gap-0.5">
                        {isAuthor && (
                          <button
                            type="button"
                            aria-label="Edit comment"
                            onClick={() => {
                              setEditingId(c.comment_id);
                              setEditBody(c.comment);
                            }}
                            className="rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-ink-primary cursor-pointer"
                          >
                            <Pencil className="h-3 w-3" strokeWidth={1.75} />
                          </button>
                        )}
                        {allowDelete && (
                          <button
                            type="button"
                            aria-label="Delete comment"
                            onClick={() => deleteComment.mutate(c.comment_id)}
                            className="rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canComment ? (
        <form onSubmit={handleSubmit} className="space-y-2">
          <textarea
            rows={2}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="w-full rounded-[6px] border border-hairline bg-canvas px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-muted focus:border-strong focus:bg-surface focus-ring"
          />
          {formError && <p className="text-[12px] text-danger">{formError}</p>}
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!newComment.trim() || createComment.isPending}
            >
              <Send className="h-3 w-3" strokeWidth={1.75} />
              <span>Post comment</span>
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-[12px] text-ink-muted">
          You have view-only access on this task.
        </p>
      )}
    </section>
  );
}
