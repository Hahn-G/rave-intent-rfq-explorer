import { z } from 'zod';
import { fetchJson, type Fetcher } from './http';
import { QuoteError } from '@/lib/errors';
const schema = z.array(z.object({ chainId: z.string(), name: z.string(), chainType: z.string() }));
export class LiFiClient {
  constructor(private fetcher: Fetcher = fetch) {}
  async supportedChains() {
    const raw = await fetchJson('https://order.li.fi/chains/supported', {}, this.fetcher);
    const result = schema.safeParse(raw);
    if (!result.success)
      throw new QuoteError(
        'INVALID_RESPONSE',
        'LI.FI returned an unexpected supported-chain response.',
        502,
      );
    // `id` is an internal LI.FI record ID. Use `chainId` for EVM chain matching.
    return {
      chains: result.data,
      fetchedAt: new Date().toISOString(),
      endpoint: 'https://order.li.fi/chains/supported',
    };
  }
}
