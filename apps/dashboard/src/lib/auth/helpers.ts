import * as randomWordSlugs from "random-word-slugs";

import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";

export async function createWorkspaceForUser(userId: number | string) {
  const numericUserId = typeof userId === "string" ? Number(userId) : userId;

  let slug: string | undefined = undefined;

  while (!slug) {
    slug = randomWordSlugs.generateSlug(2);
    const existing = await db
      .select()
      .from(workspace)
      .where(eq(workspace.slug, slug))
      .get();

    if (existing) {
      console.warn(`slug already exists: '${slug}' - recreating`);
      slug = undefined;
    }
  }

  const newWorkspace = await db
    .insert(workspace)
    .values({ slug, name: "" })
    .returning({ id: workspace.id })
    .get();

  await db
    .insert(usersToWorkspaces)
    .values({
      userId: numericUserId,
      workspaceId: newWorkspace.id,
      role: "owner",
    })
    .returning()
    .get();

  return newWorkspace;
}

export async function createUser(data: {
  email: string;
  name?: string | null;
  image?: string | null;
  firstName?: string;
  lastName?: string;
}) {
  const newUser = await db
    .insert(user)
    .values({
      email: data.email,
      photoUrl: data.image,
      name: data.name,
      firstName: data.firstName,
      lastName: data.lastName,
    })
    .returning()
    .get();

  await createWorkspaceForUser(newUser.id);

  return newUser;
}

export async function getUser(id: string) {
  const _user = await db
    .select()
    .from(user)
    .where(eq(user.id, Number(id)))
    .get();

  return _user || null;
}
