# Demo and verification

## Screenshots

Captured from the locally running production build on September 29, 2026. The live quote is a real unauthenticated Bebop response (public demo pricing), not a fabricated quote. Its expiry and prices are historical by the time you view the screenshot; request a fresh quote to inspect current data.

- [Workspace](screenshots/01-workspace.png)
- [Live Base RFQ with execution details](screenshots/02-live-base.png)
- [Explicit mock mode and LI.FI chain lookup](screenshots/03-mock-demo.png)
- [Unsupported cross-chain route](screenshots/04-route-error.png)
- [Mobile layout](screenshots/05-mobile.png)

## One-minute walkthrough

1. Start the app and keep Base → Base, WETH → USDC, amount `0.1` and the public example address.
2. Select **Live API** and request a quote. Point out the **Public demo** label: the request is real, but unauthenticated Bebop pricing is widened.
3. Inspect buy amount, effective price, expiry, approval target, settlement address, transaction target/value and calldata presence.
4. Open **Normalized request** to show base-unit amount and checksum addresses; open **Raw response** to inspect returned transaction data.
5. Click **Check supported chains** to call the actual LI.FI Intents endpoint.
6. Change the destination chain to Ethereum to show route rejection.
7. Switch back to a same-chain route and explicitly select **Mock demo** to demonstrate the offline review path. It contains no executable transaction data.

Quotes can expire in seconds. No signing, approval or transaction execution is offered.

## Verification performed

- 45 Vitest tests passed with mocked network responses.
- TypeScript validation and `next build --webpack` passed.
- Real Bebop quotes were retrieved on Ethereum and Base, first through direct HTTP and then through the app API and browser.
- Real LI.FI `/chains/supported` lookup succeeded in the app.
- Browser checks verified normalized base units, raw `SIG_SUCCESS`, explicit mock mode, cross-chain rejection and no horizontal overflow at 390 px.
- Browser reported no page JavaScript errors in that walkthrough.
- Desktop and mobile screenshots were visually inspected.

Webpack is selected explicitly for reproducible local builds because this development environment restricted the helper port used by Turbopack's CSS compiler.

## Not verified / not performed

- No authenticated Bebop API key was available; public demo responses were tested.
- No wallet, transaction simulation, approval, signing, broadcasting, or settlement was performed.
- Docker was not installed, so the supplied container configuration has not been run locally.
- No hosted deployment has been created. The repository includes Vercel deployment instructions for the author's account.
