import { expect, test } from "bun:test";
import { afterEach } from "bun:test";
import { db, eq } from "@openstatus/db";
import {
  migrationJob,
  page,
  pageComponent,
  statusReport,
} from "@openstatus/db/src/schema";
import { edgeRouter } from "../edge";
import { createInnerTRPCContext } from "../trpc";

const workspaceId = 1;
const userId = "1";

afterEach(async () => {
  // Clean up any pages created during tests to avoid UNIQUE constraint violations
  await db.delete(page).where(eq(page.slug, "acme-test"));
});

test("migration.import with dryRun returns plan summary", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: userId } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: workspaceId },
  });
  const caller = edgeRouter.createCaller(ctx);

  const result = await caller.migration.import({
    provider: "statuspage",
    apiKey: "test-key",
    pageId: "page-1",
    useMockData: true,
    dryRun: true,
  });

  expect(result.jobId).toBeDefined();
  expect(result.plan).toBeDefined();
  expect(result.plan.page.title).toBe("Acme Status Page");
});

test("migration.import with mock data (full run)", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: userId } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: workspaceId },
  });
  const caller = edgeRouter.createCaller(ctx);

  const result = await caller.migration.import({
    provider: "statuspage",
    apiKey: "test-key",
    pageId: "page-1",
    useMockData: true,
    dryRun: false,
  });

  expect(result.jobId).toBeDefined();

  // Wait for background migration to complete (since we are using fire-and-forget)
  // In tests, we might want to wait or poll.
  let job;
  for (let i = 0; i < 10; i++) {
    job = await caller.migration.status({ jobId: result.jobId });
    if (job.status === "completed" || job.status === "failed") break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  expect(job?.status).toBe("completed");

  // Verify Page
  const migratedPage = await db.query.page.findFirst({
    where: eq(page.slug, "acme-test"),
  });
  expect(migratedPage).toBeDefined();
  expect(migratedPage?.title).toBe("Acme Status Page");

  // Verify Components
  const components = await db.query.pageComponent.findMany({
    where: eq(pageComponent.pageId, migratedPage!.id),
  });
  expect(components.length).toBe(4);

  // Verify Status Reports
  const reports = await db.query.statusReport.findMany({
    where: eq(statusReport.pageId, migratedPage!.id),
  });
  expect(reports.length).toBe(2); // One incident, one minor latency. Maintenance is handled separately.

  // Verify Postmortem (appended update)
  const dbReport = await db.query.statusReport.findFirst({
    where: eq(statusReport.title, "Database Outage"),
    with: { statusReportUpdates: true },
  });
  const postmortemUpdate = dbReport?.statusReportUpdates.find((u) =>
    u.message.includes("## Postmortem"),
  );
  expect(postmortemUpdate).toBeDefined();
});

test("migration.status returns 404 for non-existent job", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: userId } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: workspaceId },
  });
  const caller = edgeRouter.createCaller(ctx);

  try {
    await caller.migration.status({ jobId: 999999 });
    throw new Error("Should have thrown");
  } catch (e: any) {
    expect(e.code).toBe("NOT_FOUND");
  }
});

test("migration.list returns jobs for workspace", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: userId } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: workspaceId },
  });
  const caller = edgeRouter.createCaller(ctx);

  const jobs = await caller.migration.list();
  expect(jobs.length).toBeGreaterThan(0);
  expect(jobs[0].externalPageId).toBe("page-1");
});

test("migration.resume continues migration", async () => {
  const ctx = createInnerTRPCContext({
    req: undefined,
    session: { user: { id: userId } },
    // @ts-expect-error - minimal workspace for test
    workspace: { id: workspaceId },
  });
  const caller = edgeRouter.createCaller(ctx);

  // Manually create a failed job
  const [job] = await db
    .insert(migrationJob)
    .values({
      workspaceId,
      provider: "statuspage",
      externalPageId: "page-1",
      status: "failed",
      progress: {
        useMockData: true,
        page: { status: "pending" },
        componentGroups: {
          status: "pending",
          total: 0,
          migrated: 0,
          idMap: {},
        },
        components: { status: "pending", total: 0, migrated: 0, idMap: {} },
        statusReports: { status: "pending", total: 0, migrated: 0, idMap: {} },
        maintenances: { status: "pending", total: 0, migrated: 0, idMap: {} },
        subscribers: { status: "pending", total: 0, migrated: 0, idMap: {} },
      },
    })
    .returning();

  const result = await caller.migration.resume({
    jobId: job.id,
    apiKey: "test-key",
  });
  expect(result.message).toBe("Migration resumed");

  // Wait for it to complete
  let updatedJob;
  for (let i = 0; i < 10; i++) {
    updatedJob = await caller.migration.status({ jobId: job.id });
    if (updatedJob.status === "completed" || updatedJob.status === "failed")
      break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  expect(updatedJob?.status).toBe("completed");
});
