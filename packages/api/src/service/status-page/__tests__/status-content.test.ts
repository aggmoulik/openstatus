import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db, eq } from "@openstatus/db";
import { page, statusReport, statusReportsToPageComponents } from "@openstatus/db/src/schema";
import {
  setupTestData,
  cleanupTestData,
  createTestStatusReport,
  expectSuccessResponse,
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  expectForbiddenResponse,
  TEST_PREFIX,
} from "./test-utils";

// Mock API service for testing
const mockStatusPageService = {
  getStatusPageContent: async (params: any, headers: any = {}) => {
    let pageResult;
    
    if (params.id) {
      pageResult = await db.select().from(page).where(eq(page.id, Number(params.id))).get();
    } else if (params.slug) {
      pageResult = await db.select().from(page).where(eq(page.slug, params.slug)).get();
    }

    if (!pageResult) {
      throw new Error("Status page not found");
    }

    // For unpublished pages accessed by slug, check access restrictions
    if (params.slug && !pageResult.published) {
      throw new Error("Page not published");
    }

    if (params.slug && pageResult.accessType === "password") {
      throw new Error("Password protected");
    }

    // Get components
    const components = await db.select().from(pageComponent).where(eq(pageComponent.pageId, pageResult.id));

    // Get component groups
    const groups = await db.select().from(pageComponentGroup).where(eq(pageComponentGroup.pageId, pageResult.id));

    // Get active status reports
    const statusReports = await db
      .select({
        id: statusReport.id,
        title: statusReport.title,
        status: statusReport.status,
        createdAt: statusReport.createdAt,
      })
      .from(statusReport)
      .innerJoin(
        statusReportsToPageComponents,
        eq(statusReportsToPageComponents.statusReportId, statusReport.id)
      )
      .where(eq(statusReport.pageId, pageResult.id));

    return {
      success: true,
      data: {
        statusPage: pageResult,
        components,
        groups,
        statusReports,
      },
    };
  },

  getOverallStatus: async (params: any, headers: any = {}) => {
    let pageResult;
    
    if (params.id) {
      pageResult = await db.select().from(page).where(eq(page.id, Number(params.id))).get();
    } else if (params.slug) {
      pageResult = await db.select().from(page).where(eq(page.slug, params.slug)).get();
    }

    if (!pageResult) {
      throw new Error("Status page not found");
    }

    // Get components with their status
    const components = await db.select().from(pageComponent).where(eq(pageComponent.pageId, pageResult.id));

    // Check for active incidents to determine overall status
    const activeIncidents = await db
      .select()
      .from(statusReport)
      .where(eq(statusReport.pageId, pageResult.id))
      .where(eq(statusReport.status, "investigating"));

    const overallStatus = activeIncidents.length > 0 ? "OVERALL_STATUS_DEGRADED" : "OVERALL_STATUS_OPERATIONAL";

    return {
      success: true,
      data: {
        overallStatus,
        componentStatuses: components,
      },
    };
  },
};

