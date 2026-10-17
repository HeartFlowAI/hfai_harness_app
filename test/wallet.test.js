const { test } = require('node:test'), assert = require('node:assert/strict');
const solana = require('../src/wallet/solana');
const providers = require('../src/wallet/providers');
const { createWalletManager, normalizeConfig, sanitizeHistory, sanitizeHistoryCache } = require('../src/wallet/index');
const { executeTool } = require('../src/tools');
const { createSolanaConnect } = require('../src/wallet/connect');

const SOL = solana.SOL_MINT;
const DATE = Date.now() - 20 * 864e5;
const ADDRESS = 'So11111111111111111111111111111111111111112';
const WATCH = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const json = body => ({ ok: true, status: 200, json: async () => body });
const tokenAccount = (mint, amount) => ({ account: { data: { parsed: { info: { mint, tokenAmount: { uiAmount: amount } } } } } });

function fakeFetch() {
  return async (url, options = {}) => {
    const u = String(url);
    if (u.includes('api.mainnet-beta') || u.includes('rpc.example')) {
      const { method } = JSON.parse(options.body);
      if (method === 'getBalance') return json({ result: { value: 2_000_000_000 } });
      if (method === 'getTokenAccountsByOwner') return json({ result: { value: [tokenAccount('MintA', 1000), tokenAccount('MintB', 0)] } });
      if (method === 'getAccountInfo') return json({ result: { value: { data: { parsed: { info: { mintAuthority: null, freezeAuthority: 'Frz', decimals: 6 } } } } } });
    }
    if (u.includes('jup')) return json({ [SOL]: { usdPrice: 150, priceChange24h: 1.5 }, [WATCH]: { usdPrice: 1, priceChange24h: 0.1 }, MintA: { usdPrice: 2, priceChange24h: 3 } });
    if (u.includes('coingecko') && u.includes('market_chart')) return json({ prices: [[DATE, 1], [DATE + 10 * 864e5, 2], [DATE + 20 * 864e5, 3]] });
    if (u.includes('dexscreener') && u.includes('search')) return json({ pairs: [
      { chainId: 'solana', dexId: 'raydium', baseToken: { address: 'MintA', symbol: 'AAA', name: 'Aaa' }, priceUsd: '2', priceChange: { h24: '5' }, liquidity: { usd: '10000' }, volume: { h24: '5000' }, marketCap: '100000' },
      { chainId: 'ethereum', baseToken: { address: 'x', symbol: 'ETHX', name: 'Ethx' } }
    ] });
    throw new Error('unexpected url ' + u);
  };
}

test('wallet address validation accepts base58 and rejects junk', () => {
  assert.equal(solana.validateAddress(ADDRESS), true);
  assert.equal(solana.validateAddress('  ' + ADDRESS + ' '), true);
  for (const bad of ['', 'abc', '0OIl', 'x'.repeat(50), null, 42]) assert.equal(solana.validateAddress(bad), false);
  assert.throws(() => solana.normalizeAddress('nope'), /Solana address/);
});

test('fetchPortfolio reads SOL balance and SPL token accounts', async () => {
  const portfolio = await solana.fetchPortfolio(ADDRESS, { fetchImpl: fakeFetch() });
  assert.equal(portfolio.sol, 2);
  assert.equal(portfolio.address, ADDRESS);
  assert.deepEqual(portfolio.tokens, [{ mint: 'MintA', amount: 1000 }]);
});

test('jupiterPrices and searchTokens parse provider responses', async () => {
  const prices = await providers.jupiterPrices([SOL, 'MintA'], { fetchImpl: fakeFetch() });
  assert.equal(prices[SOL].price, 150);
  assert.equal(prices[SOL].change24h, 1.5);
  assert.equal(prices.MintA.price, 2);
  const results = await providers.searchTokens('aaa', { fetchImpl: fakeFetch() });
  assert.equal(results.length, 1);
  assert.deepEqual({ symbol: results[0].symbol, priceUsd: results[0].priceUsd, change24h: results[0].change24h, liquidityUsd: results[0].liquidityUsd }, { symbol: 'AAA', priceUsd: 2, change24h: 5, liquidityUsd: 10000 });
});

test('tokenSafety reads mint/freeze authority from the mint account', async () => {
  const safety = await providers.tokenSafety('MintX', { fetchImpl: fakeFetch() });
  assert.equal(safety.known, true);
  assert.equal(safety.mintRevoked, true);
  assert.equal(safety.freezeRevoked, false);
  assert.equal(safety.level, 'caution');
  assert.ok(safety.flags.includes('freeze authority active'));
});

test('wallet manager values holdings and computes shares', async () => {
  const config = normalizeConfig({ addresses: [ADDRESS], rpc: '' });
  const manager = createWalletManager({ config, fetchImpl: fakeFetch() });
  const state = await manager.refresh();
  assert.equal(state.watching, true);
  assert.equal(state.total, 300 + 2000);
  assert.equal(state.holdings[0].symbol, 'MintA');
  assert.equal(state.holdings.find(h => h.symbol === 'SOL').value, 300);
  assert.ok(Math.abs(state.holdings[0].share - 2000 / 2300) < 1e-9);
  manager.dispose();
});

