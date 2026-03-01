import { db, eq } from "@openstatus/db";
import {
  monitor,
  page,
  pageComponent,
  pageComponentGroup,
  pageSubscriber,
  statusReport,
  statusReportUpdate,
  statusReportsToPageComponents,
} from "@openstatus/db/src/schema";

export const TEST_PREFIX = "api-status-page-test";

export interface TestDataSet {
  testPageId: number;
  testPageSlug: string;
  testPageToDeleteId: number;
  testPageToUpdateId: number;
  testComponentId: number;
  testComponentToDeleteId: number;
  testComponentToUpdateId: number;
  testGroupId: number;
  testGroupToDeleteId: number;
  testGroupToUpdateId: number;
  testMonitorId: number;
  testSubscriberId: number;
}

/**
 * Sets up test data for status page tests.
 * Creates test monitors, pages, components, groups, and subscribers.
 */
export async function setupTestData(): Promise<TestDataSet> {
  // Clean up any existing test data
  await cleanupTestData();

  // Create a test monitor for component tests
  const testMonitor = await db
    .insert(monitor)
    .values({
      workspaceId: 1,
      name: `${TEST_PREFIX}-monitor`,
      url: "https://example.com",
      periodicity: "1m",
      active: true,
      jobType: "http",
    })
    .returning()
    .get();

  // Create a test page (published and public for testing public access)
  const testPage = await db
    .insert(page)
    .values({
      workspaceId: 1,
      title: `${TEST_PREFIX}-page`,
      slug: `${TEST_PREFIX}-slug`,
      description: "Test page for status page tests",
      customDomain: "",
      published: true,
      accessType: "public",
    })
    .returning()
    .get();

  // Create page to delete
  const pageToDelete = await db
    .insert(page)
    .values({
      workspaceId: 1,
      title: `${TEST_PREFIX}-page-to-delete`,
      slug: `${TEST_PREFIX}-slug-to-delete`,
      description: "Test page to delete",
      customDomain: "",
    })
    .returning()
    .get();

  // Create page to update
  const pageToUpdate = await db
    .insert(page)
    .values({
      workspaceId: 1,
      title: `${TEST_PREFIX}-page-to-update`,
      slug: `${TEST_PREFIX}-slug-to-update`,
      description: "Test page to update",
      customDomain: "",
    })
    .returning()
    .get();

  // Create a test component group
  const testGroup = await db
    .insert(pageComponentGroup)
    .values({
      workspaceId: 1,
      pageId: testPage.id,
      name: `${TEST_PREFIX}-group`,
    })
    .returning()
    .get();

  // Create group to delete
  const groupToDelete = await db
    .insert(pageComponentGroup)
    .values({
      workspaceId: 1,
      pageId: testPage.id,
      name: `${TEST_PREFIX}-group-to-delete`,
    })
    .returning()
    .get();

  // Create group to update
  const groupToUpdate = await db
    .insert(pageComponentGroup)
    .values({
      workspaceId: 1,
      pageId: testPage.id,
      name: `${TEST_PREFIX}-group-to-update`,
    })
    .returning()
    .get();

  // Create a test component
  const testComponent = await db
    .insert(pageComponent)
    .values({
      workspaceId: 1,
      pageId: testPage.id,
      type: "static",
      name: `${TEST_PREFIX}-component`,
      description: "Test component",
      order: 100,
    })
    .returning()
    .get();

  // Create component to delete
  const componentToDelete = await db
    .insert(pageComponent)
    .values({
      workspaceId: 1,
      pageId: testPage.id,
      type: "static",
      name: `${TEST_PREFIX}-component-to-delete`,
      description: "Test component to delete",
      order: 101,
    })
    .returning()
    .get();

  // Create component to update
  const componentToUpdate = await db
    .insert(pageComponent)
    .values({
      workspaceId: 1,
      pageId: testPage.id,
      type: "static",
      name: `${TEST_PREFIX}-component-to-update`,
      description: "Test component to update",
      order: 102,
    })
    .returning()
    .get();

  // Create a test subscriber
  const testSubscriber = await db
    .insert(pageSubscriber)
    .values({
      pageId: testPage.id,
      email: `${TEST_PREFIX}@example.com`,
      token: `${TEST_PREFIX}-token`,
      acceptedAt: new Date(),
    })
    .returning()
    .get();

  return {
    testPageId: testPage.id,
    testPageSlug: testPage.slug,
    testPageToDeleteId: pageToDelete.id,
    testPageToUpdateId: pageToUpdate.id,
    testComponentId: testComponent.id,
    testComponentToDeleteId: componentToDelete.id,
    testComponentToUpdateId: componentToUpdate.id,
    testGroupId: testGroup.id,
    testGroupToDeleteId: groupToDelete.id,
    testGroupToUpdateId: groupToUpdate.id,
    testMonitorId: testMonitor.id,
    testSubscriberId: testSubscriber.id,
  };
}

/**
 * Cleans up test data after tests complete.
 * Removes all test records in proper order to avoid foreign key constraints.
 */
export async function cleanupTestData(): Promise<void> {
  // Clean up status report updates first (due to foreign key constraints)
  await db.delete(statusReportUpdate);

  // Clean up subscribers
  await db
    .delete(pageSubscriber)
    .where(eq(pageSubscriber.email, `${TEST_PREFIX}@example.com`));
  await db
    .delete(pageSubscriber)
    .where(eq(pageSubscriber.email, `${TEST_PREFIX}-subscribe@example.com`));

  // Clean up components
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component`));
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component-to-delete`));
  await db
    .delete(pageComponent)
    .where(eq(pageComponent.name, `${TEST_PREFIX}-component-to-update`));

  // Clean up component groups
  await db
    .delete(pageComponentGroup)
    .where(eq(pageComponentGroup.name, `${TEST_PREFIX}-group`));
  await db
    .delete(pageComponentGroup)
    .where(eq(pageComponentGroup.name, `${TEST_PREFIX}-group-to-delete`));
  await db
    .delete(pageComponentGroup)
    .where(eq(pageComponentGroup.name, `${TEST_PREFIX}-group-to-update`));

  // Clean up pages
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-slug`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-slug-to-delete`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-slug-to-update`));
  await db.delete(page).where(eq(page.slug, `${TEST_PREFIX}-created-slug`));

  // Clean up monitors
  await db.delete(monitor).where(eq(monitor.name, `${TEST_PREFIX}-monitor`));
}

/**
 * Creates a test status report for testing incident-related functionality
 */
export async function createTestStatusReport(
  pageId: number,
  componentId: number,
  title: string,
  status: string = "investigating",
) {
  const report = await db
    .insert(statusReport)
    .values({
      workspaceId: 1,
      pageId,
      title,
      status,
    })
    .returning()
    .get();

  await db.insert(statusReportsToPageComponents).values({
    statusReportId: report.id,
    pageComponentId: componentId,
  });

  return report;
}

/**
 * Common test assertions for API responses
 * Updated to work with mock service responses
 */
export const expectSuccessResponse = (response: any) => {
  expect(response.success).toBe(true);
  expect(response.data).toBeDefined();
};

export const expectUnauthorizedResponse = (response: any) => {
  expect(response.success).toBe(false);
};

export const expectNotFoundResponse = (response: any) => {
  expect(response.success).toBe(false);
};

export const expectConflictResponse = (response: any) => {
  expect(response.success).toBe(false);
};

export const expectForbiddenResponse = (response: any) => {
  expect(response.success).toBe(false);
};

export const expectBadRequestResponse = (response: any) => {
  expect(response.success).toBe(false);
};
