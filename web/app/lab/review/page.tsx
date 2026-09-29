"use client";

import { CheckCheck, Inbox, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Empty, Kpi, label, pct, ProbBar } from "@/components/pk";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { get, post, type Score } from "@/lib/api";

type Item = Score & { persona: string | null; source: string; run_id: string | null };
type Calib = {
  bins: { bin: number; n: number; avg_prob: number; human_pass: number }[];
  agreement: { n: number; rate: number | null };
  totals: { total: number; review: number };
};

export default function ReviewPage() {
  return <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-8"><Skeleton className="h-64" /></div>}><Review /></Suspense>;
}

function Review() {
  const runId = useSearchParams().get("run_id");
  const [items, setItems] = useState<Item[] | null>(null);
  const [criteria, setCriteria] = useState<Record<string, string>>({});
  const [cal, setCal] = useState<Calib | null>(null);

  const load = useCallback(() => {
    get<Item[]>(`/reviews${runId ? `?run_id=${runId}` : ""}`).then(setItems);
    get<Calib>("/calibration").then(setCal);
  }, [runId]);

  useEffect(() => {
    load();
    get("/suite").then((s) => setCriteria(s.criteria));
  }, [load]);

  async function mark(it: Item, lbl: "pass" | "fail") {
    setItems((xs) => xs?.filter((x) => !(x.conversation_id === it.conversation_id && x.criterion === it.criterion)) ?? null);
    try {
      await post(`/reviews/${it.conversation_id}/${it.criterion}`, { label: lbl });
      get<Calib>("/calibration").then(setCal);
    } catch (e) {
      toast.error("Could not save label", { description: String(e) });
      load();
    }
  }

  const reviewShare = cal && cal.totals.total ? cal.totals.review / cal.totals.total : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Review queue</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Only decisions where Jev is uncertain (30–70%) land here. Everything else was auto-graded. {runId && <>Filtered to one run · <Link className="text-primary hover:underline" href="/lab/review">show all</Link></>}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi title="Waiting for you" value={items?.length ?? "—"} accent />
        <Kpi title="Sent to review" value={pct(reviewShare)} sub={`of ${cal?.totals.total ?? 0} decisions`} />
        <Kpi title="Jev ↔ human agreement" value={pct(cal?.agreement.rate)} sub={`on ${cal?.agreement.n ?? 0} spot-checked auto-grades`} />
        <Kpi title="Human labels" value={cal?.bins.reduce((a, b) => a + Number(b.n), 0) ?? "—"} sub="feed the calibration chart" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Queue">
          {items == null ? <Skeleton className="h-64" /> : items.length === 0 ? (
            <Empty icon={CheckCheck} title="Queue is clear">Nothing needs a human right now. New uncertain decisions appear here after each run.</Empty>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((it) => (
                <li key={it.conversation_id + it.criterion} className="rounded-3xl border bg-card shadow-soft p-4 pk-in">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium capitalize">{label(it.criterion)}</span>
                    <span className="text-xs text-muted-foreground">· {it.persona ? label(it.persona) : "live chat"}</span>
                    <Link href={`/lab/c/${it.conversation_id}`} className="ml-auto text-xs font-medium text-primary hover:underline">Open transcript</Link>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{criteria[it.criterion]}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <ProbBar value={it.prob} />
                    <span className="w-24 shrink-0 text-right text-xs tabular">Jev says {Math.round(it.prob * 100)}% yes</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="lg" variant="outline" onClick={() => mark(it, "pass")}><ThumbsUp className="text-success" /> Pass</Button>
                    <Button size="lg" variant="outline" onClick={() => mark(it, "fail")}><ThumbsDown className="text-destructive" /> Fail</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="h-fit rounded-3xl border bg-card shadow-soft p-5" aria-labelledby="cal">
          <h2 id="cal" className="font-semibold">Calibration</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">When Jev says X% yes, how often do humans say pass? A calibrated model tracks the diagonal.</p>
          <Calibration bins={cal?.bins ?? []} />
        </section>
      </div>
    </div>
  );
}

function Calibration({ bins }: { bins: Calib["bins"] }) {
  const byBin = Object.fromEntries(bins.map((b) => [b.bin, b]));
  if (bins.length === 0) return <div className="mt-4"><Empty icon={Inbox} title="No labels yet">Label a few items to see calibration.</Empty></div>;
  return (
    <div className="mt-4">
      <div className="flex h-40 items-end gap-2 border-b border-l pl-1" role="img" aria-label="Calibration chart: human pass rate per Jev probability bucket">
        {[0, 1, 2, 3, 4].map((i) => {
          const b = byBin[i];
          return (
            <div key={i} className="relative flex h-full flex-1 flex-col justify-end">
              <div className="absolute inset-x-0 border-t border-dashed border-foreground/30" style={{ bottom: `${i * 20 + 10}%` }} title="perfect calibration" />
              {b ? (
                <div className="rounded-t bg-jev/80 transition-[height] duration-300" style={{ height: `${Math.max(2, Number(b.human_pass) * 100)}%` }} title={`${b.n} labels · human pass ${pct(Number(b.human_pass))}`} />
              ) : <div className="h-px" />}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-2 pl-1 text-[10px] text-muted-foreground">
        {["0–20", "20–40", "40–60", "60–80", "80–100"].map((l) => <span key={l} className="flex-1 text-center tabular">{l}%</span>)}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-jev/80" /> human pass rate</span>
        <span className="flex items-center gap-1.5"><span className="w-3 border-t border-dashed border-foreground/40" /> ideal</span>
      </div>
    </div>
  );
}
