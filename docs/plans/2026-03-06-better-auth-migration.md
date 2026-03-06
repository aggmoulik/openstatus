# NextAuth → Better-Auth Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from `next-auth@5.0.0-beta.29` to `better-auth` across all apps (`apps/dashboard`, `apps/status-page`, `apps/web`) and `packages/db`, with test coverage written before the migration to ensure behavioral parity.

**Architecture:** The current auth system spans two Next.js apps (dashboard, status-page) sharing a common DB layer via Drizzle ORM + Turso (libSQL). Dashboard uses GitHub + Google + Resend (dev) providers; status-page uses Resend only. Both apps use next-auth's `auth()` wrapper as middleware (`proxy.ts`) and pass `auth` to tRPC context. `apps/web` has `next-auth`, `@auth/core`, and `@auth/drizzle-adapter` as phantom dependencies (no actual auth imports in source). `packages/db` depends on `next-auth` as a devDependency solely for `AdapterAccount`/`AdapterAccountType` type imports in the schema. Better-auth replaces the adapter/provider/callback pattern with a database-first approach using `betterAuth()` server config and `createAuthClient()` client config.

**Tech Stack:** better-auth, Drizzle ORM, libSQL/Turso, Next.js 16, tRPC, Vitest

---

## Phase 1: Write Pre-Migration Tests (Dashboard Auth)

### Task 1: Set Up Auth Test Infrastructure

**Files:**
- Create: `apps/dashboard/src/lib/auth/__tests__/setup.ts`
- Create: `apps/dashboard/src/lib/auth/__tests__/helpers.test.ts`

**Step 1: Create test setup file with DB fixtures**

```typescript
// apps/dashboard/src/lib/auth/__tests__/setup.ts
import { db, eq } from "@openstatus/db";
import { user, workspace, usersToWorkspaces, account, session, verificationToken } from "@openstatus/db/src/schema";

export async function cleanupAuthTables() {
  await db.delete(usersToWorkspaces).run();
  await db.delete(account).run();
  await db.delete(session).run();
  await db.delete(verificationToken).run();
  await db.delete(user).run();
  // Don't delete all workspaces as seed data may be needed
}

export async function createTestUser(overrides?: Partial<typeof user.$inferInsert>) {
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

export async function linkUserToWorkspace(userId: number, workspaceId: number, role: "owner" | "member" = "owner") {
  return db
    .insert(usersToWorkspaces)
    .values({ userId, workspaceId, role })
    .returning()
    .get();
}
```

**Step 2: Write tests for `createUser` helper**

```typescript
// apps/dashboard/src/lib/auth/__tests__/helpers.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { db, eq } from "@openstatus/db";
import { user, workspace, usersToWorkspaces } from "@openstatus/db/src/schema";
import { createUser, getUser } from "../helpers";
import { cleanupAuthTables } from "./setup";

describe("auth helpers", () => {
  beforeEach(async () => {
    await cleanupAuthTables();
  });

  describe("createUser", () => {
    it("creates a user with the provided data", async () => {
      const newUser = await createUser({
        id: "temp",
        email: "new@example.com",
        emailVerified: null,
        name: "New User",
        firstName: "New",
        lastName: "User",
        image: "https://example.com/photo.jpg",
      });

      expect(newUser.email).toBe("new@example.com");
      expect(newUser.name).toBe("New User");
      expect(newUser.id).toBeTypeOf("number");
    });

    it("creates a workspace and links user as owner", async () => {
      const newUser = await createUser({
        id: "temp",
        email: "owner@example.com",
        emailVerified: null,
        name: "Owner",
        image: null,
      });

      const links = await db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.userId, newUser.id))
        .all();

      expect(links).toHaveLength(1);
      expect(links[0].role).toBe("owner");

      const ws = await db
        .select()
        .from(workspace)
        .where(eq(workspace.id, links[0].workspaceId))
        .get();

      expect(ws).toBeDefined();
      expect(ws!.slug).toBeTruthy();
    });

    it("generates unique workspace slugs", async () => {
      const user1 = await createUser({
        id: "temp",
        email: "user1@example.com",
        emailVerified: null,
        name: "User 1",
        image: null,
      });
      const user2 = await createUser({
        id: "temp",
        email: "user2@example.com",
        emailVerified: null,
        name: "User 2",
        image: null,
      });

      const links1 = await db.select().from(usersToWorkspaces).where(eq(usersToWorkspaces.userId, user1.id)).all();
      const links2 = await db.select().from(usersToWorkspaces).where(eq(usersToWorkspaces.userId, user2.id)).all();

      const ws1 = await db.select().from(workspace).where(eq(workspace.id, links1[0].workspaceId)).get();
      const ws2 = await db.select().from(workspace).where(eq(workspace.id, links2[0].workspaceId)).get();

      expect(ws1!.slug).not.toBe(ws2!.slug);
    });
  });

  describe("getUser", () => {
    it("returns user by string id", async () => {
      const created = await createUser({
        id: "temp",
        email: "find@example.com",
        emailVerified: null,
        name: "Find Me",
        image: null,
      });

      const found = await getUser(created.id.toString());
      expect(found).not.toBeNull();
      expect(found!.email).toBe("find@example.com");
    });

    it("returns null for non-existent user", async () => {
      const found = await getUser("999999");
      expect(found).toBeNull();
    });
  });
});
```

**Step 3: Run tests to verify they pass**

Run: `cd apps/dashboard && pnpm vitest run src/lib/auth/__tests__/helpers.test.ts`
Expected: PASS (all tests green)

> **Note:** If vitest is not configured in the dashboard app, check `apps/dashboard/vitest.config.ts` or create one. The project uses vitest elsewhere (see `apps/server` tests). You may need to add vitest to dashboard devDependencies and create a config that resolves `@/` and `@openstatus/*` paths.

**Step 4: Commit**

```bash
git add apps/dashboard/src/lib/auth/__tests__/
git commit -m "test: add auth helper tests for pre-migration validation"
```

