import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { MigrationAPIService } from "../service/migration/migration-api-service";

// Input Schemas
const startMigrationSchema = z.object({
  provider: z.string(),
  credentials: z.object({
    apiKey: z.string().optional(),
    endpoint: z.string().optional(),
    // Provider-specific credential fields
  }),
  workspaceId: z.number(),
});

const statusSchema = z.object({
  jobId: z.string(),
});

const testAuthSchema = z.object({
  provider: z.string(),
  credentials: z.object({
    apiKey: z.string().optional(),
    endpoint: z.string().optional(),
  }),
});

const previewDataSchema = z.object({
  jobId: z.string(),
});

const validateSchema = z.object({
  jobId: z.string(),
});

const executeSchema = z.object({
  jobId: z.string(),
});

const progressSchema = z.object({
  jobId: z.string(),
});

const updateSelectionSchema = z.object({
  jobId: z.string(),
  selection: z.object({
    statusPages: z.object({
      selectedIds: z.array(z.string()),
      selectAll: z.boolean().default(false),
    }),
    monitors: z.object({
      selectedIds: z.array(z.string()),
      selectAll: z.boolean().default(false),
    }),
    components: z.object({
      selectedIds: z.array(z.string()),
      selectAll: z.boolean().default(false),
    }),
    incidents: z.object({
      selectedIds: z.array(z.string()),
      selectAll: z.boolean().default(false),
    }),
    maintenance: z.object({
      selectedIds: z.array(z.string()),
      selectAll: z.boolean().default(false),
    }),
  }),
});

const migrationSummarySchema = z.object({
  jobId: z.string(),
});

const migrationHistorySchema = z.object({
  workspaceId: z.number(),
});

// Output Schemas
const migrationJobSchema = z.object({
  id: z.string(),
  provider: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  progress: z.number(),
  totalEntities: z.number(),
  previewData: z.any(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const migrationProgressSchema = z.object({
  jobId: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  progress: z.number(),
  totals: z.object({
    completed: z.number(),
    failed: z.number(),
    skipped: z.number(),
    total: z.number(),
  }),
  byEntityType: z.record(
    z.string(),
    z.object({
      completed: z.number(),
      failed: z.number(),
      skipped: z.number(),
      total: z.number(),
    }),
  ),
});

const migrationSummaryOutputSchema = z.object({
  jobId: z.string(),
  available: z.object({
    statusPages: z.number(),
    monitors: z.number(),
    components: z.number(),
    incidents: z.number(),
    maintenance: z.number(),
  }),
  selected: z.object({
    statusPages: z.number(),
    monitors: z.number(),
    components: z.number(),
    incidents: z.number(),
    maintenance: z.number(),
  }),
  migrated: z.object({
    statusPages: z.number(),
    monitors: z.number(),
    components: z.number(),
    incidents: z.number(),
    maintenance: z.number(),
  }),
  skipped: z.object({
    statusPages: z.number(),
    monitors: z.number(),
    components: z.number(),
    incidents: z.number(),
    maintenance: z.number(),
  }),
  failed: z.object({
    statusPages: z.number(),
    monitors: z.number(),
    components: z.number(),
    incidents: z.number(),
    maintenance: z.number(),
  }),
});

// Type Definitions
export type MigrationJob = z.infer<typeof migrationJobSchema>;
export type MigrationProgress = z.infer<typeof migrationProgressSchema>;
export type MigrationSummary = z.infer<typeof migrationSummaryOutputSchema>;
export type DataSelection = z.infer<typeof updateSelectionSchema>["selection"];

export const migrationRouter = createTRPCRouter({
  // Provider discovery
  getProviders: protectedProcedure.query(async () => {
    const service = new MigrationAPIService();
    return await service.getAvailableProviders();
  }),

  // Migration management
  start: protectedProcedure
    .input(startMigrationSchema)
    .mutation(async ({ input }) => {
      const service = new MigrationAPIService();
      return await service.startMigration({
        provider: input.provider,
        credentials: input.credentials,
        workspaceId: input.workspaceId,
      });
    }),

  status: protectedProcedure.input(statusSchema).query(async ({ input }) => {
    const service = new MigrationAPIService();
    return await service.getMigrationJob({ jobId: input.jobId });
  }),

  // Provider operations
  testAuth: protectedProcedure
    .input(testAuthSchema)
    .mutation(async ({ input }) => {
      const service = new MigrationAPIService();
      const result = await service.validateProviderCredentials({
        provider: input.provider,
        credentials: input.credentials,
      });
      return {
        success: result.data.valid,
        message: result.data.message,
      };
    }),

  previewData: protectedProcedure
    .input(previewDataSchema)
    .query(async ({ input }) => {
      const service = new MigrationAPIService();
      const jobResult = await service.getMigrationJob({ jobId: input.jobId });
      // Extract preview data from the job result
      return jobResult.data.migrationJob.previewData || {
        statusPages: [],
        monitors: [],
        components: [],
        incidents: [],
        maintenance: [],
      };
    }),

  // Migration execution
  validate: protectedProcedure
    .input(validateSchema)
    .mutation(async ({ input }) => {
      const service = new MigrationAPIService();
      return await service.getMigrationConflicts({ jobId: input.jobId });
    }),

  execute: protectedProcedure
    .input(executeSchema)
    .mutation(async ({ input }) => {
      const service = new MigrationAPIService();
      return await service.executeMigration({ jobId: input.jobId });
    }),

  progress: protectedProcedure
    .input(progressSchema)
    .subscription(async function* ({ input }) {
      // TODO: Implement real-time progress subscription
      // For now, return a single progress update
      yield {
        jobId: input.jobId,
        status: "pending" as const,
        progress: 0,
        totals: {
          completed: 0,
          failed: 0,
          skipped: 0,
          total: 0,
        },
        byEntityType: {},
      };
    }),

  // Data selection and tracking
  updateSelection: protectedProcedure
    .input(updateSelectionSchema)
    .mutation(async ({ input }) => {
      const service = new MigrationAPIService();
      return await service.updateDataSelection({
        jobId: input.jobId,
        selection: input.selection,
      });
    }),

  getMigrationSummary: protectedProcedure
    .input(migrationSummarySchema)
    .query(async ({ input }) => {
      // TODO: Implement migration summary retrieval
      return {
        jobId: input.jobId,
        available: {
          statusPages: 0,
          monitors: 0,
          components: 0,
          incidents: 0,
          maintenance: 0,
        },
        selected: {
          statusPages: 0,
          monitors: 0,
          components: 0,
          incidents: 0,
          maintenance: 0,
        },
        migrated: {
          statusPages: 0,
          monitors: 0,
          components: 0,
          incidents: 0,
          maintenance: 0,
        },
        skipped: {
          statusPages: 0,
          monitors: 0,
          components: 0,
          incidents: 0,
          maintenance: 0,
        },
        failed: {
          statusPages: 0,
          monitors: 0,
          components: 0,
          incidents: 0,
          maintenance: 0,
        },
      };
    }),

  getMigrationHistory: protectedProcedure
    .input(migrationHistorySchema)
    .query(async ({ input }) => {
      // TODO: Implement migration history retrieval
      return [];
    }),
});
