# Changelog

## 0.6.5 — Heartflow Aurora (2026-10-17)

Adds a calmer visual identity and turns Gigi's desk into a real trading terminal: candlestick charts, a market screener, CEX-style paper orders, and a watch / alerts / notifications hub.

### A calmer, cleaner look

- Replaced the neon-magenta/violet default with a **slate + signal-blue** palette. Every hardcoded purple tint and glow across the stylesheets is gone, the logo and agent accents are recolored to match, and every theme gained a `--loss` token.
- Typography now uses a proper **system font stack** (SF Pro on macOS) instead of a Windows fallback, with a rebuilt button system (primary / ghost / buy / sell / segmented), cleaner inputs and field labels, and a tidier chat composer.

### Trade, rebuilt as a terminal

- **Candlestick charts**: OHLC from Binance with price and time axes, a volume histogram, a dashed last-price line and a hover OHLCV crosshair, plus a Line / Candles toggle. The OHLC readout is now a clean row above the chart.
- A single **Place order** card: Buy / Sell, order type, amount with available balance and 25/50/100% presets, a live "You receive" estimate, and one clear action. Order types: **market, limit, stop, stop-limit, trailing stop and take-profit / stop-loss (OCO)**.
- **Open orders / Recent fills / Holders** collapsed into one tidy tabbed panel; positions show entry price, unrealized P/L and ROE.
- An **Ask Gigi** box on the desk sends the token, mode and balance, so she can place paper trades or set watches on your behalf.
- Fixed the layout collapsing to a single column at common window widths, so the order panel sits beside the chart.

### Discover, now a screener

- **Trending, New pairs, Takeovers and Narratives** tabs with a sortable table (price, 5m / 1h / 24h, liquidity, volume, market cap, age), a symbol filter and a minimum-liquidity filter. Backed by new DexScreener feeds and an enriched pair summary.

### Watch, alerts and notifications (new)

- A new **Watch** section: a watchlist table with sparklines and quick actions, price-alert authoring, and a **notification inbox** with an unread badge.
- Alerts and signals now raise a native **desktop notification** and are recorded to the inbox.

### Fixes

- Fixed the crashes and bugs behind "no data indexed": a bad tag name in the holders list (it threw for any token with holders), the `[object HTMLDivElement]` header text, sub-cent prices rendering as `$0`, and the Discover grid that emptied on redraw.
- Fixed several agent paths: paper trades and strategies now carry a token symbol, live trades honour the position cap, and `show_view` can pass table and metrics data.
- Added grouped/compact number formatting for labeled values.

### Tests

- A jsdom harness drives the real desk in tests: Trade, holders, the Discover screener, Watch and the view-render guard, plus provider feed and paper-engine cases (stop-limit, trailing, OCO, ROE). 202 passing.

## 0.6.0 — Heartflow Aurora (2026-10-15)

This release rolls up everything built in today's session: Gigi's whole Solana desk, the data layer that makes it live, the Instinct-inspired taste pass, plus the platform work (macOS computer use, automations, themes, membership) that landed alongside it.

### Gigi's Solana desk

A full trading workspace that belongs to Gigi and Gigi alone. It mounts inside the main column so the app sidebar stays, opens when you pick Gigi and closes when you pick another sister, and slides in with a short animation.

- Sections: **Canvas**, **Portfolio**, **Trade**, **Discover**, **Research**, **Strategies** and **Journal**, driven by a tab bar with keyboard navigation.
- A **command palette** (⌘K) for jumping between sections and firing quick actions, plus a searchable token field.
- The chat is reparented into a **resizable, collapsible panel** on the right, and your desk preferences persist between sessions.

### Live data, with or without a wallet

- A curated **markets feed** (SOL, USDC, USDT, BONK, WIF, JUP, RAY, PYTH, JTO, mSOL, JitoSOL, bSOL) is priced continuously through Jupiter, so Discover, Trade and the Markets list are populated the moment the desk opens, even before a wallet is connected.
- Price polling **batches Jupiter requests** and **drops unpriced spam tokens**, so a wallet full of airdrops values correctly instead of collapsing to zero.
- **Chart history** comes from **Binance klines** for majors, with a throttled, retried CoinGecko fallback for the rest. Histories are cached in memory and sliced locally, so switching ranges is instant after the first load.
- **Real holders** come from **RugCheck**: holder count, top-account concentration and risk flags, replacing the rate-limited public RPC.
- Fixed the **DexScreener pair lookup** that had been pointing at the wrong endpoint and leaving Trade price, liquidity, volume and market cap blank.

### Portfolio and Trade

- **Portfolio performance** charts the value of your holdings over **1D, 7D, 30D, 3M, 6M, 1Y and All time**, aggregated across tokens by forward-filling each holding's price onto a shared time grid. It replaces the old single-token price chart.
- Portfolio also shows an **allocation donut**, a sortable and filterable **holdings table** with sparklines and estimated profit since Aurora started watching, the **paper portfolio**, and a watchlist.
- **Trade** was rebuilt around a proper ranged price chart, a full metric row (liquidity, 24h volume, market cap, 24h move, mint and freeze safety), the token name, and **Watch** and **Holders** actions.
- Paper trading lives in Trade: presets, slippage, an Advanced disclosure for **conditional orders**, and estimated output before fees.