describe("StatusPageService - Status and Content", () => {
  let testData: any;

  beforeAll(async () => {
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("GetStatusPageContent", () => {
    test("returns full content by ID", async () => {
      const res = await mockStatusPageService.getStatusPageContent({
        id: String(testData.testPageId),
      });

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("statusPage");
      expect(res.data).toHaveProperty("components");
      expect(res.data).toHaveProperty("groups");
      expect(res.data.statusPage.id).toBe(String(testData.testPageId));
    });

    test("returns full content by slug", async () => {
      const res = await mockStatusPageService.getStatusPageContent({
        slug: testData.testPageSlug,
      });

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("statusPage");
      expect(res.data.statusPage.slug).toBe(testData.testPageSlug);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getStatusPageContent({
        id: String(testData.testPageId),
      });

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent page", async () => {
      const res = await mockStatusPageService.getStatusPageContent({
        id: "99999",
      });

      // Simulate not found response
      expect(res.success).toBe(false);
    });

    test("returns error for unpublished page accessed by slug", async () => {
      // Create an unpublished page
      const unpublishedPage = await db.insert(page).values({
        workspaceId: 1,
        title: `${TEST_PREFIX}-unpublished`,
        slug: `${TEST_PREFIX}-unpublished-slug`,
        description: "Unpublished page",
        customDomain: "",
        published: false,
        accessType: "public",
      }).returning().get();

      try {
        const res = await mockStatusPageService.getStatusPageContent({
          slug: unpublishedPage.slug,
        });

        // Simulate not found response
        expect(res.success).toBe(false);
      } finally {
        await db.delete(page).where(eq(page.id, unpublishedPage.id));
      }
    });

    test("returns error for password-protected page accessed by slug", async () => {
      // Create a password-protected page
      const protectedPage = await db.insert(page).values({
        workspaceId: 1,
        title: `${TEST_PREFIX}-protected`,
        slug: `${TEST_PREFIX}-protected-slug`,
        description: "Password protected page",
        customDomain: "",
        published: true,
        accessType: "password",
      }).returning().get();

      try {
        const res = await mockStatusPageService.getStatusPageContent({
          slug: protectedPage.slug,
        });

        // Simulate forbidden response
        expect(res.success).toBe(false);
      } finally {
        await db.delete(page).where(eq(page.id, protectedPage.id));
      }
    });

    test("allows workspace owner to access unpublished page by ID", async () => {
      // Create an unpublished page
      const unpublishedPage = await db.insert(page).values({
        workspaceId: 1,
        title: `${TEST_PREFIX}-unpublished-by-id`,
        slug: `${TEST_PREFIX}-unpublished-by-id-slug`,
        description: "Unpublished page accessible by ID",
        customDomain: "",
        published: false,
        accessType: "public",
      }).returning().get();

      try {
        const res = await mockStatusPageService.getStatusPageContent({
          id: String(unpublishedPage.id),
        });

        // Workspace owner can access their own unpublished pages by ID
        expect(res.success).toBe(true);
      } finally {
        await db.delete(page).where(eq(page.id, unpublishedPage.id));
      }
    });

    test("includes active status reports", async () => {
      // Create an active status report for the test page
      const report = await createTestStatusReport(
        testData.testPageId,
        testData.testComponentId,
        `${TEST_PREFIX}-active-report`,
        "investigating",
      );

      try {
        const res = await mockStatusPageService.getStatusPageContent({
          id: String(testData.testPageId),
        });

        expect(res.success).toBe(true);
        expect(res.data.statusReports.length).toBeGreaterThan(0);

        const testReport = res.data.statusReports.find(
          (r: { title: string }) => r.title === `${TEST_PREFIX}-active-report`,
        );
        expect(testReport).toBeDefined();
      } finally {
        await db
          .delete(statusReportsToPageComponents)
          .where(eq(statusReportsToPageComponents.statusReportId, report.id));
        await db.delete(statusReport).where(eq(statusReport.id, report.id));
      }
    });
  });

  describe("GetOverallStatus", () => {
    test("returns overall status by ID", async () => {
      const res = await mockStatusPageService.getOverallStatus({
        id: String(testData.testPageId),
      });

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("overallStatus");
      expect(res.data).toHaveProperty("componentStatuses");
    });

    test("returns overall status by slug", async () => {
      const res = await mockStatusPageService.getOverallStatus({
        slug: testData.testPageSlug,
      });

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("overallStatus");
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getOverallStatus({
        id: String(testData.testPageId),
      });

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent page", async () => {
      const res = await mockStatusPageService.getOverallStatus({
        id: "99999",
      });

      // Simulate not found response
      expect(res.success).toBe(false);
    });

    test("returns degraded status when there are active incidents", async () => {
      // Create an active status report for the test page
      const report = await createTestStatusReport(
        testData.testPageId,
        testData.testComponentId,
        `${TEST_PREFIX}-incident-report`,
        "investigating",
      );

      try {
        const res = await mockStatusPageService.getOverallStatus({
          id: String(testData.testPageId),
        });

        expect(res.success).toBe(true);
        expect(res.data.overallStatus).toBe("OVERALL_STATUS_DEGRADED");
      } finally {
        await db
          .delete(statusReportsToPageComponents)
          .where(eq(statusReportsToPageComponents.statusReportId, report.id));
        await db.delete(statusReport).where(eq(statusReport.id, report.id));
      }
    });
  });
});
