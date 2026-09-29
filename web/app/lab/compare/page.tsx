"use client";

import { ArrowDownRight, ArrowLeft, ArrowUpRight, Minus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Kpi, label, ms, pct, usd, VerdictPill } from "@/components/pk";
import { Skeleton } from "@/components/ui/skeleton";
import { get, type Run, type RunStats } from "@/lib/api";
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

  useEffect(() => {
    if (!a || !b) return;
    get<Cmp>(`/compare?a=${a}&b=${b}`).then(setCmp);
    get<Run[]>("/runs").then((rs) => setRuns(Object.fromEntries(rs.map((r) => [r.id, r]))));
  }, [a, b]);

  if (!a || !b) return <div className="mx-auto max-w-7xl px-4 py-8 text-sm">Pick two runs in the <Link className="text-primary hover:underline" href="/lab">Test Lab</Link>.</div>;
  if (!cmp) return <div className="mx-auto max-w-7xl px-4 py-8"><Skeleton className="h-64" /></div>;
  const name = (id: string) => runs[id]?.label || id.slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Link href="/lab" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Test Lab</Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Compare runs</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {(["a", "b"] as const).map((k) => (
          <div key={k} className={cn("rounded-3xl border bg-card shadow-soft p-5", k === "b" && "border-primary/40")}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-muted-foreground">{k === "a" ? "Baseline" : "Candidate"}</div>
                <Link href={`/lab/runs/${cmp[k].id}`} className="font-semibold hover:underline">{name(cmp[k].id)}</Link>
              </div>
              <VerdictPill verdict={cmp[k].verdict} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Kpi title="Pass rate" value={pct(cmp[k].pass_rate)} />
              <Kpi title="p95 latency" value={ms(cmp[k].p95)} />
              <Kpi title="Judge cost" value={usd(cmp[k].judge_cost)} />
            </div>
          </div>
        ))}
      </div>

      <section className="mt-6 overflow-x-auto rounded-3xl border bg-card shadow-soft" aria-labelledby="pc">
        <h2 id="pc" className="px-5 pt-5 font-semibold">Per-criterion pass rate</h2>
        <table className="mt-3 w-full min-w-[560px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr><th className="px-5 py-2.5 font-medium">Criterion</th><th className="px-5 py-2.5 font-medium">{name(cmp.a.id)}</th><th className="px-5 py-2.5 font-medium">{name(cmp.b.id)}</th><th className="px-5 py-2.5 font-medium">Change</th></tr>
          </thead>
          <tbody className="divide-y">
            {cmp.criteria.map((c) => (
              <tr key={c.criterion}>
                <td className="px-5 py-3 font-medium capitalize">{label(c.criterion)}</td>
                {(["a", "b"] as const).map((k) => (
                  <td key={k} className="px-5 py-3">
                    <div className="flex w-40 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", k === "a" ? "bg-muted-foreground/50" : "bg-primary")} style={{ width: `${(c[k] ?? 0) * 100}%` }} /></div>
                      <span className="w-10 text-right tabular">{pct(c[k])}</span>
                    </div>
                  </td>
                ))}
                <td className="px-5 py-3"><Delta a={c.a} b={c.b} /></td>
              </tr>
            ))}
            <tr className="bg-muted/20">
              <td className="px-5 py-3 font-semibold">Overall</td>
              <td className="px-5 py-3 tabular">{pct(cmp.a.pass_rate)}</td>
              <td className="px-5 py-3 tabular">{pct(cmp.b.pass_rate)}</td>
              <td className="px-5 py-3"><Delta a={cmp.a.pass_rate} b={cmp.b.pass_rate} /></td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