---

### Task 2: Test Dashboard Adapter Behavior

**Files:**
- Create: `apps/dashboard/src/lib/auth/__tests__/adapter.test.ts`

**Step 1: Write tests for custom adapter methods**

```typescript
// apps/dashboard/src/lib/auth/__tests__/adapter.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { db, eq } from "@openstatus/db";
import { user, workspace, usersToWorkspaces } from "@openstatus/db/src/schema";
import { adapter } from "../adapter";
import { cleanupAuthTables } from "./setup";

describe("dashboard auth adapter", () => {
  beforeEach(async () => {
    await cleanupAuthTables();
  });

  describe("createUser", () => {
    it("returns user with string id", async () => {
      const result = await adapter.createUser!({
        id: "temp",
        email: "adapter@example.com",
        emailVerified: null,
        name: "Adapter User",
        image: null,
      });

      expect(typeof result.id).toBe("string");
      expect(result.email).toBe("adapter@example.com");
    });

    it("creates associated workspace", async () => {
      const result = await adapter.createUser!({
        id: "temp",
        email: "workspace@example.com",
        emailVerified: null,
        name: "WS User",
        image: null,
      });

      const links = await db
        .select()
        .from(usersToWorkspaces)
        .where(eq(usersToWorkspaces.userId, Number(result.id)))
        .all();

      expect(links).toHaveLength(1);
    });
  });

  describe("getUser", () => {
    it("returns user with string id", async () => {
      const created = await adapter.createUser!({
        id: "temp",
        email: "get@example.com",
        emailVerified: null,
        name: "Get User",
        image: null,
      });

      const found = await adapter.getUser!(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(typeof found!.id).toBe("string");
    });

    it("returns null for unknown id", async () => {
      const found = await adapter.getUser!("999999");
      expect(found).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `cd apps/dashboard && pnpm vitest run src/lib/auth/__tests__/adapter.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add apps/dashboard/src/lib/auth/__tests__/adapter.test.ts
git commit -m "test: add dashboard auth adapter tests"
```

---

### Task 3: Test tRPC Auth Context

**Files:**
- Create: `packages/api/src/__tests__/auth-context.test.ts`

**Step 1: Write tests for tRPC auth context creation and middleware**

```typescript
// packages/api/src/__tests__/auth-context.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { db, eq } from "@openstatus/db";
import { user, workspace, usersToWorkspaces } from "@openstatus/db/src/schema";
import { createInnerTRPCContext } from "../trpc";

describe("tRPC auth context", () => {
  describe("createInnerTRPCContext", () => {
    it("creates context with null session", () => {
      const ctx = createInnerTRPCContext({ session: null });
      expect(ctx.session).toBeNull();
      expect(ctx.db).toBeDefined();
    });

    it("creates context with valid session", () => {
      const ctx = createInnerTRPCContext({
        session: { user: { id: "1", email: "test@example.com" } },
      });
      expect(ctx.session?.user?.id).toBe("1");
      expect(ctx.session?.user?.email).toBe("test@example.com");
    });

    it("includes workspace and user when provided", () => {
      const ctx = createInnerTRPCContext({
        session: { user: { id: "1", email: "test@example.com" } },
        workspace: { id: 1, slug: "test", name: "Test" } as any,
        user: { id: 1, email: "test@example.com" } as any,
      });
      expect(ctx.workspace).toBeDefined();
      expect(ctx.user).toBeDefined();
    });
  });
});
```

**Step 2: Run tests**

Run: `cd packages/api && pnpm vitest run src/__tests__/auth-context.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/api/src/__tests__/auth-context.test.ts
git commit -m "test: add tRPC auth context tests"
```

---

## Phase 2: Install and Configure Better-Auth (Dashboard)

### Task 4: Install better-auth Dependencies

**Files:**
- Modify: `apps/dashboard/package.json`
- Modify: `apps/status-page/package.json`
- Modify: `apps/web/package.json`
- Modify: `packages/db/package.json`

**Step 1: Install better-auth in dashboard**

Run: `cd apps/dashboard && pnpm add better-auth && pnpm remove next-auth @auth/drizzle-adapter @auth/core`

**Step 2: Install better-auth in status-page**

Run: `cd apps/status-page && pnpm add better-auth && pnpm remove next-auth @auth/drizzle-adapter @auth/core`

**Step 3: Remove phantom auth deps from web app**

`apps/web` has `next-auth`, `@auth/core`, and `@auth/drizzle-adapter` in its dependencies but **zero auth imports in source code**. These are unused phantom dependencies that should simply be removed.

Run: `cd apps/web && pnpm remove next-auth @auth/drizzle-adapter @auth/core`

> **Note:** Do NOT install better-auth in apps/web — it has no auth functionality. Only remove the unused deps.

**Step 4: Remove next-auth types from DB package**

`packages/db` lists `next-auth` as a devDependency solely for the `AdapterAccount` and `AdapterAccountType` type imports in `packages/db/src/schema/users/user.ts:8` and `packages/db/src/schema/viewers/viewer.ts:9`. These types are replaced with inline string literal unions in Task 5.

Run: `cd packages/db && pnpm remove next-auth`

**Step 5: Run pnpm install from root**

Run: `cd /home/moulik/open-source/openstatus && pnpm install`
Expected: No errors

**Step 6: Verify apps/web still compiles without auth deps**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: No errors (no source code referenced the removed packages)

**Step 7: Commit**

```bash
git add pnpm-lock.yaml apps/dashboard/package.json apps/status-page/package.json apps/web/package.json packages/db/package.json
git commit -m "chore: swap next-auth for better-auth dependencies"
```

---

### Task 5: Update DB Schema - Remove next-auth Type Dependencies

**Files:**
- Modify: `packages/db/src/schema/users/user.ts:8,80`
- Modify: `packages/db/src/schema/viewers/viewer.ts:9,39`

**Step 1: Remove `AdapterAccount` import from user schema**

In `packages/db/src/schema/users/user.ts`:
- Line 8: Remove `import type { AdapterAccount } from "next-auth/adapters";`
- Line 80: Change `type: text("type").$type<AdapterAccount["type"]>().notNull()` to `type: text("type").$type<"oauth" | "oidc" | "email" | "credentials">().notNull()`

**Step 2: Remove `AdapterAccountType` import from viewer schema**

In `packages/db/src/schema/viewers/viewer.ts`:
- Line 9: Remove `import type { AdapterAccountType } from "next-auth/adapters";`
- Line 39: Change `type: text("type").$type<AdapterAccountType>().notNull()` to `type: text("type").$type<"oauth" | "oidc" | "email" | "credentials">().notNull()`

**Step 3: Verify the schema compiles**

Run: `cd packages/db && pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/db/src/schema/users/user.ts packages/db/src/schema/viewers/viewer.ts
git commit -m "refactor: remove next-auth type imports from DB schema"
```

---

### Task 6: Create Better-Auth Server Config (Dashboard)

**Files:**
- Rewrite: `apps/dashboard/src/lib/auth/index.ts`
- Delete: `apps/dashboard/src/lib/auth/adapter.ts`
- Delete: `apps/dashboard/src/lib/auth/providers.ts`
- Keep: `apps/dashboard/src/lib/auth/helpers.ts` (reuse createUser/getUser)

**Step 1: Rewrite the main auth config**

```typescript
// apps/dashboard/src/lib/auth/index.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { Events, setupAnalytics } from "@openstatus/analytics";
import { db, eq } from "@openstatus/db";
import { user } from "@openstatus/db/src/schema";
import { WelcomeEmail, sendEmail } from "@openstatus/emails";
import { headers } from "next/headers";

