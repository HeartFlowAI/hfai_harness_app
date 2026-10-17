# Gigi desk: state, gaps, and work to make every function actually work

## 0. Orientation

- Repo `~/Projects/hfai_harness_app`, branch `main`, `v0.6.0`. Tests: `npm run check` + `node --test test/*.test.js` (183 tests, 182 pass, 1 skipped).
- The desk is `src/workspace.js` (mounts inside `<main>`), styled by `src/workspace.css` + the `src/ui.css` design system. All wallet logic is in `src/wallet/*`. IPC lives in `src/main.js`, exposed by `src/preload.js`.
- Sections are dispatched at `src/workspace.js:78`: `canvas, portfolio, trade, discover, research, strategies, journal`.
- Settings wallet dialog (`src/index.html:27`, driven by `src/wallet-ui.js`) holds addresses, RPC, WalletConnect project ID + connect, display/execution mode, strategy limits, and the bot vault.

Bottom line: the read/analysis side (portfolio, charts, holders, markets) is now real and working. The **action side** of the desk (live trade buttons, alerts, signal/strategy authoring in the UI, in-vault signing) is where "each function actually works" is not yet true.

---

## 1. What is genuinely still broken or half-wired (prioritized)

### P0. Portfolio performance chart does not equal the portfolio total
- `portfolioHistory` only aggregates up to 8 holdings, markets-first, and only those with price history (`src/wallet/index.js`, around lines 248 to 272). So the chart's last point can be far below `state.total` (a wallet whose value sits in long-tail tokens with no Binance/CoinGecko listing charts almost nothing).
- Fix options: include every priced holding that has history (cap only for cost), or label the chart "priced holdings only", or show both numbers. Right now it silently misleads.

### P0. Price alerts are orphaned
- Backend exists: `state.alerts`, `onAlert` emits `wallet-alert` (`src/main.js:691`), `walletAlertAdd`/`walletAlertRemove` exist in `src/preload.js:21-22`. But there is **no UI anywhere** to create or view alerts (grep of `workspace.js`, `wallet-ui.js`, `renderer.js` finds none). Alerts can only be created by the agent via tools, and are invisible in the desk.
- Fix: an Alerts panel in the desk (Strategies tab next to Signals) with add/remove, and an alert action on the Trade screen.

### P0. Trade has no live buy/sell, and Watch gives no feedback
- Trade is paper-only (`src/workspace.js:168-185`). Live swaps exist only through strategies/live intents and `wallet-swap-preview`/`wallet-swap-execute` in Settings. There is no live buy in the desk's Trade screen even in Live mode.
- The **Watch** button (`src/workspace.js:170`) calls `walletWatchlistAdd` but never toasts, and does not refresh state, so it looks like nothing happened.

### P1. Range granularity is coarse and can mismatch the live price
- For every range except `1D`, history uses the Binance `1d` series (`src/wallet/index.js` around line 215 and in `ensureSeries`). So `7D` on SOL shows 7 points. `1D` correctly uses `1h`. There is no per-range interval (e.g., `7D` = `1h`, `30D` = `4h`, `3M` = `1d`, `1Y/ALL` = `1d`/`1w`).
- The chart "Last" comes from history, while the Trade header price comes from DexScreener (`pair.priceUsd`). They can disagree by up to a day on daily candles. Append the live price as the final point to reconcile.

### P1. Long-tail tokens show "No price history yet." with no explanation
- `drawChart` shows a bare message when `points.length < 2` (`src/workspace.js:56`). CoinGecko is the only fallback for non-Binance tokens and it is throttled/429-prone (`src/wallet/index.js`, `schedule`), so a user watching a small token sees an empty chart and no reason or retry.

### P1. Signals and strategies are agent-only to author
- Signals can be created only via the `signal_create` tool; the desk only lists them (`src/workspace.js:227`). Strategies likewise are listed but not authored in the UI. For "each function works", add forms (name, mint, condition metric/op/value, action notify vs paper-buy, cooldown, research gate).

