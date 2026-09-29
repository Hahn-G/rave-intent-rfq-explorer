# Demo and verification

Live demo: [rave-intent-rfq-explorer.vercel.app](https://rave-intent-rfq-explorer.vercel.app/)

## Screenshots

Captured on September 29, 2026, from the local production build and deployed Vercel app. The live quotes are real unauthenticated Bebop responses (public demo pricing), not fabricated quotes. Their expiry and prices are historical by the time you view the screenshots; request fresh quotes to inspect current data.

- [Workspace](screenshots/01-workspace.png)
- [Live Base RFQ with execution details](screenshots/02-live-base.png)
- [Explicit mock mode and LI.FI chain lookup](screenshots/03-mock-demo.png)
- [Unsupported cross-chain route](screenshots/04-route-error.png)
- [Mobile layout](screenshots/05-mobile.png)
- [Three-size quote comparison (explicit synthetic mock)](screenshots/06-size-comparison.png)
- [Three-size comparison with real Bebop public demo responses](screenshots/07-live-size-comparison.png)

## One-minute walkthrough

1. Start the app and keep Base → Base, WETH → USDC, amount `0.1` and the public example address.
2. Select **Live API** and request a quote. Point out the **Public demo** label: the request is real, but unauthenticated Bebop pricing is widened.
3. Inspect buy amount, effective price, expiry, approval target, settlement address, transaction target/value and calldata presence.
4. Open **Normalized request** to show base-unit amount and checksum addresses; open **Raw response** to inspect returned transaction data.
5. Click **Compare 3 trade sizes** to capture `0.01 / 0.1 / 1` WETH quotes. Review output, unit price, basis-point difference, timestamp and expiry; click **Inspect** on any row. Live requests are sequential and may be limited by Bebop's public demo API.
6. Click **Check supported chains** to call the actual LI.FI Intents endpoint.
7. Change the destination chain to Ethereum to show route rejection.
8. Switch back to a same-chain route and explicitly select **Mock demo** to demonstrate the offline review path. It contains no executable transaction data. The synthetic comparison screenshot uses this mode so all three rows are reproducible; its prices are not market data.

Quotes can expire in seconds. No signing, approval or transaction execution is offered.

## Verification performed

- 47 Vitest tests passed with mocked network responses, including exact basis-point math and partial comparison results after rate limiting.
- TypeScript validation and `next build --webpack` passed.
- Real Bebop quotes were retrieved on Ethereum and Base, first through direct HTTP and then through the app API and browser.
- Real LI.FI `/chains/supported` lookup succeeded in the app.
- Browser checks verified normalized base units, raw `SIG_SUCCESS`, explicit mock mode, cross-chain rejection and no horizontal overflow at 390 px.
- Browser checks verified the three-row comparison, row inspection, synthetic labeling and a horizontally scrollable table at 390 px without page overflow.
- Browser reported no page JavaScript errors in that walkthrough.
- Desktop and mobile screenshots were visually inspected.
- Vercel production deployment was marked Ready and served the expected Next.js page.
- The production API returned HTTP 200 for a real Base WETH → USDC Bebop quote (`SIG_SUCCESS`, public demo access, calldata present), an LI.FI supported-chain lookup (Ethereum and Base listed), and a local mock quote (no calldata).
- The deployed comparison returned three real Base WETH → USDC public demo quotes for `0.01 / 0.1 / 1` WETH. The table calculated `+0.48` and `−0.28` bps versus the smallest quote and labeled the results expired shortly afterward.

Webpack is selected explicitly for reproducible local builds because this development environment restricted the helper port used by Turbopack's CSS compiler.

## Not verified / not performed

- No authenticated Bebop API key was available; public demo responses were tested.
- No wallet, transaction simulation, approval, signing, broadcasting, or settlement was performed.
- Docker was not installed, so the supplied container configuration has not been run locally.