### The AI market canvas and the local take on Instinct

- Gigi can render typed **views** onto the canvas with the `show_view` tool: line, area and bar charts, holder breakdowns, metric grids, tables, lists, notes and thesis cards. You can pin or remove any view.
- A **thesis builder** for multi-leg trades: long, hedge and short legs with rationale, sizing and exits. Long legs run in paper, and any thesis can be copied out as a clean **call card**.
- **Signal rules**: watch a price condition, optionally gated on a fresh research report, and fire a notification or place a small paper buy, with a cooldown and an enable toggle. Gigi creates them with `signal_create` and lists them with `signal_list`.
- **Research** runs as jobs with saved revisions and a cancel action, and its latest report is injected into Gigi's context so she reasons from evidence.
- **Strategies** support typed conditions, AND/OR, sizing, cooldown, exits and limits, and can run automatically in paper.

### The full trading spine

- Read-only multi-address wallet view, **WalletConnect** connect and sign, and a **local bot vault** (ed25519 keys encrypted with safeStorage).
- A session **state machine** for pause, exit and reconcile, plus **live swaps** with preview, simulate, confirm, reconcile and an executions journal.

### Design and themes

- An **Instinct-inspired, Apple-leaning rebuild** of the desk: whitespace over borders, a new type scale (`--t-hero`), a restrained accent, a custom inline-SVG **icon set**, a chart-led Portfolio, an airy Trade view, and borderless lists with hairline separators.
- Four whole-app **themes**: Heartflow (default), Midnight, Ember and Mint.
- **Sidebar refresh**: removed the old Heartflow links cluster and rebuilt a cleaner expanded sidebar with a 64px collapsed icon rail, tooltips and an accent active bar.

### Platform, system and membership

- **macOS computer use**: open any app by name or a URL, with friendly aliases, plus media playback control.
- **Voice** defaults to cloud on non-Windows platforms, with Windows-only options hidden.
- **Automations**: minute, daily, weekday and weekly schedules that run in their own session, durably, unattended.
- **HFAI Aura membership**: locally verified HMAC unlock codes with a Settings field.
- Sister identities: **Aurora** (vibe coding), **Gigi** (markets), **Nova** (systems), **Clara** (mind), with a shared toolkit.
- Pet settings (outfit picker and desktop toggle) moved into Settings, leaving the companion panel clean.
- A **macOS build target** (`npm run dist:mac`) and `docs/TRADING-WORKSPACE.md`.

## 0.5.4 — Heartflow Aurora (2026-10-15)

- Gigi's desk now has data the moment it opens. A small **live markets feed** (SOL, USDC, USDT, BONK, WIF, JUP, RAY, PYTH, JTO, mSOL, JitoSOL, bSOL) is priced continuously, with or without a wallet connected, so Discover, Trade and the Markets list are never empty.
- **Portfolio performance**: the Portfolio tab now charts your portfolio's value over **1D, 7D, 30D, 3M, 6M, 1Y and All time**, aggregated from your holdings' price history (replaces the old single-token price chart).
- **Trade rebuilt**: proper price charts with the same range selector, a full metric row (liquidity, 24h volume, market cap, 24h move, mint/freeze safety), token name, and Watch and Holders actions. Fixed the DexScreener lookup that left price and metrics blank.
- **Real holders** via RugCheck (holder count, top-account concentration, risk flags) instead of the rate-limited public RPC.
- Chart history is sourced from **Binance klines** (majors) with a throttled CoinGecko fallback, cached and sliced locally so ranges are instant after the first load.
- Price polling now **batches Jupiter requests and drops unpriced spam tokens**, so wallets full of airdrops value correctly instead of showing zero.

## 0.5.3 — Heartflow Aurora (2026-10-15)

- Added **signal rules**: watch a token and fire when the chart lines up, optionally only when a fresh research report exists (the local take on "ping me when it lines up"). A signal can just **notify** or place a small **paper buy**; rules have a cooldown, an enable toggle, and show in the desk's Strategies section. Gigi can create and list them with `signal_create` / `signal_list`.
- Polished the **call card** (thesis share text) into a cleaner multi-line card for copying out.
- Added the **AI market canvas**: Gigi can render typed views into the desk (line/area/bar charts, holder breakdowns, metrics, tables, notes and thesis cards) via a new `show_view` tool, and you can pin or remove them. Ask her to visualize anything and it appears in the desk.
- Added the **thesis builder** ("trade your worldview"): multi-leg theses (long/hedge/short) with rationale, sizing and exit rules, rendered as cards, runnable in paper (long legs execute and set exits, shorts and hedges are notes), and exportable as a copyable call card.
- Added an on-chain **holder view** (top accounts and concentration via `getTokenLargestAccounts`), labelled honestly as largest accounts, not unique holders.
- Rebuilt the crypto desk to an Apple-leaning language: whitespace over boxes, a shared type scale with a hero size, restrained accent, glass continuity with the shell, a custom inline-**SVG icon set** replacing the unicode glyphs, a **chart-led Portfolio**, an airy Trade view with an Advanced disclosure, and borderless lists with hairline separators.
- New modules: `src/views.js`, `src/thesis.js`, `src/icons.js`; new tools `show_view`, `thesis_create`, `thesis_list`, `thesis_activate`, `thesis_share`; new IPC for views, theses and holders.

