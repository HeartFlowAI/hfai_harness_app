const { fetchMintSafety, rpcCall, DEFAULT_RPC } = require('./solana');

// Public, key-free endpoints. Kept as constants so they can be swapped or
// upgraded to Helius/Birdeye later without touching callers.
const JUPITER_PRICE = 'https://lite-api.jup.ag/price/v3';
const DEXSCREENER = 'https://api.dexscreener.com/latest/dex';
const TOKEN_BOOSTS = 'https://api.dexscreener.com/token-boosts/top/v1';
const TOKEN_BOOSTS_LATEST = 'https://api.dexscreener.com/token-boosts/latest/v1';
const TOKEN_PROFILES = 'https://api.dexscreener.com/token-profiles/latest/v1';
const TAKEOVERS = 'https://api.dexscreener.com/community-takeovers/latest/v1';
const NARRATIVES = 'https://api.dexscreener.com/metas/trending/v1';
const RUGCHECK = 'https://api.rugcheck.xyz/v1/tokens';
const COINGECKO = 'https://api.coingecko.com/api/v3';
const BINANCE = 'https://api.binance.com/api/v3';

function number(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function pairSummary(pair) {
  const txns = pair.txns || {};
  return {
    dex: pair.dexId || '', chain: pair.chainId || '', url: pair.url || '',
    address: pair.baseToken?.address || '', symbol: pair.baseToken?.symbol || '', name: pair.baseToken?.name || '',
    priceUsd: number(pair.priceUsd), change24h: number(pair.priceChange?.h24),
    change5m: number(pair.priceChange?.m5), change1h: number(pair.priceChange?.h1), change6h: number(pair.priceChange?.h6),
    liquidityUsd: number(pair.liquidity?.usd), volume24h: number(pair.volume?.h24),
    marketCap: number(pair.marketCap || pair.fdv), fdv: number(pair.fdv),
    buys24h: number(txns.h24?.buys), sells24h: number(txns.h24?.sells), createdAt: number(pair.pairCreatedAt)
  };
}
async function jupiterPrices(mints, { fetchImpl = fetch, signal } = {}) {
  const ids = [...new Set((Array.isArray(mints) ? mints : []).filter(Boolean))];
  if (!ids.length) return {};
  const response = await fetchImpl(`${JUPITER_PRICE}?ids=${ids.join(',')}`, { signal });
  if (!response.ok) throw new Error(`Jupiter price responded ${response.status}.`);
  const body = await response.json();
  const quotes = {};
  for (const id of ids) {
    const entry = body?.data?.[id] || body?.[id];
    if (!entry) continue;
    const price = Number(entry.usdPrice ?? entry.price);
    if (!Number.isFinite(price)) continue;
    quotes[id] = { price, change24h: number(entry.priceChange24h ?? entry.change24h) };
  }
  return quotes;
}
async function searchTokens(query, { fetchImpl = fetch, signal } = {}) {
  if (typeof query !== 'string' || !query.trim()) return [];
  const response = await fetchImpl(`${DEXSCREENER}/search?q=${encodeURIComponent(query.trim())}`, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  const body = await response.json();
  const solana = (body?.pairs || []).filter(pair => pair.chainId === 'solana');
  return solana.slice(0, 25).map(pairSummary);
}
async function pairForToken(mint, { fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl(`https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(mint)}`, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  const pairs = await response.json();
  const all = Array.isArray(pairs) ? pairs : [];
  const own = all.filter(pair => pair && pair.baseToken && pair.baseToken.address === mint);
  const best = (own.length ? own : all).sort((a, b) => number(b?.liquidity?.usd) - number(a?.liquidity?.usd))[0];
  return best ? pairSummary(best) : null;
}
// Free price history (hourly points) for majors, used to seed charts so they are
// not empty on first open. CoinGecko ids only cover well-known tokens.
async function marketChart(url, days, { fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl(`${url}?vs_currency=usd&days=${days}`, { signal });
  if (!response.ok) throw new Error(`CoinGecko responded ${response.status}.`);
  const body = await response.json();
  return (body?.prices || []).map(([ms, usd]) => ({ t: Number(ms), p: Number(usd) })).filter(point => point.t > 0 && point.p > 0);
}
function coinHistory(coingeckoId, { fetchImpl = fetch, signal, days = 1 } = {}) {
  return marketChart(`${COINGECKO}/coins/${encodeURIComponent(coingeckoId)}/market_chart`, days, { fetchImpl, signal });
}
// History for any Solana token by mint, via CoinGecko's contract endpoint. Works
// for anything CoinGecko lists; unlisted tokens simply return an empty series.
function tokenHistory(mint, days = 30, { fetchImpl = fetch, signal } = {}) {
  return marketChart(`${COINGECKO}/coins/solana/contract/${encodeURIComponent(mint)}/market_chart`, days, { fetchImpl, signal });
}
const priceHistory = coinHistory;
// Binance public klines: generous limits, no key. Covers tokens with a USDT
// pair and is the primary chart source for those. Returns OHLC plus close as
// `p` so the desk can draw candles without a second request.
async function binanceHistory(symbol, { fetchImpl = fetch, signal, interval = '1d', limit = 1000 } = {}) {
  const response = await fetchImpl(`${BINANCE}/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`, { signal });
  if (!response.ok) throw new Error(`Binance responded ${response.status}.`);
  const rows = await response.json();
  return (Array.isArray(rows) ? rows : [])
    .map(row => ({ t: Number(row[0]), o: Number(row[1]), h: Number(row[2]), l: Number(row[3]), c: Number(row[4]), p: Number(row[4]), v: Number(row[5]) || 0 }))
    .filter(point => point.t > 0 && point.p > 0);
}
// The highest-liquidity pair whose base token is exactly `mint`, so symbol and
// USD price belong to the token we asked about (not the SOL quote side).
async function basePair(mint, { fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl(`https://api.dexscreener.com/tokens/v1/solana/${encodeURIComponent(mint)}`, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  const pairs = await response.json();
  const own = (Array.isArray(pairs) ? pairs : []).filter(pair => pair && pair.baseToken && pair.baseToken.address === mint);
  const best = own.sort((a, b) => number(b?.liquidity?.usd) - number(a?.liquidity?.usd))[0];
  return best ? pairSummary(best) : null;
}
async function pairListFor(addresses, { fetchImpl = fetch, signal, limit = 14 } = {}) {
  const pairs = await Promise.all((addresses || []).slice(0, limit * 2).map(address => basePair(address, { fetchImpl, signal }).catch(() => null)));
  const seen = new Set();
  return pairs.filter(pair => pair && pair.symbol && !seen.has(pair.address) && seen.add(pair.address)).slice(0, limit);
}
// Real trending: DexScreener token boosts (free, no key), Solana only, kept to the
// pairs where the boosted token is the base so each row is a distinct token.
async function trending({ fetchImpl = fetch, signal, limit = 14 } = {}) {
  const response = await fetchImpl(TOKEN_BOOSTS, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  const body = await response.json();
  const solana = (Array.isArray(body) ? body : []).filter(item => item && item.chainId === 'solana' && item.tokenAddress).map(item => item.tokenAddress);
  return pairListFor(solana, { fetchImpl, signal, limit });
}
function solanaAddresses(body) { return (Array.isArray(body) ? body : []).filter(item => item && item.chainId === 'solana' && item.tokenAddress).map(item => item.tokenAddress); }
async function tokenProfiles({ fetchImpl = fetch, signal, limit = 14 } = {}) {
  const response = await fetchImpl(TOKEN_PROFILES, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  return pairListFor(solanaAddresses(await response.json()), { fetchImpl, signal, limit });
}
async function takeovers({ fetchImpl = fetch, signal, limit = 14 } = {}) {
  const response = await fetchImpl(TAKEOVERS, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  return pairListFor(solanaAddresses(await response.json()), { fetchImpl, signal, limit });
}
async function narratives({ fetchImpl = fetch, signal, limit = 24 } = {}) {
  const response = await fetchImpl(NARRATIVES, { signal });
  if (!response.ok) throw new Error(`DexScreener responded ${response.status}.`);
  const body = await response.json();
  return (Array.isArray(body) ? body : []).slice(0, limit).map(meta => ({
    name: String(meta.name || ''), slug: String(meta.slug || ''), description: String(meta.description || '').slice(0, 200),
    marketCap: number(meta.marketCap), liquidity: number(meta.liquidity), volume: number(meta.volume), tokenCount: number(meta.tokenCount),
    change24h: number(meta.marketCapChange?.h24), change1h: number(meta.marketCapChange?.h1)
  }));
}
async function tokenSafety(mint, options = {}) {
  const safety = await fetchMintSafety(mint, options);
  if (!safety) return { known: false, level: 'unknown', flags: [] };
  const flags = [];
  if (!safety.mintRevoked) flags.push('mint authority active');
  if (!safety.freezeRevoked) flags.push('freeze authority active');
  const level = flags.length === 0 ? 'ok' : flags.length === 1 ? 'caution' : 'risk';
  return { known: true, level, flags, mintRevoked: safety.mintRevoked, freezeRevoked: safety.freezeRevoked };
}
// Top holders via RugCheck (free, no key). Falls back to the RPC largest-account
// list when RugCheck has no data. Both are largest-account lists, not unique
// holders; pools and market makers are not excluded, so label it honestly.
async function holders(mint, { fetchImpl = fetch, rpc = DEFAULT_RPC, signal } = {}) {
  try {
    const response = await fetchImpl(`${RUGCHECK}/${encodeURIComponent(mint)}/report`, { signal });
    if (response.ok) {
      const body = await response.json();
      const top = Array.isArray(body?.topHolders) ? body.topHolders : [];
      if (top.length) {
        const accounts = top.slice(0, 20).map(entry => ({
          address: entry.owner || entry.address || '',
          amount: number(entry.uiAmount ?? entry.amount),
          pct: number(entry.pct)
        }));
        return {
          mint, accounts, source: 'rugcheck',
          top1: accounts[0]?.pct || 0,
          top10: accounts.slice(0, 10).reduce((sum, entry) => sum + entry.pct, 0),
          holders: number(body.totalHolders), risks: Array.isArray(body.risks) ? body.risks.map(r => r.name || r.description || String(r)).slice(0, 6) : [], score: number(body.score)
        };
      }
    }
  } catch {}
  const [supply, largest] = await Promise.all([
    rpcCall(rpc, 'getTokenSupply', [mint], { fetchImpl, signal }).catch(() => null),
    rpcCall(rpc, 'getTokenLargestAccounts', [mint], { fetchImpl, signal }).catch(() => null)
  ]);
  const total = Number(supply?.value?.uiAmount || 0) || 0;
  const accounts = (largest?.value || []).slice(0, 20).map(entry => {
    const amount = Number(entry.uiAmount || 0) || 0;
    return { address: entry.address || '', amount, pct: total > 0 ? (amount / total) * 100 : 0 };
  });
  return { mint, accounts, source: 'rpc', total, top1: accounts[0]?.pct || 0, top10: accounts.slice(0, 10).reduce((sum, entry) => sum + entry.pct, 0), holders: 0, risks: [] };
}
module.exports = { JUPITER_PRICE, DEXSCREENER, RUGCHECK, BINANCE, jupiterPrices, searchTokens, pairForToken, priceHistory, coinHistory, tokenHistory, binanceHistory, tokenSafety, holders, trending, tokenProfiles, takeovers, narratives };
