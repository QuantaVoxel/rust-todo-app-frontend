"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  apiFetch,
  ApiClientError,
  applyApiValidationErrors,
} from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import type { ProfileResponse, UserMeResponse, UserSettingResponse } from "@/lib/api/types";
import { lookupKeys, useCurrentUser } from "@/features/tasks/queries";

const accountSchema = z.object({
  username: z.string().min(3, "Minimum 3 characters").max(50),
  email: z.string().email("Invalid email format"),
});

const profileSchema = z.object({
  first_name: z.string().max(255).optional(),
  last_name: z.string().max(255).optional(),
  phone_number: z.string().max(20).optional(),
  avatar_url: z.string().url("Invalid URL").optional().or(z.literal("")),
});

const passwordSchema = z
  .object({
    old_password: z.string().min(1, "Current password is required"),
    new_password: z.string().min(8, "Minimum 8 characters"),
    new_password_confirmation: z.string().min(8, "Confirm your new password"),
  })
  .refine((v) => v.new_password === v.new_password_confirmation, {
    path: ["new_password_confirmation"],
    message: "Passwords do not match",
  });

export function SettingsManager() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useCurrentUser();
  const { data: settings = [] } = useQuery({
    queryKey: ["users", "me", "settings"],
    queryFn: () => apiFetch<UserSettingResponse[]>(endpoints.meSettings()),
  });

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmUsername, setConfirmUsername] = useState("");

  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { username: "", email: "" },
  });

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      phone_number: "",
      avatar_url: "",
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      old_password: "",
      new_password: "",
      new_password_confirmation: "",
    },
  });

  useEffect(() => {
    if (me) {
      accountForm.reset({ username: me.username, email: me.email });
      profileForm.reset({
        first_name: me.profile?.first_name ?? "",
        last_name: me.profile?.last_name ?? "",
        phone_number: me.profile?.phone_number ?? "",
        avatar_url: me.profile?.avatar_url ?? "",
      });
    }
  }, [me, accountForm, profileForm]);

  const updateAccount = useMutation({
    mutationFn: (values: z.infer<typeof accountSchema>) =>
      apiFetch<UserMeResponse>(endpoints.me(), { method: "PATCH", body: values }),
    onSuccess: (updated) => {
      queryClient.setQueryData(lookupKeys.me, updated);
      setStatusMsg("Account details saved.");
    },
  });

  const updateProfile = useMutation({
    mutationFn: (values: z.infer<typeof profileSchema>) =>
      apiFetch<ProfileResponse>(endpoints.meProfile(), {
        method: "PUT",
        body: {
          ...values,
          avatar_url: values.avatar_url?.trim() || undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lookupKeys.me });
      setStatusMsg("Profile saved.");
    },
  });

  const changePassword = useMutation({
    mutationFn: (values: z.infer<typeof passwordSchema>) =>
      apiFetch<string>(endpoints.changePassword(), {
        method: "POST",
        body: values,
      }),
    onSuccess: () => {
      passwordForm.reset();
      setStatusMsg("Password updated.");
    },
  });

  const upsertSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiFetch<UserSettingResponse>(endpoints.meSettingKey(key), {
        method: "PUT",
        body: { setting_value: value },
      }),
    onSuccess: (_, vars) => {
      if (vars.key === "theme") {
        document.documentElement.classList.toggle(
          "dark",
          vars.value !== "light"
        );
      }
      queryClient.invalidateQueries({ queryKey: ["users", "me", "settings"] });
      setStatusMsg("Preference updated.");
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () => apiFetch<string>(endpoints.me(), { method: "DELETE" }),
    onSuccess: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
    },
  });

  const getSetting = (key: string, fallback: string) =>
    settings.find((s) => s.setting_key === key)?.setting_value ?? fallback;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-36 w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-hairline px-6">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
          Settings
        </h1>
        {statusMsg && (
          <span className="text-[12px] text-success">{statusMsg}</span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-8">
          {/* Account */}
          <section className="space-y-4 rounded-[8px] border border-hairline bg-canvas p-5">
            <h2 className="text-[15px] font-semibold text-ink-primary">
              Account
            </h2>
            <form
              onSubmit={accountForm.handleSubmit(async (v) => {
                try {
                  await updateAccount.mutateAsync(v);
                } catch (err) {
                  applyApiValidationErrors(err, accountForm.setError);
                }
              })}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                  Username
                </label>
                <Input {...accountForm.register("username")} />
                {accountForm.formState.errors.username && (
                  <p className="mt-1 text-[12px] text-danger">
                    {accountForm.formState.errors.username.message}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                  Email
                </label>
                <Input type="email" {...accountForm.register("email")} />
                {accountForm.formState.errors.email && (
                  <p className="mt-1 text-[12px] text-danger">
                    {accountForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={updateAccount.isPending}
                >
                  Save account
                </Button>
              </div>
            </form>
          </section>

          {/* Profile */}
          <section className="space-y-4 rounded-[8px] border border-hairline bg-canvas p-5">
            <h2 className="text-[15px] font-semibold text-ink-primary">
              Profile
            </h2>
            <form
              onSubmit={profileForm.handleSubmit(async (v) => {
                try {
                  await updateProfile.mutateAsync(v);
                } catch (err) {
                  applyApiValidationErrors(err, profileForm.setError);
                }
              })}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                  First name
                </label>
                <Input {...profileForm.register("first_name")} />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                  Last name
                </label>
                <Input {...profileForm.register("last_name")} />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                  Phone number
                </label>
                <Input {...profileForm.register("phone_number")} />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                  Avatar URL
                </label>
                <Input type="url" {...profileForm.register("avatar_url")} />
                {profileForm.formState.errors.avatar_url && (
                  <p className="mt-1 text-[12px] text-danger">
                    {profileForm.formState.errors.avatar_url.message}
                  </p>
                )}
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={updateProfile.isPending}
                >
                  Save profile
                </Button>
              </div>
            </form>
          </section>

          {/* Preferences */}
          <section className="space-y-4 rounded-[8px] border border-hairline bg-canvas p-5">
            <h2 className="text-[15px] font-semibold text-ink-primary">
              Preferences
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                  Theme
                </label>
                <select
                  value={getSetting("theme", "dark")}
                  onChange={(e) =>
                    upsertSetting.mutate({ key: "theme", value: e.target.value })
                  }
                  className="h-9 w-full rounded-[6px] border border-hairline bg-surface px-2.5 text-[13px] text-ink-primary focus-ring"
                >
                  <option value="dark">Dark (Obsidian)</option>
                  <option value="light">Light (Warm Paper)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                  Default Task View
                </label>
                <select
                  value={getSetting("default_view", "list")}
                  onChange={(e) =>
                    upsertSetting.mutate({
                      key: "default_view",
                      value: e.target.value,
                    })
                  }
                  className="h-9 w-full rounded-[6px] border border-hairline bg-surface px-2.5 text-[13px] text-ink-primary focus-ring"
                >
                  <option value="list">List</option>
                  <option value="board">Kanban Board</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                  Language
                </label>
                <select
                  value={getSetting("language", "en")}
                  onChange={(e) =>
                    upsertSetting.mutate({
                      key: "language",
                      value: e.target.value,
                    })
                  }
                  className="h-9 w-full rounded-[6px] border border-hairline bg-surface px-2.5 text-[13px] text-ink-primary focus-ring"
                >
                  <option value="en">English</option>
                  <option value="id">Bahasa Indonesia</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                  Email Notifications
                </label>
                <select
                  value={getSetting("email_notifications", "true")}
                  onChange={(e) =>
                    upsertSetting.mutate({
                      key: "email_notifications",
                      value: e.target.value,
                    })
                  }
                  className="h-9 w-full rounded-[6px] border border-hairline bg-surface px-2.5 text-[13px] text-ink-primary focus-ring"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </div>
            </div>
          </section>

          {/* Change Password */}
          <section className="space-y-4 rounded-[8px] border border-hairline bg-canvas p-5">
            <h2 className="text-[15px] font-semibold text-ink-primary">
              Change Password
            </h2>
            <form
              onSubmit={passwordForm.handleSubmit(async (v) => {
                try {
                  await changePassword.mutateAsync(v);
                } catch (err) {
                  if (
                    !applyApiValidationErrors(err, passwordForm.setError) &&
                    err instanceof ApiClientError
                  ) {
                    passwordForm.setError("old_password", {
                      message: err.message,
                    });
                  }
                }
              })}
              className="space-y-3"
            >
              <div>
                <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                  Current password
                </label>
                <Input
                  type="password"
                  {...passwordForm.register("old_password")}
                />
                {passwordForm.formState.errors.old_password && (
                  <p className="mt-1 text-[12px] text-danger">
                    {passwordForm.formState.errors.old_password.message}
                  </p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                    New password
                  </label>
                  <Input
                    type="password"
                    {...passwordForm.register("new_password")}
                  />
                  {passwordForm.formState.errors.new_password && (
                    <p className="mt-1 text-[12px] text-danger">
                      {passwordForm.formState.errors.new_password.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-ink-secondary">
                    Confirm new password
                  </label>
                  <Input
                    type="password"
                    {...passwordForm.register("new_password_confirmation")}
                  />
                  {passwordForm.formState.errors.new_password_confirmation && (
                    <p className="mt-1 text-[12px] text-danger">
                      {
                        passwordForm.formState.errors.new_password_confirmation
                          .message
                      }
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={changePassword.isPending}
                >
                  Update password
                </Button>
              </div>
            </form>
          </section>

          {/* Danger Zone */}
          <section className="space-y-3 rounded-[8px] border border-danger/30 bg-danger-tint/40 p-5">
            <h2 className="text-[15px] font-semibold text-danger">
              Danger Zone
            </h2>
            <p className="text-[13px] text-ink-secondary">
              Permanently delete your account and all tasks, notes, and
              attachments. This action cannot be undone.
            </p>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete account
            </Button>
          </section>
        </div>
      </div>

      {/* Confirm Account Deletion Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete account permanently?</DialogTitle>
            <DialogDescription>
              Type your username{" "}
              <span className="font-mono text-ink-primary">{me?.username}</span>{" "}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={confirmUsername}
            onChange={(e) => setConfirmUsername(e.target.value)}
            placeholder={me?.username}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={
                confirmUsername !== me?.username || deleteAccount.isPending
              }
              onClick={() => deleteAccount.mutate()}
            >
              Delete permanently
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