## 0.5.2 — Heartflow Aurora (2026-10-14)

0.5.2 is a large release that turns Aurora into a proper desktop harness with a full Solana trading desk for Gigi. The four sisters (Aurora, Gigi, Nova and Clara) each got a distinct role, a one-line essence, a built-for focus and their own texting and writing style, while every sister keeps the full toolkit of code, commands, files, web, apps and media. Computer use now works on macOS: Aurora can open any installed app by name, open web pages, and control Spotify or Apple Music; voice defaults to cloud recognition on Macs with the Windows-only dictation path hidden, and the model prompt and all platform copy are now platform-aware. We added a real Automations feature with recurring schedules that run in their own session while the app is open, a genuine HFAI Aura membership unlocked with locally verified codes, and four whole-app themes (Heartflow, Midnight, Ember, Mint) with real palette previews. On the trading side, the harness now ships a read-only Solana wallet, WalletConnect sign-in, manual paper trading with fees and slippage, conditional limit and stop-loss and take-profit orders, typed strategies with automatic paper execution and aggregate limits, a research dashboard with saved revisions that ground Gigi, a per-wallet portfolio, manual live swaps that preview and simulate before an explicit confirmation, a pause and exit and reconciliation state machine, a local encrypted bot vault, and a live executions journal, all gated to Gigi so the other sisters cannot see or call them. We rebuilt Gigi's desk into a sharp, app-native, exchange-style surface mounted inside the main window: a sticky tab bar with icons and badges, a command palette, a resizable and collapsible chat merged into the page, a KPI strip, an allocation donut, a sortable and filterable holdings table with sparklines and an estimated P/L, an order panel with amount presets and slippage and an estimated output, an area chart, a shared design system adopted across the whole app, and a refreshed sidebar with the link cluster removed and a clean collapsed icon rail. The new logic is covered by the test suite, now at 170 tests.

### Sidebar refresh

- Cleaned up the left sidebar: removed the Heartflow link cluster (website, X, Telegram, Discord, GitHub and $HFAI) and its click handlers, leaving fewer, workspace-only items.
- Freshened the sidebar: tighter brand row, clearer New session button, grouped navigation with an accent active indicator, and calmer spacing.
- Rebuilt the collapsed state into a clean 64px icon rail with tooltips, an icon-only New-session button, an accent bar on the active item, and no clutter (voice caption and version label hidden, library tucked away). Toggle with Ctrl/Cmd+B.

### Wallet & Markets (M1)

