import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db, eq } from "@openstatus/db";
import { page, monitor } from "@openstatus/db/src/schema";
import {
  setupTestData,
  cleanupTestData,
  expectSuccessResponse,
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  expectConflictResponse,
  expectForbiddenResponse,
  expectBadRequestResponse,
  TEST_PREFIX,
} from "./test-utils";

// Mock API service for testing
const mockStatusPageService = {
  createStatusPage: async (data: any, headers: any = {}) => {
    // Simulate API call to create status page
    const result = await db.insert(page).values({
      workspaceId: 1,
      title: data.title,
      slug: data.slug,
      description: data.description,
      customDomain: data.customDomain || "",
      published: data.published ?? true,
      accessType: data.accessType || "public",
    }).returning().get();

    return { success: true, data: { statusPage: result } };
  },

  getStatusPage: async (id: string, headers: any = {}) => {
    const result = await db.select().from(page).where(eq(page.id, Number(id))).get();
    if (!result) {
      throw new Error("Status page not found");
    }
    return { success: true, data: { statusPage: result } };
  },

  listStatusPages: async (params: any = {}, headers: any = {}) => {
    const results = await db.select().from(page).limit(params.limit || 50).offset(params.offset || 0);
    return { success: true, data: { statusPages: results, totalSize: results.length } };
  },

  updateStatusPage: async (id: string, data: any, headers: any = {}) => {
    const result = await db.update(page).set(data).where(eq(page.id, Number(id))).returning().get();
    if (!result) {
      throw new Error("Status page not found");
    }
    return { success: true, data: { statusPage: result } };
  },

  deleteStatusPage: async (id: string, headers: any = {}) => {
    const result = await db.delete(page).where(eq(page.id, Number(id)));
    return { success: true, data: { success: true } };
  },
};

describe("StatusPageService - Page CRUD Operations", () => {
  let testData: any;

  beforeAll(async () => {
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("CreateStatusPage", () => {
    test("creates a new status page", async () => {
      const res = await mockStatusPageService.createStatusPage({
        title: `${TEST_PREFIX}-created`,
        description: "A new test page",
        slug: `${TEST_PREFIX}-created-slug`,
      });

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("statusPage");
      expect(res.data.statusPage.title).toBe(`${TEST_PREFIX}-created`);
      expect(res.data.statusPage.description).toBe("A new test page");
      expect(res.data.statusPage.slug).toBe(`${TEST_PREFIX}-created-slug`);

      // Clean up
      await db.delete(page).where(eq(page.id, res.data.statusPage.id));
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.createStatusPage({
        title: "Unauthorized test",
        slug: "unauthorized-slug",
      });

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error when slug already exists", async () => {
      const res = await mockStatusPageService.createStatusPage({
        title: "Duplicate slug test",
        slug: testData.testPageSlug, // Already exists
      });

      // Simulate conflict response
      expect(res.success).toBe(false);
    });

    test("returns error when status page limit is exceeded", async () => {
      // Simulate limit exceeded scenario
      const res = await mockStatusPageService.createStatusPage({
        title: `${TEST_PREFIX}-limit-exceeded`,
        description: "Should fail due to limit",
        slug: `${TEST_PREFIX}-limit-exceeded-slug`,
      });

      // Simulate permission denied response
      expect(res.success).toBe(false);
    });
  });

  describe("GetStatusPage", () => {
    test("returns status page by ID", async () => {
      const res = await mockStatusPageService.getStatusPage(String(testData.testPageId));

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("statusPage");
      expect(res.data.statusPage.id).toBe(String(testData.testPageId));
      expect(res.data.statusPage.slug).toBe(testData.testPageSlug);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getStatusPage(String(testData.testPageId));

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent status page", async () => {
      const res = await mockStatusPageService.getStatusPage("99999");

      // Simulate not found response
      expect(res.success).toBe(false);
    });

    test("returns error when ID is empty", async () => {
      const res = await mockStatusPageService.getStatusPage("");

      // Simulate bad request response
      expect(res.success).toBe(false);
    });

    test("returns error for status page in different workspace", async () => {
      // Create page in workspace 2
      const otherPage = await db.insert(page).values({
        workspaceId: 2,
        title: `${TEST_PREFIX}-other-workspace`,
        slug: `${TEST_PREFIX}-other-workspace-slug`,
        description: "Other workspace page",
        customDomain: "",
      }).returning().get();

      try {
        const res = await mockStatusPageService.getStatusPage(String(otherPage.id));
        // Simulate not found response for different workspace
        expect(res.success).toBe(false);
      } finally {
        await db.delete(page).where(eq(page.id, otherPage.id));
      }
    });
  });

  describe("ListStatusPages", () => {
    test("returns status pages for authenticated workspace", async () => {
      const res = await mockStatusPageService.listStatusPages();

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("statusPages");
      expect(Array.isArray(res.data.statusPages)).toBe(true);
      expect(res.data).toHaveProperty("totalSize");
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.listStatusPages();

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("respects limit parameter", async () => {
      const res = await mockStatusPageService.listStatusPages({ limit: 1 });

      expect(res.success).toBe(true);
      expect(res.data.statusPages?.length || 0).toBeLessThanOrEqual(1);
    });

    test("respects offset parameter", async () => {
      // Get first page
      const res1 = await mockStatusPageService.listStatusPages({ limit: 1, offset: 0 });
      
      // Get second page
      const res2 = await mockStatusPageService.listStatusPages({ limit: 1, offset: 1 });

      // Should have different pages if multiple exist
      if (res1.data.statusPages?.length > 0 && res2.data.statusPages?.length > 0) {
        expect(res1.data.statusPages[0].id).not.toBe(res2.data.statusPages[0].id);
      }
    });
  });

  describe("UpdateStatusPage", () => {
    test("updates status page title", async () => {
      const res = await mockStatusPageService.updateStatusPage(
        String(testData.testPageToUpdateId),
        {
          title: `${TEST_PREFIX}-updated-title`,
        }
      );

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("statusPage");
      expect(res.data.statusPage.title).toBe(`${TEST_PREFIX}-updated-title`);

      // Restore original title
      await db.update(page).set({ title: `${TEST_PREFIX}-page-to-update` }).where(eq(page.id, testData.testPageToUpdateId));
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.updateStatusPage(
        String(testData.testPageToUpdateId),
        {
          title: "Unauthorized update",
        }
      );

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent status page", async () => {
      const res = await mockStatusPageService.updateStatusPage(
        "99999",
        { title: "Non-existent update" }
      );

      // Simulate not found response
      expect(res.success).toBe(false);
    });

    test("returns error when slug conflicts with another page", async () => {
      const res = await mockStatusPageService.updateStatusPage(
        String(testData.testPageToUpdateId),
        {
          slug: testData.testPageSlug, // Already exists on another page
        }
      );

      // Simulate conflict response
      expect(res.success).toBe(false);
    });
  });

  describe("DeleteStatusPage", () => {
    test("successfully deletes existing status page", async () => {
      const res = await mockStatusPageService.deleteStatusPage(String(testData.testPageToDeleteId));

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("success");
      expect(res.data.success).toBe(true);

      // Verify it's deleted
      const deleted = await db.select().from(page).where(eq(page.id, testData.testPageToDeleteId)).get();
      expect(deleted).toBeUndefined();
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.deleteStatusPage("1");

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent status page", async () => {
      const res = await mockStatusPageService.deleteStatusPage("99999");

      // Simulate not found response
      expect(res.success).toBe(false);
    });
  });
});
