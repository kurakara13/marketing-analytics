import { pgTable, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

import { users } from "./auth";

// Report templates are user-defined PPT layouts. Each template is a
// JSON definition of slides + widgets — see lib/reports/templates/types.ts
// for the runtime shape.
//
// `schemaVersion` is incremented when the template definition shape
// changes in a backward-incompatible way. The renderer dispatches
// based on this version so old templates never break.
//
// `definition` is the JSONB payload — keep it loosely typed at the
// database layer (validated with Zod when read).
export const reportTemplates = pgTable(
  "report_template",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    description: text("description"),

    schemaVersion: integer("schema_version").notNull().default(1),
    definition: jsonb("definition").notNull(),

    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // List page sorts by recently updated.
    index("report_template_user_updated_idx").on(t.userId, t.updatedAt),
  ],
);

export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type NewReportTemplate = typeof reportTemplates.$inferInsert;