- Added a **read-only Solana wallet**: Settings → Wallet lets you watch up to 10 addresses (public RPC by default, custom RPC optional, hide-balances privacy toggle). Aurora never holds keys.
- Added **Gigi's Markets** panel in the companion dock: total value, holdings with allocation bars, a Simple ⇄ Pro detail switch, and token search (DexScreener) in Pro.
- Added an **info-button system**: a small "i" opens a plain-language explainer popover, backed by a 24-term crypto glossary, with an "Ask Gigi" shortcut.
- Holdings are read from Solana RPC and priced with Jupiter; the wallet config is saved to Aurora's profile and refreshes while the app is open.
- Gigi gets read tools: `wallet_summary`, `wallet_holdings`, `wallet_token`, `wallet_history`, `market_discover` and `token_safety`, plus a live holdings summary injected into her prompt so she talks about real positions.
- Added a **watchlist** and **price alerts** (above / below a price). Alerts are checked while the app is open and fire a toast; add tokens to the watchlist from the Pro token search.
- Fixed the Jupiter price integration to the current v3 API, which also brings 24h change into holdings and the portfolio total.
- Added an expandable **Markets dashboard window** (`⤢` in the panel): a read-only second window with total, holdings, watchlist, alerts and token search, useful to keep open beside Gigi.
- Added a **price-history chart** to the Markets panel and dashboard window, built from Aurora's own price samples (click a holding or watched token to chart it). Line chart for now; candlesticks wait on a free OHLCV source.
- Fixed a **memory leak**: rebuilding the Markets panel inside the companion repeatedly triggered the pet canvas resize, growing memory fast. The panel now rebuilds only when its data actually changes, and the pet canvas resize is idempotent.
- Added **WalletConnect** (Settings → Wallet, with a Reown project ID): pair Phantom, HeartFlow or any WalletConnect wallet, show the session URI to scan or paste, and load holdings from the connected account. Signing hooks are wired for the trading step. Adds the `@walletconnect/sign-client` dependency.
- Aligned Gigi's crypto surface with the **HeartFlowAI/trading-workspace plan**: a sectioned workspace (Trade, Portfolio, Research, Strategies, Journal) with a visible **Paper/Live** badge, token search with price, liquidity, volume, market cap and a safety read, plus a Paper/Live execution toggle in Settings. Research, Strategies and Journal currently route to Gigi in chat; rule building, paper automation and a durable journal are the next chunks.
- Added **manual paper trading** (trading-workspace chunk C05): buy and sell at the live price with explicit fee and slippage assumptions, in a **PAPER account** kept separate from real holdings. Positions, cash and paper P/L update live, every order is recorded in the Journal, and Gigi can place paper trades herself with the `paper_buy` and `paper_sell` tools.
- Added **conditional paper orders** (trading-workspace chunk C06): limit, stop-loss and take-profit conditions that fill when the price crosses the trigger. Conditions are checked oldest first while the app is open, persist across restarts, can be paused and resumed, and keep a visible reason when an order cannot fill. Gigi can set them with the `paper_condition` tool.
- Filled in the missing trading-workspace chunks: **C08** read-only portfolio gains a **per-wallet breakdown** and an honest cost-basis disclosure; **C09** adds a requested **research dashboard** that runs a deep-research job (visible, cancellable) and saves report revisions under each token; **C10** grounds Gigi with the latest saved report and your portfolio. (C07 login/profiles is still deferred; the harness remains a single local profile.)
- Added the **strategy builder and automatic paper execution** (trading-workspace chunks C11/C12): typed conditions (price, 24h change, windowed change) with AND/OR logic, sizing, cooldown, take-profit and stop-loss exits, and **aggregate limits** (max position, max total, daily cap, set in Settings → Wallet). Active strategies are evaluated on every refresh and buy in the PAPER account, with automatic exits and a per-strategy trigger/error log; Gigi can list, create, toggle and run strategies with new tools. Rules are data, not code, so nothing arbitrary executes (C14 boundary); scheduled research and AI decisions (C15) run through the existing Automations, and the clarify-and-build flow (C13) is Gigi's `strategy_create` tool.
- Added **manual live swaps** (trading-workspace chunk C18): in Live mode with a connected wallet the Trade panel can **preview** a real Jupiter swap (quote plus `simulateTransaction`, nothing signed) and then **execute** it behind an explicit confirmation showing the decoded amounts, minimum out and price impact. Swaps are signed through WalletConnect (Aurora never holds keys), recorded with signature and status, and **reconciled** as confirmed/failed/pending without ever claiming an unexecuted sale. Gigi can preview and execute with the approval-gated `trade_preview`/`trade_execute` tools. Live is off by default; a local bot vault (C17) and the pause/exit state machine (C20) are still to come.
- Added the **pause / exit / reconciliation state machine** (trading-workspace chunk C20): a **Pause** control and **Exit & pause** settle paper positions, cancel controllable orders and pause active strategies. An interrupted exit reconciles on the next launch into **PAUSED_FLAT** or **PAUSED_WITH_EXPOSURE** (with a confirmation prompt), and live positions are never reported flat when they were not liquidated. States are shown as a banner, and Gigi can pause and resume with the `session_pause`/`session_resume` tools.
- Added **live bot activation** (trading-workspace chunk C19): a strategy can be switched between **paper** and **live** (visible in the panel with a ⇄ toggle). A live strategy that triggers no longer paper-buys; it raises a **live intent** that is quoted, simulated, then signed through the connected wallet (per-trade approval in `each` mode) and reconciled, with the execution linked back to the strategy. Live entries require Live mode and a connected wallet; the local bot vault (C17) and the two-platform pilot (C21) remain.
- Started the **local bot vault** (trading-workspace chunk C17): generate a dedicated ed25519 Solana wallet per bot, or import an existing key. Secrets are encrypted with the OS keystore (safeStorage) and never reach models, build code, logs or the renderer; Settings → Wallet lists each bot's public key and lets you remove it. Signing a swap from the vault still needs a reviewed crypto step, so live execution keeps using the connected WalletConnect wallet for now.
- Packaging and documentation (trading-workspace chunk C21): added a **macOS build target** (`npm run dist:mac`, dmg + zip) alongside Windows, and built the app locally on Apple Silicon. Added `docs/TRADING-WORKSPACE.md` with the status, coverage, limits, setup, recovery and unresolved defects of the trading surface. Signing and notarization for both platforms is still outstanding.
- Redesigned Gigi's crypto surface into a **full-page Solana trading desk**: an exchange-style layout with a left rail (Portfolio, Trade, Discover, Research, Strategies, Journal, Settings), a top token search, large tables, cards, metrics and the price chart, and **Gigi's chat merged into the same page** on the right. Open it from the sidebar **Trading** entry or the companion dock. It replaces the old cramped right-side buttons.
- Scoped the crypto skills to Gigi: the **wallet and trading tools are now available to Gigi only**, so the other sisters cannot reach markets, paper trading, strategies or live swaps.
- **Picking Gigi now eases straight into the trading desk** with a smooth enter animation (top bar, tabs, content and her chat slide into place) instead of leaving you in the chat. Switching to another waifu slides the desk closed and returns to the conversation. Reduced-motion is respected.
- The desk now **mounts inside the app**, so the app's own collapsible sidebar and chrome stay visible (the desk replaces the conversation area, not the whole window). The second left rail became a **horizontal section tab bar**, and the style is sharper and denser: tabular numbers, tighter rows, subtle dividers and sparing accent, blending the DeepSeek shell with exchange-style tables and portfolio cards.
- Rebuilt the desk on a shared design system (`ui.css`: tokens plus `.hf-*` buttons, tabs, panels, cards, tables, badges, inputs, skeletons, empty states and tooltips). Navigation now has a clear hierarchy: the app sidebar is the global spine and the desk is a sticky tab bar with icons and badges (holdings count, running reports), a centered content column, a KPI strip, loading skeletons, a two-column Trade view and a Discover trending grid. The chat pane is **resizable and collapsible** (remembered), tabs are keyboard-navigable (`role="tablist"`), the collapsed sidebar now shows every global entry, and the open desk is highlighted in the sidebar.
- Rolled the component system across the whole app (buttons, inputs and dialogs now share control heights, radii and the type scale) and **removed the duplicated companion Markets panel**: the dock tab now launches the desk. Added a **⌘K command palette** (jump to sections, search tokens, and quick actions like Paper buy, Start research, switch execution). Portfolio gained an **allocation donut**, a **sortable and filterable** holdings table, per-row **sparklines** and an **estimated P/L** (change since Aurora started watching, clearly labelled). The Trade order panel gained amount presets, slippage and an estimated output. The open desk no longer closes when you click another session (only switching waifu does), and charts gained an area fill with low/high/last, verified across all four themes.

