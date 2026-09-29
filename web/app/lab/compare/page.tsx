"use client";

import { ArrowDownRight, ArrowLeft, ArrowUpRight, Minus } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Bezel, Eyebrow, Kpi, label, ms, pct, usd, VerdictPill } from "@/components/pk";
import { Skeleton } from "@/components/ui/skeleton";
import { get, type Run, type RunStats } from "@/lib/api";
import { useReveal } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Cmp = { a: RunStats & { id: string }; b: RunStats & { id: string }; criteria: { criterion: string; a?: number | null; b?: number | null }[] };

export default function ComparePage() {
  return <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8"><Skeleton className="h-64" /></div>}><Compare /></Suspense>;
}

function Delta({ a, b, invert }: { a?: number | null; b?: number | null; invert?: boolean }) {
  if (a == null || b == null) return <span className="text-muted-foreground">—</span>;
  const d = b - a;
  const good = invert ? d < 0 : d > 0;
  if (Math.abs(d) < 0.005) return <span className="inline-flex items-center gap-1 text-muted-foreground"><Minus className="size-3.5" /> 0</span>;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-medium tabular", good ? "text-success" : "text-destructive")}>
      {d > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{(Math.abs(d) * 100).toFixed(0)} pts
    </span>
  );
}

function Compare() {
  const q = useSearchParams();
  const [a, b] = [q.get("a"), q.get("b")];
  const [cmp, setCmp] = useState<Cmp | null>(null);
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const root = useRef<HTMLDivElement>(null);
  useReveal(root, [!!cmp]);

  useEffect(() => {
    if (!a || !b) return;
    get<Cmp>(`/compare?a=${a}&b=${b}`).then(setCmp);
    get<Run[]>("/runs").then((rs) => setRuns(Object.fromEntries(rs.map((r) => [r.id, r]))));
  }, [a, b]);

  if (!a || !b) return <div className="mx-auto max-w-7xl px-4 py-8 text-sm">Pick two runs in the <Link className="text-primary hover:underline" href="/lab">Test Lab</Link>.</div>;
  if (!cmp) return <div ref={root} className="mx-auto max-w-7xl px-4 py-16"><Skeleton className="h-64 rounded-[2rem]" /></div>;
  const name = (id: string) => runs[id]?.label || id.slice(0, 8);

  return (
    <div ref={root} className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:pt-14">
      <Link href="/lab" className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 transition-transform duration-500 group-hover:-translate-x-0.5" /> Test Lab</Link>
      <div data-reveal className="mt-5">
        <Eyebrow>Before / after</Eyebrow>
        <h1 className="mt-4 text-[36px] font-medium leading-[1.02] sm:text-[52px]">Compare runs. <span className="text-primary">See what the fix fixed.</span></h1>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {(["a", "b"] as const).map((k) => (
          <Bezel key={k} data-reveal className={cn(k === "b" && "ring-primary/25")} inner="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-muted-foreground">{k === "a" ? "Baseline" : "Candidate"}</div>
                <Link href={`/lab/runs/${cmp[k].id}`} className="font-semibold hover:underline">{name(cmp[k].id)}</Link>
              </div>
              <VerdictPill verdict={cmp[k].verdict} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Kpi title="Pass rate" value={pct(cmp[k].pass_rate)} count={cmp[k].pass_rate == null ? undefined : { to: cmp[k].pass_rate!, format: (n) => pct(n) }} />
              <Kpi title="p95 latency" value={ms(cmp[k].p95)} count={cmp[k].p95 == null ? undefined : { to: cmp[k].p95!, format: ms }} />
              <Kpi title="Judge cost" value={usd(cmp[k].judge_cost)} />
            </div>
          </Bezel>
        ))}
      </div>

      <Bezel data-reveal className="mt-5" inner="overflow-x-auto">
      <section aria-labelledby="pc">
        <h2 id="pc" className="px-6 pt-6 font-semibold">Per-criterion pass rate</h2>
        <table className="mt-3 w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr><th className="px-5 py-2.5 font-medium">Criterion</th><th className="px-5 py-2.5 font-medium">{name(cmp.a.id)}</th><th className="px-5 py-2.5 font-medium">{name(cmp.b.id)}</th><th className="px-5 py-2.5 font-medium">Change</th></tr>
          </thead>
          <tbody className="divide-y">
            {cmp.criteria.map((c) => (
              <tr key={c.criterion}>
                <td className="px-5 py-3 font-medium capitalize">{label(c.criterion)}</td>
                {(["a", "b"] as const).map((k) => (
                  <td key={k} className="px-5 py-3">
                    <div className="flex w-40 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]"><div data-bar={Math.max(0.02, c[k] ?? 0)} className={cn("h-full w-full origin-left rounded-full", k === "a" ? "bg-muted-foreground/50" : "bg-primary")} style={{ transform: `scaleX(${Math.max(0.02, c[k] ?? 0)})` }} /></div>
                      <span className="w-10 text-right tabular">{pct(c[k])}</span>
                    </div>
                  </td>
                ))}
                <td className="px-5 py-3"><Delta a={c.a} b={c.b} /></td>
              </tr>
            ))}
            <tr className="bg-foreground/[0.02]">
              <td className="px-5 py-3 font-semibold">Overall</td>
              <td className="px-5 py-3 tabular">{pct(cmp.a.pass_rate)}</td>
              <td className="px-5 py-3 tabular">{pct(cmp.b.pass_rate)}</td>
              <td className="px-5 py-3"><Delta a={cmp.a.pass_rate} b={cmp.b.pass_rate} /></td>
            </tr>
          </tbody>
        </table>
      </section>
      </Bezel>
    </div>
  );
}
