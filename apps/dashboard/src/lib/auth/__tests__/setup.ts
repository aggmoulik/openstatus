import { db } from "@openstatus/db";
import {
  user,
  workspace,
  usersToWorkspaces,
  account,
  session,
  verificationToken,
} from "@openstatus/db/src/schema";

export async function cleanupAuthTables() {
  await db.delete(usersToWorkspaces);
  await db.delete(account);
  await db.delete(session);
  await db.delete(verificationToken);
  await db.delete(user);
}

export async function createTestUser(
  overrides?: Partial<typeof user.$inferInsert>,
) {
  return db
    .insert(user)
    .values({
      email: "test@example.com",
      name: "Test User",
      firstName: "Test",
      lastName: "User",
      ...overrides,
    })
    .returning()
    .get();
}

export async function createTestWorkspace(slug = "test-workspace") {
  return db
    .insert(workspace)
    .values({ slug, name: "Test Workspace" })
    .returning()
    .get();
}

export async function linkUserToWorkspace(
  userId: number,
  workspaceId: number,
  role: "owner" | "member" = "owner",
) {
  return db
    .insert(usersToWorkspaces)
    .values({ userId, workspaceId, role })
    .returning()
    .get();
}
