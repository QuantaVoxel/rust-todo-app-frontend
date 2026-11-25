"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Plus,
  Settings2,
  Shield,
  Sliders,
  Trash2,
  User,
  UserCircle,
} from "lucide-react";
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
import type {
  ProfileResponse,
  UserMeResponse,
  UserSettingResponse,
} from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, getInitials } from "@/lib/utils/format";
import { lookupKeys, useCurrentUser } from "@/features/tasks/queries";

type SettingsSection =
  | "profile"
  | "account"
  | "preferences"
  | "security"
  | "danger";

const SECTIONS: Array<{
  id: SettingsSection;
  label: string;
  icon: typeof User;
}> = [
  { id: "profile", label: "Profile", icon: UserCircle },
  { id: "account", label: "Account", icon: User },
  { id: "preferences", label: "Preferences", icon: Sliders },
  { id: "security", label: "Security", icon: Shield },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
];

function parseSection(raw: string | null): SettingsSection {
  if (
    raw === "profile" ||
    raw === "account" ||
    raw === "preferences" ||
    raw === "security" ||
    raw === "danger"
  ) {
    return raw;
  }
  return "profile";
}

const profileSchema = z.object({
  first_name: z.string().max(255, "Maximum 255 characters").optional(),
  last_name: z.string().max(255, "Maximum 255 characters").optional(),
  phone_number: z.string().max(20, "Maximum 20 characters").optional(),
  avatar_url: z.string().url("Invalid URL").optional().or(z.literal("")),
});

