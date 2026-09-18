# Directly verified Robinhood snapshot

A trusted operator can use `saveVerifiedInvestmentSnapshot` after fetching the entire account's equity positions and actual cash directly from Robinhood. The account must already exist as a linked Robinhood account. This is a data import, never a trading endpoint. Supply actual current quotes, not cost basis, as prices. Unsupported asset classes require further implementation before importing those accounts.

The import atomically excludes prior account holdings and inserts uniquely keyed verified positions and cash. Prices continue through the normal price refresh. The UI explicitly marks quantities and cash as verified with Robinhood, awaiting Plaid, with the original verification time.

Plaid import compares the complete account's symbols, share quantities, and cash. A mismatch or missing cash keeps the entire verified snapshot; other accounts sync normally. A match atomically retires verified rows and imports Plaid rows. Prices are not compared. Excluded rows remain for audit and do not count in totals.

This is not continuous Robinhood monitoring. If another trade or transfer occurs before reconciliation, fetch and import another complete verified snapshot. A persistent mismatch requires review; it must not silently expire to stale data.

September 18 correction: Agentic account ending 8533, verified directly through Robinhood: SPY 6.567642; QQQ 6.952460; cash 0. Orders filled at 18:56:56 and 18:57:00 UTC, respectively. No new orders were placed for this correction.