test('portfolio history aggregates priced holdings across a range', async () => {
  const config = normalizeConfig({ addresses: [ADDRESS], rpc: '' });
  const manager = createWalletManager({ config, fetchImpl: fakeFetch() });
  await manager.refresh();
  await manager.ready(SOL, 'max');
  await manager.ready('MintA', 'max');
  const series = manager.portfolioHistory('30D');
  assert.equal(series.length, 3);
  assert.equal(series[0].p, 1000 * 1 + 2 * 1);
  assert.equal(series[2].p, 1000 * 3 + 2 * 3);
  manager.dispose();
});

test('portfolioSeries reports coverage and the request range uses its Binance interval', async () => {
  const seen = [];
  const fetchImpl = async (url, options = {}) => {
    const u = String(url);
    if (u.includes('binance.com') && u.includes('/klines')) {
      if (u.includes('interval=1h')) { seen.push(u); return json([[DATE, '1', '2', '0.5', '1'], [DATE + 864e5, '1', '2', '0.5', '2']]); }
      throw new Error('binance ' + u);
    }
    return fakeFetch()(u, options);
  };
  const config = normalizeConfig({ addresses: [ADDRESS], rpc: '' });
  const manager = createWalletManager({ config, fetchImpl });
  await manager.refresh();
  await manager.ready(SOL, 'max');
  await manager.ready('MintA', 'max');
  const result = manager.portfolioSeries('30D');
  assert.equal(result.holdings, 2);
  assert.equal(result.covered, 2);
  assert.equal(result.points.length, 3);
  assert.ok(result.total >= 2300);
  seen.length = 0;
  await manager.ready(SOL, '7D');
  assert.match(seen[0], /interval=1h&limit=168/);
  manager.dispose();
});

test('a paper-buy signal fires onSignal with the rule and live quote', async () => {
  const config = normalizeConfig({ watchlist: [WATCH], signals: [{ id: 'sig1', name: 'Dip', mint: WATCH, condition: { metric: 'price', op: 'above', value: 0.5 }, action: 'paper-buy', usd: 50, cooldownSec: 0 }] });
  const fired = [];
  const manager = createWalletManager({ config, fetchImpl: fakeFetch(), onSignal: (rule, quote) => fired.push({ rule, quote }) });
  await manager.refresh();
  assert.equal(fired.length, 1);
  assert.equal(fired[0].rule.action, 'paper-buy');
  assert.equal(fired[0].rule.usd, 50);
  assert.equal(fired[0].quote.price, 1);
  manager.dispose();
});

test('wallet manager reports an empty state with no addresses', async () => {
  const config = normalizeConfig({});
  const manager = createWalletManager({ config, fetchImpl: fakeFetch() });
  const state = await manager.refresh();
  assert.equal(state.watching, false);
  assert.equal(state.holdings.length, 0);
  manager.dispose();
});

test('normalizeConfig sanitizes addresses, rpc, mode and currency', () => {
  const config = normalizeConfig({ addresses: [ADDRESS, ADDRESS, 'bad'], rpc: 'http://insecure', mode: 'pro', currency: 'eur', hideBalances: true });
  assert.deepEqual(config.addresses, [ADDRESS]);
  assert.equal(config.rpc, '');
  assert.equal(config.mode, 'pro');
  assert.equal(config.currency, 'EUR');
  assert.equal(config.hideBalances, true);
});

test('fetchHistory returns recent transaction summaries', async () => {
  const fetchImpl = async (url, options = {}) => {
    const { method } = JSON.parse(options.body);
    if (method === 'getSignaturesForAddress') return json({ result: [{ signature: 'sig', slot: 1, blockTime: 2, err: null }] });
    throw new Error('unexpected ' + method);
  };
  const history = await solana.fetchHistory(ADDRESS, { fetchImpl });
  assert.deepEqual(history, [{ signature: 'sig', slot: 1, blockTime: 2, err: false, memo: '' }]);
});

test('wallet manager prices the watchlist and fires price alerts once', async () => {
  const config = normalizeConfig({ watchlist: [WATCH], alerts: [{ mint: WATCH, direction: 'above', price: 0.5 }] });
  const alerts = [];
  const manager = createWalletManager({ config, fetchImpl: fakeFetch(), onAlert: alert => alerts.push(alert) });
  const state = await manager.refresh();
  assert.equal(state.watchlist.length, 1);
  assert.equal(state.watchlist[0].price, 1);
  assert.equal(state.alerts[0].direction, 'above');
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].current, 1);
  await manager.refresh();
  assert.equal(alerts.length, 1);
  assert.ok(state.alerts[0].triggeredAt > 0);
  manager.dispose();
});