### P1. WalletConnect and the vault are unverified end to end
- `src/wallet/connect.js:18` requires a Reown project ID. The connect button in Settings copies the URI and waits, but the full handshake, session persistence (`wcSession`, `wcStorage`) and `signTransaction`/`signMessage` round trip have not been validated live.
- `src/wallet/vault.js` only does keygen/import/publicFromSecret; it does **not sign**. The Settings copy already says signing is pending (C17). Live swaps therefore always use the connected external wallet.

### P2. Candle charts absent
- Charts are close-line/area only (`drawChart`). Binance klines already return OHLC; rendering candles is a small extension and a big perceived-quality jump.

### P2. Discover "Popular Solana pairs" is a search, not trending
- `src/workspace.js:188` and the `loadTrending` helper call `walletSearch('SOL')`, which is a DexScreener text search. It is stable but not real trending. DexScreener token-boosts or GeckoTerminal trending are better (GeckoTerminal now needs a key; token-boosts is free).

### P2. Dead code and small inconsistencies
- Unused now: `historyTried` (`src/wallet/index.js:111`), `seedHistory` + `historyQueue` (lines 193-202), and `RANGE_DAYS` no longer used internally (only exported). `drawChart` has a `height` param but CSS forces `.ws-chart svg` to 280px (`src/workspace.css:83`), so the 200px portfolio chart is also 280px.

### P2. Theme parity not audited
- Several styles use `rgba(255,255,255,...)` overlays (e.g., `src/workspace.css` hover chips) which assume a dark surface. Confirm the desk, canvas tiles, thesis cards and holders render correctly on all four themes (Heartflow, Midnight, Ember, Mint), especially if any is light.

### P2. Missing tests
- No test for `providers.binanceHistory`; no test for `portfolioHistory` slicing across ranges beyond the one happy path; no test that a signal with `action: 'paper-buy'` actually places a paper order through `onSignal`; no test for alert firing; no DOM smoke test for desk sections (there is `test/workspace-browser.test.js`, but that is the embedded browser, not the desk).

---

## 2. Missing updates so each function actually works (by section)

### Canvas
- Add a per-tile refresh/retry affordance and an explicit "no history for this token" state that names the cause (Binance: not listed; CoinGecko: rate limited, retry).
- Support candles and a "thesis/notes" default when Gigi asks to visualize with no data.
- Add a "clear canvas" and per-tile full-width toggle persistence beyond `layout`.

### Portfolio
- Reconcile chart vs total (P0 above). Add a total line or a caption "chart covers priced holdings (n of m)".
- Per-wallet breakdown using `holding.address` (already present) when multiple addresses are watched.
- Add realized/unrealized PnL for paper positions and a paper equity curve (samples already recorded every 60s).
- Add "Add address" and "Connect wallet" shortcuts inside the desk, not only in Settings.

### Trade
- Add a **Live** path: when execution mode is Live and a WalletConnect session exists, show Buy/Sell that call `walletSwapPreview` then `walletSwapExecute` with the approval dialog; keep paper as default.
- Toast on Watch success/failure and reflect the new watchlist immediately.
- Add a **Set alert** action (uses `walletAlertAdd`).
- Reconcile chart last point with live price; add candles; add a DexScreener deep link using `window.aurora` external-open if available (otherwise render the URL).
- Surface `safety.flags` (not just "revoked") and RugCheck risk list.

### Discover
- Switch to real trending (DexScreener token-boosts) with the search as fallback. Add filters (min liquidity, min volume) and a "Watch"/"Trade" quick action per card (Trade exists; Watch exists, add feedback).

### Research
- The job pipeline exists; add a visible report viewer (there is `walletResearchReport`), a diff between revisions, and a "use as signal gate" shortcut.
- Show why a signal's `freshResearch` gate is closed (no report, or older than `researchMaxAgeMin`).

### Strategies, Signals, Alerts
- Authoring forms in the desk (see P1). Add enable/disable, run-now (`walletStrategyRun`), and a clear "why didn't it run" panel using `lastDetail`/`lastError`.
- Make the alerts list a first-class panel with create/remove.

### Journal
- Add filters (paper vs live, token), CSV export, and per-order drill-down including `thesisId`/`strategyId` links back to their source.

