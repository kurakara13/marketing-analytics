import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

// One row per (user, connector, external account). The same user may
// connect a given connector to multiple external accounts (e.g. several
// GA4 properties), so the unique key is the triple, not just user+connector.
export const connections = pgTable(
  "connection",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Stable internal ids from lib/connectors/registry.ts
    connectorId: text("connector_id").notNull(),
    externalAccountId: text("external_account_id").notNull(),
    externalAccountName: text("external_account_name"),
    /**
     * Connector-specific routing hint. For Google Ads, the manager
     * customer id used in the `login-customer-id` header when the
     * external account is accessed via an MCC. Null when access is
     * direct or the connector doesn't need this.
     */
    loginCustomerId: text("login_customer_id"),

    // OAuth state. Refresh + access tokens are AES-256-GCM ciphertext (see
    // lib/crypto.ts). Access tokens are short-lived; we cache them between
    // refreshes to avoid hammering the token endpoint.
    encryptedRefreshToken: text("encrypted_refresh_token"),
    encryptedAccessToken: text("encrypted_access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "date",
      withTimezone: true,
    }),
    scope: text("scope"),

    status: text("status")
      .$type<"active" | "error" | "revoked">()
      .notNull()
      .default("active"),
    lastError: text("last_error"),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("connection_user_connector_account_unique").on(
      t.userId,
      t.connectorId,
      t.externalAccountId,
    ),
    index("connection_user_idx").on(t.userId),
  ],
);

export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
