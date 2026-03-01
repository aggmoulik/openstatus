import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db, eq } from "@openstatus/db";
import { page, statusReport } from "@openstatus/db/src/schema";
import {
  setupTestData,
  cleanupTestData,
  expectSuccessResponse,
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  expectBadRequestResponse,
  TEST_PREFIX,
} from "./test-utils";

// Mock API service for testing
const mockStatusPageService = {
  getTemplates: async (params: any, headers: any = {}) => {
    const results = await db.select().from(statusReport)
      .where(eq(statusReport.pageId, params.pageId))
      .where(eq(statusReport.isTemplate, true))
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .execute();

    return { success: true, data: { templates: results } };
  },

  getTemplate: async (params: any, headers: any = {}) => {
    const result = await db.select().from(statusReport)
      .where(eq(statusReport.id, params.id))
      .where(eq(statusReport.isTemplate, true))
      .get();

    if (!result) {
      throw new Error("Template not found");
    }

    return { success: true, data: { template: result } };
  },

  createTemplate: async (data: any, headers: any = {}) => {
    const result = await db.insert(statusReport).values({
      workspaceId: 1,
      pageId: data.pageId,
      title: data.title,
      body: data.body || "",
      impactOverride: data.impact_override || null,
      isTemplate: true,
    }).returning().get();

    return { success: true, data: { template: result } };
  },

  updateTemplate: async (params: any, headers: any = {}) => {
    const result = await db.update(statusReport)
      .set({
        title: params.title,
        body: params.body,
        impactOverride: params.impact_override,
      })
      .where(eq(statusReport.id, params.id))
      .where(eq(statusReport.isTemplate, true))
      .returning()
      .get();

    if (!result) {
      throw new Error("Template not found");
    }

    return { success: true, data: { template: result } };
  },

  deleteTemplate: async (params: any, headers: any = {}) => {
    await db.delete(statusReport)
      .where(eq(statusReport.id, params.id))
      .where(eq(statusReport.isTemplate, true));
    return { success: true, data: { success: true } };
  },
};

