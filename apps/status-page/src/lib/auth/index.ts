import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";

import { db, eq } from "@openstatus/db";
import {
  verificationToken,
  viewer,
  viewerAccounts,
  viewerSession,
} from "@openstatus/db/src/schema";
import { EmailClient } from "@openstatus/emails";

import { getValidCustomDomain } from "@/lib/domain";
import { getQueryClient, trpc } from "@/lib/trpc/server";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user: viewer,
      session: viewerSession,
      account: viewerAccounts,
      verification: verificationToken,
    },
  }),
  secret: process.env.AUTH_SECRET,
  basePath: "/api/auth",
  user: {
    modelName: "viewer",
    fields: {
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
      accountId: "providerAccountId",
      providerId: "provider",
      accessToken: "access_token",
      refreshToken: "refresh_token",
      accessTokenExpiresAt: "expires_at",
      idToken: "id_token",
    },
  },
  advanced: {
    database: {
      generateId: false,
    },
  },
  plugins: [
    nextCookies(),
    magicLink({
      sendMagicLink: async ({ email, url, token }, ctx) => {
        const emailClient = new EmailClient({
          apiKey: process.env.RESEND_API_KEY ?? "",
        });

        // Extract the domain/prefix from the request headers
        const reqHeaders = ctx?.headers;
        if (!reqHeaders) return;

        const host = reqHeaders.get("host");
        if (!host) return;

        const protocol = reqHeaders.get("x-forwarded-proto") || "https";
        const req = new Request(`${protocol}://${host}`, {
          headers: new Headers(reqHeaders),
        });
        const { prefix } = getValidCustomDomain(req);

        if (!prefix) return;

        const queryClient = getQueryClient();
        const query = await queryClient.fetchQuery(
          trpc.statusPage.validateEmailDomain.queryOptions({
            slug: prefix,
            email,
          }),
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
  databaseHooks: {
    user: {
      update: {
        before: async (user) => {
          return {
            data: {
              ...user,
              updatedAt: new Date(),
            },
          };
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
