export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function get<T = any>(path: string): Promise<T> {
  const r = await fetch(API + path, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export async function post<T = any>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

/** POST that returns an SSE stream; calls onEvent for each `data:` JSON payload. */
export async function postStream(path: string, body: unknown, onEvent: (ev: any) => void, signal?: AbortSignal) {
  const r = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok || !r.body) throw new Error(`${r.status} ${await r.text()}`);
  const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const p of parts) if (p.startsWith("data: ")) onEvent(JSON.parse(p.slice(6)));
  }
}

// ---------- types (mirror api/app/main.py) ----------
export type Noul = { type: "noul"; noul: number };
export type Choice = { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> };
export type JevAnswers = Record<string, any> & { _meta?: { cost: number; latency_ms: number; model: string } };
export type PlanView = {
  id: string; category: string; insurer: string; plan: string; premium_from_inr: number | null; premium_note: string | null;
  cover: string | null; claim_settlement_ratio: number | null; network: string | null; highlights: string[] | null;
  exclusions?: string[] | null; source_url?: string | null;
};
export type PolicyCard = {
  type: "policy"; policy_no: string; holder_name: string; category: string; insurer: string; plan: string; insured_item: string | null;
  sum_insured_inr: number | null; premium_inr: number | null; start_date: string; end_date: string; days_left: number;
  add_ons: string[]; ncb_pct: number | null; status: string;
};
export type Card =
  | { type: "confirm"; fields: Record<string, string> }
  | { type: "claim"; claim_id: string; fields: Record<string, string> }
  | { type: "status"; id: string; status: string; incident_date: string }
  | { type: "handoff" }
  | PolicyCard
  | { type: "plans"; category: string; budget_inr: number | null; within_budget: boolean; as_of: string; plans: PlanView[] }
  | { type: "compare"; as_of: string; plans: PlanView[] };

export type Message = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  jev?: JevAnswers | null;
  route?: string | null;
  cards?: Card[] | null;
  latency_ms?: number | null;
};

export type Score = {
  conversation_id: string;
  criterion: string;
  prob: number;
  verdict: "pass" | "fail" | "review";
  reason: string | null;
  human_label: "pass" | "fail" | null;
};

export type CriterionStat = { criterion: string; passed: number; failed: number; pending: number; human: number; pass_rate: number | null };
export type RunStats = {
  conversations: number; judged: number; bot_cost: number; judge_cost: number; quality: number | null;
  p50: number | null; p95: number | null; criteria: CriterionStat[]; pass_rate: number | null;
  pending: number; verdict: string; auto_graded: number; total_criteria: number;
};
export type Run = { id: string; label: string; status: string; total: number; target: { prompt_variant?: string }; created_at: string; stats: RunStats };
