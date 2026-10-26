# ADR 0001: gate PayPal capture with deterministic policy

Status: accepted

## Context

AI is useful for interpreting briefs and evidence, but it is not reliable enough to own payment state directly. PayPal authorization and capture are separate operations, which lets the product verify delivery before settling a milestone.

## Decision

The AI verifier produces a structured assessment. A separate deterministic policy decides whether capture is allowed. The PayPal adapter uses OAuth 2.0 server-side, creates Orders v2 orders with `AUTHORIZE`, authorizes an approved order, and captures an authorization only after policy approval.

The first version uses an in-memory store and a demo verifier. A production AI provider is injected behind the same interface. Secrets are read only from environment variables.

## Consequences

- The demo can be tested without spending money or touching live accounts.
- A real sandbox transaction requires one PayPal Developer account and sandbox credentials.
- The release decision is auditable and idempotent.
- Durable storage, webhook verification, seller onboarding, disputes, and live partner fees remain outside the MVP.
