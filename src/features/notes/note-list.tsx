"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { NoteHistoryResponse, NoteResponse } from "@/lib/api/types";
import { formatDateTime } from "@/lib/utils/format";

export const noteKeys = {
  list: (taskId: number) => ["tasks", taskId, "notes"] as const,
  history: (noteId: number) => ["notes", noteId, "history"] as const,
};

export function NoteList({
  taskId,
  canEdit,
}: {
  taskId: number;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [newContent, setNewContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<NoteResponse | null>(null);
  const [editContent, setEditContent] = useState("");
  const [historyNoteId, setHistoryNoteId] = useState<number | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: noteKeys.list(taskId),
    queryFn: () => apiFetch<NoteResponse[]>(endpoints.taskNotes(taskId)),
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: historyNoteId ? noteKeys.history(historyNoteId) : ["notes", "none"],
    queryFn: () => apiFetch<NoteHistoryResponse[]>(endpoints.noteHistory(historyNoteId!)),
    enabled: Boolean(historyNoteId),
  });

  const createNote = useMutation({
    mutationFn: (content: string) =>
      apiFetch<NoteResponse>(endpoints.taskNotes(taskId), {
        method: "POST",
        body: { content },
      }),
    onSuccess: () => {
      setNewContent("");
      setFormError(null);
      queryClient.invalidateQueries({ queryKey: noteKeys.list(taskId) });
    },
    onError: (err) => {
      setFormError(
        err instanceof ApiClientError ? err.message : "Failed to save note."
      );
    },
  });

  const updateNote = useMutation({
    mutationFn: ({ noteId, content }: { noteId: number; content: string }) =>
      apiFetch<NoteResponse>(endpoints.note(noteId), {
        method: "PATCH",
        body: { content },
      }),
    onSuccess: (_, vars) => {
      setEditingNote(null);
      queryClient.invalidateQueries({ queryKey: noteKeys.list(taskId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.history(vars.noteId) });
    },
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: number) =>
      apiFetch<string>(endpoints.note(noteId), { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.list(taskId) });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newContent.trim();
    if (!trimmed) {
      setFormError("Note content is required.");
      return;
    }
    createNote.mutate(trimmed);
  };

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold text-ink-secondary">Notes</h3>
        {notes.length > 0 && (
          <span className="font-mono text-[11px] text-ink-muted tabular-nums">
            {notes.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="space-y-2">
          {notes.length === 0 ? (
            <p className="rounded-[6px] border border-hairline bg-canvas px-3 py-2.5 text-[12px] text-ink-muted">
              No internal notes yet.
            </p>
          ) : (
            notes.map((note) => {
              const isEditing = editingNote?.note_id === note.note_id;
              return (
                <div
                  key={note.note_id}
                  className="rounded-[6px] border border-hairline bg-canvas p-3 space-y-2"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        rows={3}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full rounded-[6px] border border-strong bg-surface p-2 text-[13px] text-ink-primary focus-ring"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingNote(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={!editContent.trim() || updateNote.isPending}
                          onClick={() =>
                            updateNote.mutate({
                              noteId: note.note_id,
                              content: editContent.trim(),
                            })
                          }
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-primary">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-ink-muted">
                        <span className="font-mono tabular-nums">
                          {formatDateTime(note.updated_at)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setHistoryNoteId(note.note_id)}
                            className="inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 hover:bg-subtle hover:text-ink-primary cursor-pointer"
                            title="View version history"
                          >
                            <History className="h-3 w-3" strokeWidth={1.75} />
                            <span>History</span>
                          </button>
                          {canEdit && (
                            <>
                              <button
                                type="button"
                                aria-label="Edit note"
                                onClick={() => {
                                  setEditingNote(note);
                                  setEditContent(note.content);
                                }}
                                className="rounded-[4px] p-1 hover:bg-subtle hover:text-ink-primary cursor-pointer"
                              >
                                <Pencil className="h-3 w-3" strokeWidth={1.75} />
                              </button>
                              <button
                                type="button"
                                aria-label="Delete note"
                                onClick={() => deleteNote.mutate(note.note_id)}
                                className="rounded-[4px] p-1 hover:bg-subtle hover:text-danger cursor-pointer"
                              >
                                <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}

          {canEdit && (
            <form onSubmit={handleCreate} className="space-y-1.5">
              <textarea
                rows={2}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="Write a note..."
                className="w-full rounded-[6px] border border-hairline bg-canvas px-3 py-2 text-[13px] text-ink-primary placeholder:text-ink-muted focus:border-strong focus:bg-surface focus-ring"
              />
              {formError && (
                <p className="text-[12px] text-danger">{formError}</p>
              )}
              {newContent.trim() && (
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    disabled={createNote.isPending}
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Save note
                  </Button>
                </div>
              )}
            </form>
          )}
        </div>
      )}

      {/* Note Version History Modal */}
      <Dialog
        open={Boolean(historyNoteId)}
        onOpenChange={(o) => !o && setHistoryNoteId(null)}
      >
        <DialogContent className="max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Note version history</DialogTitle>
            <DialogDescription>
              Previous revisions recorded automatically on edit.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[340px] space-y-2.5 overflow-y-auto">
            {historyLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : history.length === 0 ? (
              <p className="text-[13px] text-ink-muted">
                No previous revisions for this note.
              </p>
            ) : (
              history.map((entry) => (
                <div
                  key={entry.history_id}
                  className="rounded-[6px] border border-hairline bg-canvas p-3 space-y-1.5"
                >
                  <p className="font-mono text-[11px] text-ink-muted tabular-nums">
                    {formatDateTime(entry.changed_at)}
                  </p>
                  <p className="whitespace-pre-wrap text-[13px] text-ink-secondary">
                    {entry.old_content}
                  </p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
