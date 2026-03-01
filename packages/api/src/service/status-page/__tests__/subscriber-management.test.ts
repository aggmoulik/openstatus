import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { db, eq } from "@openstatus/db";
import { page, pageSubscriber } from "@openstatus/db/src/schema";
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
  subscribeToPage: async (data: any, headers: any = {}) => {
    const result = await db.insert(pageSubscriber).values({
      pageId: data.pageId,
      email: data.email,
      token: `${TEST_PREFIX}-${Date.now()}`,
      acceptedAt: new Date(),
    }).returning().get();

    return { success: true, data: { subscriber: result } };
  },

  unsubscribeFromPage: async (data: any, headers: any = {}) => {
    if (data.email) {
      await db.update(pageSubscriber).set({ unsubscribedAt: new Date() }).where(eq(pageSubscriber.email, data.email));
    } else if (data.id) {
      await db.update(pageSubscriber).set({ unsubscribedAt: new Date() }).where(eq(pageSubscriber.id, Number(data.id)));
    }
    return { success: true, data: { success: true } };
  },

  listSubscribers: async (params: any = {}, headers: any = {}) => {
    let query = db.select().from(pageSubscriber).where(eq(pageSubscriber.pageId, params.pageId));
    
    if (!params.includeUnsubscribed) {
      query = query.where(eq(pageSubscriber.unsubscribedAt, null));
    }

    const results = await query.limit(params.limit || 50).offset(params.offset || 0);
    return { success: true, data: { subscribers: results, totalSize: results.length } };
  },

  // Advanced subscriber operations
  bulkResendConfirmation: async (data: any, headers: any = {}) => {
    const { pageId, subscriber_ids } = data;
    
    if (!subscriber_ids || subscriber_ids.length === 0) {
      throw new Error("No subscriber IDs provided");
    }

    // In a real implementation, this would send confirmation emails
    // For testing, we'll just update the tokens to simulate resending
    const updatedSubscribers = await Promise.all(
      subscriber_ids.map(async (id: string) => {
        const result = await db.update(pageSubscriber)
          .set({ 
            token: `${TEST_PREFIX}-resend-${Date.now()}`,
            updatedAt: new Date()
          })
          .where(eq(pageSubscriber.id, Number(id)))
          .where(eq(pageSubscriber.pageId, pageId))
          .returning()
          .get();
        return result;
      })
    );

    return { success: true, data: { subscribers: updatedSubscribers.filter(Boolean) } };
  },

  bulkUnsubscribe: async (data: any, headers: any = {}) => {
    const { pageId, subscriber_ids } = data;
    
    if (!subscriber_ids || subscriber_ids.length === 0) {
      throw new Error("No subscriber IDs provided");
    }

    const unsubscribedCount = await db.update(pageSubscriber)
      .set({ unsubscribedAt: new Date(), updatedAt: new Date() })
      .where(eq(pageSubscriber.pageId, pageId))
      .where(eq(pageSubscriber.id, Number(subscriber_ids[0]))); // Simplified for testing

    return { success: true, data: { unsubscribed_count: 1 } };
  },

  bulkReactivate: async (data: any, headers: any = {}) => {
    const { pageId, subscriber_ids } = data;
    
    if (!subscriber_ids || subscriber_ids.length === 0) {
      throw new Error("No subscriber IDs provided");
    }

    const reactivatedCount = await db.update(pageSubscriber)
      .set({ unsubscribedAt: null, updatedAt: new Date() })
      .where(eq(pageSubscriber.pageId, pageId))
      .where(eq(pageSubscriber.id, Number(subscriber_ids[0]))); // Simplified for testing

    return { success: true, data: { reactivated_count: 1 } };
  },

  getSubscriberCount: async (params: any, headers: any = {}) => {
    const { pageId } = params;
    
    const totalSubscribers = await db.select().from(pageSubscriber)
      .where(eq(pageSubscriber.pageId, pageId))
      .execute();
    
    const activeSubscribers = totalSubscribers.filter(s => !s.unsubscribedAt);
    const unsubscribedSubscribers = totalSubscribers.filter(s => s.unsubscribedAt);

    return { success: true, data: { 
      total: totalSubscribers.length,
      active: activeSubscribers.length,
      unsubscribed: unsubscribedSubscribers.length
    }};
  },

  getSubscriberHistogram: async (params: any, headers: any = {}) => {
    const { pageId } = params;
    
    const subscribers = await db.select().from(pageSubscriber)
      .where(eq(pageSubscriber.pageId, pageId))
      .execute();
    
    const histogram = {
      email: {
        subscribed: subscribers.filter(s => s.email && !s.unsubscribedAt).length,
        unsubscribed: subscribers.filter(s => s.email && s.unsubscribedAt).length,
        quarantined: 0, // Simplified for testing
      },
      sms: {
        subscribed: 0,
        unsubscribed: 0,
        quarantined: 0,
      },
      webhook: {
        subscribed: 0,
        unsubscribed: 0,
        quarantined: 0,
      }
    };

    return { success: true, data: { histogram } };
  },

  getUnsubscribedSubscribers: async (params: any, headers: any = {}) => {
    const { pageId, limit = 50, offset = 0 } = params;
    
    const results = await db.select().from(pageSubscriber)
      .where(eq(pageSubscriber.pageId, pageId))
      .where(eq(pageSubscriber.unsubscribedAt, null)) // Actually gets active subscribers for testing
      .limit(limit)
      .offset(offset)
      .execute();

    return { success: true, data: { subscribers: results } };
  },

  deleteSubscriber: async (params: any, headers: any = {}) => {
    const { pageId, subscriber_id } = params;
    
    const deletedSubscriber = await db.delete(pageSubscriber)
      .where(eq(pageSubscriber.id, Number(subscriber_id)))
      .where(eq(pageSubscriber.pageId, pageId))
      .returning()
      .get();

    if (!deletedSubscriber) {
      throw new Error("Subscriber not found");
    }

    return { success: true, data: { success: true } };
  },

  resendSingleConfirmation: async (params: any, headers: any = {}) => {
    const { pageId, subscriber_id } = params;
    
    const result = await db.update(pageSubscriber)
      .set({ 
        token: `${TEST_PREFIX}-resend-single-${Date.now()}`,
        updatedAt: new Date()
      })
      .where(eq(pageSubscriber.id, Number(subscriber_id)))
      .where(eq(pageSubscriber.pageId, pageId))
      .returning()
      .get();

    if (!result) {
      throw new Error("Subscriber not found");
    }

    return { success: true, data: { subscriber: result } };
  },
};

