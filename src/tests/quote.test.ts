import { describe, it, expect, vi } from 'vitest';
import { LiFiIntentAdapter } from '@/adapters/lifi-intent';
import { EXAMPLE_ADDRESS } from '@/config/chains';
import { BebopClient, parseBebopResponse } from '@/clients/bebop';
import { LiFiClient } from '@/clients/lifi';
import { effectivePrice, mockQuote, normalizeQuote } from '@/services/quote';
import { POST } from '@/app/api/quote/route';

const intent = {
  fromChain: 8453,
  toChain: 8453,
  fromToken: 'WETH',
  toToken: 'USDC',
  amountIn: '0.1',
  userAddress: EXAMPLE_ADDRESS,
  receiverAddress: '0x1111111111111111111111111111111111111111',
};
const adapter = new LiFiIntentAdapter();
const request = adapter.normalize(intent);
function fixture() {
  return {
    ...mockQuote(request),
    status: 'SIG_SUCCESS',
    approvalTarget: '0xBeb0009ACa35087ce7cCF11637E24dd1Aad3bf2A' as const,
    settlementAddress: '0xbbbbbBB520d69a9775E85b458C58c648259FAD5F' as const,
    tx: {
      to: '0xBeb0009ACa35087ce7cCF11637E24dd1Aad3bf2A' as const,
      value: '0x0',
      data: '0x1234',
      from: request.taker,
    },
  };
}
const fetchMock = (body: unknown, status = 200, headers = {}) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status, headers }));

