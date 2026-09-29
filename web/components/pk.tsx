"use client";

import { ArrowUpRight, CheckCircle, Moon, Question, Sun, XCircle } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useRef } from "react";
import { gsap, MOTION_OK, ScrollTrigger, useGSAP, EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const pct = (v: number | null | undefined, d = 0) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
export const usd = (v: number | string | null | undefined) => {
  const n = Number(v ?? 0);
  return n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(3)}`;
};
export const ms = (v: number | null | undefined) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`);
export const label = (s: string) => s.replace(/_/g, " ");
export const inr = (v: number | null | undefined) => (v == null ? "—" : `₹${Math.round(v).toLocaleString("en-IN")}`);

/** Double-bezel card: a machined outer tray with a concentric inner core. */
export function Bezel({ className, inner, children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { inner?: string }) {
  return (
    <div className={cn("rounded-[2rem] bg-foreground/[0.035] p-1.5 ring-1 ring-foreground/[0.05] dark:bg-white/[0.03] dark:ring-white/[0.07]", className)} {...rest}>
      <div className={cn(
        "h-full rounded-[calc(2rem-0.375rem)] bg-card shadow-soft shadow-[inset_0_1px_1px_rgba(255,255,255,0.7)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]",
        inner,
      )}>
        {children}
      </div>
    </div>
  );
}

/** Tiny pill label above headlines. */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-secondary-foreground ring-1 ring-primary/10", className)}>
      {children}
    </span>
  );
}

type CtaProps = { children: React.ReactNode; variant?: "primary" | "ghost" | "light" | "glass"; icon?: React.ElementType; className?: string } & (
  | { href: string; onClick?: never; disabled?: never }
  | { href?: never; onClick: () => void; disabled?: boolean }
);

/** Pill CTA with the trailing icon nested in its own circle (button-in-button) and press physics. */
export function Cta({ children, variant = "primary", icon: Icon = ArrowUpRight, className, ...rest }: CtaProps) {
  const cls = cn(
    "group inline-flex items-center gap-3 rounded-full py-2 pl-6 pr-2 text-sm font-medium transition-[transform,background-color,color,box-shadow] duration-500 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
    variant === "primary" && "bg-ink text-ink-foreground shadow-soft hover:shadow-[0_18px_40px_-18px_rgb(99_91_255/60%)]",
    variant === "light" && "bg-hero-foreground text-hero hover:shadow-[0_18px_50px_-18px_rgb(99_91_255/80%)]",
    variant === "ghost" && "bg-foreground/[0.04] text-foreground ring-1 ring-foreground/10 hover:bg-foreground/[0.07]",
    variant === "glass" && "bg-white/[0.06] text-hero-foreground ring-1 ring-white/15 hover:bg-white/[0.1]",
    className,
  );
  const inner = (
    <>
      <span>{children}</span>
      <span className={cn(
        "grid size-8 place-items-center rounded-full transition-transform duration-500 group-hover:-translate-y-px group-hover:translate-x-1 group-hover:scale-105",
        variant === "ghost" ? "bg-foreground/[0.06]" : variant === "glass" ? "bg-white/10" : variant === "light" ? "bg-black/[0.06]" : "bg-white/15 dark:bg-black/10",
      )}>
        <Icon className="size-4" aria-hidden />
      </span>
    </>
  );
  if (rest.href) return <Link href={rest.href} className={cls}>{inner}</Link>;
  return <button type="button" onClick={rest.onClick} disabled={rest.disabled} className={cls}>{inner}</button>;
}

/** Number that counts up when scrolled into view. Renders the final value without JS / with reduced motion. */
export function Count({ to, format, className }: { to: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const el = ref.current;
      if (!el) return;
      const o = { v: 0 };
      el.textContent = format(0);
      gsap.to(o, {
        v: to, duration: 1.6, ease: EASE,
        onUpdate: () => { el.textContent = format(o.v); },
        scrollTrigger: { trigger: el, start: "top 95%", once: true },
      });
      return () => { el.textContent = format(to); };
    });
    ScrollTrigger.refresh();
  }, { dependencies: [to], scope: ref });
  return <span ref={ref} className={cn("tabular", className)}>{format(to)}</span>;
}

/** Horizontal probability bar with the pass (0.7) and fail (0.3) thresholds marked. Fills via transform (see useReveal). */
export function ProbBar({ value, thresholds = true, tone, className }: { value: number; thresholds?: boolean; tone?: "jev" | "auto"; className?: string }) {
  const color =
    tone === "jev" ? "bg-jev" : value >= 0.7 ? "bg-success" : value <= 0.3 ? "bg-destructive" : "bg-warning";
  const v = Math.max(0.02, Math.min(1, value));
  return (
    <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/[0.06]", className)} role="meter" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div data-bar={v} className={cn("h-full w-full origin-left rounded-full", color)} style={{ transform: `scaleX(${v})` }} />
      {thresholds && (
        <>
          <span className="absolute inset-y-0 left-[30%] w-px bg-foreground/25" />
          <span className="absolute inset-y-0 left-[70%] w-px bg-foreground/25" />
        </>
      )}
    </div>
  );
}

export function Verdict({ v, human }: { v: "pass" | "fail" | "review" | string; human?: string | null }) {
  const eff = human ?? v;
  const map = {
    pass: { Icon: CheckCircle, cls: "text-success bg-success/10", text: "Pass" },
    fail: { Icon: XCircle, cls: "text-destructive bg-destructive/10", text: "Fail" },
    review: { Icon: Question, cls: "text-warning bg-warning/10", text: "Review" },
  } as const;
  const m = map[eff as keyof typeof map] ?? map.review;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", m.cls)}>
      <m.Icon className="size-3.5" aria-hidden />
      {m.text}
      {human && <span className="opacity-70">· human</span>}
    </span>
  );
}

export function VerdictPill({ verdict }: { verdict: string }) {
  const cls =
    verdict === "Pilot-ready" ? "bg-success/12 text-success ring-success/30"
      : verdict === "Needs work" ? "bg-warning/12 text-warning ring-warning/30"
      : verdict === "Not ready" ? "bg-destructive/12 text-destructive ring-destructive/30"
      : "bg-muted text-muted-foreground ring-border";
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", cls)}>{verdict}</span>;
}

export function Kpi({ title, value, sub, accent, count }: {
  title: string; value: React.ReactNode; sub?: React.ReactNode; accent?: boolean; count?: { to: number; format: (n: number) => string };
}) {
  return (
    <div data-reveal className={cn("rounded-[1.5rem] bg-card p-5 shadow-soft ring-1 ring-foreground/[0.05] dark:ring-white/[0.07]", accent && "bg-secondary/60 ring-primary/20")}>
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <div className="pk-display mt-1.5 text-[28px] font-semibold leading-none tabular">{count ? <Count to={count.to} format={count.format} /> : value}</div>
      {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[1.5rem] bg-foreground/[0.02] p-10 text-center ring-1 ring-dashed ring-foreground/10">
      <Icon className="size-7 text-muted-foreground" aria-hidden />
      <div className="font-medium">{title}</div>
      {children && <div className="max-w-sm text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // icons swap via CSS so there is no hydration mismatch and no mounted-state effect
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Toggle light / dark theme"
      className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground active:scale-95"
    >
      <Moon className="size-[18px] dark:hidden" />
      <Sun className="hidden size-[18px] dark:block" />
    </button>
  );
}

export const selectCls =
  "h-10 rounded-full bg-foreground/[0.04] px-3.5 text-sm outline-none ring-1 ring-foreground/10 focus-visible:ring-3 focus-visible:ring-ring/50";
