# WealthBoard DCA bots — implementation research

Requested September 16, 2026: a dedicated WealthBoard tab recreating the workflow in https://www.youtube.com/watch?v=GObY8KeJV_0, with actual Robinhood trading (not a paper-only product).

The complete auto-generated English transcript was retrieved and reviewed. The video is “How to Set Up a DCA Bot on 3Commas: Full Tutorial (2026),” 11:23. Features below describe behavior to implement independently, not copied interface assets.

## Workflow mapped from the video

- 0:00–2:16: bot list, strategy presets, configuration alongside chart, market/pair selection.
- 2:16–4:46: name, execution account, direction, one or multiple instruments, initial amount in quote currency / units / percentage, market or limit entry. Futures leverage is exchange-specific and cannot be assumed supported by Robinhood.
- 4:46–5:25: immediate or indicator-based entry; multiple rules combine with AND.
- 5:25–7:21: averaging order amount, first deviation, deviation and amount multipliers, maximum averaging orders, maximum resting averaging orders; optional indicator condition and deviation from initial or last fill. Custom ladder supports individually configured levels and amounts.
- 7:21–8:40: profit target or signal exit with minimum profit; average-entry vs base-order profit basis; optional reinvestment; up to four profit targets and trailing final target.
- 8:40–9:11: stop loss, stop timeout, break-even, trailing stop, maximum holding duration, stop bot after loss.
- 9:11–9:48: concurrent positions, per-instrument limits, cooldown, entry price range and liquidity filters.
- 9:48–11:23: backtest periods, charted fills, P&L, drawdown, win rate, export, then bot launch and external signals.

## Robinhood execution boundary

Official documentation reviewed:
- https://robinhood.com/us/en/support/articles/agentic-trading-overview/
- https://robinhood.com/us/en/support/articles/trading-with-your-agent/
- https://robinhood.com/us/en/support/articles/crypto-api/
- https://help.3commas.io/en/articles/16281102-how-the-dca-bot-works-strategy-setup-guide

Robinhood Trading MCP is https://agent.robinhood.com/mcp/trading. Account reads may include existing accounts, but order placement is restricted to a separate Agentic account. The owner must complete account opening, applicable agreements and authorization personally. Crypto Agentic access has jurisdiction restrictions, including New York. Account eligibility must be confirmed, not inferred from timezone.

The documented tools include account/buying-power reads, equity historical prices and indicators, quotes, tradability, order review/preview, placement, status and cancellation; crypto has corresponding quotes, positions and order tools. The exact authenticated tool schemas must be discovered before implementing requests. Do not invent schemas or reuse Plaid credentials. Plaid is the existing read-only import and is not the execution channel.

A connector in a chat does not by itself create a continuously running WealthBoard bot. Server-side authorization and a persistent execution worker need validation. Current WealthBoard price polling is 15 minutes on weekdays, so it cannot be advertised as continuous real-time trade monitoring.

## Execution implementation requirements

Use durable bot, deal and order state, per-account capital reservations and per-bot leases. Journal an order intent before transmission; reconcile ambiguous responses and partial fills before any retry. A scheduled worker must not duplicate orders on concurrent invocations. Decisions must use broker tradability, buying power and fresh bid/ask data. Accounting must use actual fills and fees, not planned order sizes. Never let a bot sell unrelated existing holdings. Apply user-configured exposure caps to initial and averaging orders together, across bots sharing an account.

Distinguish stop-new-entries from closing existing positions. Show any exits that rely on the worker being online. No automatic activation or funded strategy is inferred from the request to build software: instrument, allocation and parameters remain user selections. Unsupported features must be clearly unavailable rather than cosmetic toggles.

Backtests require timestamped historical bars and explicit assumptions for fees, spread, slippage and intra-bar execution order. No lookahead; incomplete positions count in drawdown/equity. Test partial fills, timeouts, restarts, gaps crossing multiple levels, halt conditions and concurrent workers before live activation.

