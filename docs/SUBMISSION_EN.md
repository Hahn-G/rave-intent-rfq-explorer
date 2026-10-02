# Take-home submission — Intent-to-RFQ Quote Explorer

**Subject:** Rave take-home submission — Intent-to-RFQ Quote Explorer

Hi Rave team,

I’m submitting my Intent-to-RFQ Quote Explorer. It accepts a simplified swap intent, normalizes it, requests a Bebop RFQ quote, and presents the pricing and returned execution fields in a read-only interface.

- **Repository:** https://github.com/Hahn-G/rave-intent-rfq-explorer
- **README and setup:** https://github.com/Hahn-G/rave-intent-rfq-explorer#readme
- **Live demo:** https://rave-intent-rfq-explorer.vercel.app/
- **Screenshot — live three-size quote comparison:** https://github.com/Hahn-G/rave-intent-rfq-explorer/blob/main/docs/screenshots/07-live-size-comparison.png
- **More screenshots and walkthrough:** https://github.com/Hahn-G/rave-intent-rfq-explorer/blob/main/docs/DEMO.md
- **AI usage notes:** https://github.com/Hahn-G/rave-intent-rfq-explorer/blob/main/AI_USAGE.md

The UI supports same-chain exact-input swaps on Ethereum and Base with a small, chain-specific WETH/USDC/USDT token list. Its input includes `fromChain`, `toChain`, `fromToken`, `toToken`, `amountIn`, `userAddress`, and `receiverAddress`. Invalid amounts, addresses, tokens, and unsupported routes receive explicit errors.

The LI.FI intent model describes the desired swap outcome without prescribing every execution step. This project implements only the simplified intent-to-quote boundary, not LI.FI order creation or settlement. `LiFiIntentAdapter` resolves chain-specific token addresses, converts the human-readable input to integer token base units, and checksums the taker and receiver addresses. `BebopClient` maps these values to the chain-specific `/pmm/{chain}/v3/quote` request. The app also calls LI.FI’s open `/chains/supported` endpoint for informational coverage.

The quote view shows the sell and buy amounts, effective price, expiry countdown, approval target, settlement address, transaction target and value, and whether calldata is present. It keeps the approval, settlement, and transaction addresses distinct. A three-size comparison displays the output and unit-price difference in basis points for separate RFQ requests. Expired quotes and rate limits are labeled; missing results are never fabricated.

The hosted Live API now uses a server-side Bebop API key. A fresh Base quote was verified as authenticated with `SIG_SUCCESS` and calldata present. Local copies without a key use public demo access; Bebop’s [authentication documentation](https://docs.bebop.xyz/core-concepts/authentication) states that unauthenticated RFQ quotes are widened, heavily rate-limited, and **not suitable for production use**. The separate local Mock mode is synthetic and has no executable transaction data. The screenshot predates key activation and is a historical capture of real public-demo responses; its quotes have expired. The tool does not connect a wallet, sign, approve, submit, or settle transactions.

Validation includes 47 passing unit tests with mocked API responses, TypeScript checking, a production build, and browser checks of live Bebop quotes on Ethereum and Base. Docker configuration is included, though Docker was unavailable in the development environment. I selected the web-app direction, reviewed the demo, and guided the trade-size comparison and public-demo disclosures. I used OpenAI Codex to assist with API research, implementation, tests, documentation, and verification; the [AI usage notes](https://github.com/Hahn-G/rave-intent-rfq-explorer/blob/main/AI_USAGE.md) provide the details.

Thank you for reviewing my submission.

Hahn-G