### Themes & Pet settings

- Added whole-app **themes**: **Heartflow** (default), **Midnight**, **Ember** and **Mint**, chosen in Settings → Theme. Each recolours the sidebar, header, session toolbar, companion panel, composer, dialogs and accents across the whole app, and the choice is saved.
- Moved Aurora's outfit picker out of the companion panel into a new **Settings → Pet** section, together with a **"Send Aurora to your desktop"** toggle and a **"Teleport somewhere"** action (both previously in the companion panel or header). The companion panel now shows just the pet stage and activity, with no stray controls.

### Automations & HFAI Aura

- Added a real **Automation** feature: recurring Aurora routines that run in their own session while the app is open. Give each one a name, a prompt and a schedule (every few minutes, daily, weekdays, or weekly on chosen days), then Pause, Resume, Run now, Edit or Delete. A 30-second scheduler runs due routines, skips any missed while the app was closed, and hands focus back to your own session when a run finishes. Runs are unattended, so the model is told to complete the task or state a blocker instead of asking questions.
- Added real **HFAI Aura membership**: unlock from Settings with an HFAI Aura code (mint them with `node scripts/aura-key.js`). The code is verified locally and stored masked, and a Lock button revokes it. This unlocks the multi-waifu teams and the custom team builder, and the lock labels now say "Unlock with an HFAI Aura code".
- Appearance palette previews (Classic, Moonlight, Sunrise) now show their real colour filters instead of the same image.

### Sister identities

- Every sister now shares the full toolkit (code, scripts, approved commands, web search, files, apps and media); her specialty is a lens and bias, not a limit.
- Gave each sister a distinct specialty and "built for" focus: **Aurora** vibe coding (ship loose ideas fast), **Gigi** markets (crypto and stocks), **Nova** systems (workflows, automation and efficiency), **Clara** mind (psychology, wellbeing and marketing). Each keeps her Heartflow essence line.
- Added a per-sister texting and writing style so they read as different people: Aurora lower-case and a little flirty, Gigi a terse trader with tickers and levels, Nova punchy and forward-moving, Clara warm and unhurried.
- Team prompts now route each request to the sister whose specialty fits best and keep every voice clearly separate, instead of blending them into one.
- The waifu picker shows each sister's specialty (with role and focus on hover).

### macOS support

- Aurora can now open apps and web pages on macOS. Ask for "open Spotify", "open YouTube" or "open any app" and she uses the native `open` command: any installed app works by name, a URL opens in the default browser, and a combined app plus URL opens the page in that app.
- Added a **control_media** tool for music: play, pause, playpause, next and previous, driving Spotify or Apple Music through AppleScript on macOS and the system media key on Windows.
- `open_application` now accepts an application, a URL, or both, so "open YouTube" no longer needs a browser named.
- Voice now works out of the box on macOS: the default speech engine is cloud recognition, and the Windows-only local dictation option is hidden there. Previously listening failed with a Windows speech error until cloud was chosen manually.
- **HFAI Aura membership** can now be enabled in Settings, unlocking the multi-waifu teams and the custom team builder. It is a local preview switch until real membership validation ships; before this the gate could never be satisfied.
- Windows-only tools (`computer` mouse and keyboard control, `run_powershell`) and the PowerShell plugin are hidden from the model and Settings on macOS, and the input overlay no longer tries to start on non-Windows systems.
- The model's system prompt is now platform-aware: on macOS it describes opening apps, media control and that screen control is Windows-only, instead of Windows-only actions.
- Shortcuts show Cmd on macOS, and Windows-specific wording in the microphone, audio, secure storage and MCP help text was neutralized.
- Full mouse and keyboard control on macOS still needs Accessibility and Screen Recording permission, so it remains a Windows feature for now.

