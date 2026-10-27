# Demo video script (target: 2 minutes 20 seconds)

## 0:00–0:15 — Problem

Show the Prooflane hero and say:

“AI-assisted work is fast, but payment still depends on trust and chat messages. Prooflane authorizes a milestone first and captures it only when delivery evidence passes explicit checks.”

## 0:15–0:35 — Contract

Show the default USD 1.00 milestone and its two acceptance checks. Create the contract.

“The buyer defines what done means before any payment decision. This demo uses PayPal Sandbox, so no real money moves.”

## 0:35–1:05 — PayPal authorization

Create the PayPal order and open the approval link. Approve it with the personal Sandbox buyer, return to Prooflane, and authorize the order.

“Prooflane uses Orders v2 with AUTHORIZE intent. Approval reserves sandbox funds; it does not capture them.”

## 1:05–1:30 — Evidence and AI boundary

Submit the prefilled evidence and show the per-check reasons and confidence.

“A structured verifier interprets messy evidence. For this no-cost recording, the interface clearly labels the deterministic demo verifier. The same contract is implemented for an OpenAI-compatible model.”

## 1:30–1:50 — Deterministic capture

Click capture and show the final `released` state plus the PayPal identifiers.

“The model never calls PayPal. Policy code requires authorization, every check passing, sufficient confidence, and no previous release. Only then can Payments v2 capture once.”

## 1:50–2:10 — Proof

Briefly show `docs/sandbox-e2e.md`, the test output, and the public repository.

“The repository includes a verified Sandbox capture record, complete local setup, and tests for the unsafe paths—not just the happy path.”

## 2:10–2:20 — Close

Return to the final UI state.

“Prooflane: work gets paid when the proof holds up.”

## Recording checklist

- Keep the finished video under three minutes.
- Record the app actually running, including PayPal Sandbox approval.
- Use no music or third-party footage.
- Hide credentials, browser autofill, bookmarks, notifications, and personal account details.
- Upload publicly to YouTube and add its URL to Devpost.
