# Tech stack

- Node.js 20+ with built-in HTTP, test runner, and `fetch`
- PayPal REST APIs: OAuth 2.0, Orders v2, Payments v2
- Pluggable structured AI verifier; deterministic demo mode for local testing
- In-memory persistence for the hackathon MVP
- Same-origin browser demo built with native HTML, CSS, and JavaScript

The dependency-free core keeps the demo easy to audit and run. The browser client is served directly by Node after the payment state machine was proven against PayPal Sandbox. Durable storage remains a subsequent milestone.
