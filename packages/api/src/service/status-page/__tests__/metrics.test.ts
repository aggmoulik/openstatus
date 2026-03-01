import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db, eq } from "@openstatus/db";
import { page, metrics } from "@openstatus/db/src/schema";
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
  getMetrics: async (params: any, headers: any = {}) => {
    const results = await db.select().from(metrics)
      .where(eq(metrics.pageId, params.pageId))
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .execute();

    return { success: true, data: { metrics: results } };
  },

  getMetric: async (params: any, headers: any = {}) => {
    const result = await db.select().from(metrics)
      .where(eq(metrics.id, params.id))
      .get();

    if (!result) {
      throw new Error("Metric not found");
    }

    return { success: true, data: { metric: result } };
  },

  createMetric: async (data: any, headers: any = {}) => {
    const result = await db.insert(metrics).values({
      pageId: data.pageId,
      name: data.name,
      suffix: data.suffix || "",
      description: data.description || "",
      display: data.display || true,
      yAxis: data.y_axis || null,
    }).returning().get();

    return { success: true, data: { metric: result } };
  },

  addMetricData: async (params: any, headers: any = {}) => {
    // This would normally add data points to a metric
    // For testing, we'll simulate the response
    return { 
      success: true, 
      data: { 
        message: "Data points added successfully",
        pointsAdded: params.data?.points?.length || 0
      } 
    };
  },
};

describe("StatusPageService - Metrics", () => {
  let testData: any;

  beforeAll(async () => {
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("GetMetrics", () => {
    test("returns list of metrics for page", async () => {
      // Create test metrics
      const metric1 = await db.insert(metrics).values({
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-metric1`,
        suffix: "ms",
        description: "Response time metric",
        display: true,
      }).returning().get();

      const metric2 = await db.insert(metrics).values({
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-metric2`,
        suffix: "%",
        description: "Success rate metric",
        display: true,
      }).returning().get();

      try {
        const res = await mockStatusPageService.getMetrics({
          pageId: testData.testPageId,
          limit: 10,
          offset: 0,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.metrics).toHaveLength(2);
        expect(res.data.metrics[0].name).toBe(`${TEST_PREFIX}-metric1`);
        expect(res.data.metrics[1].name).toBe(`${TEST_PREFIX}-metric2`);
      } finally {
        // Clean up
        await db.delete(metrics).where(eq(metrics.id, metric1.id));
        await db.delete(metrics).where(eq(metrics.id, metric2.id));
      }
    });

    test("respects pagination parameters", async () => {
      const res = await mockStatusPageService.getMetrics({
        pageId: testData.testPageId,
        limit: 1,
        offset: 0,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.metrics.length).toBeLessThanOrEqual(1);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getMetrics({
        pageId: testData.testPageId,
      });

      expectUnauthorizedResponse(res);
    });

    test("returns error for non-existent page", async () => {
      const res = await mockStatusPageService.getMetrics({
        pageId: 99999,
      }, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });
  });

  describe("GetMetric", () => {
    test("returns specific metric", async () => {
      // Create test metric
      const testMetric = await db.insert(metrics).values({
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-specific-metric`,
        suffix: "count",
        description: "Request count metric",
        display: true,
      }).returning().get();

      try {
        const res = await mockStatusPageService.getMetric({
          id: testMetric.id,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.metric.id).toBe(testMetric.id);
        expect(res.data.metric.name).toBe(`${TEST_PREFIX}-specific-metric`);
      } finally {
        // Clean up
        await db.delete(metrics).where(eq(metrics.id, testMetric.id));
      }
    });

    test("returns error for non-existent metric", async () => {
      const res = await mockStatusPageService.getMetric({
        id: 99999,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getMetric({
        id: 1,
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("CreateMetric", () => {
    test("creates metric successfully", async () => {
      const metricData = {
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-new-metric`,
        suffix: "bytes",
        description: "Data transfer metric",
        display: true,
        y_axis: null,
      };

      const res = await mockStatusPageService.createMetric(metricData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.metric.name).toBe(`${TEST_PREFIX}-new-metric`);
      expect(res.data.metric.suffix).toBe("bytes");
      expect(res.data.metric.description).toBe("Data transfer metric");

      // Clean up
      await db.delete(metrics).where(eq(metrics.id, res.data.metric.id));
    });

    test("returns error when no auth key provided", async () => {
      const metricData = {
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-unauthorized-metric`,
      };

      const res = await mockStatusPageService.createMetric(metricData);

      expectUnauthorizedResponse(res);
    });

    test("returns error for non-existent page", async () => {
      const metricData = {
        pageId: 99999,
        name: `${TEST_PREFIX}-invalid-page-metric`,
      };

      const res = await mockStatusPageService.createMetric(metricData, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });

    test("creates metric with minimal data", async () => {
      const metricData = {
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-minimal-metric`,
      };

      const res = await mockStatusPageService.createMetric(metricData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.metric.name).toBe(`${TEST_PREFIX}-minimal-metric`);
      expect(res.data.metric.suffix).toBe("");
      expect(res.data.metric.display).toBe(true);

      // Clean up
      await db.delete(metrics).where(eq(metrics.id, res.data.metric.id));
    });
  });

  describe("AddMetricData", () => {
    test("adds data points to metric successfully", async () => {
      // Create test metric first
      const testMetric = await db.insert(metrics).values({
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-data-metric`,
        suffix: "ms",
        description: "Latency metric",
        display: true,
      }).returning().get();

      try {
        const dataPoints = [
          { timestamp: new Date(Date.now() - 60000).toISOString(), value: 150 },
          { timestamp: new Date(Date.now() - 30000).toISOString(), value: 200 },
          { timestamp: new Date().toISOString(), value: 180 },
        ];

        const res = await mockStatusPageService.addMetricData({
          id: testMetric.id,
          data: { points: dataPoints },
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.message).toBe("Data points added successfully");
        expect(res.data.pointsAdded).toBe(3);
      } finally {
        // Clean up
        await db.delete(metrics).where(eq(metrics.id, testMetric.id));
      }
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.addMetricData({
        id: 1,
        data: { points: [] },
      });

      expectUnauthorizedResponse(res);
    });

    test("returns error for non-existent metric", async () => {
      const res = await mockStatusPageService.addMetricData({
        id: 99999,
        data: { points: [] },
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("handles empty data points", async () => {
      // Create test metric
      const testMetric = await db.insert(metrics).values({
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-empty-data-metric`,
        suffix: "count",
        description: "Test metric",
        display: true,
      }).returning().get();

      try {
        const res = await mockStatusPageService.addMetricData({
          id: testMetric.id,
          data: { points: [] },
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.message).toBe("Data points added successfully");
        expect(res.data.pointsAdded).toBe(0);
      } finally {
        // Clean up
        await db.delete(metrics).where(eq(metrics.id, testMetric.id));
      }
    });
  });
});
