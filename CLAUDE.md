# PilotKit

Showcase project for Persistence.dev: the **CoverWise Assistant** (codename ClaimChat), plus **Test Lab**, where simulated users stress-test it.
- **One bot for customers and shoppers.** Customers are identified by full name and can check policies and file or track claims. Shoppers get plans picked and compared from a policybazaar.com catalog.
- TypeSafe **Jev** (`typesafe/jev-1.13`, via the OpenRouter Decisions API) makes every typed decision.
- OpenAI `gpt-4o-mini` (through LiteLLM) writes the text.

Design and rationale are in `docs/PILOTKIT.md`; read it before changing behaviour.

## Layout
```
api/            FastAPI + LangGraph backend (Python 3.12, uv)
  app/main.py     routes: /chat (SSE), /conversations, /runs, /reviews, /compare, /calibration, /catalog
  app/bot.py      LangGraph: router (Jev) -> new_claim|tool_gate|status|identify|my_policy|shop|coverage|refuse|handoff|clarify;
                  pick_plans()/named_plans() pure code; chat_turn() streams a reply
  app/jev.py      decide(state, questions, name) -> Jev answers (+ _meta cost/latency). Only Jev entry point.
                  JevProvider: LiteLLM custom provider `jev/<model>` -> /api/alpha/decisions, so Jev is traced like the LLM
  app/llm.py      acall()/complete()/stream(): every LiteLLM call, Jev included (LLM_MODEL=gpt-4o-mini -> OPENAI_API_KEY);
                  Langfuse "langfuse_otel" callback when keys are set; session(conv_id) tags all calls with the chat's session
  app/sim.py      simulated users (Jev next_move + LLM message), run_suite()
  app/judge.py    Jev rubric -> triage() pass/fail/review; the LLM explains failures only
  app/worker.py   arq jobs: run_suite_job, judge_job
  app/db.py       psycopg pool + execute/one/many helpers; schema.sql runs at API startup
  app/data/insurance.yaml  personas, prompts (good/bad), ALL Jev question sets, thresholds
  app/data/policy.md       CoverWise broker terms (KB part 1)
  app/data/catalog.yaml    40 market plans + glossary, a policybazaar.com snapshot (KB part 2); the whole KB goes in the prompt, no RAG
  app/data/customers.yaml  demo customers upserted into the `policy` table at startup (looked up by full name)
  tests/test_core.py
web/            Next.js 16 App Router + Tailwind v4 + shadcn (base-nova, Base UI, not Radix)
  app/page.tsx              landing: dark hero, pinned "one turn" scene, bento, live Lab proof, catalog marquee
  app/chat/page.tsx         assistant chat UI + Jev decision panel
  app/lab/...               runs list, runs/[id] report, c/[id] transcript, review queue, compare
  components/pk.tsx         shared bits: ProbBar, Verdict, Kpi, Empty, ThemeToggle, formatters (usd, inr, ms)
  components/chat-cards.tsx cards the bot sends: policy, plans, compare, confirm, claim, status, handoff
  lib/api.ts                fetch helpers, SSE reader, shared types (mirror main.py)
  lib/motion.ts             the only GSAP entry: plugins, MOTION_OK gate, useReveal()
docker-compose.yml  postgres, redis, api, worker, web
```

## Commands
- Everything: `cp .env.example .env` (set `OPENROUTER_API_KEY` and `OPENAI_API_KEY`), then `docker compose up --build`. Web runs on :3100 and the API on :8000.
- Host ports avoid the self-hosted Langfuse stack (:3000, :5432, :6379): postgres is on 5433 and redis on 6380. In compose, `LANGFUSE_HOST` points at `host.docker.internal:3000`, and trace links use `LANGFUSE_BASE_URL`.
- Backend dev: `docker compose up -d postgres redis`, then in `api/` run `uv run uvicorn app.main:app --reload` and `uv run arq app.worker.WorkerSettings`.
- Backend tests: `cd api && uv run pytest -q`. They need no key or DB.
- Web dev: `cd web && npm run dev` (port 3100). Before finishing, `npx tsc --noEmit`, `npx eslint app components lib` and `npm run build` must all pass.