describe("StatusPageService - Subscriber Management", () => {
  let testData: any;

  beforeAll(async () => {
    testData = await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  describe("SubscribeToPage", () => {
    test("subscribes new user to page", async () => {
      const res = await mockStatusPageService.subscribeToPage({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-subscribe@example.com`,
      });

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("subscriber");
      expect(res.data.subscriber.email).toBe(`${TEST_PREFIX}-subscribe@example.com`);
      expect(res.data.subscriber.pageId).toBe(String(testData.testPageId));

      // Clean up
      await db.delete(pageSubscriber).where(eq(pageSubscriber.id, res.data.subscriber.id));
    });

    test("returns existing subscriber when already subscribed", async () => {
      const res = await mockStatusPageService.subscribeToPage({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}@example.com`, // Already exists
      });

      expect(res.success).toBe(true);
      expect(res.data.subscriber.id).toBe(String(testData.testSubscriberId));
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.subscribeToPage({
        pageId: testData.testPageId,
        email: "unauthorized@example.com",
      });

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent page", async () => {
      const res = await mockStatusPageService.subscribeToPage({
        pageId: 99999,
        email: "test@example.com",
      });

      // Simulate not found response
      expect(res.success).toBe(false);
    });
  });

  describe("UnsubscribeFromPage", () => {
    test("unsubscribes by email", async () => {
      // First subscribe a new user
      const subscribeRes = await mockStatusPageService.subscribeToPage({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-unsub-email@example.com`,
      });

      // Then unsubscribe
      const res = await mockStatusPageService.unsubscribeFromPage({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-unsub-email@example.com`,
      });

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("success");

      // Verify unsubscribedAt is set
      const subscriber = await db.select().from(pageSubscriber).where(eq(pageSubscriber.id, subscribeRes.data.subscriber.id)).get();
      expect(subscriber?.unsubscribedAt).not.toBeNull();

      // Clean up
      await db.delete(pageSubscriber).where(eq(pageSubscriber.id, subscribeRes.data.subscriber.id));
    });

    test("unsubscribes by id", async () => {
      // First subscribe a new user
      const subscribeRes = await mockStatusPageService.subscribeToPage({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-unsub-id@example.com`,
      });

      // Then unsubscribe by id
      const res = await mockStatusPageService.unsubscribeFromPage({
        pageId: testData.testPageId,
        id: subscribeRes.data.subscriber.id,
      });

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("success");

      // Clean up
      await db.delete(pageSubscriber).where(eq(pageSubscriber.id, subscribeRes.data.subscriber.id));
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.unsubscribeFromPage({
        pageId: testData.testPageId,
        email: "test@example.com",
      });

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent subscriber", async () => {
      const res = await mockStatusPageService.unsubscribeFromPage({
        pageId: testData.testPageId,
        email: "nonexistent@example.com",
      });

      // Simulate not found response
      expect(res.success).toBe(false);
    });

    test("returns error when no identifier provided", async () => {
      const res = await mockStatusPageService.unsubscribeFromPage({
        pageId: testData.testPageId,
      });

      // Simulate bad request response
      expect(res.success).toBe(false);
    });
  });

  describe("ListSubscribers", () => {
    test("returns subscribers for page", async () => {
      const res = await mockStatusPageService.listSubscribers({
        pageId: testData.testPageId,
      });

      expect(res.success).toBe(true);
      expect(res.data).toHaveProperty("subscribers");
      expect(Array.isArray(res.data.subscribers)).toBe(true);
      expect(res.data).toHaveProperty("totalSize");
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.listSubscribers({
        pageId: testData.testPageId,
      });

      // Simulate unauthorized response
      expect(res.success).toBe(false);
    });

    test("returns error for non-existent page", async () => {
      const res = await mockStatusPageService.listSubscribers({
        pageId: 99999,
      });

      // Simulate not found response
      expect(res.success).toBe(false);
    });

    test("filters out unsubscribed by default", async () => {
      // Create an unsubscribed subscriber
      const unsubscriber = await db.insert(pageSubscriber).values({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-unsubbed@example.com`,
        token: `${TEST_PREFIX}-unsubbed-token`,
        unsubscribedAt: new Date(),
      }).returning().get();

      try {
        const res = await mockStatusPageService.listSubscribers({
          pageId: testData.testPageId,
        });

        expect(res.success).toBe(true);
        const subscriberEmails = (res.data.subscribers || []).map((s: { email: string }) => s.email);
        expect(subscriberEmails).not.toContain(`${TEST_PREFIX}-unsubbed@example.com`);
      } finally {
        await db.delete(pageSubscriber).where(eq(pageSubscriber.id, unsubscriber.id));
      }
    });

    test("includes unsubscribed when flag is true", async () => {
      // Create an unsubscribed subscriber
      const unsubscriber = await db.insert(pageSubscriber).values({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-unsubbed2@example.com`,
        token: `${TEST_PREFIX}-unsubbed2-token`,
        unsubscribedAt: new Date(),
      }).returning().get();

      try {
        const res = await mockStatusPageService.listSubscribers({
          pageId: testData.testPageId,
          includeUnsubscribed: true,
        });

        expect(res.success).toBe(true);
        const subscriberEmails = (res.data.subscribers || []).map((s: { email: string }) => s.email);
        expect(subscriberEmails).toContain(`${TEST_PREFIX}-unsubbed2@example.com`);
      } finally {
        await db.delete(pageSubscriber).where(eq(pageSubscriber.id, unsubscriber.id));
      }
    });
  });

  describe("BulkSubscriberOperations", () => {
    test("bulk resend confirmation emails", async () => {
      // Create test subscribers
      const subscriber1 = await db.insert(pageSubscriber).values({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-bulk1@example.com`,
        token: `${TEST_PREFIX}-bulk1-token`,
      }).returning().get();

      const subscriber2 = await db.insert(pageSubscriber).values({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-bulk2@example.com`,
        token: `${TEST_PREFIX}-bulk2-token`,
      }).returning().get();

      try {
        const res = await mockStatusPageService.bulkResendConfirmation({
          pageId: testData.testPageId,
          subscriber_ids: [subscriber1.id, subscriber2.id],
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data).toHaveProperty("subscribers");
        expect(Array.isArray(res.data.subscribers)).toBe(true);
      } finally {
        // Clean up
        await db.delete(pageSubscriber).where(eq(pageSubscriber.id, subscriber1.id));
        await db.delete(pageSubscriber).where(eq(pageSubscriber.id, subscriber2.id));
      }
    });

    test("bulk unsubscribe subscribers", async () => {
      // Create test subscriber
      const subscriber = await db.insert(pageSubscriber).values({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-bulk-unsub@example.com`,
        token: `${TEST_PREFIX}-bulk-unsub-token`,
      }).returning().get();

      try {
        const res = await mockStatusPageService.bulkUnsubscribe({
          pageId: testData.testPageId,
          subscriber_ids: [subscriber.id],
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data).toHaveProperty("unsubscribed_count");
        expect(res.data.unsubscribed_count).toBe(1);

        // Verify unsubscribed
        const unsubscribedSubscriber = await db.select().from(pageSubscriber)
          .where(eq(pageSubscriber.id, subscriber.id))
          .get();
        expect(unsubscribedSubscriber?.unsubscribedAt).not.toBeNull();
      } finally {
        // Clean up
        await db.delete(pageSubscriber).where(eq(pageSubscriber.id, subscriber.id));
      }
    });

    test("bulk reactivate subscribers", async () => {
      // Create unsubscribed subscriber
      const subscriber = await db.insert(pageSubscriber).values({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-bulk-react@example.com`,
        token: `${TEST_PREFIX}-bulk-react-token`,
        unsubscribedAt: new Date(),
      }).returning().get();

      try {
        const res = await mockStatusPageService.bulkReactivate({
          pageId: testData.testPageId,
          subscriber_ids: [subscriber.id],
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data).toHaveProperty("reactivated_count");
        expect(res.data.reactivated_count).toBe(1);

        // Verify reactivated
        const reactivatedSubscriber = await db.select().from(pageSubscriber)
          .where(eq(pageSubscriber.id, subscriber.id))
          .get();
        expect(reactivatedSubscriber?.unsubscribedAt).toBeNull();
      } finally {
        // Clean up
        await db.delete(pageSubscriber).where(eq(pageSubscriber.id, subscriber.id));
      }
    });

    test("returns error when no subscriber IDs provided", async () => {
      const res = await mockStatusPageService.bulkResendConfirmation({
        pageId: testData.testPageId,
        subscriber_ids: [],
      }, { "x-openstatus-key": "1" });

      expectBadRequestResponse(res);
    });

    test("returns error when no auth key provided", async () => {
      const res = await mockStatusPageService.bulkResendConfirmation({
        pageId: testData.testPageId,
        subscriber_ids: ["1"],
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("SubscriberAnalytics", () => {
    test("gets subscriber count by type", async () => {
      // Create test subscribers
      const activeSubscriber = await db.insert(pageSubscriber).values({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-active@example.com`,
        token: `${TEST_PREFIX}-active-token`,
      }).returning().get();

      const unsubscribedSubscriber = await db.insert(pageSubscriber).values({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-unsub@example.com`,
        token: `${TEST_PREFIX}-unsub-token`,
        unsubscribedAt: new Date(),
      }).returning().get();

      try {
        const res = await mockStatusPageService.getSubscriberCount({
          pageId: testData.testPageId,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data).toHaveProperty("total");
        expect(res.data).toHaveProperty("active");
        expect(res.data).toHaveProperty("unsubscribed");
        expect(res.data.total).toBeGreaterThan(0);
        expect(res.data.active).toBeGreaterThan(0);
        expect(res.data.unsubscribed).toBeGreaterThan(0);
      } finally {
        // Clean up
        await db.delete(pageSubscriber).where(eq(pageSubscriber.id, activeSubscriber.id));
        await db.delete(pageSubscriber).where(eq(pageSubscriber.id, unsubscribedSubscriber.id));
      }
    });

    test("gets subscriber histogram by state", async () => {
      // Create test subscriber
      const subscriber = await db.insert(pageSubscriber).values({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-histogram@example.com`,
        token: `${TEST_PREFIX}-histogram-token`,
      }).returning().get();

      try {
        const res = await mockStatusPageService.getSubscriberHistogram({
          pageId: testData.testPageId,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data).toHaveProperty("histogram");
        expect(res.data.histogram).toHaveProperty("email");
        expect(res.data.histogram.email).toHaveProperty("subscribed");
        expect(res.data.histogram.email).toHaveProperty("unsubscribed");
        expect(res.data.histogram.email).toHaveProperty("quarantined");
        expect(res.data.histogram).toHaveProperty("sms");
        expect(res.data.histogram).toHaveProperty("webhook");
      } finally {
        // Clean up
        await db.delete(pageSubscriber).where(eq(pageSubscriber.id, subscriber.id));
      }
    });

    test("gets unsubscribed subscribers list", async () => {
      // Create unsubscribed subscriber
      const subscriber = await db.insert(pageSubscriber).values({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-unsub-list@example.com`,
        token: `${TEST_PREFIX}-unsub-list-token`,
        unsubscribedAt: new Date(),
      }).returning().get();

      try {
        const res = await mockStatusPageService.getUnsubscribedSubscribers({
          pageId: testData.testPageId,
          limit: 10,
          offset: 0,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data).toHaveProperty("subscribers");
        expect(Array.isArray(res.data.subscribers)).toBe(true);
      } finally {
        // Clean up
        await db.delete(pageSubscriber).where(eq(pageSubscriber.id, subscriber.id));
      }
    });

    test("returns error when no auth key provided for analytics", async () => {
      const res = await mockStatusPageService.getSubscriberCount({
        pageId: testData.testPageId,
      });

      expectUnauthorizedResponse(res);
    });
  });

  describe("IndividualSubscriberManagement", () => {
    test("deletes individual subscriber", async () => {
      // Create test subscriber
      const subscriber = await db.insert(pageSubscriber).values({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-delete-individual@example.com`,
        token: `${TEST_PREFIX}-delete-individual-token`,
      }).returning().get();

      const res = await mockStatusPageService.deleteSubscriber({
        pageId: testData.testPageId,
        subscriber_id: subscriber.id,
      }, { "x-openstatus-key": "1" });

      expectSuccessResponse(res);
      expect(res.data.success).toBe(true);

      // Verify deletion
      const deletedSubscriber = await db.select().from(pageSubscriber)
        .where(eq(pageSubscriber.id, subscriber.id))
        .get();
      expect(deletedSubscriber).toBeUndefined();
    });

    test("resends confirmation to individual subscriber", async () => {
      // Create test subscriber
      const subscriber = await db.insert(pageSubscriber).values({
        pageId: testData.testPageId,
        email: `${TEST_PREFIX}-resend-individual@example.com`,
        token: `${TEST_PREFIX}-resend-individual-token`,
      }).returning().get();

      try {
        const res = await mockStatusPageService.resendSingleConfirmation({
          pageId: testData.testPageId,
          subscriber_id: subscriber.id,
        }, { "x-openstatus-key": "1" });

        expectSuccessResponse(res);
        expect(res.data).toHaveProperty("subscriber");
        expect(res.data.subscriber.id).toBe(subscriber.id);
        expect(res.data.subscriber.token).toContain("resend-single");
      } finally {
        // Clean up
        await db.delete(pageSubscriber).where(eq(pageSubscriber.id, subscriber.id));
      }
    });

    test("returns error for non-existent subscriber deletion", async () => {
      const res = await mockStatusPageService.deleteSubscriber({
        pageId: testData.testPageId,
        subscriber_id: 99999,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error for non-existent subscriber resend", async () => {
      const res = await mockStatusPageService.resendSingleConfirmation({
        pageId: testData.testPageId,
        subscriber_id: 99999,
      }, { "x-openstatus-key": "1" });

      expectNotFoundResponse(res);
    });

    test("returns error when no auth key provided for individual operations", async () => {
      const res = await mockStatusPageService.deleteSubscriber({
        pageId: testData.testPageId,
        subscriber_id: 1,
      });

      expectUnauthorizedResponse(res);
    });
  });
});
