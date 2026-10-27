# Devpost submission copy

## Tagline

AI-verified milestone payments that release only when the work is proven.

## Inspiration

Freelance and AI-assisted work has a trust gap. Buyers do not want to release payment for an incomplete result, while workers do not want to finish a milestone without knowing funds are available. Existing workflows often reduce that decision to a chat message or a manual dispute.

Prooflane explores a narrower, auditable alternative: authorize a milestone first, evaluate concrete delivery evidence against explicit checks, and let deterministic policy decide whether capture is safe.

## What it does

Prooflane creates a milestone contract with a price and acceptance checks. It then creates a PayPal Sandbox order using `AUTHORIZE` intent, so approval does not immediately capture funds. After the order is approved and authorized, the worker submits delivery evidence.

An OpenAI-compatible structured verifier evaluates every acceptance check and returns a pass/fail result, reason, and confidence. The model does not control PayPal. Application code permits capture only when every check passed, confidence meets the configured threshold, the authorization belongs to the contract, and the milestone has not already been released. Ambiguous evidence stops for review.

Every assessment lands in a milestone ledger built with AG Grid, and the same flow is available to AI agents through an MCP server: an agent can create a milestone, reserve payment through PayPal, submit proof and get paid only when the proof holds up. That makes Prooflane a trust layer for agentic commerce, where neither side has to trust the other's word.

## How we built it

- Node.js HTTP server with no runtime dependencies
- PayPal OAuth 2.0, Orders v2 with `AUTHORIZE`, and Payments v2 authorization capture
- Pluggable OpenAI-compatible structured verifier (demo: `qwen2.5:7b-instruct` running locally through Ollama), with output normalization that fails closed
- AG Grid Community milestone ledger
- MCP server (stdio JSON-RPC, no dependencies) exposing the payment flow to AI agents
- Deterministic release state machine with duplicate-capture protection
- Same-origin HTML, CSS, and JavaScript demo console
- Node test suite covering AI response handling, PayPal API sequencing, unsafe release rejection, and successful single capture

## Challenges

The hard part was keeping probabilistic interpretation away from the irreversible payment action. Prooflane treats model output as evidence assessment only. A separate deterministic policy owns the capture decision and rejects missing authorization, failed checks, low confidence, and repeated release attempts.

PayPal's approval, authorization, and capture are separate lifecycle steps, so the UI also had to make the difference between reserved Sandbox funds and captured funds legible.

## Accomplishments

- Completed real PayPal Sandbox order → approval → authorization → AI verification → capture runs, both from the web console and from an AI agent through MCP
- The AI rejected a vague "trust me" claim (20% confidence, every check failed with reasons) and approved concrete evidence (100%, every check passed)
- Preserved non-secret order, authorization, and capture identifiers in the public verification record
- Built a coherent guided console instead of requiring judges to assemble API calls
- Kept all PayPal credentials server-side and out of the repository
- Made uncertain evidence fail closed

## What we learned

The useful boundary is not “AI decides whether to pay.” It is “AI turns messy evidence into a structured assessment, while code enforces money invariants.” PayPal's authorize-then-capture flow makes that separation concrete.

## What's next

The next version would add durable contracts, signed evidence artifacts, human review queues, webhook reconciliation, authorization-expiry handling, and PayPal partner capabilities for a compliant platform-fee model. Before live use, Prooflane would also need legal review; this prototype is not an escrow service.

## Tools and APIs

- PayPal Developer Platform: Sandbox OAuth, Orders v2, Payments v2
- AI: OpenAI-compatible structured chat completions; Qwen 2.5 7B Instruct through Ollama in the demo
- AG Grid Community: milestone ledger
- Model Context Protocol: agent-facing server
- Node.js 20+
- Native browser HTML, CSS, and JavaScript

## Links

- Source and run instructions: https://github.com/deadmist999/prooflane
- Functional demo: run locally from the public repository
- Demo video: YOUTUBE_URL

## Disclosure

All payments in the demo are PayPal Sandbox transactions with sandbox funds. The AI assessments in the video come from a real model call (Qwen 2.5 7B Instruct, local). Identifiers of the verified runs are in `docs/sandbox-e2e.md`.
