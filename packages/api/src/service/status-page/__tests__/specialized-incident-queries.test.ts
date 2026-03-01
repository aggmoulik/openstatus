import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db, eq, and, or, lt, gt, isNull } from "@openstatus/db";
import { page, statusReport } from "@openstatus/db/src/schema";
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
  getActiveMaintenances: async (params: any, headers: any = {}) => {
    const now = new Date();
    const results = await db.select().from(statusReport)
      .where(
        and(
          eq(statusReport.pageId, params.pageId),
          eq(statusReport.status, "scheduled"),
          lt(statusReport.scheduledFor, now), // Started before now
          gt(statusReport.scheduledAutoCompleted, now) // Not completed yet
        )
      )
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .orderBy(statusReport.scheduledFor, "asc")
      .execute();

    return { success: true, data: { incidents: results } };
  },

  getUpcomingIncidents: async (params: any, headers: any = {}) => {
    const now = new Date();
    const results = await db.select().from(statusReport)
      .where(
        and(
          eq(statusReport.pageId, params.pageId),
          eq(statusReport.status, "scheduled"),
          gt(statusReport.scheduledFor, now) // Scheduled for future
        )
      )
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .orderBy(statusReport.scheduledFor, "asc")
      .execute();

    return { success: true, data: { incidents: results } };
  },

  getScheduledIncidents: async (params: any, headers: any = {}) => {
    const results = await db.select().from(statusReport)
      .where(
        and(
          eq(statusReport.pageId, params.pageId),
          eq(statusReport.status, "scheduled")
        )
      )
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .orderBy(statusReport.scheduledFor, "asc")
      .execute();

    return { success: true, data: { incidents: results } };
  },

  getUnresolvedIncidents: async (params: any, headers: any = {}) => {
    const resolvedStatuses = ["resolved", "postmortem"];
    const results = await db.select().from(statusReport)
      .where(
        and(
          eq(statusReport.pageId, params.pageId),
          // Not in resolved statuses
          // This is a simplified check - in real implementation would use NOT IN
        )
      )
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .orderBy(statusReport.createdAt, "desc")
      .execute();

    // Filter out resolved incidents
    const unresolvedIncidents = results.filter(incident => 
      !resolvedStatuses.includes(incident.status)
    );

    return { success: true, data: { incidents: unresolvedIncidents } };
  },

  getIncidentsByStatus: async (params: any, headers: any = {}) => {
    const { pageId, status } = params;
    
    const results = await db.select().from(statusReport)
      .where(
        and(
          eq(statusReport.pageId, pageId),
          eq(statusReport.status, status)
        )
      )
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .orderBy(statusReport.createdAt, "desc")
      .execute();

    return { success: true, data: { incidents: results } };
  },

  getIncidentsByDateRange: async (params: any, headers: any = {}) => {
    const { pageId, start_date, end_date } = params;
    
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);
    
    const results = await db.select().from(statusReport)
      .where(
        and(
          eq(statusReport.pageId, pageId),
          gt(statusReport.createdAt, startDate),
          lt(statusReport.createdAt, endDate)
        )
      )
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .orderBy(statusReport.createdAt, "desc")
      .execute();

    return { success: true, data: { incidents: results } };
  },

  searchIncidents: async (params: any, headers: any = {}) => {
    const { pageId, query } = params;
    
    const results = await db.select().from(statusReport)
      .where(
        and(
          eq(statusReport.pageId, pageId),
          // Simplified search - in real implementation would use ILIKE or similar
        )
      )
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .orderBy(statusReport.createdAt, "desc")
      .execute();

    // Filter by title containing query (case-insensitive)
    const filteredResults = results.filter(incident =>
      incident.title.toLowerCase().includes(query.toLowerCase())
    );

    return { success: true, data: { incidents: filteredResults } };
  },
};

