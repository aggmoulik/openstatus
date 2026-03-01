import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db, eq } from "@openstatus/db";
import { page, statusReport, statusReportsToPageComponents, pageSubscriber } from "@openstatus/db/src/schema";
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
  getIncidents: async (params: any, headers: any = {}) => {
    const results = await db.select().from(statusReport)
      .where(eq(statusReport.pageId, params.pageId))
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .orderBy(statusReport.createdAt, "desc")
      .execute();

    return { success: true, data: { incidents: results } };
  },

  getIncident: async (params: any, headers: any = {}) => {
    const result = await db.select().from(statusReport)
      .where(eq(statusReport.id, params.id))
      .get();

    if (!result) {
      throw new Error("Incident not found");
    }

    return { success: true, data: { incident: result } };
  },

  createIncident: async (data: any, headers: any = {}) => {
    const result = await db.insert(statusReport).values({
      workspaceId: 1,
      pageId: data.pageId,
      title: data.title,
      status: data.status || "investigating",
      body: data.body || "",
      impactOverride: data.impact_override || null,
      components: data.components || [],
      scheduledFor: data.scheduled_for || null,
      scheduledRemindPrior: data.scheduled_remind_prior || false,
      scheduledAutoTransition: data.scheduled_auto_transition || false,
      scheduledAutoCompleted: data.scheduled_auto_completed || false,
    }).returning().get();

    // Add component associations if provided
    if (data.components && data.components.length > 0) {
      await Promise.all(
        data.components.map((componentId: string) =>
          db.insert(statusReportsToPageComponents).values({
            statusReportId: result.id,
            pageComponentId: Number(componentId),
          })
        )
      );
    }

    return { success: true, data: { incident: result } };
  },

  updateIncident: async (params: any, headers: any = {}) => {
    const result = await db.update(statusReport)
      .set({
        title: params.title,
        status: params.status,
        body: params.body,
        impactOverride: params.impact_override,
        scheduledFor: params.scheduled_for,
        scheduledRemindPrior: params.scheduled_remind_prior,
        scheduledAutoTransition: params.scheduled_auto_transition,
        scheduledAutoCompleted: params.scheduled_auto_completed,
      })
      .where(eq(statusReport.id, params.id))
      .returning()
      .get();

    if (!result) {
      throw new Error("Incident not found");
    }

    // Update component associations if provided
    if (params.components) {
      // First remove existing associations
      await db.delete(statusReportsToPageComponents)
        .where(eq(statusReportsToPageComponents.statusReportId, params.id));

      // Then add new associations
      if (params.components.length > 0) {
        await Promise.all(
          params.components.map((componentId: string) =>
            db.insert(statusReportsToPageComponents).values({
              statusReportId: params.id,
              pageComponentId: Number(componentId),
            })
          )
        );
      }
    }

    return { success: true, data: { incident: result } };
  },

  getIncidentSubscribers: async (params: any, headers: any = {}) => {
    const results = await db.select().from(pageSubscriber)
      .where(eq(pageSubscriber.pageId, params.pageId))
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .execute();

    return { success: true, data: { subscribers: results } };
  },

  createIncidentSubscriber: async (data: any, headers: any = {}) => {
    const result = await db.insert(pageSubscriber).values({
      pageId: data.pageId,
      email: data.email,
      incidentId: data.incident_id,
      token: `${TEST_PREFIX}-${Date.now()}`,
    }).returning().get();

    return { success: true, data: { subscriber: result } };
  },
};

