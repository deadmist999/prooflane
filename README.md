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

`GET /health` reports whether PayPal sandbox credentials are configured. The core release policy is fully testable without credentials. Real sandbox order creation requires `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.

See `docs/scenario.md`, `docs/adr/0001-evidence-gated-capture.md`, and `docs/tech-stack.md` for the product flow and decisions.