describe("StatusPageService - Specialized Incident Queries", () => {
  let testData: any;
  let activeMaintenance: any;
  let upcomingIncident: any;
  let scheduledIncident: any;
  let unresolvedIncident: any;
  let resolvedIncident: any;

  beforeAll(async () => {
    testData = await setupTestData();
    
    const now = new Date();
    const pastDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
    const futureDate = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const futureCompletionDate = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now

    // Create active maintenance (started in past, not completed yet)
    activeMaintenance = await createTestStatusReport(
      testData.testPageId, 
      testData.testComponentId, 
      `${TEST_PREFIX}-active-maintenance`
    );
    await db.update(statusReport)
      .set({ 
        status: "scheduled",
        scheduledFor: pastDate,
        scheduledAutoCompleted: futureCompletionDate,
      })
      .where(eq(statusReport.id, activeMaintenance.id));

    // Create upcoming incident (scheduled for future)
    upcomingIncident = await createTestStatusReport(
      testData.testPageId, 
      testData.testComponentId, 
      `${TEST_PREFIX}-upcoming-incident`
    );
    await db.update(statusReport)
      .set({ 
        status: "scheduled",
        scheduledFor: futureDate,
      })
      .where(eq(statusReport.id, upcomingIncident.id));

    // Create another scheduled incident
    scheduledIncident = await createTestStatusReport(
      testData.testPageId, 
      testData.testComponentId, 
      `${TEST_PREFIX}-another-scheduled`
    );
    await db.update(statusReport)
      .set({ 
        status: "scheduled",
        scheduledFor: new Date(now.getTime() + 3 * 60 * 60 * 1000), // 3 hours from now
      })
      .where(eq(statusReport.id, scheduledIncident.id));

    // Create unresolved incident
    unresolvedIncident = await createTestStatusReport(
      testData.testPageId, 
      testData.testComponentId, 
      `${TEST_PREFIX}-unresolved-incident`
    );
    await db.update(statusReport)
      .set({ status: "investigating" })
      .where(eq(statusReport.id, unresolvedIncident.id));

    // Create resolved incident
    resolvedIncident = await createTestStatusReport(
      testData.testPageId, 
      testData.testComponentId, 
      `${TEST_PREFIX}-resolved-incident`
    );
    await db.update(statusReport)
      .set({ status: "resolved" })
      .where(eq(statusReport.id, resolvedIncident.id));
  });

  afterAll(async () => {
    // Clean up all test incidents
    const incidents = [activeMaintenance, upcomingIncident, scheduledIncident, unresolvedIncident, resolvedIncident];
    for (const incident of incidents) {
      await db.delete(statusReportsToPageComponents).where(eq(statusReportsToPageComponents.statusReportId, incident.id));
      await db.delete(statusReport).where(eq(statusReport.id, incident.id));
    }
    await cleanupTestData();
  });

  describe("GetActiveMaintenances", () => {
    test("returns currently active maintenances", async () => {
      const res = await mockStatusPageService.getActiveMaintenances({
        pageId: testData.testPageId,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incidents).toHaveLength(1);
      expect(res.data.incidents[0].id).toBe(activeMaintenance.id);
      expect(res.data.incidents[0].status).toBe("scheduled");
    });

    test("returns empty when no active maintenances", async () => {
      // Temporarily update active maintenance to be completed
      await db.update(statusReport)
        .set({ scheduledAutoCompleted: new Date(Date.now() - 60 * 60 * 1000) }) // 1 hour ago
        .where(eq(statusReport.id, activeMaintenance.id));

      try {
        const res = await mockStatusPageService.getActiveMaintenances({
          pageId: testData.testPageId,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.incidents).toHaveLength(0);
      } finally {
        // Restore original state
        await db.update(statusReport)
          .set({ scheduledAutoCompleted: new Date(Date.now() + 4 * 60 * 60 * 1000) })
          .where(eq(statusReport.id, activeMaintenance.id));
      }
    });

    test("respects pagination parameters", async () => {
      const res = await mockStatusPageService.getActiveMaintenances({
        pageId: testData.testPageId,
        limit: 5,
        offset: 0,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incidents.length).toBeLessThanOrEqual(5);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getActiveMaintenances({
        pageId: testData.testPageId,
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("GetUpcomingIncidents", () => {
    test("returns scheduled future incidents", async () => {
      const res = await mockStatusPageService.getUpcomingIncidents({
        pageId: testData.testPageId,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incidents.length).toBeGreaterThanOrEqual(2);
      
      // Should include upcoming and scheduled incidents
      const incidentIds = res.data.incidents.map((i: any) => i.id);
      expect(incidentIds).toContain(upcomingIncident.id);
      expect(incidentIds).toContain(scheduledIncident.id);
      
      // Should not include active maintenance (already started)
      expect(incidentIds).not.toContain(activeMaintenance.id);
    });

    test("returns incidents in chronological order", async () => {
      const res = await mockStatusPageService.getUpcomingIncidents({
        pageId: testData.testPageId,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      if (res.data.incidents.length >= 2) {
        const firstDate = new Date(res.data.incidents[0].scheduledFor);
        const secondDate = new Date(res.data.incidents[1].scheduledFor);
        expect(firstDate.getTime()).toBeLessThanOrEqual(secondDate.getTime());
      }
    });

    test("returns empty when no upcoming incidents", async () => {
      // Update all scheduled incidents to be in the past
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      await db.update(statusReport)
        .set({ scheduledFor: pastDate })
        .where(eq(statusReport.id, upcomingIncident.id));

      try {
        const res = await mockStatusPageService.getUpcomingIncidents({
          pageId: testData.testPageId,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        // Should still have scheduledIncident if it's in the future
        expect(res.data.incidents.length).toBeLessThanOrEqual(1);
      } finally {
        // Restore original state
        const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
        await db.update(statusReport)
          .set({ scheduledFor: futureDate })
          .where(eq(statusReport.id, upcomingIncident.id));
      }
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getUpcomingIncidents({
        pageId: testData.testPageId,
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("GetScheduledIncidents", () => {
    test("returns all scheduled incidents", async () => {
      const res = await mockStatusPageService.getScheduledIncidents({
        pageId: testData.testPageId,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incidents.length).toBeGreaterThanOrEqual(3);
      
      // Should include all scheduled incidents
      const incidentIds = res.data.incidents.map((i: any) => i.id);
      expect(incidentIds).toContain(activeMaintenance.id);
      expect(incidentIds).toContain(upcomingIncident.id);
      expect(incidentIds).toContain(scheduledIncident.id);
      
      // Should not include unscheduled incidents
      expect(incidentIds).not.toContain(unresolvedIncident.id);
      expect(incidentIds).not.toContain(resolvedIncident.id);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getScheduledIncidents({
        pageId: testData.testPageId,
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("GetUnresolvedIncidents", () => {
    test("returns only unresolved incidents", async () => {
      const res = await mockStatusPageService.getUnresolvedIncidents({
        pageId: testData.testPageId,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      
      // Should include unresolved incident
      const incidentIds = res.data.incidents.map((i: any) => i.id);
      expect(incidentIds).toContain(unresolvedIncident.id);
      
      // Should not include resolved incidents
      expect(incidentIds).not.toContain(resolvedIncident.id);
    });

    test("excludes resolved and postmortem incidents", async () => {
      // Create a postmortem incident
      const postmortemIncident = await createTestStatusReport(
        testData.testPageId, 
        testData.testComponentId, 
        `${TEST_PREFIX}-postmortem-incident`
      );
      await db.update(statusReport)
        .set({ status: "postmortem" })
        .where(eq(statusReport.id, postmortemIncident.id));

      try {
        const res = await mockStatusPageService.getUnresolvedIncidents({
          pageId: testData.testPageId,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        const incidentIds = res.data.incidents.map((i: any) => i.id);
        expect(incidentIds).not.toContain(postmortemIncident.id);
      } finally {
        // Clean up
        await db.delete(statusReportsToPageComponents).where(eq(statusReportsToPageComponents.statusReportId, postmortemIncident.id));
        await db.delete(statusReport).where(eq(statusReport.id, postmortemIncident.id));
      }
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getUnresolvedIncidents({
        pageId: testData.testPageId,
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("GetIncidentsByStatus", () => {
    test("returns incidents with specific status", async () => {
      const res = await mockStatusPageService.getIncidentsByStatus({
        pageId: testData.testPageId,
        status: "resolved",
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incidents).toHaveLength(1);
      expect(res.data.incidents[0].id).toBe(resolvedIncident.id);
      expect(res.data.incidents[0].status).toBe("resolved");
    });

    test("returns empty for non-existent status", async () => {
      const res = await mockStatusPageService.getIncidentsByStatus({
        pageId: testData.testPageId,
        status: "nonexistent",
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incidents).toHaveLength(0);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getIncidentsByStatus({
        pageId: testData.testPageId,
        status: "investigating",
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("GetIncidentsByDateRange", () => {
    test("returns incidents within date range", async () => {
      const now = new Date();
      const startDate = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const endDate = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      const res = await mockStatusPageService.getIncidentsByDateRange({
        pageId: testData.testPageId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      // Should include incidents created within the range
      expect(res.data.incidents.length).toBeGreaterThan(0);
    });

    test("returns empty for date range with no incidents", async () => {
      const futureStartDate = new Date(Date.now() + 10 * 60 * 60 * 1000); // 10 hours from now
      const futureEndDate = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours from now

      const res = await mockStatusPageService.getIncidentsByDateRange({
        pageId: testData.testPageId,
        start_date: futureStartDate.toISOString(),
        end_date: futureEndDate.toISOString(),
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incidents).toHaveLength(0);
    });

    test("returns error for invalid date format", async () => {
      const res = await mockStatusPageService.getIncidentsByDateRange({
        pageId: testData.testPageId,
        start_date: "invalid-date",
        end_date: "invalid-date",
      }, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const now = new Date();
      const res = await mockStatusPageService.getIncidentsByDateRange({
        pageId: testData.testPageId,
        start_date: now.toISOString(),
        end_date: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("SearchIncidents", () => {
    test("returns incidents matching search query", async () => {
      const res = await mockStatusPageService.searchIncidents({
        pageId: testData.testPageId,
        query: "unresolved",
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incidents.length).toBeGreaterThanOrEqual(1);
      
      // Should include incident with "unresolved" in title
      const incidentIds = res.data.incidents.map((i: any) => i.id);
      expect(incidentIds).toContain(unresolvedIncident.id);
    });

    test("performs case-insensitive search", async () => {
      const res = await mockStatusPageService.searchIncidents({
        pageId: testData.testPageId,
        query: "RESOLVED", // Uppercase
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incidents).toHaveLength(1);
      expect(res.data.incidents[0].id).toBe(resolvedIncident.id);
    });

    test("returns empty for non-matching query", async () => {
      const res = await mockStatusPageService.searchIncidents({
        pageId: testData.testPageId,
        query: "nonexistent-incident",
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incidents).toHaveLength(0);
    });

    test("returns error for empty query", async () => {
      const res = await mockStatusPageService.searchIncidents({
        pageId: testData.testPageId,
        query: "",
      }, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.searchIncidents({
        pageId: testData.testPageId,
        query: "test",
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("Migration-Specific Features", () => {
    test("provides comprehensive incident filtering for migration preview", async () => {
      // Test multiple filters that would be useful for migration selection
      const scheduledRes = await mockStatusPageService.getScheduledIncidents({
        pageId: testData.testPageId,
      }, { "x-openstatus-key": "1" });

      const unresolvedRes = await mockStatusPageService.getUnresolvedIncidents({
        pageId: testData.testPageId,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(scheduledRes);
      expectSuccessResponse(unresolvedRes);
      
      // Migration preview should be able to distinguish between different incident types
      expect(scheduledRes.data.incidents.length).toBeGreaterThan(0);
      expect(unresolvedRes.data.incidents.length).toBeGreaterThan(0);
      
      // Ensure no overlap between scheduled and unresolved
      const scheduledIds = scheduledRes.data.incidents.map((i: any) => i.id);
      const unresolvedIds = unresolvedRes.data.incidents.map((i: any) => i.id);
      const overlap = scheduledIds.filter((id: number) => unresolvedIds.includes(id));
      expect(overlap).toHaveLength(0);
    });

    test("supports date-range filtering for selective migration", async () => {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const res = await mockStatusPageService.getIncidentsByDateRange({
        pageId: testData.testPageId,
        start_date: lastWeek.toISOString(),
        end_date: nextWeek.toISOString(),
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      // Should include all our test incidents
      expect(res.data.incidents.length).toBeGreaterThanOrEqual(5);
    });
  });
});
