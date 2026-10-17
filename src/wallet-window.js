// Standalone read-only Markets dashboard window.
(() => {
  const $ = id => document.getElementById(id);
  const unwrap = async promise => { const result = await promise; if (!result.ok) throw new Error(result.error); return result.value; };
  const money = value => { const n = Number(value || 0), abs = Math.abs(n); if (abs === 0) return '$0'; const max = abs >= 1 ? 2 : Math.max(2, Math.min(8, Math.ceil(-Math.log10(abs)) + 3)); return `$${n.toLocaleString(undefined, { minimumFractionDigits: abs >= 1 ? 2 : 0, maximumFractionDigits: max })}`; };
  const amount = value => Number(value || 0) >= 1 ? Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 }) : Number(value || 0).toPrecision(4);
  let view = null, chartMint = '';

  function svgLine(points) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 36'); svg.setAttribute('preserveAspectRatio', 'none'); svg.classList.add('spark');
    if (!points || points.length < 2) { const text = document.createElementNS('http://www.w3.org/2000/svg', 'text'); text.setAttribute('x', '2'); text.setAttribute('y', '20'); text.setAttribute('font-size', '6'); text.setAttribute('fill', 'currentColor'); text.textContent = 'collecting price history…'; svg.append(text); return svg; }
    const values = points.map(point => point.p); const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const coords = points.map((point, index) => `${((index / (points.length - 1)) * 100).toFixed(2)},${(34 - ((point.p - min) / span) * 32).toFixed(2)}`).join(' ');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); poly.setAttribute('points', coords); poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', 'currentColor'); poly.setAttribute('stroke-width', '1.2'); poly.setAttribute('vector-effect', 'non-scaling-stroke'); svg.append(poly);
    return svg;
  }
  async function drawChart() {
    const box = $('chart'); if (!box) return;
    const st = view?.state || {}; const mint = chartMint || st.holdings?.[0]?.mint || st.watchlist?.[0]?.mint;
    box.replaceChildren();
    if (!mint) return;
    const symbol = (st.holdings || []).find(h => h.mint === mint)?.symbol || (st.watchlist || []).find(w => w.mint === mint)?.symbol || `${mint.slice(0, 4)}…${mint.slice(-4)}`;
    const label = document.createElement('div'); label.className = 'chart-label'; label.textContent = `Price history · ${symbol}`; box.append(label);
    try { box.append(svgLine(await unwrap(window.walletWindow.series(mint)))); } catch { const note = document.createElement('p'); note.className = 'empty'; note.textContent = 'Chart data unavailable.'; box.append(note); }
  }
  function subhead(text) { const node = document.createElement('div'); node.className = 'subhead'; node.textContent = text; return node; }
  function rowEl(symbol, sub, value, change, mint) {
    const row = document.createElement('div'); row.className = 'row';
    const name = document.createElement('div'); name.className = 'name';
    const strong = document.createElement('strong'); strong.textContent = symbol;
    const small = document.createElement('small'); small.textContent = sub;
    name.append(strong, small);
    const val = document.createElement('div'); val.className = 'val';
    const main = document.createElement('strong'); main.textContent = value;
    const delta = document.createElement('small'); delta.textContent = change ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '';
    val.append(main, delta);
    row.append(name, val);
    if (mint) { row.style.cursor = 'pointer'; row.onclick = () => { chartMint = mint; render(); }; }
    return row;
  }
  function render() {
    const root = $('root'); root.replaceChildren();
    if (!view) return;
    const cfg = view.config || {}, st = view.state || {};
    const total = document.createElement('div'); total.className = 'total';
    const strong = document.createElement('strong'); strong.textContent = cfg.hideBalances ? '••••' : money(st.total);
    const small = document.createElement('small'); small.textContent = `${(st.holdings || []).length} holdings${st.change24h ? ` · ${(st.change24h * 100).toFixed(2)}% 24h` : ''}`;
    total.append(strong, small); root.append(total);
    $('status').textContent = st.loading ? 'Reading your wallet…' : st.error ? st.error : st.updated ? `Updated ${new Date(st.updated).toLocaleTimeString()}` : '';
    const chart = document.createElement('div'); chart.className = 'chart'; chart.id = 'chart'; root.append(chart); drawChart();
    if (!(cfg.addresses || []).length && !(st.watchlist || []).length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No addresses or watchlist yet. Add them in Settings, Wallet in the main window.'; root.append(empty); return; }
    if ((st.holdings || []).length) { root.append(subhead('HOLDINGS')); const list = document.createElement('div'); list.className = 'list'; for (const holding of st.holdings) list.append(rowEl(holding.symbol, amount(holding.amount), cfg.hideBalances ? '••••' : money(holding.value), holding.change24h, holding.mint)); root.append(list); }
    if ((st.watchlist || []).length) { root.append(subhead('WATCHLIST')); const list = document.createElement('div'); list.className = 'list'; for (const item of st.watchlist) list.append(rowEl(item.symbol, 'watched', money(item.price), item.change24h, item.mint)); root.append(list); }
    if ((st.alerts || []).length) { root.append(subhead('ALERTS')); const list = document.createElement('div'); list.className = 'list'; for (const alert of st.alerts) list.append(rowEl(alert.symbol, `${alert.direction} ${money(alert.price)}${alert.triggeredAt ? ' · hit' : ''}`, '', 0)); root.append(list); }
    root.append(subhead('SEARCH'));
    const search = document.createElement('div'); search.className = 'search';
    const input = document.createElement('input'); input.placeholder = 'Search tokens…'; input.setAttribute('aria-label', 'Search tokens');
    const results = document.createElement('div'); results.className = 'list';
    let timer;
    input.oninput = () => { clearTimeout(timer); const query = input.value.trim(); if (!query) { results.replaceChildren(); return; } timer = setTimeout(async () => { results.textContent = 'Searching…'; try { const found = await unwrap(window.walletWindow.search(query)); results.replaceChildren(); for (const token of found.slice(0, 10)) { const row = document.createElement('div'); row.className = 'result'; const name = document.createElement('span'); name.textContent = `${token.symbol} · ${money(token.priceUsd)}`; const change = document.createElement('small'); change.textContent = `${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}%`; row.append(name, change); results.append(row); } if (!found.length) results.textContent = 'No Solana pairs found.'; } catch (error) { results.textContent = error.message; } }, 300); };
    search.append(input); root.append(search, results);
  }
  window.walletWindow.load().then(value => { view = value; render(); }).catch(error => { $('status').textContent = error.message; });
  window.walletWindow.onEvent(event => { if (event.type === 'wallet') { view = event.wallet; render(); } });
  $('refresh').onclick = () => window.walletWindow.refresh().then(value => { view = value; render(); }).catch(error => { $('status').textContent = error.message; });
})();
