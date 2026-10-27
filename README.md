# Prooflane

[![CI](https://github.com/deadmist999/prooflane/actions/workflows/ci.yml/badge.svg)](https://github.com/deadmist999/prooflane/actions/workflows/ci.yml)

Evidence-gated milestone payments for AI-assisted work. Prooflane turns acceptance checks and submitted evidence into an auditable assessment, then captures a PayPal authorization only when deterministic release policy passes.

This is an early hackathon MVP. It uses PayPal's sandbox only and never spends real money.

## Run

Requirements: Node.js 20+ and a free PayPal Developer Sandbox app.

1. In the PayPal Developer Dashboard, create a Sandbox app and copy its client ID and secret.
2. Create or select a personal Sandbox test account for approving orders.
3. Configure the local environment:

```bash
cp .env.example .env
# Add the Sandbox client ID and secret to .env.
set -a && source .env && set +a
npm test
npm start
```

Open `http://127.0.0.1:3210` for the guided browser console.

The full demo is: create contract → create PayPal order → approve it with the personal Sandbox account → authorize → submit evidence → capture. All PayPal activity stays in Sandbox and moves no real money.

`GET /health` reports whether PayPal sandbox credentials are configured. The core release policy is fully testable without credentials. Real sandbox order creation requires `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.

### AI verifier

Evidence is assessed by any OpenAI-compatible chat model with structured JSON output. Whatever the model returns is normalized and checked against the contract's acceptance checks; a check the model skipped or answered vaguely fails closed.

Free and local, with [Ollama](https://ollama.com):

```bash
ollama pull qwen2.5:7b-instruct
AI_BASE_URL=http://localhost:11434/v1 AI_MODEL=qwen2.5:7b-instruct npm start
```

A hosted model works the same way (`AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`), for example OpenAI, Groq or Gemini's OpenAI-compatible endpoint. Without a model the app runs in an explicitly labelled deterministic demo mode and never presents that heuristic as an AI decision.

### Milestone ledger (AG Grid)

Below the workflow, an [AG Grid Community](https://www.ag-grid.com/) ledger lists every contract with its status, passed checks, verifier confidence, model and PayPal order and capture IDs, sortable and filterable, so a buyer can audit why each payment was or wasn't released.

### MCP server for AI agents (agentic commerce)

`src/mcp.js` exposes Prooflane to any MCP client (Claude Desktop, Claude Code, Cursor, …) over stdio, so an agent can hire work and pay for it only against proof:

`create_milestone` → `reserve_payment` (buyer approves in PayPal) → `confirm_authorization` → `submit_evidence` → `release_payment`, plus `list_milestones`.

```json
{
  "mcpServers": {
    "prooflane": { "command": "node", "args": ["/path/to/prooflane/src/mcp.js"], "env": { "PROOFLANE_URL": "http://127.0.0.1:3210" } }
  }
}
```

The release policy stays on the server: an agent cannot capture a payment that the buyer has not authorized or that the evidence does not support.

### Deploy

`render.yaml` deploys the console to Render's free tier. Set the PayPal Sandbox credentials and an AI endpoint as environment variables.

See `docs/scenario.md`, `docs/scenario-demo-console.md`, `docs/adr/0001-evidence-gated-capture.md`, `docs/adr/0002-local-demo-console.md`, and `docs/tech-stack.md` for the product flow and decisions.

Submission-ready copy and the sub-three-minute recording plan live in `docs/devpost-submission.md` and `docs/demo-video-script.md`.

The PayPal integration has also completed a real end-to-end Sandbox authorization and capture. See [`docs/sandbox-e2e.md`](docs/sandbox-e2e.md) for the non-secret verification record.

## API flow

1. `POST /contracts` with `title`, numeric `amount`, and `acceptanceChecks`.
2. `POST /contracts/:id/order` and open the returned PayPal sandbox approval URL.
3. `POST /contracts/:id/authorize` with the approved `orderId`.
4. `POST /contracts/:id/evidence` with a concrete evidence description.
5. `POST /contracts/:id/release`; policy rejects unsafe capture attempts with HTTP 409.
