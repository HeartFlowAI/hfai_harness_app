// Minimal jsdom harness so the desk (src/workspace.js) can be exercised in node
// tests. It provides just the globals workspace.js touches and stubs window.aurora.
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'workspace.js'), 'utf8');

const SOL = 'So11111111111111111111111111111111111111112';
const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';

function walletFixture(overrides = {}) {
  const markets = [
    { mint: SOL, symbol: 'SOL', name: 'Solana', price: 100, change24h: 1.5 },
    { mint: BONK, symbol: 'BONK', name: 'Bonk', price: 0.0000030404, change24h: -3.09 }
  ];
  return {
    config: { execution: 'paper', addresses: [], limits: {}, mode: 'simple', currency: 'USD' },
    state: { loading: false, error: '', updated: Date.now(), watching: false, total: 0, change24h: 0, holdings: [], watchlist: [], markets, alerts: [] },
    wc: { connected: false, accounts: [] },
    paper: { cash: 1000, initial: 1000, holdingsValue: 0, equity: 1000, totalPnl: 0, realizedPnl: 0, positions: [], orders: [], pending: [], paused: false },
    research: [], strategies: [], limits: {}, executions: [],
    session: { state: 'RUNNING', note: '', needsConfirmation: false },
    vault: [], views: [], theses: [], view: null, signals: [],
    ...overrides
  };
}

const html = `<!doctype html><html><head></head><body><button id="trading-open"></button><button id="wallet-open"></button><textarea id="prompt"></textarea><div id="toast" hidden></div><main></main><div class="main-content"><div class="conversation"></div><div class="companion"></div></div></body></html>`;

function createDesk({ wallet, agent = 'gigi' } = {}) {
  const dom = new JSDOM(html, { url: 'https://aurora.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  const toasts = []; const renderCalls = []; const calls = {};
  let eventHandler = () => {};
  const snapshot = () => ({ currentId: 'c1', agent: 'gigi', messages: [], wallet: window.view.wallet, busy: false });

  window.view = { agent, wallet: wallet || walletFixture() };
  window.toast = message => toasts.push(String(message));
  window.render = data => renderCalls.push(data);
  window.AuroraIcons = { icon: () => window.document.createElementNS('http://www.w3.org/2000/svg', 'svg') };
  window.AuroraMarkdown = { render: (el, md) => { el.textContent = md; } };
  window.CSS = window.CSS || {}; if (!window.CSS.escape) window.CSS.escape = value => String(value).replace(/[^a-zA-Z0-9_-]/g, ch => `\\${ch}`);
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  window.URL.createObjectURL = () => 'blob:mock'; window.URL.revokeObjectURL = () => {};
  try { Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: async () => {} }, configurable: true }); } catch {}

  const ok = value => Promise.resolve({ ok: true, value });
  const track = name => { calls[name] = (calls[name] || 0) + 1; };
  const method = (name, valueFn) => (...args) => { track(name); return ok(valueFn ? valueFn(...args) : snapshot()); };

  const aurora = {
    load: method('load'), walletRefresh: method('walletRefresh'),
    walletTokenInfo: method('walletTokenInfo', () => ({ mint: SOL, pair: { address: SOL, symbol: 'SOL', name: 'Solana', priceUsd: 100, change24h: 1.5, liquidityUsd: 5e6, volume24h: 2e6, marketCap: 1e9 }, safety: { level: 'ok', flags: [] } })),
    walletSeries: method('walletSeries', () => Array.from({ length: 40 }, (_, i) => ({ t: Date.now() - (40 - i) * 36e5, o: 99 + i * 0.1, h: 100 + i * 0.1, l: 98 + i * 0.1, c: 99.5 + i * 0.1, p: 99.5 + i * 0.1, v: 1000 + i }))),
    walletPortfolioSeries: method('walletPortfolioSeries', () => ({ points: [], covered: 0, considered: 0, holdings: 0, total: 0, range: '30D' })),
    walletHolders: method('walletHolders', () => ({ mint: SOL, holders: 12345, top1: 8.8, top10: 38.3, risks: ['Low liquidity'], accounts: [{ address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', amount: 1000, pct: 8.83 }, { address: '51yZyDSnec4xnUv7XLRVYcDyV4x3wUtzrDcRaYbmQU5j', amount: 500, pct: 6.79 }] })),
    walletSearch: method('walletSearch', () => []), walletTrending: method('walletTrending', () => []),
    walletWatchlistAdd: method('walletWatchlistAdd'), walletWatchlistRemove: method('walletWatchlistRemove'),
    walletAlertAdd: method('walletAlertAdd'), walletAlertRemove: method('walletAlertRemove'),
    walletPaperBuy: method('walletPaperBuy'), walletPaperSell: method('walletPaperSell'), walletPaperReset: method('walletPaperReset'), walletPaperCondition: method('walletPaperCondition'), walletPaperCancel: method('walletPaperCancel'),
    walletResearchStart: method('walletResearchStart'), walletResearchCancel: method('walletResearchCancel'), walletResearchRemove: method('walletResearchRemove'), walletResearchReport: method('walletResearchReport', () => ({ report: '# Report\n\n- fact' })),
    walletStrategySave: method('walletStrategySave'), walletStrategyRemove: method('walletStrategyRemove'), walletStrategyStatus: method('walletStrategyStatus'), walletStrategyRun: method('walletStrategyRun', () => ({ executed: false })),
    walletSwapPreview: method('walletSwapPreview'), walletSwapExecute: method('walletSwapExecute'),
    walletSessionPause: method('walletSessionPause'), walletSessionResume: method('walletSessionResume'), walletSessionReconcile: method('walletSessionReconcile'),
    walletVaultGenerate: method('walletVaultGenerate'), walletVaultImport: method('walletVaultImport'), walletVaultRemove: method('walletVaultRemove'),
    walletViewShow: method('walletViewShow', () => ({ view: { id: 'v1', type: 'line', title: 'X' } })), walletViewPin: method('walletViewPin'), walletViewRemove: method('walletViewRemove'),
    walletThesisSave: method('walletThesisSave'), walletThesisRemove: method('walletThesisRemove'), walletThesisActivate: method('walletThesisActivate'), walletThesisShare: method('walletThesisShare', () => ({ text: 'call' })),
    walletSignalSave: method('walletSignalSave'), walletSignalRemove: method('walletSignalRemove'), walletSignalToggle: method('walletSignalToggle'),
    walletConfig: method('walletConfig'), walletLimits: method('walletLimits'),
    walletAddressAdd: method('walletAddressAdd'), walletAddressRemove: method('walletAddressRemove'),
    walletWcConnect: method('walletWcConnect', () => ({ uri: 'wc:test' })), walletWcDisconnect: method('walletWcDisconnect'),
    onEvent: handler => { eventHandler = handler; }
  };
  window.aurora = aurora;

  window.eval(SOURCE);

  const flush = async (n = 6) => { for (let i = 0; i < n; i++) await new Promise(resolve => setTimeout(resolve, 0)); };
  const tab = name => window.document.querySelector(`#ws-tabs .hf-tab[data-ws=${name}]`);
  return { window, document: window.document, toasts, renderCalls, calls, eventHandler: () => eventHandler, flush, tab };
}

module.exports = { createDesk, walletFixture, SOL, BONK };
