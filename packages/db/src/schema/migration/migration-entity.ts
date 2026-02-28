import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { migrationJob } from "./migration-job";

export const migrationEntity = sqliteTable("migration_entity", {
  id: integer("id").primaryKey(),
  migrationJobId: integer("migration_job_id")
    .notNull()
    .references(() => migrationJob.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  sourceId: text("source_id").notNull(),
  targetId: integer("target_id"),
  status: text("status", {
    enum: ["pending", "completed", "failed", "skipped"],
  })
    .default("pending")
    .notNull(),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(
    sql`(strftime('%s', 'now'))`,
  ),
});

export const migrationEntityRelations = relations(
  migrationEntity,
  ({ one }) => ({
    migrationJob: one(migrationJob, {
      fields: [migrationEntity.migrationJobId],
      references: [migrationJob.id],
    }),
  }),
);

export type MigrationEntityModel = typeof migrationEntity.$inferSelect;
export type NewMigrationEntityModel = typeof migrationEntity.$inferInsert;
