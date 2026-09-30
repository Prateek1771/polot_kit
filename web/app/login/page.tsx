"use client";

import { ArrowRight, EnvelopeSimple, Key, ShieldCheck } from "@phosphor-icons/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { resendCode, signIn, signUp, verifyCode, type AuthResult } from "@/app/auth/actions";
import { Bezel, Eyebrow } from "@/components/pk";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup" | "code";

/** Only same-site paths, so ?next= can't bounce users to another origin. */
function safeNext(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : "/chat";
}

export default function LoginPage() {
  return <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16"><Skeleton className="h-96" /></div>}><Login /></Suspense>;
}

function Login() {
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  async function run(fn: () => Promise<AuthResult>) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      if (r.ok) return done(); // signed in (password, sign-up without verification, or a verified code)
      if (r.needsCode) {
        setMode("code");
        setMsg({ tone: "info", text: `We emailed a 6-digit code to ${r.email ?? email}. Enter it to finish.` });
      } else if (r.error) setMsg({ tone: "error", text: r.error });
    } catch {
      setMsg({ tone: "error", text: "Couldn't reach the sign-in service. Try again." });
    } finally {
      setBusy(false);
    }
  }

  function done() {
    router.replace(next);
    router.refresh();
  }

  const title = { signin: "Welcome back.", signup: "Create your account.", code: "Check your email." }[mode];

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-md flex-col justify-center px-4 py-12">
      <Bezel inner="p-7 sm:p-8">
        <Eyebrow><ShieldCheck className="size-3" aria-hidden /> CoverWise account</Eyebrow>
        <h1 className="pk-display mt-4 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "code"
            ? "Your code expires in a few minutes."
            : "Sign in to see your own policies and claims. Browsing plans works without an account."}
        </p>

        <form
          className="mt-6 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "signin") run(() => signIn(email, password));
            else if (mode === "signup") run(() => signUp(email, password));
            else run(() => verifyCode(email, code.trim()));
          }}>
          {mode !== "code" ? (
            <>
              <Field icon={EnvelopeSimple} label="Email">
                <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent py-2.5 text-sm outline-none" />
              </Field>
              <Field icon={Key} label="Password">
                <input type="password" required minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent py-2.5 text-sm outline-none" />
              </Field>
            </>
          ) : (
            <Field icon={Key} label="6-digit code">
              <input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoFocus autoComplete="one-time-code"
                value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-transparent py-2.5 font-mono text-lg tracking-[0.4em] outline-none" />
            </Field>
          )}

          {msg && (
            <p role={msg.tone === "error" ? "alert" : "status"}
              className={cn("rounded-xl px-3 py-2 text-sm", msg.tone === "error" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
              {msg.text}
            </p>
          )}

          <button type="submit" disabled={busy}
            className="group mt-1 inline-flex items-center justify-between gap-3 rounded-full bg-ink py-2 pl-6 pr-2 text-sm font-medium text-ink-foreground shadow-soft transition-[transform,box-shadow] duration-500 ease-spring active:scale-[0.98] disabled:opacity-50">
            <span>{busy ? "One moment…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Verify and continue"}</span>
            <span className="grid size-8 place-items-center rounded-full bg-white/15 transition-transform duration-500 ease-spring group-hover:translate-x-1 dark:bg-black/10">
              <ArrowRight className="size-4" aria-hidden />
            </span>
          </button>
        </form>

        <div className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signin" && (<>New to CoverWise? <Switch onClick={() => { setMode("signup"); setMsg(null); }}>Create an account</Switch></>)}
          {mode === "signup" && (<>Already have an account? <Switch onClick={() => { setMode("signin"); setMsg(null); }}>Sign in</Switch></>)}
          {mode === "code" && (
            <>Didn&apos;t get it? <Switch onClick={() => run(async () => {
              const r = await resendCode(email);
              return r.ok ? { ok: false, needsCode: true, email } : r;
            })}>Resend the code</Switch></>
          )}
        </div>
      </Bezel>
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 rounded-2xl bg-foreground/[0.03] px-3 ring-1 ring-foreground/[0.08] focus-within:ring-2 focus-within:ring-primary/40">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {children}
      </span>
    </label>
  );
}

function Switch({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className="font-medium text-primary hover:underline">{children}</button>;
}
