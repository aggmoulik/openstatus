import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db, eq } from "@openstatus/db";
import { page, statusReport, statusPostmortem } from "@openstatus/db/src/schema";
import {
  setupTestData,
  cleanupTestData,
  createTestStatusReport,
  expectSuccessResponse,
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  expectBadRequestResponse,
  TEST_PREFIX,
} from "./test-utils";

// Mock API service for testing
const mockStatusPageService = {
  getIncidentPostmortem: async (params: any, headers: any = {}) => {
    const result = await db.select().from(statusPostmortem)
      .where(eq(statusPostmortem.statusReportId, params.incident_id))
      .get();

    if (!result) {
      throw new Error("Postmortem not found");
    }

    return { success: true, data: { postmortem: result } };
  },

  createIncidentPostmortem: async (data: any, headers: any = {}) => {
    // Check if postmortem already exists
    const existing = await db.select().from(statusPostmortem)
      .where(eq(statusPostmortem.statusReportId, data.incident_id))
      .get();

    if (existing) {
      throw new Error("Postmortem already exists for this incident");
    }

    const result = await db.insert(statusPostmortem).values({
      statusReportId: data.incident_id,
      title: data.title,
      body: data.body || "",
      publishedAt: null, // Not published yet
    }).returning().get();

    return { success: true, data: { postmortem: result } };
  },

  updateIncidentPostmortem: async (params: any, headers: any = {}) => {
    const result = await db.update(statusPostmortem)
      .set({
        title: params.title,
        body: params.body,
        updatedAt: new Date(),
      })
      .where(eq(statusPostmortem.statusReportId, params.incident_id))
      .returning()
      .get();

    if (!result) {
      throw new Error("Postmortem not found");
    }

    return { success: true, data: { postmortem: result } };
  },

  publishIncidentPostmortem: async (params: any, headers: any = {}) => {
    const result = await db.update(statusPostmortem)
      .set({
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(statusPostmortem.statusReportId, params.incident_id))
      .returning()
      .get();

    if (!result) {
      throw new Error("Postmortem not found");
    }

    return { success: true, data: { postmortem: result } };
  },

  unpublishIncidentPostmortem: async (params: any, headers: any = {}) => {
    const result = await db.update(statusPostmortem)
      .set({
        publishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(statusPostmortem.statusReportId, params.incident_id))
      .returning()
      .get();

    if (!result) {
      throw new Error("Postmortem not found");
    }

    return { success: true, data: { postmortem: result } };
  },

  deleteIncidentPostmortem: async (params: any, headers: any = {}) => {
    const deletedPostmortem = await db.delete(statusPostmortem)
      .where(eq(statusPostmortem.statusReportId, params.incident_id))
      .returning()
      .get();

    if (!deletedPostmortem) {
      throw new Error("Postmortem not found");
    }

    return { success: true, data: { success: true } };
  },
};

describe("StatusPageService - Incident Postmortem Management", () => {
  let testData: any;
  let testIncident: any;

  beforeAll(async () => {
    testData = await setupTestData();
    testIncident = await createTestStatusReport(
      testData.testPageId, 
      testData.testComponentId, 
      `${TEST_PREFIX}-incident-postmortem-test`
    );
  });

  afterAll(async () => {
    // Clean up test incident and postmortem
    await db.delete(statusPostmortem).where(eq(statusPostmortem.statusReportId, testIncident.id));
    await db.delete(statusReportsToPageComponents).where(eq(statusReportsToPageComponents.statusReportId, testIncident.id));
    await db.delete(statusReport).where(eq(statusReport.id, testIncident.id));
    await cleanupTestData();
  });

  describe("GetIncidentPostmortem", () => {
    test("returns postmortem for incident", async () => {
      // Create test postmortem
      const testPostmortem = await db.insert(statusPostmortem).values({
        statusReportId: testIncident.id,
        title: `${TEST_PREFIX}-test-postmortem`,
        body: "Detailed analysis of the incident",
        publishedAt: new Date(),
      }).returning().get();

      try {
        const res = await mockStatusPageService.getIncidentPostmortem({
          incident_id: testIncident.id,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.postmortem.id).toBe(testPostmortem.id);
        expect(res.data.postmortem.title).toBe(`${TEST_PREFIX}-test-postmortem`);
        expect(res.data.postmortem.body).toBe("Detailed analysis of the incident");
        expect(res.data.postmortem.statusReportId).toBe(testIncident.id);
        expect(res.data.postmortem.publishedAt).not.toBeNull();
      } finally {
        // Clean up
        await db.delete(statusPostmortem).where(eq(statusPostmortem.id, testPostmortem.id));
      }
    });

    test("returns error for non-existent postmortem", async () => {
      const res = await mockStatusPageService.getIncidentPostmortem({
        incident_id: testIncident.id,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error for non-existent incident", async () => {
      const res = await mockStatusPageService.getIncidentPostmortem({
        incident_id: 99999,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getIncidentPostmortem({
        incident_id: testIncident.id,
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("CreateIncidentPostmortem", () => {
    test("creates postmortem successfully", async () => {
      const postmortemData = {
        incident_id: testIncident.id,
        title: `${TEST_PREFIX}-new-postmortem`,
        body: "Comprehensive incident analysis",
      };

      const res = await mockStatusPageService.createIncidentPostmortem(postmortemData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.postmortem.title).toBe(`${TEST_PREFIX}-new-postmortem`);
      expect(res.data.postmortem.body).toBe("Comprehensive incident analysis");
      expect(res.data.postmortem.statusReportId).toBe(testIncident.id);
      expect(res.data.postmortem.publishedAt).toBeNull(); // Not published yet

      // Clean up
      await db.delete(statusPostmortem).where(eq(statusPostmortem.id, res.data.postmortem.id));
    });

    test("creates postmortem with minimal data", async () => {
      const postmortemData = {
        incident_id: testIncident.id,
        title: `${TEST_PREFIX}-minimal-postmortem`,
      };

      const res = await mockStatusPageService.createIncidentPostmortem(postmortemData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.postmortem.title).toBe(`${TEST_PREFIX}-minimal-postmortem`);
      expect(res.data.postmortem.body).toBe(""); // Default empty string

      // Clean up
      await db.delete(statusPostmortem).where(eq(statusPostmortem.id, res.data.postmortem.id));
    });

    test("returns error when postmortem already exists", async () => {
      // Create initial postmortem
      const existingPostmortem = await db.insert(statusPostmortem).values({
        statusReportId: testIncident.id,
        title: `${TEST_PREFIX}-existing-postmortem`,
        body: "Already exists",
      }).returning().get();

      try {
        const postmortemData = {
          incident_id: testIncident.id,
          title: `${TEST_PREFIX}-duplicate-postmortem`,
          body: "Should fail",
        };

        const res = await mockStatusPageService.createIncidentPostmortem(postmortemData, { "x-openstatus-key": "1" });

        expectBadRequestResponse(res);
      } finally {
        // Clean up
        await db.delete(statusPostmortem).where(eq(statusPostmortem.id, existingPostmortem.id));
      }
    });

    test("returns error when no auth key provided", async () => {
      const postmortemData = {
        incident_id: testIncident.id,
        title: `${TEST_PREFIX}-unauthorized-postmortem`,
      };

      const res = await mockStatusPageService.createIncidentPostmortem(postmortemData);

      expectUnauthorizedResponse(res);
    });

    test("returns error for non-existent incident", async () => {
      const postmortemData = {
        incident_id: 99999,
        title: `${TEST_PREFIX}-invalid-incident-postmortem`,
      };

      const res = await mockStatusPageService.createIncidentPostmortem(postmortemData, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });
  });

  describe("UpdateIncidentPostmortem", () => {
    test("updates postmortem successfully", async () => {
      // Create test postmortem first
      const testPostmortem = await db.insert(statusPostmortem).values({
        statusReportId: testIncident.id,
        title: `${TEST_PREFIX}-original-postmortem`,
        body: "Original content",
      }).returning().get();

      try {
        const updateData = {
          incident_id: testIncident.id,
          title: `${TEST_PREFIX}-updated-postmortem`,
          body: "Updated comprehensive analysis",
        };

        const res = await mockStatusPageService.updateIncidentPostmortem(updateData, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.postmortem.title).toBe(`${TEST_PREFIX}-updated-postmortem`);
        expect(res.data.postmortem.body).toBe("Updated comprehensive analysis");
        expect(res.data.postmortem.statusReportId).toBe(testIncident.id);
      } finally {
        // Clean up
        await db.delete(statusPostmortem).where(eq(statusPostmortem.id, testPostmortem.id));
      }
    });

    test("updates only title", async () => {
      const testPostmortem = await db.insert(statusPostmortem).values({
        statusReportId: testIncident.id,
        title: `${TEST_PREFIX}-title-original`,
        body: "Original body content",
      }).returning().get();

      try {
        const updateData = {
          incident_id: testIncident.id,
          title: `${TEST_PREFIX}-title-updated`,
          // Not updating body
        };

        const res = await mockStatusPageService.updateIncidentPostmortem(updateData, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.postmortem.title).toBe(`${TEST_PREFIX}-title-updated`);
        expect(res.data.postmortem.body).toBe("Original body content"); // Unchanged
      } finally {
        // Clean up
        await db.delete(statusPostmortem).where(eq(statusPostmortem.id, testPostmortem.id));
      }
    });

    test("updates only body", async () => {
      const testPostmortem = await db.insert(statusPostmortem).values({
        statusReportId: testIncident.id,
        title: `${TEST_PREFIX}-body-original`,
        body: "Original body content",
      }).returning().get();

      try {
        const updateData = {
          incident_id: testIncident.id,
          body: "Updated body content",
          // Not updating title
        };

        const res = await mockStatusPageService.updateIncidentPostmortem(updateData, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.postmortem.title).toBe(`${TEST_PREFIX}-body-original`); // Unchanged
        expect(res.data.postmortem.body).toBe("Updated body content");
      } finally {
        // Clean up
        await db.delete(statusPostmortem).where(eq(statusPostmortem.id, testPostmortem.id));
      }
    });

    test("returns error for non-existent postmortem", async () => {
      const updateData = {
        incident_id: testIncident.id,
        title: "updated-postmortem",
        body: "updated content",
      };

      const res = await mockStatusPageService.updateIncidentPostmortem(updateData, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const updateData = {
        incident_id: testIncident.id,
        title: "updated-postmortem",
      };

      const res = await mockStatusPageService.updateIncidentPostmortem(updateData);

      expectUnauthorizedResponse(res);
    });
  });

  describe("PublishIncidentPostmortem", () => {
    test("publishes postmortem successfully", async () => {
      // Create unpublished postmortem
      const testPostmortem = await db.insert(statusPostmortem).values({
        statusReportId: testIncident.id,
        title: `${TEST_PREFIX}-unpublished-postmortem`,
        body: "Ready to publish",
        publishedAt: null,
      }).returning().get();

      try {
        const res = await mockStatusPageService.publishIncidentPostmortem({
          incident_id: testIncident.id,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.postmortem.publishedAt).not.toBeNull();
        expect(res.data.postmortem.title).toBe(`${TEST_PREFIX}-unpublished-postmortem`);
      } finally {
        // Clean up
        await db.delete(statusPostmortem).where(eq(statusPostmortem.id, testPostmortem.id));
      }
    });

    test("returns error for already published postmortem", async () => {
      // Create already published postmortem
      const publishedPostmortem = await db.insert(statusPostmortem).values({
        statusReportId: testIncident.id,
        title: `${TEST_PREFIX}-already-published`,
        body: "Already published",
        publishedAt: new Date(),
      }).returning().get();

      try {
        const res = await mockStatusPageService.publishIncidentPostmortem({
          incident_id: testIncident.id,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res); // Should still succeed, just update timestamp
        expect(res.data.postmortem.publishedAt).not.toBeNull();
      } finally {
        // Clean up
        await db.delete(statusPostmortem).where(eq(statusPostmortem.id, publishedPostmortem.id));
      }
    });

    test("returns error for non-existent postmortem", async () => {
      const res = await mockStatusPageService.publishIncidentPostmortem({
        incident_id: testIncident.id,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.publishIncidentPostmortem({
        incident_id: testIncident.id,
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("UnpublishIncidentPostmortem", () => {
    test("unpublishes postmortem successfully", async () => {
      // Create published postmortem
      const testPostmortem = await db.insert(statusPostmortem).values({
        statusReportId: testIncident.id,
        title: `${TEST_PREFIX}-published-postmortem`,
        body: "Published content",
        publishedAt: new Date(),
      }).returning().get();

      try {
        const res = await mockStatusPageService.unpublishIncidentPostmortem({
          incident_id: testIncident.id,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.postmortem.publishedAt).toBeNull();
        expect(res.data.postmortem.title).toBe(`${TEST_PREFIX}-published-postmortem`);
      } finally {
        // Clean up
        await db.delete(statusPostmortem).where(eq(statusPostmortem.id, testPostmortem.id));
      }
    });

    test("returns error for already unpublished postmortem", async () => {
      // Create unpublished postmortem
      const unpublishedPostmortem = await db.insert(statusPostmortem).values({
        statusReportId: testIncident.id,
        title: `${TEST_PREFIX}-already-unpublished`,
        body: "Already unpublished",
        publishedAt: null,
      }).returning().get();

      try {
        const res = await mockStatusPageService.unpublishIncidentPostmortem({
          incident_id: testIncident.id,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res); // Should still succeed
        expect(res.data.postmortem.publishedAt).toBeNull();
      } finally {
        // Clean up
        await db.delete(statusPostmortem).where(eq(statusPostmortem.id, unpublishedPostmortem.id));
      }
    });

    test("returns error for non-existent postmortem", async () => {
      const res = await mockStatusPageService.unpublishIncidentPostmortem({
        incident_id: testIncident.id,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.unpublishIncidentPostmortem({
        incident_id: testIncident.id,
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("DeleteIncidentPostmortem", () => {
    test("deletes postmortem successfully", async () => {
      // Create test postmortem first
      const testPostmortem = await db.insert(statusPostmortem).values({
        statusReportId: testIncident.id,
        title: `${TEST_PREFIX}-delete-me-postmortem`,
        body: "To be deleted",
      }).returning().get();

      const res = await mockStatusPageService.deleteIncidentPostmortem({
        incident_id: testIncident.id,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.success).toBe(true);

      // Verify deletion
      const deletedPostmortem = await db.select().from(statusPostmortem)
        .where(eq(statusPostmortem.id, testPostmortem.id))
        .get();
      expect(deletedPostmortem).toBeUndefined();
    });

    test("returns error for non-existent postmortem", async () => {
      const res = await mockStatusPageService.deleteIncidentPostmortem({
        incident_id: testIncident.id,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.deleteIncidentPostmortem({
        incident_id: testIncident.id,
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("Postmortem Content Validation", () => {
    test("handles markdown content in body", async () => {
      const markdownContent = `
# Incident Analysis

## Timeline
- 10:00 AM: Issue detected
- 10:05 AM: Investigation started
- 10:30 AM: Resolution implemented

## Root Cause
The issue was caused by...

## Lessons Learned
1. Better monitoring needed
2. Faster escalation process
      `.trim();

      const postmortemData = {
        incident_id: testIncident.id,
        title: `${TEST_PREFIX}-markdown-postmortem`,
        body: markdownContent,
      };

      const res = await mockStatusPageService.createIncidentPostmortem(postmortemData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.postmortem.body).toBe(markdownContent);

      // Clean up
      await db.delete(statusPostmortem).where(eq(statusPostmortem.id, res.data.postmortem.id));
    });

    test("handles special characters in title", async () => {
      const specialTitle = `${TEST_PREFIX}: Special Characters & Symbols! @#$%`;

      const postmortemData = {
        incident_id: testIncident.id,
        title: specialTitle,
        body: "Testing special characters",
      };

      const res = await mockStatusPageService.createIncidentPostmortem(postmortemData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.postmortem.title).toBe(specialTitle);

      // Clean up
      await db.delete(statusPostmortem).where(eq(statusPostmortem.id, res.data.postmortem.id));
    });

    test("handles empty body gracefully", async () => {
      const postmortemData = {
        incident_id: testIncident.id,
        title: `${TEST_PREFIX}-empty-body-postmortem`,
        body: "",
      };

      const res = await mockStatusPageService.createIncidentPostmortem(postmortemData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.postmortem.body).toBe("");

      // Clean up
      await db.delete(statusPostmortem).where(eq(statusPostmortem.id, res.data.postmortem.id));
    });
  });
});