## Conventions
- **Jev decides, the LLM talks.** Any yes/no, category or rating the code branches on goes to Jev as a question in `insurance.yaml`. Don't prompt-and-parse an LLM for it.
- Every Jev and LLM call goes through LiteLLM (`jev.decide` or `llm.complete/stream`) with a `name=`, so it shows in Langfuse as a named generation. Never call the Decisions API or OpenAI directly. A new entry point (a route, a job) calls `llm.session(conv_id)` first.
- Jev can't do arithmetic, dates or text generation. Compute latency and cost in code, and use the LLM for extraction and explanations.
- Thresholds live in `insurance.yaml` (`pass 0.7 / fail 0.3`). Between the two is the human review queue. There's no review table: the queue is `score where verdict='review' and human_label is null`.
- Live chats and simulated chats share one code path, `bot.chat_turn()`. Don't fork it.
- One assistant serves customers and shoppers. Never add a bot or audience selector; route by intent.
- Policy data is shared only after a full-name match (`memory.customer`). Numbers stay masked in cards and in the prompt.
- Raw SQL through the `db.execute/one/many` helpers, with `db.j()` for jsonb. No ORM. Schema changes go in `schema.sql` (idempotent `create ... if not exists`).
- Frontend:
  - Pages are client components that fetch the API directly.
  - Visual language follows `.agents/skills/high-end-visual-design`:
    - Soft Structuralism app surfaces and an always-dark Ethereal Glass landing hero, with the Persistence indigo `#635bff` accent.
    - Fonts: Geist (body) and Plus Jakarta Sans (`--font-display`, applied to h1/h2 and `.pk-display`). No Helvetica, Inter or Arial.
    - Cards are double-bezel (`Bezel` in `pk.tsx`). CTAs are pills with the icon nested in its own circle (`Cta`). Headlines get an `Eyebrow`.
    - Borders are hairline rings, never solid gray lines.
  - Colours come from tokens only (`primary`, `ink`, `hero`, `success`, `warning`, `destructive`, `jev`), in both themes. The one exception is a few literal tints inside the always-dark hero mockups.
  - Verdicts always show an icon or text, never colour alone.
  - Icons: `@phosphor-icons/react`, weight `light` by default (set by `IconContext` in the Shell). Never lucide in app code (only the vendored `components/ui/*` still import it). Never emoji.
  - Motion:
    - All GSAP goes through `lib/motion.ts`. Mark nodes `data-reveal` (fade-up) or `data-bar="0.73"` (scaleX fill) and call `useReveal(ref, deps)` once per page. Numbers use `<Count>`.
    - Every tween sits inside `gsap.matchMedia(MOTION_OK)`, so reduced-motion users see static, visible content.
    - Animate transform and opacity (plus filter blur) only, never width, height, top or left.
    - Transitions use the `ease-spring` / `--ease-out-expo` curves, not linear or ease-in-out. Continuous scrub and marquee loops are the only `ease: "none"`.
    - `backdrop-blur` is only for the sticky nav and the fixed mobile overlay. No ScrollTrigger inside the chat.
- Next 16 differs from older versions. Check `web/node_modules/next/dist/docs/` before using unfamiliar APIs. `useSearchParams` needs a `<Suspense>` wrapper.
- shadcn here is Base UI. Buttons take a `render` prop, not `asChild`. For link-buttons, use `buttonVariants()` on `<Link>`.
- Mark deliberate shortcuts with `ponytail:` comments that name the ceiling and the upgrade path.

## Gotchas
- `/api/alpha/decisions` is an alpha API. If it breaks, set `JEV_FALLBACK=1` to emulate Jev with the LLM (same answer shape).
- `OPENROUTER_API_KEY` is only for Jev. The LLM is `LLM_MODEL=gpt-4o-mini` (a bare OpenAI name, so LiteLLM uses `OPENAI_API_KEY`). An `openrouter/...` model name would switch the LLM to OpenRouter.
- The claim `CLM-7K2Q9A` and the `customers.yaml` policies (for example "Priya Sharma") are seeded at API startup for the demo.
- Catalog prices are snapshot "starting from" figures. Car/bike prices are PB third-party starting prices, many health/term premiums are null, and travel prices are per trip. `pick_plans` treats null as "not over budget".
- A Langfuse trace link needs the project id. It comes from `LANGFUSE_PROJECT_ID`, or the API resolves it from the keys at startup.
