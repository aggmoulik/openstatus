import { describe, it, expect, beforeEach } from "bun:test";

import { db, eq } from "@openstatus/db";
import { usersToWorkspaces } from "@openstatus/db/src/schema";

import { adapter } from "../adapter";
import { cleanupAuthTables } from "./setup";

beforeEach(async () => {
  await cleanupAuthTables();
});

describe("adapter.createUser", () => {
  it("returns user with string id", async () => {
    const result = await adapter.createUser!({
      id: "temp",
      email: "adapter-test@example.com",
      emailVerified: null,
      name: "Adapter Test",
      firstName: "Adapter",
      lastName: "Test",
      image: "https://example.com/photo.png",
    });

    expect(typeof result.id).toBe("string");
    // The id should be a numeric string (from the DB auto-increment)
    expect(Number(result.id)).toBeGreaterThan(0);
    expect(result.email).toBe("adapter-test@example.com");
  });

  it("creates associated workspace", async () => {
    const result = await adapter.createUser!({
      id: "temp",
      email: "ws-test@example.com",
      emailVerified: null,
      name: "WS Test",
    });

    const links = await db
      .select()
      .from(usersToWorkspaces)
      .where(eq(usersToWorkspaces.userId, Number(result.id)))
      .all();

    expect(links).toHaveLength(1);
    expect(links[0].role).toBe("owner");
  });
});

describe("adapter.getUser", () => {
  it("returns user with string id", async () => {
    const created = await adapter.createUser!({
      id: "temp",
      email: "get-test@example.com",
      emailVerified: null,
      name: "Get Test",
    });

    const found = await adapter.getUser!(created.id);

    expect(found).not.toBeNull();
    expect(typeof found!.id).toBe("string");
    expect(found!.id).toBe(created.id);
    expect(found!.email).toBe("get-test@example.com");
  });

  it("returns null for unknown id", async () => {
    const found = await adapter.getUser!("999999");

    expect(found).toBeNull();
  });
});
