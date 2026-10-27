# Prooflane

Evidence-gated milestone payments for AI-assisted work. Prooflane turns acceptance checks and submitted evidence into an auditable assessment, then captures a PayPal authorization only when deterministic release policy passes.

This is an early hackathon MVP. It uses PayPal's sandbox only and never spends real money.

## Run

```bash
cp .env.example .env
set -a && source .env && set +a
npm test
npm start
```

Open `http://127.0.0.1:3210` for the guided browser console.

`GET /health` reports whether PayPal sandbox credentials are configured. The core release policy is fully testable without credentials. Real sandbox order creation requires `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.

When `AI_API_KEY` and `AI_MODEL` are set, evidence is evaluated by a structured OpenAI-compatible model call. Without them, the app enters an explicitly labeled deterministic demo mode; it does not represent that heuristic output as an AI decision.

See `docs/scenario.md`, `docs/scenario-demo-console.md`, `docs/adr/0001-evidence-gated-capture.md`, `docs/adr/0002-local-demo-console.md`, and `docs/tech-stack.md` for the product flow and decisions.

The PayPal integration has also completed a real end-to-end Sandbox authorization and capture. See [`docs/sandbox-e2e.md`](docs/sandbox-e2e.md) for the non-secret verification record.

## API flow

1. `POST /contracts` with `title`, numeric `amount`, and `acceptanceChecks`.
2. `POST /contracts/:id/order` and open the returned PayPal sandbox approval URL.
3. `POST /contracts/:id/authorize` with the approved `orderId`.
4. `POST /contracts/:id/evidence` with a concrete evidence description.
5. `POST /contracts/:id/release`; policy rejects unsafe capture attempts with HTTP 409.
