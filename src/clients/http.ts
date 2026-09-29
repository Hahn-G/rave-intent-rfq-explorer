import { QuoteError } from '@/lib/errors';
export type Fetcher = typeof fetch;
export async function fetchJson(
  url: string,
  options: RequestInit = {},
  fetcher: Fetcher = fetch,
): Promise<unknown> {
  try {
    const response = await fetcher(url, {
      ...options,
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 429) {
      const header = response.headers.get('retry-after');
      const seconds =
        header && /^\d+$/.test(header)
          ? Number(header)
          : header
            ? Math.ceil((Date.parse(header) - Date.now()) / 1000)
            : 30;
      throw new QuoteError(
        'RATE_LIMITED',
        'The upstream API is rate limiting requests. Wait before requesting another quote.',
        429,
        Number.isFinite(seconds) ? Math.max(1, seconds) : 30,
      );
    }
    if (response.status === 401 || response.status === 403)
      throw new QuoteError(
        'AUTH_REQUIRED',
        'Upstream access was denied. Check the server API key and API access policy.',
        502,
      );
    if (!response.ok)
      throw new QuoteError(
        'UPSTREAM_FAILURE',
        `Upstream returned HTTP ${response.status}. Try again or use another trade size.`,
        502,
      );
    try {
      return await response.json();
    } catch {
      throw new QuoteError('INVALID_RESPONSE', 'Upstream did not return valid JSON.', 502);
    }
  } catch (error) {
    if (error instanceof QuoteError) throw error;
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
      throw new QuoteError(
        'UPSTREAM_TIMEOUT',
        'The upstream API did not respond within 12 seconds.',
        504,
      );
    throw new QuoteError(
      'UPSTREAM_FAILURE',
      'Could not reach the upstream API. Check connectivity and retry.',
      502,
    );
  }
}