## 0.5.0 — Heartflow Aurora (2026-10-13)

- Added a floating, draggable **command brick**: a glassy, see-through bar that appears when the app is minimised, becomes **solid on hover**, and can be **moved anywhere** by its top grip (position is remembered).
- The brick now **auto-expands** to show a reply as it streams, instead of waiting for a click, and carries a **pin** to keep it open on screen and a **collapse** chevron to fold it back to the compact bar.
- Type a command into it and watch the reply stream back in place; **⌥⌘Space** summons it and starts listening, or hit the mic button to speak (voice remains Windows-only).
- Status text is now **waifu-aware** ("Nova is thinking", "Gigi is working") instead of always saying Aurora, and the brick shows the active waifu's portrait, following her when you switch.
- Softer rest state (violet glass, not a flat grey) with clearer controls (pin, collapse, open, hide) and a small animated "thinking" indicator.
- Recoloured the brick from a flat grey to the Heartflow palette: translucent violet and magenta glass at rest (desktop shows through), solidifying on hover, with a magenta top light, accent border, magenta focus ring and glow on the send button.

## 0.4.9 — Desktop companion affordance (unreleased)

- Added a visible **desktop toggle** in the header (monitor icon, next to the companion toggle) that sends your waifu to the desktop and brings her home, and lights up while she is out. The floating companion was previously only reachable from the hidden companion panel, which made it easy to miss.
- Kept the floating companion fully inside the work area and restored the companion panel's sprite behaviour when she is detached.

## 0.4.8 — Sisters: waifu picker and teams (unreleased)

- Added the four Heartflow AI sisters as selectable waifus: **Aurora** (connection · desktop work), **Gigi** (alpha · market intelligence), **Nova** (execution · next actions) and **Clara** (regulation · clarity).
- Replaced the old Normal / Aurora Code switch with a **team selector**: pick your waifu, then pick her team. Each waifu offers **three preset combos** and the roster changes with her. Solo is free; the two multi-waifu teams are the **HFAI Aura** pathway, shown locked with a "coming soon" note. The HFAI Aura gate now lives here, not in the waifu picker.
- Added a **"Build your own team"** option to the same selector: pin your main waifu and toggle which sisters join her (up to a three-waifu team). Also gated behind HFAI Aura, so it ships locked until membership is live.
- Reordered the composer controls: the **attach** button sits on the far left, the **waifu picker** beside it, then the special team control.
- Each chat remembers **which waifu it belongs to**: the sidebar session tree shows her portrait beside every conversation, and switching sessions restores her persona and team.
- Each sister keeps the full desktop-tool harness (files, PowerShell, computer control, web search, voice) and adds her own persona to the system prompt; the choice is saved.
- Sharpened each sister's voice and added a shared house style: Aurora is sassy and warm, Gigi is a crypto and markets expert who pulls real data before calling it, Nova takes the wheel and drives execution, Clara works in psychology, mindfulness and wellbeing. The style forbids chatbot filler, em dashes and hedging, and pushes specific, opinionated replies.
- Fixed the user message bubble text, which was dark-on-dark because a light-theme rule leaked through; it now uses the readable text colour.

## 0.4.7 — Heartflow links (unreleased)

- Added a Heartflow AI link cluster in the sidebar footer, each opening in the system browser: **heartflowai.net**, **@HeartFlowAI** on X, the **Telegram community** (t.me/HFAICommunity), **Discord** (discord.gg/au3jbSJf3C), **GitHub** (github.com/HeartFlowAI), and the **$HFAI** token on pump.fun.
- The link cluster collapses to a tidy icon column with the rest of the rail.

## 0.4.6 — Chat functions, glass and Heartflow shell (unreleased)

