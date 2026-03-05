import { eq } from "@openstatus/db";
import { migrationJob } from "@openstatus/db/src/schema";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { statuspageProvider } from "./migration/providers/statuspage/adapter";
import { createJob, runMigration } from "./migration/runner";

const providers = {
  statuspage: statuspageProvider,
};

export const migrationRouter = createTRPCRouter({
  import: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["statuspage"]),
        apiKey: z.string().min(1),
        pageId: z.string().min(1),
        useMockData: z.boolean().default(false),
        dryRun: z.boolean().default(false),
      }),
    )
    .mutation(async (opts) => {
      const provider = (providers as any)[opts.input.provider];

      let plan = null;
      if (opts.input.dryRun) {
        const rawData = await provider.fetch({
          apiKey: opts.input.apiKey,
          pageId: opts.input.pageId,
          useMock: opts.input.useMockData,
        });
        plan = provider.transform(rawData, new Map());
      }

      const job = await createJob(opts.ctx.db, opts.ctx.workspace.id, {
        provider: opts.input.provider,
        externalPageId: opts.input.pageId,
        useMockData: opts.input.useMockData,
      });

      if (!opts.input.dryRun) {
        // Fire and forget runMigration
        // In a real app, this should probably be offloaded to a background job queue (e.g., BullMQ)
        // But for this project, we can run it in the background of the same process if it's safe.
        // We catch errors inside runMigration to update the job status.
        runMigration(job.id, opts.ctx, opts.input.apiKey).catch((e) => {
          console.error(`Migration ${job.id} failed:`, e);
        });
      }

      return {
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        plan,
      };
    }),

  status: protectedProcedure
    .input(z.object({ jobId: z.number() }))
    .query(async (opts) => {
      const job = await opts.ctx.db.query.migrationJob.findFirst({
        where: eq(migrationJob.id, opts.input.jobId),
      });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Migration job not found",
        });
      }

      if (job.workspaceId !== opts.ctx.workspace.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      return {
        id: job.id,
        status: job.status,
        progress: job.progress,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      };
    }),

  list: protectedProcedure.query(async (opts) => {
    const jobs = await opts.ctx.db.query.migrationJob.findMany({
      where: eq(migrationJob.workspaceId, opts.ctx.workspace.id),
      orderBy: (migrationJob, { desc }) => [desc(migrationJob.createdAt)],
    });

    return jobs.map((job) => ({
      id: job.id,
      status: job.status,
      provider: job.provider,
      externalPageId: job.externalPageId,
      createdAt: job.createdAt,
    }));
  }),

  resume: protectedProcedure
    .input(z.object({ jobId: z.number(), apiKey: z.string().min(1) }))
    .mutation(async (opts) => {
      const job = await opts.ctx.db.query.migrationJob.findFirst({
        where: eq(migrationJob.id, opts.input.jobId),
      });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Migration job not found",
        });
      }

      if (job.workspaceId !== opts.ctx.workspace.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied",
        });
      }

      if (job.status === "completed") {
        return { message: "Migration already completed" };
      }

      // Resume by calling runMigration again
      runMigration(job.id, opts.ctx, opts.input.apiKey).catch((e) => {
        console.error(`Migration ${job.id} failed on resume:`, e);
      });

      return { message: "Migration resumed" };
    }),
});