import { createUser as createUserWithWorkspace } from "./helpers";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    // Map to existing table/column names to avoid DB migration
    schema: {
      user: {
        modelName: "user",
        fields: {
          name: "name",
          email: "email",
          emailVerified: "emailVerified",
          image: "photo_url",
          createdAt: "created_at",
          updatedAt: "updated_at",
        },
      },
      session: {
        modelName: "session",
        fields: {
          token: "session_token",
          userId: "user_id",
          expiresAt: "expires",
        },
      },
      account: {
        modelName: "account",
        fields: {
          userId: "user_id",
          providerId: "provider",
          accountId: "provider_account_id",
          accessToken: "access_token",
          refreshToken: "refresh_token",
          accessTokenExpiresAt: "expires_at",
          idToken: "id_token",
          scope: "scope",
        },
      },
      verification: {
        modelName: "verification_token",
        fields: {
          identifier: "identifier",
          value: "token",
          expiresAt: "expires",
        },
      },
    },
  }),
  socialProviders: {
    github: {
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    },
    google: {
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      prompt: "select_account",
    },
  },
  secret: process.env.AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  user: {
    additionalFields: {
      firstName: { type: "string", required: false, defaultValue: "" },
      lastName: { type: "string", required: false, defaultValue: "" },
      photoUrl: { type: "string", required: false, defaultValue: "" },
      tenantId: { type: "string", required: false },
    },
  },
  advanced: {
    generateId: false, // Let SQLite auto-increment handle IDs
  },
  databaseHooks: {
    user: {
      create: {
        before: async (userData) => {
          // Create workspace for new users (reuse existing helper logic inline)
          // Note: better-auth will create the user row; we hook after to create workspace
          return userData;
        },
        after: async (newUser) => {
          // Create workspace and link
          const { createUser: _ } = await import("./helpers");
          // The user already exists in DB at this point (created by better-auth)
          // We just need to create the workspace and link
          const { createWorkspaceForUser } = await import("./helpers");
          await createWorkspaceForUser(newUser.id);

          // Send welcome email
          if (newUser.email) {
            await sendEmail({
              from: "Thibault from OpenStatus <thibault@openstatus.dev>",
              subject: "Welcome to OpenStatus.",
              to: [newUser.email],
              react: WelcomeEmail(),
            });
          }

          // Track analytics
          if (newUser.id && newUser.email) {
            const h = await headers();
            const analytics = await setupAnalytics({
              userId: `usr_${newUser.id}`,
              email: newUser.email,
              location: h.get("x-forwarded-for") ?? undefined,
              userAgent: h.get("user-agent") ?? undefined,
            });
            await analytics.track(Events.CreateUser);
          }
        },
      },
    },
    session: {
      create: {
        after: async (sessionData) => {
          // Track sign-in (non-new users)
          // Note: better-auth doesn't differentiate new vs returning in session hooks
          // Consider moving this to an onSignIn hook or social provider callback
        },
      },
    },
  },
  plugins: [nextCookies()],
  pages: {
    signIn: "/login",
  },
});

export type Session = typeof auth.$Infer.Session;
```

> **IMPORTANT NOTE:** The schema mapping above is a starting point. Better-auth's Drizzle adapter schema mapping syntax may differ from what's shown. You MUST consult the latest better-auth docs at `https://www.better-auth.com/docs/adapters/drizzle` for the exact `schema` mapping format. The column names in the existing DB may need a migration if better-auth requires specific columns (like `id` on session table) that don't exist. **Run `npx @better-auth/cli generate` to see what schema better-auth expects and compare with existing tables.**

**Step 2: Update helpers.ts to export workspace creation separately**

```typescript
// apps/dashboard/src/lib/auth/helpers.ts
import * as randomWordSlugs from "random-word-slugs";

import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";

/**
 * Creates a workspace and links it to an existing user.
 * Called after better-auth creates the user row.
 */
export async function createWorkspaceForUser(userId: number | string) {
  const numericUserId = typeof userId === "string" ? Number(userId) : userId;

  let slug: string | undefined = undefined;

  while (!slug) {
    slug = randomWordSlugs.generateSlug(2);
    const slugAlreadyExists = await db
      .select()
      .from(workspace)
      .where(eq(workspace.slug, slug))
      .get();

    if (slugAlreadyExists) {
      console.warn(`slug already exists: '${slug}' - recreating new one`);
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

/**
 * @deprecated - kept for backward compatibility during migration
 */
export async function createUser(data: { email: string; name?: string | null; image?: string | null; firstName?: string; lastName?: string }) {
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
```

