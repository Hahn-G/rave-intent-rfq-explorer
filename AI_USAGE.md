# AI usage notes

The author initiated this project with the assignment and repository, chose the Next.js/TypeScript web-app direction, reviewed the demo, and guided improvements to the quote comparison and public-demo disclosures. OpenAI Codex supported the implementation and verification work described below.

## Author direction and review

- Selected the web-app approach and kept the scope focused on same-chain, read-only RFQ inspection.
- Reviewed the demo behavior and requested a three-size quote comparison rather than presets alone.
- Asked for clearer treatment of token precision, quote expiry, unauthenticated pricing, and submission materials.

## AI-assisted work

- Interpreting the assignment and separating same-chain RFQ from a full cross-chain intent lifecycle.
- Reading current LI.FI and Bebop documentation and checking public endpoints.
- Implementing the adapter, clients, validation, API routes, UI, styles, tests and documentation.
- Adding and checking the three-size comparison, exact integer basis-point calculations, rate-limit handling and a labeled synthetic-demo screenshot.
- Running automated checks and investigating failures.

## Evidence and boundaries

- Real read-only requests were made to Bebop on Ethereum and Base, and to LI.FI `/chains/supported` during development. Successful RFQ responses contained `SIG_SUCCESS` and transaction data.
- After deployment, the public Vercel site and its live RFQ, LI.FI and mock API paths were checked independently; the production RFQ returned `SIG_SUCCESS` and calldata in Bebop public demo mode.
- The deployed comparison was exercised against three real Bebop public demo responses, and a historical screenshot was saved with visible expiry labels. The displayed basis-point differences are observations across sequential requests, not a slippage claim.
- After the author obtained a Bebop API key, the author entered it directly into Vercel as a Production Secret. A new production deployment was verified with a live authenticated Base quote (`SIG_SUCCESS` and calldata present). The key was not handled by Codex or committed to Git.
- The first Base request exposed Bebop's checksum requirement; the implementation normalizes all outgoing EVM addresses.
- Current Bebop docs distinguish unauthenticated public demo pricing from authenticated access. The UI and README preserve that distinction.
- Automated tests use local fixtures / mocked network responses. Passing tests does not prove live liquidity or on-chain execution.
- Mock mode is visibly labeled, does not replace API errors, and produces no usable transaction data.
- No private key was requested or used. No transaction, approval, order submission, signing or settlement was performed.

The author remains responsible for the final submission. This note records both the author's direction and the AI-assisted work; actual checks and demo instructions are recorded in `docs/DEMO.md`.