### Wallet (Settings)
- Validate WalletConnect end to end; persist and restore sessions; implement `signTransaction`/`signMessage` handlers in `wallet/index.js` using the WC client.
- Implement in-vault signing (C17): `src/wallet/vault.js` needs a `signTransaction(secret, tx)` and a hardened key-use path, then wire it into `swap.execute` as an alternative signer.
- Guard rails: confirm each live action, respect `limits` (max position/total/daily) in the desk, and show remaining daily cap.

---

## 3. Optimisations (make it fast and robust)

Data and network
- Persist ranged history to disk with a TTL: `1D` refetch after ~10 min, `1d` series after ~6 to 12 h, `ALL` after ~24 h. First open of any desk would then be instant across restarts.
- Per-range Binance interval map (`1D` = `15m`/`1h`, `7D` = `1h`, `30D` = `4h`, `3M` = `1d`, `6M`/`1Y`/`ALL` = `1d`/`1w`). One request per range bucket, cached.
- Auto-map unknown symbols to `${symbol}USDT` on Binance with a one-time validation, so more tokens get reliable history without CoinGecko.
- Cache negative CoinGecko results for a short TTL so unlisted tokens do not hammer the queue on every draw.
- Keep the global CoinGecko limiter, but make it a proper token bucket with jittered backoff and a hard per-minute cap, and surface a "sources busy, retrying" state to the UI.
- Cache `walletTokenInfo` and `walletHolders` with short TTLs; both are re-fetched on every `draw()`.

Rendering and state
- Append the live Jupiter/DexScreener price as the last series point so charts end "now".
- Dedupe in-flight `walletPortfolioSeries` calls and debounce redraws triggered by `wallet` events (markets update every 60s).
- Virtualize the holdings table (it can be thousands of rows for spam wallets before the price filter).
- Batch `onUpdate` emits; today every `ensureSeries` completion emits a full wallet event.

Cleanup and correctness
- Remove dead code (`historyTried`, `seedHistory`, `historyQueue`, unused `RANGE_DAYS`), make `drawChart` height real or drop the param.
- Currency: `config.currency` exists and is validated but every number is USD. Either implement conversion or remove the setting.
- Add `aria` to charts (role img with `aria-label` summarizing range and change) and to holders bars.

Testing
- Add `test/markets` cases for `binanceHistory` parsing, `portfolioHistory` across ranges and missing-major fallbacks, signal `paper-buy` end to end via a manager with `onSignal`, and alert firing.
- Add a lightweight DOM smoke test for `workspace.js` sections (jsdom + a stubbed `window.aurora`) asserting each tab renders without throwing and shows an empty state or data.

---

## 4. Data sources, limits, and constraints to keep in mind

- Prices: Jupiter `lite-api.jup.ag/price/v3` (batched 50 ids) plus DexScreener for pair metrics and live token price.
- History: Binance `api.binance.com/api/v3/klines` first (no key, generous, majors only), CoinGecko `coins/solana/contract/{mint}/market_chart` as fallback (heavily rate limited, throttled + retried, cached, sliced locally).
- Holders: RugCheck `api.rugcheck.xyz/v1/tokens/{mint}/report` (count, concentration, risks). Public Solana RPCs are now 403/429 for `getTokenLargestAccounts`, so RugCheck is primary; the RPC path is a last resort.
- WalletConnect requires a Reown project ID (`src/wallet/connect.js:18`); live signing is via the external wallet only.
- Charts are close-line/area; no candles. Shorts/hedges on Solana spot do not exist, so thesis short/hedge legs are notes. Voice/notch remain Windows-only.

---

## 5. Acceptance criteria ("each function actually works")

- Portfolio: performance chart drawn for `30D` and `1Y` on a wallet holding SOL/BONK; the last chart value is within a small tolerance of `state.total`, or the UI explicitly states which holdings are covered.
- Trade: for a Binance-listed token, all five metrics render, the chart draws for `1D`, `7D`, `30D`, and `1Y`, Watch shows a toast and appears in the watchlist, Holders renders count + concentration + risks, and in Live mode Buy/Sell run preview, approval and execute.
- Alerts: create an alert in the desk, price crosses, a toast fires once, it shows in the alerts list and can be removed.
- Signals: create a signal in the desk, it fires as configured (notify or paper buy), respects cooldown and the research gate, and toggling/removing works.
- Strategies: create, enable, run now, and observe executed/blocked reason.
- Wallet: WalletConnect connect persists across restart; a live swap signs and confirms; limits block an over-cap trade.
- No console exceptions across all seven tabs on all four themes.

