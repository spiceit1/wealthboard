import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const providerEnum = pgEnum("provider", ["plaid", "snaptrade", "coingecko"]);
export const connectionStatusEnum = pgEnum("connection_status", [
  "active",
  "inactive",
  "error",
]);
export const accountTypeEnum = pgEnum("account_type", [
  "checking",
  "savings",
  "brokerage",
  "crypto_wallet",
]);
export const assetClassEnum = pgEnum("asset_class", ["cash", "stock", "crypto"]);
export const syncStatusEnum = pgEnum("sync_status", ["pending", "running", "completed", "failed"]);
export const syncTriggerEnum = pgEnum("sync_trigger", ["manual", "scheduled", "system"]);
export const eventLevelEnum = pgEnum("event_level", ["info", "warning", "error"]);
export const snapshotItemCategoryEnum = pgEnum("snapshot_item_category", [
  "cash_account",
  "brokerage_position",
  "crypto_holding",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  fullName: varchar("full_name", { length: 120 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const connections = pgTable(
  "connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: providerEnum("provider").notNull(),
    externalId: varchar("external_id", { length: 191 }).notNull(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    status: connectionStatusEnum("status").notNull().default("active"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userProviderUnique: uniqueIndex("connections_user_provider_external_uidx").on(
      table.userId,
      table.provider,
      table.externalId,
    ),
    userProviderIdx: index("connections_user_provider_idx").on(table.userId, table.provider),
  }),
);

export const providerTokens = pgTable(
  "provider_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: providerEnum("provider").notNull(),
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userProviderUnique: uniqueIndex("provider_tokens_user_provider_uidx").on(
      table.userId,
      table.provider,
    ),
  }),
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id").references(() => connections.id, {
      onDelete: "set null",
    }),
    providerAccountId: varchar("provider_account_id", { length: 191 }).notNull(),
    institutionName: varchar("institution_name", { length: 120 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    type: accountTypeEnum("type").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    lastBalance: numeric("last_balance", { precision: 16, scale: 2 }).notNull().default("0"),
    balanceAsOf: timestamp("balance_as_of", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    providerAccountUnique: uniqueIndex("accounts_provider_account_uidx").on(
      table.userId,
      table.providerAccountId,
    ),
    userTypeIdx: index("accounts_user_type_idx").on(table.userId, table.type),
  }),
);

export const holdings = pgTable(
  "holdings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    assetClass: assetClassEnum("asset_class").notNull(),
    quantity: numeric("quantity", { precision: 22, scale: 8 }).notNull().default("0"),
    lastPrice: numeric("last_price", { precision: 18, scale: 6 }).notNull().default("0"),
    marketValue: numeric("market_value", { precision: 18, scale: 2 }).notNull().default("0"),
    isManual: boolean("is_manual").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userSymbolIdx: index("holdings_user_symbol_idx").on(table.userId, table.symbol),
  }),
);

export const prices = pgTable(
  "prices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    assetClass: assetClassEnum("asset_class").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    price: numeric("price", { precision: 18, scale: 6 }).notNull(),
    pricedAt: timestamp("priced_at", { withTimezone: true }).notNull(),
    source: providerEnum("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    symbolTimeUnique: uniqueIndex("prices_symbol_priced_at_uidx").on(table.symbol, table.pricedAt),
  }),
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: syncStatusEnum("status").notNull().default("pending"),
    trigger: syncTriggerEnum("trigger").notNull().default("manual"),
    isMock: boolean("is_mock").notNull().default(true),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
  },
  (table) => ({
    userStartIdx: index("sync_runs_user_started_at_idx").on(table.userId, table.startedAt),
  }),
);

export const syncRunEvents = pgTable(
  "sync_run_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    syncRunId: uuid("sync_run_id")
      .notNull()
      .references(() => syncRuns.id, { onDelete: "cascade" }),
    provider: providerEnum("provider"),
    level: eventLevelEnum("level").notNull().default("info"),
    message: text("message").notNull(),
    eventOrder: integer("event_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    runOrderUnique: uniqueIndex("sync_run_events_run_order_uidx").on(table.syncRunId, table.eventOrder),
  }),
);

export const dailySnapshots = pgTable(
  "daily_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),
    cashTotal: numeric("cash_total", { precision: 18, scale: 2 }).notNull().default("0"),
    stocksTotal: numeric("stocks_total", { precision: 18, scale: 2 }).notNull().default("0"),
    cryptoTotal: numeric("crypto_total", { precision: 18, scale: 2 }).notNull().default("0"),
    totalNetWorth: numeric("total_net_worth", { precision: 18, scale: 2 }).notNull().default("0"),
    dailyChange: numeric("daily_change", { precision: 18, scale: 2 }).notNull().default("0"),
    syncRunId: uuid("sync_run_id").references(() => syncRuns.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userDateUnique: uniqueIndex("daily_snapshots_user_date_uidx").on(table.userId, table.snapshotDate),
    userDateIdx: index("daily_snapshots_user_date_idx").on(table.userId, table.snapshotDate),
  }),
);

export const snapshotItems = pgTable(
  "snapshot_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    snapshotId: uuid("snapshot_id")
      .notNull()
      .references(() => dailySnapshots.id, { onDelete: "cascade" }),
    category: snapshotItemCategoryEnum("category").notNull(),
    accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
    holdingId: uuid("holding_id").references(() => holdings.id, { onDelete: "set null" }),
    label: varchar("label", { length: 120 }).notNull(),
    symbol: varchar("symbol", { length: 20 }),
    quantity: numeric("quantity", { precision: 22, scale: 8 }),
    price: numeric("price", { precision: 18, scale: 6 }),
    value: numeric("value", { precision: 18, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    snapshotCategoryIdx: index("snapshot_items_snapshot_category_idx").on(
      table.snapshotId,
      table.category,
    ),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  connections: many(connections),
  accounts: many(accounts),
  holdings: many(holdings),
  snapshots: many(dailySnapshots),
  syncRuns: many(syncRuns),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
