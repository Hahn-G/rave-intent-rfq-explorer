import { z } from 'zod';
import { isAddress } from 'viem';
import type { QuoteRequest } from '@/adapters/lifi-intent';
import { QuoteError } from '@/lib/errors';
import { fetchJson, type Fetcher } from './http';

const addr = z.string().refine((v) => isAddress(v, { strict: false }));
const uint = z.string().max(78).regex(/^\d+$/);
const token = z
  .object({ amount: uint, decimals: z.number().int().min(0).max(36), symbol: z.string() })
  .passthrough();
export const responseSchema = z
  .object({
    quoteId: z.string(),
    status: z.string(),
    chainId: z.number().int(),
    taker: addr,
    receiver: addr,
    expiry: z.number().int().positive().max(8_640_000_000_000),
    sellTokens: z.record(z.string(), token),
    buyTokens: z.record(z.string(), token),
    approvalTarget: addr.nullish(),
    settlementAddress: addr.nullish(),
    tx: z
      .object({
        to: addr.nullish(),
        from: addr.nullish(),
        chainId: z.number().int().optional(),
        value: z
          .string()
          .regex(/^(0x[0-9a-fA-F]+|\d+)$/)
          .nullish(),
        data: z
          .string()
          .regex(/^0x([0-9a-fA-F]{2})*$/)
          .nullish(),
      })
      .passthrough()
      .nullish(),
    warnings: z.array(z.object({ code: z.number(), message: z.string() }).passthrough()).optional(),
    info: z.string().nullish(),
  })
  .passthrough();
export type BebopResponse = z.infer<typeof responseSchema>;

export function parseBebopResponse(raw: unknown, request: QuoteRequest): BebopResponse {
  if (raw && typeof raw === 'object' && 'error' in raw) {
    const error = z
      .object({ error: z.object({ errorCode: z.number().optional(), message: z.string() }) })
      .safeParse(raw);
    const message = error.success
      ? error.data.error.message.slice(0, 400)
      : 'Bebop could not quote this route.';
    if (/rate|too many/i.test(message)) throw new QuoteError('RATE_LIMITED', message, 429, 30);
    throw new QuoteError('NO_QUOTE', message, 422);
  }
  const parsed = responseSchema.safeParse(raw);
  if (!parsed.success)
    throw new QuoteError(
      'INVALID_RESPONSE',
      'Bebop returned an incomplete or malformed quote.',
      502,
    );
  const q = parsed.data;
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const sell = Object.entries(q.sellTokens),
    buy = Object.entries(q.buyTokens);
  if (
    q.chainId !== request.chain.id ||
    !same(q.taker, request.taker) ||
    !same(q.receiver, request.receiver) ||
    sell.length !== 1 ||
    buy.length !== 1 ||
    !same(sell[0][0], request.sellToken.address) ||
    !same(buy[0][0], request.buyToken.address) ||
    sell[0][1].decimals !== request.sellToken.decimals ||
    buy[0][1].decimals !== request.buyToken.decimals ||
    BigInt(sell[0][1].amount) !== BigInt(request.sellAmount) ||
    BigInt(buy[0][1].amount) <= 0n ||
    (q.tx?.chainId !== undefined && q.tx.chainId !== request.chain.id) ||
    (q.tx?.from && !same(q.tx.from, request.taker))
  ) {
    throw new QuoteError(
      'INVALID_RESPONSE',
      'The quote does not match the requested chain, tokens, amounts, or participant addresses.',
      502,
    );
  }
  return q;
}
export class BebopClient {
  constructor(
    private apiKey?: string,
    private fetcher: Fetcher = fetch,
  ) {}
  async quote(request: QuoteRequest): Promise<BebopResponse> {
    const query = new URLSearchParams({
      sell_tokens: request.sellToken.address,
      buy_tokens: request.buyToken.address,
      sell_amounts: request.sellAmount,
      taker_address: request.taker,
      receiver_address: request.receiver,
      approval_type: 'Standard',
    });
    const raw = await fetchJson(
      `https://api.bebop.xyz/pmm/${request.chain.slug}/v3/quote?${query}`,
      {
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
      },
      this.fetcher,
    );
    return parseBebopResponse(raw, request);
  }
}