const accountSchema = z.object({
  username: z.string().min(3, "Minimum 3 characters").max(50),
  email: z.string().email("Invalid email format"),
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

function getPasswordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export function SettingsManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const shouldReduceMotion = useReducedMotion();

  const activeSection = parseSection(searchParams.get("section"));

  const { data: me, isLoading } = useCurrentUser();
  const { data: settings = [], isLoading: settingsLoading } = useQuery({
    queryKey: ["users", "me", "settings"],
    queryFn: () => apiFetch<UserSettingResponse[]>(endpoints.meSettings()),
  });

  // Profile state
  const [avatarDraftUrl, setAvatarDraftUrl] = useState<string | null>(null);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [profileSavedFlash, setProfileSavedFlash] = useState(false);

  // Account state
  const [accountSavedFlash, setAccountSavedFlash] = useState(false);
  const [accountShakeKey, setAccountShakeKey] = useState(0);

  // Preferences custom KV state
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customKey, setCustomKey] = useState("");
  const [customVal, setCustomVal] = useState("");
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  // Security state
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [newPwValue, setNewPwValue] = useState("");
  const [pwSuccessMsg, setPwSuccessMsg] = useState<string | null>(null);

  // Danger Zone state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const profileForm = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      phone_number: "",
      avatar_url: "",
    },
  });

  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { username: "", email: "" },
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
      const avatar = me.profile?.avatar_url ?? "";
      profileForm.reset({
        first_name: me.profile?.first_name ?? "",
        last_name: me.profile?.last_name ?? "",
        phone_number: me.profile?.phone_number ?? "",
        avatar_url: avatar,
      });
    }
  }, [me, accountForm, profileForm]);

  const avatarPreviewUrl = avatarDraftUrl ?? me?.profile?.avatar_url ?? "";

  const switchSection = (sec: SettingsSection) => {
    router.replace(`/settings?section=${sec}`);
  };

  const updateProfile = useMutation({
    mutationFn: (values: z.infer<typeof profileSchema>) =>
      apiFetch<ProfileResponse>(endpoints.meProfile(), {
        method: "PUT",
        body: {
          first_name: values.first_name?.trim() || undefined,
          last_name: values.last_name?.trim() || undefined,
          phone_number: values.phone_number?.trim() || undefined,
          avatar_url: values.avatar_url?.trim() || undefined,
        },
      }),
    onSuccess: (updatedProfile) => {
      queryClient.setQueryData<UserMeResponse>(lookupKeys.me, (old) =>
        old ? { ...old, profile: updatedProfile } : old
      );
      queryClient.invalidateQueries({ queryKey: lookupKeys.me });
      profileForm.reset(profileForm.getValues());
      setProfileSavedFlash(true);
      setTimeout(() => setProfileSavedFlash(false), 2000);
    },
  });

  const updateAccount = useMutation({
    mutationFn: (values: { username?: string; email?: string }) =>
      apiFetch<UserMeResponse>(endpoints.me(), { method: "PATCH", body: values }),
    onSuccess: (updated) => {
      queryClient.setQueryData(lookupKeys.me, updated);
      accountForm.reset({ username: updated.username, email: updated.email });
      setAccountSavedFlash(true);
      setTimeout(() => setAccountSavedFlash(false), 2000);
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
        if (vars.value === "system") {
          const prefersDark = window.matchMedia(
            "(prefers-color-scheme: dark)"
          ).matches;
          document.documentElement.classList.toggle("dark", prefersDark);
        } else {
          document.documentElement.classList.toggle(
            "dark",
            vars.value === "dark"
          );
        }
      }
      queryClient.invalidateQueries({ queryKey: ["users", "me", "settings"] });
    },
  });

  const deleteSetting = useMutation({
    mutationFn: (key: string) =>
      apiFetch<string>(endpoints.meSettingKey(key), { method: "DELETE" }),
    onSuccess: () => {
      setConfirmDeleteKey(null);
      queryClient.invalidateQueries({ queryKey: ["users", "me", "settings"] });
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
      setNewPwValue("");
      setPwSuccessMsg("Password updated successfully.");
      setTimeout(() => setPwSuccessMsg(null), 4000);
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () => apiFetch<string>(endpoints.me(), { method: "DELETE" }),
    onSuccess: async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    },
  });

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  const getSetting = (key: string, fallback: string) =>
    settings.find((s) => s.setting_key === key)?.setting_value ?? fallback;

  const browserTz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  const timezones = Array.from(
    new Set([browserTz, "Asia/Makassar", "Asia/Jakarta", "Asia/Singapore", "UTC"])
  );

  const initials = getInitials(
    me?.profile?.first_name,
    me?.profile?.last_name,
    me?.username
  );

  const pwStrength = getPasswordStrength(newPwValue);

  if (isLoading || settingsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-44" />
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-72 w-full max-w-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Page Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-hairline px-6 py-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
            Settings
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-secondary">
            Manage your profile, account credentials, preferences, and security.
          </p>
        </div>
      </header>

      {/* 2-Column Settings Body */}
      <div className="grid flex-1 min-h-0 grid-cols-1 overflow-hidden md:grid-cols-[220px_1fr]">
        {/* Left Vertical Sub-Nav (Desktop) / Horizontal Scrollable Tabs (Mobile) */}
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-hairline bg-canvas px-4 py-2.5 md:flex-col md:border-b-0 md:border-r md:p-4"
        >
          {SECTIONS.map((sec) => {
            const Icon = sec.icon;
            const active = activeSection === sec.id;
            const isDanger = sec.id === "danger";
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => switchSection(sec.id)}
                className={cn(
                  "relative z-10 flex h-8 shrink-0 items-center gap-2.5 rounded-[6px] px-2.5 text-[13px] font-medium transition-precision cursor-pointer focus-ring",
                  active
                    ? isDanger
                      ? "text-danger"
                      : "text-ink-primary"
                    : isDanger
                      ? "text-danger/70 hover:text-danger"
                      : "text-ink-muted hover:text-ink-primary"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="settings-nav-indicator"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 460, damping: 34 }
                    }
                    className="absolute inset-0 -z-10 rounded-[6px] border border-hairline bg-surface"
                  />
                )}
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right Content Column */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-2xl">
            <AnimatePresence mode="wait">
              {activeSection === "profile" && (
                <motion.section
                  key="sec-profile"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-[16px] font-semibold text-ink-primary">
                      Profile
                    </h2>
                    <p className="mt-0.5 text-[13px] text-ink-secondary">
                      Your public identity across shared tasks and comments.
                    </p>
                  </div>

                  {/* Live Avatar Preview */}
                  <div className="flex items-center gap-4 rounded-[8px] border border-hairline bg-canvas p-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-strong bg-surface font-mono text-[15px] font-semibold text-ink-primary">
                      {avatarPreviewUrl && !avatarLoadError ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={avatarPreviewUrl}
                          alt="Avatar preview"
                          onError={() => setAvatarLoadError(true)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink-primary">
                        @{me?.username}
                      </p>
                      <p className="text-[12px] text-ink-muted">
                        Preview updates live as you edit the avatar URL below.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={profileForm.handleSubmit(async (v) => {
                      try {
                        await updateProfile.mutateAsync(v);
                      } catch (err) {
                        applyApiValidationErrors(err, profileForm.setError);
                      }
                    })}
                    className="space-y-4 rounded-[8px] border border-hairline bg-canvas p-5"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[12px] font-medium text-ink-secondary">
                          First name
                        </label>
                        <Input {...profileForm.register("first_name")} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12px] font-medium text-ink-secondary">
                          Last name
                        </label>
                        <Input {...profileForm.register("last_name")} />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[12px] font-medium text-ink-secondary">
                        Phone number
                      </label>
                      <Input {...profileForm.register("phone_number")} />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[12px] font-medium text-ink-secondary">
                        Avatar URL
                      </label>
                      <Input
                        type="url"
                        placeholder="https://cdn.example.com/avatar.png"
                        hasError={Boolean(profileForm.formState.errors.avatar_url)}
                        {...profileForm.register("avatar_url", {
                          onChange: (e) => {
                            setAvatarDraftUrl(e.target.value);
                            setAvatarLoadError(false);
                          },
                        })}
                      />
                      {profileForm.formState.errors.avatar_url && (
                        <p className="mt-1 text-[12px] text-danger">
                          {profileForm.formState.errors.avatar_url.message}
                        </p>
                      )}
                    </div>

                    {/* Dirty-State Save Bar */}
                    <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
                      {profileForm.formState.isDirty && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            profileForm.reset();
                            setAvatarDraftUrl(null);
                            setAvatarLoadError(false);
                          }}
                        >
                          Discard
                        </Button>
                      )}
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={
                          !profileForm.formState.isDirty ||
                          updateProfile.isPending
                        }
                      >
                        {updateProfile.isPending ? (
                          <>
                            <Loader2
                              className="h-3.5 w-3.5 animate-spin"
                              strokeWidth={1.75}
                            />
                            <span>Saving...</span>
                          </>
                        ) : profileSavedFlash ? (
                          <>
                            <Check className="h-3.5 w-3.5" strokeWidth={2} />
                            <span>Saved</span>
                          </>
                        ) : (
                          <span>Save Changes</span>
                        )}
                      </Button>
                    </div>
                  </form>
                </motion.section>
              )}

              {activeSection === "account" && (
                <motion.section
                  key="sec-account"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-[16px] font-semibold text-ink-primary">
                      Account
                    </h2>
                    <p className="mt-0.5 text-[13px] text-ink-secondary">
                      Update your login username and email address.
                    </p>
                  </div>

                  {/* Read-only Metadata */}
                  <div className="grid grid-cols-1 gap-3 rounded-[8px] border border-hairline bg-canvas p-4 sm:grid-cols-3">
                    <div>
                      <p className="text-[11px] text-ink-muted">User ID</p>
                      <p className="mt-0.5 font-mono text-[13px] font-medium text-ink-primary tabular-nums">
                        #{me?.user_id}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-ink-muted">
                        Account Created
                      </p>
                      <p className="mt-0.5 font-mono text-[12px] text-ink-secondary tabular-nums">
                        {me ? formatDateTime(me.created_at) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-ink-muted">Last Updated</p>
                      <p className="mt-0.5 font-mono text-[12px] text-ink-secondary tabular-nums">
                        {me ? formatDateTime(me.updated_at) : "-"}
                      </p>
                    </div>
                  </div>

                  <motion.form
                    key={accountShakeKey}
                    animate={
                      Object.keys(accountForm.formState.errors).length > 0 &&
                      !shouldReduceMotion
                        ? { x: [0, -6, 6, -4, 4, 0] }
                        : { x: 0 }
                    }
                    transition={{ duration: 0.3 }}
                    onSubmit={accountForm.handleSubmit(async (v) => {
                      const patch: { username?: string; email?: string } = {};
                      if (v.username !== me?.username)
                        patch.username = v.username;
                      if (v.email !== me?.email) patch.email = v.email;
                      if (Object.keys(patch).length === 0) return;

                      try {
                        await updateAccount.mutateAsync(patch);
                      } catch (err) {
                        if (
                          !applyApiValidationErrors(err, accountForm.setError) &&
                          err instanceof ApiClientError
                        ) {
                          if (err.message.toLowerCase().includes("email")) {
                            accountForm.setError("email", {
                              message: err.message,
                            });
                          } else {
                            accountForm.setError("username", {
                              message: err.message,
                            });
                          }
                        }
                        setAccountShakeKey((k) => k + 1);
                      }
                    })}
                    className="space-y-4 rounded-[8px] border border-hairline bg-canvas p-5"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[12px] font-medium text-ink-secondary">
                          Username
                        </label>
                        <Input
                          hasError={Boolean(
                            accountForm.formState.errors.username
                          )}
                          {...accountForm.register("username")}
                        />
                        {accountForm.formState.errors.username && (
                          <p className="mt-1 text-[12px] text-danger">
                            {accountForm.formState.errors.username.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-[12px] font-medium text-ink-secondary">
                          Email
                        </label>
                        <Input
                          type="email"
                          hasError={Boolean(accountForm.formState.errors.email)}
                          {...accountForm.register("email")}
                        />
                        {accountForm.formState.errors.email && (
                          <p className="mt-1 text-[12px] text-danger">
                            {accountForm.formState.errors.email.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-hairline pt-4">
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={
                          !accountForm.formState.isDirty ||
                          updateAccount.isPending
                        }
                      >
                        {updateAccount.isPending ? (
                          <span>Saving...</span>
                        ) : accountSavedFlash ? (
                          <>
                            <Check className="h-3.5 w-3.5" strokeWidth={2} />
                            <span>Saved</span>
                          </>
                        ) : (
                          <span>Save Changes</span>
                        )}
                      </Button>
                    </div>
                  </motion.form>
                </motion.section>
              )}

              {activeSection === "preferences" && (
                <motion.section
                  key="sec-preferences"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-[16px] font-semibold text-ink-primary">
                      Preferences
                    </h2>
                    <p className="mt-0.5 text-[13px] text-ink-secondary">
                      Customize appearance, language, notifications, and custom
                      key-value settings.
                    </p>
                  </div>

                  {/* Curated Preferences */}
                  <div className="divide-y divide-hairline rounded-[8px] border border-hairline bg-canvas">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                      <div>
                        <p className="text-[13px] font-medium text-ink-primary">
                          Theme
                        </p>
                        <p className="text-[12px] text-ink-muted">
                          Select workspace color mode.
                        </p>
                      </div>
                      <div className="flex rounded-[6px] border border-hairline bg-surface p-0.5">
                        {(["light", "dark", "system"] as const).map((t) => {
                          const active = getSetting("theme", "dark") === t;
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() =>
                                upsertSetting.mutate({ key: "theme", value: t })
                              }
                              className={cn(
                                "h-7 rounded-[4px] px-2.5 text-[12px] font-medium capitalize transition-precision cursor-pointer",
                                active
                                  ? "bg-subtle text-ink-primary"
                                  : "text-ink-muted hover:text-ink-secondary"
                              )}
                            >
                              {t}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                      <div>
                        <p className="text-[13px] font-medium text-ink-primary">
                          Language
                        </p>
                        <p className="text-[12px] text-ink-muted">
                          Preferred interface language.
                        </p>
                      </div>
                      <select
                        aria-label="Language"
                        value={getSetting("language", "en")}
                        onChange={(e) =>
                          upsertSetting.mutate({
                            key: "language",
                            value: e.target.value,
                          })
                        }
                        className="h-8 rounded-[6px] border border-hairline bg-surface px-2.5 text-[12px] text-ink-primary focus-ring"
                      >
                        <option value="en">English (en)</option>
                        <option value="id">Bahasa Indonesia (id)</option>
                      </select>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                      <div>
                        <p className="text-[13px] font-medium text-ink-primary">
                          Email Notifications
                        </p>
                        <p className="text-[12px] text-ink-muted">
                          Receive reminder and share summaries via email.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={
                          getSetting("email_notifications", "true") === "true"
                        }
                        onClick={() => {
                          const curr =
                            getSetting("email_notifications", "true") === "true";
                          upsertSetting.mutate({
                            key: "email_notifications",
                            value: curr ? "false" : "true",
                          });
                        }}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-precision cursor-pointer focus-ring",
                          getSetting("email_notifications", "true") === "true"
                            ? "border-accent bg-accent"
                            : "border-strong bg-subtle"
                        )}
                      >
                        <span
                          className={cn(
                            "h-3.5 w-3.5 rounded-full bg-white transition-transform",
                            getSetting("email_notifications", "true") === "true"
                              ? "translate-x-4"
                              : "translate-x-0.5"
                          )}
                        />
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                      <div>
                        <p className="text-[13px] font-medium text-ink-primary">
                          Timezone
                        </p>
                        <p className="text-[12px] text-ink-muted">
                          Used for reminder &amp; recurrence scheduling.
                        </p>
                      </div>
                      <select
                        aria-label="Timezone"
                        value={getSetting("timezone", browserTz)}
                        onChange={(e) =>
                          upsertSetting.mutate({
                            key: "timezone",
                            value: e.target.value,
                          })
                        }
                        className="h-8 rounded-[6px] border border-hairline bg-surface px-2.5 font-mono text-[12px] text-ink-primary focus-ring"
                      >
                        {timezones.map((tz) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Advanced / Custom Key-Value Settings Accordion */}
                  <div className="rounded-[8px] border border-hairline bg-canvas">
                    <button
                      type="button"
                      onClick={() => setAdvancedOpen((v) => !v)}
                      className="flex w-full items-center justify-between px-4 py-3 text-left text-[13px] font-medium text-ink-primary hover:bg-subtle/40 transition-precision cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Settings2
                          className="h-4 w-4 text-ink-muted"
                          strokeWidth={1.75}
                        />
                        <span>Advanced / Custom Key-Value Settings</span>
                        <span className="rounded-[4px] bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-muted tabular-nums">
                          {settings.length}
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-ink-muted transition-transform",
                          advancedOpen && "rotate-180"
                        )}
                        strokeWidth={1.75}
                      />
                    </button>

                    {advancedOpen && (
                      <div className="border-t border-hairline p-4 space-y-3">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!customKey.trim() || !customVal.trim()) return;
                            upsertSetting.mutate(
                              { key: customKey.trim(), value: customVal.trim() },
                              {
                                onSuccess: () => {
                                  setCustomKey("");
                                  setCustomVal("");
                                },
                              }
                            );
                          }}
                          className="flex flex-col gap-2 sm:flex-row"
                        >
                          <Input
                            value={customKey}
                            onChange={(e) => setCustomKey(e.target.value)}
                            placeholder="setting_key"
                            className="h-8 flex-1 font-mono text-[12px]"
                          />
                          <Input
                            value={customVal}
                            onChange={(e) => setCustomVal(e.target.value)}
                            placeholder="setting_value"
                            className="h-8 flex-1 font-mono text-[12px]"
                          />
                          <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            disabled={
                              !customKey.trim() ||
                              !customVal.trim() ||
                              upsertSetting.isPending
                            }
                          >
                            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                            <span>Upsert</span>
                          </Button>
                        </form>

                        <div className="divide-y divide-hairline rounded-[6px] border border-hairline bg-surface">
                          {settings.length === 0 ? (
                            <p className="px-3 py-3 text-[12px] text-ink-muted">
                              No custom settings stored.
                            </p>
                          ) : (
                            settings.map((s) => (
                              <div
                                key={s.setting_id}
                                className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]"
                              >
                                <div className="flex min-w-0 items-center gap-2 font-mono">
                                  <span className="font-medium text-ink-primary">
                                    {s.setting_key}
                                  </span>
                                  <span className="text-ink-muted">=</span>
                                  <span className="truncate text-ink-secondary">
                                    {s.setting_value ?? ""}
                                  </span>
                                </div>
                                {confirmDeleteKey === s.setting_key ? (
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        deleteSetting.mutate(s.setting_key)
                                      }
                                      className="text-[11px] font-medium text-danger hover:underline cursor-pointer"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteKey(null)}
                                      className="text-[11px] text-ink-muted cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    aria-label={`Delete ${s.setting_key}`}
                                    onClick={() =>
                                      setConfirmDeleteKey(s.setting_key)
                                    }
                                    className="rounded-[4px] p-1 text-ink-muted hover:bg-subtle hover:text-danger cursor-pointer"
                                  >
                                    <Trash2
                                      className="h-3.5 w-3.5"
                                      strokeWidth={1.75}
                                    />
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.section>
              )}

              {activeSection === "security" && (
                <motion.section
                  key="sec-security"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-[16px] font-semibold text-ink-primary">
                      Security
                    </h2>
                    <p className="mt-0.5 text-[13px] text-ink-secondary">
                      Update your password and manage your active session.
                    </p>
                  </div>

                  {pwSuccessMsg && (
                    <div className="rounded-[6px] border border-success/30 bg-success-tint px-3.5 py-2.5 text-[13px] text-success">
                      {pwSuccessMsg}
                    </div>
                  )}

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
                    className="space-y-4 rounded-[8px] border border-hairline bg-canvas p-5"
                  >
                    <h3 className="text-[13px] font-semibold text-ink-primary">
                      Change Password
                    </h3>

                    <div>
                      <label className="mb-1.5 block text-[12px] font-medium text-ink-secondary">
                        Current password
                      </label>
                      <div className="relative">
                        <Input
                          type={showOldPw ? "text" : "password"}
                          className="pr-9"
                          hasError={Boolean(
                            passwordForm.formState.errors.old_password
                          )}
                          {...passwordForm.register("old_password")}
                        />
                        <button
                          type="button"
                          aria-label={showOldPw ? "Hide" : "Show"}
                          onClick={() => setShowOldPw((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary cursor-pointer"
                        >
                          {showOldPw ? (
                            <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                          ) : (
                            <Eye className="h-4 w-4" strokeWidth={1.75} />
                          )}
                        </button>
                      </div>
                      {passwordForm.formState.errors.old_password && (
                        <p className="mt-1 text-[12px] text-danger">
                          {passwordForm.formState.errors.old_password.message}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-[12px] font-medium text-ink-secondary">
                          New password
                        </label>
                        <div className="relative">
                          <Input
                            type={showNewPw ? "text" : "password"}
                            className="pr-9"
                            hasError={Boolean(
                              passwordForm.formState.errors.new_password
                            )}
                            {...passwordForm.register("new_password", {
                              onChange: (e) => setNewPwValue(e.target.value),
                            })}
                          />
                          <button
                            type="button"
                            aria-label={showNewPw ? "Hide" : "Show"}
                            onClick={() => setShowNewPw((v) => !v)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary cursor-pointer"
                          >
                            {showNewPw ? (
                              <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                            ) : (
                              <Eye className="h-4 w-4" strokeWidth={1.75} />
                            )}
                          </button>
                        </div>

                        {/* 4-Segment Strength Bar */}
                        <div className="mt-2 grid grid-cols-4 gap-1">
                          {[1, 2, 3, 4].map((seg) => {
                            const active = pwStrength >= seg;
                            const color =
                              pwStrength <= 1
                                ? "bg-danger"
                                : pwStrength === 2
                                  ? "bg-warning"
                                  : pwStrength === 3
                                    ? "bg-[#2563EB]"
                                    : "bg-success";
                            return (
                              <span
                                key={seg}
                                className={cn(
                                  "h-1 rounded-[2px] transition-precision",
                                  active ? color : "bg-subtle"
                                )}
                              />
                            );
                          })}
                        </div>

                        {passwordForm.formState.errors.new_password && (
                          <p className="mt-1 text-[12px] text-danger">
                            {passwordForm.formState.errors.new_password.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-[12px] font-medium text-ink-secondary">
                          Confirm new password
                        </label>
                        <Input
                          type={showNewPw ? "text" : "password"}
                          hasError={Boolean(
                            passwordForm.formState.errors
                              .new_password_confirmation
                          )}
                          {...passwordForm.register(
                            "new_password_confirmation"
                          )}
                        />
                        {passwordForm.formState.errors
                          .new_password_confirmation && (
                          <p className="mt-1 text-[12px] text-danger">
                            {
                              passwordForm.formState.errors
                                .new_password_confirmation.message
                            }
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-end border-t border-hairline pt-4">
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={changePassword.isPending}
                      >
                        Update password
                      </Button>
                    </div>
                  </form>

                  {/* Active Session Card */}
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-hairline bg-canvas p-4">
                    <div>
                      <p className="text-[13px] font-medium text-ink-primary">
                        Current Session
                      </p>
                      <p className="text-[12px] text-ink-muted">
                        Signed in as{" "}
                        <span className="font-mono text-ink-secondary">
                          {me?.email}
                        </span>{" "}
                        via HttpOnly BFF cookies.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
                      <span>Sign Out</span>
                    </Button>
                  </div>
                </motion.section>
              )}

              {activeSection === "danger" && (
                <motion.section
                  key="sec-danger"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <div>
                    <h2 className="text-[16px] font-semibold text-danger">
                      Danger Zone
                    </h2>
                    <p className="mt-0.5 text-[13px] text-ink-secondary">
                      Irreversible actions affecting your account and data.
                    </p>
                  </div>

                  <div className="space-y-4 rounded-[8px] border border-danger/30 bg-danger-tint/35 p-5">
                    <div className="space-y-1.5">
                      <h3 className="text-[14px] font-semibold text-ink-primary">
                        Delete account permanently
                      </h3>
                      <p className="text-[13px] leading-relaxed text-ink-secondary">
                        Deleting your account permanently removes all tasks,
                        subtasks, notes, comments, attachments, connections, and
                        settings (<code className="font-mono">ON DELETE CASCADE</code>
                        ). This action cannot be undone.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setConfirmText("");
                        setDeleteDialogOpen(true);
                      }}
                    >
                      Delete Account
                    </Button>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Two-Step Type-to-Confirm Account Deletion Modal */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete account permanently?</DialogTitle>
            <DialogDescription>
              Type your username{" "}
              <span className="font-mono font-semibold text-ink-primary">
                {me?.username}
              </span>{" "}
              or <span className="font-mono font-semibold text-ink-primary">DELETE</span>{" "}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={me?.username ?? "DELETE"}
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
                (confirmText !== me?.username && confirmText !== "DELETE") ||
                deleteAccount.isPending
              }
              onClick={() => deleteAccount.mutate()}
            >
              {deleteAccount.isPending ? "Deleting..." : "Delete Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
