# Tech stack

- Node.js 20+ with built-in HTTP, test runner, and `fetch`
- PayPal REST APIs: OAuth 2.0, Orders v2, Payments v2
- Pluggable structured AI verifier; deterministic demo mode for local testing
- In-memory persistence for the hackathon MVP

The dependency-free core keeps the demo easy to audit and run. A browser client and durable database are subsequent milestones, after the payment state machine is proven.