describe('LiFiIntentAdapter', () => {
  it('normalizes checksum addresses, amounts, and distinct receiver', () => {
    expect(request.sellAmount).toBe('100000000000000000');
    expect(request.buyToken.address).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(request.receiver).not.toBe(request.taker);
  });
  it('supports Ethereum USDT and case-insensitive token addresses', () => {
    const r = adapter.normalize({
      ...intent,
      fromChain: 1,
      toChain: 1,
      fromToken: 'USDT',
      toToken: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      amountIn: '100.123456',
    });
    expect(r.sellAmount).toBe('100123456');
    expect(r.chain.slug).toBe('ethereum');
  });
  it('preserves values beyond Number.MAX_SAFE_INTEGER', () =>
    expect(
      adapter.normalize({ ...intent, amountIn: '123456789.123456789123456789' }).sellAmount,
    ).toBe('123456789123456789123456789'));
  it.each(['0', '-1', '1e3', 'NaN', '0.0000000000000000001', ' 1', '9'.repeat(79)])(
    'rejects invalid amount %s',
    (amountIn) => expect(() => adapter.normalize({ ...intent, amountIn })).toThrow(),
  );
  it('rejects excess precision instead of rounding', () =>
    expect(() =>
      adapter.normalize({ ...intent, fromToken: 'USDC', toToken: 'WETH', amountIn: '1.0000001' }),
    ).toThrow('never rounded'));
  it.each([
    { toChain: 1 },
    { fromChain: 999, toChain: 999 },
    { fromToken: 'USDT' },
    { toToken: 'WETH' },
  ])('rejects unsupported routes %j', (patch) =>
    expect(() => adapter.normalize({ ...intent, ...patch })).toThrow(),
  );
  it.each(['0x123', '0x0000000000000000000000000000000000000000'])(
    'rejects invalid participant %s',
    (userAddress) => expect(() => adapter.normalize({ ...intent, userAddress })).toThrow(),
  );
});
describe('BebopClient', () => {
  it('maps exact-input query and Bearer auth to the RFQ endpoint', async () => {
    const fetcher = fetchMock(fixture());
    await new BebopClient('test-key', fetcher).quote(request);
    const [url, options] = fetcher.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe('/pmm/base/v3/quote');
    expect(parsed.searchParams.get('sell_amounts')).toBe(request.sellAmount);
    expect(parsed.searchParams.get('receiver_address')).toBe(request.receiver);
    expect(parsed.searchParams.get('approval_type')).toBe('Standard');
    expect(options?.headers).toEqual({ Authorization: 'Bearer test-key' });
    expect(options?.cache).toBe('no-store');
  });
  it('does not send a fabricated key in public mode', async () => {
    const fetcher = fetchMock(fixture());
    await new BebopClient(undefined, fetcher).quote(request);
    expect(fetcher.mock.calls[0][1]?.headers).toEqual({});
  });
  it.each([429, 401, 403, 500])('handles HTTP %i', async (status) => {
    await expect(
      new BebopClient(undefined, fetchMock({}, status, { 'Retry-After': '42' })).quote(request),
    ).rejects.toMatchObject({
      code: status === 429 ? 'RATE_LIMITED' : status === 500 ? 'UPSTREAM_FAILURE' : 'AUTH_REQUIRED',
    });
  });
  it('preserves Retry-After', async () =>
    await expect(
      new BebopClient(undefined, fetchMock({}, 429, { 'Retry-After': '42' })).quote(request),
    ).rejects.toMatchObject({ retryAfter: 42 }));
  it('handles HTTP 200 error envelopes', async () =>
    await expect(
      new BebopClient(
        undefined,
        fetchMock({ error: { errorCode: 100, message: 'No liquidity' } }),
      ).quote(request),
    ).rejects.toMatchObject({ code: 'NO_QUOTE' }));
  it('handles timeout', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    await expect(new BebopClient(undefined, fetcher).quote(request)).rejects.toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
    });
  });
  it('handles network failure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network'));
    await expect(new BebopClient(undefined, fetcher).quote(request)).rejects.toMatchObject({
      code: 'UPSTREAM_FAILURE',
    });
  });
  it('rejects non-JSON response', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>gateway</html>'));
    await expect(new BebopClient(undefined, fetcher).quote(request)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
  it.each([
    { chainId: 1 },
    { receiver: EXAMPLE_ADDRESS },
    { sellTokens: {} },
    { expiry: -1 },
    { tx: { data: 'not-hex' } },
  ])('rejects mismatched / malformed response %j', (patch) =>
    expect(() => parseBebopResponse({ ...fixture(), ...patch }, request)).toThrow(),
  );
  it('rejects changed sell amount and decimals', () => {
    const q = fixture();
    q.sellTokens[request.sellToken.address].amount = '1';
    expect(() => parseBebopResponse(q, request)).toThrow();
    const p = fixture();
    p.buyTokens[request.buyToken.address].decimals = 18;
    expect(() => parseBebopResponse(p, request)).toThrow();
  });
  it('matches token map keys case-insensitively', () => {
    const q = fixture();
    const token = q.buyTokens[request.buyToken.address];
    q.buyTokens = { [request.buyToken.address.toLowerCase()]: token };
    expect(parseBebopResponse(q, request).chainId).toBe(8453);
  });
});
describe('Quote analysis', () => {
  it('computes price from base units, not floats', () =>
    expect(effectivePrice(100000000000000000n, 18, 267659059n, 6)).toBe('2676.59059'));
  it('preserves three contract roles without substituting addresses', () => {
    const q = normalizeQuote(request, fixture(), 'live', false);
    expect(q.approvalTarget).not.toBe(q.settlementAddress);
    expect(q.access).toBe('public-demo');
    expect(q.transaction.valueEth).toBe('0');
    expect(q.executionDataComplete).toBe(true);
  });
  it('labels expired quotes', () =>
    expect(normalizeQuote(request, { ...fixture(), expiry: 1 }, 'live', true).expired).toBe(true));
  it('does not claim empty calldata is present', () => {
    const q = fixture();
    q.tx.data = '0x';
    expect(normalizeQuote(request, q, 'live', true).transaction.hasCalldata).toBe(false);
  });
  it('mock results have no executable transaction or contract addresses', () => {
    const q = normalizeQuote(request, mockQuote(request), 'mock', false);
    expect(q.access).toBe('local-fixture');
    expect(q.transaction.hasCalldata).toBe(false);
    expect(q.approvalTarget).toBeNull();
  });
});
describe('LI.FI', () => {
  it('uses chainId, not the internal record id', async () => {
    const fetcher = fetchMock([{ id: 2, chainId: '8453', name: 'Base', chainType: 'EVM' }]);
    const result = await new LiFiClient(fetcher).supportedChains();
    expect(result.chains[0].chainId).toBe('8453');
    expect(fetcher.mock.calls[0][0]).toBe('https://order.li.fi/chains/supported');
  });
  it('rejects schema drift', async () =>
    await expect(new LiFiClient(fetchMock({ chains: [] })).supportedChains()).rejects.toMatchObject(
      { code: 'INVALID_RESPONSE' },
    ));
});
describe('POST /api/quote', () => {
  it('returns mock response with no caching', async () => {
    const response = await POST(
      new Request('http://localhost/api/quote', {
        method: 'POST',
        body: JSON.stringify({ intent, mode: 'mock' }),
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect((await response.json()).mode).toBe('mock');
  });
  it('rejects invalid JSON', async () => {
    const response = await POST(
      new Request('http://localhost/api/quote', { method: 'POST', body: '{' }),
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('INVALID_INPUT');
  });
  it('returns unsupported route without calling upstream', async () => {
    const response = await POST(
      new Request('http://localhost/api/quote', {
        method: 'POST',
        body: JSON.stringify({ intent: { ...intent, toChain: 1 } }),
      }),
    );
    expect(response.status).toBe(422);
  });
});
