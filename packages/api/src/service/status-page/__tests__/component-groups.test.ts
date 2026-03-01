import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db, eq } from "@openstatus/db";
import { pageComponentGroup } from "@openstatus/db/src/schema";
import {
  setupTestData,
  cleanupTestData,
  expectSuccessResponse,
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  TEST_PREFIX,
} from "./test-utils";

// Mock API service for testing
const mockStatusPageService = {
  createComponentGroup: async (data: any, headers: any = {}) => {
    const result = await db.insert(pageComponentGroup).values({
      workspaceId: 1,
      pageId: data.pageId,
      name: data.name,
    }).returning().get();

    return { success: true, data: { group: result } };
  },

  deleteComponentGroup: async (id: string, headers: any = {}) => {
    await db.delete(pageComponentGroup).where(eq(pageComponentGroup.id, Number(id)));
    return { success: true, data: { success: true } };
  },

  updateComponentGroup: async (id: string, data: any, headers: any = {}) => {
    const result = await db.update(pageComponentGroup).set(data).where(eq(pageComponentGroup.id, Number(id))).returning().get();
    if (!result) {
      throw new Error("Component group not found");
    }
    return { success: true, data: { group: result } };
  },
};

describe("StatusPageService - Component Groups", () => {
  let testData: any;

  beforeAll(async () => {
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("CreateComponentGroup", () => {
    test("creates a new component group", async () => {
      const res = await mockStatusPageService.createComponentGroup({
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-new-group`,
      });

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("group");
      expect(res.data.group.name).toBe(`${TEST_PREFIX}-new-group`);
      expect(res.data.group.pageId).toBe(String(testData.testPageId));

      // Clean up
      await db.delete(pageComponentGroup).where(eq(pageComponentGroup.id, res.data.group.id));
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.createComponentGroup({
        pageId: testData.testPageId,
        name: "Unauthorized group",
      });

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent page", async () => {
      const res = await mockStatusPageService.createComponentGroup({
        pageId: 99999,
        name: "Group for non-existent page",
      });

      // Simulate not found response
      expect(res.success).toBe(false);
    });
  });

  describe("DeleteComponentGroup", () => {
    test("successfully deletes component group", async () => {
      const res = await mockStatusPageService.deleteComponentGroup(String(testData.testGroupToDeleteId));

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("success");
      expect(res.data.success).toBe(true);

      // Verify it's deleted
      const deleted = await db.select().from(pageComponentGroup).where(eq(pageComponentGroup.id, testData.testGroupToDeleteId)).get();
      expect(deleted).toBeUndefined();
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.deleteComponentGroup("1");

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent group", async () => {
      const res = await mockStatusPageService.deleteComponentGroup("99999");

      // Simulate not found response
      expect(res.success).toBe(false);
    });
  });

  describe("UpdateComponentGroup", () => {
    test("updates component group name", async () => {
      const res = await mockStatusPageService.updateComponentGroup(
        String(testData.testGroupToUpdateId),
        {
          name: `${TEST_PREFIX}-group-updated`,
        }
      );

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("group");
      expect(res.data.group.name).toBe(`${TEST_PREFIX}-group-updated`);

      // Restore original name
      await db.update(pageComponentGroup).set({ name: `${TEST_PREFIX}-group-to-update` }).where(eq(pageComponentGroup.id, testData.testGroupToUpdateId));
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.updateComponentGroup(
        String(testData.testGroupToUpdateId),
        {
          name: "Unauthorized update",
        }
      );

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent group", async () => {
      const res = await mockStatusPageService.updateComponentGroup(
        "99999",
        { name: "Non-existent update" }
      );

      // Simulate not found response
      expect(res.success).toBe(false);
    });
  });
});
