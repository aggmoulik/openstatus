import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db, eq } from "@openstatus/db";
import { page, pageComponentGroup, pageComponent } from "@openstatus/db/src/schema";
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
  createPageAccessGroup: async (data: any, headers: any = {}) => {
    // Create group with components if provided
    let groupId;
    if (data.component_ids && data.component_ids.length > 0) {
      const group = await db.insert(pageComponentGroup).values({
        workspaceId: 1,
        pageId: data.pageId,
        name: data.name,
      }).returning().get();

      // Add components to group
      await Promise.all(
        data.component_ids.map((componentId: string) =>
          db.update(pageComponent)
            .set({ pageComponentGroupId: group.id })
            .where(eq(pageComponent.id, Number(componentId)))
        )
      );
      groupId = group.id;
    } else {
      const group = await db.insert(pageComponentGroup).values({
        workspaceId: 1,
        pageId: data.pageId,
        name: data.name,
      }).returning().get();
      groupId = group.id;
    }

    return { success: true, data: { pageAccessGroup: { id: groupId, ...data } } };
  },

  getPageAccessGroups: async (params: any, headers: any = {}) => {
    const results = await db.select().from(pageComponentGroup)
      .where(eq(pageComponentGroup.pageId, params.pageId))
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .execute();

    return { success: true, data: { pageAccessGroups: results } };
  },

  getPageAccessGroup: async (params: any, headers: any = {}) => {
    const result = await db.select().from(pageComponentGroup)
      .where(eq(pageComponentGroup.id, params.id))
      .get();

    if (!result) {
      throw new Error("Page access group not found");
    }

    return { success: true, data: { pageAccessGroup: result } };
  },

  updatePageAccessGroup: async (params: any, headers: any = {}) => {
    const result = await db.update(pageComponentGroup)
      .set({
        name: params.name,
      })
      .where(eq(pageComponentGroup.id, params.id))
      .returning()
      .get();

    if (!result) {
      throw new Error("Page access group not found");
    }

    return { success: true, data: { pageAccessGroup: result } };
  },

  deletePageAccessGroup: async (params: any, headers: any = {}) => {
    // First remove group from components
    await db.update(pageComponent)
      .set({ pageComponentGroupId: null })
      .where(eq(pageComponent.pageComponentGroupId, params.id));

    // Then delete the group
    await db.delete(pageComponentGroup).where(eq(pageComponentGroup.id, params.id));
    return { success: true, data: { success: true } };
  },
};

