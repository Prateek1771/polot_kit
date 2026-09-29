"use client";

import { ArrowRight, ArrowsLeftRight, ChatsCircle, CircleNotch, Flask, Play, UsersThree } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bezel, Empty, Eyebrow, label, pct, ProbBar, selectCls, usd, VerdictPill } from "@/components/pk";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { get, post, type Run } from "@/lib/api";
import { useReveal } from "@/lib/motion";
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
  const root = useRef<HTMLDivElement>(null);
  useReveal(root, [runs?.length, live?.length, tab, !!suite]);

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
    <div ref={root} className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:pt-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div data-reveal>
          <Eyebrow>Test Lab · simulated users · Jev-graded</Eyebrow>
          <h1 className="mt-4 text-[36px] font-medium leading-[1.02] sm:text-[56px]">Test Lab. <span className="text-primary">Proof before the pilot.</span></h1>
          <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">Simulated customers and shoppers stress-test the CoverWise Assistant. Jev grades every conversation; only uncertain calls reach a human.</p>
        </div>
        {pick.length === 2 && (
          <Link className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-11 rounded-full px-5 pk-in")} href={`/lab/compare?a=${pick[0]}&b=${pick[1]}`}>
            <ArrowsLeftRight /> Compare selected
          </Link>
        )}
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        {/* New run */}
        <Bezel data-reveal inner="p-6"><section aria-labelledby="newrun">
          <h2 id="newrun" className="flex items-center gap-2 font-semibold"><Flask className="size-5 text-primary" aria-hidden /> New suite run</h2>
          <p className="mt-1 text-xs text-muted-foreground">{suite?.title ?? "Loading suite…"}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label htmlFor="rl" className="text-xs font-medium">Label</label>
              <Input id="rl" className="mt-1.5 h-10 rounded-full px-4" placeholder="e.g. v2 prompt with disclosure" value={form.label} maxLength={80}
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
          <Button className="mt-5 h-11 w-full rounded-full active:scale-[0.98]" size="lg" onClick={start} disabled={starting || !suite}>
            {starting ? <CircleNotch className="animate-spin" /> : <Play weight="fill" />} Run {(suite?.personas.length ?? 0) * form.repeats} conversations
          </Button>
        </section></Bezel>

        {/* Personas */}
        <Bezel data-reveal inner="p-6"><section aria-labelledby="personas">
          <h2 id="personas" className="flex items-center gap-2 font-semibold"><UsersThree className="size-5 text-primary" aria-hidden /> Personas</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {suite ? suite.personas.map((p) => (
              <li key={p.id} className="rounded-[1.25rem] bg-foreground/[0.025] p-3.5 ring-1 ring-foreground/[0.05] transition-transform duration-500 hover:-translate-y-0.5">
                <div className="text-sm font-medium capitalize">{label(p.id)}</div>
                <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.goal}</div>
              </li>
            )) : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </ul>
        </section></Bezel>
      </div>

      {/* Tabs */}
      <div data-reveal className="mt-14 inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] p-1 ring-1 ring-foreground/[0.06]" role="tablist">
        {([["runs", "Suite runs", Flask], ["live", "Live conversations", ChatsCircle]] as const).map(([k, t, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm transition-[background-color,color,box-shadow] duration-500", tab === k ? "bg-card font-medium shadow-soft" : "text-muted-foreground hover:text-foreground")}>
            <Icon className="size-4" aria-hidden /> {t}
          </button>
        ))}
      </div>

      {tab === "runs" ? (
        runs == null ? <Skeleton className="mt-4 h-40" /> : runs.length === 0 ? (
          <div className="mt-4"><Empty icon={Flask} title="No runs yet">Start a suite run above. Try the broken prompt first, then the production one, and compare.</Empty></div>
        ) : (
          <div data-reveal className="mt-5 overflow-x-auto rounded-[1.5rem] bg-card shadow-soft ring-1 ring-foreground/[0.06] dark:ring-white/[0.08]">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
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
                  <tr key={r.id} className="transition-colors duration-300 hover:bg-foreground/[0.02]">
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
                      <Link href={`/lab/runs/${r.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Report <ArrowRight className="size-3.5 transition-transform duration-500 group-hover:translate-x-0.5" /></Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : live == null ? <Skeleton className="mt-4 h-40" /> : live.length === 0 ? (
        <div className="mt-4"><Empty icon={ChatsCircle} title="No live conversations yet">Chat with the assistant and press “End &amp; grade” — it lands here, scored by Jev.</Empty></div>
      ) : (
        <ul data-reveal className="mt-5 divide-y rounded-[1.5rem] bg-card shadow-soft ring-1 ring-foreground/[0.06] dark:ring-white/[0.08]">
          {live.map((c) => (
            <li key={c.id}>
              <Link href={`/lab/c/${c.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors duration-300 hover:bg-foreground/[0.02]">
                <ChatsCircle className="size-5 text-muted-foreground" aria-hidden />
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
      <CircleNotch className="size-3.5 animate-spin" aria-hidden /> {r.status === "queued" ? "Queued" : `${r.stats.judged}/${r.total}`}
    </span>
  );
}
