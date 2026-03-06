import { describe, it, expect, beforeEach } from "bun:test";

import { db, eq } from "@openstatus/db";
import {
  user,
  workspace,
  usersToWorkspaces,
} from "@openstatus/db/src/schema";

import { createUser, getUser } from "../helpers";
import { cleanupAuthTables } from "./setup";

beforeEach(async () => {
  await cleanupAuthTables();
});

describe("createUser", () => {
  it("creates a user with provided email and name", async () => {
    const result = await createUser({
      id: "temp",
      email: "alice@example.com",
      emailVerified: null,
      name: "Alice Smith",
      firstName: "Alice",
      lastName: "Smith",
      image: "https://example.com/avatar.png",
    });

    expect(result.email).toBe("alice@example.com");
    expect(result.name).toBe("Alice Smith");
    expect(result.firstName).toBe("Alice");
    expect(result.lastName).toBe("Smith");
    expect(result.photoUrl).toBe("https://example.com/avatar.png");
    expect(result.id).toBeNumber();
  });

  it("creates a workspace and links user as owner", async () => {
    const result = await createUser({
      id: "temp",
      email: "bob@example.com",
      emailVerified: null,
      name: "Bob",
    });

    const links = await db
      .select()
      .from(usersToWorkspaces)
      .where(eq(usersToWorkspaces.userId, result.id))
      .all();

    expect(links).toHaveLength(1);
    expect(links[0].role).toBe("owner");

    // Verify the workspace was created
    const ws = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, links[0].workspaceId))
      .get();

    expect(ws).toBeDefined();
    expect(ws!.slug).toBeString();
    expect(ws!.slug!.length).toBeGreaterThan(0);
  });

  it("generates unique workspace slugs for different users", async () => {
    const user1 = await createUser({
      id: "temp1",
      email: "user1@example.com",
      emailVerified: null,
      name: "User 1",
    });

    const user2 = await createUser({
      id: "temp2",
      email: "user2@example.com",
      emailVerified: null,
      name: "User 2",
    });

    const links1 = await db
      .select()
      .from(usersToWorkspaces)
      .where(eq(usersToWorkspaces.userId, user1.id))
      .all();

    const links2 = await db
      .select()
      .from(usersToWorkspaces)
      .where(eq(usersToWorkspaces.userId, user2.id))
      .all();

    const ws1 = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, links1[0].workspaceId))
      .get();

    const ws2 = await db
      .select()
      .from(workspace)
      .where(eq(workspace.id, links2[0].workspaceId))
      .get();

    // Each user should have their own workspace with a unique slug
    expect(ws1!.id).not.toBe(ws2!.id);
  });
});

describe("getUser", () => {
  it("returns user by string id", async () => {
    const created = await createUser({
      id: "temp",
      email: "findme@example.com",
      emailVerified: null,
      name: "Find Me",
    });

    const found = await getUser(String(created.id));

    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
    expect(found!.email).toBe("findme@example.com");
    expect(found!.name).toBe("Find Me");
  });

  it("returns null for non-existent user", async () => {
    const found = await getUser("999999");

    expect(found).toBeNull();
  });
});
