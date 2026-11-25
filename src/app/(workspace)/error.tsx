"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[8px] border border-danger/30 bg-danger-tint text-danger">
        <AlertTriangle className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <h2 className="text-[16px] font-semibold text-ink-primary">
        Something went wrong
      </h2>
      <p className="mt-1 max-w-sm text-[13px] text-ink-secondary">
        {error.message || "An unexpected error occurred while loading this view."}
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="mt-4"
        onClick={reset}
      >
        <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span>Retry</span>
      </Button>
    </div>
  );
}
