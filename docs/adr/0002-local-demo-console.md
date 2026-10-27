# ADR 0002: serve a dependency-free local demo console

Status: accepted

## Context

The payment state machine is proven against PayPal Sandbox, but an API-only walkthrough makes the product difficult to evaluate in a short hackathon review. The demo must remain easy to install and must not expose server credentials to the browser.

## Decision

The Node.js server will serve a small HTML, CSS, and JavaScript client from the same origin as the API. The client orchestrates existing endpoints and keeps only non-secret contract and payment identifiers in browser memory.

No framework or build step is added. PayPal OAuth stays exclusively in the server process. The interface opens the PayPal approval URL in a separate tab and requires the operator to confirm after approval.

## Consequences

- Judges get an end-to-end product flow at `http://127.0.0.1:3210`.
- Setup remains `npm start` with zero runtime dependencies.
- The prototype still uses in-memory state and is not a production escrow service.
- A hosted deployment remains optional and is not required for the functional demo.
