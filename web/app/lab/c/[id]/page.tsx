"use client";

import { ArrowLeft, ArrowSquareOut, CircleNotch, Robot, SealCheck, ThumbsDown, ThumbsUp, User } from "@phosphor-icons/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChatCard } from "@/components/chat-cards";
import { Bezel, Eyebrow, label, ms, ProbBar, usd, Verdict } from "@/components/pk";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { get, post, type Message, type Score } from "@/lib/api";
import { useReveal } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Conv = {
  id: string; source: string; run_id: string | null; persona: string | null; prompt_variant: string; status: string;
  outcome: string | null; quality_score: number | null; bot_cost_usd: string; judge_cost_usd: string; ended_reason: string | null;
  trace_url: string | null; messages: Message[]; scores: Score[]; state: { customer?: { name: string } } | null;
  claim: { id: string; policy_no: string; incident_date: string; description: string } | null;
};

const FLAG: [string, string, string][] = [
  ["injection", "injection", "text-destructive bg-destructive/10"],
  ["needs_human", "human", "text-warning bg-warning/10"],
  ["pii_overshare", "PII", "text-warning bg-warning/10"],
  ["confirms", "confirms", "text-success bg-success/10"],
];

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Conv | null>(null);
  const load = useCallback(() => get<Conv>(`/conversations/${id}`).then(setC), [id]);
  const root = useRef<HTMLDivElement>(null);
  useReveal(root, [!!c, c?.scores.length]);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (c?.status !== "judged" && c?.status !== "error") load(); }, 3000);
    return () => clearInterval(t);
  }, [load, c?.status]);

  async function mark(criterion: string, lbl: "pass" | "fail") {
    await post(`/reviews/${id}/${criterion}`, { label: lbl });
    toast.success(`Marked ${label(criterion)} as ${lbl}`);
    load();
  }

  if (!c) return <div ref={root} className="mx-auto max-w-7xl px-4 py-16"><Skeleton className="h-10 w-72 rounded-full" /><Skeleton className="mt-8 h-96 rounded-[2rem]" /></div>;

  return (
    <div ref={root} className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:pt-14">
      <Link href={c.run_id ? `/lab/runs/${c.run_id}` : "/lab"} className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4 transition-transform duration-500 group-hover:-translate-x-0.5" /> {c.run_id ? "Run report" : "Test Lab"}
      </Link>
      <div data-reveal className="mt-5"><Eyebrow>Transcript · Jev scorecard</Eyebrow></div>
      <div data-reveal className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-[32px] font-medium capitalize leading-[1.05] sm:text-[44px]">{c.persona ? label(c.persona) : "Live conversation"}</h1>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{c.source === "sim" ? "simulated" : "live"}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{c.prompt_variant === "bad" ? "broken prompt" : "production prompt"}</span>
        {c.state?.customer && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"><SealCheck className="size-3.5" weight="fill" aria-hidden /> verified: {c.state.customer.name}</span>
        )}
        {c.trace_url && (
          <a href={c.trace_url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Langfuse trace <ArrowSquareOut className="size-4" />
          </a>
        )}
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Bezel data-reveal inner="">
        <section aria-label="Transcript">
          <ol className="flex flex-col gap-4 p-5">
            {c.messages.map((m) => (
              <li key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                <div className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", m.role === "user" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                  {m.role === "user" ? <User className="size-4" aria-hidden /> : <Robot className="size-4" aria-hidden />}
                </div>
                <div className={cn("flex min-w-0 max-w-[85%] flex-col gap-1.5", m.role === "user" && "items-end")}>
                  <div className={cn("whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm", m.role === "user" ? "rounded-3xl rounded-tr-lg bg-primary px-4 py-2.5 text-primary-foreground" : "rounded-3xl rounded-tl-lg bg-muted px-4 py-2.5")}>{m.content}</div>
                  {m.role === "user" && m.jev && (
                    <div className="flex flex-wrap justify-end gap-1 text-[11px]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-jev/10 px-2 py-0.5 font-medium text-jev">
                        <span className="size-1.5 rounded-full bg-jev" /> {label(m.route ?? "")} · {label(m.jev.intent?.choice ?? "")} {Math.round((m.jev.intent?.confidence ?? 0) * 100)}%
                      </span>
                      {FLAG.filter(([k]) => (m.jev?.[k]?.noul ?? 0) >= 0.5).map(([k, t, cls]) => (
                        <span key={k} className={cn("rounded-full px-2 py-0.5 font-medium", cls)}>{t} {Math.round(m.jev![k].noul * 100)}%</span>
                      ))}
                    </div>
                  )}
                  {m.role === "assistant" && m.cards?.map((card, k) => <ChatCard key={k} card={card} onSend={() => {}} disabled />)}
                  {m.role === "assistant" && m.latency_ms != null && <span className="text-[11px] tabular text-muted-foreground">{ms(m.latency_ms)}</span>}
                </div>
              </li>
            ))}
          </ol>
          {c.ended_reason && <div className="border-t px-5 py-3 text-xs text-muted-foreground">Ended: {label(c.ended_reason)}</div>}
        </section>
        </Bezel>

        <aside className="flex flex-col gap-4">
          <Bezel data-reveal inner="p-6"><section aria-labelledby="sc">
            <div className="flex items-center justify-between">
              <h2 id="sc" className="font-semibold">Jev scorecard</h2>
              {c.status === "error" ? <span className="text-xs font-medium text-destructive">Not graded · {label(c.ended_reason ?? "error")}</span>
                : c.status !== "judged" && <span className="inline-flex items-center gap-1 text-xs text-primary"><CircleNotch className="size-3.5 animate-spin" /> {c.status === "open" ? "in progress" : "grading"}</span>}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div><dt className="text-muted-foreground">Outcome</dt><dd className="mt-0.5 font-medium capitalize">{c.outcome ? label(c.outcome) : "—"}</dd></div>
              <div><dt className="text-muted-foreground">Quality</dt><dd className="mt-0.5 font-medium tabular">{c.quality_score == null ? "—" : `${(c.quality_score * 3).toFixed(1)} / 3`}</dd></div>
              <div><dt className="text-muted-foreground">Cost</dt><dd className="mt-0.5 font-medium tabular" title={`bot ${usd(c.bot_cost_usd)} · judge ${usd(c.judge_cost_usd)}`}>{usd(Number(c.bot_cost_usd) + Number(c.judge_cost_usd))}</dd></div>
            </dl>
            <ul className="mt-4 flex flex-col divide-y">
              {c.scores.map((s) => (
                <li key={s.criterion} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium capitalize">{label(s.criterion)}</span>
                    <Verdict v={s.verdict} human={s.human_label} />
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <ProbBar value={s.prob} />
                    <span className="w-9 text-right text-xs tabular text-muted-foreground">{Math.round(s.prob * 100)}%</span>
                  </div>
                  {s.reason && <p className="mt-1.5 text-xs text-muted-foreground">{s.reason}</p>}
                  <div className="mt-2 flex gap-1.5">
                    <Button size="xs" className="rounded-full px-2.5" variant={s.human_label === "pass" ? "secondary" : "ghost"} onClick={() => mark(s.criterion, "pass")} aria-label={`Label ${s.criterion} as pass`}><ThumbsUp /> Pass</Button>
                    <Button size="xs" className="rounded-full px-2.5" variant={s.human_label === "fail" ? "secondary" : "ghost"} onClick={() => mark(s.criterion, "fail")} aria-label={`Label ${s.criterion} as fail`}><ThumbsDown /> Fail</Button>
                  </div>
                </li>
              ))}
              {c.scores.length === 0 && <li className="py-3 text-sm text-muted-foreground">Not graded yet.</li>}
            </ul>
          </section></Bezel>

          {c.claim && (
            <section data-reveal className="rounded-[1.5rem] bg-success/[0.06] p-5 text-sm ring-1 ring-success/25" aria-labelledby="cl">
              <h2 id="cl" className="font-semibold">Claim filed · <span className="font-mono">{c.claim.id}</span></h2>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Policy</dt><dd>{c.claim.policy_no}</dd>
                <dt className="text-muted-foreground">Date</dt><dd>{c.claim.incident_date}</dd>
                <dt className="text-muted-foreground">What happened</dt><dd>{c.claim.description}</dd>
              </dl>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
