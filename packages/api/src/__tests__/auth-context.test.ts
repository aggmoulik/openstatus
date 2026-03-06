import { describe, it, expect } from "bun:test";

import { createInnerTRPCContext } from "../trpc";

describe("createInnerTRPCContext", () => {
  it("creates context with null session", () => {
    const ctx = createInnerTRPCContext({
      session: null,
    });

    expect(ctx.session).toBeNull();
    expect(ctx.db).toBeDefined();
  });

  it("creates context with valid session containing user id and email", () => {
    const ctx = createInnerTRPCContext({
      session: {
        user: {
          id: "1",
          email: "user@example.com",
        },
      },
    });

    expect(ctx.session).not.toBeNull();
    expect(ctx.session!.user!.id).toBe("1");
    expect(ctx.session!.user!.email).toBe("user@example.com");
    expect(ctx.db).toBeDefined();
  });

  it("includes workspace and user when provided", () => {
    const ctx = createInnerTRPCContext({
      session: {
        user: {
          id: "1",
          email: "user@example.com",
        },
      },
      // @ts-expect-error: partial workspace for testing
      workspace: {
        id: 1,
        slug: "test-workspace",
        name: "Test Workspace",
        plan: "free",
      },
      // @ts-expect-error: partial user for testing
      user: {
        id: 1,
        email: "user@example.com",
        name: "Test User",
      },
    });

    expect(ctx.workspace).toBeDefined();
    expect(ctx.workspace!.id).toBe(1);
    expect(ctx.workspace!.slug).toBe("test-workspace");
    expect(ctx.user).toBeDefined();
    expect(ctx.user!.id).toBe(1);
    expect(ctx.user!.email).toBe("user@example.com");
    expect(ctx.db).toBeDefined();
  });
});
