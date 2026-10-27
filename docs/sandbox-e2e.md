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

## Security

Sandbox client credentials and buyer credentials are not stored in the repository. They were loaded from the local operating-system credential store and passed to the process as environment variables.
