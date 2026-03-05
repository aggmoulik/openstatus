import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { workspace } from "../workspaces";

export const migrationJobStatus = [
  "pending",
  "in_progress",
  "paused",
  "completed",
  "failed",
] as const;

export type MigrationEntityStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "failed";

export interface MigrationEntityProgress {
  status: MigrationEntityStatus;
  total: number;
  migrated: number;
  /** Maps source provider ID → OpenStatus DB id (number). Needed for FK resolution. */
  idMap?: Record<string, number>;
  /** For single-entity steps (e.g. page) */
  openStatusId?: number;
}

export interface MigrationProgress {
  page: Omit<MigrationEntityProgress, "total" | "migrated" | "idMap"> & {
    openStatusId?: number;
  };
  componentGroups: MigrationEntityProgress;
  components: MigrationEntityProgress;
  statusReports: MigrationEntityProgress;
  maintenances: MigrationEntityProgress;
  subscribers: MigrationEntityProgress;
}

export const migrationJob = sqliteTable("migration_job", {
  id: integer("id").primaryKey(),

  workspaceId: integer("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),

  provider: text("provider").notNull(), // e.g. "statuspage"
  externalPageId: text("external_page_id").notNull(), // source page ID

  status: text("status", { enum: migrationJobStatus })
    .notNull()
    .default("pending"),

  /** JSON checkpoint — written after each entity batch */
  progress: text("progress", { mode: "json" }).$type<MigrationProgress>(),

  error: text("error"), // last error message if status = "failed"

  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const migrationJobRelations = relations(migrationJob, ({ one }) => ({
  workspace: one(workspace, {
    fields: [migrationJob.workspaceId],
    references: [workspace.id],
  }),
}));