- Tool calls and results now appear **inline in the conversation** as expandable cards (with status), alongside the existing companion activity list.
- Added collapsible **Thinking** blocks when the model returns reasoning (Ollama `thinking`, OpenRouter `reasoning_details`).
- Added **relative timestamps** under each message.
- Added **in-chat search** (Ctrl/Cmd+F) with match counts and next/previous, using the native find engine.
- Attachments can now be **dragged and dropped or pasted** into the composer, not just picked; both text files and pasted text work.
- Added **@-mention autocomplete** for workspace files; mentioned files are read and attached automatically on send.
- Added **Copy conversation** and **Export as Markdown…** to the session menu.
- Added a **reasoning-effort selector** (Auto/Low/Medium/High) at the composer, persisted and passed to supported providers.
- Added per-message actions: copy any message, edit your own message (replaces it and every reply after it, then resends), regenerate the latest reply, and delete a message with its dependent replies and tool records.
- Added a **jump to latest** control that appears when you scroll up in a long conversation.
- Added file attachments: the composer's attach button opens a picker, adds removable chips, and includes the chosen text files (up to 200 KB each) as context in your message.
- The store keeps attachments, edits and timestamps durable, with unit coverage for editing, regenerating and deleting turns.
- Adopted the heartflowai.net palette across the app: neon magenta (`#ff3fce`), electric violet (`#7b5cff`), live green and gold, on a deep near-black ground.
- Added a glassmorphism pass: frosted translucent sidebar, header, composer, companion dock, popovers, menus and dialogs with backdrop blur, hairline highlights and soft neon glow.
- Replaced the ♥ brand glyph with the real Heartflow neon heart logo (glowing chip) and reworked the wordmark to **heartflowai · workspace**.
- Centered the conversation and composer in a focused reading column; the send control is a flat DeepSeek-style 34px circle with a thin arrow.
- Reorganized the sidebar toward the DeepSeek layout: brand, New session and search at the top, the workspace/session tree in the middle, and a quiet cluster (Automation, Plugins & MCP, listening, Settings) pinned to the bottom — with tighter spacing and softer hover/active states. A duplicate "Plugins" entry was folded into the single Plugins & MCP row.
- Rebuilt the collapsed sidebar as a tidy icon-only rail (centered logo, New session, and a bottom icon cluster with an icon for every entry), replacing the cramped column that wrapped labels.
- Cohesion pass: removed the stray magenta halos on the composer and brand mark, unified the glass surface tones, and flattened the user message bubble so the neon accents read as one system.
- Modern glass pass: moved to cooler neutral frosted surfaces (near-black ground, neutral greys, crisper hairlines) so the neon magenta and violet read as accents rather than an all-over tint.
- Fixed the composer: a global rule had painted every text area with a dark fill, which made the prompt look like a black box floating inside the input. The prompt is now transparent on one seamless glass sheet, with a cleaner control row.
- DeepSeek layout pass: a focused centered reading column (~780px), user messages right-aligned in a rounded bubble with the assistant plain at left, per-message author labels removed, a slimmer top chrome, and a 26px-radius composer.
- Merged the two top bars into a single slim bar: the session title and its context on the left, and the workspace, project, session menu and companion toggle on the right, with the sidebar toggle beside the title.
- Moved a collapse/expand control into the sidebar brand row (revealed on hover, always visible when collapsed).
- Calmed the empty state: centered hero with the suggestion cards reduced to single-line chips (sub-labels dropped) and a tighter type scale (14px/22px body).
- Added true macOS window vibrancy (`under-window`) with a light scrim so the glass is real frosted glass on the desktop; other platforms keep the solid dark window.
- Kept every existing feature — sessions, workspaces, search, model picker, Normal/Aurora Code modes, approvals, voice, companion and extensions are unchanged.

## 0.4.5 - Sidebar actions (2026-10-11)

- Added three-dot menus and right-click actions directly to session and workspace rows.
- Session menus provide rename, pin, duplicate, archive and delete actions.
- Workspace deletion moves its sessions to Default workspace and preserves folders and files.
- Replaced the crowded hover action strip with a compact menu.
- Consolidated the sidebar into one expandable workspace tree and removed duplicate session lists and nested scrolling.

## 0.4.4 — Navigation, Settings and model picker

- Moved Normal/Aurora Code and model selection into the composer, matching DeepSeek Harness’s work-start flow.
- Added a searchable model picker grouped by provider, with current-model state, model discovery and a direct path to Settings → Models.
- Simplified the sidebar order and changed collapse into a compact icon rail; Settings remains pinned at the bottom.
- Tightened the Settings workspace to a focused, bounded panel with section navigation and internal scrolling.
- Fixed a stale renderer reference that prevented the initial workspace session list from rendering.

## 0.4.3 — DeepSeek-inspired workspace shell (unreleased)

- Reworked the composition around a structured workspace sidebar rather than adding more controls to the previous shell.
- Added first-class Plugins and Automation navigation, workspace actions, and clearer session hierarchy.
- Aurora’s companion is collapsed by default so the conversation canvas gets priority; the companion remains available from the header.
- Kept Heartflow’s dark plum, lavender and pink palette while tightening spacing, contrast and panel boundaries.

## 0.4.2 — Workspace-first navigation (unreleased)

- Reorganized the sidebar around Workspaces, Plugins and Automation.
- Added compact workspace actions and a DeepSeek-inspired workspace/session hierarchy.
- Added session rename, pin and archive actions on hover or keyboard focus, while retaining direct delete.
- Added session duplication from the row actions, preserving the conversation while creating a new session.
- Preserved Aurora’s Normal and Aurora Code modes, companion panel, voice controls and existing project data.

## 0.4.1 — Session navigation actions (unreleased)

- Session rows reveal a delete button on hover or keyboard focus in the current project, search results and expanded project groups.
- Delete any listed session without opening it first. Confirmation identifies the selected session; cancelling preserves it and the current conversation.
- Softer sidebar selection and hover surfaces, compact trash icons, and reserved action space keep titles stable while navigating.

## 0.4.0 — Settings and extensions workspace (unreleased)

