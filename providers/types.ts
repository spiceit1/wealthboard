export type ProviderSource = "plaid" | "snaptrade" | "coingecko";

export type AccountBalance = {
  providerAccountId: string;
  name: string;
  /** Resolved from Plaid Item / institutions API when available */
  institutionName?: string;
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
};