describe("StatusPageService - Template Management", () => {
  let testData: any;

  beforeAll(async () => {
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("GetTemplates", () => {
    test("returns list of templates for page", async () => {
      // Create test templates
      const template1 = await db.insert(statusReport).values({
        workspaceId: 1,
        pageId: testData.testPageId,
        title: `${TEST_PREFIX}-template1`,
        body: "Template for API issues",
        impactOverride: "minor",
        isTemplate: true,
      }).returning().get();

      const template2 = await db.insert(statusReport).values({
        workspaceId: 1,
        pageId: testData.testPageId,
        title: `${TEST_PREFIX}-template2`,
        body: "Template for database issues",
        impactOverride: "major",
        isTemplate: true,
      }).returning().get();

      try {
        const res = await mockStatusPageService.getTemplates({
          pageId: testData.testPageId,
          limit: 10,
          offset: 0,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.templates).toHaveLength(2);
        expect(res.data.templates[0].title).toBe(`${TEST_PREFIX}-template1`);
        expect(res.data.templates[1].title).toBe(`${TEST_PREFIX}-template2`);
        expect(res.data.templates[0].isTemplate).toBe(true);
        expect(res.data.templates[1].isTemplate).toBe(true);
      } finally {
        // Clean up
        await db.delete(statusReport).where(eq(statusReport.id, template1.id));
        await db.delete(statusReport).where(eq(statusReport.id, template2.id));
      }
    });

    test("respects pagination parameters", async () => {
      const res = await mockStatusPageService.getTemplates({
        pageId: testData.testPageId,
        limit: 1,
        offset: 0,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.templates.length).toBeLessThanOrEqual(1);
    });

    test("returns only templates, not incidents", async () => {
      // Create a regular incident to ensure it's not returned
      await db.insert(statusReport).values({
        workspaceId: 1,
        pageId: testData.testPageId,
        title: `${TEST_PREFIX}-regular-incident`,
        body: "Regular incident",
        isTemplate: false,
      }).returning().get();

      const res = await mockStatusPageService.getTemplates({
        pageId: testData.testPageId,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.templates.every((template: any) => template.isTemplate)).toBe(true);

      // Clean up
      await db.delete(statusReport).where(eq(statusReport.id, res.data.templates[0].id));
      await db.delete(statusReport).where(eq(statusReport.id, res.data.templates[1].id));
      await db.delete(statusReport).where(eq(statusReport.id, res.data.templates[0].id));
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getTemplates({
        pageId: testData.testPageId,
      });

      expectUnauthorizedResponse(res);
    });

    test("returns error for non-existent page", async () => {
      const res = await mockStatusPageService.getTemplates({
        pageId: 99999,
      }, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });
  });

  describe("GetTemplate", () => {
    test("returns specific template", async () => {
      const testTemplate = await db.insert(statusReport).values({
        workspaceId: 1,
        pageId: testData.testPageId,
        title: `${TEST_PREFIX}-specific-template`,
        body: "Specific template content",
        impactOverride: "critical",
        isTemplate: true,
      }).returning().get();

      try {
        const res = await mockStatusPageService.getTemplate({
          id: testTemplate.id,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.template.id).toBe(testTemplate.id);
        expect(res.data.template.title).toBe(`${TEST_PREFIX}-specific-template`);
        expect(res.data.template.isTemplate).toBe(true);
      } finally {
        // Clean up
        await db.delete(statusReport).where(eq(statusReport.id, testTemplate.id));
      }
    });

    test("returns error for non-existent template", async () => {
      const res = await mockStatusPageService.getTemplate({
        id: 99999,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getTemplate({
        id: 1,
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("CreateTemplate", () => {
    test("creates template successfully", async () => {
      const templateData = {
        pageId: testData.testPageId,
        title: `${TEST_PREFIX}-new-template`,
        body: "Template for network issues",
        impactOverride: "minor",
      };

      const res = await mockStatusPageService.createTemplate(templateData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.template.title).toBe(`${TEST_PREFIX}-new-template`);
      expect(res.data.template.body).toBe("Template for network issues");
      expect(res.data.template.isTemplate).toBe(true);

      // Clean up
      await db.delete(statusReport).where(eq(statusReport.id, res.data.template.id));
    });

    test("creates template with minimal data", async () => {
      const templateData = {
        pageId: testData.testPageId,
        title: `${TEST_PREFIX}-minimal-template`,
      };

      const res = await mockStatusPageService.createTemplate(templateData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.template.title).toBe(`${TEST_PREFIX}-minimal-template`);
      expect(res.data.template.body).toBe("");
      expect(res.data.template.impactOverride).toBeNull();

      // Clean up
      await db.delete(statusReport).where(eq(statusReport.id, res.data.template.id));
    });

    test("returns error when no auth key provided", async () => {
      const templateData = {
        pageId: testData.testPageId,
        title: `${TEST_PREFIX}-unauthorized-template`,
      };

      const res = await mockStatusPageService.createTemplate(templateData);

      expectUnauthorizedResponse(res);
    });

    test("returns error for non-existent page", async () => {
      const templateData = {
        pageId: 99999,
        title: `${TEST_PREFIX}-invalid-page-template`,
      };

      const res = await mockStatusPageService.createTemplate(templateData, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });
  });

  describe("UpdateTemplate", () => {
    test("updates template successfully", async () => {
      // Create test template first
      const testTemplate = await db.insert(statusReport).values({
        workspaceId: 1,
        pageId: testData.testPageId,
        title: `${TEST_PREFIX}-update-template`,
        body: "Original template content",
        impactOverride: "minor",
        isTemplate: true,
      }).returning().get();

      try {
        const updateData = {
          title: `${TEST_PREFIX}-updated-template`,
          body: "Updated template content",
          impactOverride: "major",
        };

        const res = await mockStatusPageService.updateTemplate({
          id: testTemplate.id,
          ...updateData,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.template.title).toBe(`${TEST_PREFIX}-updated-template`);
        expect(res.data.template.body).toBe("Updated template content");
        expect(res.data.template.impactOverride).toBe("major");
      } finally {
        // Clean up
        await db.delete(statusReport).where(eq(statusReport.id, testTemplate.id));
      }
    });

    test("returns error for non-existent template", async () => {
      const res = await mockStatusPageService.updateTemplate({
        id: 99999,
        title: "updated-template",
        body: "Updated content",
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.updateTemplate({
        id: 1,
        title: "updated-template",
        body: "Updated content",
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("DeleteTemplate", () => {
    test("deletes template successfully", async () => {
      // Create test template first
      const testTemplate = await db.insert(statusReport).values({
        workspaceId: 1,
        pageId: testData.testPageId,
        title: `${TEST_PREFIX}-delete-template`,
        body: "Template to delete",
        isTemplate: true,
      }).returning().get();

      try {
        const res = await mockStatusPageService.deleteTemplate({
          id: testTemplate.id,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.success).toBe(true);

        // Verify deletion
        const deletedTemplate = await db.select().from(statusReport)
          .where(eq(statusReport.id, testTemplate.id))
          .get();
        expect(deletedTemplate).toBeNull();
      } finally {
        // Clean up if not already deleted
        if (deletedTemplate) {
          await db.delete(statusReport).where(eq(statusReport.id, testTemplate.id));
        }
      }
    });

    test("returns error for non-existent template", async () => {
      const res = await mockStatusPageService.deleteTemplate({
        id: 99999,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.deleteTemplate({
        id: 1,
      });

      expectUnauthorizedResponse(res);
    });
  });
});