- Section-based Settings with persistent navigation between Overview, Connections, Voice, Appearance, Plugins & MCP, and Updates. Open with Ctrl+,.
- Provider connection cards distinguish saved credentials, local setup and the active provider without claiming a connection has been tested.
- Expand project groups to browse their sessions without switching the current conversation. Search remains available across all modes and projects.
- Files and Activity tabs beneath Aurora in the side panel. Browse folders and preview UTF-8 text files up to 200 KB inside the selected workspace.
- Built-in tool group switches for files, web research, desktop control and PowerShell. Disabled tools are excluded from requests and rejected if called.
- Optional MCP tools using the official SDK: local executable/stdio or remote Streamable HTTP, encrypted bearer tokens, connection status and discovered tool lists. Connections start disconnected and close with Aurora.
- Every MCP tool call requires approval with the server, endpoint and arguments visible. Results are text-only, bounded and treated as untrusted data.
- Existing companion, voice notch, appearance choices, modes, projects and update controls remain integrated. This is an original implementation inspired by DeepSeek Harness, not compatibility with its plugin runtime.

## 0.3.0 — Workspace UI refresh (unreleased)

- Refreshed navigation, chat, project organization, activity cards and Settings while retaining Aurora's companion, voice notch, modes, appearances and existing tools.
- Compact conversation header, restrained Heartflow accents, wider reading area and a new welcome layout.
- Hide or show either side panel; preferences persist in the current local profile. Collapse projects to give sessions more room.
- Session counts beside projects, Ctrl+K session search, Ctrl+B navigation toggle, and direct model/appearance shortcuts.
- Readable activity names and separate working, done and needs-attention states. Raw tool arguments and results remain available in expandable cards.
- Compact Settings overview and responsive layouts checked down to the supported 950 × 680 window size.
- Original implementation informed by DeepSeek Harness's navigation/conversation/right-panel structure. No upstream code, branding or plugin runtime was imported.

## 0.2.4 — Pointing and animation corrections

- Dedicated sideways pointing artwork for Cyber, Dark and Cozy, replacing the upward-reaching fallback. All outfits align their fingertips to the desktop file-presentation anchor and mirror for left-facing targets.
- Regenerated community activity sheets with complete boots and hands; render-time pose isolation removes neighbouring fragments and stray pixels while retaining substantial props.
- Safe crop margins protect poses that cross an approximate atlas grid boundary. Consistent scale and foot baselines reduce jumps between activity frames.
- Skip the malformed three-arm celebration pose in the original atlas and use its clean alternate.
- Added canvas auditing for every activity frame and both pointing directions, plus multi-DPI alignment and fragment-removal checks.

## 0.2.3 — A calmer workspace

- Removed Mint from the appearance picker. Previously saved Mint selections fall back to Classic.
- Grouped connection, voice, appearance and update settings into one Settings menu; kept listening directly available in the sidebar.
- Moved workspace selection into the session toolbar and session deletion into its options menu.
- Moved the available-update download button beside Settings, freeing the chat header.
- Reduced sidebar clutter, shortened workspace labels with full paths on hover, and made the six appearance cards fit in a compact grid.

## 0.2.2 — Community appearances

- Added Cyber, Dark and Cozy community appearances, with “Created by Jaymie” beneath each name.
- Each outfit has its own transparent pixel-art pose sheet for idle, thinking, waiting, coding, browsing, movement, celebrating and errors. Teleport effects use the selected outfit; pointing uses its reaching pose.
- Selected outfits follow Aurora between the main app, voice notch and desktop companion.

## 0.2.1 — Shutdown and single-instance fix

- Closing the main window shuts down the full app, including hidden action displays, pet/notch windows, speech, native helpers and timers.
- Wait for an interrupted task and queued local saves before exiting. A bounded shutdown fallback prevents a stuck helper from holding the instance indefinitely.
- A second launch restores the existing window. Launches during startup are queued; launches during shutdown request a fresh process after the old one exits.
- Prevent late pointer/overlay callbacks from recreating activity after disposal.
- Verified with real Electron single-instance locks and three repeated close/reopen cycles in an isolated profile, including auxiliary windows and an interrupted model request. No live microphone, cloud requests or physical computer input were used.

## 0.2.0 — Local release preparation

- Separate saved connections for OpenAI, Claude / Anthropic, OpenRouter, Ollama Cloud and local Ollama. Streaming replies and tool results use provider-specific adapters while sharing Aurora's tools and approval flow.
- Preserve legacy Ollama credentials and chats; encrypt each cloud provider key for the Windows account. Local model requests use a loopback server without an API key.
- Web search keeps a separate Ollama Cloud connection. Voice remains independently configured.
- Classic, Moonlight, Sunrise and Mint colour palettes apply to the app, notch and desktop companion, reusing the full animation set.
- Per-user Windows installer and explicit download/restart controls. Installed copies quietly check GitHub Releases shortly after startup; development and portable copies use manual updates.
- Versioned release workflow, fixed build output and guarded cleanup of redundant legacy builds. Packaging never publishes automatically.
- Resolve the previously reported dependency audit issue with a non-forced dependency refresh.

Provider streams and updates are verified with fixtures. Live provider account access and a published installed-version upgrade need separate validation. No GitHub release is implied by this changelog entry.

## 0.1.0 — Prototype baseline

- Windows chat and code modes, projects and session search.
- Optional wake-word voice conversations, minimized notch and desktop companion.
- File search, Explorer presentation, approved workspace writes and PowerShell.
- Supported browser and application interaction through observed controls.
