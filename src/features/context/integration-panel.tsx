"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type {
  ExternalAppLookup,
  ExternalIntegrationResponse,
} from "@/lib/api/types";

export const integrationKeys = {
  apps: ["lookups", "external-apps"] as const,
  task: (taskId: number) => ["tasks", taskId, "integrations"] as const,
};

export function IntegrationPanel({
  taskId,
  canEdit,
}: {
  taskId: number;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [appId, setAppId] = useState<number>(1);
  const [extTaskId, setExtTaskId] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: apps = [] } = useQuery({
    queryKey: integrationKeys.apps,
    queryFn: () => apiFetch<ExternalAppLookup[]>(endpoints.externalApps()),
    staleTime: Infinity,
  });

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: integrationKeys.task(taskId),
    queryFn: () =>
      apiFetch<ExternalIntegrationResponse[]>(endpoints.taskIntegrations(taskId)),
  });

  const createIntegration = useMutation({
    mutationFn: () =>
      apiFetch<ExternalIntegrationResponse>(endpoints.taskIntegrations(taskId), {
        method: "POST",
        body: {
          app_id: appId,
          external_app_task_id: extTaskId.trim(),
        },
      }),
    onSuccess: () => {
      setExtTaskId("");
      setErrorMsg(null);
      queryClient.invalidateQueries({ queryKey: integrationKeys.task(taskId) });
    },
    onError: (err) => {
      setErrorMsg(
        err instanceof ApiClientError
          ? err.message
          : "Failed to link integration."
      );
    },
  });

  const deleteIntegration = useMutation({
    mutationFn: (integrationId: number) =>
      apiFetch<string>(endpoints.integration(integrationId), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.task(taskId) });
    },
  });

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Link2 className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
        <h3 className="text-[12px] font-semibold text-ink-secondary">
          External Integrations
        </h3>
      </div>

      {isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : (
        <div className="space-y-2">
          {integrations.length === 0 ? (
            <p className="rounded-[6px] border border-hairline bg-canvas px-3 py-2 text-[12px] text-ink-muted">
              No external issues linked.
            </p>
          ) : (
            <div className="divide-y divide-hairline rounded-[6px] border border-hairline bg-canvas">
              {integrations.map((intg) => {
                const appName =
                  apps.find((a) => a.app_id === intg.app_id)?.name ??
                  `App #${intg.app_id}`;
                return (
                  <div
                    key={intg.integration_id}
                    className="flex items-center justify-between px-3 py-2 text-[12px]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-[4px] bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-ink-secondary">
                        {appName}
                      </span>
                      <span className="font-mono text-ink-primary">
                        {intg.external_app_task_id}
                      </span>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        aria-label="Disconnect integration"
                        onClick={() =>
                          deleteIntegration.mutate(intg.integration_id)
                        }
                        className="rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
                      >
                        <Unlink className="h-3.5 w-3.5" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {canEdit && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!extTaskId.trim()) return;
                createIntegration.mutate();
              }}
              className="flex items-center gap-2"
            >
              <select
                aria-label="External app"
                value={appId}
                onChange={(e) => setAppId(Number(e.target.value))}
                className="h-8 rounded-[6px] border border-hairline bg-canvas px-2 text-[12px] text-ink-primary focus-ring"
              >
                {apps.map((a) => (
                  <option key={a.app_id} value={a.app_id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder="External ID (e.g., JIRA-104)"
                value={extTaskId}
                onChange={(e) => setExtTaskId(e.target.value)}
                className="h-8 flex-1 font-mono text-[12px]"
              />
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={!extTaskId.trim() || createIntegration.isPending}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                Link
              </Button>
            </form>
          )}
          {errorMsg && <p className="text-[12px] text-danger">{errorMsg}</p>}
        </div>
      )}
    </section>
  );
}
