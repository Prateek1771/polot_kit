import { accessToken } from "@/lib/insforge";

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/** HTTP error from our API; status 401 = sign in, 403 = signed in but not allowed. */
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function authHeaders(json = false): Promise<Record<string, string>> {
  const h: Record<string, string> = json ? { "Content-Type": "application/json" } : {};
  const t = await accessToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function ok(r: Response) {
  if (!r.ok) throw new ApiError(r.status, `${r.status} ${await r.text()}`);
  return r;
}

export async function get<T = any>(path: string): Promise<T> {
  return (await ok(await fetch(API + path, { cache: "no-store", headers: await authHeaders() }))).json();
}

export async function post<T = any>(path: string, body?: unknown): Promise<T> {
  return (await ok(await fetch(API + path, {
    method: "POST",
    headers: await authHeaders(true),
    body: body === undefined ? undefined : JSON.stringify(body),
  }))).json();
}

/** Voice mode: raw recorded audio -> transcript (the API transcribes with OpenAI through LiteLLM). */
export async function postAudio(audio: Blob, conversationId?: string | null): Promise<string> {
  const h = await authHeaders();
  h["Content-Type"] = audio.type || "audio/webm";
  const q = conversationId ? `?conversation_id=${encodeURIComponent(conversationId)}` : "";
  const r = await ok(await fetch(`${API}/transcribe${q}`, { method: "POST", headers: h, body: audio }));
  return (await r.json()).text as string;
}

/** URL for an EventSource stream (EventSource can't send headers, so the token rides as ?access_token=). */
export async function streamUrl(path: string): Promise<string> {
  const t = await accessToken();
  return API + path + (t ? `${path.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(t)}` : "");
}

/** POST that returns an SSE stream; calls onEvent for each `data:` JSON payload. */
export async function postStream(path: string, body: unknown, onEvent: (ev: any) => void, signal?: AbortSignal) {
  const r = await fetch(API + path, {
    method: "POST",
    headers: await authHeaders(true),
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok || !r.body) throw new ApiError(r.status, `${r.status} ${await r.text()}`);
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
  | { type: "signin" }
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

export type Me = { user: { id: string; email: string } | null; lab: boolean };
