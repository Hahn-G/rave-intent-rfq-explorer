# Deploy to Vercel

The production site is live at [rave-intent-rfq-explorer.vercel.app](https://rave-intent-rfq-explorer.vercel.app/). The steps below reproduce the deployment or set up another Vercel account.

1. Import `Hahn-G/rave-intent-rfq-explorer` into your Vercel account.
2. Select the Next.js framework preset; use the repository root.
3. Use Node.js 22 or newer. Vercel should detect pnpm from the lockfile.
4. Build command: `pnpm build`. Keep the default Next.js output settings.
5. For authenticated RFQ pricing, [request an API key from Bebop](https://docs.bebop.xyz/core-concepts/authentication) via the [Integrators form](https://survey.typeform.com/to/tmPax8Fu?utm_source=docs_support). Bebop provisions the key and sends it directly to the applicant. Until then, real requests use Bebop public demo mode.
6. In Vercel, open **Project → Settings → Environment Variables** and add `BEBOP_API_KEY` with the issued key as a **server-side secret** for Production (and Preview/Development only if needed). Do not prefix it with `NEXT_PUBLIC_` or commit it to Git. Redeploy after adding the variable so the running deployment receives it.
7. Test a real Base quote and confirm the UI labels its access as authenticated. Then test the LI.FI supported-chain lookup, Mock demo, and a cross-chain error. If the authenticated request fails, check the key and Bebop response; do not silently substitute a mock quote.
8. Include the deployed URL in your submission and README after deployment succeeds.

Do not upload `.env.local`, private keys or credentials to GitHub. If enabling authenticated quota on a public deployment, configure platform abuse protection. A local build alone does not create an online demo URL.
