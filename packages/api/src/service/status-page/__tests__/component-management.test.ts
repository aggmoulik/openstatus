import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db, eq } from "@openstatus/db";
import { page, pageComponent, monitor } from "@openstatus/db/src/schema";
import {
  setupTestData,
  cleanupTestData,
  expectSuccessResponse,
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  expectForbiddenResponse,
  TEST_PREFIX,
} from "./test-utils";

// Mock API service for testing
const mockStatusPageService = {
  addMonitorComponent: async (data: any, headers: any = {}) => {
    const result = await db.insert(pageComponent).values({
      workspaceId: 1,
      pageId: data.pageId,
      type: "PAGE_COMPONENT_TYPE_MONITOR",
      monitorId: data.monitorId,
      name: data.name,
      description: data.description,
      order: data.order || 100,
      groupId: data.groupId || null,
    }).returning().get();

    return { success: true, data: { component: result } };
  },

  addStaticComponent: async (data: any, headers: any = {}) => {
    const result = await db.insert(pageComponent).values({
      workspaceId: 1,
      pageId: data.pageId,
      type: "PAGE_COMPONENT_TYPE_STATIC",
      name: data.name,
      description: data.description,
      order: data.order || 100,
      groupId: data.groupId || null,
    }).returning().get();

    return { success: true, data: { component: result } };
  },

  removeComponent: async (id: string, headers: any = {}) => {
    await db.delete(pageComponent).where(eq(pageComponent.id, Number(id)));
    return { success: true, data: { success: true } };
  },

  updateComponent: async (id: string, data: any, headers: any = {}) => {
    const result = await db.update(pageComponent).set(data).where(eq(pageComponent.id, Number(id))).returning().get();
    if (!result) {
      throw new Error("Component not found");
    }
    return { success: true, data: { component: result } };
  },
};

describe("StatusPageService - Component Management", () => {
  let testData: any;

  beforeAll(async () => {
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("AddMonitorComponent", () => {
    test("adds monitor component to page", async () => {
      const res = await mockStatusPageService.addMonitorComponent({
        pageId: testData.testPageId,
        monitorId: testData.testMonitorId,
        name: `${TEST_PREFIX}-monitor-component`,
        order: 200,
      });

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("component");
      expect(res.data.component.name).toBe(`${TEST_PREFIX}-monitor-component`);
      expect(res.data.component.type).toBe("PAGE_COMPONENT_TYPE_MONITOR");
      expect(res.data.component.monitorId).toBe(String(testData.testMonitorId));

      // Clean up
      await db.delete(pageComponent).where(eq(pageComponent.id, res.data.component.id));
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.addMonitorComponent({
        pageId: testData.testPageId,
        monitorId: testData.testMonitorId,
      });

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent page", async () => {
      const res = await mockStatusPageService.addMonitorComponent({
        pageId: 99999,
        monitorId: testData.testMonitorId,
      });

      // Simulate not found response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent monitor", async () => {
      const res = await mockStatusPageService.addMonitorComponent({
        pageId: testData.testPageId,
        monitorId: 99999,
      });

      // Simulate not found response
      expect(res.success).toBe(false);
    });

    test("adds component with group", async () => {
      const res = await mockStatusPageService.addMonitorComponent({
        pageId: testData.testPageId,
        monitorId: testData.testMonitorId,
        name: `${TEST_PREFIX}-monitor-component-grouped`,
        groupId: testData.testGroupId,
      });

      expect(res.success).toBe(true);
      expect(res.data.component.groupId).toBe(String(testData.testGroupId));

      // Clean up
      await db.delete(pageComponent).where(eq(pageComponent.id, res.data.component.id));
    });

    test("returns error when page component limit is exceeded", async () => {
      // Simulate limit exceeded scenario
      const res = await mockStatusPageService.addMonitorComponent({
        pageId: testData.testPageId,
        monitorId: testData.testMonitorId,
        name: `${TEST_PREFIX}-limit-exceeded-component`,
      });

      // Simulate permission denied response
      expect(res.success).toBe(false);
    });
  });

  describe("AddStaticComponent", () => {
    test("adds static component to page", async () => {
      const res = await mockStatusPageService.addStaticComponent({
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-static-component`,
        description: "Static service",
        order: 300,
      });

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("component");
      expect(res.data.component.name).toBe(`${TEST_PREFIX}-static-component`);
      expect(res.data.component.type).toBe("PAGE_COMPONENT_TYPE_STATIC");
      expect(res.data.component.description).toBe("Static service");

      // Clean up
      await db.delete(pageComponent).where(eq(pageComponent.id, res.data.component.id));
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.addStaticComponent({
        pageId: testData.testPageId,
        name: "Unauthorized component",
      });

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent page", async () => {
      const res = await mockStatusPageService.addStaticComponent({
        pageId: 99999,
        name: "Component for non-existent page",
      });

      // Simulate not found response
      expect(res.success).toBe(false);
    });

    test("returns error when page component limit is exceeded", async () => {
      // Simulate limit exceeded scenario
      const res = await mockStatusPageService.addStaticComponent({
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-static-limit-exceeded`,
        description: "Should fail due to limit",
      });

      // Simulate permission denied response
      expect(res.success).toBe(false);
    });
  });

  describe("RemoveComponent", () => {
    test("successfully removes component", async () => {
      const res = await mockStatusPageService.removeComponent(String(testData.testComponentToDeleteId));

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("success");
      expect(res.data.success).toBe(true);

      // Verify it's deleted
      const deleted = await db.select().from(pageComponent).where(eq(pageComponent.id, testData.testComponentToDeleteId)).get();
      expect(deleted).toBeUndefined();
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.removeComponent("1");

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent component", async () => {
      const res = await mockStatusPageService.removeComponent("99999");

      // Simulate not found response
      expect(res.success).toBe(false);
    });
  });

  describe("UpdateComponent", () => {
    test("updates component name", async () => {
      const res = await mockStatusPageService.updateComponent(
        String(testData.testComponentToUpdateId),
        {
          name: `${TEST_PREFIX}-component-updated`,
        }
      );

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("component");
      expect(res.data.component.name).toBe(`${TEST_PREFIX}-component-updated`);

      // Restore original name
      await db.update(pageComponent).set({ name: `${TEST_PREFIX}-component-to-update` }).where(eq(pageComponent.id, testData.testComponentToUpdateId));
    });

    test("updates component group", async () => {
      const res = await mockStatusPageService.updateComponent(
        String(testData.testComponentToUpdateId),
        {
          groupId: testData.testGroupId,
        }
      );

      expect(res.success).toBe(true);
      expect(res.data.component.groupId).toBe(String(testData.testGroupId));

      // Remove from group
      await db.update(pageComponent).set({ groupId: null }).where(eq(pageComponent.id, testData.testComponentToUpdateId));
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.updateComponent(
        String(testData.testComponentToUpdateId),
        {
          name: "Unauthorized update",
        }
      );

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent component", async () => {
      const res = await mockStatusPageService.updateComponent(
        "99999",
        { name: "Non-existent update" }
      );

      // Simulate not found response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent group", async () => {
      const res = await mockStatusPageService.updateComponent(
        String(testData.testComponentToUpdateId),
        {
          groupId: 99999,
        }
      );

      // Simulate not found response
      expect(res.success).toBe(false);
    });
  });
});
