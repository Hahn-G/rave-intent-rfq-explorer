import { formatUnits } from 'viem';
import { LiFiIntentAdapter, type QuoteRequest } from '@/adapters/lifi-intent';
import { BebopClient, type BebopResponse } from '@/clients/bebop';

export type QuoteMode = 'live' | 'mock';
export function effectivePrice(
  sell: bigint,
  sellDecimals: number,
  buy: bigint,
  buyDecimals: number,
) {
  // Truncate to 12 decimal places using integers. Never convert token amounts to Number.
  return formatUnits(
    (buy * 10n ** BigInt(sellDecimals + 12)) / (sell * 10n ** BigInt(buyDecimals)),
    12,
  );
}
export function mockQuote(r: QuoteRequest): BebopResponse {
  // Fixed educational prices; no live market data and no usable calldata.
  const prices: Record<string, bigint> = { WETH: 2700n, USDC: 1n, USDT: 1n };
  const buy =
    (BigInt(r.sellAmount) *
      prices[r.sellToken.symbol] *
      10n ** BigInt(r.buyToken.decimals) *
      997n) /
    (prices[r.buyToken.symbol] * 10n ** BigInt(r.sellToken.decimals) * 1000n);
  return {
    quoteId: 'mock-not-executable',
    status: 'MOCK',
    chainId: r.chain.id,
    taker: r.taker,
    receiver: r.receiver,
    expiry: Math.floor(Date.now() / 1000) + 60,
    sellTokens: {
      [r.sellToken.address]: {
        amount: r.sellAmount,
        decimals: r.sellToken.decimals,
        symbol: r.sellToken.symbol,
      },
    },
    buyTokens: {
      [r.buyToken.address]: {
        amount: buy.toString(),
        decimals: r.buyToken.decimals,
        symbol: r.buyToken.symbol,
      },
    },
    approvalTarget: null,
    settlementAddress: null,
    tx: null,
    info: 'Synthetic fixture: fixed prices and a 0.3% illustrative spread. Not market data or an executable quote.',
  };
}
export function normalizeQuote(
  r: QuoteRequest,
  raw: BebopResponse,
  mode: QuoteMode,
  authenticated: boolean,
) {
  const sell = Object.values(raw.sellTokens)[0],
    buy = Object.values(raw.buyTokens)[0];
  const hasCalldata = !!raw.tx?.data && raw.tx.data !== '0x';
  const expired = raw.expiry * 1000 <= Date.now();
  const executionDataComplete = Boolean(
    hasCalldata &&
    raw.tx?.to &&
    raw.tx?.value != null &&
    raw.approvalTarget &&
    raw.settlementAddress,
  );
  return {
    mode,
    access: mode === 'mock' ? 'local-fixture' : authenticated ? 'authenticated' : 'public-demo',
    request: r,
    quoteId: raw.quoteId,
    status: raw.status,
    fetchedAt: new Date().toISOString(),
    sell: {
      ...r.sellToken,
      amount: sell.amount,
      formatted: formatUnits(BigInt(sell.amount), sell.decimals),
    },
    buy: {
      ...r.buyToken,
      amount: buy.amount,
      formatted: formatUnits(BigInt(buy.amount), buy.decimals),
    },
    effectivePrice: effectivePrice(
      BigInt(sell.amount),
      sell.decimals,
      BigInt(buy.amount),
      buy.decimals,
    ),
    expiry: raw.expiry,
    expired,
    approvalTarget: raw.approvalTarget ?? null,
    settlementAddress: raw.settlementAddress ?? null,
    transaction: {
      target: raw.tx?.to ?? null,
      value: raw.tx?.value ?? null,
      valueEth: raw.tx?.value != null ? formatUnits(BigInt(raw.tx.value), 18) : null,
      hasCalldata,
    },
    executionDataComplete,
    analysis: [
      mode === 'mock'
        ? 'Local fixture only. No executable transaction is generated.'
        : authenticated
          ? 'Authenticated RFQ response. Execution still requires independent verification.'
          : 'Live API response in Bebop public demo mode; widened pricing and strict rate limits apply.',
      `Exact-input ${r.sellToken.symbol} → ${r.buyToken.symbol} on ${r.chain.name}. Effective price excludes network gas costs.`,
      executionDataComplete
        ? 'Execution fields are present. This app does not simulate, sign, approve, or submit transactions.'
        : 'Execution fields are incomplete or absent. Do not treat this response as ready for execution.',
      ...(raw.status !== 'SIG_SUCCESS' && mode === 'live'
        ? [`Upstream status is ${raw.status}; a firm signed quote is not confirmed.`]
        : []),
      ...(raw.info ? [raw.info] : []),
      ...(raw.warnings ?? []).map((w) => w.message),
    ],
    raw,
  };
}
export type QuoteResult = ReturnType<typeof normalizeQuote>;
export async function getQuote(input: unknown, mode: QuoteMode, apiKey?: string) {
  const request = new LiFiIntentAdapter().normalize(input);
  const raw = mode === 'mock' ? mockQuote(request) : await new BebopClient(apiKey).quote(request);
  return normalizeQuote(request, raw, mode, Boolean(apiKey));
}