## Confirmed owner choices and connection status

- New Jersey. Cash account, no margin borrowing, short selling or options in the bot.
- Original scope covers both crypto and equities; the first intended strategy is direct Zcash (ZEC/USD), not ZCSH shares.
- Owner completed Agentic opening and linked crypto onboarding on September 16. Assistant MCP authorization succeeded. Read-only checks confirmed the Agentic account is active and cash-type, ZEC/USD is tradable without a current halt, and limit orders are supported.
- Owner initiated a $10,000 deposit. This is not authorization to allocate the entire deposit or start trading. Broker reported $10,000 crypto buying power while the deposit remained pending; always recheck before orders.
- The assistant connection does not confer a server credential on WealthBoard. A separate OAuth client was registered for the exact production /bots/robinhood/callback URI. The first rollout adds an owner-authenticated connection page, PKCE plus browser-bound single-use state, encrypted token storage and deletion support. Token refresh, authenticated capability checks, strategy editor, simulation and trading worker remain required before any live activation.
- No live orders have been submitted. Live order routes and automated activation are absent from this rollout.

## Direct website authorization blocker

September 16: the owner relayed Robinhood support representative Rene's confirmation that arbitrary personal-web-app HTTPS callbacks are not supported. Direct connection initiation and callback completion are now disabled. The working approved Codex connection remains separate. Never forward locally issued codes or reuse its credentials in WealthBoard.

Support is researching unattended operation, session renewal, request limits, and whether the official Crypto Trading API can target the dedicated Agentic crypto account. Follow-up promised within 48 hours; no monitor was scheduled.

## Settings editor, first increment

Implemented owner/MFA-protected server storage with immutable, monotonically numbered revisions and optimistic concurrency. One ZEC/USD bot, cash only. Draft saves and next-cycle selection are separate; no active version, worker, orders, or live statistics are claimed. Loading history creates local edits, not mutations of old versions. The future executor must explicitly bind a selected version to a cycle, never simply consume the latest draft. Saving/queuing is not authorization to activate.

Inputs: initial amount, immediate/limit entry, averaging amount/drop/size and spacing multipliers, max and resting buys, total cash cap, up to four sell allocations, estimated fees, stops, trailing preferences, holding duration, cooldown, repeat and reinvestment. Advanced execution-dependent controls are planning settings only. Indicator conditions, custom irregular ladder, equities/multiple assets, backtests, and active-cycle order-change previews remain future work.

Preview uses a user-provided illustrative initial price, cumulative percentage-point gaps from the initial fill, and constant estimated fees on each side. It assumes full fills before partial sells. This is not an executable broker order plan: precision, fees, fills, allocations and exit compatibility must be revalidated by the eventual worker. Tests cover capital ceilings, fee-aware target math, invalid configurations, owner isolation and concurrent saves. New storage participates in financial-data deletion.

## Next-cycle entry planning

Added after-cooldown, dip-only and dip-then-rebound modes. Legacy versions default in memory to after-cooldown, preserving their original behavior; saved records are never rewritten. Example dip 3%, rebound 0.75%; these are unvalidated trial parameters, not optimized for Zcash. No history backtest has been performed.

Future execution semantics: completely sell the cycle and confirm all remaining buy orders terminal, then start cooldown. After cooldown, use the completed cycle's quantity-weighted average sale price (before fees) as an immutable anchor. The maximum buy price is anchor*(1-dip/100). Track fresh executable asks after the qualifying dip, retaining each lower low. A rebound requires ask >= low*(1+rebound/100) AND ask <= maximum buy price. If a rebound jumps above the ceiling, do not buy. A shallow dip may need a deeper low to fit both conditions. Stale quotes, unclear order state, or budget conflicts must pause execution. First-cycle entry remains separate. UI preview only illustrates thresholds, not a streaming evaluator, order, or execution guarantee.
