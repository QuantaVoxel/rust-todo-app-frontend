"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin, Plus, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, applyApiValidationErrors } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { LocationResponse } from "@/lib/api/types";

const locationSchema = z.object({
  location_name: z
    .string()
    .min(1, "Location name is required")
    .max(255, "Maximum 255 characters"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

type LocationFormValues = z.infer<typeof locationSchema>;

export const locationKeys = {
  master: ["locations"] as const,
  task: (taskId: number) => ["tasks", taskId, "locations"] as const,
};

export function LocationPanel({
  taskId,
  canEdit,
}: {
  taskId: number;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: masterLocations = [] } = useQuery({
    queryKey: locationKeys.master,
    queryFn: () => apiFetch<LocationResponse[]>(endpoints.locations()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: taskLocations = [], isLoading } = useQuery({
    queryKey: locationKeys.task(taskId),
    queryFn: () => apiFetch<LocationResponse[]>(endpoints.taskLocations(taskId)),
  });

  const linkLocation = useMutation({
    mutationFn: (locationId: number) =>
      apiFetch<unknown>(endpoints.taskLocation(taskId, locationId), {
        method: "PUT",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.task(taskId) });
    },
  });

  const unlinkLocation = useMutation({
    mutationFn: (locationId: number) =>
      apiFetch<string>(endpoints.taskLocation(taskId, locationId), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationKeys.task(taskId) });
    },
  });

  const createLocation = useMutation({
    mutationFn: (payload: LocationFormValues) =>
      apiFetch<LocationResponse>(endpoints.locations(), {
        method: "POST",
        body: payload,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: locationKeys.master });
      linkLocation.mutate(created.location_id);
      setShowCreate(false);
    },
  });

  const form = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    defaultValues: { location_name: "", latitude: 0, longitude: 0 },
  });

  const onCreateSubmit = async (values: LocationFormValues) => {
    try {
      await createLocation.mutateAsync(values);
      form.reset();
    } catch (err) {
      applyApiValidationErrors(err, form.setError);
    }
  };

  const unlinkedLocations = masterLocations.filter(
    (m) => !taskLocations.some((t) => t.location_id === m.location_id)
  );

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-ink-muted" strokeWidth={1.75} />
          <h3 className="text-[12px] font-semibold text-ink-secondary">
            Locations
          </h3>
        </div>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowCreate((v) => !v)}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>New</span>
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : (
        <div className="space-y-2">
          {taskLocations.length === 0 ? (
            <p className="rounded-[6px] border border-hairline bg-canvas px-3 py-2 text-[12px] text-ink-muted">
              No locations linked.
            </p>
          ) : (
            taskLocations.map((loc) => (
              <div
                key={loc.location_id}
                className="flex items-center justify-between rounded-[6px] border border-hairline bg-canvas px-3 py-2"
              >
                <div>
                  <p className="text-[12px] font-medium text-ink-primary">
                    {loc.location_name}
                  </p>
                  <p className="font-mono text-[11px] text-ink-muted tabular-nums">
                    {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Unlink ${loc.location_name}`}
                    onClick={() => unlinkLocation.mutate(loc.location_id)}
                    className="rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
                  >
                    <Unlink className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                )}
              </div>
            ))
          )}

          {canEdit && unlinkedLocations.length > 0 && (
            <select
              aria-label="Link existing location"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) {
                  linkLocation.mutate(Number(e.target.value));
                  e.target.value = "";
                }
              }}
              className="h-8 w-full rounded-[6px] border border-hairline bg-canvas px-2.5 text-[12px] text-ink-secondary focus-ring"
            >
              <option value="">Link existing location...</option>
              {unlinkedLocations.map((loc) => (
                <option key={loc.location_id} value={loc.location_id}>
                  {loc.location_name}
                </option>
              ))}
            </select>
          )}

          {canEdit && showCreate && (
            <form
              onSubmit={form.handleSubmit(onCreateSubmit)}
              className="space-y-2 rounded-[6px] border border-hairline bg-canvas p-3"
            >
              <Input
                placeholder="Location name (e.g., HQ Makassar)"
                hasError={Boolean(form.formState.errors.location_name)}
                {...form.register("location_name")}
                className="h-8 text-[12px]"
              />
              {form.formState.errors.location_name && (
                <p className="text-[11px] text-danger">
                  {form.formState.errors.location_name.message}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  className="h-8 font-mono text-[11px]"
                  {...form.register("latitude", { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  className="h-8 font-mono text-[11px]"
                  {...form.register("longitude", { valueAsNumber: true })}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createLocation.isPending}
                >
                  Create & link
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
