"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { ApiClientError, applyApiValidationErrors } from "@/lib/api/client";
import type { ApiErrorResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { AuthShowcaseCanvas, type AuthPhase } from "./auth-showcase-canvas";
import {
  loginSchema,
  registerSchema,
  type LoginFormValues,
  type RegisterFormValues,
} from "./schemas";

type AuthMode = "login" | "register";
type SubmitState = "idle" | "loading" | "success";

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

function getPasswordStrength(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function ShakeField({
  hasError,
  delay = 0,
  children,
}: {
  hasError: boolean;
  delay?: number;
  children: ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
      animate={
        shouldReduceMotion
          ? { opacity: 1 }
          : hasError
            ? { opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }
            : { opacity: 1, y: 0, x: 0 }
      }
      transition={{
        opacity: { duration: 0.2, delay },
        y: { type: "spring", stiffness: 420, damping: 32, delay },
        x: { duration: 0.32, ease: "easeInOut" },
      }}
    >
      {children}
    </motion.div>
  );
}

function MorphSubmitButton({
  state,
  idleLabel,
}: {
  state: SubmitState;
  idleLabel: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.button
      type="submit"
      disabled={state !== "idle"}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
      className={cn(
        "relative flex h-9 w-full items-center justify-center gap-2 rounded-[6px] text-[13px] font-medium text-white transition-precision focus-ring cursor-pointer disabled:cursor-not-allowed",
        state === "success"
          ? "bg-[#16A34A]"
          : "bg-accent hover:bg-accent-hover disabled:opacity-80"
      )}
    >
      <AnimatePresence mode="wait">
        {state === "loading" && (
          <motion.span
            key="loading"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.14 }}
            className="flex items-center gap-2"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
            <span>Authenticating...</span>
          </motion.span>
        )}
        {state === "success" && (
          <motion.span
            key="success"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.16 }}
            className="flex items-center gap-1.5"
          >
            <Check className="h-4 w-4" strokeWidth={2.2} />
            <span>Unlocked</span>
          </motion.span>
        )}
        {state === "idle" && (
          <motion.span
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {idleLabel}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function UnifiedAuthView({ initialMode }: { initialMode: AuthMode }) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [authPhase, setAuthPhase] = useState<AuthPhase>("idle");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [isSeeding, setIsSeeding] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registerPasswordValue, setRegisterPasswordValue] = useState("");

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterFormValues>({
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

  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setServerError(null);
    setSeedMessage(null);
    setSubmitState("idle");
    setAuthPhase("idle");
    setMode(next);
    router.replace(next === "login" ? "/login" : "/register");
  };

  const handleLoginSubmit = async (values: LoginFormValues) => {
    setServerError(null);
    setSubmitState("loading");
    setAuthPhase("submitting");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const err = await parseErrorResponse(res);
        applyApiValidationErrors(err, loginForm.setError);
        setServerError(err.message);
        setSubmitState("idle");
        setAuthPhase("idle");
        return;
      }

      setSubmitState("success");
      setAuthPhase("success");
      setTimeout(() => {
        router.replace("/tasks");
        router.refresh();
      }, 360);
    } catch {
      setServerError("Unable to reach authentication service.");
      setSubmitState("idle");
      setAuthPhase("idle");
    }
  };

  const handleRegisterSubmit = async (values: RegisterFormValues) => {
    setServerError(null);
    setSubmitState("loading");
    setAuthPhase("submitting");
    const payload = {
      ...values,
      avatar_url: values.avatar_url?.trim()
        ? values.avatar_url.trim()
        : undefined,
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await parseErrorResponse(res);
        applyApiValidationErrors(err, registerForm.setError);
        setServerError(err.message);
        setSubmitState("idle");
        setAuthPhase("idle");
        return;
      }

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
        }),
      });

      if (loginRes.ok) {
        setSubmitState("success");
        setAuthPhase("success");
        setTimeout(() => {
          router.replace("/tasks");
          router.refresh();
        }, 360);
      } else {
        setSubmitState("idle");
        setAuthPhase("idle");
        switchMode("login");
      }
    } catch {
      setServerError("Unable to reach registration service.");
      setSubmitState("idle");
      setAuthPhase("idle");
    }
  };

  const handleTypewriterDemo = () => {
    const targetEmail = "demo@todoapp.local";
    const targetPassword = "Password123!";

    if (shouldReduceMotion) {
      loginForm.setValue("email", targetEmail, { shouldValidate: true });
      loginForm.setValue("password", targetPassword, { shouldValidate: true });
      return;
    }

    const totalSteps = 10;
    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      const emailEnd = Math.ceil((targetEmail.length * step) / totalSteps);
      const passEnd = Math.ceil((targetPassword.length * step) / totalSteps);
      loginForm.setValue("email", targetEmail.slice(0, emailEnd));
      loginForm.setValue("password", targetPassword.slice(0, passEnd));

      if (step >= totalSteps) {
        clearInterval(interval);
        loginForm.trigger(["email", "password"]);
      }
    }, 30);
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
      setSeedMessage("Demo database seeded. Filling credentials...");
      handleTypewriterDemo();
    } catch {
      setServerError("Failed to run demo seeder.");
    } finally {
      setIsSeeding(false);
    }
  };

  const passwordStrength = getPasswordStrength(registerPasswordValue);

  return (
    <div className="grid min-h-screen w-full bg-canvas text-ink-primary lg:grid-cols-12">
      {/* Left 5 Columns: Form Auth Panel */}
      <main className="flex flex-col justify-between border-r border-hairline bg-surface px-6 py-8 sm:px-10 lg:col-span-5 lg:px-12 lg:py-10">
        {/* Minimal Brand Header */}
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-accent" />
          <span className="text-[14px] font-semibold tracking-[-0.015em] text-ink-primary">
            Todo Workspace
          </span>
        </div>

        {/* Form Container */}
        <div className="mx-auto my-8 w-full max-w-[400px]">
          {/* Shared-Element Tab Switcher */}
          <div
            role="tablist"
            aria-label="Authentication mode"
            className="mb-7 grid grid-cols-2 rounded-[8px] border border-hairline bg-canvas p-1"
          >
            {(
              [
                { id: "login", label: "Sign In" },
                { id: "register", label: "Create Account" },
              ] as const
            ).map((tab) => {
              const isActive = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  onClick={() => switchMode(tab.id)}
                  className={cn(
                    "relative z-10 h-8 rounded-[6px] text-[13px] font-medium transition-precision cursor-pointer focus-ring",
                    isActive
                      ? "text-ink-primary"
                      : "text-ink-muted hover:text-ink-secondary"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="auth-tab-indicator"
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 460, damping: 34 }
                      }
                      className="absolute inset-0 -z-10 rounded-[6px] border border-hairline bg-surface"
                    />
                  )}
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Slide-Down Alert Banner */}
          <AnimatePresence>
            {serverError && (
              <motion.div
                role="alert"
                initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                className="mb-5 flex items-start gap-2.5 rounded-[6px] border border-danger/30 bg-danger-tint px-3.5 py-2.5 text-[13px] text-danger"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  strokeWidth={1.75}
                />
                <span>{serverError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {seedMessage && (
            <div className="mb-5 rounded-[6px] border border-success/30 bg-success-tint px-3.5 py-2.5 text-[13px] text-success">
              {seedMessage}
            </div>
          )}

          <AnimatePresence mode="wait">
            {mode === "login" ? (
              <motion.div
                key="login-panel"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              >
                <div className="mb-6">
                  <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">
                    Sign in to your workspace
                  </h1>
                  <p className="mt-1 text-[13px] text-ink-secondary">
                    Enter your credentials to resume your tasks.
                  </p>
                </div>

                <form
                  onSubmit={loginForm.handleSubmit(handleLoginSubmit)}
                  className="space-y-4"
                >
                  <ShakeField
                    hasError={Boolean(loginForm.formState.errors.email)}
                    delay={0.035}
                  >
                    <label
                      htmlFor="auth-login-email"
                      className="mb-1.5 block text-[12px] font-medium text-ink-secondary"
                    >
                      Email
                    </label>
                    <Input
                      id="auth-login-email"
                      type="email"
                      autoComplete="email"
                      placeholder="name@company.com"
                      hasError={Boolean(loginForm.formState.errors.email)}
                      {...loginForm.register("email")}
                    />
                    {loginForm.formState.errors.email && (
                      <p className="mt-1 text-[12px] text-danger">
                        {loginForm.formState.errors.email.message}
                      </p>
                    )}
                  </ShakeField>

                  <ShakeField
                    hasError={Boolean(loginForm.formState.errors.password)}
                    delay={0.07}
                  >
                    <label
                      htmlFor="auth-login-password"
                      className="mb-1.5 block text-[12px] font-medium text-ink-secondary"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Input
                        id="auth-login-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="pr-9"
                        hasError={Boolean(loginForm.formState.errors.password)}
                        onFocus={() => setAuthPhase("typing_password")}
                        {...loginForm.register("password", {
                          onBlur: () => {
                            if (submitState === "idle") setAuthPhase("idle");
                          },
                        })}
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[4px] p-0.5 text-ink-muted hover:text-ink-primary cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                        ) : (
                          <Eye className="h-4 w-4" strokeWidth={1.75} />
                        )}
                      </button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="mt-1 text-[12px] text-danger">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </ShakeField>

                  <div className="pt-1">
                    <MorphSubmitButton state={submitState} idleLabel="Sign in" />
                  </div>
                </form>

                {ENABLE_DEMO_MODE && (
                  <div className="mt-6 rounded-[8px] border border-hairline bg-canvas p-3">
                    <div className="mb-2 flex items-center justify-between text-[11px]">
                      <span className="font-medium text-ink-secondary">
                        Development demo
                      </span>
                      <span className="font-mono text-ink-muted">
                        demo@todoapp.local
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleTypewriterDemo}
                        className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[6px] border border-strong bg-surface px-2.5 text-[12px] font-medium text-ink-primary hover:bg-subtle transition-precision cursor-pointer"
                      >
                        <Sparkles
                          className="h-3.5 w-3.5 text-accent"
                          strokeWidth={1.75}
                        />
                        <span>Try Demo Account</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSeedDemo}
                        disabled={isSeeding}
                        className="inline-flex h-7 items-center justify-center rounded-[6px] px-2.5 text-[12px] font-medium text-ink-secondary hover:bg-subtle hover:text-ink-primary transition-precision cursor-pointer"
                      >
                        {isSeeding ? "Seeding..." : "Seed DB"}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="register-panel"
                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              >
                <div className="mb-5">
                  <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-ink-primary">
                    Create your account
                  </h1>
                  <p className="mt-1 text-[13px] text-ink-secondary">
                    Set up your profile to start organizing tasks.
                  </p>
                </div>

                <form
                  onSubmit={registerForm.handleSubmit(handleRegisterSubmit)}
                  className="space-y-3"
                >
                  <ShakeField
                    hasError={Boolean(
                      registerForm.formState.errors.first_name ||
                        registerForm.formState.errors.last_name
                    )}
                    delay={0.035}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="auth-reg-first"
                          className="mb-1 block text-[12px] font-medium text-ink-secondary"
                        >
                          First name
                        </label>
                        <Input
                          id="auth-reg-first"
                          placeholder="Budi"
                          hasError={Boolean(
                            registerForm.formState.errors.first_name
                          )}
                          {...registerForm.register("first_name")}
                        />
                        {registerForm.formState.errors.first_name && (
                          <p className="mt-1 text-[11px] text-danger">
                            {registerForm.formState.errors.first_name.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="auth-reg-last"
                          className="mb-1 block text-[12px] font-medium text-ink-secondary"
                        >
                          Last name
                        </label>
                        <Input
                          id="auth-reg-last"
                          placeholder="Santoso"
                          hasError={Boolean(
                            registerForm.formState.errors.last_name
                          )}
                          {...registerForm.register("last_name")}
                        />
                        {registerForm.formState.errors.last_name && (
                          <p className="mt-1 text-[11px] text-danger">
                            {registerForm.formState.errors.last_name.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </ShakeField>

                  <ShakeField
                    hasError={Boolean(
                      registerForm.formState.errors.username ||
                        registerForm.formState.errors.phone_number
                    )}
                    delay={0.07}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="auth-reg-user"
                          className="mb-1 block text-[12px] font-medium text-ink-secondary"
                        >
                          Username
                        </label>
                        <Input
                          id="auth-reg-user"
                          placeholder="budi_s"
                          hasError={Boolean(
                            registerForm.formState.errors.username
                          )}
                          {...registerForm.register("username")}
                        />
                        {registerForm.formState.errors.username && (
                          <p className="mt-1 text-[11px] text-danger">
                            {registerForm.formState.errors.username.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="auth-reg-phone"
                          className="mb-1 block text-[12px] font-medium text-ink-secondary"
                        >
                          Phone number
                        </label>
                        <Input
                          id="auth-reg-phone"
                          placeholder="+62812345678"
                          hasError={Boolean(
                            registerForm.formState.errors.phone_number
                          )}
                          {...registerForm.register("phone_number")}
                        />
                        {registerForm.formState.errors.phone_number && (
                          <p className="mt-1 text-[11px] text-danger">
                            {registerForm.formState.errors.phone_number.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </ShakeField>

                  <ShakeField
                    hasError={Boolean(registerForm.formState.errors.email)}
                    delay={0.105}
                  >
                    <label
                      htmlFor="auth-reg-email"
                      className="mb-1 block text-[12px] font-medium text-ink-secondary"
                    >
                      Email
                    </label>
                    <Input
                      id="auth-reg-email"
                      type="email"
                      placeholder="budi@mail.com"
                      hasError={Boolean(registerForm.formState.errors.email)}
                      {...registerForm.register("email")}
                    />
                    {registerForm.formState.errors.email && (
                      <p className="mt-1 text-[11px] text-danger">
                        {registerForm.formState.errors.email.message}
                      </p>
                    )}
                  </ShakeField>

                  <ShakeField
                    hasError={Boolean(registerForm.formState.errors.password)}
                    delay={0.14}
                  >
                    <label
                      htmlFor="auth-reg-pass"
                      className="mb-1 block text-[12px] font-medium text-ink-secondary"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Input
                        id="auth-reg-pass"
                        type={showPassword ? "text" : "password"}
                        placeholder="Min. 8 characters"
                        className="pr-9"
                        hasError={Boolean(
                          registerForm.formState.errors.password
                        )}
                        onFocus={() => setAuthPhase("typing_password")}
                        {...registerForm.register("password", {
                          onChange: (e) =>
                            setRegisterPasswordValue(e.target.value),
                          onBlur: () => {
                            if (submitState === "idle") setAuthPhase("idle");
                          },
                        })}
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword ? "Hide password" : "Show password"
                        }
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-[4px] p-0.5 text-ink-muted hover:text-ink-primary cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" strokeWidth={1.75} />
                        ) : (
                          <Eye className="h-4 w-4" strokeWidth={1.75} />
                        )}
                      </button>
                    </div>

                    {/* 4-Segment Architectural Password Strength Bar */}
                    <div
                      className="mt-2 grid grid-cols-4 gap-1"
                      aria-label="Password strength"
                    >
                      {[1, 2, 3, 4].map((segment) => {
                        const active = passwordStrength >= segment;
                        const colorClass =
                          passwordStrength <= 1
                            ? "bg-danger"
                            : passwordStrength === 2
                              ? "bg-warning"
                              : passwordStrength === 3
                                ? "bg-[#2563EB]"
                                : "bg-success";
                        return (
                          <span
                            key={segment}
                            className={cn(
                              "h-1 rounded-[2px] transition-precision",
                              active ? colorClass : "bg-subtle"
                            )}
                          />
                        );
                      })}
                    </div>

                    {registerForm.formState.errors.password && (
                      <p className="mt-1 text-[11px] text-danger">
                        {registerForm.formState.errors.password.message}
                      </p>
                    )}
                  </ShakeField>

                  <div className="pt-1.5">
                    <MorphSubmitButton
                      state={submitState}
                      idleLabel="Create account"
                    />
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-[12px] text-ink-muted">
          Protected by HttpOnly BFF session cookies
        </p>
      </main>

      {/* Right 7 Columns: Living Workspace Canvas */}
      <AuthShowcaseCanvas authPhase={authPhase} />
    </div>
  );
}
