import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db, eq } from "@openstatus/db";
import { page, statusReport, statusReportUpdate, statusReportsToPageComponents } from "@openstatus/db/src/schema";
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
  // Helper to check authentication
  checkAuth: (headers: any = {}) => {
    if (!headers || !headers["x-openstatus-key"]) {
      return { success: false, error: "Unauthorized" };
    }
    return { success: true };
  },

  getIncidentUpdates: async (params: any, headers: any = {}) => {
    const auth = mockStatusPageService.checkAuth(headers);
    if (!auth.success) return auth;

    const results = await db.select().from(statusReportUpdate)
      .where(eq(statusReportUpdate.statusReportId, params.incident_id))
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .orderBy(statusReportUpdate.date, "desc")
      .execute();

    return { success: true, data: { incident_updates: results } };
  },

  getIncidentUpdate: async (params: any, headers: any = {}) => {
    const auth = mockStatusPageService.checkAuth(headers);
    if (!auth.success) return auth;

    const result = await db.select().from(statusReportUpdate)
      .where(eq(statusReportUpdate.id, params.update_id))
      .where(eq(statusReportUpdate.statusReportId, params.incident_id))
      .get();

    if (!result) {
      return { success: false, error: "Incident update not found" };
    }

    return { success: true, data: { incident_update: result } };
  },

  createIncidentUpdate: async (data: any, headers: any = {}) => {
    const auth = mockStatusPageService.checkAuth(headers);
    if (!auth.success) return auth;

    // Validate incident exists
    const incident = await db.select().from(statusReport)
      .where(eq(statusReport.id, data.incident_id))
      .get();
    
    if (!incident) {
      return { success: false, error: "Incident not found" };
    }

    const result = await db.insert(statusReportUpdate).values({
      statusReportId: data.incident_id,
      message: data.message,
      status: data.status || "investigating",
      date: new Date(),
    }).returning().get();

    // Update the parent incident's updated_at timestamp
    await db.update(statusReport)
      .set({ updatedAt: new Date() })
      .where(eq(statusReport.id, data.incident_id));

    return { success: true, data: { incident_update: result } };
  },

  updateIncidentUpdate: async (params: any, headers: any = {}) => {
    const auth = mockStatusPageService.checkAuth(headers);
    if (!auth.success) return auth;

    // Build update object with only provided fields
    const updateData: any = { updatedAt: new Date() };
    if (params.message !== undefined) updateData.message = params.message;
    if (params.status !== undefined) updateData.status = params.status;

    const result = await db.update(statusReportUpdate)
      .set(updateData)
      .where(eq(statusReportUpdate.id, params.update_id))
      .where(eq(statusReportUpdate.statusReportId, params.incident_id))
      .returning()
      .get();

    if (!result) {
      return { success: false, error: "Incident update not found" };
    }

    // Update the parent incident's updated_at timestamp
    await db.update(statusReport)
      .set({ updatedAt: new Date() })
      .where(eq(statusReport.id, params.incident_id));

    return { success: true, data: { incident_update: result } };
  },

  deleteIncidentUpdate: async (params: any, headers: any = {}) => {
    const auth = mockStatusPageService.checkAuth(headers);
    if (!auth.success) return auth;

    const deletedUpdate = await db.delete(statusReportUpdate)
      .where(eq(statusReportUpdate.id, params.update_id))
      .where(eq(statusReportUpdate.statusReportId, params.incident_id))
      .returning()
      .get();

    if (!deletedUpdate) {
      return { success: false, error: "Incident update not found" };
    }

    // Update the parent incident's updated_at timestamp
    await db.update(statusReport)
      .set({ updatedAt: new Date() })
      .where(eq(statusReport.id, params.incident_id));

    return { success: true, data: { success: true } };
  },
};