describe("StatusPageService - Page Access Groups", () => {
  let testData: any;

  beforeAll(async () => {
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("CreatePageAccessGroup", () => {
    test("creates page access group with components", async () => {
      const groupData = {
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-test-group`,
        component_ids: [testData.testComponentId.toString()],
      };

      const res = await mockStatusPageService.createPageAccessGroup(groupData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.pageAccessGroup.name).toBe(`${TEST_PREFIX}-test-group`);
      expect(res.data.pageAccessGroup.pageId).toBe(testData.testPageId);

      // Clean up
      await db.delete(pageComponentGroup).where(eq(pageComponentGroup.id, res.data.pageAccessGroup.id));
      await db.update(pageComponent)
        .set({ pageComponentGroupId: null })
        .where(eq(pageComponent.id, testData.testComponentId));
    });

    test("creates page access group without components", async () => {
      const groupData = {
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-empty-group`,
      };

      const res = await mockStatusPageService.createPageAccessGroup(groupData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.pageAccessGroup.name).toBe(`${TEST_PREFIX}-empty-group`);

      // Clean up
      await db.delete(pageComponentGroup).where(eq(pageComponentGroup.id, res.data.pageAccessGroup.id));
    });

    test("returns error when no auth key provided", async () => {
      const groupData = {
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-unauthorized-group`,
      };

      const res = await mockStatusPageService.createPageAccessGroup(groupData);

      expectUnauthorizedResponse(res);
    });

    test("returns error for non-existent page", async () => {
      const groupData = {
        pageId: 99999,
        name: `${TEST_PREFIX}-invalid-page-group`,
      };

      const res = await mockStatusPageService.createPageAccessGroup(groupData, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });

    test("returns error when group name is missing", async () => {
      const groupData = {
        pageId: testData.testPageId,
      };

      const res = await mockStatusPageService.createPageAccessGroup(groupData, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });
  });

  describe("GetPageAccessGroups", () => {
    test("returns list of page access groups", async () => {
      // Create test groups
      const group1 = await db.insert(pageComponentGroup).values({
        workspaceId: 1,
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-group1`,
      }).returning().get();

      const group2 = await db.insert(pageComponentGroup).values({
        workspaceId: 1,
        pageId: testData.testPageId,
        name: `${TEST_PREFIX}-group2`,
      }).returning().get();

      try {
        const res = await mockStatusPageService.getPageAccessGroups({
          pageId: testData.testPageId,
          limit: 10,
          offset: 0,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.pageAccessGroups).toHaveLength(2);
        expect(res.data.pageAccessGroups[0].name).toBe(`${TEST_PREFIX}-group1`);
        expect(res.data.pageAccessGroups[1].name).toBe(`${TEST_PREFIX}-group2`);
      } finally {
        // Clean up
        await db.delete(pageComponentGroup).where(eq(pageComponentGroup.id, group1.id));
        await db.delete(pageComponentGroup).where(eq(pageComponentGroup.id, group2.id));
      }
    });

    test("respects pagination parameters", async () => {
      const res = await mockStatusPageService.getPageAccessGroups({
        pageId: testData.testPageId,
        limit: 1,
        offset: 0,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.pageAccessGroups.length).toBeLessThanOrEqual(1);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getPageAccessGroups({
        pageId: testData.testPageId,
      });

      expectUnauthorizedResponse(res);
    });

    test("returns error for non-existent page", async () => {
      const res = await mockStatusPageService.getPageAccessGroups({
        pageId: 99999,
      }, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });
  });

  describe("GetPageAccessGroup", () => {
    test("returns specific page access group", async () => {
      const res = await mockStatusPageService.getPageAccessGroup({
        id: testData.testGroupId,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.pageAccessGroup.id).toBe(testData.testGroupId);
    });

    test("returns error for non-existent group", async () => {
      const res = await mockStatusPageService.getPageAccessGroup({
        id: 99999,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getPageAccessGroup({
        id: testData.testGroupId,
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("UpdatePageAccessGroup", () => {
    test("updates page access group successfully", async () => {
      const res = await mockStatusPageService.updatePageAccessGroup({
        id: testData.testGroupToUpdateId,
        name: `${TEST_PREFIX}-updated-group`,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.pageAccessGroup.name).toBe(`${TEST_PREFIX}-updated-group`);

      // Restore original name
      await db.update(pageComponentGroup)
        .set({ name: `${TEST_PREFIX}-group-to-update` })
        .where(eq(pageComponentGroup.id, testData.testGroupToUpdateId));
    });

    test("returns error for non-existent group", async () => {
      const res = await mockStatusPageService.updatePageAccessGroup({
        id: 99999,
        name: "updated-group",
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.updatePageAccessGroup({
        id: testData.testGroupToUpdateId,
        name: "updated-group",
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("DeletePageAccessGroup", () => {
    test("deletes page access group successfully", async () => {
      const res = await mockStatusPageService.deletePageAccessGroup({
        id: testData.testGroupToDeleteId,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.success).toBe(true);

      // Verify deletion
      const deletedGroup = await db.select().from(pageComponentGroup)
        .where(eq(pageComponentGroup.id, testData.testGroupToDeleteId))
        .get();
      expect(deletedGroup).toBeNull();
    });

    test("returns error for non-existent group", async () => {
      const res = await mockStatusPageService.deletePageAccessGroup({
        id: 99999,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.deletePageAccessGroup({
        id: testData.testGroupToDeleteId,
      });

      expectUnauthorizedResponse(res);
    });
  });
});
