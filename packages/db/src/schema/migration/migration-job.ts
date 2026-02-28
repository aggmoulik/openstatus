import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { workspace } from "../workspaces/workspace";

export const migrationJob = sqliteTable("migration_job", {
  id: integer("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  status: text("status", {
    enum: ["pending", "running", "completed", "failed"],
  })
    .default("pending")
    .notNull(),
  progress: integer("progress").default(0),
  totalEntities: integer("total_entities").default(0),
  config: text("config", { mode: "json" }), // JSON for migration config
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export type MigrationJobModel = typeof migrationJob.$inferSelect;
export type NewMigrationJobModel = typeof migrationJob.$inferInsert;
