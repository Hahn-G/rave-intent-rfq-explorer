# Deploy to Vercel

The production site is live at [rave-intent-rfq-explorer.vercel.app](https://rave-intent-rfq-explorer.vercel.app/). The steps below reproduce the deployment or set up another Vercel account.

1. Import `Hahn-G/rave-intent-rfq-explorer` into your Vercel account.
2. Select the Next.js framework preset; use the repository root.
3. Use Node.js 22 or newer. Vercel should detect pnpm from the lockfile.
4. Build command: `pnpm build`. Keep the default Next.js output settings.
5. Optionally add `BEBOP_API_KEY` as a **server-side** environment variable. Without it, real requests use Bebop public demo mode.
6. Deploy. Test a real Base quote and the LI.FI supported-chain lookup. Then test Mock demo and a cross-chain error.
7. Include the deployed URL in your submission and README after deployment succeeds.

Do not upload `.env.local`, private keys or credentials to GitHub. If enabling authenticated quota on a public deployment, configure platform abuse protection. A local build alone does not create an online demo URL.