**Step 3: Delete old adapter and providers files**

Run:
```bash
rm apps/dashboard/src/lib/auth/adapter.ts
rm apps/dashboard/src/lib/auth/providers.ts
```

**Step 4: Verify TypeScript compiles**

Run: `cd apps/dashboard && pnpm tsc --noEmit`
Expected: Errors — many files still import old next-auth APIs. That's expected; we fix those in subsequent tasks.

**Step 5: Commit**

```bash
git add apps/dashboard/src/lib/auth/
git commit -m "feat: replace next-auth config with better-auth (dashboard)"
```

---

### Task 7: Create Better-Auth Client (Dashboard)

**Files:**
- Create: `apps/dashboard/src/lib/auth/client.ts`

**Step 1: Create the auth client**

```typescript
// apps/dashboard/src/lib/auth/client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
});

export const { signIn, signOut, useSession } = authClient;
```

**Step 2: Commit**

```bash
git add apps/dashboard/src/lib/auth/client.ts
git commit -m "feat: add better-auth client for dashboard"
```

---

### Task 8: Update Dashboard API Route Handler

**Files:**
- Modify: `apps/dashboard/src/app/api/auth/[...nextauth]/route.ts` → rename to `apps/dashboard/src/app/api/auth/[...all]/route.ts`

**Step 1: Rename the catch-all route**

Run: `mv apps/dashboard/src/app/api/auth/\\[...nextauth\\] apps/dashboard/src/app/api/auth/\\[...all\\]`

**Step 2: Update route handler**

```typescript
// apps/dashboard/src/app/api/auth/[...all]/route.ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

**Step 3: Commit**

```bash
git add apps/dashboard/src/app/api/auth/
git commit -m "feat: update auth route handler for better-auth (dashboard)"
```

---

### Task 9: Update Dashboard Root Layout (Remove SessionProvider)

**Files:**
- Modify: `apps/dashboard/src/app/layout.tsx:6,11,80,94,118`

**Step 1: Remove SessionProvider and auth() call**

Changes:
- Remove line 6: `import { auth } from "@/lib/auth";`
- Remove line 11: `import { SessionProvider } from "next-auth/react";`
- Remove line 80: `const session = await auth();`
- Remove line 94: `<SessionProvider session={session}>` (keep children)
- Remove line 118: `</SessionProvider>` (closing tag)

The layout should wrap children directly in `<TRPCReactProvider>` without `SessionProvider`.

**Step 2: Verify the layout compiles**

Run: `cd apps/dashboard && pnpm tsc --noEmit` (may still have other errors)

**Step 3: Commit**

```bash
git add apps/dashboard/src/app/layout.tsx
git commit -m "refactor: remove SessionProvider from dashboard layout"
```

---

### Task 10: Update Dashboard Login Page

**Files:**
- Modify: `apps/dashboard/src/app/login/page.tsx`
- Modify: `apps/dashboard/src/app/login/_components/actions.ts`
- Modify: `apps/dashboard/src/app/login/layout.tsx`

**Step 1: Update login page to use better-auth client-side signIn**

Convert from server actions using `signIn` (next-auth) to a client component using `authClient.signIn.social()`:

```typescript
// apps/dashboard/src/app/login/page.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { signIn } from "@/lib/auth/client";
import { GitHubIcon, GoogleIcon } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Separator } from "@openstatus/ui/components/ui/separator";
import MagicLinkForm from "./_components/magic-link-form";

export default function Page() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo");

  return (
    <div className="my-4 grid w-full max-w-lg gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-semibold text-3xl tracking-tight">Sign In</h1>
        <p className="text-muted-foreground text-sm">
          Get started now. No credit card required.
        </p>
      </div>
      <div className="grid gap-3 p-4">
        {process.env.NODE_ENV === "development" ||
        process.env.NEXT_PUBLIC_SELF_HOST === "true" ? (
          <div className="grid gap-3">
            <MagicLinkForm />
            <Separator />
          </div>
        ) : null}
        <Button
          onClick={() =>
            signIn.social({
              provider: "github",
              callbackURL: redirectTo ?? "/",
            })
          }
          className="w-full"
        >
          Sign in with GitHub <GitHubIcon className="ml-2 h-4 w-4" />
        </Button>
        <Button
          onClick={() =>
            signIn.social({
              provider: "google",
              callbackURL: redirectTo ?? "/",
            })
          }
          className="w-full"
          variant="outline"
        >
          Sign in with Google <GoogleIcon className="ml-2 h-4 w-4" />
        </Button>
      </div>
      <p className="px-8 text-center text-muted-foreground text-sm">
        By clicking continue, you agree to our{" "}
        <Link
          href="https://openstatus.dev/legal/terms"
          className="underline underline-offset-4 hover:text-primary hover:no-underline"
        >
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link
          href="https://openstatus.dev/legal/privacy"
          className="underline underline-offset-4 hover:text-primary hover:no-underline"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
```

> **Note:** `process.env.SELF_HOST` needs to be `NEXT_PUBLIC_SELF_HOST` for client components. Check if this env var needs renaming.

**Step 2: Update login layout to use better-auth session check**

```typescript
// apps/dashboard/src/app/login/layout.tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { AuthLayout } from "@/components/layout/auth-layout";
import { auth } from "@/lib/auth";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (session) redirect("/");

  return <AuthLayout>{children}</AuthLayout>;
}
```

**Step 3: Update magic link action (if keeping dev-only Resend)**

```typescript
// apps/dashboard/src/app/login/_components/actions.ts
"use server";

