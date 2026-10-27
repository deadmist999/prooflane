# Scenario: judge runs the full payment lifecycle

## Goal

A judge should be able to run Prooflane locally and understand the product without constructing API requests by hand.

## Flow

1. The judge enters a milestone title, amount, currency, and acceptance checks.
2. Prooflane creates the contract and a PayPal Sandbox order with `AUTHORIZE` intent.
3. The judge opens PayPal Sandbox approval in a separate tab and approves with a personal sandbox account.
4. Back in Prooflane, the judge authorizes the approved order.
5. The judge submits concrete delivery evidence.
6. Prooflane shows the verifier result and deterministic release decision.
7. If every gate passes, the judge captures the sandbox authorization.

## Safety expectations

- The interface always labels Sandbox and demo-verifier output.
- Capture cannot be requested before authorization and successful verification.
- The browser never receives PayPal client credentials.
- Every step displays the resulting state and identifiers for an auditable demo.
