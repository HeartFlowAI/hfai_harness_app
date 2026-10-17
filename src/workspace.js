// Gigi's Solana desk: an AI market canvas plus portfolio, trade, discover,
// research, strategies and journal. Mounts inside <main> so the app sidebar
// stays. Built on ui.css components and the AuroraIcons set. Gigi only.
(() => {
  const el = id => document.getElementById(id);
  const wallet = () => (typeof view !== 'undefined' && view.wallet) ? view.wallet : null;
  const cfg = () => wallet()?.config || {};
  const state = () => wallet()?.state || {};
  const paper = () => wallet()?.paper || null;
  const money = v => { const n = Number(v || 0), abs = Math.abs(n); if (abs === 0) return '$0'; const max = abs >= 1 ? 2 : Math.max(2, Math.min(8, Math.ceil(-Math.log10(abs)) + 3)); return `$${n.toLocaleString(undefined, { minimumFractionDigits: abs >= 1 ? 2 : 0, maximumFractionDigits: max })}`; };
  const amount = v => Number(v || 0) >= 1 ? Number(v).toLocaleString(undefined, { maximumFractionDigits: 4 }) : Number(v || 0).toPrecision(4);
  const num = v => { if (v === null || v === undefined || v === '') return ''; const n = Number(v); if (!Number.isFinite(n)) return String(v); return n.toLocaleString(undefined, { maximumFractionDigits: Math.abs(n) >= 1 ? 2 : 8 }); }; 
  const short = m => typeof m === 'string' && m.length > 10 ? `${m.slice(0, 4)}…${m.slice(-4)}` : String(m || '');
  const sym = (m, st) => (st?.holdings || []).find(h => h.mint === m)?.symbol || (st?.markets || []).find(x => x.mint === m)?.symbol || (st?.watchlist || []).find(w => w.mint === m)?.symbol || short(m);
  const call2 = promise => promise.then(result => result.ok ? result.value : Promise.reject(Error(result.error)));
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const svgEl = tag => document.createElementNS('http://www.w3.org/2000/svg', tag);
  const ic = (name, size = 16) => window.AuroraIcons.icon(name, size);

  const persisted = (() => { try { return JSON.parse(localStorage.getItem('aurora-desk-v2') || '{}') || {}; } catch { return {}; } })();
  const savePrefs = () => { try { localStorage.setItem('aurora-desk-v2', JSON.stringify({ section, chatW, chatOpen, tradeCandles, tradeSide, tradeType, tradeTab, discoverTab })); } catch {} };
  const SECTIONS = [['canvas', 'Canvas', 'chat'], ['portfolio', 'Portfolio', 'portfolio'], ['trade', 'Trade', 'trade'], ['discover', 'Discover', 'discover'], ['watch', 'Watch', 'watch'], ['research', 'Research', 'research'], ['strategies', 'Strategies', 'strategies'], ['journal', 'Journal', 'journal']];
  let section = SECTIONS.some(x => x[0] === persisted.section) ? persisted.section : 'canvas';
  let chatW = persisted.chatW || 400, chatOpen = persisted.chatOpen === true;
  let open = false, chartMint = '', pfChartMint = '', reportOpen = '', reportText = '';
  let pfRange = '30D', tradeRange = '7D', tradeCandles = persisted.tradeCandles !== false, journalKind = 'all', journalFilter = '';
  let tradeSide = persisted.tradeSide === 'sell' ? 'sell' : 'buy', tradeType = ['limit', 'stop', 'stopLimit', 'trailing', 'oco'].includes(persisted.tradeType) ? persisted.tradeType : 'market';
  let tradeTab = ['fills', 'holders'].includes(persisted.tradeTab) ? persisted.tradeTab : 'orders';
  let pfSort = { key: 'value', dir: -1 }, pfFilter = '';
  const tokenCache = new Map();
  const holdersCache = new Map();
  const discover = { items: {}, loading: {}, error: {} };
  let discoverTab = ['new', 'takeovers', 'narratives'].includes(persisted.discoverTab) ? persisted.discoverTab : 'trending';
  let discoverQuery = '', discoverMinLiq = 0, discoverSort = { key: 'volume24h', dir: -1 }, watchMint = '';

  const ws = mk('div'); ws.id = 'trading-workspace'; ws.hidden = true;
  ws.innerHTML = `<header class="ws-top"><div class="ws-brand"><img src="assets/agents/gigi.webp" alt=""><div><strong><span class="dot"></span>Gigi</strong><small id="ws-conn">Solana desk</small></div></div><label class="ws-search"><span class="ws-search-ico"></span><input id="ws-search" type="search" placeholder="Search tokens by name or mint" maxlength="60" aria-label="Search tokens"><kbd>⌘K</kbd></label><div class="ws-search-results" id="ws-search-results" hidden></div><span class="ws-top-spacer"></span><div class="ws-seg" id="ws-seg"><button data-exec="paper">Paper</button><button data-exec="live">Live</button></div><button id="ws-chat-visible" class="hf-btn ghost" type="button">Chat</button><button id="ws-settings" class="hf-btn ghost" type="button">Settings</button><button id="ws-close" class="hf-btn" type="button">Back to chat</button></header><nav class="ws-tabs hf-tabs" id="ws-tabs" role="tablist" aria-label="Trading sections"></nav><div class="ws-split" id="ws-split"><div class="ws-content" id="ws-content"></div><aside class="ws-chat" id="ws-chat" role="complementary"><div class="ws-resizer" id="ws-resizer" role="separator" aria-label="Resize chat"></div><div class="ws-chat-head"><img src="assets/agents/gigi.webp" alt=""><div><strong>Gigi</strong> <small>markets sister</small></div><span class="ws-chat-spacer"></span><button class="hf-btn icon sm" id="ws-chat-collapse" type="button" title="Collapse chat"></button></div><div class="ws-chat-slot" id="ws-chat-slot"></div></aside></div><div class="ws-palette" id="ws-palette" hidden><div class="ws-palette-box"><input id="ws-palette-input" class="hf-input" placeholder="Search tokens or type a command…" aria-label="Command palette" autocomplete="off"><div class="ws-list" id="ws-palette-list"></div></div></div>`;
  (document.querySelector('main') || document.body).append(ws);
  const content = ws.querySelector('#ws-content'); const tabs = ws.querySelector('#ws-tabs'); const results = ws.querySelector('#ws-search-results'); const split = ws.querySelector('#ws-split'); const chat = ws.querySelector('#ws-chat');
  const palette = ws.querySelector('#ws-palette'); const paletteInput = ws.querySelector('#ws-palette-input'); const paletteList = ws.querySelector('#ws-palette-list');
  ws.querySelector('.ws-search-ico').append(ic('discover', 14));
  ws.querySelector('#ws-chat-collapse').append(ic('chevron', 14));

  for (const [id, label, iconName] of SECTIONS) { const b = mk('button', 'hf-tab'); b.type = 'button'; b.dataset.ws = id; b.setAttribute('role', 'tab'); if (id === section) b.setAttribute('aria-selected', 'true'); b.append(ic(iconName, 15), mk('span', '', label)); if (id === 'portfolio') b.append(mk('span', 'hf-badge', '0')); if (id === 'watch') b.append(Object.assign(mk('span', 'hf-badge', '0'), { hidden: true })); if (id === 'research') b.append(Object.assign(mk('span', 'hf-badge', '0'), { hidden: true })); b.onclick = () => { section = id; results.hidden = true; savePrefs(); draw(); }; b.onkeydown = e => { if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return; e.preventDefault(); const list = [...tabs.querySelectorAll('.hf-tab')]; const i = list.indexOf(e.currentTarget); const next = list[(i + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length]; next.click(); next.focus(); }; tabs.append(b); }

  const btn = (label, opts = {}, fn) => { const b = mk('button', `hf-btn${opts.variant ? ' ' + opts.variant : ''}${opts.sm ? ' sm' : ''}`); b.type = 'button'; if (opts.icon) b.append(ic(opts.icon, opts.sm ? 14 : 15)); if (label) b.append(mk('span', '', label)); b.onclick = fn; b.disabled = opts.disabled === true; if (opts.title) b.title = opts.title; return b; };
  const ibtn = (iconName, tip, fn) => { const b = mk('button', 'hf-btn icon sm hf-tooltip'); b.type = 'button'; b.append(ic(iconName, 15)); b.setAttribute('aria-label', tip); b.dataset.tip = tip; b.onclick = fn; return b; };
  function panel(title, opts = {}, ...body) { const p = mk('div', `hf-panel${opts.flush ? ' flush' : ''}`); if (title) { const h = mk('header'); h.append(mk('h3', '', title)); if (opts.actions) h.append(...(Array.isArray(opts.actions) ? opts.actions : [opts.actions])); p.append(h); } const b = mk('div', 'hf-body'); b.append(...body); p.append(b); return p; }
  const emptyState = (mark, title, hint) => { const e = mk('div', 'hf-empty'); const m = mk('div', 'hf-empty-mark'); m.append(ic(mark, 22)); e.append(m, mk('strong', '', title), mk('small', '', hint || '')); return e; };
  const skeleton = (rows = 4) => { const box = mk('div', 'ws-list'); for (let i = 0; i < rows; i++) { const s = mk('div', 'hf-skeleton'); s.style.width = `${70 + (i % 3) * 10}%`; box.append(s); } return box; };
  const safeCls = level => `hf-safety-${level || 'unknown'}`;
  const isSnapshot = data => !!data && typeof data === 'object' && typeof data.currentId === 'string';
  const run = fn => async () => { try { const data = await fn(); if (isSnapshot(data)) window.render(data); } catch (error) { window.toast(error.message); } };
  const askGigi = text => { const p = el('prompt'); if (p) { p.value = text; p.focus(); } };

  function selectToken(mint) { chartMint = mint; if (!tokenCache.has(mint)) { tokenCache.set(mint, { loading: true }); call2(window.aurora.walletTokenInfo(mint)).then(info => { tokenCache.set(mint, info); if (open) draw(); }).catch(error => { tokenCache.set(mint, { error: error.message }); if (open) draw(); }); } if (open) draw(); }
  function enterAnimation() { ws.classList.remove('ws-entering'); void ws.offsetWidth; ws.classList.add('ws-entering'); setTimeout(() => ws.classList.remove('ws-entering'), 520); }
  function openWorkspace(animate) { if (open) { if (animate) enterAnimation(); return; } if (typeof view !== 'undefined' && view.agent !== 'gigi') { window.toast('The trading desk is Gigi’s. Switch to Gigi first.'); return; } open = true; ws.hidden = false; const conversation = document.querySelector('.conversation'); if (conversation) el('ws-chat-slot').append(conversation); el('trading-open')?.setAttribute('aria-current', 'page'); if (animate) enterAnimation(); draw(); call2(window.aurora.load()).then(snapshot => { if (open && snapshot && snapshot.wallet && typeof view !== 'undefined') { view.wallet = snapshot.wallet; draw(); } }).catch(() => {}); call2(window.aurora.walletRefresh()).catch(() => {}); }
  function close() { if (!open) return; open = false; ws.hidden = true; palette.hidden = true; el('trading-open')?.removeAttribute('aria-current'); const conversation = document.querySelector('.conversation'); const mainContent = document.querySelector('.main-content'); if (conversation && mainContent) mainContent.insertBefore(conversation, mainContent.querySelector('.companion')); }

  const seriesOf = (mint, range) => call2(window.aurora.walletSeries(mint, range)).catch(() => []);
  const RANGES = ['1D', '7D', '30D', '3M', '6M', '1Y', 'ALL'];
  function rangeBar(current, onPick) { const bar = mk('div', 'ws-seg ws-ranges'); for (const r of RANGES) { const b = mk('button', r === current ? 'active' : '', r); b.type = 'button'; b.setAttribute('aria-pressed', String(r === current)); b.onclick = () => onPick(r); bar.append(b); } return bar; }
  function trend(points) { if (!points || points.length < 2) return null; const a = points[0].p, b = points[points.length - 1].p; if (!(a > 0)) return null; return { change: (b - a) / a * 100, from: a, to: b }; }
  function sparkline(points, width = 64, height = 18) { const svg = svgEl('svg'); svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('width', width); svg.setAttribute('height', height); if (!points || points.length < 2) return svg; const vs = points.map(p => p.p); const min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1; const poly = svgEl('polyline'); poly.setAttribute('points', points.map((p, i) => `${((i / (points.length - 1)) * width).toFixed(1)},${(height - 1 - ((p.p - min) / span) * (height - 2)).toFixed(1)}`).join(' ')); poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', 'currentColor'); poly.setAttribute('stroke-width', '1.2'); poly.setAttribute('vector-effect', 'non-scaling-stroke'); svg.append(poly); return svg; }
  const compact = v => { const n = Number(v) || 0, a = Math.abs(n); if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`; if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`; if (a >= 1e3) return `${(n / 1e3).toFixed(2)}k`; return a >= 1 ? n.toFixed(2) : n.toPrecision(3); };
  const axisPrice = v => compact(v);
  const fmtTime = (t, span) => { const d = new Date(t); return span <= 2 * 864e5 ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : span <= 120 * 864e5 ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : d.toLocaleDateString([], { month: 'short', year: '2-digit' }); };
  const fmtFull = t => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  function drawChart(box, points, height = 260) { box.replaceChildren(); if (!points || points.length < 2) { box.append(mk('div', 'ws-sub', 'No price history yet. Try another range, or a token listed on Binance or CoinGecko.')); return; } const svg = svgEl('svg'); const H = 40; svg.setAttribute('viewBox', `0 0 100 ${H}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('role', 'img'); svg.style.height = `${height}px`; const vs = points.map(p => p.p); const min = Math.min(...vs), max = Math.max(...vs), span = max - min || 1; const line = points.map((p, i) => `${((i / (points.length - 1)) * 100).toFixed(2)},${(H - 4 - ((p.p - min) / span) * (H - 8)).toFixed(2)}`).join(' '); const area = svgEl('polygon'); area.setAttribute('points', `0,${H} ${line} 100,${H}`); area.setAttribute('fill', 'currentColor'); area.setAttribute('opacity', '.09'); svg.append(area); const poly = svgEl('polyline'); poly.setAttribute('points', line); poly.setAttribute('fill', 'none'); poly.setAttribute('stroke', 'currentColor'); poly.setAttribute('stroke-width', '1.2'); poly.setAttribute('vector-effect', 'non-scaling-stroke'); svg.append(poly); const t = trend(points); const last = vs[vs.length - 1]; svg.setAttribute('aria-label', `Price low ${money(min)}, high ${money(max)}, last ${money(last)}${t ? `, ${t.change >= 0 ? 'up' : 'down'} ${Math.abs(t.change).toFixed(2)} percent` : ''}`); box.append(svg); const meta = mk('div', 'ws-chart-meta'); meta.append(mk('span', '', `Low ${money(min)}`), mk('span', '', `High ${money(max)}`), mk('span', '', `Last ${money(last)}`)); if (t) meta.append(mk('span', t.change >= 0 ? 'hf-up' : 'hf-down', `${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)}%`)); box.append(meta); }

  // TradingView-inspired candlesticks: price axis, time axis, volume histogram,
  // a last-price tag and a hover crosshair with an OHLC readout.
  function drawCandles(box, points, height = 340) {
    box.replaceChildren();
    if (!points || points.length < 2) { box.append(mk('div', 'ws-sub', 'No candles yet. Try another range, or a token listed on Binance.')); return; }
    const width = Math.max(360, Math.round(box.getBoundingClientRect().width || box.clientWidth || 720));
    const padL = 6, padR = 62, padT = 12, padB = 22;
    const plotW = Math.max(60, width - padL - padR);
    const hasVol = points.some(p => Number(p.v) > 0);
    const volH = hasVol ? Math.max(26, Math.round((height - padT - padB) * 0.18)) : 0;
    const priceH = (height - padT - padB) - (hasVol ? volH + 8 : 0);
    const lows = points.map(p => p.l ?? p.p), highs = points.map(p => p.h ?? p.p);
    let lo = Math.min(...lows), hi = Math.max(...highs);
    if (!(hi > lo)) hi = lo + (Math.abs(lo) * 0.01 || 1);
    const padding = (hi - lo) * 0.06; lo -= padding; hi += padding;
    const yOf = v => padT + priceH - ((v - lo) / (hi - lo)) * priceH;
    const step = plotW / points.length;
    const bodyW = Math.max(1, Math.min(step * 0.66, 16));
    const span = points[points.length - 1].t - points[0].t;
    const svg = svgEl('svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('width', String(width)); svg.setAttribute('height', String(height));
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `Candlestick chart, ${points.length} candles, low ${money(lo)}, high ${money(hi)}, last ${money(points[points.length - 1].p)}`);
    for (let i = 0; i <= 4; i++) {
      const price = lo + (hi - lo) * (i / 4), y = yOf(price);
      const line = svgEl('line'); line.setAttribute('x1', padL); line.setAttribute('x2', padL + plotW); line.setAttribute('y1', y); line.setAttribute('y2', y); line.setAttribute('stroke', 'var(--line)'); line.setAttribute('stroke-width', '1'); line.setAttribute('vector-effect', 'non-scaling-stroke'); line.setAttribute('opacity', i === 0 || i === 4 ? '.7' : '.4'); svg.append(line);
      const label = svgEl('text'); label.setAttribute('x', width - padR + 8); label.setAttribute('y', y + 3); label.setAttribute('fill', 'var(--faint)'); label.setAttribute('font-size', '10'); label.setAttribute('font-family', 'ui-monospace, Consolas, monospace'); label.textContent = axisPrice(price); svg.append(label);
    }
    const ticks = Math.max(2, Math.min(6, Math.floor(plotW / 120)));
    for (let i = 0; i <= ticks; i++) {
      const x = padL + (plotW * i) / ticks;
      const line = svgEl('line'); line.setAttribute('x1', x); line.setAttribute('x2', x); line.setAttribute('y1', padT); line.setAttribute('y2', height - padB); line.setAttribute('stroke', 'var(--line)'); line.setAttribute('stroke-width', '1'); line.setAttribute('vector-effect', 'non-scaling-stroke'); line.setAttribute('opacity', '.28'); svg.append(line);
      const idx = Math.min(points.length - 1, Math.round((i / ticks) * (points.length - 1)));
      const label = svgEl('text'); label.setAttribute('x', x); label.setAttribute('y', height - padB + 14); label.setAttribute('fill', 'var(--faint)'); label.setAttribute('font-size', '10'); label.setAttribute('text-anchor', i === 0 ? 'start' : i === ticks ? 'end' : 'middle'); label.textContent = fmtTime(points[idx].t, span); svg.append(label);
    }
    if (hasVol) {
      const maxV = Math.max(...points.map(p => Number(p.v) || 0)) || 1, baseY = height - padB;
      for (let i = 0; i < points.length; i++) { const p = points[i], v = Number(p.v) || 0; if (!(v > 0)) continue; const h = (v / maxV) * volH; const rect = svgEl('rect'); rect.setAttribute('x', padL + i * step + (step - bodyW) / 2); rect.setAttribute('width', bodyW); rect.setAttribute('y', baseY - h); rect.setAttribute('height', h); rect.setAttribute('fill', (p.c ?? p.p) >= (p.o ?? p.p) ? 'var(--live)' : 'var(--loss)'); rect.setAttribute('opacity', '.26'); svg.append(rect); }
    }
    for (let i = 0; i < points.length; i++) {
      const p = points[i], o = p.o ?? p.p, c = p.c ?? p.p, h = p.h ?? p.p, l = p.l ?? p.p;
      const color = c >= o ? 'var(--live)' : 'var(--loss)';
      const cx = padL + i * step + step / 2;
      const wick = svgEl('line'); wick.setAttribute('x1', cx); wick.setAttribute('x2', cx); wick.setAttribute('y1', yOf(h)); wick.setAttribute('y2', yOf(l)); wick.setAttribute('stroke', color); wick.setAttribute('stroke-width', '1'); wick.setAttribute('vector-effect', 'non-scaling-stroke'); svg.append(wick);
      const yo = yOf(o), yc = yOf(c); const body = svgEl('rect'); body.setAttribute('x', cx - bodyW / 2); body.setAttribute('y', Math.min(yo, yc)); body.setAttribute('width', bodyW); body.setAttribute('height', Math.max(Math.abs(yc - yo), 1)); body.setAttribute('fill', color); body.setAttribute('rx', '1'); svg.append(body);
    }
    const lastClose = points[points.length - 1].p, ly = yOf(lastClose);
    const lastLine = svgEl('line'); lastLine.setAttribute('x1', padL); lastLine.setAttribute('x2', padL + plotW); lastLine.setAttribute('y1', ly); lastLine.setAttribute('y2', ly); lastLine.setAttribute('stroke', 'var(--accent)'); lastLine.setAttribute('stroke-width', '1'); lastLine.setAttribute('stroke-dasharray', '3 3'); lastLine.setAttribute('vector-effect', 'non-scaling-stroke'); lastLine.setAttribute('opacity', '.75'); svg.append(lastLine);
    const tag = svgEl('rect'); tag.setAttribute('x', width - padR + 2); tag.setAttribute('y', ly - 8); tag.setAttribute('width', padR - 6); tag.setAttribute('height', 16); tag.setAttribute('rx', '3'); tag.setAttribute('fill', 'var(--accent)'); svg.append(tag);
    const tagText = svgEl('text'); tagText.setAttribute('x', width - padR + 8); tagText.setAttribute('y', ly + 3); tagText.setAttribute('fill', 'var(--accent-ink)'); tagText.setAttribute('font-size', '10'); tagText.setAttribute('font-family', 'ui-monospace, Consolas, monospace'); tagText.textContent = axisPrice(lastClose); svg.append(tagText);
    const cross = svgEl('g'); cross.setAttribute('opacity', '0'); const cxLine = svgEl('line'), cyLine = svgEl('line'); for (const line of [cxLine, cyLine]) { line.setAttribute('stroke', 'var(--muted)'); line.setAttribute('stroke-width', '1'); line.setAttribute('stroke-dasharray', '3 3'); line.setAttribute('vector-effect', 'non-scaling-stroke'); } cross.append(cxLine, cyLine); svg.append(cross);
    box.append(svg);
    const tip = mk('div', 'ws-candle-tip'); tip.hidden = true; box.append(tip);
    const hide = () => { cross.setAttribute('opacity', '0'); tip.hidden = true; };
    svg.addEventListener('pointermove', event => {
      const rect = svg.getBoundingClientRect(); if (!rect.width) return;
      const xIn = (event.clientX - rect.left) / rect.width * width;
      const idx = Math.max(0, Math.min(points.length - 1, Math.floor((xIn - padL) / step)));
      const p = points[idx], o = p.o ?? p.p, c = p.c ?? p.p, h = p.h ?? p.p, l = p.l ?? p.p;
      const px = padL + idx * step + step / 2, py = yOf(c);
      cxLine.setAttribute('x1', px); cxLine.setAttribute('x2', px); cxLine.setAttribute('y1', padT); cxLine.setAttribute('y2', height - padB);
      cyLine.setAttribute('x1', padL); cyLine.setAttribute('x2', padL + plotW); cyLine.setAttribute('y1', py); cyLine.setAttribute('y2', py);
      cross.setAttribute('opacity', '1');
      tip.replaceChildren(mk('b', '', fmtFull(p.t)));
      const grid = mk('div', 'ws-tip-grid'); for (const [k, v] of [['O', o], ['H', h], ['L', l], ['C', c]]) grid.append(mk('span', '', k), mk('strong', '', money(v)));
      if (Number(p.v) > 0) grid.append(mk('span', '', 'Vol'), mk('strong', '', compact(p.v)));
      const ch = o > 0 ? (c - o) / o * 100 : 0;
      tip.append(grid, mk('span', ch >= 0 ? 'hf-up' : 'hf-down', `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`));
      tip.hidden = false;
      const brect = box.getBoundingClientRect(), tw = tip.offsetWidth || 150;
      tip.style.left = `${Math.max(4, Math.min(event.clientX - brect.left + 14, brect.width - tw - 4))}px`;
      tip.style.top = `${Math.max(4, event.clientY - brect.top - 12)}px`;
    });
    svg.addEventListener('pointerleave', hide);
    const prevW = box._lastW; box._lastW = width; box._redraw = () => { if (box.isConnected) drawCandles(box, points, height); };
    if (!box._ro && typeof ResizeObserver !== 'undefined') { box._ro = new ResizeObserver(() => { const w = Math.round(box.getBoundingClientRect().width || 0); if (box._lastW && Math.abs(w - box._lastW) > 8 && box._redraw) box._redraw(); }); box._ro.observe(box); }
    void prevW;
  }

  function draw() {
    if (!open) return;
    for (const b of tabs.querySelectorAll('.hf-tab')) b.setAttribute('aria-selected', String(b.dataset.ws === section));
    const isLive = cfg().execution === 'live';
    for (const b of ws.querySelectorAll('#ws-seg button')) b.setAttribute('aria-pressed', String((b.dataset.exec === 'live') === isLive));
    ws.querySelector('#ws-seg button[data-exec=live]').classList.toggle('live', isLive);
    const w = wallet(); el('ws-conn').textContent = !w ? 'Loading…' : (w.wc?.connected ? `Connected · ${((w.wc.accounts[0] || '').split(':').pop() || '').slice(0, 6)}…` : (cfg().addresses?.length ? `${cfg().addresses.length} watched` : 'Not connected'));
    chat.style.width = `${chatW}px`; split.classList.toggle('collapsed', !chatOpen);
    content.replaceChildren();
    const col = mk('div', 'ws-col');
    const bPortfolio = tabs.querySelector('.hf-tab[data-ws=portfolio] .hf-badge'); const bResearch = tabs.querySelector('.hf-tab[data-ws=research] .hf-badge'); const bWatch = tabs.querySelector('.hf-tab[data-ws=watch] .hf-badge');
    if (bPortfolio) bPortfolio.textContent = (w?.state?.holdings || []).length;
    if (bWatch) { const unread = ((typeof view !== 'undefined' && view.notifications) || []).filter(item => !item.read).length; bWatch.textContent = unread; bWatch.hidden = !unread; }
    if (bResearch) { const n = (w?.research || []).filter(r => r.status === 'running').length; bResearch.textContent = n; bResearch.hidden = !n; }
    if (!w) { col.append(skeleton(5)); content.append(col); return; }
    const session = w.session;
    if (session && session.state !== 'RUNNING') { const banner = mk('div', 'ws-banner'); banner.append(mk('span', '', `${session.state.replaceAll('_', ' ')}${session.note ? ` · ${session.note}` : ''}`)); const acts = mk('div', 'ws-ctrls'); if (session.needsConfirmation) acts.append(btn('Reconcile', { sm: true }, run(async () => call2(window.aurora.walletSessionReconcile())))); acts.append(btn('Resume', { sm: true }, run(async () => call2(window.aurora.walletSessionResume())))); banner.append(acts); col.append(banner); }
    ({ canvas: drawCanvas, portfolio: drawPortfolio, trade: drawTrade, discover: drawDiscover, watch: drawWatch, research: drawResearch, strategies: drawStrategies, journal: drawJournal })[section](col, w.state);
    content.append(col);
  }

  function head(root, title, sub, actions) { const h = mk('div', 'ws-head'); const left = mk('div'); left.append(mk('h1', 'ws-h1', title), mk('p', 'ws-sub', sub)); h.append(left); if (actions) { const a = mk('div', 'ws-head-actions'); a.append(...actions); h.append(a); } root.append(h); }
  const metric = (label, value, cls) => { const c = mk('div', 'ws-stat'); c.append(mk('small', '', label)); const b = mk('b', '', value); if (cls) b.className = cls; c.append(b); return c; };
  function listItem(name, sub, value, change, controls, badge) { const item = mk('div', 'ws-item'); const left = mk('div'); left.append(mk('strong', '', name)); if (sub) left.append(mk('small', '', sub)); const right = mk('div', 'ws-ctrls'); if (change !== undefined && change !== null) right.append(mk('small', change >= 0 ? 'hf-up' : 'hf-down', `${change >= 0 ? '+' : ''}${Number(change).toFixed(2)}%`)); if (value !== undefined) right.append(mk('strong', '', value)); if (badge) right.append(badge); if (controls) right.append(controls); item.append(left, right); return item; }
  function field(label, type, options) { const d = mk('div', 'hf-field'); d.append(mk('label', '', label)); if (type === 'select') { const s = mk('select', 'hf-input'); for (const o of options) s.append(mk('option', '', o)); d.append(s); } else { const i = mk('input', 'hf-input'); i.type = type; i.step = 'any'; if (/buy/i.test(label)) i.value = '25'; d.append(i); } return d; }
  const inputOf = d => d.querySelector('input')?.value; const selectOf = d => d.querySelector('select')?.value;
  function checkField(label) { const d = mk('div', 'hf-field ws-check'); const i = mk('input'); i.type = 'checkbox'; d.append(mk('label', '', label), i); return d; }
  const checkedOf = d => !!d.querySelector('input')?.checked;

  // ---- alerts ----
  function alertRow(a, s) { const ct = mk('div', 'ws-ctrls'); ct.append(ibtn('delete', 'Remove alert', run(async () => call2(window.aurora.walletAlertRemove(a.id))))); return listItem(`${sym(a.mint, s)} ${a.direction} ${money(a.price)}`, a.triggeredAt ? `fired ${new Date(a.triggeredAt).toLocaleString()}` : 'watching', undefined, undefined, ct, mk('span', `hf-badge${a.triggeredAt ? ' ok' : ' muted'}`, a.triggeredAt ? 'fired' : 'armed')); }
  function alertsBody(s) { const alerts = s?.alerts || []; if (!alerts.length) return emptyState('alert', 'No alerts yet', 'Open a token in Trade and set a price alert, or ask Gigi.'); const list = mk('div', 'ws-list'); for (const a of alerts) list.append(alertRow(a, s)); return list; }
  function alertForm(mint, symbol, s) {
    if (!mint) return emptyState('alert', 'Pick a token', 'Open a token in Trade to set an alert.');
    const dir = field('Direction', 'select', ['above', 'below']);
    const price = field('Trigger price (USD)', 'number');
    const add = btn('Add alert', { sm: true, variant: 'primary' }, run(async () => {
      const value = Number(inputOf(price));
      if (!(value > 0)) { window.toast('Enter a trigger price.'); return null; }
      const data = await call2(window.aurora.walletAlertAdd({ mint, direction: selectOf(dir), price: value }));
      window.toast(`Alert set: ${(symbol || short(mint)).trim()} ${selectOf(dir)} ${money(value)}.`);
      return data;
    }));
    const form = mk('div', 'ws-form'); form.append(dir, price, add);
    const list = mk('div', 'ws-list'); for (const a of (s?.alerts || []).filter(item => item.mint === mint)) list.append(alertRow(a, s));
    if (list.childElementCount) form.append(list);
    return form;
  }
  function signalForm(s) {
    const fallback = chartMint || (s.holdings || [])[0]?.mint || (s.markets || [])[0]?.mint || '';
    const name = field('Name', 'text'); name.querySelector('input').value = 'Signal';
    const token = field('Token mint', 'text'); token.querySelector('input').value = fallback; token.querySelector('input').spellcheck = false;
    const metric = field('Metric', 'select', ['price', 'change24h', 'change']);
    const op = field('Operator', 'select', ['above', 'below', 'crossAbove', 'crossBelow']);
    const value = field('Value', 'number');
    const action = field('Action', 'select', ['notify', 'paper-buy']);
    const usd = field('Paper buy USD', 'number');
    const cooldown = field('Cooldown (min)', 'number'); cooldown.querySelector('input').value = '60';
    const gate = checkField('Require fresh research');
    const add = btn('Create signal', { sm: true, variant: 'primary', icon: 'alert' }, run(async () => {
      const mint = (inputOf(token) || fallback).trim();
      if (!mint) throw Error('Enter a token mint.');
      const data = await call2(window.aurora.walletSignalSave({ name: inputOf(name) || 'Signal', mint, symbol: sym(mint, s), condition: { metric: selectOf(metric), op: selectOf(op), value: Number(inputOf(value)) }, action: selectOf(action), usd: Number(inputOf(usd)) || 25, cooldownSec: Math.round((Number(inputOf(cooldown)) || 60) * 60), requireResearch: checkedOf(gate) }));
      window.toast('Signal created.'); return data;
    }));
    const form = mk('div', 'ws-form'); form.append(name, token, metric, op, value, action, usd, cooldown, gate);
    const actions = mk('div', 'ws-form-actions'); actions.append(add); form.append(actions); return form;
  }
  // Live swap with an explicit confirmation showing decoded amounts before signing.
  async function executeLive({ mint, side, amountUi, usd, symbol }) {
    const value = Number(amountUi);
    if (!(value > 0)) throw Error('Enter an amount.');
    const preview = await call2(window.aurora.walletSwapPreview({ mint, amountUi: value, side, slippageBps: 50 }));
    const sim = preview.simulation?.ok ? 'simulation ok' : `simulation failed${preview.simulation?.error ? `: ${preview.simulation.error}` : ''}`;
    const detail = side === 'buy' ? `Buy ≈${amount(value)} ${(symbol || short(mint)).trim()} for ${money(usd)}` : `Sell ${amount(value)} ${(symbol || short(mint)).trim()}`;
    if (!window.confirm(`${detail}\nMin out ${preview.summary.minimumOut} · impact ${Number(preview.summary.priceImpactPct || 0).toFixed(2)}% · ${sim}\n\nSign this live transaction?`)) return null;
    const result = await call2(window.aurora.walletSwapExecute({ mint, amountUi: value, side, slippageBps: 50 }));
    window.toast(`Live ${side} ${result.status}${result.signature ? ` · ${result.signature.slice(0, 8)}…` : ''}`);
    return call2(window.aurora.load());
  }

  // ---- canvas ----
  function drawCanvas(root, s) {
    const pinned = wallet()?.views || [];
    const actions = [btn('Ask Gigi', { variant: 'primary', sm: true, icon: 'chat' }, () => askGigi('Show me a chart of my portfolio and flag anything I should look at.'))];
    if (pinned.length) actions.push(btn('Clear', { sm: true, variant: 'ghost', icon: 'delete' }, run(async () => { for (const v of pinned) await call2(window.aurora.walletViewRemove(v.id)); })));
    head(root, 'Canvas', 'Ask Gigi to visualize anything: charts, holders, tables, her read. Pin what you want to keep.', actions);
    const views = [];
    const active = wallet()?.view; if (active) views.push({ ...active, _active: true });
    for (const v of pinned) if (!views.some(x => x.id === v.id)) views.push(v);
    if (!views.length) { root.append(canvasStarter(s)); return; }
    const grid = mk('div', 'ws-canvas');
    for (const v of views) grid.append(renderView(v));
    root.append(grid);
  }
  function canvasStarter(s) {
    const markets = s.markets || []; const holdings = s.holdings || [];
    const sol = markets.find(m => m.symbol === 'SOL') || markets[0];
    const target = chartMint || holdings[0]?.mint || sol?.mint || '';
    const tile = (icon, title, sub, fn) => { const b = mk('button', 'ws-starter'); b.type = 'button'; const i = mk('div', 'ws-starter-ico'); i.append(ic(icon, 20)); b.append(i, mk('strong', '', title), mk('small', '', sub)); b.onclick = fn; return b; };
    const grid = mk('div', 'ws-starters');
    const onClick = spec => run(async () => call2(window.aurora.walletViewShow(spec)));
    grid.append(tile('chart', 'Price chart', sol ? `${sol.symbol} · ${money(sol.price)}` : 'Live markets', sol ? onClick({ type: 'line', title: `${sol.symbol} price`, layout: 'half', source: { kind: 'series', mint: sol.mint } }) : () => window.toast('No market data yet.')));
    grid.append(tile('holders', 'Holders', target ? sym(target, s) : 'Open a token first', target ? onClick({ type: 'holders', title: `Holders · ${sym(target, s)}`, layout: 'half', source: { kind: 'holders', mint: target } }) : () => window.toast('Open a token in Trade first.')));
    grid.append(tile('portfolio', 'Wallet metrics', 'Value, 24h and paper', onClick({ type: 'metrics', title: 'Wallet', layout: 'half', source: { kind: 'static', data: { walletValue: s.total, change24h: `${(Number(s.change24h || 0) * 100).toFixed(2)}%`, holdings: holdings.length, paperEquity: paper()?.equity || 0 } } })));
    grid.append(tile('journal', 'Market table', 'Major Solana pairs', onClick({ type: 'table', title: 'Markets', layout: 'full', source: { kind: 'static', rows: markets.map(m => [m.symbol, money(m.price), `${(m.change24h || 0) >= 0 ? '+' : ''}${(m.change24h || 0).toFixed(2)}%`]) } })));
    const wrap = mk('div', 'ws-starter-wrap'); wrap.append(mk('p', 'ws-sub', 'Start with a view, or ask Gigi below. Pinned views persist across sessions.'), grid);
    return wrap;
  }
  // Simple bar chart for `bar` view specs (line/area use drawChart).
  function drawBars(box, points, height = 260) {
    box.replaceChildren();
    if (!points || points.length < 2) { box.append(mk('div', 'ws-sub', 'No data yet. Try another range or token.')); return; }
    const width = Math.max(200, Math.round(box.getBoundingClientRect().width || 600)), H = height, padB = 6, padT = 6;
    const svg = svgEl('svg'); svg.setAttribute('viewBox', `0 0 ${width} ${H}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('role', 'img'); svg.style.height = `${height}px`;
    const vs = points.map(p => p.p); const max = Math.max(...vs) || 1, min = Math.min(0, Math.min(...vs));
    const step = width / points.length, w = Math.max(1, step * 0.68);
    for (let i = 0; i < points.length; i++) { const h = ((points[i].p - min) / (max - min || 1)) * (H - padT - padB); const r = svgEl('rect'); r.setAttribute('x', i * step + (step - w) / 2); r.setAttribute('width', w); r.setAttribute('y', H - padB - h); r.setAttribute('height', Math.max(h, 0.5)); r.setAttribute('fill', 'var(--accent)'); r.setAttribute('rx', '1'); svg.append(r); }
    box.append(svg);
    const t = trend(points); const meta = mk('div', 'ws-chart-meta'); meta.append(mk('span', '', `Low ${money(Math.min(...vs))}`), mk('span', '', `High ${money(max)}`), mk('span', '', `Last ${money(vs[vs.length - 1])}`)); if (t) meta.append(mk('span', t.change >= 0 ? 'hf-up' : 'hf-down', `${t.change >= 0 ? '+' : ''}${t.change.toFixed(2)}%`)); box.append(meta);
  }
  function renderView(v) {
    const layout = v.layout === 'full' ? 'full' : 'half';
    const card = mk('div', `ws-view ${layout}`);
    const headr = mk('div', 'ws-view-head'); const ico = mk('div', 'ws-view-ico'); ico.append(ic(v.type === 'holders' ? 'holders' : v.type === 'thesis' ? 'strategies' : v.type === 'table' ? 'journal' : 'chart', 16)); const t = mk('div', 'ws-view-title'); t.append(mk('strong', '', v.title || 'View'), mk('small', '', v.subtitle || '')); const actions = mk('div', 'ws-ctrls');
    if (!v._active) actions.append(ibtn('pin', 'Pin view', run(async () => call2(window.aurora.walletViewPin(v)))));
    else actions.append(ibtn('watch', 'Pin view', run(async () => call2(window.aurora.walletViewPin(v)))));
    actions.append(ibtn('delete', 'Remove', run(async () => { await call2(window.aurora.walletViewRemove(v.id)); draw(); })));
    headr.append(ico, t, mk('span', 'ws-top-spacer'), actions);
    const body = mk('div', 'ws-view-body');
    card.append(headr, body);
    if (v.type === 'line' || v.type === 'area' || v.type === 'bar') {
      if (v.source.mint) { const c = mk('div', 'ws-chart'); body.append(c); const render = points => { if (v.type === 'bar') drawBars(c, points, 260); else drawChart(c, points, 260); }; seriesOf(v.source.mint).then(points => { render(points); if (!points || points.length < 2) body.append(btn('Retry', { sm: true, variant: 'ghost', icon: 'refresh' }, run(async () => { c.replaceChildren(); render(await seriesOf(v.source.mint)); }))); }); }
      else body.append(emptyState('chart', 'No data', 'Give this view a token mint.'));
    }
    else if (v.type === 'holders') { body.append(holdersBody(v.source.mint)); }
    else if (v.type === 'metrics') { body.append(metricsBody(v)); }
    else if (v.type === 'table' || v.type === 'list') { body.append(rowsBody(v.source.rows, v.type)); }
    else if (v.type === 'thesis') { const t2 = (wallet()?.theses || []).find(x => x.id === (v.source.data?.id)) || (wallet()?.theses || [])[(wallet()?.theses || []).length - 1]; body.append(t2 ? thesisCard(t2) : emptyState('strategies', 'No thesis yet', 'Ask Gigi to build one.')); }
    else { body.append(mk('p', 'ws-sub', v.subtitle || v.title || '')); }
    return card;
  }

  function rowsBody(rows, type) { if (!Array.isArray(rows) || !rows.length) return emptyState('journal', 'Nothing to show', 'No rows were provided.'); const list = mk('div', 'ws-list'); const cell = value => (typeof value === 'number' ? num(value) : String(value == null ? '' : value)); for (const row of rows) { if (Array.isArray(row)) list.append(listItem(cell(row[0]), row.slice(1).map(cell).join(' · '))); else if (row && typeof row === 'object') list.append(listItem(String(row.name || row.symbol || row.label || ''), cell(row.value ?? row.sub ?? ''))); } return list; }
  function metricsBody(v) { const data = v.source.data && typeof v.source.data === 'object' ? v.source.data : {}; const wrap = mk('div', 'ws-stats'); for (const [k, val] of Object.entries(data)) wrap.append(metric(keyLabel(k), typeof val === 'number' ? money(val) : String(val))); return Object.keys(data).length ? wrap : emptyState('chart', 'No metrics', 'No metrics were provided.'); }
  const keyLabel = k => k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  function holdersBody(mint) {
    if (!mint) return emptyState('holders', 'No token', 'Give this view a token mint.');
    if (!holdersCache.has(mint)) { holdersCache.set(mint, { loading: true }); call2(window.aurora.walletHolders(mint)).then(info => { holdersCache.set(mint, info); if (open) draw(); }).catch(error => { holdersCache.set(mint, { error: error.message }); if (open) draw(); }); }
    const info = holdersCache.get(mint);
    if (info.loading) return skeleton(4);
    if (info.error) return emptyState('holders', 'Unavailable', info.error);
    const box = mk('div', 'ws-holders');
    if (!info.accounts.length) { box.append(emptyState('holders', 'Holder data unavailable', 'The holder index has no entry for this token yet. It refreshes automatically.')); return box; }
    const stats = mk('div', 'ws-stats ws-holderstats');
    stats.append(metric('Holders', info.holders ? Number(info.holders).toLocaleString() : '—'), metric('Top 10', `${Number(info.top10 || 0).toFixed(1)}%`), metric('Largest', `${Number(info.top1 || 0).toFixed(1)}%`));
    box.append(stats);
    const wrap = mk('div', 'ws-list ws-holderlist');
    for (const a of info.accounts.slice(0, 12)) { const item = mk('div', 'ws-holder'); const left = mk('div', 'ws-holder-id'); left.append(mk('strong', '', `${a.pct.toFixed(2)}%`), mk('small', 'mono', `${a.address.slice(0, 6)}…${a.address.slice(-6)}`)); const bar = mk('span', 'ws-bar'); const fill = mk('i'); fill.style.width = `${Math.min(100, a.pct)}%`; bar.append(fill); item.append(left, bar); wrap.append(item); }
    box.append(wrap);
    box.append(mk('p', 'ws-sub ws-note', 'Largest token accounts, not unique wallets. Pools and market makers are included.'));
    if (Array.isArray(info.risks) && info.risks.length) { const risks = mk('div', 'ws-chips'); for (const risk of info.risks) risks.append(mk('span', 'ws-chip', risk)); box.append(risks); }
    return box;
  }

  function donut(holdings) { const wrap = mk('div', 'ws-donut'); const total = holdings.reduce((a, h) => a + h.value, 0) || 1; const segs = holdings.slice(0, 6); const R = 40, C = 2 * Math.PI * R; const svg = svgEl('svg'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('role', 'img'); const track = svgEl('circle'); track.setAttribute('cx', '50'); track.setAttribute('cy', '50'); track.setAttribute('r', String(R)); track.setAttribute('fill', 'none'); track.setAttribute('stroke', 'var(--line)'); track.setAttribute('stroke-width', '10'); svg.append(track); let offset = 0; segs.forEach((h, i) => { const len = (h.value / total) * C; const c = svgEl('circle'); c.setAttribute('cx', '50'); c.setAttribute('cy', '50'); c.setAttribute('r', String(R)); c.setAttribute('fill', 'none'); c.setAttribute('stroke', i % 2 ? 'var(--accent-2)' : 'var(--accent)'); c.setAttribute('stroke-opacity', String(Math.max(.28, 1 - i * .14))); c.setAttribute('stroke-width', '10'); c.setAttribute('stroke-dasharray', `${len} ${C - len}`); c.setAttribute('stroke-dashoffset', String(-offset)); c.setAttribute('transform', 'rotate(-90 50 50)'); svg.append(c); offset += len; }); wrap.append(svg); const legend = mk('div', 'ws-legend'); for (const h of segs.slice(0, 5)) { const row = mk('div'); const dot = mk('span', 'ws-legend-dot'); const b = mk('b', '', `${Math.round((h.value / total) * 100)}%`); row.append(dot, mk('span', '', h.symbol), b); legend.append(row); } wrap.append(legend); return wrap; }

  function drawPortfolio(root, s) {
    const holdings = [...(s.holdings || [])]; const markets = s.markets || []; const p = paper();
    const change = Number(s.change24h || 0) * 100;
    head(root, 'Portfolio', 'Live wallet positions, paper trading and the markets you follow.', [btn('Chart', { sm: true, variant: 'ghost', icon: 'chart' }, () => askGigi('Show my portfolio on the canvas.'))]);
    const stats = mk('div', 'ws-statbar');
    stats.append(metric('Wallet value', money(s.total)), metric('24h change', s.change24h != null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—', change >= 0 ? 'hf-up' : 'hf-down'), metric('Holdings', String(holdings.length)), metric('Paper equity', money(p?.equity)), metric('Paper cash', money(p?.cash)));
    root.append(stats);

    if (holdings.length) {
      const perf = mk('div', 'ws-chart');
      root.append(panel('Portfolio performance', { actions: rangeBar(pfRange, r => { pfRange = r; draw(); }) }, perf));
      call2(window.aurora.walletPortfolioSeries(pfRange)).then(result => { const res = Array.isArray(result) ? { points: result } : (result || {}); drawChart(perf, res.points || [], 220); if (res.holdings && res.covered < res.holdings) { const last = (res.points || []).slice(-1)[0]; perf.append(mk('p', 'ws-sub', `Chart covers ${res.covered} of ${res.holdings} priced holdings${last ? ` (${money(last.p)} tracked of ${money(res.total)} total)` : ''}.`)); } }).catch(() => drawChart(perf, [], 220));
      const overview = mk('div', 'ws-overview'); overview.append(panel('Allocation', {}, donut(holdings))); root.append(overview);
    } else {
      const addr = mk('input', 'hf-input'); addr.type = 'text'; addr.placeholder = 'Paste a Solana address'; addr.spellcheck = false; addr.setAttribute('aria-label', 'Solana address');
      const add = btn('Add address', { variant: 'primary', sm: true, icon: 'plus' }, run(async () => { const value = addr.value.trim(); if (!value) { window.toast('Paste a Solana address first.'); return null; } return call2(window.aurora.walletAddressAdd(value)); }));
      addr.addEventListener('keydown', event => { if (event.key === 'Enter') add.click(); });
      const form = mk('div', 'ws-connect-form'); form.append(addr, add, btn('Connect wallet', { sm: true, variant: 'ghost', icon: 'wallet' }, () => el('wallet-open')?.click()));
      const msg = mk('div', 'ws-connect-msg'); msg.append(mk('strong', '', 'No wallet connected'), mk('p', 'ws-sub', 'Add a Solana address to track it, or connect a wallet. The markets below stay live either way.'));
      const body = mk('div', 'hf-body'); body.append(msg, form);
      const card = mk('div', 'hf-panel ws-connect'); card.append(body); root.append(card);
    }

    if (holdings.length) {
      const filterInput = mk('input', 'hf-input'); filterInput.type = 'search'; filterInput.placeholder = 'Filter holdings'; filterInput.value = pfFilter;
      const visible = holdings.filter(h => !pfFilter || `${h.symbol} ${h.mint}`.toLowerCase().includes(pfFilter.toLowerCase()));
      visible.sort((a, b) => { const k = pfSort.key; const av = a[k] ?? 0, bv = b[k] ?? 0; return (av > bv ? 1 : av < bv ? -1 : 0) * pfSort.dir; });
      filterInput.oninput = () => { pfFilter = filterInput.value; draw(); };
      const table = mk('table', 'hf-table'); const cols = [['symbol', 'Token'], ['amount', 'Amount'], ['price', 'Price'], ['value', 'Value'], ['change24h', '24h'], ['__pl', 'Est. P/L'], ['__spark', 'Trend'], ['share', 'Allocation']];
      const thead = mk('thead'); const htr = mk('tr'); for (const [key, label] of cols) { const th = mk('th', ['amount', 'price', 'value', 'change24h', '__pl', '__spark'].includes(key) ? 'num' : '', label); if (key[0] !== '_') { th.style.cursor = 'pointer'; th.onclick = () => { if (pfSort.key === key) pfSort.dir *= -1; else pfSort = { key, dir: -1 }; draw(); }; if (pfSort.key === key) th.textContent = `${label} ${pfSort.dir < 0 ? '↓' : '↑'}`; } htr.append(th); } thead.append(htr); table.append(thead);
      const tb = mk('tbody'); if (!visible.length) { const tr = mk('tr'); const td = mk('td'); td.colSpan = cols.length; td.append(emptyState('portfolio', 'No matches', 'Try another filter.')); tr.append(td); tb.append(tr); }
      for (const h of visible.slice(0, 20)) { const tr = mk('tr'); tr.dataset.mint = h.mint; tr.style.cursor = 'pointer'; tr.onclick = e => { if (e.target.closest('.ws-spark')) return; section = 'trade'; selectToken(h.mint); }; tr.innerHTML = `<td><span class="ws-sym">${h.symbol}</span></td><td class="num">${amount(h.amount)}</td><td class="num">${money(h.price)}</td><td class="num">${money(h.value)}</td><td class="num ${(h.change24h || 0) >= 0 ? 'hf-up' : 'hf-down'}">${(h.change24h || 0) >= 0 ? '+' : ''}${(h.change24h || 0).toFixed(2)}%</td><td class="num ws-pl" title="Estimated change since Aurora started watching">—</td><td class="num ws-spark" style="color:var(--accent)"></td><td><span class="ws-bar"><i style="width:${Math.max(2, Math.round((h.share || 0) * 100))}%"></i></span></td>`; tb.append(tr); }
      table.append(tb); root.append(panel('Holdings', { actions: filterInput }, table));
      for (const h of visible.slice(0, 15)) seriesOf(h.mint).then(points => { const row = tb.querySelector(`tr[data-mint="${CSS.escape(h.mint)}"]`); if (!row || !points || points.length < 2) return; row.querySelector('.ws-spark')?.append(sparkline(points)); const vs = points.map(pt => pt.p); const pl = (vs[vs.length - 1] - vs[0]) / vs[0] * 100; const cell = row.querySelector('.ws-pl'); if (cell) { cell.textContent = `${pl >= 0 ? '+' : ''}${pl.toFixed(2)}%`; cell.className = `num ws-pl ${pl >= 0 ? 'hf-up' : 'hf-down'}`; } });
    }

    if (p) { const list = mk('div', 'ws-list'); for (const pos of p.positions) { const badge = mk('span', `hf-badge${(pos.roe || 0) >= 0 ? ' ok' : ' live'}`, `${(pos.roe || 0) >= 0 ? '+' : ''}${Number(pos.roe || 0).toFixed(2)}%`); list.append(listItem(pos.symbol, `${amount(pos.amount)} @ ${money(pos.avgPrice)} · ${(pos.unrealizedPnl || 0) >= 0 ? '+' : ''}${money(pos.unrealizedPnl)}`, money(pos.value), undefined, undefined, badge)); } const actions = mk('div', 'ws-ctrls'); actions.append(btn('Exit & pause', { sm: true }, run(async () => call2(window.aurora.walletSessionPause({ exit: true })))), btn('Reset', { sm: true, variant: 'ghost' }, run(async () => call2(window.aurora.walletPaperReset({}))))); root.append(panel(`Paper · cash ${money(p.cash)} · equity ${money(p.equity)} · P/L ${(p.totalPnl || 0) >= 0 ? '+' : ''}${money(p.totalPnl)}`, { actions }, p.positions.length ? list : emptyState('trade', 'No paper positions', 'Buy in Trade to open one.'))); }
    if ((s.watchlist || []).length) { const list = mk('div', 'ws-list'); for (const it of s.watchlist) list.append(listItem(it.symbol, 'watched', money(it.price), it.change24h)); root.append(panel('Watchlist', {}, list)); }
    if (markets.length) root.append(panel('Markets', {}, marketsTable(markets)));
  }

  function marketsTable(markets) {
    const table = mk('table', 'hf-table ws-market-table');
    const thead = mk('thead'); const htr = mk('tr'); for (const [label, num] of [['Token', false], ['Price', true], ['24h', true]]) { const th = mk('th', num ? 'num' : '', label); htr.append(th); } thead.append(htr); table.append(thead);
    const tb = mk('tbody');
    for (const m of markets) {
      const row = mk('tr'); row.style.cursor = 'pointer'; row.onclick = () => { section = 'trade'; selectToken(m.mint); };
      const td1 = mk('td'); td1.append(mk('span', 'ws-sym', m.symbol), mk('small', 'ws-market-name', m.name || short(m.mint)));
      const ch = m.change24h || 0;
      row.append(td1, mk('td', 'num', money(m.price)), mk('td', `num ${ch >= 0 ? 'hf-up' : 'hf-down'}`, `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`));
      tb.append(row);
    }
    table.append(tb); return table;
  }

  function openOrdersBody() {
    const pending = paper()?.pending || [];
    if (!pending.length) return emptyState('journal', 'No open orders', 'Limit and stop orders you place appear here.');
    const list = mk('div', 'ws-list');
    for (const o of pending) { const ct = mk('div', 'ws-ctrls'); ct.append(ibtn('delete', 'Cancel order', run(async () => call2(window.aurora.walletPaperCancel(o.id))))); list.append(listItem(`${o.side === 'buy' ? 'Buy' : 'Sell'} ${o.symbol || short(o.mint)}`, `${o.kind} @ ${money(o.trigger)}${o.usd ? ` · ${money(o.usd)}` : ` · ${o.percent}%`}${o.lastError ? ' · ' + o.lastError : ''}`, undefined, undefined, ct, mk('span', `hf-badge${o.side === 'buy' ? ' ok' : ' live'}`, o.side))); }
    return list;
  }
  function fillsBody(mint) {
    const orders = (paper()?.orders || []).filter(o => o.mint === mint).slice(-10).reverse();
    if (!orders.length) return emptyState('journal', 'No fills yet', 'Paper trades on this token appear here.');
    const list = mk('div', 'ws-list');
    for (const o of orders) list.append(listItem(`${o.side === 'buy' ? 'Bought' : 'Sold'} ${o.symbol || short(o.mint)}`, `${amount(o.amount)} @ ${money(o.priceUsd)} · ${new Date(o.at).toLocaleString()}`, money(o.valueUsd), undefined, undefined, mk('span', `hf-badge${o.side === 'buy' ? ' ok' : ' live'}`, o.side)));
    return list;
  }
  function tradeInfo(mint, symName, s) {
    const bar = mk('div', 'hf-tabs ws-subtabs');
    const box = mk('div', 'ws-subpanel');
    const renderTab = () => {
      for (const b of bar.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.t === tradeTab));
      box.replaceChildren(tradeTab === 'fills' ? fillsBody(mint) : tradeTab === 'holders' ? holdersBody(mint) : openOrdersBody());
    };
    for (const [id, label] of [['orders', 'Open orders'], ['fills', 'Recent fills'], ['holders', 'Holders']]) { const b = mk('button', 'hf-tab'); b.type = 'button'; b.dataset.t = id; b.setAttribute('role', 'tab'); b.append(mk('span', '', label)); b.onclick = () => { tradeTab = id; savePrefs(); renderTab(); }; bar.append(b); }
    const card = mk('div', 'hf-panel ws-info'); const body = mk('div', 'hf-body'); body.append(bar, box); card.append(body);
    renderTab();
    return card;
  }
  function orderCard(mint, symName, pair, s) {
    const live = cfg().execution === 'live' && wallet()?.wc?.connected === true;
    const oco = tradeType === 'oco';
    const buy = tradeSide === 'buy' && !oco;
    const cash = Number(paper()?.cash || 0);
    const held = (paper()?.positions || []).find(x => x.mint === mint);
    const price = Number(pair.priceUsd || 0);
    const head = mk('header'); head.append(mk('h3', '', 'Place order'), mk('span', 'ws-top-spacer'), mk('span', `ws-mode ${cfg().execution === 'live' ? 'live' : 'paper'}`, cfg().execution === 'live' ? 'LIVE' : 'PAPER'));
    const body = mk('div', 'hf-body');
    body.append(mk('p', 'ws-order-help', cfg().execution === 'live' && live ? 'Live mode · real funds move. You confirm every trade.' : `Paper trading · simulated balance ${money(cash)}. No real funds move.`));
    if (!oco) { const sideSeg = mk('div', 'ws-seg ws-sideseg'); for (const [label, val] of [['Buy', 'buy'], ['Sell', 'sell']]) { const b = mk('button', tradeSide === val ? `active ${val}` : val, label); b.type = 'button'; b.onclick = () => { tradeSide = val; savePrefs(); draw(); }; sideSeg.append(b); } body.append(sideSeg); }
    const TYPES = [['Market', 'market'], ['Limit', 'limit'], ['Stop', 'stop'], ['Stop-limit', 'stopLimit'], ['Trailing stop', 'trailing'], ['Take-profit / Stop-loss', 'oco']];
    const typeSel = mk('select', 'hf-input'); for (const [label, val] of TYPES) { const o = mk('option', '', label); o.value = val; typeSel.append(o); } typeSel.value = tradeType; typeSel.onchange = () => { tradeType = typeSel.value; savePrefs(); draw(); };
    const typeField = mk('div', 'hf-field'); typeField.append(mk('label', '', 'Order type'), typeSel); body.append(typeField);
    const hint = tradeType === 'market' ? (buy ? 'Fill now at the market price.' : 'Sell now at the market price.')
      : tradeType === 'limit' ? (buy ? 'Buy only at your price or lower.' : 'Sell only at your price or higher.')
        : tradeType === 'stop' ? (buy ? 'Buy when the price rises to your trigger.' : 'Sell if the price falls to your trigger.')
          : tradeType === 'stopLimit' ? (buy ? 'Arm a limit buy once the price reaches the stop.' : 'Arm a limit sell once the price falls to the stop.')
            : tradeType === 'trailing' ? (buy ? 'Buy when price rises from a recent low by the trail.' : 'Sell if price falls from its high by the trail.')
              : 'Sell a position automatically at a take-profit or stop-loss.';
    body.append(mk('p', 'ws-order-hint', hint));
    const refField = label => { const f = field(label, 'number'); const inp = f.querySelector('input'); if (price > 0) inp.value = String(Number(price.toPrecision(6))); return f; };
    let triggerField = null, limitField = null, trailField = null, tpField = null, slField = null;
    if (tradeType === 'limit' || tradeType === 'stop') triggerField = refField('Trigger price (USD)');
    else if (tradeType === 'stopLimit') { triggerField = refField('Stop price (USD)'); limitField = refField('Limit price (USD)'); }
    else if (tradeType === 'trailing') { trailField = field('Trail (%)', 'number'); trailField.querySelector('input').value = '10'; }
    else if (tradeType === 'oco') { tpField = field('Take-profit (%)', 'number'); tpField.querySelector('input').value = '25'; slField = field('Stop-loss (%)', 'number'); slField.querySelector('input').value = '10'; }
    for (const f of [triggerField, limitField, trailField, tpField, slField]) if (f) body.append(f);
    const amountField = field(oco || !buy ? 'Percent of position' : 'Amount (USD)', 'number'); const amountInput = amountField.querySelector('input'); amountInput.value = oco || !buy ? '100' : '25'; body.append(amountField);
    const avail = mk('div', 'ws-ticket-avail'); avail.append(mk('span', '', oco || !buy ? 'Position' : 'Available'), mk('b', '', oco || !buy ? (held ? `${amount(held.amount)} ${symName}` : `0 ${symName}`) : money(cash))); body.append(avail);
    const presets = mk('div', 'ws-seg ws-presets'); for (const v of [25, 50, 100]) { const b = mk('button', '', `${v}%`); b.type = 'button'; b.onclick = () => { amountInput.value = oco || !buy ? String(v) : String(Math.round(cash * v) / 100); update(); }; presets.append(b); } body.append(presets);
    const est = mk('div', 'ws-ticket-est');
    const update = () => {
      if (oco) { const pct = Number(amountInput.value) || 0; est.replaceChildren(mk('span', '', 'Bracket on'), mk('b', '', held ? `${amount(held.amount * pct / 100)} ${symName}` : 'no position')); return; }
      if (buy) { const usd = Number(amountInput.value) || 0; est.replaceChildren(mk('span', '', 'You receive'), mk('b', '', pair.priceUsd && usd > 0 ? `${amount(usd / pair.priceUsd)} ${symName}` : '—')); }
      else { const pct = Number(amountInput.value) || 0; est.replaceChildren(mk('span', '', 'You sell'), mk('b', '', held ? `${amount(held.amount * pct / 100)} ${symName}` : 'no position')); }
    };
    amountInput.oninput = update; update(); body.append(est);
    const actions = mk('div', 'ws-ticket-actions');
    const TYPELABEL = { limit: 'limit', stop: 'stop', stopLimit: 'stop-limit', trailing: 'trailing' };
    const label = oco ? 'Set take-profit / stop-loss' : tradeType === 'market' ? `Paper ${buy ? 'buy' : 'sell'} ${symName}` : `Paper ${TYPELABEL[tradeType]} ${buy ? 'buy' : 'sell'}`;
    actions.append(btn(label, { variant: oco || !buy ? 'sell' : 'buy' }, run(async () => {
      const symbol = pair.symbol;
      if (oco) { const tp = Number(inputOf(tpField)), sl = Number(inputOf(slField)); if (!(tp > 0) || !(sl > 0)) throw Error('Set take-profit and stop-loss percentages.'); if (!(price > 0)) throw Error('No live price yet.'); return call2(window.aurora.walletPaperCondition({ mint, symbol, kind: 'oco', side: 'sell', percent: Number(amountInput.value), takeProfit: price * (1 + tp / 100), stopLoss: price * (1 - sl / 100) })); }
      if (tradeType === 'market') return buy ? call2(window.aurora.walletPaperBuy({ mint, symbol, usd: Number(amountInput.value) })) : call2(window.aurora.walletPaperSell({ mint, percent: Number(amountInput.value) }));
      const payload = { mint, symbol, side: buy ? 'buy' : 'sell' };
      if (buy) payload.usd = Number(amountInput.value); else payload.percent = Number(amountInput.value);
      if (tradeType === 'trailing') payload.trailPercent = Number(inputOf(trailField));
      else { payload.kind = tradeType === 'stopLimit' ? 'stopLimit' : tradeType; payload.trigger = Number(inputOf(triggerField)); if (tradeType === 'stopLimit') payload.limitPrice = Number(inputOf(limitField)); }
      return call2(window.aurora.walletPaperCondition(payload));
    })));
    if (live && !oco) {
      const realHeld = (s.holdings || []).find(x => x.mint === mint);
      actions.append(btn('Live buy', { variant: 'primary' }, run(async () => { const usd = Number(amountInput.value); if (!(usd > 0)) throw Error('Enter a USD amount.'); const limits = cfg().limits || {}; const heldValue = (s.holdings || []).filter(x => x.mint === mint).reduce((sum, x) => sum + x.value, 0); if (limits.maxPositionUsd && heldValue + usd > limits.maxPositionUsd) throw Error(`Position cap is ${money(limits.maxPositionUsd)}.`); return executeLive({ mint, side: 'buy', amountUi: usd / pair.priceUsd, usd, symbol: symName }); })));
      if (realHeld) actions.append(btn('Live sell all', { variant: 'sell' }, run(async () => executeLive({ mint, side: 'sell', amountUi: realHeld.amount, symbol: symName }))));
    }
    body.append(actions);
    if (cfg().execution === 'live' && !live) body.append(mk('p', 'ws-ticket-slip', 'Live mode is on but no wallet is connected. Connect one in Settings, Wallet to place real trades.'));
    body.append(mk('p', 'ws-ticket-slip', 'Paper fills assume a 1% fee and 0.5% slippage.'));
    const card = mk('div', 'hf-panel ws-ticket'); card.append(head, body); return card;
  }

  function gigiCard(mint, symName, s) {
    const ctx = mk('div', 'ws-gigi-ctx'); ctx.append(mk('b', '', symName), mk('span', '', `${cfg().execution === 'live' ? 'LIVE' : 'PAPER'} · ${money(paper()?.cash)}`));
    const ta = mk('textarea', 'hf-input ws-gigi-input'); ta.rows = 2; ta.placeholder = 'Ask Gigi to trade or watch for you: “buy $50 paper if it dips 5%”, “alert me above $120”, “build a strategy and ask before executing”.';
    const chips = mk('div', 'ws-chips ws-gigi-chips');
    for (const q of ['Buy $50 paper now', 'Limit buy 5% below', 'Alert on a 10% move', 'Strategy with approval']) { const c = mk('button', 'ws-chip', q); c.type = 'button'; c.onclick = () => { ta.value = q; ta.focus(); }; chips.append(c); }
    const send = btn('Send to Gigi', { variant: 'primary' }, () => {
      const text = ta.value.trim(); if (!text) { window.toast('Type what you want Gigi to do.'); return; }
      const prompt = `Trade desk: ${symName} (${mint}). Execution mode ${cfg().execution || 'paper'}, paper cash ${money(paper()?.cash)}. Instruction: ${text}\n\nExecute paper trades on my behalf and tell me exactly what you did. Never place a live trade without my explicit approval; if I only want a heads-up, create a signal or alert instead.`;
      ta.value = ''; chatOpen = true; savePrefs(); draw();
      call2(window.aurora.send(prompt, [])).then(() => window.toast('Sent to Gigi.')).catch(error => window.toast(error.message));
    });
    const head = mk('header'); head.append(mk('h3', '', 'Ask Gigi'), mk('span', 'ws-top-spacer'));
    const body = mk('div', 'hf-body'); body.append(ctx, ta, chips, send);
    const card = mk('div', 'hf-panel ws-gigibox'); card.append(head, body); return card;
  }
  function drawTrade(root, s) {
    if (!chartMint) {
      const first = (s.markets || [])[0];
      if (first) { chartMint = first.mint; if (!tokenCache.has(first.mint)) { tokenCache.set(first.mint, { loading: true }); call2(window.aurora.walletTokenInfo(first.mint)).then(info => { tokenCache.set(first.mint, info); if (open) draw(); }).catch(error => { tokenCache.set(first.mint, { error: error.message }); if (open) draw(); }); } }
      else { head(root, 'Trade', 'Search a token above.'); root.append(panel('', {}, emptyState('trade', 'Pick a token', 'Search or tap a holding.'))); return; }
    }
    const info = tokenCache.get(chartMint) || {}; const pair = info.pair || {}, safety = info.safety || {};
    const symbolName = pair.symbol || sym(chartMint, s);
    const change = Number(pair.change24h || 0);
    const actions = [
      btn('Watch', { sm: true, variant: 'ghost', icon: 'watch' }, run(async () => { const data = await call2(window.aurora.walletWatchlistAdd(chartMint)); window.toast(`${symbolName.trim()} added to your watchlist.`); return data; })),
      btn('Ask Gigi', { sm: true, variant: 'ghost', icon: 'chat' }, () => askGigi(`Research ${symbolName} (${chartMint}): market, holders, behavior, controls, locks and narrative. Separate facts from inference.`)),
      btn('Holders', { sm: true, variant: 'ghost', icon: 'holders' }, run(async () => { await call2(window.aurora.walletViewShow({ type: 'holders', title: `Holders · ${symbolName}`, source: { kind: 'holders', mint: chartMint } })); section = 'canvas'; savePrefs(); }))
    ];
    const header = mk('div', 'ws-head ws-trade-head');
    const heading = mk('div', 'ws-trade-heading');
    const nameRow = mk('div', 'ws-trade-name'); nameRow.append(mk('h1', 'ws-h1', pair.name || symbolName), mk('span', 'ws-tick', symbolName));
    const priceRow = mk('div', 'ws-trade-price'); priceRow.append(mk('b', '', money(pair.priceUsd))); if (pair.change24h != null) priceRow.append(mk('span', `ws-change ${change >= 0 ? 'hf-up' : 'hf-down'}`, `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`)); priceRow.append(mk('span', 'ws-mint', short(chartMint)));
    heading.append(nameRow, priceRow);
    const ha = mk('div', 'ws-head-actions'); ha.append(...actions);
    header.append(heading, ha); root.append(header);
    const meta = mk('div', 'ws-trademeta');
    meta.append(mk('span', '', `Liquidity ${pair.liquidityUsd ? '$' + compact(pair.liquidityUsd) : '—'}`), mk('span', '', `Vol 24h ${pair.volume24h ? '$' + compact(pair.volume24h) : '—'}`), mk('span', '', `Mkt cap ${pair.marketCap ? '$' + compact(pair.marketCap) : '—'}`), mk('span', 'ws-top-spacer'), mk('span', `hf-badge ${safety.level ? safeCls(safety.level) : 'muted'}`, safety.level ? (safety.level === 'ok' ? 'mint/freeze revoked' : (safety.flags?.[0] || safety.level)) : 'safety unknown'));
    root.append(meta);
    if ((s.markets || []).length) { const chips = mk('div', 'ws-chips ws-trade-chips'); for (const m of s.markets) { const chip = mk('button', 'ws-chip' + (m.mint === chartMint ? ' active' : ''), m.symbol); chip.type = 'button'; chip.onclick = () => selectToken(m.mint); chips.append(chip); } root.append(chips); }
    const grid = mk('div', 'ws-trade'); const left = mk('div', 'ws-trade-left'); const right = mk('div', 'ws-trade-right');
    const RANGE_LABEL = { '1D': '15m', '7D': '1h', '30D': '4h', '3M': '1D', '6M': '1D', '1Y': '1D', ALL: '1W' };
    const legend = mk('div', 'ws-ohlc');
    const typeSeg = mk('div', 'ws-seg ws-charttype');
    for (const [label, val] of [['Line', false], ['Candles', true]]) { const b = mk('button', tradeCandles === val ? 'active' : '', label); b.type = 'button'; b.setAttribute('aria-pressed', String(tradeCandles === val)); b.onclick = () => { tradeCandles = val; savePrefs(); draw(); }; typeSeg.append(b); }
    const chHead = mk('header', 'ws-chartcard-head'); chHead.append(rangeBar(tradeRange, r => { tradeRange = r; draw(); }), mk('span', 'ws-top-spacer'), typeSeg);
    const chart = mk('div', 'ws-chart');
    const chartBody = mk('div', 'hf-body'); chartBody.append(chart);
    const chartCard = mk('div', 'hf-panel ws-chartcard'); chartCard.append(chHead, legend, chartBody); left.append(chartCard);
    if (!info.loading) seriesOf(chartMint, tradeRange).then(points => {
      const last = points[points.length - 1] || {};
      legend.replaceChildren(mk('b', '', symbolName), mk('span', 'ws-leg-i', RANGE_LABEL[tradeRange] || ''));
      if (last.o != null) { legend.append(mk('span', '', `O ${money(last.o)}`), mk('span', '', `H ${money(last.h)}`), mk('span', '', `L ${money(last.l)}`), mk('span', '', `C ${money(last.c)}`)); const ch = last.o > 0 ? (last.c - last.o) / last.o * 100 : 0; legend.append(mk('span', ch >= 0 ? 'hf-up' : 'hf-down', `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`)); }
      if (tradeCandles && points.some(p => p.o != null)) drawCandles(chart, points, 360); else drawChart(chart, points, 320);
    });
    else chart.append(skeleton(3));
    left.append(tradeInfo(chartMint, symbolName, s));
    right.append(orderCard(chartMint, symbolName, pair, s), gigiCard(chartMint, symbolName, s));
    grid.append(left, right); root.append(grid);
  }

  function ageLabel(ms) { if (!ms) return '—'; const diff = Date.now() - Number(ms); const m = Math.floor(diff / 60000); if (m < 60) return `${Math.max(1, m)}m`; const h = Math.floor(m / 60); if (h < 24) return `${h}h`; const d = Math.floor(h / 24); return `${d}d`; }
  const changeTd = v => { const n = Number(v || 0); return mk('td', `num ${n >= 0 ? 'hf-up' : 'hf-down'}`, `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`); };
  function screenerTable(rows, render) {
    if (!rows.length) return emptyState('discover', 'No tokens match', 'Loosen the filters or hit refresh.');
    const cols = [['token', 'Token'], ['priceUsd', 'Price'], ['change5m', '5m'], ['change1h', '1h'], ['change24h', '24h'], ['liquidityUsd', 'Liquidity'], ['volume24h', 'Volume'], ['marketCap', 'Mkt cap'], ['createdAt', 'Age'], ['__', '']];
    const table = mk('table', 'hf-table ws-screener');
    const thead = mk('thead'); const htr = mk('tr');
    for (const [key, label] of cols) { const th = mk('th', key === 'token' || key === '__' ? '' : 'num', label); if (['priceUsd', 'change5m', 'change1h', 'change24h', 'liquidityUsd', 'volume24h', 'marketCap'].includes(key)) { th.style.cursor = 'pointer'; th.onclick = () => { if (discoverSort.key === key) discoverSort.dir *= -1; else discoverSort = { key, dir: -1 }; render(); }; if (discoverSort.key === key) th.textContent = `${label} ${discoverSort.dir < 0 ? '↓' : '↑'}`; } htr.append(th); }
    thead.append(htr); table.append(thead);
    const sorted = [...rows].sort((a, b) => ((a[discoverSort.key] ?? 0) - (b[discoverSort.key] ?? 0)) * discoverSort.dir);
    const tb = mk('tbody');
    for (const t of sorted) {
      const tr = mk('tr'); tr.style.cursor = 'pointer'; tr.onclick = e => { if (e.target.closest('button')) return; section = 'trade'; selectToken(t.address); };
      const td0 = mk('td'); td0.append(mk('span', 'ws-sym', t.symbol || short(t.address)), mk('small', 'ws-row-name', t.name || t.dex || ''));
      const act = mk('td', 'num'); act.append(ibtn('watch', 'Watch', run(async () => { const data = await call2(window.aurora.walletWatchlistAdd(t.address)); window.toast(`${(t.symbol || short(t.address)).trim()} added to your watchlist.`); return data; })));
      tr.append(td0, mk('td', 'num', money(t.priceUsd)), changeTd(t.change5m), changeTd(t.change1h), changeTd(t.change24h), mk('td', 'num', t.liquidityUsd ? `$${compact(t.liquidityUsd)}` : '—'), mk('td', 'num', t.volume24h ? `$${compact(t.volume24h)}` : '—'), mk('td', 'num', t.marketCap ? `$${compact(t.marketCap)}` : '—'), mk('td', 'num', ageLabel(t.createdAt)), act);
      tb.append(tr);
    }
    table.append(tb); return table;
  }
  function narrativesTable(items) {
    if (!items.length) return emptyState('discover', 'No narratives', 'DexScreener returned nothing right now.');
    const table = mk('table', 'hf-table ws-screener');
    const thead = mk('thead'); const htr = mk('tr'); for (const [label, num] of [['Narrative', false], ['Tokens', true], ['Mkt cap', true], ['Volume', true], ['24h', true]]) htr.append(mk('th', num ? 'num' : '', label)); thead.append(htr); table.append(thead);
    const tb = mk('tbody');
    for (const m of [...items].sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0))) { const tr = mk('tr'); const td0 = mk('td'); td0.append(mk('span', 'ws-sym', m.name || m.slug), mk('small', 'ws-row-name', m.description || '')); tr.append(td0, mk('td', 'num', num(m.tokenCount)), mk('td', 'num', m.marketCap ? `$${compact(m.marketCap)}` : '—'), mk('td', 'num', m.volume ? `$${compact(m.volume)}` : '—'), changeTd(m.change24h)); tb.append(tr); }
    table.append(tb); return table;
  }
  function drawDiscover(root, s) {
    head(root, 'Discover', 'Screen Solana tokens: trending, new pairs, takeovers and narratives.');
    const TABS = [['trending', 'Trending'], ['new', 'New pairs'], ['takeovers', 'Takeovers'], ['narratives', 'Narratives']];
    const tabs = mk('div', 'hf-tabs ws-disco-tabs');
    for (const [id, label] of TABS) { const b = mk('button', 'hf-tab'); b.type = 'button'; b.dataset.t = id; b.setAttribute('role', 'tab'); b.append(mk('span', '', label)); b.onclick = () => { discoverTab = id; savePrefs(); render(); }; tabs.append(b); }
    const search = mk('input', 'hf-input ws-disco-search'); search.type = 'search'; search.placeholder = 'Filter by symbol, name or mint'; search.value = discoverQuery;
    const liq = mk('select', 'hf-input ws-disco-liq'); for (const [label, val] of [['Any liquidity', 0], ['≥ $10k', 1e4], ['≥ $50k', 5e4], ['≥ $250k', 25e4], ['≥ $1M', 1e6]]) { const o = mk('option', '', label); o.value = String(val); liq.append(o); } liq.value = String(discoverMinLiq);
    const refresh = btn('Refresh', { sm: true, variant: 'ghost', icon: 'refresh' }, () => { discover.items[discoverTab] = null; discover.error[discoverTab] = ''; render(); });
    const controls = mk('div', 'ws-disco-controls'); controls.append(search, liq, mk('span', 'ws-top-spacer'), refresh);
    const body = mk('div', 'ws-disco-body');
    root.append(tabs, controls, body);
    search.oninput = () => { discoverQuery = search.value; render(); };
    liq.onchange = () => { discoverMinLiq = Number(liq.value); render(); };
    const load = async () => {
      const tab = discoverTab;
      if (discover.loading[tab]) return;
      discover.loading[tab] = true; discover.error[tab] = '';
      body.replaceChildren(skeleton(6));
      try { discover.items[tab] = await call2(window.aurora.walletDiscover(tab)); }
      catch (error) { discover.error[tab] = error.message; }
      finally { discover.loading[tab] = false; }
      if (open && section === 'discover') render();
    };
    function render() {
      for (const b of tabs.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.t === discoverTab));
      const isNarr = discoverTab === 'narratives';
      search.hidden = isNarr; liq.hidden = isNarr; refresh.hidden = false;
      if (discover.error[discoverTab]) { body.replaceChildren(emptyState('discover', 'Could not load', discover.error[discoverTab])); body.append(btn('Retry', { sm: true, variant: 'ghost', icon: 'refresh' }, () => { discover.error[discoverTab] = ''; discover.items[discoverTab] = null; render(); })); return; }
      if (!discover.items[discoverTab]) { if (!discover.loading[discoverTab]) load(); return; }
      const items = discover.items[discoverTab] || [];
      if (isNarr) { body.replaceChildren(narrativesTable(items)); return; }
      const q = discoverQuery.trim().toLowerCase();
      const rows = items.filter(t => (t.liquidityUsd || 0) >= discoverMinLiq && (!q || `${t.symbol} ${t.name} ${t.address}`.toLowerCase().includes(q)));
      body.replaceChildren(screenerTable(rows, render));
    }
    render();
  }

  function drawResearch(root, s) {
    const target = chartMint || (s.holdings || [])[0]?.mint || '';
    const reports = wallet()?.research || [];
    head(root, 'Research', 'Deep reports run as a job, save a revision, and say what could not be verified.');
    const token = field('Token mint', 'text'); token.querySelector('input').value = target; token.querySelector('input').spellcheck = false;
    const runForm = mk('div', 'ws-runform');
    runForm.append(token, btn('Run research', { variant: 'primary', sm: true, icon: 'research' }, run(async () => { const mint = (inputOf(token) || '').trim(); if (!mint) throw Error('Enter a token mint.'); return call2(window.aurora.walletResearchStart({ mint, symbol: sym(mint, s) })); })), btn('Use current token', { sm: true, variant: 'ghost' }, () => { const mint = chartMint || (s.holdings || [])[0]?.mint || ''; token.querySelector('input').value = mint; }));
    root.append(panel('New report', {}, runForm));
    const list = mk('div', 'ws-list');
    if (!reports.length) list.append(emptyState('research', 'No reports yet', 'Run a report above to keep its evidence.'));
    for (const item of reports) {
      const ct = mk('div', 'ws-ctrls');
      if (item.status === 'running') ct.append(ibtn('pause', 'Cancel', run(async () => call2(window.aurora.walletResearchCancel()))));
      else if (item.hasReport) ct.append(ibtn(reportOpen === item.id ? 'chevron' : 'external', reportOpen === item.id ? 'Close' : 'Open', run(async () => { if (reportOpen === item.id) { reportOpen = ''; reportText = ''; } else { const r = await call2(window.aurora.walletResearchReport(item.id)); reportOpen = item.id; reportText = r.report; } draw(); })));
      ct.append(ibtn('delete', 'Delete', run(async () => call2(window.aurora.walletResearchRemove(item.id)))));
      const badge = mk('span', `hf-badge${item.status === 'ready' ? ' ok' : item.status === 'running' ? '' : ' muted'}`, item.status);
      list.append(listItem(item.symbol || short(item.mint), `${new Date(item.createdAt).toLocaleString()}${item.error ? ' · ' + item.error : ''}`, undefined, undefined, ct, badge));
      if (reportOpen === item.id && reportText) {
        const report = mk('div', 'ws-report');
        const rhead = mk('div', 'ws-report-head');
        rhead.append(mk('strong', '', item.symbol || short(item.mint)), mk('span', 'ws-sub', new Date(item.createdAt).toLocaleString()), mk('span', 'ws-top-spacer'), btn('Copy', { sm: true, variant: 'ghost', icon: 'share' }, async () => { try { await navigator.clipboard.writeText(reportText); window.toast('Report copied.'); } catch { window.toast('Could not copy.'); } }));
        const rbody = mk('div', 'ws-report-body');
        try { if (window.AuroraMarkdown) window.AuroraMarkdown.render(rbody, reportText); else rbody.textContent = reportText; } catch { rbody.textContent = reportText; }
        report.append(rhead, rbody); list.append(report);
      }
    }
    root.append(panel('Saved reports', {}, list));
  }

  function thesisCard(t) { const card = mk('div', 'ws-view'); const headr = mk('div', 'ws-view-head'); const ico = mk('div', 'ws-view-ico'); ico.append(ic('strategies', 16)); const title = mk('div', 'ws-view-title'); title.append(mk('strong', '', t.name), mk('small', '', t.rationale || '')); const actions = mk('div', 'ws-ctrls'); if (t.status !== 'active') actions.append(btn('Run in paper', { sm: true, variant: 'primary' }, run(async () => call2(window.aurora.walletThesisActivate(t.id))))); actions.append(ibtn('share', 'Copy call card', run(async () => { const r = await call2(window.aurora.walletThesisShare(t.id)); try { await navigator.clipboard.writeText(r.text); window.toast('Call card copied.'); } catch { window.toast('Could not copy.'); } }))); actions.append(ibtn('delete', 'Delete thesis', run(async () => call2(window.aurora.walletThesisRemove(t.id))))); headr.append(ico, title, mk('span', 'ws-top-spacer'), mk('span', `hf-badge${t.status === 'active' ? ' ok' : ' muted'}`, t.status), actions); card.append(headr); const body = mk('div', 'ws-view-body'); for (const leg of t.legs || []) { const row = mk('div', 'ws-leg'); row.append(mk('span', `ws-leg-side ${leg.side}`, leg.side), mk('strong', '', leg.symbol || short(leg.mint)), mk('span', 'ws-sub', leg.side === 'long' ? money(leg.sizeUsd) : 'note'), mk('span', 'ws-top-spacer'), mk('span', 'ws-sub', leg.note || '')); body.append(row); } if (t.exits?.text || t.exits?.stopLossPct || t.exits?.takeProfitPct) body.append(mk('p', 'ws-sub', `Exit: ${[t.exits.stopLossPct ? `stop ${t.exits.stopLossPct}%` : '', t.exits.takeProfitPct ? `target ${t.exits.takeProfitPct}%` : '', t.exits.text].filter(Boolean).join(' · ')}`)); card.append(body); return card; }
  function drawWatch(root, s) {
    const marks = (typeof view !== 'undefined' && view.notifications) || [];
    head(root, 'Watch', 'Tokens you follow, price alerts, and your notification inbox.');
    const watch = s.watchlist || [];
    const table = mk('table', 'hf-table ws-watch-table');
    const thead = mk('thead'); const htr = mk('tr'); for (const [label, n] of [['Token', false], ['Price', true], ['24h', true], ['Trend', true], ['', false]]) htr.append(mk('th', n ? 'num' : '', label)); thead.append(htr); table.append(thead);
    const tb = mk('tbody');
    if (!watch.length) { const tr = mk('tr'); const td = mk('td'); td.colSpan = 5; td.append(emptyState('watch', 'Nothing on your watchlist yet', 'Tap the star on any token in Discover or Trade.')); tr.append(td); tb.append(tr); }
    for (const m of watch) { const tr = mk('tr'); tr.dataset.mint = m.mint; const ch = m.change24h || 0; const td0 = mk('td'); td0.append(mk('span', 'ws-sym', m.symbol || short(m.mint))); const act = mk('td', 'num'); act.append(ibtn('alert', 'Set alert', () => { watchMint = m.mint; draw(); }), ibtn('trade', 'Trade', () => { section = 'trade'; selectToken(m.mint); }), ibtn('delete', 'Remove', run(async () => call2(window.aurora.walletWatchlistRemove(m.mint))))); tr.append(td0, mk('td', 'num', money(m.price)), mk('td', `num ${ch >= 0 ? 'hf-up' : 'hf-down'}`, `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`), mk('td', 'num ws-spark'), act); tb.append(tr); }
    table.append(tb); root.append(panel('Watchlist', {}, table));
    for (const m of watch.slice(0, 20)) seriesOf(m.mint).then(points => { const row = tb.querySelector(`tr[data-mint="${CSS.escape(m.mint)}"]`); if (row && points && points.length >= 2) row.querySelector('.ws-spark').append(sparkline(points)); });
    const target = watchMint || chartMint || (s.markets || [])[0]?.mint || '';
    root.append(panel('Price alerts', {}, alertForm(target, sym(target, s), s), alertsBody(s)));
    const notes = mk('div', 'ws-list');
    if (!marks.length) notes.append(emptyState('alert', 'No notifications yet', 'Price alerts and signals land here.'));
    for (const n of [...marks].reverse()) { const badge = mk('span', `hf-badge${n.kind === 'alert' ? ' ok' : n.kind === 'signal' ? '' : ' muted'}`, n.kind); notes.append(listItem(n.title, `${n.body}${n.read ? '' : ' · new'} · ${new Date(n.at).toLocaleTimeString()}`, undefined, undefined, undefined, badge)); }
    root.append(panel('Notifications', { actions: [btn('Mark all read', { sm: true, variant: 'ghost' }, run(async () => call2(window.aurora.notificationsRead()))), btn('Clear', { sm: true, variant: 'ghost' }, run(async () => call2(window.aurora.notificationsClear())))] }, notes));
  }

  function drawStrategies(root, s) {
    const limits = cfg().limits || {};
    head(root, 'Strategies', `Typed rules and theses, paper by default. Limits: position ${limits.maxPositionUsd ? money(limits.maxPositionUsd) : 'off'} · total ${limits.maxTotalUsd ? money(limits.maxTotalUsd) : 'off'} · daily ${limits.dailyCapUsd ? money(limits.dailyCapUsd) : 'off'}.`, [btn('Describe to Gigi', { variant: 'primary', sm: true, icon: 'chat' }, () => askGigi('Help me build a Solana strategy or thesis: token, signal, threshold, sizing in USD, cooldown, exits and limits. Show the rules, then activate it in paper.'))]);
    const grid = mk('div', 'ws-canvas'); for (const t of wallet()?.theses || []) grid.append(thesisCard(t)); if ((wallet()?.theses || []).length) root.append(grid);
    const list = mk('div', 'ws-list'); const strategies = wallet()?.strategies || [];
    if (!strategies.length) list.append(emptyState('strategies', 'No rule strategies yet', 'Describe one to Gigi.'));
    for (const st of strategies) {
      const ct = mk('div', 'ws-ctrls');
      ct.append(
        ibtn('switch', 'Switch paper/live', run(async () => call2(window.aurora.walletStrategySave({ ...st, execution: st.execution === 'live' ? 'paper' : 'live' })))),
        ibtn(st.status === 'active' ? 'pause' : 'play', st.status === 'active' ? 'Pause' : 'Activate', run(async () => call2(window.aurora.walletStrategyStatus({ id: st.id, status: st.status === 'active' ? 'paused' : 'active' })))),
        ibtn('run', 'Run once', run(async () => { const r = await call2(window.aurora.walletStrategyRun(st.id)); window.toast(r.executed ? 'Triggered.' : (r.error || 'Conditions not met.')); })),
        ibtn('delete', 'Delete', run(async () => call2(window.aurora.walletStrategyRemove(st.id))))
      );
      const badge = mk('span', `hf-badge${st.status === 'active' ? ' ok' : ' muted'}`, st.status === 'active' ? `${(st.execution || 'paper').toUpperCase()} · ACTIVE` : (st.execution || 'paper').toUpperCase());
      list.append(listItem(`${st.name} · ${st.symbol || short(st.mint)}`, `${(st.conditions || []).map(c => `${c.metric} ${c.op} ${num(c.value)}`).join(st.logic === 'or' ? ' OR ' : ' AND ')}${st.lastError ? ' · ' + st.lastError : ''}`, undefined, undefined, ct, badge));
    }
    root.append(panel('Rule strategies', {}, list));
    root.append(panel('New signal', {}, signalForm(s)));
    const sigList = mk('div', 'ws-list'); const sigs = wallet()?.signals || [];
    if (!sigs.length) sigList.append(emptyState('alert', 'No signals yet', 'Create one above, or ask Gigi: “ping me when SOL drops 20%.”'));
    for (const sg of sigs) { const ct = mk('div', 'ws-ctrls'); ct.append(ibtn(sg.enabled ? 'pause' : 'play', sg.enabled ? 'Disable' : 'Enable', run(async () => call2(window.aurora.walletSignalToggle(sg.id, !sg.enabled)))), ibtn('delete', 'Delete', run(async () => call2(window.aurora.walletSignalRemove(sg.id))))); const badge = mk('span', `hf-badge${sg.enabled ? ' ok' : ' muted'}`, sg.action === 'paper-buy' ? 'paper buy' : 'notify'); sigList.append(listItem(`${sg.name} · ${sg.symbol || short(sg.mint)}`, `${sg.condition.metric} ${sg.condition.op} ${num(sg.condition.value)}${sg.requireResearch ? ' · needs fresh research' : ''}${sg.lastTriggeredAt ? ' · last ' + new Date(sg.lastTriggeredAt).toLocaleString() : ''}`, undefined, undefined, ct, badge)); }
    root.append(panel('Signals', {}, sigList));
  }

  function csvDownload(name, rows) { const csv = rows.map(row => row.map(cell => `"${String(cell == null ? '' : cell).replace(/"/g, '""')}"`).join(',')).join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = mk('a'); a.href = url; a.download = name; a.style.display = 'none'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function journalRows(p, s) { const rows = []; for (const o of p?.orders || []) rows.push({ kind: 'paper', at: o.at, mint: o.mint, symbol: o.symbol || short(o.mint), side: o.side, value: o.valueUsd, pnl: o.side === 'sell' ? o.realizedPnlUsd : '', status: '', signature: '' }); for (const ex of wallet()?.executions || []) rows.push({ kind: 'live', at: ex.at, mint: ex.mint, symbol: sym(ex.mint, s), side: ex.side, value: '', pnl: '', status: ex.status, signature: ex.signature || '' }); return rows.sort((a, b) => b.at - a.at); }
  function drawJournal(root, s) {
    const p = paper(); const all = journalRows(p, s);
    head(root, 'Journal', 'Every paper order and live execution, tied to research and revisions.', [btn('Export CSV', { sm: true, variant: 'ghost', icon: 'external', disabled: !all.length }, () => { if (!all.length) return; csvDownload(`aurora-journal-${Date.now()}.csv`, [['kind', 'when', 'symbol', 'side', 'value', 'pnl', 'status', 'signature'], ...all.map(row => [row.kind, new Date(row.at).toISOString(), row.symbol, row.side, row.value, row.pnl, row.status, row.signature])]); window.toast('Journal exported.'); })]);
    const filtered = all.filter(row => (journalKind === 'all' || row.kind === journalKind) && (!journalFilter || `${row.symbol} ${row.mint || ''}`.toLowerCase().includes(journalFilter.toLowerCase())));
    const filter = mk('input', 'hf-input'); filter.type = 'search'; filter.placeholder = 'Filter by token'; filter.value = journalFilter; filter.oninput = () => { journalFilter = filter.value; draw(); };
    const kindSel = mk('select', 'hf-input'); for (const k of ['all', 'paper', 'live']) { const opt = mk('option', '', k === 'all' ? 'All orders' : k === 'paper' ? 'Paper' : 'Live'); opt.value = k; kindSel.append(opt); } kindSel.value = journalKind; kindSel.onchange = () => { journalKind = kindSel.value; draw(); };
    const controls = mk('div', 'ws-form'); controls.append(filter, kindSel); root.append(panel('', {}, controls));
    const list = mk('div', 'ws-list');
    for (const row of filtered.slice(0, 60)) { const pnl = row.pnl !== '' && row.pnl != null ? ` · P/L ${money(row.pnl)}` : ''; const sub = `${new Date(row.at).toLocaleString()} · ${row.kind}${row.signature ? ' · ' + row.signature.slice(0, 8) + '…' : ''}${row.status ? ' · ' + row.status : ''}${pnl}`; list.append(listItem(`${row.side === 'buy' ? 'Bought' : 'Sold'} ${row.symbol}`, sub, row.value !== '' ? money(row.value) : undefined, undefined, undefined, mk('span', `hf-badge${row.status === 'confirmed' ? ' ok' : row.status === 'failed' ? ' live' : ' muted'}`, row.kind))); }
    root.append(panel('Orders', {}, filtered.length ? list : emptyState('journal', all.length ? 'No matches' : 'No orders yet', all.length ? 'Try another filter.' : 'Paper trades, conditions and live swaps appear here.')));
  }

  // ---- command palette ----
  function paletteCommands() { const cmds = []; for (const [id, label] of SECTIONS) cmds.push({ label: `Go to ${label}`, hint: 'section', id, run: () => { section = id; savePrefs(); draw(); } }); if (chartMint) { cmds.push({ label: 'Paper buy 25', hint: 'action', run: () => call2(window.aurora.walletPaperBuy({ mint: chartMint, usd: 25 })) }); cmds.push({ label: 'Start research', hint: 'action', run: () => call2(window.aurora.walletResearchStart({ mint: chartMint, symbol: sym(chartMint, state()) })) }); cmds.push({ label: 'Show holders on canvas', hint: 'action', run: () => call2(window.aurora.walletViewShow({ type: 'holders', title: `Holders · ${sym(chartMint, state())}`, source: { kind: 'holders', mint: chartMint } })) }); } cmds.push({ label: cfg().execution === 'live' ? 'Switch to Paper' : 'Switch to Live', hint: 'action', run: () => call2(window.aurora.walletConfig({ execution: cfg().execution === 'live' ? 'paper' : 'live' })) }); cmds.push({ label: 'Open Settings', hint: 'settings', run: () => { close(); el('wallet-open')?.click(); } }); return cmds; }
  function renderPalette(query = '') { paletteList.replaceChildren(); const q = query.toLowerCase(); const cmds = paletteCommands().filter(c => !q || c.label.toLowerCase().includes(q)); for (const cmd of cmds) { const item = listItem(cmd.label, cmd.hint); item.style.cursor = 'pointer'; item.onclick = () => runPalette(cmd); paletteList.append(item); } if (query.trim().length >= 2) call2(window.aurora.walletSearch(query)).then(found => { for (const token of found.slice(0, 6)) { const item = listItem(`${token.symbol} · ${money(token.priceUsd)}`, 'search'); item.style.cursor = 'pointer'; item.onclick = () => { closePalette(); section = 'trade'; selectToken(token.address); }; paletteList.append(item); } }).catch(() => {}); }
  function runPalette(cmd) { closePalette(); Promise.resolve(cmd.run && cmd.run()).then(data => { if (isSnapshot(data)) window.render(data); }).catch(error => window.toast(error.message)); }
  function openPalette() { palette.hidden = false; paletteInput.value = ''; renderPalette(''); paletteInput.focus(); }
  function closePalette() { palette.hidden = true; }
  paletteInput.oninput = () => renderPalette(paletteInput.value);
  paletteInput.onkeydown = event => { if (event.key === 'Enter') { const first = paletteList.querySelector('.ws-item'); if (first) first.click(); } if (event.key === 'Escape') closePalette(); };
  palette.onclick = event => { if (event.target === palette) closePalette(); };

  // ---- wiring ----
  for (const b of ws.querySelectorAll('#ws-seg button')) b.onclick = run(async () => call2(window.aurora.walletConfig({ execution: b.dataset.exec })));
  el('ws-close').onclick = close; el('ws-settings').onclick = () => el('wallet-open')?.click();
  el('ws-chat-visible').onclick = () => { chatOpen = !chatOpen; savePrefs(); draw(); };
  el('ws-chat-collapse').onclick = () => { chatOpen = false; savePrefs(); draw(); };
  const resizer = el('ws-resizer'); resizer.onpointerdown = event => { event.preventDefault(); const startX = event.clientX, startW = chatW; const move = e => { chatW = Math.max(300, Math.min(720, startW - (e.clientX - startX))); chat.style.width = `${chatW}px`; }; const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); savePrefs(); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); };
  const search = el('ws-search'); let searchTimer;
  search.oninput = () => { clearTimeout(searchTimer); const q = search.value.trim(); if (!q) { results.hidden = true; return; } searchTimer = setTimeout(async () => { try { const found = await call2(window.aurora.walletSearch(q)); results.replaceChildren(); for (const token of found.slice(0, 10)) { const item = listItem(token.symbol, `${money(token.priceUsd)} · ${token.change24h >= 0 ? '+' : ''}${token.change24h.toFixed(2)}%`); item.style.cursor = 'pointer'; item.onclick = () => { results.hidden = true; search.value = ''; section = 'trade'; selectToken(token.address); }; results.append(item); } results.hidden = !found.length; } catch (error) { window.toast(error.message); } }, 300); };
  document.addEventListener('click', event => { if (!event.target.closest('.ws-search')) results.hidden = true; });
  document.addEventListener('keydown', event => { if (!open) return; if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openPalette(); } if (event.key === 'Escape') { closePalette(); results.hidden = true; } });

  window.AuroraWorkspace = { open: openWorkspace, enter: () => openWorkspace(true), close, isOpen: () => open, toggle: () => open ? close() : openWorkspace(true) };
  window.addEventListener('aurora-view-rendered', () => { if (!open) return; draw(); });
  window.aurora.onEvent(event => {
    if (event.type === 'wallet' && open) { if (typeof view !== 'undefined') view.wallet = event.wallet; draw(); }
    if (event.type === 'view' && open) { if (typeof view !== 'undefined' && view.wallet) view.wallet.view = event.view; if (section !== 'canvas') { section = 'canvas'; savePrefs(); } draw(); window.toast('Gigi added a view to the canvas.'); }
    if (event.type === 'wallet-signal') window.toast(`Signal · ${event.signal.name}${event.signal.detail ? ' · ' + event.signal.detail : ''}`);
    if (event.type === 'notification') { if (typeof view !== 'undefined') view.notifications = event.notifications; if (open) draw(); }
    if (event.type === 'wallet-alert') window.toast(`Alert · ${event.alert.symbol || short(event.alert.mint)} ${event.alert.direction} ${money(event.alert.price)} (now ${money(event.alert.current)})`);
  });
  const navButton = el('trading-open'); if (navButton) navButton.onclick = () => window.AuroraWorkspace.toggle();
})();
