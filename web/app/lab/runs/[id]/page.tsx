"use client";

import { ArrowLeft, ArrowRight, CircleNotch, Tray, Warning, XCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bezel, Empty, Eyebrow, Kpi, label, ms, pct, usd, VerdictPill } from "@/components/pk";
import { Skeleton } from "@/components/ui/skeleton";
import { get, streamUrl, type Run, type RunStats } from "@/lib/api";
import { useReveal } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Report = {
  run: Run;
  stats: RunStats;
  failures: { conversation_id: string; criterion: string; prob: number; reason: string | null; persona: string }[];
};
type Conv = { id: string; persona: string; status: string; outcome: string | null; quality_score: number | null; turns: number; passed: number; failed: number; pending: number; ended_reason: string | null };

export default function RunReport() {
  const { id } = useParams<{ id: string }>();
  const [rep, setRep] = useState<Report | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [progress, setProgress] = useState<{ status: string; total: number; judged: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useReveal(root, [!!rep, convs.length, rep?.stats.criteria.length, rep?.failures.length]);

  useEffect(() => {
    const load = () => {
      get<Report>(`/runs/${id}/report`).then(setRep);
      get<Conv[]>(`/conversations?run_id=${id}`).then(setConvs);
    };
    load();
    let es: EventSource | null = null;
    let last = -1;
    let closed = false;
    // EventSource can't send an Authorization header, so the token rides in the URL (streamUrl)
    streamUrl(`/runs/${id}/events`).then((url) => {
      if (closed) return;
      const src = new EventSource(url);
      es = src;
      src.onmessage = (e) => {
        const p = JSON.parse(e.data);
        setProgress(p);
        if (p.judged !== last) { last = p.judged; load(); }
        if (p.status === "done" || p.status === "failed") { src.close(); load(); }
      };
      src.onerror = () => src.close();
    });
    return () => { closed = true; es?.close(); };
  }, [id]);

  if (!rep) return <div ref={root} className="mx-auto max-w-7xl px-4 py-16"><Skeleton className="h-10 w-72 rounded-full" /><Skeleton className="mt-8 h-28 rounded-[2rem]" /><Skeleton className="mt-5 h-64 rounded-[2rem]" /></div>;
  const s = rep.stats;
  const running = progress ? !["done", "failed"].includes(progress.status) : !["done", "failed"].includes(rep.run.status);
  const judged = Number(s.judged) || 0;
  const autoShare = s.total_criteria ? s.auto_graded / s.total_criteria : null;

  return (
    <div ref={root} className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:pt-14">
      <Link href="/lab" className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 transition-transform duration-500 group-hover:-translate-x-0.5" /> Test Lab</Link>
      <div data-reveal className="mt-5">
        <Eyebrow>Readiness report · {rep.run.target.prompt_variant === "bad" ? "broken prompt" : "production prompt"}</Eyebrow>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <h1 className="text-[36px] font-medium leading-[1.02] sm:text-[52px]">{rep.run.label || "Suite run"}</h1>
          <VerdictPill verdict={running ? "Running" : s.verdict} />
        </div>
      </div>

      {running && (
        <div className="mt-6 rounded-[1.5rem] bg-secondary/60 p-5 ring-1 ring-primary/20 pk-in" role="status">
          <div className="flex items-center gap-2 text-sm font-medium"><CircleNotch className="size-4 animate-spin text-primary" /> Simulating & grading… {progress?.judged ?? judged}/{progress?.total || rep.run.total || "?"} conversations</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-700" style={{ transform: `scaleX(${(progress?.judged ?? 0) / Math.max(1, progress?.total ?? 1)})` }} />
          </div>
        </div>
      )}

      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi title="Pass rate" value={pct(s.pass_rate)} count={s.pass_rate == null ? undefined : { to: s.pass_rate, format: (n) => pct(n) }} sub={`${judged} conversations graded`} accent />
        <Kpi title="Auto-graded by Jev" value={pct(autoShare)} count={autoShare == null ? undefined : { to: autoShare, format: (n) => pct(n) }} sub={`${s.pending} awaiting human`} />
        <Kpi title="Reply latency p50" value={ms(s.p50)} count={s.p50 == null ? undefined : { to: s.p50, format: ms }} sub={`p95 ${ms(s.p95)}`} />
        <Kpi title="Quality score" value={s.quality == null ? "—" : `${(s.quality * 3).toFixed(1)} / 3`} sub="Jev score · 3 = pilot-ready" />
        <Kpi title="Bot cost / conv" value={usd(judged ? Number(s.bot_cost) / judged : 0)} sub={`total ${usd(s.bot_cost)}`} />
        <Kpi title="Judge cost (all)" value={usd(s.judge_cost)} sub="Jev + LLM explanations" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Bezel data-reveal inner="p-6"><section aria-labelledby="crit">
          <h2 id="crit" className="font-semibold">Criteria</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Each is a Jev <code>noul</code>. ≥70% auto-pass, ≤30% auto-fail, between goes to review.</p>
          {s.criteria.length === 0 ? <p className="mt-6 text-sm text-muted-foreground">No scores yet.</p> : (
            <ul className="mt-4 flex flex-col gap-4">
              {s.criteria.map((c) => {
                const total = c.passed + c.failed + c.pending || 1;
                return (
                  <li key={c.criterion}>
                    <div className="mb-1.5 flex items-baseline justify-between text-sm">
                      <span className="font-medium capitalize">{label(c.criterion)}</span>
                      <span className="tabular text-muted-foreground">{pct(c.pass_rate)} <span className="text-xs">({c.passed}✓ {c.failed}✗{c.pending ? ` ${c.pending}?` : ""})</span></span>
                    </div>
                    <div data-bar="1" className="flex h-2.5 origin-left overflow-hidden rounded-full bg-foreground/[0.06]" aria-label={`${c.passed} passed, ${c.failed} failed, ${c.pending} pending`}>
                      <div className="bg-success" style={{ width: `${(c.passed / total) * 100}%` }} />
                      <div className="bg-destructive" style={{ width: `${(c.failed / total) * 100}%` }} />
                      <div className="bg-warning [background-image:repeating-linear-gradient(45deg,transparent_0_3px,rgb(255_255_255/.35)_3px_6px)]" style={{ width: `${(c.pending / total) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-success" /> pass</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-destructive" /> fail</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-warning" /> needs review</span>
          </div>
          {s.pending > 0 && (
            <Link href={`/lab/review?run_id=${id}`} className="group mt-5 flex items-center justify-between rounded-full bg-warning/[0.07] py-2 pl-4 pr-2 text-sm ring-1 ring-warning/25 transition-colors duration-500 hover:bg-warning/[0.12]">
              <span className="flex items-center gap-2"><Tray className="size-4 text-warning" /> {s.pending} uncertain decisions need a human</span>
              <span className="grid size-8 place-items-center rounded-full bg-warning/10 transition-transform duration-500 group-hover:translate-x-1"><ArrowRight className="size-4" /></span>
            </Link>
          )}
        </section></Bezel>

        <Bezel data-reveal inner="p-6"><section aria-labelledby="fails">
          <h2 id="fails" className="font-semibold">Top failures</h2>
          {rep.failures.length === 0 ? (
            <div className="mt-4"><Empty icon={Warning} title={running ? "Nothing failed yet" : "No failures"}>{running ? "Failures appear as conversations are graded." : "Every decided criterion passed."}</Empty></div>
          ) : (
            <ul className="mt-3 flex flex-col divide-y">
              {rep.failures.map((f, i) => (
                <li key={i} className="py-3">
                  <Link href={`/lab/c/${f.conversation_id}`} className="group block">
                    <div className="flex items-center gap-2 text-sm">
                      <XCircle className="size-4 shrink-0 text-destructive" aria-hidden />
                      <span className="font-medium capitalize">{label(f.criterion)}</span>
                      <span className="text-xs text-muted-foreground">· {label(f.persona ?? "live")}</span>
                      <span className="ml-auto text-xs tabular text-muted-foreground">p={f.prob.toFixed(2)}</span>
                    </div>
                    {f.reason && <p className="mt-1 pl-6 text-xs text-muted-foreground group-hover:text-foreground">{f.reason}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section></Bezel>
      </div>

      <section className="mt-16" aria-labelledby="convs">
        <h2 id="convs" data-reveal className="text-2xl font-medium">Conversations</h2>
        <div data-reveal className="mt-4 overflow-x-auto rounded-[1.5rem] bg-card shadow-soft ring-1 ring-foreground/[0.06] dark:ring-white/[0.08]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 font-medium">Persona</th>
                <th className="px-3 py-2.5 font-medium">Turns</th>
                <th className="px-3 py-2.5 font-medium">Ended</th>
                <th className="px-3 py-2.5 font-medium">Outcome</th>
                <th className="px-3 py-2.5 font-medium">Checks</th>
                <th className="px-3 py-2.5"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {convs.map((c) => (
                <tr key={c.id} className="transition-colors duration-300 hover:bg-foreground/[0.02]">
                  <td className="px-3 py-2.5 font-medium capitalize">{label(c.persona)}</td>
                  <td className="px-3 py-2.5 tabular">{c.turns}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{c.ended_reason ? label(c.ended_reason) : c.status === "open" ? <span className="inline-flex items-center gap-1 text-primary"><CircleNotch className="size-3 animate-spin" /> chatting</span> : "—"}</td>
                  <td className="px-3 py-2.5">{c.outcome ? label(c.outcome) : <span className="text-muted-foreground">{c.status}</span>}</td>
                  <td className="px-3 py-2.5 text-xs tabular">
                    {c.status === "judged" ? (
                      <span className="flex gap-2"><span className="text-success">{c.passed}✓</span><span className={cn(c.failed ? "text-destructive" : "text-muted-foreground")}>{c.failed}✗</span>{c.pending > 0 && <span className="text-warning">{c.pending}?</span>}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right"><Link href={`/lab/c/${c.id}`} className="text-sm font-medium text-primary hover:underline">Transcript</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
