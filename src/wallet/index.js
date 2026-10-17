const { randomUUID } = require('node:crypto');
const solana = require('./solana');
const providers = require('./providers');
const paperModule = require('./paper');
const strategyModule = require('./strategy');
const sessionModule = require('./session');
const viewsModule = require('../views');
const thesisModule = require('../thesis');
const signalsModule = require('../signals');
const marketsModule = require('./markets');

const MARKET_LIST = marketsModule.listMarkets();
const MAX_POINTS = 240;
const RANGE_DAYS = { '1D': 1, '7D': 7, '30D': 30, '3M': 90, '6M': 180, '1Y': 365, ALL: 'max' };
const RANGE_MS = { '1D': 864e5, '7D': 7 * 864e5, '30D': 30 * 864e5, '3M': 90 * 864e5, '6M': 180 * 864e5, '1Y': 365 * 864e5, ALL: 0 };
// Binance interval and point budget per requested range, so 7D is not drawn as
// seven daily candles. Keyed by range; `max` is the un-ranged fallback used by
// the exposed ready() helper.
const RANGE_INTERVAL = { '1D': ['15m', 96], '7D': ['1h', 168], '30D': ['4h', 180], '3M': ['1d', 90], '6M': ['1d', 183], '1Y': ['1d', 365], ALL: ['1w', 260], max: ['1d', 1000] };
// How long a fetched series stays fresh before a range re-requests it.
const SERIES_TTL = { '1D': 10 * 60000, '7D': 30 * 60000, '30D': 60 * 60000, '3M': 6 * 36e5, '6M': 6 * 36e5, '1Y': 12 * 36e5, ALL: 24 * 36e5, max: 12 * 36e5 };
// How long a failed history lookup is remembered before it is retried.
const NEGATIVE_TTL = 5 * 60000;
const PORTFOLIO_SERIES_CAP = 20;
function downsample(points, max) {
  if (points.length <= max) return points;
  const step = points.length / max, out = [];
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)]);
  out[out.length - 1] = points[points.length - 1];
  return out;
}
function sanitizeHistory(input) {  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const [mint, points] of Object.entries(input)) {
    if (!solana.validateAddress(mint) || !Array.isArray(points)) continue;
    const clean = points
      .filter(point => point && Number.isFinite(Number(point.t)) && Number.isFinite(Number(point.p)))
      .slice(-MAX_POINTS)
      .map(point => ({ t: Number(point.t), p: Number(point.p) }));
    if (clean.length) out[mint] = clean;
    if (Object.keys(out).length >= 40) break;
  }
  return out;
}
// Ranged chart series persisted to disk so a restart opens with charts ready.
// Keyed `${mint}|${range}`; OHLC fields are kept when present so candles survive.
const SERIES_RANGE_KEYS = new Set(['1D', '7D', '30D', '3M', '6M', '1Y', 'ALL', 'max']);
function sanitizeHistoryCache(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const [key, entry] of Object.entries(input)) {
    if (Object.keys(out).length >= 60) break;
    const [mint, range] = String(key).split('|');
    if (!solana.validateAddress(mint) || !SERIES_RANGE_KEYS.has(range)) continue;
    if (!entry || !Array.isArray(entry.points)) continue;
    const points = entry.points
      .filter(point => point && Number.isFinite(Number(point.t)) && Number.isFinite(Number(point.p)))
      .slice(-MAX_POINTS)
      .map(point => Number.isFinite(Number(point.o))
        ? { t: Number(point.t), o: Number(point.o), h: Number(point.h), l: Number(point.l), c: Number(point.c != null ? point.c : point.p), p: Number(point.p), v: Number(point.v) || 0 }
        : { t: Number(point.t), p: Number(point.p) });
    if (points.length >= 2) out[key] = { at: Number(entry.at) || 0, points };
  }
  return out;
}
function sanitizeResearch(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(item => item && item.id && ['queued', 'running', 'ready', 'failed'].includes(item.status)).slice(-30).map(item => ({
    id: String(item.id), mint: typeof item.mint === 'string' ? item.mint.slice(0, 60) : '', symbol: typeof item.symbol === 'string' ? item.symbol.slice(0, 24) : '',
    status: item.status, createdAt: Number(item.createdAt) || 0,
    report: typeof item.report === 'string' ? item.report.slice(0, 20000) : '',
    error: typeof item.error === 'string' ? item.error.slice(0, 300) : ''
  }));
}
function sanitizeExecutions(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(item => item && item.id).slice(-100).map(item => ({
    id: String(item.id), at: Number(item.at) || 0, signature: String(item.signature || '').slice(0, 120),
    side: item.side === 'sell' ? 'sell' : 'buy', mint: String(item.mint || '').slice(0, 60),
    inAmount: String(item.inAmount || '').slice(0, 40), outAmount: String(item.outAmount || '').slice(0, 40),
    status: ['submitted', 'confirmed', 'failed', 'pending'].includes(item.status) ? item.status : 'submitted',
    error: String(item.error || '').slice(0, 200)
  }));
}
function sanitizeVault(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(item => item && item.id && item.publicKey && item.encryptedSecret).slice(0, 10).map(item => ({
    id: String(item.id), label: String(item.label || 'Bot wallet').slice(0, 40), publicKey: String(item.publicKey).slice(0, 64),
    encryptedSecret: String(item.encryptedSecret), createdAt: Number(item.createdAt) || 0
  }));
}
function normalizeLimits(input) {  const source = input && typeof input === 'object' ? input : {};
  return { maxPositionUsd: Math.max(0, Number(source.maxPositionUsd) || 0), maxTotalUsd: Math.max(0, Number(source.maxTotalUsd) || 0), dailyCapUsd: Math.max(0, Number(source.dailyCapUsd) || 0) };
}
function normalizeConfig(input) {
  const source = input && typeof input === 'object' ? input : {};
  const addresses = Array.isArray(source.addresses)
    ? [...new Set(source.addresses.filter(a => solana.validateAddress(a)).map(a => a.trim()))].slice(0, 10)
    : [];
  const watchlist = Array.isArray(source.watchlist)
    ? [...new Set(source.watchlist.filter(a => solana.validateAddress(a)).map(a => a.trim()))].slice(0, 50)
    : [];
  const alerts = Array.isArray(source.alerts)
    ? source.alerts
      .filter(a => a && solana.validateAddress(a.mint) && (a.direction === 'above' || a.direction === 'below') && Number.isFinite(Number(a.price)))
      .slice(0, 50)
      .map(a => ({ id: typeof a.id === 'string' && a.id ? a.id : randomUUID(), mint: a.mint.trim(), direction: a.direction, price: Number(a.price), triggeredAt: Number(a.triggeredAt) || 0 }))
    : [];
  return {
    addresses,
    rpc: typeof source.rpc === 'string' && /^https:\/\//.test(source.rpc.trim()) ? source.rpc.trim() : '',
    mode: source.mode === 'pro' ? 'pro' : 'simple',
    currency: typeof source.currency === 'string' && source.currency.trim() ? source.currency.trim().slice(0, 3).toUpperCase() : 'USD',
    hideBalances: source.hideBalances === true,
    execution: source.execution === 'live' ? 'live' : 'paper',
    watchlist,
    alerts,
    history: sanitizeHistory(source.history),
    historyCache: sanitizeHistoryCache(source.historyCache),
    wcProjectId: typeof source.wcProjectId === 'string' ? source.wcProjectId.trim().slice(0, 120) : '',
    wcStorage: source.wcStorage && typeof source.wcStorage === 'object' && !Array.isArray(source.wcStorage) ? source.wcStorage : {},
    wcSession: source.wcSession && typeof source.wcSession === 'object' ? { topic: String(source.wcSession.topic || '').slice(0, 200), accounts: Array.isArray(source.wcSession.accounts) ? source.wcSession.accounts.slice(0, 5).map(String) : [] } : { topic: '', accounts: [] },
    paper: paperModule.normalizePaper(source.paper),
    research: sanitizeResearch(source.research),
    strategies: strategyModule.normalizeStrategies(source.strategies),
    limits: normalizeLimits(source.limits),
    executions: sanitizeExecutions(source.executions),
    session: sessionModule.normalizeSession(source.session),
    vault: sanitizeVault(source.vault),
    views: viewsModule.normalizeViews(source.views),
    theses: thesisModule.normalizeTheses(source.theses),
    signals: signalsModule.normalizeSignals(source.signals)
  };
}
function shortMint(mint) { return typeof mint === 'string' && mint.length > 10 ? `${mint.slice(0, 4)}…${mint.slice(-4)}` : String(mint || ''); }
function emptyState(now) {
  return { loading: false, error: '', updated: now, watching: false, total: 0, change24h: 0, holdings: [], watchlist: [], markets: [], alerts: [] };
}
function createWalletManager({ config, fetchImpl = fetch, onUpdate = () => {}, onAlert = () => {}, onSamples = () => {}, onHistory = () => {}, onIntent = () => {}, onSignal = () => {}, freshResearch = () => true, intervalMs = 60000, now = () => Date.now() } = {}) {
  let timer = null, disposed = false;
  const fired = new Set();
  const marketHistory = new Map();
  for (const [key, entry] of Object.entries(config.historyCache || {})) marketHistory.set(key, { at: Number(entry.at) || 0, points: (entry.points || []).slice(-MAX_POINTS) });
  const negative = new Map();
  const binanceAlias = new Map();
  const lastPrices = {};
  const lastChange = {};
  const samples = config.history || (config.history = {});
  const state = emptyState(now());
  const alertsView = () => config.alerts.map(alert => ({ id: alert.id, mint: alert.mint, symbol: shortMint(alert.mint), direction: alert.direction, price: alert.price, triggeredAt: alert.triggeredAt || 0 }));
  function record(mint, price) {
    if (!(price > 0)) return false;
    const series = samples[mint] || (samples[mint] = []);
    const last = series[series.length - 1];
    const t = now();
    if (last && last.p === price && t - last.t < 30000) return false;
    series.push({ t, p: price });
    while (series.length > MAX_POINTS) series.shift();
    return true;
  }
  function signals(mint, windowMinutes = 0) {
    const price = Number(lastPrices[mint] || 0);
    const change24h = Number(lastChange[mint] || 0);
    let change = 0;
    if (windowMinutes > 0) { const series = samples[mint] || []; if (series.length) { const cutoff = now() - windowMinutes * 60000; const first = series.find(point => point.t >= cutoff) || series[0]; if (first && first.p > 0) change = (price - first.p) / first.p * 100; } }
    return { price, change24h, change };
  }
  async function refresh() {
    if (disposed) return state;
    const watching = config.addresses.length > 0;
    if (!watching && !config.watchlist.length && !MARKET_LIST.length) { Object.assign(state, emptyState(now()), { alerts: alertsView() }); onUpdate(); return state; }
    state.loading = true; state.error = ''; onUpdate();
    try {
      const rpc = config.rpc || solana.DEFAULT_RPC;
      const portfolios = watching ? await Promise.all(config.addresses.map(address => solana.fetchPortfolio(address, { rpc, fetchImpl }))) : [];
      const mints = new Set([solana.SOL_MINT, ...config.watchlist, ...MARKET_LIST.map(entry => entry.mint)]);
      for (const order of config.paper.pending) mints.add(order.mint);
      let budget = 200;
      for (const portfolio of portfolios) for (const token of portfolio.tokens) { if (mints.has(token.mint) || budget <= 0) continue; budget -= 1; mints.add(token.mint); }
      const ids = [...mints];
      const prices = {};
      for (let i = 0; i < ids.length; i += 50) { try { Object.assign(prices, await providers.jupiterPrices(ids.slice(i, i + 50), { fetchImpl })); } catch {} }
      for (const [mint, quote] of Object.entries(prices)) { lastPrices[mint] = Number(quote.price || 0); lastChange[mint] = Number(quote.change24h || 0); }
      const holdings = [];
      const push = (mint, symbol, amount, address) => {
        if (!(amount > 0)) return;
        const quote = prices[mint] || {};
        const price = Number(quote.price || 0);
        if (!(price > 0)) return;
        holdings.push({ mint, symbol, amount, price, change24h: Number(quote.change24h || 0), value: amount * price, address });
      };
      for (const portfolio of portfolios) {
        push(solana.SOL_MINT, 'SOL', portfolio.sol, portfolio.address);
        for (const token of portfolio.tokens) push(token.mint, shortMint(token.mint), token.amount, portfolio.address);
      }
      holdings.sort((a, b) => b.value - a.value);
      const total = holdings.reduce((sum, holding) => sum + holding.value, 0);
      const change24h = total > 0 ? holdings.reduce((sum, holding) => sum + holding.value * (holding.change24h || 0), 0) / total : 0;
      for (const holding of holdings) holding.share = total > 0 ? holding.value / total : 0;
      const watchlist = config.watchlist.map(mint => { const quote = prices[mint] || {}; return { mint, symbol: shortMint(mint), price: Number(quote.price || 0), change24h: Number(quote.change24h || 0) }; });
      const markets = MARKET_LIST.map(market => { const quote = prices[market.mint] || {}; return { mint: market.mint, symbol: market.symbol, name: market.name, coingecko: market.coingecko || '', price: Number(quote.price || 0), change24h: Number(quote.change24h || 0) }; });
      let recorded = false;
      for (const mint of mints) { const quote = prices[mint]; if (quote && record(mint, Number(quote.price))) recorded = true; }
      const running = (config.session && config.session.state) === 'RUNNING';
      const filled = running ? paperModule.evaluatePending(config.paper, mint => Number(lastPrices[mint] || 0)) : [];
      const result = running ? strategyModule.runStrategies(config.paper, config.strategies, (mint, windowMinutes) => signals(mint, windowMinutes), { now: now(), limits: config.limits }) : { executed: [], intents: [] };
      if (filled.length || result.executed.length || result.intents.length) recorded = true;
      for (const intent of result.intents) { try { onIntent(intent); } catch {} }
      for (const alert of config.alerts) {
        const price = Number(prices[alert.mint]?.price || 0);
        if (!(price > 0)) continue;
        const hit = alert.direction === 'above' ? price >= alert.price : price <= alert.price;
        if (hit && !fired.has(alert.id)) { fired.add(alert.id); alert.triggeredAt = now(); onAlert({ ...alert, symbol: shortMint(alert.mint), current: price }); }
        else if (!hit) fired.delete(alert.id);
      }
      const firedSignals = running ? signalsModule.runSignals(config.signals, (mint, windowMinutes) => signals(mint, windowMinutes), { now: now(), freshResearch }) : [];
      for (const hit of firedSignals) { try { onSignal(hit.rule, hit.signals); } catch {} }
      if (firedSignals.length) recorded = true;
      Object.assign(state, { loading: false, error: '', updated: now(), watching, total, change24h, holdings, watchlist, markets, alerts: alertsView() });
      if (recorded) { try { onSamples(samples); } catch {} }
    } catch (error) {
      state.loading = false; state.error = error.message; state.updated = now();
    }
    onUpdate(); return state;
  }
  function series(mint) { return (samples[mint] || []).slice(-MAX_POINTS); }
  let cgChain = Promise.resolve(), cgLast = 0;
  const pendingSeries = new Map();
  function schedule(fn) {
    cgChain = cgChain.then(async () => {
      const gap = 2500 - (Date.now() - cgLast);
      if (gap > 0) await new Promise(resolve => setTimeout(resolve, gap));
      cgLast = Date.now();
      for (let attempt = 0; attempt < 3; attempt++) {
        try { return await fn(); }
        catch (error) { if (!/429/.test(error.message)) throw error; await new Promise(resolve => setTimeout(resolve, 5000 * (attempt + 1))); }
      }
      return [];
    }).catch(() => []);
    return cgChain;
  }
  function rangeSpec(key) { return RANGE_INTERVAL[key] || RANGE_INTERVAL.max; }
  function rangeDays(key) { const days = RANGE_DAYS[key]; return days === undefined ? 'max' : days; }
  // Cached series carry a fetch time; expired entries are dropped so a range is
  // re-requested at most once per TTL instead of on every draw.
  function cacheRead(mint, key) {
    const entry = marketHistory.get(`${mint}|${key}`);
    if (!entry) return null;
    if (now() - entry.at >= (SERIES_TTL[key] || SERIES_TTL.max)) { marketHistory.delete(`${mint}|${key}`); return null; }
    return entry.points;
  }
  function cachedSeries(mint, key) { return cacheRead(mint, key) || cacheRead(mint, 'max'); }
  function persistCache() { try { config.historyCache = Object.fromEntries(marketHistory); } catch {} try { onHistory(config.historyCache); } catch {} }
  let seriesTimer = null;
  // Many series can finish in one draw; coalesce their redraws into one update.
  function notifySeries() { if (seriesTimer) return; seriesTimer = setTimeout(() => { seriesTimer = null; try { onUpdate(); } catch {} }, 200); seriesTimer.unref?.(); }
  // Resolve a Binance symbol: the curated mapping first, then a one-time
  // `${SYMBOL}USDT` probe for tokens that have a symbol but no mapping. The probe
  // result is remembered so an unknown token is not retried on every draw.
  async function binanceSeriesFor(mint, interval, limit) {
    const market = marketsModule.marketFor(mint);
    const known = market && market.binance;
    const cached = binanceAlias.get(mint);
    const symbol = known || (typeof cached === 'string' ? cached : '');
    if (symbol) {
      try { const points = await providers.binanceHistory(symbol, { fetchImpl, interval, limit }); if (points.length >= 2) return points; } catch {}
      if (!known) binanceAlias.set(mint, false);
      return [];
    }
    if (cached === false || !market || !market.symbol) return [];
    const candidate = `${market.symbol.toUpperCase().replace(/[^A-Z0-9]/g, '')}USDT`;
    try { const points = await providers.binanceHistory(candidate, { fetchImpl, interval, limit }); if (points.length >= 2) { binanceAlias.set(mint, candidate); return points; } } catch {}
    binanceAlias.set(mint, false);
    return [];
  }
  function ensureSeries(mint, key) {
    const cacheKey = `${mint}|${key}`;
    const fresh = cacheRead(mint, key);
    if (fresh && fresh.length >= 2) return Promise.resolve(fresh);
    if (pendingSeries.has(cacheKey)) return pendingSeries.get(cacheKey);
    const promise = (async () => {
      const [interval, limit] = rangeSpec(key);
      let points = await binanceSeriesFor(mint, interval, limit);
      if (!Array.isArray(points) || points.length < 2) {
        const negAt = negative.get(cacheKey);
        if (negAt && now() - negAt < NEGATIVE_TTL) { pendingSeries.delete(cacheKey); return []; }
        try {
          points = await schedule(async () => {
            const market = marketsModule.marketFor(mint);
            let result = await providers.tokenHistory(mint, rangeDays(key), { fetchImpl });
            if (result.length < 2 && market && market.coingecko) result = await providers.coinHistory(market.coingecko, { fetchImpl, days: rangeDays(key) });
            return result;
          });
        } catch {}
        if (!Array.isArray(points) || points.length < 2) { negative.set(cacheKey, now()); pendingSeries.delete(cacheKey); return []; }
      }
      pendingSeries.delete(cacheKey);
      negative.delete(cacheKey);
      marketHistory.set(cacheKey, { at: now(), points });
      persistCache();
      notifySeries();
      return points;
    })();
    pendingSeries.set(cacheKey, promise);
    return promise;
  }
  function sliceRange(points, range) { const ms = RANGE_MS[range] || 0; const cutoff = ms > 0 ? now() - ms : 0; return points.filter(point => point.t >= cutoff); }
  function history(mint, range) {
    const full = cachedSeries(mint, range);
    if (full && full.length >= 2) { const points = downsample(sliceRange(full, range), MAX_POINTS); if (points.length >= 2) return points; }
    ensureSeries(mint, range);
    return series(mint);
  }
  // Aggregates the portfolio over a range. Every priced holding is considered;
  // the top holdings by value are fetched so the chart stays cheap, and the
  // result reports how many holdings it actually covers so the UI can say so.
  function portfolioSeries(range) {
    const holdings = (state.holdings || []).filter(holding => holding.amount > 0).sort((a, b) => (marketsModule.marketFor(b.mint) ? 1 : 0) - (marketsModule.marketFor(a.mint) ? 1 : 0) || b.value - a.value);
    const result = { points: [], covered: 0, considered: 0, holdings: holdings.length, total: Number(state.total || 0), range };
    if (!holdings.length) return result;
    const fetched = holdings.map(holding => { const full = cachedSeries(holding.mint, range); return { amount: holding.amount, points: full ? sliceRange(full, range) : [] }; });
    for (const holding of holdings.slice(0, PORTFOLIO_SERIES_CAP)) ensureSeries(holding.mint, range);
    const valid = fetched.filter(entry => entry.points.length >= 2);
    result.covered = valid.length;
    result.considered = Math.min(holdings.length, PORTFOLIO_SERIES_CAP);
    if (!valid.length) return result;
    const span = valid.map(entry => entry.points[entry.points.length - 1].t - entry.points[0].t).sort((a, b) => b - a)[0];
    const bucketMs = span <= 2 * 864e5 ? 36e5 : span <= 40 * 864e5 ? 864e5 : 7 * 864e5;
    const buckets = new Set();
    for (const entry of valid) for (const point of entry.points) buckets.add(Math.floor(point.t / bucketMs) * bucketMs);
    const cols = [...buckets].sort((a, b) => a - b);
    const filled = valid.map(entry => { let idx = 0, last = null; return cols.map(bucket => { while (idx < entry.points.length && Math.floor(entry.points[idx].t / bucketMs) * bucketMs <= bucket) { last = entry.points[idx].p; idx++; } return last == null ? null : last * entry.amount; }); });
    const out = [];
    for (let i = 0; i < cols.length; i++) { let value = 0, ok = false; for (const col of filled) if (col[i] != null) { value += col[i]; ok = true; } if (ok) out.push({ t: cols[i], p: value }); }
    result.points = downsample(out, MAX_POINTS);
    return result;
  }
  function portfolioHistory(range) { return portfolioSeries(range).points; }
  function start() { if (timer || disposed) return; refresh().catch(() => {}); timer = setInterval(() => refresh().catch(() => {}), intervalMs); timer.unref?.(); }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  function dispose() { disposed = true; stop(); if (seriesTimer) clearTimeout(seriesTimer); }
  return { refresh, start, stop, dispose, snapshot: () => state, series, history, portfolioHistory, portfolioSeries, ready: ensureSeries, shortMint, priceOf: mint => Number(lastPrices[mint] || 0), signals };
}
module.exports = { createWalletManager, normalizeConfig, shortMint, sanitizeHistory, sanitizeHistoryCache, sanitizeResearch, MAX_POINTS, RANGE_DAYS, downsample };
