"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiClientError, applyApiValidationErrors } from "@/lib/api/client";
import type { ApiErrorResponse } from "@/lib/api/types";
import {
  loginSchema,
  registerSchema,
  type LoginFormValues,
  type RegisterFormValues,
} from "./schemas";

const ENABLE_DEMO_MODE =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true";

async function parseErrorResponse(res: Response): Promise<ApiClientError> {
  let code = "INTERNAL_ERROR";
  let message = `Request failed (${res.status})`;
  let details = null;
  try {
    const json = (await res.json()) as Partial<ApiErrorResponse>;
    if (json?.error) {
      code = json.error.code ?? code;
      message = json.error.message ?? message;
      details = json.error.details ?? null;
    }
  } catch {
    // ignore non-json
  }
  return new ApiClientError(res.status, code, message, details);
}

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const err = await parseErrorResponse(res);
        applyApiValidationErrors(err, form.setError);
        setServerError(err.message);
        return;
      }

      router.replace("/tasks");
      router.refresh();
    } catch {
      setServerError("Gagal menghubungi server autentikasi.");
    }
  };

  const handleDemoFill = () => {
    form.setValue("email", "demo@todoapp.local", { shouldValidate: true });
    form.setValue("password", "Password123!", { shouldValidate: true });
  };

  const handleSeedDemo = async () => {
    setIsSeeding(true);
    setSeedMessage(null);
    setServerError(null);
    try {
      const res = await fetch("/api/proxy/seed/demo", { method: "POST" });
      if (!res.ok) {
        const err = await parseErrorResponse(res);
        setServerError(err.message);
        return;
      }
      setSeedMessage("Demo data siap. Gunakan Demo Quick-Fill untuk masuk.");
      handleDemoFill();
    } catch {
      setServerError("Gagal menjalankan seeder demo.");
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="w-full max-w-[380px] rounded-[10px] border border-hairline bg-surface p-6">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-accent" />
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">
            Todo App v2
          </span>
        </div>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
          Masuk ke Workspace
        </h1>
        <p className="mt-1 text-[13px] text-ink-secondary">
          Gunakan kredensial akun Anda untuk melanjutkan.
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="mb-4 rounded-[6px] border border-danger/25 bg-danger-tint px-3 py-2 text-[13px] text-danger"
        >
          {serverError}
        </div>
      )}

      {seedMessage && (
        <div className="mb-4 rounded-[6px] border border-success/25 bg-success-tint px-3 py-2 text-[13px] text-success">
          {seedMessage}
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="mb-1.5 block text-[12px] font-medium text-ink-secondary"
          >
            Email
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="nama@perusahaan.com"
            hasError={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="mt-1 text-[12px] text-danger">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="mb-1.5 block text-[12px] font-medium text-ink-secondary"
          >
            Kata Sandi
          </label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            hasError={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="mt-1 text-[12px] text-danger">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full h-9"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
          )}
          Masuk
        </Button>
      </form>

      {ENABLE_DEMO_MODE && (
        <div className="mt-5 border-t border-hairline pt-4">
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.04em] text-ink-muted">
            Demo Environment
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={handleDemoFill}
            >
              <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={1.75} />
              Isi Demo User
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSeedDemo}
              disabled={isSeeding}
            >
              {isSeeding ? "Seeding..." : "Seed Demo DB"}
            </Button>
          </div>
        </div>
      )}

      <p className="mt-5 text-center text-[13px] text-ink-secondary">
        Belum punya akun?{" "}
        <Link
          href="/register"
          className="font-medium text-accent hover:underline"
        >
          Daftar sekarang
        </Link>
      </p>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      phone_number: "",
      avatar_url: "",
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setServerError(null);
    const payload = {
      ...values,
      avatar_url: values.avatar_url?.trim() ? values.avatar_url.trim() : undefined,
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await parseErrorResponse(res);
        applyApiValidationErrors(err, form.setError);
        setServerError(err.message);
        return;
      }

      // Auto-login immediately after successful registration
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
        }),
      });

      if (loginRes.ok) {
        router.replace("/tasks");
        router.refresh();
      } else {
        router.replace("/login");
      }
    } catch {
      setServerError("Gagal menghubungi server pendaftaran.");
    }
  };

  return (
    <div className="w-full max-w-[440px] rounded-[10px] border border-hairline bg-surface p-6">
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-accent" />
          <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted">
            Todo App v2
          </span>
        </div>
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-ink-primary">
          Buat Akun Baru
        </h1>
        <p className="mt-1 text-[13px] text-ink-secondary">
          Lengkapi profil Anda untuk mulai mengelola task.
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="mb-4 rounded-[6px] border border-danger/25 bg-danger-tint px-3 py-2 text-[13px] text-danger"
        >
          {serverError}
        </div>
      )}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="reg-first-name"
              className="mb-1 block text-[12px] font-medium text-ink-secondary"
            >
              Nama Depan
            </label>
            <Input
              id="reg-first-name"
              placeholder="Budi"
              hasError={Boolean(form.formState.errors.first_name)}
              {...form.register("first_name")}
            />
            {form.formState.errors.first_name && (
              <p className="mt-1 text-[12px] text-danger">
                {form.formState.errors.first_name.message}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="reg-last-name"
              className="mb-1 block text-[12px] font-medium text-ink-secondary"
            >
              Nama Belakang
            </label>
            <Input
              id="reg-last-name"
              placeholder="Santoso"
              hasError={Boolean(form.formState.errors.last_name)}
              {...form.register("last_name")}
            />
            {form.formState.errors.last_name && (
              <p className="mt-1 text-[12px] text-danger">
                {form.formState.errors.last_name.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="reg-username"
              className="mb-1 block text-[12px] font-medium text-ink-secondary"
            >
              Username
            </label>
            <Input
              id="reg-username"
              placeholder="budi_s"
              hasError={Boolean(form.formState.errors.username)}
              {...form.register("username")}
            />
            {form.formState.errors.username && (
              <p className="mt-1 text-[12px] text-danger">
                {form.formState.errors.username.message}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="reg-phone"
              className="mb-1 block text-[12px] font-medium text-ink-secondary"
            >
              Nomor Telepon
            </label>
            <Input
              id="reg-phone"
              placeholder="+62812345678"
              hasError={Boolean(form.formState.errors.phone_number)}
              {...form.register("phone_number")}
            />
            {form.formState.errors.phone_number && (
              <p className="mt-1 text-[12px] text-danger">
                {form.formState.errors.phone_number.message}
              </p>
            )}
          </div>
        </div>

        <div>
          <label
            htmlFor="reg-email"
            className="mb-1 block text-[12px] font-medium text-ink-secondary"
          >
            Email
          </label>
          <Input
            id="reg-email"
            type="email"
            placeholder="budi@mail.com"
            hasError={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="mt-1 text-[12px] text-danger">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="reg-password"
            className="mb-1 block text-[12px] font-medium text-ink-secondary"
          >
            Kata Sandi (min. 8 karakter)
          </label>
          <Input
            id="reg-password"
            type="password"
            placeholder="••••••••"
            hasError={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="mt-1 text-[12px] text-danger">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="reg-avatar"
            className="mb-1 block text-[12px] font-medium text-ink-secondary"
          >
            URL Avatar <span className="text-ink-muted">(Opsional)</span>
          </label>
          <Input
            id="reg-avatar"
            type="url"
            placeholder="https://cdn.example.com/avatar.png"
            hasError={Boolean(form.formState.errors.avatar_url)}
            {...form.register("avatar_url")}
          />
          {form.formState.errors.avatar_url && (
            <p className="mt-1 text-[12px] text-danger">
              {form.formState.errors.avatar_url.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full h-9 mt-2"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
          )}
          Daftar Akun
        </Button>
      </form>

      <p className="mt-5 text-center text-[13px] text-ink-secondary">
        Sudah punya akun?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Masuk di sini
        </Link>
      </p>
    </div>
  );
}
