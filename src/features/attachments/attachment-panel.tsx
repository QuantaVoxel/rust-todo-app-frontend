"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Link2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { AttachmentResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, resolveAssetUrl } from "@/lib/utils/format";

export const attachmentKeys = {
  list: (taskId: number) => ["tasks", taskId, "attachments"] as const,
};

function isImageAttachment(att: AttachmentResponse): boolean {
  if (att.file_type?.toLowerCase().startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(att.file_url);
}

export function AttachmentPanel({
  taskId,
  canEdit,
}: {
  taskId: number;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileUrl, setFileUrl] = useState("");
  const [fileType, setFileType] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: attachmentKeys.list(taskId),
    queryFn: () =>
      apiFetch<AttachmentResponse[]>(endpoints.taskAttachments(taskId)),
  });

  const uploadFile = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch<AttachmentResponse>(endpoints.taskAttachments(taskId), {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: attachmentKeys.list(taskId) });
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof ApiClientError ? err.message : "File upload failed."
      );
    },
  });

  const attachUrl = useMutation({
    mutationFn: () =>
      apiFetch<AttachmentResponse>(endpoints.taskAttachments(taskId), {
        method: "POST",
        body: {
          file_url: fileUrl.trim(),
          file_type: fileType.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setFileUrl("");
      setFileType("");
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: attachmentKeys.list(taskId) });
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof ApiClientError ? err.message : "Failed to link URL."
      );
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: (attachmentId: number) =>
      apiFetch<string>(endpoints.attachment(attachmentId), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attachmentKeys.list(taskId) });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile.mutate(file);
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (!canEdit) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFile.mutate(file);
    }
  };

  return (
    <section className="space-y-3">
      {canEdit && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-[12px] font-medium transition-precision cursor-pointer",
                mode === "upload"
                  ? "border-strong bg-subtle text-ink-primary"
                  : "border-hairline bg-canvas text-ink-muted hover:text-ink-secondary"
              )}
            >
              <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Upload file</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("url")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-[12px] font-medium transition-precision cursor-pointer",
                mode === "url"
                  ? "border-strong bg-subtle text-ink-primary"
                  : "border-hairline bg-canvas text-ink-muted hover:text-ink-secondary"
              )}
            >
              <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Link external URL</span>
            </button>
          </div>

          {mode === "upload" ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-[8px] border border-dashed px-4 py-5 text-center transition-precision",
                isDragging
                  ? "border-accent bg-accent-tint/40"
                  : "border-strong bg-canvas hover:bg-subtle/50"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
              />
              <Upload
                className="mb-1.5 h-4 w-4 text-ink-muted"
                strokeWidth={1.75}
              />
              <p className="text-[12px] font-medium text-ink-primary">
                {uploadFile.isPending
                  ? "Uploading file..."
                  : "Drop a file here or click to browse"}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                Images, PDFs, or documents
              </p>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!fileUrl.trim()) return;
                attachUrl.mutate();
              }}
              className="space-y-2 rounded-[6px] border border-hairline bg-canvas p-3"
            >
              <Input
                type="url"
                placeholder="https://cdn.example.com/document.pdf"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                className="h-8 text-[12px]"
              />
              <div className="flex items-center gap-2">
                <Input
                  placeholder="MIME type (optional, e.g. application/pdf)"
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="h-8 flex-1 text-[12px]"
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!fileUrl.trim() || attachUrl.isPending}
                >
                  Attach
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {errorMsg && <p className="text-[12px] text-danger">{errorMsg}</p>}

      {isLoading ? (
        <Skeleton className="h-14 w-full" />
      ) : attachments.length === 0 ? (
        <p className="rounded-[6px] border border-hairline bg-canvas px-3 py-2.5 text-[12px] text-ink-muted">
          No attachments yet.
        </p>
      ) : (
        <div className="divide-y divide-hairline rounded-[6px] border border-hairline bg-canvas">
          {attachments.map((att) => {
            const fullUrl = resolveAssetUrl(att.file_url);
            const isImage = isImageAttachment(att);
            const filename = att.file_url.split("/").pop() ?? att.file_url;

            return (
              <div
                key={att.attachment_id}
                className="flex items-center gap-3 p-2.5"
              >
                {isImage ? (
                  <button
                    type="button"
                    onClick={() => setPreviewUrl(fullUrl)}
                    className="h-10 w-10 shrink-0 overflow-hidden rounded-[4px] border border-hairline bg-subtle cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fullUrl}
                      alt={filename}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] border border-hairline bg-subtle text-ink-muted">
                    <FileText className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <a
                    href={fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 truncate text-[12px] font-medium text-ink-primary hover:text-accent"
                  >
                    <span className="truncate">{filename}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" strokeWidth={1.75} />
                  </a>
                  <p className="font-mono text-[11px] text-ink-muted tabular-nums">
                    {att.file_type ?? "file"} · {formatDateTime(att.uploaded_at)}
                  </p>
                </div>

                {canEdit && (
                  <button
                    type="button"
                    aria-label="Delete attachment"
                    onClick={() => deleteAttachment.mutate(att.attachment_id)}
                    className="rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Simple Image Lightbox */}
      <Dialog
        open={Boolean(previewUrl)}
        onOpenChange={(o) => !o && setPreviewUrl(null)}
      >
        <DialogContent className="max-w-2xl p-3">
          <DialogTitle className="sr-only">Attachment preview</DialogTitle>
          {previewUrl && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewUrl}
              alt="Attachment preview"
              className="max-h-[75vh] w-full rounded-[6px] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
