import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db, eq } from "@openstatus/db";
import { page, pageComponentGroup, pageComponent, pageAccessUser } from "@openstatus/db/src/schema";
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
  createPageAccessUser: async (data: any, headers: any = {}) => {
    const result = await db.insert(pageAccessUser).values({
      pageId: data.pageId,
      externalLogin: data.external_login,
      email: data.email,
      pageAccessGroupIds: data.page_access_group_ids || [],
    }).returning().get();

    return { success: true, data: { pageAccessUser: result } };
  },

  getPageAccessUsers: async (params: any, headers: any = {}) => {
    const results = await db.select().from(pageAccessUser)
      .where(eq(pageAccessUser.pageId, params.pageId))
      .limit(params.limit || 50)
      .offset(params.offset || 0)
      .execute();

    return { success: true, data: { pageAccessUsers: results } };
  },

  getPageAccessUser: async (params: any, headers: any = {}) => {
    const result = await db.select().from(pageAccessUser)
      .where(eq(pageAccessUser.id, params.id))
      .get();

    if (!result) {
      throw new Error("Page access user not found");
    }

    return { success: true, data: { pageAccessUser: result } };
  },

  updatePageAccessUser: async (params: any, headers: any = {}) => {
    const result = await db.update(pageAccessUser)
      .set({
        externalLogin: params.external_login,
        email: params.email,
        pageAccessGroupIds: params.page_access_group_ids,
      })
      .where(eq(pageAccessUser.id, params.id))
      .returning()
      .get();

    if (!result) {
      throw new Error("Page access user not found");
    }

    return { success: true, data: { pageAccessUser: result } };
  },

  deletePageAccessUser: async (params: any, headers: any = {}) => {
    await db.delete(pageAccessUser).where(eq(pageAccessUser.id, params.id));
    return { success: true, data: { success: true } };
  },
};

