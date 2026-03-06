import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { Events, setupAnalytics } from "@openstatus/analytics";
import { db } from "@openstatus/db";
import {
  account,
  session,
  user,
  verificationToken,
} from "@openstatus/db/src/schema";
import { WelcomeEmail, sendEmail } from "@openstatus/emails";
import { headers } from "next/headers";

import { createWorkspaceForUser } from "./helpers";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
    schema: {
      user,
      session,
      account,
      verification: verificationToken,
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
    },
  },
  secret: process.env.AUTH_SECRET,
  basePath: "/api/auth",
  user: {
    modelName: "user",
    fields: {
      image: "photo_url",
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
    additionalFields: {
      firstName: {
        type: "string",
        required: false,
        defaultValue: "",
        fieldName: "first_name",
      },
      lastName: {
        type: "string",
        required: false,
        defaultValue: "",
        fieldName: "last_name",
      },
      tenantId: {
        type: "string",
        required: false,
        fieldName: "tenant_id",
      },
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
      accountId: "provider_account_id",
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
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Create workspace for new user
          await createWorkspaceForUser(user.id);

          // Send welcome email
          if (user.email) {
            await sendEmail({
              from: "Thibault from OpenStatus <thibault@openstatus.dev>",
              subject: "Welcome to OpenStatus.",
              to: [user.email],
              react: WelcomeEmail(),
            });
          }

          // Track analytics
          if (user.id && user.email) {
            try {
              const h = await headers();
              const analytics = await setupAnalytics({
                userId: `usr_${user.id}`,
                email: user.email,
                location: h.get("x-forwarded-for") ?? undefined,
                userAgent: h.get("user-agent") ?? undefined,
              });
              await analytics.track(Events.CreateUser);
            } catch {
              // headers() may not be available in all contexts
            }
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
