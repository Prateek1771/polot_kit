# PilotKit docs

Four diagrams of how PilotKit works, generated with [Archify](https://github.com/tt-a1i/archify) from the code at commit `0901a98`. Each one is a standalone HTML page you can pan, zoom and search. Each also has a 6-second **WebM recording** of its trace animation, which shows requests travelling along the arrows.

| Diagram | What it shows | Open | Recording |
|---|---|---|---|
| **System architecture** | Browser → Next.js → FastAPI → LangGraph bot → Jev, LiteLLM → gpt-4o-mini, Postgres, Redis/arq worker, Langfuse | [pilotkit-system.html](diagrams/architecture-pilotkit-system-20260929-222149/pilotkit-system.html) | [pilotkit-system.webm](diagrams/architecture-pilotkit-system-20260929-222149/pilotkit-system.webm) |
| **One chat turn** (sequence) | `POST /chat` → `chat_turn()` → Jev router (5 questions) → one branch (identify / claim + tool gate / shop) → streamed reply over SSE | [pilotkit-chat-turn.html](diagrams/sequence-pilotkit-chat-turn-20260929-222149/pilotkit-chat-turn.html) | [pilotkit-chat-turn.webm](diagrams/sequence-pilotkit-chat-turn-20260929-222149/pilotkit-chat-turn.webm) |
| **Test Lab suite run** (workflow) | Start run → arq job → simulated user ↔ bot ↔ Jev `next_move` loop → Jev rubric → triage → report, with uncertain verdicts sent to the human review queue | [pilotkit-test-lab.html](diagrams/workflow-pilotkit-test-lab-20260929-222149/pilotkit-test-lab.html) | [pilotkit-test-lab.webm](diagrams/workflow-pilotkit-test-lab-20260929-222149/pilotkit-test-lab.webm) |
| **Conversation lifecycle** | `open → judging → judged` (plus `error`), with the identity (full-name lookup) and claim-confirmation memory flows | [pilotkit-conversation.html](diagrams/lifecycle-pilotkit-conversation-20260929-222149/pilotkit-conversation.html) | [pilotkit-conversation.webm](diagrams/lifecycle-pilotkit-conversation-20260929-222149/pilotkit-conversation.webm) |

Open an `.html` file straight in a browser; there's no server and no network. Viewer tips:
- **Live / Still** toggles the trace animation.
- **PATH** finds the route between two nodes.
- **LENS** highlights one kind of node.
- **Export** downloads a PNG, SVG or WebM.
- The `SRC` badges show the exact source file and lines each node describes.

## How these were made
- Each folder holds three things:
  - `candidate.json`: the typed diagram spec.
  - The rendered `.html`.
  - Archify's delivery receipts (`*.finalize*.json`, `*.browser-check.json`): validation, a strict artifact check and a real-browser check, all passing. `review-2/` and `review-3/` hold the architecture's layout-review rounds.
- **Source evidence:** every node cites repository-relative file and line ranges, verified against the blobs at commit `0901a98`.
- **Placeholder origin:** the repo has no git remote, so the specs use a placeholder origin, `https://localhost/pilotkit/persistance_dev.git`, with `link_mode: local-only`. That address is only a repository identity; it isn't a real remote, and the diagrams make no web links.
- **Recordings:** each WebM comes from the diagram viewer's own **Export → WebM** (MediaRecorder at 30 fps, VP9), driven headlessly.
- **Regenerating:** change a `candidate.json` and run `node <archify>/bin/archify.mjs finalize <type> <candidate.json> <out.html> --repo-root <repo> --quality showcase`.