import { auth } from "@/lib/auth";

export async function signInWithResendAction(formData: FormData) {
  try {
    const email = formData.get("email") as string;
    await auth.api.signInEmail({
      body: { email, callbackURL: "/" },
    });
  } catch (e) {
    console.error(e);
  }
}
```

> **Note:** better-auth's email/magic-link support may require the `magicLink` plugin. Check docs at `https://www.better-auth.com/docs/plugins/magic-link`. If the Resend provider was only for development, consider removing it and using email+password or keeping it via the magic-link plugin.

**Step 4: Commit**

```bash
git add apps/dashboard/src/app/login/
git commit -m "feat: update login page for better-auth (dashboard)"
```

---

### Task 11: Update Dashboard Client Components (signOut)

**Files:**
- Modify: `apps/dashboard/src/components/nav/nav-user.tsx:40,172`
- Modify: `apps/dashboard/src/app/(dashboard)/settings/account/page.tsx:29,123`

**Step 1: Update nav-user.tsx**

Change line 40 from:
```typescript
import { signOut } from "next-auth/react";
```
To:
```typescript
import { signOut } from "@/lib/auth/client";
```

Change line 172 from:
```typescript
onClick={() => signOut()}
```
To:
```typescript
onClick={() => signOut()}
```
(Same API, just different import)

**Step 2: Update account settings page**

Change line 29 from:
```typescript
import { signOut } from "next-auth/react";
```
To:
```typescript
import { signOut } from "@/lib/auth/client";
```

Line 123 stays the same:
```typescript
await signOut({ redirectTo: "/" });
```
> **Note:** Check if better-auth's `signOut` accepts `{ redirectTo }`. It may be `{ callbackURL }` instead. Adjust accordingly.

**Step 3: Commit**

```bash
git add apps/dashboard/src/components/nav/nav-user.tsx apps/dashboard/src/app/(dashboard)/settings/account/page.tsx
git commit -m "refactor: update signOut imports to better-auth client"
```

---

### Task 12: Update Dashboard Middleware (proxy.ts)

**Files:**
- Modify: `apps/dashboard/src/proxy.ts`

This is the most critical file. Currently it uses `auth()` as a middleware wrapper (`export default auth(async (req) => { ... })`) which is a next-auth v5 pattern. Better-auth doesn't have an equivalent wrapper — we need to use standard Next.js middleware with `auth.api.getSession()`.

**Step 1: Rewrite proxy.ts as standard Next.js middleware**

```typescript
// apps/dashboard/src/proxy.ts
import { type NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db, eq } from "@openstatus/db";
import { user, usersToWorkspaces, workspace } from "@openstatus/db/src/schema";
import { getCurrency } from "@openstatus/db/src/schema/plan/utils";

export default async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const response = NextResponse.next();

  const continent = req.headers.get("x-vercel-ip-continent") || "NA";
  const country = req.headers.get("x-vercel-ip-country") || "US";
  const currency = getCurrency({ continent, country });

  response.cookies.set("x-currency", currency);

  if (url.pathname.includes("api/trpc")) {
    return response;
  }

  const session = await auth.api.getSession({
    headers: req.headers,
  });

  if (!session && url.pathname !== "/login") {
    console.log("User not authenticated, redirecting to login");
    const newURL = new URL("/login", req.url);
    const encodedSearchParams = `${url.pathname}${url.search}`;

    if (encodedSearchParams) {
      newURL.searchParams.append("redirectTo", encodedSearchParams);
    }

    return NextResponse.redirect(newURL);
  }

  if (session && url.pathname === "/login") {
    const redirectTo = url.searchParams.get("redirectTo");
    console.log("User authenticated, redirecting to", redirectTo);
    if (redirectTo) {
      const redirectToUrl = new URL(redirectTo, req.url);
      return NextResponse.redirect(redirectToUrl);
    }
  }

  const hasWorkspaceSlug = req.cookies.has("workspace-slug");

  if (session?.user?.id && !hasWorkspaceSlug) {
    const [query] = await db
      .select()
      .from(usersToWorkspaces)
      .innerJoin(user, eq(user.id, usersToWorkspaces.userId))
      .innerJoin(workspace, eq(workspace.id, usersToWorkspaces.workspaceId))
      .where(eq(user.id, Number(session.user.id)))
      .all();

    if (!query) {
      console.error(">> Should not happen, no workspace found for user");
    }

    response.cookies.set("workspace-slug", query.workspace.slug);
  }

  if (!session && hasWorkspaceSlug) {
    response.cookies.delete("workspace-slug");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|assets|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
```

> **IMPORTANT:** The middleware matcher currently excludes `/api` routes, but the auth route is at `/api/auth/[...all]`. Ensure the matcher doesn't block auth API calls. The existing matcher already excludes `api`, so this should be fine.

**Step 2: Verify the middleware compiles**

Run: `cd apps/dashboard && pnpm tsc --noEmit`

**Step 3: Commit**

```bash
git add apps/dashboard/src/proxy.ts
git commit -m "refactor: update dashboard middleware for better-auth session"
```

---

### Task 13: Update tRPC Context to Use Better-Auth Session

**Files:**
- Modify: `packages/api/src/trpc.ts:72-75`
- Modify: `apps/dashboard/src/app/api/trpc/edge/[trpc]/route.ts:4,15`
- Modify: `apps/dashboard/src/app/api/trpc/lambda/[trpc]/route.ts` (similar pattern)

**Step 1: Update tRPC context to accept a session object instead of auth function**

In `packages/api/src/trpc.ts`, the `createTRPCContext` currently accepts `auth?: () => Promise<Session>`. Change it to accept the session directly or a generic getter:

```typescript
// packages/api/src/trpc.ts - update createTRPCContext (lines 69-92)
export const createTRPCContext = async (opts: {
  req: NextRequest;
  serverSideCall?: boolean;
  getSession?: () => Promise<Session>;
}) => {
  const session = opts.getSession ? await opts.getSession() : null;
  const workspace = null;
  const user = null;

  return createInnerTRPCContext({
    session,
    workspace,
    user,
    req: opts.req,
    metadata: {
      userAgent: opts.req.headers.get("user-agent") ?? undefined,
      location:
        opts.req.headers.get("x-forwarded-for") ??
        process.env.VERCEL_REGION ??
        undefined,
    },
  });
};
```

**Step 2: Update dashboard tRPC route handlers**

```typescript
// apps/dashboard/src/app/api/trpc/edge/[trpc]/route.ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

import { auth } from "@/lib/auth";
import { createTRPCContext } from "@openstatus/api";
import { edgeRouter } from "@openstatus/api/src/edge";

export const runtime = "edge";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc/edge",
    router: edgeRouter,
    req: req,
    createContext: () =>
      createTRPCContext({
        req,
        getSession: () => auth.api.getSession({ headers: req.headers }),
      }),
    onError: ({ error }) => {
      console.log("Error in tRPC handler (edge)");
      console.error(error);
    },
  });

export { handler as GET, handler as POST };
```

Do the same for the lambda route handler at `apps/dashboard/src/app/api/trpc/lambda/[trpc]/route.ts`.

**Step 3: Update status-page tRPC route handlers similarly**

Check `apps/status-page/src/app/api/trpc/edge/[trpc]/route.ts` and `apps/status-page/src/app/api/trpc/lambda/[trpc]/route.ts` — update the same `auth` → `getSession` pattern.

**Step 4: Commit**

```bash
git add packages/api/src/trpc.ts apps/dashboard/src/app/api/trpc/ apps/status-page/src/app/api/trpc/
git commit -m "refactor: update tRPC context to use better-auth session getter"
```

---

## Phase 3: Migrate Status Page Auth

### Task 14: Create Better-Auth Config for Status Page

**Files:**
- Rewrite: `apps/status-page/src/lib/auth/index.ts`
- Delete: `apps/status-page/src/lib/auth/adapter.ts`
- Delete: `apps/status-page/src/lib/auth/providers.ts`

The status page uses a separate set of tables (`viewer`, `viewerSession`, `viewerAccounts`) and only has Resend (magic link) auth.

**Step 1: Rewrite status page auth config**

```typescript
// apps/status-page/src/lib/auth/index.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";

import { db, eq } from "@openstatus/db";
import { viewer } from "@openstatus/db/src/schema";

import { getValidCustomDomain } from "@/lib/domain";
import { getQueryClient, trpc } from "@/lib/trpc/server";
import { EmailClient } from "@openstatus/emails";
import { headers } from "next/headers";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: {
        modelName: "viewer",
        fields: {
          name: "name",
          email: "email",
          emailVerified: "emailVerified",
          image: "image",
          createdAt: "created_at",
          updatedAt: "updated_at",
        },
      },
      session: {
        modelName: "viewer_session",
        fields: {
          token: "session_token",
          userId: "user_id",
          expiresAt: "expires",
        },
      },
      account: {
        modelName: "viewer_accounts",
        fields: {
          userId: "user_id",
          providerId: "provider",
          accountId: "providerAccountId",
          accessToken: "access_token",
          refreshToken: "refresh_token",
          accessTokenExpiresAt: "expires_at",
          idToken: "id_token",
          scope: "scope",
        },
      },
      verification: {
        modelName: "verification_token",
        fields: {
          identifier: "identifier",
          value: "token",
          expiresAt: "expires",
        },
      },
    },
  }),
  secret: process.env.AUTH_SECRET,
  basePath: "/api/auth",
  advanced: {
    generateId: false,
  },
  plugins: [
    nextCookies(),
    magicLink({
      sendMagicLink: async ({ email, url, token }, request) => {
        const emailClient = new EmailClient({
          apiKey: process.env.RESEND_API_KEY ?? "",
        });

        const _headers = request ? new Headers(request.headers) : await headers();
        const host = _headers.get("host");
        if (!host) return;

        const protocol = _headers.get("x-forwarded-proto") || "https";
        const req = new Request(`${protocol}://${host}`, {
          headers: new Headers(_headers),
        });
        const { prefix } = getValidCustomDomain(req);
        if (!prefix) return;

        const queryClient = getQueryClient();
        const query = await queryClient.fetchQuery(
          trpc.statusPage.validateEmailDomain.queryOptions({ slug: prefix, email }),
        );
        if (!query) return;

        await emailClient.sendStatusPageMagicLink({
          page: query.page.title,
          link: url,
          to: email,
        });
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
```

> **Note:** The magic link plugin API may differ. Check `https://www.better-auth.com/docs/plugins/magic-link` for the exact `sendMagicLink` callback signature. The email domain validation (signIn callback) needs to be implemented either as a `beforeSignIn` hook or within the magic link plugin's verification step.

**Step 2: Delete old files**

Run:
```bash
rm apps/status-page/src/lib/auth/adapter.ts
rm apps/status-page/src/lib/auth/providers.ts
```

**Step 3: Commit**

```bash
git add apps/status-page/src/lib/auth/
git commit -m "feat: replace next-auth config with better-auth (status-page)"
```

---

### Task 15: Update Status Page Route Handler

**Files:**
- Rename: `apps/status-page/src/app/api/auth/[...nextauth]/route.ts` → `apps/status-page/src/app/api/auth/[...all]/route.ts`

**Step 1: Rename and update**

Run: `mv apps/status-page/src/app/api/auth/\\[...nextauth\\] apps/status-page/src/app/api/auth/\\[...all\\]`

