# AI usage notes

This project was developed with OpenAI Codex assistance. The author supplied the assignment and repository, reviewed the proposed scope, and selected a Next.js/TypeScript web app.

## AI-assisted work

- Interpreting the assignment and separating same-chain RFQ from a full cross-chain intent lifecycle.
- Reading current LI.FI and Bebop documentation and checking public endpoints.
- Implementing the adapter, clients, validation, API routes, UI, styles, tests and documentation.
- Running automated checks and investigating failures.

## Evidence and boundaries

- Real read-only requests were made to Bebop on Ethereum and Base, and to LI.FI `/chains/supported` during development. Successful RFQ responses contained `SIG_SUCCESS` and transaction data.
- The first Base request exposed Bebop's checksum requirement; the implementation normalizes all outgoing EVM addresses.
- Current Bebop docs distinguish unauthenticated public demo pricing from authenticated access. The UI and README preserve that distinction.
- Automated tests use local fixtures / mocked network responses. Passing tests does not prove live liquidity or on-chain execution.
- Mock mode is visibly labeled, does not replace API errors, and produces no usable transaction data.
- No private key was requested or used. No transaction, approval, order submission, signing or settlement was performed.

The author should review and understand the implementation before submission. AI assistance is disclosed rather than presenting generated work as independently hand-authored. Actual final checks and demo instructions are recorded in `docs/DEMO.md`.
