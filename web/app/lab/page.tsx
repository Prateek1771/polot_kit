"use client";

import { ArrowRight, FlaskConical, GitCompareArrows, Loader2, MessagesSquare, Play, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Empty, label, pct, ProbBar, selectCls, usd, VerdictPill } from "@/components/pk";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { get, post, type Run } from "@/lib/api";
import { cn } from "@/lib/utils";

type Suite = { title: string; personas: { id: string; style: string; goal: string }[]; criteria: Record<string, string> };
type Conv = { id: string; persona: string | null; status: string; outcome: string | null; quality_score: number | null; turns: number; passed: number; failed: number; pending: number; created_at: string };

export default function LabPage() {
  const router = useRouter();
  const [suite, setSuite] = useState<Suite | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [live, setLive] = useState<Conv[] | null>(null);
  const [tab, setTab] = useState<"runs" | "live">("runs");
  const [pick, setPick] = useState<string[]>([]);
  const [form, setForm] = useState({ label: "", prompt_variant: "good", repeats: 1 });
  const [starting, setStarting] = useState(false);

  const load = useCallback(() => {
    get<Run[]>("/runs").then(setRuns).catch(() => setRuns([]));
    get<Conv[]>("/conversations?source=live&limit=50").then(setLive).catch(() => setLive([]));
  }, []);

  useEffect(() => {
    get<Suite>("/suite").then(setSuite).catch(() => toast.error("API unreachable", { description: "Is the backend running on :8000?" }));
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function start() {
    setStarting(true);
    try {
      const { run_id } = await post("/runs", { ...form, label: form.label || `${form.prompt_variant === "good" ? "Production" : "Broken"} prompt` });
      router.push(`/lab/runs/${run_id}`);
    } catch (e) {
      toast.error("Could not start run", { description: String(e) });
      setStarting(false);
    }
  }

  const togglePick = (id: string) => setPick((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-medium leading-[1.05] sm:text-[40px]">Test Lab. <span className="text-primary">Proof before the pilot.</span></h1>
          <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">Simulated customers and shoppers stress-test the CoverWise Assistant. Jev grades every conversation; only uncertain calls reach a human.</p>
        </div>
        {pick.length === 2 && (
          <Link className={buttonVariants({ size: "lg", variant: "outline" })} href={`/lab/compare?a=${pick[0]}&b=${pick[1]}`}>
            <GitCompareArrows /> Compare selected
          </Link>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        {/* New run */}
        <section className="rounded-3xl border bg-card shadow-soft p-5" aria-labelledby="newrun">
          <h2 id="newrun" className="flex items-center gap-2 font-semibold"><FlaskConical className="size-4 text-primary" aria-hidden /> New suite run</h2>
          <p className="mt-1 text-xs text-muted-foreground">{suite?.title ?? "Loading suite…"}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label htmlFor="rl" className="text-xs font-medium">Label</label>
              <Input id="rl" className="mt-1 h-9" placeholder="e.g. v2 prompt with disclosure" value={form.label} maxLength={80}
                onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="rv" className="text-xs font-medium">Agent prompt</label>
              <select id="rv" className={cn(selectCls, "mt-1 w-full")} value={form.prompt_variant} onChange={(e) => setForm({ ...form, prompt_variant: e.target.value })}>
                <option value="good">Production prompt</option>
                <option value="bad">Broken prompt (no disclosure, echoes IDs)</option>
              </select>
            </div>
            <div>
              <label htmlFor="rr" className="text-xs font-medium">Runs per persona</label>
              <select id="rr" className={cn(selectCls, "mt-1 w-full")} value={form.repeats} onChange={(e) => setForm({ ...form, repeats: +e.target.value })}>
                {[1, 2, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          <Button className="mt-4 w-full" size="lg" onClick={start} disabled={starting || !suite}>
            {starting ? <Loader2 className="animate-spin" /> : <Play />} Run {(suite?.personas.length ?? 0) * form.repeats} conversations
          </Button>
        </section>

        {/* Personas */}
        <section className="rounded-3xl border bg-card shadow-soft p-5" aria-labelledby="personas">
          <h2 id="personas" className="flex items-center gap-2 font-semibold"><Users className="size-4 text-primary" aria-hidden /> Personas</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {suite ? suite.personas.map((p) => (
              <li key={p.id} className="rounded-lg border p-3">
                <div className="text-sm font-medium capitalize">{label(p.id)}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.goal}</div>
              </li>
            )) : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </ul>
        </section>
      </div>

      {/* Tabs */}
      <div className="mt-8 flex items-center gap-1 border-b" role="tablist">
        {([["runs", "Suite runs", FlaskConical], ["live", "Live conversations", MessagesSquare]] as const).map(([k, t, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm", tab === k ? "border-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <Icon className="size-4" aria-hidden /> {t}
          </button>
        ))}
      </div>

      {tab === "runs" ? (
        runs == null ? <Skeleton className="mt-4 h-40" /> : runs.length === 0 ? (
          <div className="mt-4"><Empty icon={FlaskConical} title="No runs yet">Start a suite run above. Try the broken prompt first, then the production one, and compare.</Empty></div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="w-10 px-3 py-2.5"><span className="sr-only">Select to compare</span></th>
                  <th className="px-3 py-2.5 font-medium">Run</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">Pass rate</th>
                  <th className="px-3 py-2.5 font-medium">Verdict</th>
                  <th className="px-3 py-2.5 font-medium">Needs review</th>
                  <th className="px-3 py-2.5 font-medium">Judge cost</th>
                  <th className="px-3 py-2.5"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {runs.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-3">
                      <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={pick.includes(r.id)} onChange={() => togglePick(r.id)} aria-label={`Select ${r.label} for comparison`} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium">{r.label || "Untitled run"}</div>
                      <div className="text-xs text-muted-foreground">{r.target.prompt_variant === "bad" ? "Broken prompt" : "Production prompt"} · {new Date(r.created_at).toLocaleString()}</div>
                    </td>
                    <td className="px-3 py-3"><RunStatus r={r} /></td>
                    <td className="px-3 py-3">
                      <div className="flex w-36 items-center gap-2">
                        <ProbBar value={r.stats.pass_rate ?? 0} thresholds={false} />
                        <span className="w-10 text-right tabular">{pct(r.stats.pass_rate)}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3"><VerdictPill verdict={r.stats.verdict} /></td>
                    <td className="px-3 py-3 tabular">{r.stats.pending > 0 ? <span className="font-medium text-warning">{r.stats.pending}</span> : <span className="text-muted-foreground">0</span>}<span className="text-muted-foreground"> / {r.stats.total_criteria}</span></td>
                    <td className="px-3 py-3 tabular">{usd(r.stats.judge_cost)}</td>
                    <td className="px-3 py-3 text-right">
                      <Link href={`/lab/runs/${r.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Report <ArrowRight className="size-3.5" /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : live == null ? <Skeleton className="mt-4 h-40" /> : live.length === 0 ? (
        <div className="mt-4"><Empty icon={MessagesSquare} title="No live conversations yet">Chat with the assistant and press “End &amp; grade” — it lands here, scored by Jev.</Empty></div>
      ) : (
        <ul className="mt-4 divide-y rounded-xl border">
          {live.map((c) => (
            <li key={c.id}>
              <Link href={`/lab/c/${c.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-muted/30">
                <MessagesSquare className="size-4 text-muted-foreground" aria-hidden />
                <span className="text-sm font-medium">Live chat · {c.turns} turns</span>
                <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                <span className="ml-auto flex items-center gap-3 text-xs tabular">
                  {c.status !== "judged" ? <span className="text-muted-foreground">{c.status}</span> : (
                    <>
                      <span className="text-success">{c.passed} pass</span>
                      <span className="text-destructive">{c.failed} fail</span>
                      {c.pending > 0 && <span className="text-warning">{c.pending} review</span>}
                    </>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RunStatus({ r }: { r: Run }) {
  if (r.status === "done") return <span className="text-xs text-muted-foreground">Done · {r.stats.judged}/{r.total}</span>;
  if (r.status === "failed") return <span className="text-xs text-destructive">Failed</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-primary">
      <Loader2 className="size-3.5 animate-spin" aria-hidden /> {r.status === "queued" ? "Queued" : `${r.stats.judged}/${r.total}`}
    </span>
  );
}
