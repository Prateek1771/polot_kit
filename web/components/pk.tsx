"use client";

import { CircleCheck, CircleHelp, CircleX, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export const pct = (v: number | null | undefined, d = 0) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
export const usd = (v: number | string | null | undefined) => {
  const n = Number(v ?? 0);
  return n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(3)}`;
};
export const ms = (v: number | null | undefined) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`);
export const label = (s: string) => s.replace(/_/g, " ");
export const inr = (v: number | null | undefined) => (v == null ? "—" : `₹${Math.round(v).toLocaleString("en-IN")}`);

/** Horizontal probability bar with the pass (0.7) and fail (0.3) thresholds marked. */
export function ProbBar({ value, thresholds = true, tone, className }: { value: number; thresholds?: boolean; tone?: "jev" | "auto"; className?: string }) {
  const color =
    tone === "jev" ? "bg-jev" : value >= 0.7 ? "bg-success" : value <= 0.3 ? "bg-destructive" : "bg-warning";
  return (
    <div className={cn("relative h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="meter" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-300 ease-out", color)} style={{ width: `${Math.max(2, value * 100)}%` }} />
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
    pass: { Icon: CircleCheck, cls: "text-success bg-success/10", text: "Pass" },
    fail: { Icon: CircleX, cls: "text-destructive bg-destructive/10", text: "Fail" },
    review: { Icon: CircleHelp, cls: "text-warning bg-warning/10", text: "Review" },
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

export function Kpi({ title, value, sub, accent }: { title: string; value: React.ReactNode; sub?: React.ReactNode; accent?: boolean }) {
  return (
    <div className={cn("rounded-2xl border bg-background/60 p-4", accent && "border-primary/40 bg-primary/[0.04]")}>
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-10 text-center">
      <Icon className="size-6 text-muted-foreground" aria-hidden />
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
      className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </button>
  );
}

export const selectCls =
  "h-9 rounded-lg border bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";
