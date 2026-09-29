'use client';

import { useEffect, useRef, useState } from 'react';
import { CHAINS, EXAMPLE_ADDRESS } from '@/config/chains';
import type { SimplifiedIntent } from '@/adapters/lifi-intent';
import type { QuoteMode, QuoteResult } from '@/services/quote';
import {
  compareTradeSizes,
  comparisonSizes,
  comparisonSummary,
  priceDeltaBps,
  type ComparisonRow,
} from '@/services/comparison';

const initial: SimplifiedIntent = {
  fromChain: 8453,
  toChain: 8453,
  fromToken: 'WETH',
  toToken: 'USDC',
  amountIn: '0.1',
  userAddress: EXAMPLE_ADDRESS,
  receiverAddress: EXAMPLE_ADDRESS,
};
type ApiError = { code: string; message: string; retryAfter?: number };
type ChainsResult = {
  chains: { chainId: string; name: string; chainType: string }[];
  fetchedAt: string;
};

function DataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="data-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
function Json({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

export default function Explorer() {
  const [intent, setIntent] = useState(initial);
  const [mode, setMode] = useState<QuoteMode>('live');
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [compareBusy, setCompareBusy] = useState(false);
  const [comparison, setComparison] = useState<ComparisonRow[]>([]);
  const [tab, setTab] = useState<'overview' | 'request' | 'response'>('overview');
  const [now, setNow] = useState(0);
  const [retryUntil, setRetryUntil] = useState(0);
  const [chains, setChains] = useState<ChainsResult | null>(null);
  const [chainError, setChainError] = useState('');
  const [chainBusy, setChainBusy] = useState(false);
  const requestId = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const chain = CHAINS.find((c) => c.id === intent.fromChain)!;
  const targetChain = CHAINS.find((c) => c.id === intent.toChain)!;
  const seconds = quote ? Math.max(0, Math.ceil((quote.expiry * 1000 - now) / 1000)) : 0;
  const expired = !!quote && now > 0 && seconds === 0;
  const cooldown = Math.max(0, Math.ceil((retryUntil - now) / 1000));
  const sizes = comparisonSizes(intent.fromToken);
  const compared = comparison.filter(
    (row): row is Extract<ComparisonRow, { status: 'success' }> => row.status === 'success',
  );
  const baseline = compared[0]?.quote;

  function update(patch: Partial<SimplifiedIntent>) {
    requestId.current++;
    setIntent((i) => ({ ...i, ...patch }));
    setQuote(null);
    setError(null);
    setBusy(false);
    setComparison([]);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const id = ++requestId.current;
    setBusy(true);
    setError(null);
    setQuote(null);
    setTab('overview');
    try {
      const response = await fetch('/api/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, mode }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = await response.json();
      if (id !== requestId.current) return;
      if (!response.ok) {
        setError(data.error ?? { code: 'REQUEST_FAILED', message: 'The request failed.' });
        if (response.status === 429) {
          setNow(Date.now());
          setRetryUntil(Date.now() + (data.error?.retryAfter ?? 30) * 1000);
        }
      } else {
        setNow(Date.now());
        setQuote(data);
      }
    } catch {
      if (id === requestId.current)
        setError({
          code: 'CONNECTION_ERROR',
          message: 'Could not reach the quote service. Check your connection and try again.',
        });
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }
  async function checkChains() {
    setChainBusy(true);
    setChainError('');
    try {
      const response = await fetch('/api/lifi/chains', { signal: AbortSignal.timeout(20_000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message ?? 'Chain lookup failed.');
      setChains(data);
    } catch (error) {
      setChainError(error instanceof Error ? error.message : 'Chain lookup failed.');
    } finally {
      setChainBusy(false);
    }
  }

  async function compare() {
    const id = ++requestId.current;
    setComparison([]);
    setCompareBusy(true);
    setError(null);
    setQuote(null);
    setTab('overview');
    try {
      const rows = await compareTradeSizes(intent, mode, sizes, (progress) => {
        if (id === requestId.current) setComparison(progress);
      });
      if (id !== requestId.current) return;
      const first = rows.find((row) => row.status === 'success' && row.size === intent.amountIn);
      const selected = first ?? rows.find((row) => row.status === 'success');
      if (selected?.status === 'success') {
        setNow(Date.now());
        setQuote(selected.quote);
      }
      const limited = rows.find(
        (row) => row.status === 'error' && row.error.code === 'RATE_LIMITED',
      );
      if (limited?.status === 'error') {
        setNow(Date.now());
        setRetryUntil(Date.now() + (limited.error.retryAfter ?? 30) * 1000);
      }
    } finally {
      if (id === requestId.current) setCompareBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <a href="/" className="brand">
          <span className="brand-mark">r</span>rave
          <span className="brand-divider" /> <span className="brand-product">QUOTE EXPLORER</span>
        </a>
        <span className="read-only">Read-only workspace</span>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <p className="eyebrow">INTENT → LIQUIDITY</p>
            <h1>From intent to quote.</h1>
            <p className="intro">Explore RFQ pricing. Inspect every execution detail.</p>
          </div>
          <div className="network-note">
            <span className="network-icon">◆</span> Ethereum{' '}
            <span className="network-icon base">●</span> Base
          </div>
        </div>
        <div className="workspace">
          <section className="panel intent-panel" aria-labelledby="intent-title">
            <div className="panel-heading">
              <div>
                <span className="step">01</span>
                <h2 id="intent-title">Define your intent</h2>
              </div>
              <span className="small-tag">EXACT INPUT</span>
            </div>
            <form onSubmit={submit}>
              <fieldset disabled={busy || compareBusy}>
                <div className="field-grid">
                  <label>
                    From chain
                    <select
                      value={intent.fromChain}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        update({ fromChain: id, toChain: id, fromToken: 'WETH', toToken: 'USDC' });
                      }}
                    >
                      {CHAINS.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    To chain
                    <select
                      value={intent.toChain}
                      onChange={(e) => update({ toChain: Number(e.target.value), toToken: 'USDC' })}
                    >
                      {CHAINS.map((c) => (
                        <option value={c.id} key={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {intent.fromChain !== intent.toChain && (
                  <p className="inline-warning">
                    Cross-chain routes are not supported by this RFQ adapter.
                  </p>
                )}
                <div className="trade-box">
                  <div className="trade-box-heading">
                    <label htmlFor="amount">You sell</label>
                    <select
                      aria-label="Sell token"
                      value={intent.fromToken}
                      onChange={(e) => update({ fromToken: e.target.value })}
                    >
                      {chain.tokens.map((t) => (
                        <option key={t.symbol}>{t.symbol}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    className="amount-input"
                    id="amount"
                    inputMode="decimal"
                    autoComplete="off"
                    required
                    value={intent.amountIn}
                    onChange={(e) => update({ amountIn: e.target.value })}
                  />
                  <div className="presets">
                    {sizes.map((size) => (
                      <button type="button" key={size} onClick={() => update({ amountIn: size })}>
                        {size}
                      </button>
                    ))}
                    <span>
                      {chain.tokens.find((t) => t.symbol === intent.fromToken)?.decimals} decimals
                    </span>
                  </div>
                </div>
                <div className="direction" aria-hidden="true">
                  ↓
                </div>
                <div className="buy-field">
                  <label htmlFor="buy-token">You buy</label>
                  <select
                    id="buy-token"
                    value={intent.toToken}
                    onChange={(e) => update({ toToken: e.target.value })}
                  >
                    {targetChain.tokens.map((t) => (
                      <option key={t.symbol}>{t.symbol}</option>
                    ))}
                  </select>
                </div>
                <label className="address-label">
                  User address
                  <input
                    spellCheck={false}
                    autoComplete="off"
                    required
                    value={intent.userAddress}
                    onChange={(e) => update({ userAddress: e.target.value })}
                  />
                </label>
                <label className="address-label">
                  Receiver address
                  <input
                    spellCheck={false}
                    autoComplete="off"
                    required
                    value={intent.receiverAddress}
                    onChange={(e) => update({ receiverAddress: e.target.value })}
                  />
                </label>
                <p className="field-hint">
                  Prefilled with a public example address. Use your intended taker and receiver for
                  a relevant quote.
                </p>
                <div className="mode-control" aria-label="Quote source">
                  <button
                    type="button"
                    className={mode === 'live' ? 'selected' : ''}
                    aria-pressed={mode === 'live'}
                    onClick={() => {
                      setMode('live');
                      setQuote(null);
                      setError(null);
                      setComparison([]);
                    }}
                  >
                    Live API
                  </button>
                  <button
                    type="button"
                    className={mode === 'mock' ? 'selected' : ''}
                    aria-pressed={mode === 'mock'}
                    onClick={() => {
                      setMode('mock');
                      setQuote(null);
                      setError(null);
                      setComparison([]);
                    }}
                  >
                    Mock demo
                  </button>
                </div>
                <p className="mode-hint">
                  {mode === 'live'
                    ? 'Calls Bebop RFQ. Without a server API key, public demo pricing applies.'
                    : 'Synthetic prices for exploring the interface. No API call or executable data.'}
                </p>
                <button
                  className="primary"
                  disabled={busy || (mode === 'live' && cooldown > 0)}
                  type="submit"
                >
                  {busy
                    ? 'Requesting quote…'
                    : mode === 'live' && cooldown > 0
                      ? `Retry in ${cooldown}s`
                      : mode === 'mock'
                        ? 'Explore mock quote'
                        : 'Request RFQ quote'}
                </button>
                <button
                  className="compare-trigger"
                  disabled={busy || compareBusy || (mode === 'live' && cooldown > 0)}
                  type="button"
                  onClick={compare}
                >
                  {compareBusy
                    ? `Comparing ${comparison.filter((row) => row.status !== 'skipped').length}/${sizes.length}…`
                    : mode === 'live' && cooldown > 0
                      ? `Compare in ${cooldown}s`
                      : `Compare ${sizes.length} trade sizes`}
                </button>
                <p className="compare-hint">
                  {sizes.join(' / ')} {intent.fromToken} · requested one at a time
                </p>
              </fieldset>
            </form>
            <p className="no-wallet">No wallet connection. No signing. No transactions.</p>
          </section>

          <section className="panel result-panel" aria-labelledby="quote-title" aria-busy={busy}>
            <div className="panel-heading">
              <div>
                <span className="step">02</span>
                <h2 id="quote-title">Inspect the quote</h2>
              </div>
              <span className="source-label">BEBOP RFQ</span>
            </div>
            <div className="tabs" role="tablist" aria-label="Quote details">
              {(['overview', 'request', 'response'] as const).map((t) => (
                <button
                  id={`tab-${t}`}
                  role="tab"
                  aria-selected={tab === t}
                  aria-controls="quote-content"
                  tabIndex={tab === t ? 0 : -1}
                  onKeyDown={(e) => {
                    const tabs = ['overview', 'request', 'response'] as const;
                    const index = tabs.indexOf(t);
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                      e.preventDefault();
                      const next = tabs[(index + (e.key === 'ArrowRight' ? 1 : 2)) % 3];
                      setTab(next);
                      document.getElementById(`tab-${next}`)?.focus();
                    }
                  }}
                  className={tab === t ? 'active' : ''}
                  onClick={() => setTab(t)}
                  key={t}
                >
                  {t === 'request'
                    ? 'Normalized request'
                    : t === 'response'
                      ? 'Raw response'
                      : 'Overview'}
                </button>
              ))}
            </div>
            <div
              id="quote-content"
              className="quote-content"
              role="tabpanel"
              aria-labelledby={`tab-${tab}`}
            >
              {error && (
                <div className="error-box" role="alert">
                  <span className="eyebrow">{error.code.replaceAll('_', ' ')}</span>
                  <h3>We couldn’t get this quote.</h3>
                  <p>{error.message}</p>
                  <p className="field-hint">
                    No mock data has been substituted for the failed request.
                  </p>
                </div>
              )}
              {busy && (
                <div className="empty-state" role="status">
                  <div className="loading-ring" />
                  <h3>Asking the liquidity source…</h3>
                  <p>Normalizing your intent and requesting a fresh RFQ.</p>
                </div>
              )}
              {!busy && !error && !quote && (
                <div className="empty-state">
                  <div className="empty-symbol">⇄</div>
                  <span className="eyebrow">A CLEAR VIEW OF EXECUTION</span>
                  <h3>Your next quote starts here.</h3>
                  <p>
                    Define a swap on the left to inspect pricing,
                    <br className="desktop-break" /> expiry, contracts, and transaction data.
                  </p>
                  <div className="flow">
                    <span>Intent</span>
                    <i>→</i>
                    <span>Adapter</span>
                    <i>→</i>
                    <span>RFQ</span>
                  </div>
                </div>
              )}
              {quote && tab === 'request' && (
                <>
                  <p className="section-hint">
                    Checksum addresses and integer base-unit amounts sent to the RFQ client.
                  </p>
                  <Json value={quote.request} />
                </>
              )}
              {quote && tab === 'response' && (
                <>
                  <p className="section-hint">
                    {quote.mode === 'mock'
                      ? 'Synthetic fixture, not a Bebop response.'
                      : 'Full Bebop response. Calldata is shown for inspection only.'}
                  </p>
                  <Json value={quote.raw} />
                </>
              )}
              {quote && tab === 'overview' && (
                <>
                  <div className="quote-status">
                    <span className={`badge ${quote.mode === 'mock' ? 'amber' : ''}`}>
                      {quote.access === 'local-fixture'
                        ? 'MOCK · NOT EXECUTABLE'
                        : quote.access === 'public-demo'
                          ? 'LIVE API · PUBLIC DEMO'
                          : 'LIVE API · AUTHENTICATED'}
                    </span>
                    <span className={expired ? 'expiry expired' : 'expiry'}>
                      {expired ? 'Expired · request again' : `${seconds}s remaining`}
                    </span>
                  </div>
                  <div className="quote-hero">
                    <p>You receive</p>
                    <div className="receive-amount">
                      {quote.buy.formatted}
                      <span>{quote.buy.symbol}</span>
                    </div>
                    <p className="sell-summary">
                      Selling {quote.sell.formatted} {quote.sell.symbol} on{' '}
                      {quote.request.chain.name}
                    </p>
                  </div>
                  <div className="price-strip">
                    <div>
                      <span>Effective price</span>
                      <strong>
                        1 {quote.sell.symbol} ≈ {quote.effectivePrice} {quote.buy.symbol}
                      </strong>
                    </div>
                    <div>
                      <span>Execution data</span>
                      <strong>
                        {quote.executionDataComplete
                          ? 'Present · unverified'
                          : 'Incomplete / absent'}
                      </strong>
                    </div>
                  </div>
                  <h3 className="section-title">
                    Execution details <span>INSPECT ONLY</span>
                  </h3>
                  <dl className="details">
                    <DataRow label="Quote expiry">
                      <time dateTime={new Date(quote.expiry * 1000).toISOString()}>
                        {new Date(quote.expiry * 1000)
                          .toISOString()
                          .replace('T', ' ')
                          .replace('.000Z', ' UTC')}
                      </time>
                    </DataRow>
                    <DataRow label="Approval target">
                      {quote.approvalTarget ?? 'Not returned'}
                    </DataRow>
                    <DataRow label="Settlement address">
                      {quote.settlementAddress ?? 'Not returned'}
                    </DataRow>
                    <DataRow label="Transaction target">
                      {quote.transaction.target ?? 'Not returned'}
                    </DataRow>
                    <DataRow label="Transaction value">
                      {quote.transaction.valueEth !== null
                        ? `${quote.transaction.valueEth} ETH (${quote.transaction.value})`
                        : 'Not returned'}
                    </DataRow>
                    <DataRow label="Calldata present">
                      {quote.transaction.hasCalldata ? 'Yes' : 'No'}
                    </DataRow>
                    <DataRow label="Upstream status">{quote.status}</DataRow>
                  </dl>
                  <div className="analysis">
                    <h3>Quote notes</h3>
                    <ul>
                      {quote.analysis.map((note, i) => (
                        <li key={i}>{note}</li>
                      ))}
                    </ul>
                  </div>
                  <details className="risk">
                    <summary>Approval risk & execution assumptions</summary>
                    <p>
                      Approvals let the spender move your tokens. Independently verify the chain and
                      returned approval target, and prefer exact-amount allowances. Contract fields
                      may differ. Calldata presence does not prove successful execution: balance,
                      allowance, gas, signatures and quote validity still matter. Refresh an expired
                      quote. This explorer performs no simulation or on-chain action.
                    </p>
                  </details>
                </>
              )}
            </div>
          </section>
        </div>
        <section
          className="panel compare-panel"
          aria-labelledby="compare-title"
          aria-busy={compareBusy}
        >
          <div className="panel-heading">
            <div>
              <span className="step">03</span>
              <h2 id="compare-title">Compare trade sizes</h2>
            </div>
            <span className="small-tag">UNIT PRICE</span>
          </div>
          <div className="compare-content">
            {comparison.length === 0 ? (
              <p className="compare-intro">
                Request {sizes.join(', ')} {intent.fromToken} quotes to see how effective unit price
                changes with size. Each request is made separately; no results are retained after
                changing the route.
              </p>
            ) : (
              <>
                <p className="compare-progress" role="status">
                  {compareBusy
                    ? `${comparison.length} of ${sizes.length} sizes processed…`
                    : `${compared.length} of ${sizes.length} sizes quoted · ${mode === 'mock' ? 'synthetic mock' : 'live Bebop API'}`}
                </p>
                <p className="compare-scroll-hint">
                  Swipe sideways to see price difference, expiry and quote details →
                </p>
                <div className="compare-scroll">
                  <table className="compare-table">
                    <caption>
                      Quotes captured sequentially for the same chain, token pair and addresses
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Sell size</th>
                        <th scope="col">Buy amount</th>
                        <th scope="col">Effective price</th>
                        <th scope="col">vs smallest</th>
                        <th scope="col">Captured / expiry</th>
                        <th scope="col">Quote</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.map((row) =>
                        row.status === 'success' ? (
                          <tr key={row.size}>
                            <th scope="row">
                              {row.size} {row.quote.sell.symbol}
                            </th>
                            <td>
                              {row.quote.buy.formatted} {row.quote.buy.symbol}
                            </td>
                            <td>
                              {row.quote.effectivePrice} {row.quote.buy.symbol}/
                              {row.quote.sell.symbol}
                            </td>
                            <td>
                              {baseline && row.quote === baseline
                                ? 'Reference'
                                : baseline
                                  ? `${priceDeltaBps(row.quote, baseline)} bps`
                                  : '—'}
                            </td>
                            <td>
                              <time dateTime={row.quote.fetchedAt}>
                                {new Date(row.quote.fetchedAt).toLocaleTimeString()}
                              </time>
                              <span
                                className={
                                  row.quote.expiry * 1000 <= now
                                    ? 'compare-expired'
                                    : 'compare-valid'
                                }
                              >
                                {row.quote.expiry * 1000 <= now
                                  ? 'Expired'
                                  : `${Math.ceil((row.quote.expiry * 1000 - now) / 1000)}s left`}
                              </span>
                            </td>
                            <td>
                              <button
                                className="inspect-button"
                                onClick={() => {
                                  setQuote(row.quote);
                                  setTab('overview');
                                  document
                                    .getElementById('quote-title')
                                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                }}
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        ) : (
                          <tr key={row.size}>
                            <th scope="row">
                              {row.size} {intent.fromToken}
                            </th>
                            <td colSpan={5} className="compare-error">
                              {row.status === 'error'
                                ? `${row.error.code}: ${row.error.message}`
                                : row.reason}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
                {!compareBusy && (
                  <div className="compare-analysis">
                    <strong>Quote analysis</strong>
                    <p>{comparisonSummary(comparison, now)}</p>
                    {comparison.some((row) => row.status !== 'success') && (
                      <p>
                        Failed or skipped sizes are excluded from the price comparison; no
                        replacement values were invented.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
        <section className="lifi-panel">
          <div>
            <p className="eyebrow">UPSTREAM CONTEXT</p>
            <h2>LI.FI Intents coverage</h2>
            <p>
              Read the open supported-chain endpoint. LI.FI coverage does not guarantee Bebop
              liquidity.
            </p>
          </div>
          <button className="secondary" disabled={chainBusy} onClick={checkChains}>
            {chainBusy ? 'Checking…' : 'Check supported chains'}
          </button>
          {chainError && (
            <p role="alert" className="inline-warning full-width">
              {chainError}
            </p>
          )}
          {chains && (
            <div className="chain-result">
              <div className="chain-pills">
                {CHAINS.map((c) => (
                  <span key={c.id}>
                    {c.name}:{' '}
                    {chains.chains.some((s) => s.chainId === String(c.id))
                      ? 'listed'
                      : 'not listed'}
                  </span>
                ))}
              </div>
              <p>
                {chains.chains.length} chains returned ·{' '}
                {new Date(chains.fetchedAt).toLocaleString()}
              </p>
              <details>
                <summary>View LI.FI response</summary>
                <Json value={chains} />
              </details>
            </div>
          )}
        </section>
        <footer>
          <span>RAVE / INTENT-TO-RFQ EXPLORER</span>
          <a
            href="https://github.com/Hahn-G/rave-intent-rfq-explorer"
            target="_blank"
            rel="noreferrer"
          >
            Source & documentation ↗
          </a>
        </footer>
      </main>
    </>
  );
}
