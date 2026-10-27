# Devpost submission copy

## Tagline

AI-verified milestone payments that release only when the work is proven.

## Inspiration

Freelance and AI-assisted work has a trust gap. Buyers do not want to release payment for an incomplete result, while workers do not want to finish a milestone without knowing funds are available. Existing workflows often reduce that decision to a chat message or a manual dispute.

Prooflane explores a narrower, auditable alternative: authorize a milestone first, evaluate concrete delivery evidence against explicit checks, and let deterministic policy decide whether capture is safe.

## What it does

Prooflane creates a milestone contract with a price and acceptance checks. It then creates a PayPal Sandbox order using `AUTHORIZE` intent, so approval does not immediately capture funds. After the order is approved and authorized, the worker submits delivery evidence.

An OpenAI-compatible structured verifier evaluates every acceptance check and returns a pass/fail result, reason, and confidence. The model does not control PayPal. Application code permits capture only when every check passed, confidence meets the configured threshold, the authorization belongs to the contract, and the milestone has not already been released. Ambiguous evidence stops for review.

The repository also includes an explicitly labelled deterministic verifier so the policy and UI can be tested locally without paid AI usage. It is a fallback, not presented as an AI result.

## How we built it

- Node.js HTTP server with no runtime dependencies
- PayPal OAuth 2.0, Orders v2 with `AUTHORIZE`, and Payments v2 authorization capture
- Pluggable OpenAI-compatible structured verifier
- Deterministic release state machine with duplicate-capture protection
- Same-origin HTML, CSS, and JavaScript demo console
- Node test suite covering AI response handling, PayPal API sequencing, unsafe release rejection, and successful single capture

## Challenges

The hard part was keeping probabilistic interpretation away from the irreversible payment action. Prooflane treats model output as evidence assessment only. A separate deterministic policy owns the capture decision and rejects missing authorization, failed checks, low confidence, and repeated release attempts.

PayPal's approval, authorization, and capture are separate lifecycle steps, so the UI also had to make the difference between reserved Sandbox funds and captured funds legible.

## Accomplishments

- Completed a real PayPal Sandbox order, approval, authorization, and capture for USD 1.00 in sandbox funds
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
- AI: OpenAI-compatible structured chat-completion interface; deterministic local fallback for no-key evaluation
- Node.js 20+
- Native browser HTML, CSS, and JavaScript

## Links

- Source and run instructions: https://github.com/deadmist999/prooflane
- Functional demo: run locally from the public repository
- Demo video: pending public YouTube upload

## Disclosure

The verified end-to-end payment record used real PayPal Sandbox APIs and sandbox funds. Its evidence assessment used the labelled deterministic fallback because no paid external AI key was configured. The external structured AI path is implemented and covered by automated tests.
