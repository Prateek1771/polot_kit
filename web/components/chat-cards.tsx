"use client";

import {
  Bike, CalendarClock, Car, Check, CheckCircle2, ClipboardCheck, GitCompareArrows, Headset, HeartPulse, Plane, ShieldCheck,
  SquareCheckBig, Umbrella, X,
} from "lucide-react";
import { Fragment } from "react";
import { inr, label } from "@/components/pk";
import { Button } from "@/components/ui/button";
import type { Card, PlanView, PolicyCard } from "@/lib/api";
import { cn } from "@/lib/utils";

const CAT_ICON: Record<string, React.ElementType> = { car: Car, bike: Bike, health: HeartPulse, term: Umbrella, travel: Plane };
const COVER_LABEL: Record<string, string> = { car: "IDV", bike: "IDV", health: "Sum insured", term: "Life cover", travel: "Cover" };
const AVATAR_TONES = ["bg-primary/12 text-primary", "bg-jev/12 text-jev", "bg-warning/12 text-warning", "bg-success/12 text-success"];

function InsurerAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const tone = AVATAR_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold", tone, className)} aria-hidden>{initials}</span>;
}

function Csr({ v }: { v: number | null }) {
  if (v == null) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success" title="Claim settlement ratio">
      <ShieldCheck className="size-3" aria-hidden /> CSR {v}%
    </span>
  );
}

const shell = "rounded-2xl border bg-card p-3.5 text-sm shadow-soft";
const per = (p: PlanView) => (p.category === "travel" ? " /trip" : " /yr");

export function ChatCard({ card, onSend, disabled }: { card: Card; onSend: (text: string) => void; disabled: boolean }) {
  switch (card.type) {
    case "handoff":
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-3.5 text-sm">
          <Headset className="size-5 shrink-0 text-warning" aria-hidden />
          <div><div className="font-medium">Connecting you to a human advisor</div><div className="text-xs text-muted-foreground">Available 9am–9pm IST, Mon–Sat</div></div>
        </div>
      );
    case "status":
      return (
        <div className={shell}>
          <div className="text-xs text-muted-foreground">Claim</div>
          <div className="font-mono font-medium">{card.id}</div>
          <div className="mt-2 inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">{label(card.status)}</div>
        </div>
      );
    case "policy":
      return <PolicyTile p={card} />;
    case "plans":
      return <PlansCard card={card} onSend={onSend} disabled={disabled} />;
    case "compare":
      return <CompareCard plans={card.plans} asOf={card.as_of} />;
    default: {
      const rows = Object.entries(card.fields);
      return (
        <div className={cn(shell, card.type === "claim" && "border-success/30 bg-success/5")}>
          <div className="flex items-center gap-2 font-medium">
            {card.type === "claim"
              ? <><CheckCircle2 className="size-4 text-success" aria-hidden /> Claim filed · <span className="font-mono">{card.claim_id}</span></>
              : <><ClipboardCheck className="size-4 text-primary" aria-hidden /> Please confirm your claim</>}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {rows.map(([k, v]) => (<Fragment key={k}><dt className="text-muted-foreground">{label(k)}</dt><dd>{v}</dd></Fragment>))}
          </dl>
          {card.type === "confirm" && (
            <Button size="sm" className="mt-3" onClick={() => onSend("Yes, that's correct")} disabled={disabled}><SquareCheckBig /> Yes, that&rsquo;s correct</Button>
          )}
        </div>
      );
    }
  }
}

function Renewal({ days }: { days: number }) {
  const [cls, text] =
    days < 0 ? ["bg-destructive/10 text-destructive", `Expired ${-days} days ago`]
      : days <= 30 ? ["bg-warning/12 text-warning", `Renews in ${days} days`]
      : ["bg-muted text-muted-foreground", `${days} days left`];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", cls)}><CalendarClock className="size-3" aria-hidden /> {text}</span>;
}

function PolicyTile({ p }: { p: PolicyCard }) {
  const Icon = CAT_ICON[p.category] ?? ShieldCheck;
  return (
    <div className={cn(shell, "w-full max-w-md")}>
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Icon className="size-4.5" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{p.plan}</div>
          <div className="text-xs text-muted-foreground">{p.insurer} · <span className="font-mono">{p.policy_no}</span></div>
        </div>
        <Renewal days={p.days_left} />
      </div>
      {p.insured_item && <div className="mt-3 rounded-xl bg-muted/60 px-3 py-2 text-xs">{p.insured_item}</div>}
      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><dt className="text-muted-foreground">{COVER_LABEL[p.category] ?? "Cover"}</dt><dd className="mt-0.5 font-semibold tabular">{inr(p.sum_insured_inr)}</dd></div>
        <div><dt className="text-muted-foreground">Premium / yr</dt><dd className="mt-0.5 font-semibold tabular">{inr(p.premium_inr)}</dd></div>
        <div><dt className="text-muted-foreground">Valid till</dt><dd className="mt-0.5 font-semibold tabular">{p.end_date}</dd></div>
      </dl>
      {(p.add_ons.length > 0 || p.ncb_pct != null) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.ncb_pct != null && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">NCB {p.ncb_pct}%</span>}
          {p.add_ons.map((a) => <span key={a} className="rounded-full border px-2 py-0.5 text-[11px]">{a}</span>)}
        </div>
      )}
    </div>
  );
}

