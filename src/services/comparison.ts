import type { SimplifiedIntent } from '@/adapters/lifi-intent';
import type { QuoteMode, QuoteResult } from '@/services/quote';

export type ComparisonError = { code: string; message: string; retryAfter?: number };
export type ComparisonRow =
  | { size: string; status: 'success'; quote: QuoteResult }
  | { size: string; status: 'error'; error: ComparisonError }
  | { size: string; status: 'skipped'; reason: string };

export function comparisonSizes(symbol: string): string[] {
  return symbol === 'WETH' ? ['0.01', '0.1', '1'] : ['10', '100', '1000'];
}

/** Signed change in effective output per sell token, in basis points with two decimal places. */
export function priceDeltaBps(current: QuoteResult, baseline: QuoteResult): string {
  if (
    current.request.chain.id !== baseline.request.chain.id ||
    current.sell.address.toLowerCase() !== baseline.sell.address.toLowerCase() ||
    current.buy.address.toLowerCase() !== baseline.buy.address.toLowerCase()
  ) {
    throw new Error('Only quotes for the same chain and token pair can be compared.');
  }
  const numerator =
    BigInt(current.buy.amount) * BigInt(baseline.sell.amount) -
    BigInt(baseline.buy.amount) * BigInt(current.sell.amount);
  const denominator = BigInt(baseline.buy.amount) * BigInt(current.sell.amount);
  if (denominator === 0n) throw new Error('A quote amount is zero.');
  const hundredthBps = (numerator * 1_000_000n) / denominator;
  const magnitude = hundredthBps < 0n ? -hundredthBps : hundredthBps;
  const sign = hundredthBps > 0n ? '+' : hundredthBps < 0n ? '−' : '';
  return `${sign}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, '0')}`;
}

export function comparisonSummary(rows: ComparisonRow[], now: number): string {
  const successes = rows.filter(
    (row): row is Extract<ComparisonRow, { status: 'success' }> => row.status === 'success',
  );
  if (successes.length < 2)
    return 'At least two successful quotes are needed to compare unit prices.';
  const first = successes[0],
    last = successes[successes.length - 1];
  const change = priceDeltaBps(last.quote, first.quote);
  const direction = change.startsWith('−')
    ? 'lower'
    : change.startsWith('+')
      ? 'higher'
      : 'the same';
  const amount = change.replace(/^[+−]/, '');
  const trend =
    direction === 'the same'
      ? 'The largest successful size has the same effective unit price as the smallest.'
      : `The largest successful size quoted ${amount} bps ${direction} per ${first.quote.sell.symbol} than the smallest.`;
  const caveat =
    first.quote.mode === 'mock'
      ? 'These are synthetic fixed-price examples, not market quotes.'
      : 'Quotes were requested sequentially. Market moves and expiry can affect the difference; it is not a measured price-impact estimate.';
  const expiry = successes.some((row) => row.quote.expiry * 1000 <= now)
    ? ' One or more quotes have expired; request a fresh comparison before acting.'
    : '';
  return `${trend} ${caveat}${expiry}`;
}

export async function compareTradeSizes(
  intent: SimplifiedIntent,
  mode: QuoteMode,
  sizes: string[],
  onProgress: (rows: ComparisonRow[]) => void,
  fetcher: typeof fetch = fetch,
  pause: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<ComparisonRow[]> {
  const rows: ComparisonRow[] = [];
  for (let index = 0; index < sizes.length; index++) {
    if (index > 0 && mode === 'live') await pause(800);
    const size = sizes[index];
    try {
      const response = await fetcher('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: { ...intent, amountIn: size }, mode }),
        signal: AbortSignal.timeout(20_000),
        cache: 'no-store',
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        const envelope = data && typeof data === 'object' && 'error' in data ? data.error : null;
        const error: ComparisonError =
          envelope && typeof envelope === 'object' && 'code' in envelope && 'message' in envelope
            ? (envelope as ComparisonError)
            : {
                code: 'REQUEST_FAILED',
                message: `The quote service returned HTTP ${response.status}.`,
              };
        rows.push({ size, status: 'error', error });
        onProgress([...rows]);
        if (
          response.status === 429 ||
          ['INVALID_INPUT', 'UNSUPPORTED_ROUTE', 'AUTH_REQUIRED'].includes(error.code)
        ) {
          const reason =
            response.status === 429 ? 'Skipped after rate limit' : 'Skipped after route error';
          for (const remaining of sizes.slice(index + 1))
            rows.push({ size: remaining, status: 'skipped', reason });
          onProgress([...rows]);
          break;
        }
      } else {
        rows.push({ size, status: 'success', quote: data as QuoteResult });
        onProgress([...rows]);
      }
    } catch {
      rows.push({
        size,
        status: 'error',
        error: { code: 'CONNECTION_ERROR', message: 'Could not reach the quote service.' },
      });
      onProgress([...rows]);
    }
  }
  return rows;
}