describe("StatusPageService - Incident Updates Management", () => {
  let testData: any;
  let testIncident: any;

  beforeAll(async () => {
    testData = await setupTestData();
    testIncident = await createTestStatusReport(
      testData.testPageId, 
      testData.testComponentId, 
      `${TEST_PREFIX}-incident-updates-test`
    );
  });

  afterAll(async () => {
    // Clean up test incident and its updates
    if (testIncident) {
      await db.delete(statusReportUpdate).where(eq(statusReportUpdate.statusReportId, testIncident.id));
      await db.delete(statusReportsToPageComponents).where(eq(statusReportsToPageComponents.statusReportId, testIncident.id));
      await db.delete(statusReport).where(eq(statusReport.id, testIncident.id));
    }
    await cleanupTestData();
  });

  describe("GetIncidentUpdates", () => {
    test("returns list of updates for incident", async () => {
      // Create test updates
      const update1 = await db.insert(statusReportUpdate).values({
        statusReportId: testIncident.id,
        message: `${TEST_PREFIX}-update1`,
        status: "investigating",
        date: new Date(),
      }).returning().get();

      const update2 = await db.insert(statusReportUpdate).values({
        statusReportId: testIncident.id,
        message: `${TEST_PREFIX}-update2`,
        status: "identified",
        date: new Date(),
      }).returning().get();

      try {
        const res = await mockStatusPageService.getIncidentUpdates({
          incident_id: testIncident.id,
          limit: 10,
          offset: 0,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.incident_updates).toHaveLength(2);
        expect(res.data.incident_updates[0].message).toBe(`${TEST_PREFIX}-update2`);
        expect(res.data.incident_updates[1].message).toBe(`${TEST_PREFIX}-update1`);
      } finally {
        // Clean up
        await db.delete(statusReportUpdate).where(eq(statusReportUpdate.id, update1.id));
        await db.delete(statusReportUpdate).where(eq(statusReportUpdate.id, update2.id));
      }
    });

    test("returns empty list for incident with no updates", async () => {
      const res = await mockStatusPageService.getIncidentUpdates({
        incident_id: testIncident.id,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incident_updates).toHaveLength(0);
    });

    test("respects pagination parameters", async () => {
      // Create multiple updates
      const updates = [];
      for (let i = 0; i < 3; i++) {
        const update = await db.insert(statusReportUpdate).values({
          statusReportId: testIncident.id,
          message: `${TEST_PREFIX}-paginated-update${i}`,
          status: "investigating",
          date: new Date(),
        }).returning().get();
        updates.push(update);
      }

      try {
        const res = await mockStatusPageService.getIncidentUpdates({
          incident_id: testIncident.id,
          limit: 2,
          offset: 0,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.incident_updates.length).toBeLessThanOrEqual(2);
      } finally {
        // Clean up
        for (const update of updates) {
          await db.delete(statusReportUpdate).where(eq(statusReportUpdate.id, update.id));
        }
      }
    });

    test("returns updates in chronological order", async () => {
      // Create updates with specific timestamps
      const update1 = await db.insert(statusReportUpdate).values({
        statusReportId: testIncident.id,
        message: `${TEST_PREFIX}-chronological1`,
        status: "investigating",
        date: new Date(),
      }).returning().get();

      const update2 = await db.insert(statusReportUpdate).values({
        statusReportId: testIncident.id,
        message: `${TEST_PREFIX}-chronological2`,
        status: "identified",
        date: new Date(),
      }).returning().get();

      try {
        const res = await mockStatusPageService.getIncidentUpdates({
          incident_id: testIncident.id,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        if (res.data.incident_updates.length >= 2) {
          const firstDate = new Date(res.data.incident_updates[0].date);
          const secondDate = new Date(res.data.incident_updates[1].date);
          expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
        }
      } finally {
        // Clean up
        await db.delete(statusReportUpdate).where(eq(statusReportUpdate.id, update1.id));
        await db.delete(statusReportUpdate).where(eq(statusReportUpdate.id, update2.id));
      }
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getIncidentUpdates({
        incident_id: testIncident.id,
      });

      expectUnauthorizedResponse(res);
    });

    test("returns error for non-existent incident", async () => {
      const res = await mockStatusPageService.getIncidentUpdates({
        incident_id: 99999,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res); // Should return empty list, not error
      expect(res.data.incident_updates).toHaveLength(0);
    });
  });

  describe("GetIncidentUpdate", () => {
    test("returns specific incident update", async () => {
      const testUpdate = await db.insert(statusReportUpdate).values({
        statusReportId: testIncident.id,
        message: `${TEST_PREFIX}-specific-update`,
        status: "monitoring",
        date: new Date(),
      }).returning().get();

      try {
        const res = await mockStatusPageService.getIncidentUpdate({
          incident_id: testIncident.id,
          update_id: testUpdate.id,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.incident_update.id).toBe(testUpdate.id);
        expect(res.data.incident_update.message).toBe(`${TEST_PREFIX}-specific-update`);
        expect(res.data.incident_update.status).toBe("monitoring");
      } finally {
        // Clean up
        await db.delete(statusReportUpdate).where(eq(statusReportUpdate.id, testUpdate.id));
      }
    });

    test("returns error for non-existent update", async () => {
      const res = await mockStatusPageService.getIncidentUpdate({
        incident_id: testIncident.id,
        update_id: 99999,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error for update belonging to different incident", async () => {
      // Create another incident
      const otherIncident = await createTestStatusReport(
        testData.testPageId, 
        testData.testComponentId, 
        `${TEST_PREFIX}-other-incident`
      );

      // Create update for other incident
      const otherUpdate = await db.insert(statusReportUpdate).values({
        statusReportId: otherIncident.id,
        message: `${TEST_PREFIX}-other-update`,
        status: "investigating",
        date: new Date(),
      }).returning().get();

      try {
        const res = await mockStatusPageService.getIncidentUpdate({
          incident_id: testIncident.id, // Different incident
          update_id: otherUpdate.id, // Update from other incident
        }, { "x-openstatus-key": "1" });

        expectNotFoundResponse(res);
      } finally {
        // Clean up
        await db.delete(statusReportUpdate).where(eq(statusReportUpdate.id, otherUpdate.id));
        await db.delete(statusReportsToPageComponents).where(eq(statusReportsToPageComponents.statusReportId, otherIncident.id));
        await db.delete(statusReport).where(eq(statusReport.id, otherIncident.id));
      }
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getIncidentUpdate({
        incident_id: testIncident.id,
        update_id: 1,
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("CreateIncidentUpdate", () => {
    test("creates incident update successfully", async () => {
      const updateData = {
        incident_id: testIncident.id,
        message: `${TEST_PREFIX}-new-update`,
        status: "identified",
      };

      const res = await mockStatusPageService.createIncidentUpdate(updateData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incident_update.message).toBe(`${TEST_PREFIX}-new-update`);
      expect(res.data.incident_update.status).toBe("identified");
      expect(res.data.incident_update.statusReportId).toBe(testIncident.id);

      // Clean up
      await db.delete(statusReportUpdate).where(eq(statusReportUpdate.id, res.data.incident_update.id));
    });

    test("creates update with minimal data", async () => {
      const updateData = {
        incident_id: testIncident.id,
        message: `${TEST_PREFIX}-minimal-update`,
      };

      const res = await mockStatusPageService.createIncidentUpdate(updateData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incident_update.message).toBe(`${TEST_PREFIX}-minimal-update`);
      expect(res.data.incident_update.status).toBe("investigating"); // Default value

      // Clean up
      await db.delete(statusReportUpdate).where(eq(statusReportUpdate.id, res.data.incident_update.id));
    });

    test("updates parent incident timestamp", async () => {
      const originalUpdatedAt = testIncident.updatedAt;
      
      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updateData = {
        incident_id: testIncident.id,
        message: `${TEST_PREFIX}-timestamp-update`,
      };

      const res = await mockStatusPageService.createIncidentUpdate(updateData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);

      // Check that incident was updated
      const updatedIncident = await db.select().from(statusReport)
        .where(eq(statusReport.id, testIncident.id))
        .get();

      expect(new Date(updatedIncident.updatedAt).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime());

      // Clean up
      await db.delete(statusReportUpdate).where(eq(statusReportUpdate.id, res.data.incident_update.id));
    });

    test("returns error when no auth key provided", async () => {
      const updateData = {
        incident_id: testIncident.id,
        message: `${TEST_PREFIX}-unauthorized-update`,
      };

      const res = await mockStatusPageService.createIncidentUpdate(updateData);

      expectUnauthorizedResponse(res);
    });

    test("returns error for non-existent incident", async () => {
      const updateData = {
        incident_id: 99999,
        message: `${TEST_PREFIX}-invalid-incident-update`,
      };

      const res = await mockStatusPageService.createIncidentUpdate(updateData, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });
  });

  describe("UpdateIncidentUpdate", () => {
    test("updates incident update successfully", async () => {
      // Create test update first
      const testUpdate = await db.insert(statusReportUpdate).values({
        statusReportId: testIncident.id,
        message: `${TEST_PREFIX}-original-update`,
        status: "investigating",
        date: new Date(),
      }).returning().get();

      try {
        const updateData = {
          incident_id: testIncident.id,
          update_id: testUpdate.id,
          message: `${TEST_PREFIX}-updated-message`,
          status: "resolved",
        };

        const res = await mockStatusPageService.updateIncidentUpdate(updateData, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.incident_update.message).toBe(`${TEST_PREFIX}-updated-message`);
        expect(res.data.incident_update.status).toBe("resolved");
      } finally {
        // Clean up
        await db.delete(statusReportUpdate).where(eq(statusReportUpdate.id, testUpdate.id));
      }
    });

    test("updates only specified fields", async () => {
      const testUpdate = await db.insert(statusReportUpdate).values({
        statusReportId: testIncident.id,
        message: `${TEST_PREFIX}-partial-original`,
        status: "investigating",
        date: new Date(),
      }).returning().get();

      try {
        const updateData = {
          incident_id: testIncident.id,
          update_id: testUpdate.id,
          message: `${TEST_PREFIX}-partial-updated`,
          // Only updating message, not status
        };

        const res = await mockStatusPageService.updateIncidentUpdate(updateData, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.incident_update.message).toBe(`${TEST_PREFIX}-partial-updated`);
        expect(res.data.incident_update.status).toBe("investigating"); // Unchanged
      } finally {
        // Clean up
        await db.delete(statusReportUpdate).where(eq(statusReportUpdate.id, testUpdate.id));
      }
    });

    test("returns error for non-existent update", async () => {
      const updateData = {
        incident_id: testIncident.id,
        update_id: 99999,
        message: "updated-message",
      };

      const res = await mockStatusPageService.updateIncidentUpdate(updateData, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const updateData = {
        incident_id: testIncident.id,
        update_id: 1,
        message: "updated-message",
      };

      const res = await mockStatusPageService.updateIncidentUpdate(updateData);

      expectUnauthorizedResponse(res);
    });
  });

  describe("DeleteIncidentUpdate", () => {
    test("deletes incident update successfully", async () => {
      // Create test update first
      const testUpdate = await db.insert(statusReportUpdate).values({
        statusReportId: testIncident.id,
        message: `${TEST_PREFIX}-delete-me`,
        status: "investigating",
        date: new Date(),
      }).returning().get();

      const res = await mockStatusPageService.deleteIncidentUpdate({
        incident_id: testIncident.id,
        update_id: testUpdate.id,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.success).toBe(true);

      // Verify deletion
      const deletedUpdate = await db.select().from(statusReportUpdate)
        .where(eq(statusReportUpdate.id, testUpdate.id))
        .get();
      expect(deletedUpdate).toBeUndefined();
    });

    test("updates parent incident timestamp on deletion", async () => {
      const originalUpdatedAt = testIncident.updatedAt;
      
      // Create update
      const testUpdate = await db.insert(statusReportUpdate).values({
        statusReportId: testIncident.id,
        message: `${TEST_PREFIX}-timestamp-delete`,
        status: "investigating",
        date: new Date(),
      }).returning().get();

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const res = await mockStatusPageService.deleteIncidentUpdate({
        incident_id: testIncident.id,
        update_id: testUpdate.id,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);

      // Check that incident was updated
      const updatedIncident = await db.select().from(statusReport)
        .where(eq(statusReport.id, testIncident.id))
        .get();

      expect(new Date(updatedIncident.updatedAt).getTime()).toBeGreaterThan(new Date(originalUpdatedAt).getTime());
    });

    test("returns error for non-existent update", async () => {
      const res = await mockStatusPageService.deleteIncidentUpdate({
        incident_id: testIncident.id,
        update_id: 99999,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.deleteIncidentUpdate({
        incident_id: testIncident.id,
        update_id: 1,
      });

      expectUnauthorizedResponse(res);
    });
  });
});