function PlansCard({ card, onSend, disabled }: { card: Extract<Card, { type: "plans" }>; onSend: (t: string) => void; disabled: boolean }) {
  const names = card.plans.map((p) => `${p.insurer} ${p.plan}`);
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{card.plans.length} {label(card.category)} plans</span>
        {card.budget_inr != null && (
          <span className={cn("rounded-full px-2 py-0.5", card.within_budget ? "bg-success/10 text-success" : "bg-warning/12 text-warning")}>
            {card.within_budget ? `within ${inr(card.budget_inr)}/yr` : `none within ${inr(card.budget_inr)}/yr — lowest priced shown`}
          </span>
        )}
        <span>Indicative prices · {card.as_of}</span>
      </div>
      <ul className="-mx-1 flex snap-x gap-2.5 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]" aria-label="Recommended plans">
        {card.plans.map((p) => <PlanTile key={p.id} p={p} onAsk={() => onSend(`I'd like to talk to an advisor about ${p.insurer} ${p.plan}`)} disabled={disabled} />)}
      </ul>
      {card.plans.length >= 2 && (
        <Button variant="outline" size="sm" className="self-start rounded-full" disabled={disabled} onClick={() => onSend(`Compare ${names.join(" vs ")}`)}>
          <GitCompareArrows /> Compare side by side
        </Button>
      )}
    </div>
  );
}

function PlanTile({ p, onAsk, disabled }: { p: PlanView; onAsk: () => void; disabled: boolean }) {
  return (
    <li className={cn(shell, "flex w-64 shrink-0 snap-start flex-col gap-2.5")}>
      <div className="flex items-center gap-2.5">
        <InsurerAvatar name={p.insurer} />
        <div className="min-w-0">
          <div className="truncate font-semibold leading-tight" title={p.insurer}>{p.insurer.split(" (")[0]}</div>
          <div className="truncate text-xs text-muted-foreground" title={p.plan}>{p.plan}</div>
        </div>
      </div>
      <div>
        <div className="text-[11px] text-muted-foreground">from</div>
        <div className="text-xl font-semibold tracking-tight tabular">{p.premium_from_inr ? inr(p.premium_from_inr) : "On request"}<span className="text-xs font-normal text-muted-foreground">{p.premium_from_inr ? per(p) : ""}</span></div>
        {p.premium_note && <div className="line-clamp-2 text-[11px] text-muted-foreground" title={p.premium_note}>{p.premium_note}</div>}
      </div>
      <div className="flex flex-wrap gap-1.5"><Csr v={p.claim_settlement_ratio} />{p.network && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{p.network}</span>}</div>
      {p.cover && <div className="text-xs text-muted-foreground">{p.cover}</div>}
      <ul className="flex flex-col gap-1 text-xs">
        {(p.highlights ?? []).slice(0, 3).map((h) => <li key={h} className="flex gap-1.5"><Check className="mt-0.5 size-3 shrink-0 text-success" aria-hidden />{h}</li>)}
      </ul>
      <Button size="sm" variant="secondary" className="mt-auto rounded-full" onClick={onAsk} disabled={disabled}><Headset /> Ask an advisor</Button>
    </li>
  );
}

function CompareCard({ plans, asOf }: { plans: PlanView[]; asOf: string }) {
  const rows: [string, (p: PlanView) => React.ReactNode][] = [
    ["Premium", (p) => (p.premium_from_inr ? <span className="font-semibold tabular">{inr(p.premium_from_inr)}{per(p)}</span> : "On request")],
    ["Cover", (p) => p.cover ?? "—"],
    ["Claim settlement", (p) => (p.claim_settlement_ratio != null ? <Csr v={p.claim_settlement_ratio} /> : "—")],
    ["Network", (p) => p.network ?? "—"],
    ["Highlights", (p) => <ul className="flex flex-col gap-1">{(p.highlights ?? []).map((h) => <li key={h} className="flex gap-1.5"><Check className="mt-0.5 size-3 shrink-0 text-success" aria-hidden />{h}</li>)}</ul>],
    ["Exclusions", (p) => <ul className="flex flex-col gap-1">{(p.exclusions ?? []).map((h) => <li key={h} className="flex gap-1.5"><X className="mt-0.5 size-3 shrink-0 text-destructive" aria-hidden />{h}</li>)}</ul>],
  ];
  return (
    <div className={cn(shell, "w-full overflow-x-auto p-0")}>
      <table className="w-full min-w-[480px] text-left text-xs">
        <caption className="px-3.5 pt-3 text-left text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground"><GitCompareArrows className="size-3.5" aria-hidden /> Side-by-side</span> · indicative, as of {asOf}
        </caption>
        <thead>
          <tr className="border-b">
            <th scope="col" className="w-24 p-3.5"><span className="sr-only">Attribute</span></th>
            {plans.map((p) => (
              <th key={p.id} scope="col" className="p-3.5 align-top font-normal">
                <div className="flex items-center gap-2"><InsurerAvatar name={p.insurer} className="size-7 rounded-lg text-[10px]" />
                  <div><div className="font-semibold">{p.insurer.split(" (")[0]}</div><div className="text-muted-foreground">{p.plan}</div></div></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, f]) => (
            <tr key={name} className="border-b last:border-0">
              <th scope="row" className="p-3.5 align-top font-medium text-muted-foreground">{name}</th>
              {plans.map((p) => <td key={p.id} className="p-3.5 align-top">{f(p)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
