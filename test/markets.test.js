const { test } = require('node:test'), assert = require('node:assert/strict');
const markets = require('../src/wallet/markets');
const providers = require('../src/wallet/providers');

test('markets list is well formed and SOL is present', () => {
  const list = markets.listMarkets();
  assert.ok(list.length >= 8);
  assert.ok(list.every(m => typeof m.mint === 'string' && m.symbol && m.name));
  assert.ok(list.some(m => m.mint === 'So11111111111111111111111111111111111111112' && m.symbol === 'SOL'));
  assert.equal(markets.mintSet().size, list.length);
  assert.equal(markets.marketFor('So11111111111111111111111111111111111111112').symbol, 'SOL');
  assert.equal(markets.marketFor('unknown'), null);
});

test('priceHistory maps CoinGecko points and drops bad rows', async () => {
  const fetchImpl = async url => { assert.match(url, /api\.coingecko\.com\/api\/v3\/coins\/solana\/market_chart/); return { ok: true, json: async () => ({ prices: [[1000, 1.5], [2000, 0], [3000, 2.25]] }) }; };
  const points = await providers.priceHistory('solana', { fetchImpl });
  assert.deepEqual(points, [{ t: 1000, p: 1.5 }, { t: 3000, p: 2.25 }]);
});

test('priceHistory throws on a bad response', async () => {
  const fetchImpl = async () => ({ ok: false, status: 429 });
  await assert.rejects(() => providers.priceHistory('solana', { fetchImpl }), /429/);
});

test('tokenHistory reads CoinGecko contract history by mint', async () => {
  const fetchImpl = async url => { assert.match(url, /coins\/solana\/contract\/So11111111111111111111111111111111111111112\/market_chart\?vs_currency=usd&days=90/); return { ok: true, json: async () => ({ prices: [[1000, 2], [2000, 3]] }) }; };
  const points = await providers.tokenHistory('So11111111111111111111111111111111111111112', 90, { fetchImpl });
  assert.deepEqual(points, [{ t: 1000, p: 2 }, { t: 2000, p: 3 }]);
});

test('holders prefers RugCheck and reports holder count and risks', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ totalHolders: 12345, risks: [{ name: 'Low liquidity' }], topHolders: [{ owner: 'WalletAAA', uiAmount: 30, pct: 30 }, { owner: 'WalletBBB', uiAmount: 20, pct: 20 }] }) });
  const info = await providers.holders('MintAAA', { fetchImpl });
  assert.equal(info.source, 'rugcheck');
  assert.equal(info.holders, 12345);
  assert.equal(info.top10, 50);
  assert.equal(info.accounts[0].address, 'WalletAAA');
  assert.deepEqual(info.risks, ['Low liquidity']);
});

test('binanceHistory maps klines to OHLCV points and drops bad rows', async () => {
  const fetchImpl = async url => { assert.match(url, /api\.binance\.com\/api\/v3\/klines\?symbol=SOLUSDT&interval=1h&limit=168/); return { ok: true, json: async () => [[1000, '1', '2', '0.5', '1.5', '120'], [2000, '1', '2', '0.5', '0', '5'], [3000, '1', '2.5', '0.5', '2.5', '80']] }; };
  const points = await providers.binanceHistory('SOLUSDT', { fetchImpl, interval: '1h', limit: 168 });
  assert.deepEqual(points, [{ t: 1000, o: 1, h: 2, l: 0.5, c: 1.5, p: 1.5, v: 120 }, { t: 3000, o: 1, h: 2.5, l: 0.5, c: 2.5, p: 2.5, v: 80 }]);
});

test('trending reads Solana token boosts and enriches each with its best pair', async () => {  const fetchImpl = async url => {
    const u = String(url);
    if (u.includes('token-boosts/top')) return { ok: true, json: async () => [{ chainId: 'solana', tokenAddress: 'MintBoosts' }, { chainId: 'ethereum', tokenAddress: '0xdead' }] };
    if (u.includes('/tokens/v1/solana/MintBoosts')) return { ok: true, json: async () => [{ chainId: 'solana', dexId: 'raydium', baseToken: { address: 'MintBoosts', symbol: 'BOOST', name: 'Boosted' }, priceUsd: '0.5', priceChange: { h24: '12' }, liquidity: { usd: '50000' }, volume: { h24: '9000' }, marketCap: '1000000' }] };
    throw new Error('unexpected ' + u);
  };
  const items = await providers.trending({ fetchImpl });
  assert.equal(items.length, 1);
  assert.equal(items[0].symbol, 'BOOST');
  assert.equal(items[0].priceUsd, 0.5);
});

test('tokenProfiles and takeovers resolve Solana addresses to base pairs', async () => {
  const fetchImpl = async url => {
    const u = String(url);
    if (u.includes('token-profiles/latest')) return { ok: true, json: async () => [{ chainId: 'solana', tokenAddress: 'MintP' }, { chainId: 'ethereum', tokenAddress: '0x' }] };
    if (u.includes('community-takeovers/latest')) return { ok: true, json: async () => [{ chainId: 'solana', tokenAddress: 'MintT' }] };
    if (u.includes('/tokens/v1/solana/MintP')) return { ok: true, json: async () => [{ chainId: 'solana', dexId: 'pumpswap', baseToken: { address: 'MintP', symbol: 'PROF', name: 'Profile' }, priceUsd: '0.01', priceChange: { h24: '5' }, liquidity: { usd: '20000' }, volume: { h24: '3000' }, marketCap: '500000', txns: { h24: { buys: 10, sells: 4 } }, pairCreatedAt: 1700000000000 }] };
    if (u.includes('/tokens/v1/solana/MintT')) return { ok: true, json: async () => [{ chainId: 'solana', dexId: 'raydium', baseToken: { address: 'MintT', symbol: 'TAKE', name: 'Takeover' }, priceUsd: '2', priceChange: { h24: '-3' }, liquidity: { usd: '80000' }, volume: { h24: '9000' }, marketCap: '4000000' }] };
    throw new Error('unexpected ' + u);
  };
  const profiles = await providers.tokenProfiles({ fetchImpl });
  const takes = await providers.takeovers({ fetchImpl });
  assert.equal(profiles[0].symbol, 'PROF');
  assert.equal(profiles[0].buys24h, 10);
  assert.equal(profiles[0].createdAt, 1700000000000);
  assert.equal(takes[0].symbol, 'TAKE');
});

test('narratives maps DexScreener metas with 24h change', async () => {
  const fetchImpl = async url => { assert.match(url, /metas\/trending\/v1/); return { ok: true, json: async () => [{ name: 'AI', slug: 'ai', description: 'agents', marketCap: 1000000000, liquidity: 5000000, volume: 20000000, tokenCount: 120, marketCapChange: { h24: 12.5, h1: 2 } }] }; };
  const list = await providers.narratives({ fetchImpl });
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'AI');
  assert.equal(list[0].change24h, 12.5);
  assert.equal(list[0].tokenCount, 120);
});