test('wallet tools route through the tool context and validate their input', async () => {
  const signal = () => new AbortController().signal;  assert.equal((await executeTool('wallet_summary', {}, { signal: signal(), walletSummary: async () => ({ watching: true, total: 5 }) })).total, 5);
  assert.equal((await executeTool('token_safety', { mint: 'MintX' }, { signal: signal(), tokenSafety: async mint => ({ mint, level: 'ok' }) })).mint, 'MintX');
  assert.equal((await executeTool('market_discover', { query: 'bonk' }, { signal: signal(), marketDiscover: async query => ({ query }) })).query, 'bonk');
  await assert.rejects(executeTool('wallet_token', {}, { signal: signal() }), /Missing string argument/);
  await assert.rejects(executeTool('wallet_token', { query: 'x', extra: 'y' }, { signal: signal() }), /Unexpected/);
});

test('wallet manager records chartable price history', async () => {
  const config = normalizeConfig({ watchlist: [WATCH] });
  const manager = createWalletManager({ config, fetchImpl: fakeFetch() });
  await manager.refresh();
  const series = manager.series(WATCH);
  assert.equal(series.length, 1);
  assert.equal(series[0].p, 1);
  manager.dispose();
});

test('sanitizeHistory keeps bounded, valid points only', () => {
  const history = sanitizeHistory({ [WATCH]: [{ t: '1', p: '2' }, { t: 'bad' }], nope: [{ t: 1, p: 1 }] });
  assert.deepEqual(history[WATCH], [{ t: 1, p: 2 }]);
  assert.equal(history.nope, undefined);
});

test('sanitizeHistoryCache keeps valid ranged entries with OHLC and prunes bad keys', () => {
  const cache = sanitizeHistoryCache({
    [`${WATCH}|7D`]: { at: 123, points: [{ t: 1, p: 2, o: 1, h: 3, l: 0.5, c: 2 }, { t: 2, p: 3 }, { t: 'bad' }] },
    'nope|7D': { at: 1, points: [{ t: 1, p: 1 }, { t: 2, p: 2 }] },
    [`${WATCH}|weird`]: { at: 1, points: [{ t: 1, p: 1 }, { t: 2, p: 2 }] },
    [`${WATCH}|max`]: { at: 1, points: [{ t: 1, p: 1 }] }
  });
  assert.equal(Object.keys(cache).length, 1);
  assert.equal(cache[`${WATCH}|7D`].at, 123);
  assert.deepEqual(cache[`${WATCH}|7D`].points[0], { t: 1, o: 1, h: 3, l: 0.5, c: 2, p: 2, v: 0 });
});

test('ranged history persists to config and reloads without a refetch', async () => {
  const config = normalizeConfig({ addresses: [ADDRESS], rpc: '' });
  const manager = createWalletManager({ config, fetchImpl: fakeFetch() });
  await manager.refresh();
  await manager.ready('MintA', 'max');
  assert.ok(config.historyCache['MintA|max']);
  manager.dispose();
  const manager2 = createWalletManager({ config, fetchImpl: fakeFetch() });
  await manager2.refresh();
  const result = manager2.portfolioSeries('30D');
  assert.ok(result.covered >= 1);
  manager2.dispose();
});

test('a market token without a Binance mapping probes SYMBOLUSDT once', async () => {
  const seen = [];
  const fetchImpl = async (url, options = {}) => { const u = String(url); if (u.includes('binance.com') && u.includes('/klines')) { seen.push(u); if (u.includes('symbol=MSOLUSDT')) return json([[DATE, '1', '2', '0.5', '1'], [DATE + 864e5, '1', '2', '0.5', '2']]); throw new Error('no binance'); } if (u.includes('coingecko')) return json({ prices: [] }); return fakeFetch()(u, options); };
  const config = normalizeConfig({});
  const manager = createWalletManager({ config, fetchImpl });
  await manager.ready('mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', '7D');
  assert.ok(seen.some(u => u.includes('symbol=MSOLUSDT')));
  manager.dispose();
});

test('WalletConnect refuses without a project id and normalizes wc config', async () => {  const connect = createSolanaConnect({ getProjectId: () => '' });
  await assert.rejects(connect.pair(), /WalletConnect project ID/);
  const cfg = normalizeConfig({ wcProjectId: '  abc  ', wcSession: { topic: 't', accounts: ['solana:abc'] } });
  assert.equal(cfg.wcProjectId, 'abc');
  assert.equal(cfg.wcSession.topic, 't');
  assert.deepEqual(cfg.wcSession.accounts, ['solana:abc']);
  assert.deepEqual(normalizeConfig({}).wcSession, { topic: '', accounts: [] });
});

test('research records normalize with only known statuses', () => {
  const cfg = normalizeConfig({ research: [{ id: 'r1', mint: 'MintA', symbol: 'AAA', status: 'ready', report: 'Report body' }, { id: 'r2', mint: 'MintB', status: 'weird' }, { mint: 'x' }] });
  assert.equal(cfg.research.length, 1);
  assert.equal(cfg.research[0].report, 'Report body');
  assert.equal(cfg.research[0].status, 'ready');
  assert.deepEqual(normalizeConfig({}).research, []);
});
