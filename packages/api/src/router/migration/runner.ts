import { eq } from "@openstatus/db";
import {
  maintenance,
  maintenancesToPageComponents,
  migrationJob,
  page,
  pageComponent,
  pageComponentGroup,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";
import type { Context } from "../../trpc";
import { statuspageProvider } from "./providers/statuspage/adapter";
import type {
  ComponentIdMap,
  MigrationProgress,
  MigrationProvider,
} from "./types";

const providers: Record<string, MigrationProvider> = {
  statuspage: statuspageProvider,
};

export async function createJob(
  db: Context["db"],
  workspaceId: number,
  input: { provider: string; externalPageId: string; useMockData?: boolean },
) {
  const initialProgress: MigrationProgress = {
    useMockData: input.useMockData,
    page: { status: "pending" },
    componentGroups: { status: "pending", total: 0, migrated: 0, idMap: {} },
    components: { status: "pending", total: 0, migrated: 0, idMap: {} },
    statusReports: { status: "pending", total: 0, migrated: 0, idMap: {} },
    maintenances: { status: "pending", total: 0, migrated: 0, idMap: {} },
    subscribers: { status: "pending", total: 0, migrated: 0, idMap: {} },
  };

  const [job] = await db
    .insert(migrationJob)
    .values({
      workspaceId,
      provider: input.provider,
      externalPageId: input.externalPageId,
      status: "pending",
      progress: initialProgress,
    })
    .returning();

  return job!;
}

export async function runMigration(
  jobId: number,
  ctx: Context,
  apiKey: string,
) {
  const db = ctx.db;
  const job = await db.query.migrationJob.findFirst({
    where: eq(migrationJob.id, jobId),
  });

  if (!job) throw new Error("Job not found");

  const provider = providers[job.provider];
  if (!provider) throw new Error("Provider not found");

  try {
    await db
      .update(migrationJob)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(migrationJob.id, jobId));

    // 1. Fetch
    const progress = job.progress as MigrationProgress;
    const rawData = await provider.fetch({
      apiKey,
      pageId: job.externalPageId,
      useMock: progress.useMockData,
    });

    // 2. Transform
    const idMap: ComponentIdMap = new Map();
    // Load existing idMap if resuming (omitted for brevity in first pass)
    const plan = provider.transform(rawData, idMap);

    // 3. Page
    if (progress.page.status !== "done") {
      const [newPage] = await db
        .insert(page)
        .values({
          workspaceId: job.workspaceId,
          title: plan.page.title,
          description: plan.page.description,
          slug: plan.page.slug,
          customDomain: plan.page.customDomain,
          configuration: JSON.stringify({
            type: "absolute",
            value: "requests",
            uptime: true,
            theme: "default-rounded",
          }),
        })
        .returning();
      progress.page = { status: "done", openStatusId: newPage!.id };
      await checkpoint(db, jobId, progress);
    }

    const pageId = progress.page.openStatusId!;

    // 4. Component Groups
    if (progress.componentGroups.status !== "done") {
      progress.componentGroups.status = "in_progress";
      progress.componentGroups.total = plan.componentGroups.length;
      progress.componentGroups.idMap = progress.componentGroups.idMap || {};

      for (const group of plan.componentGroups) {
        if (progress.componentGroups.idMap[group.externalId]) continue;
        const [newGroup] = await db
          .insert(pageComponentGroup)
          .values({
            workspaceId: job.workspaceId,
            pageId,
            name: group.name,
          })
          .returning();
        progress.componentGroups.idMap[group.externalId] = newGroup!.id;
        progress.componentGroups.migrated++;
        await checkpoint(db, jobId, progress);
      }
      progress.componentGroups.status = "done";
      await checkpoint(db, jobId, progress);
    }

    // 5. Components
    if (progress.components.status !== "done") {
      progress.components.status = "in_progress";
      progress.components.total = plan.components.length;
      progress.components.idMap = progress.components.idMap || {};

      for (const comp of plan.components) {
        if (progress.components.idMap[comp.externalId]) continue;
        const groupId = comp.externalGroupId
          ? progress.componentGroups.idMap![comp.externalGroupId]
          : null;
        const [newComp] = await db
          .insert(pageComponent)
          .values({
            workspaceId: job.workspaceId,
            pageId,
            type: "static",
            name: comp.name,
            description: comp.description,
            groupId,
          })
          .returning();
        progress.components.idMap[comp.externalId] = newComp!.id;
        progress.components.migrated++;
        await checkpoint(db, jobId, progress);
      }
      progress.components.status = "done";
      await checkpoint(db, jobId, progress);
    }

    // 6. Status Reports
    if (progress.statusReports.status !== "done") {
      progress.statusReports.status = "in_progress";
      progress.statusReports.total = plan.statusReports.length;

      for (const report of plan.statusReports) {
        await db.transaction(async (tx: any) => {
          const [newReport] = await tx
            .insert(statusReport)
            .values({
              workspaceId: job.workspaceId,
              pageId,
              title: report.title,
              status: report.status,
              createdAt: report.createdAt,
            })
            .returning();

          for (const update of report.updates) {
            await tx.insert(statusReportUpdate).values({
              statusReportId: newReport!.id,
              status: update.status,
              message: update.message,
              date: update.date,
            });
          }

          if (report.affectedComponentIds?.length) {
            const values = report.affectedComponentIds
              .map((extId: string) => ({
                statusReportId: newReport!.id,
                pageComponentId: progress.components.idMap![extId],
              }))
              .filter((v: any) => v.pageComponentId);

            if (values.length) {
              await tx.insert(statusReportsToPageComponents).values(values);
            }
          }
        });
        progress.statusReports.migrated++;
        await checkpoint(db, jobId, progress);
      }
      progress.statusReports.status = "done";
      await checkpoint(db, jobId, progress);
    }

    // 7. Maintenances
    if (progress.maintenances.status !== "done") {
      progress.maintenances.status = "in_progress";
      progress.maintenances.total = plan.maintenances.length;

      for (const maint of plan.maintenances) {
        await db.transaction(async (tx: any) => {
          const [newMaint] = await tx
            .insert(maintenance)
            .values({
              workspaceId: job.workspaceId,
              pageId,
              title: maint.title,
              message: maint.message,
              from: maint.from,
              to: maint.to,
            })
            .returning();

          if (maint.affectedComponentIds?.length) {
            const values = maint.affectedComponentIds
              .map((extId: string) => ({
                maintenanceId: newMaint!.id,
                pageComponentId: progress.components.idMap![extId],
              }))
              .filter((v: any) => v.pageComponentId);

            if (values.length) {
              await tx.insert(maintenancesToPageComponents).values(values);
            }
          }
        });
        progress.maintenances.migrated++;
        await checkpoint(db, jobId, progress);
      }
      progress.maintenances.status = "done";
      await checkpoint(db, jobId, progress);
    }

    // 8. Subscribers
    if (progress.subscribers.status !== "done") {
      progress.subscribers.status = "in_progress";
      progress.subscribers.total = plan.subscribers.length;

      const subscriberValues = plan.subscribers.map((s) => ({
        pageId,
        email: s.email,
        token: Math.random().toString(36).substring(2, 15),
      }));

      if (subscriberValues.length) {
        await db.insert(pageSubscriber).values(subscriberValues);
      }

      progress.subscribers.status = "done";
      progress.subscribers.migrated = plan.subscribers.length;
      await checkpoint(db, jobId, progress);
    }

    await db
      .update(migrationJob)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(migrationJob.id, jobId));
  } catch (error: any) {
    await db
      .update(migrationJob)
      .set({
        status: "failed",
        error: error.message || "Unknown error",
        updatedAt: new Date(),
      })
      .where(eq(migrationJob.id, jobId));
    throw error;
  }
}

async function checkpoint(
  db: Context["db"],
  jobId: number,
  progress: MigrationProgress,
) {
  await db
    .update(migrationJob)
    .set({ progress, updatedAt: new Date() })
    .where(eq(migrationJob.id, jobId));
}
