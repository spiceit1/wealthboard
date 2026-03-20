export type ProviderSource = "plaid" | "snaptrade" | "coingecko";

export type AccountBalance = {
  providerAccountId: string;
  name: string;
  /** Resolved from Plaid Item / institutions API when available */
  institutionName?: string;
  /** Plaid Item id — used to attach rows to the correct connection when multiple banks are linked */
  plaidItemId?: string;
  type: "checking" | "savings" | "brokerage" | "crypto_wallet";
  balance: number;
  currency: "USD";
};

export type Position = {
  symbol: string;
  quantity: number;
  price: number;
  value: number;
  assetClass: "stock" | "crypto";
};

export type ProviderResult<T> = {
  source: ProviderSource;
  fetchedAt: string;
  data: T;
  /** Real Plaid calls list every Item that was queried */
  meta?: {
    plaidItemId?: string;
    plaidItemIds?: string[];
  };
};
