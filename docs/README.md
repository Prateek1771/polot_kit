# PilotKit docs

Design, rationale and trade-offs: [`PILOTKIT.md`](PILOTKIT.md). Running it on AWS from 1k to 1M users: [`scaling-aws.md`](scaling-aws.md).

Four diagrams of how PilotKit works, generated with [Archify](https://github.com/tt-a1i/archify) from the code at commit `52b68ba`. Each one is a standalone HTML page you can pan, zoom and search. Each also has a 6-second **WebM recording** of its trace animation, which shows requests travelling along the arrows.

| Diagram | What it shows | Open | Recording |
|---|---|---|---|
| **System architecture** | Browser → Next.js → FastAPI → LangGraph bot → LiteLLM → {Jev via the `jev/` custom provider, OpenAI gpt-4o-mini}; LiteLLM → Langfuse (every call, per chat session); Postgres; Redis/arq worker | [pilotkit-system.html](diagrams/architecture-pilotkit-system-20260929-222149/pilotkit-system.html) | [pilotkit-system.webm](diagrams/architecture-pilotkit-system-20260929-222149/pilotkit-system.webm) |
| **One chat turn** (sequence) | `POST /chat` → `chat_turn()` → Jev router (5 questions) → one branch (identify / claim + tool gate / shop) → streamed reply over SSE | [pilotkit-chat-turn.html](diagrams/sequence-pilotkit-chat-turn-20260929-222149/pilotkit-chat-turn.html) | [pilotkit-chat-turn.webm](diagrams/sequence-pilotkit-chat-turn-20260929-222149/pilotkit-chat-turn.webm) |
| **Test Lab suite run** (workflow) | Start run → arq job → simulated user ↔ bot ↔ Jev `next_move` loop → Jev rubric → triage → report, with uncertain verdicts sent to the human review queue | [pilotkit-test-lab.html](diagrams/workflow-pilotkit-test-lab-20260929-222149/pilotkit-test-lab.html) | [pilotkit-test-lab.webm](diagrams/workflow-pilotkit-test-lab-20260929-222149/pilotkit-test-lab.webm) |
| **Conversation lifecycle** | `open → judging → judged` (plus `error`), with the identity (full-name lookup) and claim-confirmation memory flows | [pilotkit-conversation.html](diagrams/lifecycle-pilotkit-conversation-20260929-222149/pilotkit-conversation.html) | [pilotkit-conversation.webm](diagrams/lifecycle-pilotkit-conversation-20260929-222149/pilotkit-conversation.webm) |

Open an `.html` file straight in a browser; there's no server and no network. Viewer tips:
- **Live / Still** toggles the trace animation.
- **PATH** finds the route between two nodes.
- **LENS** highlights one kind of node.
- **Export** downloads a PNG, SVG or WebM.
- The `SRC` badges show the exact source file and lines each node describes.

## Scaling on AWS
[`scaling-aws.md`](scaling-aws.md) covers PilotKit on AWS from 1k to 1M monthly active users. It has a load model built from measured latency, token and cost data, four tiers with services, sizing and cost, the alarms that trigger each step up, and the code changes each tier needs. Six more Archify diagrams go with it, verified against commit `6c0aabe`:

| Diagram | What it shows | Open | Recording |
|---|---|---|---|
| **T1 · 1k MAU** | ECS Fargate (web, api, worker) · RDS single-AZ · ElastiCache · one NAT | [pilotkit-aws-t1-1k.html](diagrams/architecture-pilotkit-aws-t1-1k-20260930-000203/pilotkit-aws-t1-1k.html) | [pilotkit-aws-t1-1k.webm](diagrams/architecture-pilotkit-aws-t1-1k-20260930-000203/pilotkit-aws-t1-1k.webm) |
| **T2 · 10k MAU** | 2 AZs · RDS Multi-AZ · autoscaling · WAF · CI/CD | [pilotkit-aws-t2-10k.html](diagrams/architecture-pilotkit-aws-t2-10k-20260930-000203/pilotkit-aws-t2-10k.html) | [pilotkit-aws-t2-10k.webm](diagrams/architecture-pilotkit-aws-t2-10k-20260930-000203/pilotkit-aws-t2-10k.webm) |
| **T3 · 100k MAU** | LiteLLM Proxy + Bedrock fallback · Aurora + RDS Proxy · OTP · self-hosted Langfuse | [pilotkit-aws-t3-100k.html](diagrams/architecture-pilotkit-aws-t3-100k-20260930-000203/pilotkit-aws-t3-100k.html) | [pilotkit-aws-t3-100k.webm](diagrams/architecture-pilotkit-aws-t3-100k-20260930-000203/pilotkit-aws-t3-100k.webm) |
| **T4 · 1M MAU** | partitioned Aurora Global · state cache · SQS Test Lab · ap-south-2 DR | [pilotkit-aws-t4-1m.html](diagrams/architecture-pilotkit-aws-t4-1m-20260930-000203/pilotkit-aws-t4-1m.html) | [pilotkit-aws-t4-1m.webm](diagrams/architecture-pilotkit-aws-t4-1m-20260930-000203/pilotkit-aws-t4-1m.webm) |
| **When to move up (workflow)** | CloudWatch alarm → next tier, with the code changes to ship first | [pilotkit-aws-scaling.html](diagrams/workflow-pilotkit-aws-scaling-20260930-000203/pilotkit-aws-scaling.html) | [pilotkit-aws-scaling.webm](diagrams/workflow-pilotkit-aws-scaling-20260930-000203/pilotkit-aws-scaling.webm) |
| **One chat turn at T4 (sequence)** | edge → api → ElastiCache → LiteLLM Proxy → Jev / gpt-4o-mini → Aurora | [pilotkit-aws-chat-turn.html](diagrams/sequence-pilotkit-aws-chat-turn-20260930-000203/pilotkit-aws-chat-turn.html) | [pilotkit-aws-chat-turn.webm](diagrams/sequence-pilotkit-aws-chat-turn-20260930-000203/pilotkit-aws-chat-turn.webm) |

## How these were made
- Each folder holds three things:
  - `candidate.json`: the typed diagram spec.
  - The rendered `.html`.
  - Archify's delivery receipts (`*.finalize*.json`, `*.browser-check.json`): validation, a strict artifact check and a real-browser check, all passing. `review-2/` and `review-3/` hold the architecture's layout-review rounds.
- **Source evidence:** every node cites repository-relative file and line ranges, verified against the blobs at commit `52b68ba`.
- **Placeholder origin:** the repo has no git remote, so the specs use a placeholder origin, `https://localhost/pilotkit/persistance_dev.git`, with `link_mode: local-only`. That address is only a repository identity; it isn't a real remote, and the diagrams make no web links.
- **Recordings:** each WebM comes from the diagram viewer's own **Export → WebM** (MediaRecorder at 30 fps, VP9), driven headlessly.
- **Regenerating:** change a `candidate.json` and run `node <archify>/bin/archify.mjs finalize <type> <candidate.json> <out.html> --repo-root <repo> --quality showcase`.
