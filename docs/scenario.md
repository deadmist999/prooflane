# Scenario: evidence-gated freelance milestones

## Buyer

A buyer pastes a short, ambiguous brief and a total budget. Prooflane turns it into small milestones with explicit acceptance checks. The buyer approves a PayPal sandbox order with `AUTHORIZE` intent, so payment is authorized but not captured.

## Worker

The worker submits evidence for one milestone: a description plus URLs or machine-readable results. The verifier scores each acceptance check and returns reasons, missing evidence, confidence, and a release recommendation.

## Release policy

Prooflane may capture an authorized payment only when all of these are true:

1. every required acceptance check passed;
2. verifier confidence meets the configured threshold;
3. the authorization belongs to the same contract;
4. that milestone has not already been released.

Anything uncertain goes to review. A model response alone is never sufficient to release money: policy code enforces the invariants.

## Revenue

The commercial version charges a fee on released milestones. PayPal platform fees require partner approval, so the hackathon prototype demonstrates the payment lifecycle without pretending that live fee collection is already enabled.