```typescript
// apps/status-page/src/app/api/auth/[...all]/route.ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

**Step 2: Commit**

```bash
git add apps/status-page/src/app/api/auth/
git commit -m "feat: update auth route handler for better-auth (status-page)"
```

---

### Task 16: Update Status Page Middleware (proxy.ts)

**Files:**
- Modify: `apps/status-page/src/proxy.ts`

**Step 1: Replace `auth()` wrapper with standard middleware**

The status page proxy is complex (handles subdomain routing, password protection, email domain auth). Replace `export default auth(async (req) => {` with a standard middleware that calls `auth.api.getSession()`.

Key changes:
- Replace `export default auth(async (req) => {` with `export default async function middleware(req: NextRequest) {`
- Replace all `req.auth` references with a local `session` variable obtained from `auth.api.getSession({ headers: req.headers })`
- Line 122: `req.auth?.user?.email` → `session?.user?.email`

> **Note:** Only fetch session when needed (email-domain protected pages) to avoid unnecessary DB calls on every request.

**Step 2: Commit**

```bash
git add apps/status-page/src/proxy.ts
git commit -m "refactor: update status-page middleware for better-auth"
```

---

### Task 17: Update Status Page Login Actions

**Files:**
- Modify: `apps/status-page/src/app/(status-page)/[domain]/(auth)/login/actions.ts`

**Step 1: Replace next-auth signIn with better-auth magic link**

```typescript
// apps/status-page/src/app/(status-page)/[domain]/(auth)/login/actions.ts
"use server";

import { auth } from "@/lib/auth";
import { getQueryClient, trpc } from "@/lib/trpc/server";
import { TRPCClientError } from "@trpc/client";
import { isRedirectError } from "next/dist/client/components/redirect-error";

export async function signInWithResendAction(formData: FormData) {
  try {
    const email = formData.get("email") as string;
    const redirectTo = formData.get("redirectTo") as string;
    const domain = formData.get("domain") as string;

    if (!email || !redirectTo) {
      return {
        success: false,
        error: "Email and redirectTo are required",
      };
    }

    const queryClient = getQueryClient();
    try {
      await queryClient.fetchQuery(
        trpc.statusPage.validateEmailDomain.queryOptions({
          slug: domain,
          email,
        }),
      );
    } catch (error) {
      console.error("[SignIn] Email validation failed", error);
      if (error instanceof TRPCClientError) {
        return { success: false, error: error.message };
      }
      if (error instanceof Error) {
        return { success: false, error: error.message };
      }
      return {
        success: false,
        error: "An unexpected error occurred during sign in",
      };
    }

    await auth.api.signInMagicLink({
      body: { email, callbackURL: redirectTo },
    });

    return { success: true };
  } catch (e) {
    if (isRedirectError(e)) {
      return { success: true };
    }
    console.error("[SignIn] Error:", e);
    if (e instanceof Error) {
      return { success: false, error: e.message };
    }
    return {
      success: false,
      error: "An unexpected error occurred during sign in",
    };
  }
}
```

> **Note:** The exact method name may be `signInMagicLink` or `sendMagicLink`. Check the better-auth magic-link plugin docs.

**Step 2: Commit**

```bash
git add apps/status-page/src/app/(status-page)/[domain]/(auth)/login/
git commit -m "refactor: update status-page login actions for better-auth"
```

---

### Task 18: Update Status Page Feed Routes

**Files:**
- Modify: `apps/status-page/src/app/(status-page)/[domain]/(public)/feed/[type]/route.ts`
- Modify: `apps/status-page/src/app/(status-page)/[domain]/(public)/feed/json/route.ts`

**Step 1: Update auth imports**

These files import `auth` from `@/lib/auth` and likely call `auth()` to get the session. Change to:

```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

// Where session is needed:
const session = await auth.api.getSession({ headers: await headers() });
```

**Step 2: Commit**

```bash
git add apps/status-page/src/app/(status-page)/[domain]/(public)/feed/
git commit -m "refactor: update feed routes to use better-auth session"
```

---

## Phase 4: Cleanup and Environment

### Task 19: Update Environment Variables

**Files:**
- Modify: `apps/dashboard/.env.example`
- Modify: `apps/status-page/.env.example` (if exists)
- Modify: `.env.docker.example`

**Step 1: Add/update env vars**

Add to env examples:
```
BETTER_AUTH_URL=http://localhost:3002
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3002
```

Keep existing `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` — better-auth can use the same secret.

**Step 2: Commit**

```bash
git add *.env* apps/dashboard/.env* apps/status-page/.env*
git commit -m "chore: update env examples for better-auth"
```

---

### Task 20: Delete next-auth Type Declaration Files

**Files:**
- Delete: `apps/dashboard/src/lib/auth/next-auth.d.ts` (if exists)
- Delete: `apps/status-page/src/lib/auth/next-auth.d.ts` (if exists)

**Step 1: Check and delete type declarations**

Run: `find apps -name "next-auth.d.ts" -type f`

Delete any found files — they augment the `next-auth` module which is no longer used.

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: remove next-auth type declarations"
```

---

## Phase 5: Verify and Run Post-Migration Tests

### Task 21: Run Pre-Migration Tests Against New Code

**Step 1: Run the auth helper tests**

Run: `cd apps/dashboard && pnpm vitest run src/lib/auth/__tests__/`
Expected: Tests should still pass if the helpers module API is preserved.

**Step 2: Run the tRPC context tests**

Run: `cd packages/api && pnpm vitest run src/__tests__/auth-context.test.ts`
Expected: PASS

**Step 3: Fix any failing tests**

If tests fail, adjust the test imports or the source code to maintain behavioral parity.

**Step 4: Commit**

```bash
git add -A
git commit -m "test: verify pre-migration tests pass with better-auth"
```

---

### Task 22: Full TypeScript Compilation Check

**Step 1: Run tsc across the monorepo**

Run: `pnpm turbo run tsc`
Expected: No TypeScript errors

**Step 2: Verify apps/web compiles cleanly**

`apps/web` had phantom `next-auth`/`@auth/*` deps removed in Task 4. It has zero auth source imports, so it should compile without issues. If it fails, it means there's an indirect dependency through `@openstatus/db` schema types — check that Task 5's inline type replacements work.

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: No errors

**Step 3: Fix any remaining type errors**

Common issues:
- `auth()` calls that need to become `auth.api.getSession({ headers: await headers() })`
- `signIn`/`signOut` imports that still reference `next-auth/react`
- `AuthError` imports that need to be removed or replaced
- `packages/db` schema files still importing from `next-auth/adapters` (should be caught in Task 5)

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve remaining TypeScript errors from auth migration"
```

---

### Task 23: DB Schema Compatibility Check

**Step 1: Generate better-auth's expected schema**

Run: `cd apps/dashboard && npx @better-auth/cli generate --output ./better-auth-schema.ts`

**Step 2: Compare with existing schema**

Review the generated schema against `packages/db/src/schema/users/user.ts`. Key differences to check:
- Does better-auth require an `id` column on the `session` table? (Current schema uses `sessionToken` as PK)
- Does better-auth require different column names on `account`?
- Does better-auth need `createdAt`/`updatedAt` on `session` or `account`?

**Step 3: Create a Drizzle migration if needed**

If schema changes are required:
```bash
cd packages/db
pnpm drizzle-kit generate
pnpm migrate
```

**Step 4: Clean up generated file**

Run: `rm apps/dashboard/better-auth-schema.ts`

**Step 5: Commit**

```bash
git add packages/db/
git commit -m "chore: add DB migration for better-auth schema compatibility"
```

---

### Task 24: Manual Smoke Test

**Step 1: Start the dev environment**

Run: `turso dev` (in separate terminal)
Run: `cd packages/db && pnpm migrate && pnpm seed`
Run: `pnpm dev:dashboard`

**Step 2: Test auth flows**

- [ ] Visit `/login` — page renders with GitHub/Google buttons
- [ ] Click "Sign in with GitHub" — redirects to GitHub OAuth
- [ ] After GitHub callback — redirected to dashboard, session exists
- [ ] Visit `/settings/account` — user info displayed
- [ ] Click "Log out" — session cleared, redirected to `/login`
- [ ] Unauthenticated visit to `/` — redirected to `/login`

**Step 3: Test status page auth (if applicable)**

Run: `pnpm dev:status-page`
- [ ] Visit a protected status page — redirected to login
- [ ] Submit magic link email — email sent (check console in dev)

---

### Task 25: Run Full Test Suite

**Step 1: Run all tests**

Run: `pnpm test`
Expected: All tests pass

**Step 2: Fix any failures**

Address any test failures related to auth changes.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete migration from next-auth to better-auth"
```

---

## Summary of Files Changed

### Dashboard App (`apps/dashboard/`)
| File | Action |
|------|--------|
| `src/lib/auth/index.ts` | Rewrite (betterAuth config) |
| `src/lib/auth/adapter.ts` | Delete |
| `src/lib/auth/providers.ts` | Delete |
| `src/lib/auth/helpers.ts` | Modify (add createWorkspaceForUser) |
| `src/lib/auth/client.ts` | Create (authClient) |
| `src/lib/auth/__tests__/setup.ts` | Create (test fixtures) |
| `src/lib/auth/__tests__/helpers.test.ts` | Create (pre-migration tests) |
| `src/lib/auth/__tests__/adapter.test.ts` | Create (pre-migration tests) |
| `src/app/api/auth/[...all]/route.ts` | Rename + rewrite |
| `src/app/layout.tsx` | Modify (remove SessionProvider) |
| `src/app/login/page.tsx` | Rewrite (client component) |
| `src/app/login/layout.tsx` | Modify (better-auth session) |
| `src/app/login/_components/actions.ts` | Modify |
| `src/proxy.ts` | Rewrite (standard middleware) |
| `src/components/nav/nav-user.tsx` | Modify (import change) |
| `src/app/(dashboard)/settings/account/page.tsx` | Modify (import change) |
| `src/app/api/trpc/edge/[trpc]/route.ts` | Modify (session getter) |
| `src/app/api/trpc/lambda/[trpc]/route.ts` | Modify (session getter) |
| `package.json` | Modify (deps) |

### Status Page App (`apps/status-page/`)
| File | Action |
|------|--------|
| `src/lib/auth/index.ts` | Rewrite |
| `src/lib/auth/adapter.ts` | Delete |
| `src/lib/auth/providers.ts` | Delete |
| `src/app/api/auth/[...all]/route.ts` | Rename + rewrite |
| `src/proxy.ts` | Rewrite |
| `src/app/(status-page)/[domain]/(auth)/login/actions.ts` | Modify |
| `src/app/(status-page)/[domain]/(public)/feed/*/route.ts` | Modify |
| `src/app/api/trpc/*/route.ts` | Modify |
| `package.json` | Modify (deps) |

### Web App (`apps/web/`)
| File | Action |
|------|--------|
| `package.json` | Modify (remove phantom deps: `next-auth`, `@auth/core`, `@auth/drizzle-adapter`) |

> **Note:** `apps/web` has **zero auth imports in source code**. The `next-auth`, `@auth/core`, and `@auth/drizzle-adapter` packages listed in its `package.json` are unused phantom dependencies. No source files need modification — only `package.json` cleanup.

### Packages (`packages/db/`)
| File | Action |
|------|--------|
| `package.json` | Modify (remove `next-auth` devDependency) |
| `src/schema/users/user.ts` | Modify (remove `AdapterAccount` type import from `next-auth/adapters`, replace with inline `"oauth" \| "oidc" \| "email" \| "credentials"` union) |
| `src/schema/viewers/viewer.ts` | Modify (remove `AdapterAccountType` type import from `next-auth/adapters`, replace with inline union) |

### Packages (`packages/api/`)
| File | Action |
|------|--------|
| `packages/api/src/trpc.ts` | Modify (auth → getSession) |
| `packages/api/src/__tests__/auth-context.test.ts` | Create |

### Root
| File | Action |
|------|--------|
| `.env.docker.example` | Modify |
| `pnpm-lock.yaml` | Auto-updated |