describe("StatusPageService - Incident Management", () => {
  let testData: any;

  beforeAll(async () => {
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("GetIncidents", () => {
    test("returns list of incidents for page", async () => {
      // Create test incidents
      const incident1 = await createTestStatusReport(testData.testPageId, testData.testComponentId, `${TEST_PREFIX}-incident1`);
      const incident2 = await createTestStatusReport(testData.testPageId, testData.testComponentId, `${TEST_PREFIX}-incident2`);

      try {
        const res = await mockStatusPageService.getIncidents({
          pageId: testData.testPageId,
          limit: 10,
          offset: 0,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.incidents).toHaveLength(2);
        expect(res.data.incidents[0].title).toBe(`${TEST_PREFIX}-incident1`);
        expect(res.data.incidents[1].title).toBe(`${TEST_PREFIX}-incident2`);
      } finally {
        // Clean up
        await db.delete(statusReportsToPageComponents).where(eq(statusReportsToPageComponents.statusReportId, incident1.id));
        await db.delete(statusReportsToPageComponents).where(eq(statusReportsToPageComponents.statusReportId, incident2.id));
        await db.delete(statusReport).where(eq(statusReport.id, incident1.id));
        await db.delete(statusReport).where(eq(statusReport.id, incident2.id));
      }
    });

    test("respects pagination parameters", async () => {
      const res = await mockStatusPageService.getIncidents({
        pageId: testData.testPageId,
        limit: 1,
        offset: 0,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incidents.length).toBeLessThanOrEqual(1);
    });

    test("returns incidents in chronological order", async () => {
      const res = await mockStatusPageService.getIncidents({
        pageId: testData.testPageId,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      if (res.data.incidents.length >= 2) {
        const firstDate = new Date(res.data.incidents[0].createdAt);
        const secondDate = new Date(res.data.incidents[1].createdAt);
        expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
      }
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getIncidents({
        pageId: testData.testPageId,
      });

      expectUnauthorizedResponse(res);
    });

    test("returns error for non-existent page", async () => {
      const res = await mockStatusPageService.getIncidents({
        pageId: 99999,
      }, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });
  });

  describe("GetIncident", () => {
    test("returns specific incident", async () => {
      const testIncident = await createTestStatusReport(testData.testPageId, testData.testComponentId, `${TEST_PREFIX}-specific-incident`);

      try {
        const res = await mockStatusPageService.getIncident({
          id: testIncident.id,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.incident.id).toBe(testIncident.id);
        expect(res.data.incident.title).toBe(`${TEST_PREFIX}-specific-incident`);
      } finally {
        // Clean up
        await db.delete(statusReportsToPageComponents).where(eq(statusReportsToPageComponents.statusReportId, testIncident.id));
        await db.delete(statusReport).where(eq(statusReport.id, testIncident.id));
      }
    });

    test("returns error for non-existent incident", async () => {
      const res = await mockStatusPageService.getIncident({
        id: 99999,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getIncident({
        id: 1,
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("CreateIncident", () => {
    test("creates incident successfully", async () => {
      const incidentData = {
        pageId: testData.testPageId,
        title: `${TEST_PREFIX}-new-incident`,
        status: "investigating",
        body: "Investigating the issue",
        components: [testData.testComponentId.toString()],
      };

      const res = await mockStatusPageService.createIncident(incidentData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incident.title).toBe(`${TEST_PREFIX}-new-incident`);
      expect(res.data.incident.status).toBe("investigating");

      // Clean up
      await db.delete(statusReportsToPageComponents).where(eq(statusReportsToPageComponents.statusReportId, res.data.incident.id));
      await db.delete(statusReport).where(eq(statusReport.id, res.data.incident.id));
    });

    test("creates incident without components", async () => {
      const incidentData = {
        pageId: testData.testPageId,
        title: `${TEST_PREFIX}-no-components-incident`,
        status: "identified",
        body: "Issue identified and being resolved",
      };

      const res = await mockStatusPageService.createIncident(incidentData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incident.title).toBe(`${TEST_PREFIX}-no-components-incident`);
      expect(res.data.incident.status).toBe("identified");

      // Clean up
      await db.delete(statusReport).where(eq(statusReport.id, res.data.incident.id));
    });

    test("creates scheduled incident", async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      const incidentData = {
        pageId: testData.testPageId,
        title: `${TEST_PREFIX}-scheduled-incident`,
        status: "scheduled",
        scheduled_for: futureDate.toISOString(),
        scheduled_remind_prior: true,
        scheduled_auto_transition: true,
      };

      const res = await mockStatusPageService.createIncident(incidentData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.incident.title).toBe(`${TEST_PREFIX}-scheduled-incident`);
      expect(res.data.incident.status).toBe("scheduled");
      expect(res.data.incident.scheduledFor).toBe(futureDate.toISOString());

      // Clean up
      await db.delete(statusReport).where(eq(statusReport.id, res.data.incident.id));
    });

    test("returns error when no auth key provided", async () => {
      const incidentData = {
        pageId: testData.testPageId,
        title: `${TEST_PREFIX}-unauthorized-incident`,
      };

      const res = await mockStatusPageService.createIncident(incidentData);

      expectUnauthorizedResponse(res);
    });

    test("returns error for non-existent page", async () => {
      const incidentData = {
        pageId: 99999,
        title: `${TEST_PREFIX}-invalid-page-incident`,
      };

      const res = await mockStatusPageService.createIncident(incidentData, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });
  });

  describe("UpdateIncident", () => {
    test("updates incident successfully", async () => {
      // Create test incident first
      const testIncident = await createTestStatusReport(testData.testPageId, testData.testComponentId, `${TEST_PREFIX}-update-incident`);

      try {
        const updateData = {
          title: `${TEST_PREFIX}-updated-incident`,
          status: "resolved",
          body: "Issue has been resolved",
        };

        const res = await mockStatusPageService.updateIncident({
          id: testIncident.id,
          ...updateData,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.incident.title).toBe(`${TEST_PREFIX}-updated-incident`);
        expect(res.data.incident.status).toBe("resolved");
      } finally {
        // Clean up
        await db.delete(statusReportsToPageComponents).where(eq(statusReportsToPageComponents.statusReportId, testIncident.id));
        await db.delete(statusReport).where(eq(statusReport.id, testIncident.id));
      }
    });

    test("updates incident components", async () => {
      // Create test incident first
      const testIncident = await createTestStatusReport(testData.testPageId, testData.testComponentId, `${TEST_PREFIX}-components-update-incident`);

      try {
        const updateData = {
          components: [testData.testComponentId.toString(), testData.testComponentId.toString()],
        };

        const res = await mockStatusPageService.updateIncident({
          id: testIncident.id,
          ...updateData,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.incident.components).toEqual([testData.testComponentId.toString(), testData.testComponentId.toString()]);
      } finally {
        // Clean up
        await db.delete(statusReportsToPageComponents).where(eq(statusReportsToPageComponents.statusReportId, testIncident.id));
        await db.delete(statusReport).where(eq(statusReport.id, testIncident.id));
      }
    });

    test("returns error for non-existent incident", async () => {
      const res = await mockStatusPageService.updateIncident({
        id: 99999,
        title: "updated-incident",
        status: "resolved",
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.updateIncident({
        id: 1,
        title: "updated-incident",
        status: "resolved",
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("Incident Subscribers", () => {
    test("gets incident subscribers", async () => {
      // Create test incident subscriber
      const subscriber = await db.insert(pageSubscriber).values({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-incident-sub@example.com`,
        incidentId: testData.testSubscriberId,
        token: `${TEST_PREFIX}-incident-token`,
      }).returning().get();

      try {
        const res = await mockStatusPageService.getIncidentSubscribers({
          pageId: testData.testPageId,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.subscribers).toContainEqual(
          expect.objectContaining({ email: `${TEST_PREFIX}-incident-sub@example.com` })
        );
      } finally {
        // Clean up
        await db.delete(pageSubscriber).where(eq(pageSubscriber.id, subscriber.id));
      }
    });

    test("creates incident subscriber", async () => {
      const subscriberData = {
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-new-incident-sub@example.com`,
        incident_id: testData.testSubscriberId,
      };

      const res = await mockStatusPageService.createIncidentSubscriber(subscriberData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.subscriber.email).toBe(`${TEST_PREFIX}-new-incident-sub@example.com`);
      expect(res.data.subscriber.incidentId).toBe(testData.testSubscriberId);

      // Clean up
      await db.delete(pageSubscriber).where(eq(pageSubscriber.id, res.data.subscriber.id));
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.createIncidentSubscriber({
        pageId: testData.testPageId,
        email: "test@example.com",
        incident_id: 1,
      });

      expectUnauthorizedResponse(res);
    });
  });
});