---

## 6. Prompt for the next chat

```
Work in ~/Projects/hfai_harness_app (Electron app, branch main, at tag v0.6.0).
Read this before touching code: src/workspace.js is Gigi's desk (sections dispatch line ~78),
src/wallet/* is all wallet logic (index.js manager, providers.js data sources, markets.js feed,
solana.js, swap.js, connect.js, vault.js, paper.js, strategy.js, session.js),
src/main.js has IPC + agent tools context, src/preload.js exposes window.aurora.wallet*.
Styling: src/ui.css design system, src/workspace.css desk, src/themes.css, src/wallet.css.

House rules: no em/en dashes in prose, no AI filler, keep the existing code style, add tests
for new logic, and run `npm run check` and `node --test test/*.test.js` before finishing.
To run the app: npm start. To drive it: ./node_modules/.bin/electron . --remote-debugging-port=9333
then hit http://127.0.0.1:9333/json. macOS: no `timeout`, no `rg`.

Goal: make every desk function actually work, in this order.
1. Portfolio perf chart must match the portfolio total, or clearly say which holdings are covered
   (src/wallet/index.js portfolioHistory only uses up to 8 markets-first holdings).
2. Add price-alert UI in the desk (backend already exists: walletAlertAdd/Remove, onAlert emits
   'wallet-alert') with create/remove and an alert action on Trade; toast on fire.
3. Trade: add live Buy/Sell when execution mode is Live and a WalletConnect session exists
   (wallet-swap-preview + wallet-swap-execute with the approval dialog, respecting data.wallet.limits),
   toast on Watch success, add a Set-alert action, reconcile chart last point with the live price.
4. Per-range Binance interval mapping (1D=1h/15m, 7D=1h, 30D=4h, 3M/6M/1Y/ALL=1d/1w) and persist
   ranged history to disk with a TTL so restarts are instant. Auto-map unknown symbols to
   SYMBOLUSDT on Binance with one-time validation before falling back to CoinGecko.
5. Authoring forms in the desk for signals and strategies (name, mint, metric/op/value, action
   notify|paper-buy, cooldown, research gate), plus enable/disable and run-now.
6. Candles option for charts (Binance already returns OHLC), and an explicit "source busy, retry"
   state instead of a bare "No price history yet."
7. Cleanup: remove dead code (historyTried, seedHistory, historyQueue, unused RANGE_DAYS), fix the
   ignored drawChart height, add aria labels to charts and holders bars, and audit all four themes.
8. Tests: binanceHistory parsing, portfolioHistory across ranges and missing-major fallbacks,
   signal paper-buy via onSignal, alert firing, and a jsdom smoke test of the seven desk sections.

Constraints to respect: CoinGecko free tier rate-limits hard (throttle, retry, cache, slice locally);
Binance klines is the primary history source; RugCheck is the holders source; public Solana RPCs are
unreliable; WalletConnect needs a Reown project ID; in-vault signing (C17) is not implemented yet.

When done, report what renders and what still does not, with file:line references, and do not commit
unless asked.
```

---

## 7. Progress log

### 2026-10-16 (first pass on the plan above)

Landed (all tests green: `npm run check`, 185 pass, 1 skipped):

- **Portfolio coverage (P0, item 1).** `portfolioHistory` now delegates to a new
  `portfolioSeries(range)` (`src/wallet/index.js:256`) that considers every priced
  holding, prefetches the top 20 by value (`PORTFOLIO_SERIES_CAP`), and returns
  `{ points, covered, considered, holdings, total, range }`. The IPC handler
  (`src/main.js:926`) returns that object and the desk renders a caption when the
  chart covers fewer holdings than the wallet holds (`src/workspace.js:131`).
- **Per-range Binance intervals (P1, item 4).** `RANGE_INTERVAL` (`src/wallet/index.js:16`)
  maps `1D`→15m/96, `7D`→1h/168, `30D`→4h/180, `3M`/`6M`/`1Y`→1d, `ALL`→1w. `ensureSeries`
  is range-keyed and an in-memory TTL (`SERIES_TTL`) drops stale series so a range is
  refetched at most once per TTL instead of on every draw.
- **Dead-code cleanup (P2, item 7).** Removed `historyTried`, `seedHistory`, `historyQueue`.
- **Price alerts UI (P0, item 2).** A reusable `alertForm`/`alertsBody` in the desk; a
  `Price alert` panel on Trade and a `Price alerts` panel in Strategies, plus a
  `wallet-alert` toast (`src/workspace.js`). Backend was already wired.
- **Trade (P0/P1, item 3).** Watch now toasts and refreshes; live `Live buy`/`Live sell all`
  appear when execution is live and a WalletConnect session exists, running preview → a
  confirmation showing minimum out and price impact → execute, and respecting
  `maxPositionUsd`. Alert form added in the same right column.
- **Signals authoring (P1, item 5).** A `New signal` form in Strategies creates signals via
  `walletSignalSave` (name, metric, operator, value, action, USD, cooldown, research gate).
- **Charts (P2, item 7).** `drawChart` respects its `height` argument via inline style and
  sets a descriptive `aria-label`; the bare empty state names the sources to try.
- **Tests (item 8, partial).** Added: `binanceHistory` parsing (`test/markets.test.js`),
  `portfolioSeries` coverage + per-range interval (`test/wallet.test.js`), and a paper-buy
  signal firing `onSignal` with the rule and quote (`test/wallet.test.js`).

Still open (from the plan): disk-persisted history with TTL (only in-memory TTL is done),
CoinGecko negative caching, auto `SYMBOLUSDT` symbol mapping, candle charts, real DexScreener
trending, wallet-alert list refresh on fire, journal filters/CSV, holdings virtualization,
batched `onUpdate`, in-vault signing (C17), full WalletConnect handshake validation, jsdom
section smoke tests, and the four-theme audit.

### 2026-10-16 (second pass: candles, trending, journal)

Landed (tests: 186 pass, 1 skipped):

- **Candles.** `providers.binanceHistory` now returns OHLC (`{t,o,h,l,c,p}`, `src/wallet/providers.js:71`);
  the desk draws candles via `candlesSvg` (`src/workspace.js:60`) behind a `Candles` toggle on the
  Trade chart, persisted in `localStorage` under `aurora-desk`. Line/area remains the fallback when a
  series has no OHLC.
- **Real trending.** `providers.trending` reads DexScreener token boosts (Solana only) and enriches each
  with its best pair (`src/wallet/providers.js:88`), exposed as `wallet-trending` (`src/main.js:904`,
  `src/preload.js:18`). Discover now shows "Trending on Solana" with a `walletSearch('SOL')` fallback.
- **Journal.** Rewritten with a token filter, an all/paper/live selector, and an Export CSV button
  (`src/workspace.js:drawJournal`). CSV downloads client-side via a Blob.

Still open: disk-persisted history TTL, CoinGecko negative caching, auto `SYMBOLUSDT` mapping,
wallet-alert list refresh on fire, holdings virtualization, batched `onUpdate`, in-vault signing
(C17), full WalletConnect handshake validation, jsdom section smoke tests, and the four-theme audit.

### 2026-10-16 (third pass: persistence, alias mapping, theme tokens)

Landed (tests: 189 pass, 1 skipped):

- **Disk-persisted history.** Ranged series are stored in `config.historyCache` and sanitized on load
  (`sanitizeHistoryCache`, `src/wallet/index.js`), so a restart opens with charts already drawn. The
  manager reloads them at construction and persists on every successful fetch via `onHistory`
  (`src/main.js:691`).
- **Auto `SYMBOLUSDT` mapping.** `binanceSeriesFor` tries the curated symbol, then a one-time
  `${SYMBOL}USDT` probe for a market token with no mapping, remembering the result so an unknown token
  is not retried on every draw.
- **CoinGecko negative caching.** A failed lookup is remembered for `NEGATIVE_TTL` (5 min) so unlisted
  tokens stop hammering the throttled queue.
- **Batched updates.** Series completions now coalesce their redraw into one `onUpdate` (200 ms debounce)
  instead of emitting once per finished series.
- **Theme tokens.** Added a `--loss` token to all four themes and routed the desk's loss/safety colors
  through it (`ui.css`, `workspace.css`, `wallet.css`). Audit result: all four themes are dark, so the
  existing `rgba(255,255,255,...)` overlays are safe on every palette.
- Tests added for `sanitizeHistoryCache`, the persistence roundtrip, and the `SYMBOLUSDT` probe.

Still open: holdings virtualization (the table already caps at 20 rows, so this is only needed for the
pre-filter list), wallet-alert list refresh (the end-of-refresh `onUpdate` already refreshes it; the toast
was added), in-vault signing (C17, deferred on purpose: signing the wrong transaction bytes is worse than
not signing), full WalletConnect handshake validation (needs a live Reown project), and jsdom section
smoke tests (jsdom is not a dependency and cannot be installed offline).

### 2026-10-16 (fourth pass: TradingView-style candles)

Landed (tests: 189 pass, 1 skipped; smoke-rendered with a DOM shim):

- **Candlesticks.** Replaced the tiny inline candle code with `drawCandles` (`src/workspace.js:69`): a
  measured-width SVG with a right price axis (5 gridlines + monospace labels), a bottom time axis,
  a volume histogram, a dashed last-price line with a filled price tag, and a hover crosshair plus an
  OHLCV tooltip. Candles scale with the container via a `ResizeObserver`; up/down use the theme
  `--live`/`--loss` tokens. Volume is now captured from Binance klines (`v`, `src/wallet/providers.js:74`)
  and kept through the history cache.
- The `Candles` toggle on the Trade price panel switches between this and the line/area chart; the
  line chart is used whenever a series has no OHLC (CoinGecko points).
- Tooltip styling added in `src/workspace.css` (`position:relative` chart, `.ws-candle-tip`, `.ws-tip-grid`).
- Verified by extracting the function and running it against a minimal DOM shim (`/tmp/candle_smoke.js`):
  60 candles render, axis labels/volume/crosshair all present, hover shows the OHLCV readout and hide works.

### 2026-10-16 (fifth pass: Trade terminal redesign, driven against the live app)

Inspected the running app over the Chrome DevTools Protocol (`--remote-debugging-port=9333`, screenshots via
`Page.captureScreenshot`), which exposed bugs that static review missed:

- **Panel actions array bug.** `panel(title, { actions: [a, b] })` stringified the array to
  `[object HTMLDivElement],[object HTMLButtonElement]` in the header. Fixed by spreading
  (`src/workspace.js:43`).
- **`mk()` used as if it took children.** `mk('div','hf-body', chart)` set `textContent` to the node, so the
  chart was never appended (and holders/order bodies were stringified). Fixed by appending children
  explicitly.
- **Invalid tag name.** `mk('small mono', ...)` called `createElement('small mono')`, which throws. This
  crashed the holders list for every token that actually had holder data, so holders always showed
  "not indexed". Fixed to `mk('small', 'mono', ...)`. This is the "no data indexed" bug.
- **Micro prices.** `money()` floored small values to `$0` (BONK at $0.000003). Now uses significant digits.
- **Class collision.** The chart legend reused `.ws-legend`, the donut legend class, so it rendered as a
  vertical column. Renamed to `.ws-ohlc`.

Redesign (TradingView-inspired):
- New header (name, ticker, large price, change badge, mint) with actions on the right.
- Chart card with a control row (ranges + Line/Candles) and an overlaid OHLC legend
  (`SOL 1H O H L C +x%`), a right price axis, time axis, volume histogram and a last-price tag.
- A single-row market stat strip using compact numbers (`$28.79M`, `$1.34B`) via `metric(...)`.
- An order ticket with a PAPER/LIVE mode badge, `You receive …` estimate and full-width actions.
- Holders card with a stat row (holders / top 10 / largest) and clean rows.
- Candles are the default chart; the desk chat now defaults collapsed for a wider terminal, reopenable
  from the top-bar Chat button. Prefs are versioned (`aurora-desk-v2`) so older saved state is ignored.

Status: `npm run check` passes, tests 189 pass / 1 skipped. Verified live: 7D→1h and 30D→4h candles render,
line/candles toggle works, USDT (no OHLC) falls back to a line, and BONK holders now render
(2,093,001 holders, top-10 38.3%).

### 2026-10-16 (sixth pass: Discover trending)

- **Wrong endpoint.** `providers.trending` called `${DEXSCREENER}/token-boosts/top/v1`, but token-boosts
  lives at the API root (`https://api.dexscreener.com/token-boosts/top/v1`), so the request 404'd and
  Discover silently fell back to a `walletSearch('SOL')`, painting 17 identical "SOL" cards. Added a
  `TOKEN_BOOSTS` constant (`src/wallet/providers.js:7`).
- **Quote-side pairs.** `pairForToken` picked the highest-liquidity pair even when the requested token was
  the quote, so symbol/price could belong to the other side. It now prefers pairs whose base token is the
  requested mint (`basePair` for trending, and `pairForToken` prefers base matches too).
- **Card formatting.** Discover cards now show symbol, change, price, dex, `Liq $…`, `MC $…` with compact
  numbers, plus a watch action and toast (`tokenCard`, `src/workspace.js`).
- Verified live: trending returns 14 distinct boosted tokens (NUBI, ROADSTER, XSTOK, …) with correct
  prices and changes; no console exceptions across all seven sections.

Remaining known rough edges: Portfolio empty state is sparse with no wallet; the signal/alert authoring
form grid could be tidied; `Liq —`/`MC —` shown when a boosted token has no measurable liquidity.

### 2026-10-16 (seventh pass: Portfolio + authoring forms)

- **Portfolio.** Added a five-cell stat strip (wallet value, 24h change, holdings, paper equity, paper cash).
  With no wallet it now shows a real call to action: an address input with **Add address** (Enter submits) and
  **Connect wallet**, instead of a bare empty panel. Markets moved into a proper table (Token / Price / 24h)
  with token names, so the section is useful even with no wallet. Holdings table and paper panel only render
  when relevant.
- **Signal authoring.** `signalForm` is now a tidy three-column grid with a **Token mint** field (defaults to
  the current token), a full-width research-gate row, and a right-aligned **Create signal** action; it no
  longer depends on a token already being selected.
- Verified live with CDP screenshots across all seven sections; zero console exceptions; `npm run check`
  passes and tests are 189 pass / 1 skipped.

### 2026-10-16 (eighth pass: Canvas + Research)

- **Canvas.** Empty state is now a four-tile starter (Price chart, Holders, Wallet metrics, Market table)
  that creates real views via `walletViewShow`, plus a **Clear** action when views are pinned. `bar` view
  specs render as an actual bar chart (`drawBars`) instead of a line, and a chart that fails to load shows a
  **Retry** button. Bar/line tiles verified live.
- **Research.** A **New report** card with a token-mint field, **Run research** and **Use current token**.
  Saved reports get Open/Close, Copy and Delete, and the opened report is rendered as sanitized markdown
  through the existing `window.AuroraMarkdown.render` into a scrollable `.ws-report-body` (headings, lists,
  tables, code) rather than a raw `<pre>`. Removed the stale `.ws-report` monospace rule that would have
  overridden the new card styling.
- Verified: markdown renders (`h2`/`ul`/`strong`), the metrics view renders three stats, and the whole desk
  still throws no console exceptions.

Remaining: a real end-to-end research job (needs a configured model) to eyeball the report card with real
content, and the live wallet paths (WalletConnect + a Reown project id).

### 2026-10-16 (audit: bugs found and fixed)

Full pass over the Gigi section: static review of `src/wallet/*`, `tools.js`, `extensions.js`, the wallet
IPC handlers in `main.js`, and `workspace.js`, plus live exercising of every desk flow over CDP (paper
buy/sell/condition, alerts, signals, strategies, theses, session pause/resume/reconcile, reset, views,
watchlist, research cancel, vault import, config) with console-exception capture.

Fixed:
- **`run()` rendered non-snapshots.** Any action returning `{ view }` (Canvas starter tiles, palette
  "show" commands) called `window.render({view})`, which throws, so the user got a bogus error toast even
  though the view worked. Added an `isSnapshot` guard (`src/workspace.js:47`, palette at `:529`).
- **Gigi's `show_view` tool could not pass data.** The tool had no `rows`/`data` args and the context
  dropped `source.rows`/`source.data`, so agent-created table/metrics/note views rendered empty. Added
  `rows`/`data` to the tool definition (`src/tools.js`) and parse them in the context (`src/main.js`).
- **Markets window showed `$0` for sub-cent tokens.** `wallet-window.js` used the old 4-decimal formatter;
  now uses significant digits (BONK shows `$0.00000298`).
- **Agent paper trades lost the symbol.** `paper_buy` / `paper_condition` / `strategy_create` did not set
  `symbol`, so positions/strategies showed a truncated mint. Now resolves from the curated market list.
- **Agent live trades ignored the position cap.** `trade_execute` now enforces `maxPositionUsd` for buys,
  matching the desk.
- **Alerts fired only once per run.** They now re-arm when price crosses back over the threshold.

Found, still open (by design or needing an environment):
- In-vault signing (C17) is not implemented; live execution signs only via the connected external wallet.
- WalletConnect uses the deprecated `requiredNamespaces`; Reown prefers `optionalNamespaces`, so pairing
  with a real project id may fail. Needs a Reown project id to verify.
- Live strategies in `auto` mode execute without a per-trade approval (only `each` asks).
- Discover caches the search fallback once trending fails (`trending.loaded`), so it stays on the fallback
  until reload instead of retrying.
- `token_info` shows the safety value "revoked" for healthy tokens (it means mint/freeze authority revoked),
  which reads oddly.
- `layout: 'third'` collapses to half width; removing a missing view/report silently succeeds (idempotent);
  `views.normalizeView` lets `source.data` be arbitrarily large.

All fixes verified live: Canvas starters no longer toast a bogus error, the Markets window formats BONK
correctly, and no section throws a console exception. `npm run check` passes, tests 189 pass / 1 skipped.

### 2026-10-16 (ninth pass: de-purple + number formatting)

- **Palette.** The default (Heartflow) theme was a neon-magenta/violet scheme (`#ff3fce`/`#8b7bff`) with
  hardcoded purple glows and tints across `styles.css`, `harness-ui.css`, `brick.css`, etc. Repainted to a
  clean slate + signal-blue palette (`#5b8cff` accent, `#38bdf8` secondary, neutral `#0b0d12` surfaces) and
  replaced every hardcoded purple hex / `rgba(255,63,206,…)` / `rgba(123,92,255,…)` tint with neutral tokens
  or blue/cyan. Agent accents (`agents.js`) and the theme swatch/description (`themes.js`) updated to match,
  and the magenta logo PNG is hue-rotated to blue.
- **Number formatting.** Added a grouped formatter (`num` in `src/workspace.js`) for strategy/signal
  condition values and agent canvas table cells; market/portfolio metrics already use compact units
  (`$1.33B`). Gigi's system prompt now asks her to format numbers for humans (thousands separators, 1.2M /
  1.34B, enough decimals for small prices) instead of printing bare long integers.

### 2026-10-16 (tenth pass: Discover 2.0 + order engine)

- **Discover 2.0.** Rebuilt as a screener (`src/workspace.js drawDiscover`): tabs Trending / New pairs /
  Takeovers / Narratives, a sortable table (price, 5m/1h/24h, liquidity, volume, mkt cap, age), a symbol
  filter and a min-liquidity filter. New provider feeds `tokenProfiles`, `takeovers`, `narratives` and an
  enriched `pairSummary` (5m/1h/6h change, 24h buys/sells, createdAt) in `src/wallet/providers.js`, exposed
  as `wallet-discover`.
- **Order engine.** Paper orders now support **market, limit, stop, stop-limit, trailing stop and OCO
  (take-profit/stop-loss)** in `src/wallet/paper.js` (stop-limit arms into a limit; trailing tracks the
  peak; the OCO sibling cancels on fill). Positions expose `avgPrice` and `roe`. The ticket uses an order
  type dropdown with contextual fields (`src/workspace.js orderCard`); Portfolio shows entry, uPnL and ROE.
- Tests: added provider feed tests, a screener DOM test, and paper tests for stop-limit, trailing, OCO and
  ROE. `npm run check` passes, 201 pass / 1 skipped.