describe("StatusPageService - Page Access Users", () => {
  let testData: any;

  beforeAll(async () => {
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("CreatePageAccessUser", () => {
    test("creates page access user with valid data", async () => {
      const userData = {
        pageId: testData.testPageId,
        external_login: `${TEST_PREFIX}-external-user`,
        email: `${TEST_PREFIX}@example.com`,
        page_access_group_ids: [testData.testGroupId],
      };

      const res = await mockStatusPageService.createPageAccessUser(userData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.pageAccessUser.pageId).toBe(testData.testPageId);
      expect(res.data.pageAccessUser.externalLogin).toBe(`${TEST_PREFIX}-external-user`);
      expect(res.data.pageAccessUser.email).toBe(`${TEST_PREFIX}@example.com`);
      expect(res.data.pageAccessUser.pageAccessGroupIds).toEqual([testData.testGroupId]);

      // Clean up
      await db.delete(pageAccessUser).where(eq(pageAccessUser.id, res.data.pageAccessUser.id));
    });

    test("returns error when no auth key provided", async () => {
      const userData = {
        pageId: testData.testPageId,
        external_login: `${TEST_PREFIX}-external-user`,
        email: `${TEST_PREFIX}@example.com`,
      };

      const res = await mockStatusPageService.createPageAccessUser(userData);

      expectUnauthorizedResponse(res);
    });

    test("returns error for non-existent page", async () => {
      const userData = {
        pageId: 99999,
        external_login: `${TEST_PREFIX}-external-user`,
        email: `${TEST_PREFIX}@example.com`,
      };

      const res = await mockStatusPageService.createPageAccessUser(userData, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });

    test("creates user without groups", async () => {
      const userData = {
        pageId: testData.testPageId,
        external_login: `${TEST_PREFIX}-no-groups-user`,
        email: `${TEST_PREFIX}@example.com`,
      };

      const res = await mockStatusPageService.createPageAccessUser(userData, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.pageAccessUser.pageAccessGroupIds).toEqual([]);

      // Clean up
      await db.delete(pageAccessUser).where(eq(pageAccessUser.id, res.data.pageAccessUser.id));
    });
  });

  describe("GetPageAccessUsers", () => {
    test("returns list of page access users", async () => {
      // Create some test users
      const user1 = await db.insert(pageAccessUser).values({
        pageId: testData.testPageId,
        external_login: `${TEST_PREFIX}-user1`,
        email: `${TEST_PREFIX}1@example.com`,
      }).returning().get();

      const user2 = await db.insert(pageAccessUser).values({
        pageId: testData.testPageId,
        external_login: `${TEST_PREFIX}-user2`,
        email: `${TEST_PREFIX}2@example.com`,
      }).returning().get();

      try {
        const res = await mockStatusPageService.getPageAccessUsers({
          pageId: testData.testPageId,
          limit: 10,
          offset: 0,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.pageAccessUsers).toHaveLength(2);
        expect(res.data.pageAccessUsers[0].externalLogin).toBe(`${TEST_PREFIX}-user1`);
        expect(res.data.pageAccessUsers[1].externalLogin).toBe(`${TEST_PREFIX}-user2`);
      } finally {
        // Clean up
        await db.delete(pageAccessUser).where(eq(pageAccessUser.id, user1.id));
        await db.delete(pageAccessUser).where(eq(pageAccessUser.id, user2.id));
      }
    });

    test("respects pagination parameters", async () => {
      const res = await mockStatusPageService.getPageAccessUsers({
        pageId: testData.testPageId,
        limit: 5,
        offset: 0,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.pageAccessUsers.length).toBeLessThanOrEqual(5);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.getPageAccessUsers({
        pageId: testData.testPageId,
      });

      expectUnauthorizedResponse(res);
    });

    test("returns error for non-existent page", async () => {
      const res = await mockStatusPageService.getPageAccessUsers({
        pageId: 99999,
      }, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });
  });

  describe("GetPageAccessUser", () => {
    test("returns specific page access user", async () => {
      // Create test user
      const testUser = await db.insert(pageAccessUser).values({
        pageId: testData.testPageId,
        external_login: `${TEST_PREFIX}-specific-user`,
        email: `${TEST_PREFIX}-specific@example.com`,
      }).returning().get();

      try {
        const res = await mockStatusPageService.getPageAccessUser({
          id: testUser.id,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.pageAccessUser.id).toBe(testUser.id);
        expect(res.data.pageAccessUser.externalLogin).toBe(`${TEST_PREFIX}-specific-user`);
      } finally {
        // Clean up
        await db.delete(pageAccessUser).where(eq(pageAccessUser.id, testUser.id));
      }
    });

    test("returns error for non-existent user", async () => {
      const res = await mockStatusPageService.getPageAccessUser({
        id: 99999,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });
  });

  describe("UpdatePageAccessUser", () => {
    test("updates page access user successfully", async () => {
      // Create test user
      const testUser = await db.insert(pageAccessUser).values({
        pageId: testData.testPageId,
        external_login: `${TEST_PREFIX}-update-user`,
        email: `${TEST_PREFIX}-update@example.com`,
      }).returning().get();

      try {
        const updateData = {
          external_login: `${TEST_PREFIX}-updated-user`,
          email: `${TEST_PREFIX}-updated@example.com`,
          page_access_group_ids: [testData.testGroupId],
        };

        const res = await mockStatusPageService.updatePageAccessUser({
          id: testUser.id,
          ...updateData,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.pageAccessUser.externalLogin).toBe(`${TEST_PREFIX}-updated-user`);
        expect(res.data.pageAccessUser.email).toBe(`${TEST_PREFIX}-updated@example.com`);
        expect(res.data.pageAccessUser.pageAccessGroupIds).toEqual([testData.testGroupId]);
      } finally {
        // Clean up
        await db.delete(pageAccessUser).where(eq(pageAccessUser.id, testUser.id));
      }
    });

    test("returns error for non-existent user", async () => {
      const res = await mockStatusPageService.updatePageAccessUser({
        id: 99999,
        external_login: "updated-user",
        email: "updated@example.com",
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });
  });

  describe("DeletePageAccessUser", () => {
    test("deletes page access user successfully", async () => {
      // Create test user
      const testUser = await db.insert(pageAccessUser).values({
        pageId: testData.testPageId,
        external_login: `${TEST_PREFIX}-delete-user`,
        email: `${TEST_PREFIX}-delete@example.com`,
      }).returning().get();

      try {
        const res = await mockStatusPageService.deletePageAccessUser({
          id: testUser.id,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data.success).toBe(true);

        // Verify deletion
        const deletedUser = await db.select().from(pageAccessUser)
          .where(eq(pageAccessUser.id, testUser.id))
          .get();
        expect(deletedUser).toBeNull();
      } finally {
        // Clean up if not already deleted
        if (deletedUser) {
          await db.delete(pageAccessUser).where(eq(pageAccessUser.id, testUser.id));
        }
      }
    });

    test("returns error for non-existent user", async () => {
      const res = await mockStatusPageService.deletePageAccessUser({
        id: 99999,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.deletePageAccessUser({
        id: 1,
      });

      expectUnauthorizedResponse(res);
    });
  });
});
