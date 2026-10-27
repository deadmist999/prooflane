# PayPal sandbox E2E verification

Prooflane completed a real PayPal Sandbox authorization and capture on 2026-10-27. No live account or real money was used.

## Verified flow

1. Created a USD 1.00 order with `intent: AUTHORIZE`.
2. Approved the order with a PayPal personal sandbox account.
3. Authorized the approved order through Orders v2.
4. Submitted evidence covering every acceptance check.
5. Applied the deterministic release policy at a `0.90` confidence threshold.
6. Captured the PayPal authorization through Payments v2.

## Sandbox evidence

- Order: `6J631009L7771801V`
- Authorization: `2SX61346SS449925T`
- Capture: `8V20061458819602F`
- Final Prooflane state: `released`
- Amount: `USD 1.00` sandbox funds

The evidence assessment used the explicitly labelled deterministic demo verifier because no external AI key was configured. PayPal OAuth, order approval, authorization, and capture were real Sandbox API operations.

## AI-verified runs (2026-10-27, v0.2)

Both runs used a real local model (`qwen2.5:7b-instruct` through Ollama's OpenAI-compatible endpoint) and real PayPal Sandbox APIs.

**Web console, buyer approval in PayPal, rejected and then approved evidence.** This is the run recorded in the demo video.

- The evidence "Fixed it, should be good now. Trust me." got `needs_review`: confidence 20%, all three checks failed with reasons, and capture was blocked.
- The evidence citing a CI run, a reviewed PR and clean Sentry logs got `verified`: confidence 100%, 3/3 checks.
- Order: `86S613917A9478224`
- Authorization: `90X03893CX329325E`
- Capture: `9UY681130T941004N` (USD 120.00 sandbox funds)

**AI agent through the MCP server** (`src/mcp.js`):

- The agent called `create_milestone`, `reserve_payment` (the buyer approved in PayPal Sandbox), `confirm_authorization`, `submit_evidence` (`verified`, 2/2 checks, confidence 100%) and `release_payment`.
- Order: `5ME02277Y9888331C`
- Authorization: `2BN58956P8740641D`
- Capture: `9WC88878MH869213M` (USD 45.00 sandbox funds)

## Security

Sandbox client credentials and buyer credentials are not stored in the repository. They were loaded from the local operating-system credential store and passed to the process as environment variables.
