import { MigrationService } from "./migration-service";
import { ProviderRegistry } from "./provider-registry";
import { DataTransformer } from "./data-transformer";
import { db, eq, schema } from "@openstatus/db";
import { TRPCError } from "@trpc/server";

// Enhanced migration service with comprehensive API support
export class MigrationAPIService {
  private migrationService: MigrationService;

  constructor() {
    const registry = new ProviderRegistry();
    this.migrationService = new MigrationService(
      registry,
      new DataTransformer(registry)
    );
  }

  /**
   * Get available migration providers
   */
  async getAvailableProviders() {
    const registry = new ProviderRegistry();
    const providers = registry.getAvailableProviders();
    return {
      success: true,
      data: {
        providers: providers.map(provider => {
          const breakdown = this.getCompatibilityBreakdown(provider.name);
          return {
            name: provider.name,
            displayName: provider.displayName,
            description: `Supports ${provider.supportedEntities.join(", ")} migration`,
            version: "1.0.0",
            features: provider.supportedEntities,
            authentication: {
              type: provider.authType,
              description: `${provider.authType} authentication required`,
            },
            compatibility: this.getCompatibilityLevel(provider.name),
            compatibilityBreakdown: breakdown,
          };
        }),
      },
    };
  }

  /**
   * Validate provider credentials
   */
  async validateProviderCredentials(input: {
    provider: string;
    credentials: Record<string, any>;
  }) {
    try {
      const registry = new ProviderRegistry();
      const adapter = registry.getAdapter(input.provider);
      const result = await adapter.authenticate(input.credentials);
      
      return {
        success: true,
        data: {
          valid: result.success,
          message: result.message,
          provider: input.provider,
        },
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to validate credentials: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Start migration process
   */
  async startMigration(input: {
    provider: string;
    credentials: Record<string, any>;
    workspaceId: number;
    options?: {
      includeHistoricalIncidents?: boolean;
      includeSubscribers?: boolean;
      includeMaintenanceHistory?: boolean;
      includeNotificationChannels?: boolean;
    };
  }) {
    try {
      const migrationJob = await this.migrationService.startMigration({
        provider: input.provider,
        credentials: input.credentials,
        workspaceId: input.workspaceId,
      });

      // Analyze migration data and provide insights
      const analysis = this.analyzeMigrationData(migrationJob.previewData);

      return {
        success: true,
        data: {
          migrationJob: {
            id: migrationJob.id,
            provider: migrationJob.provider,
            status: migrationJob.status,
            progress: migrationJob.progress,
            totalEntities: migrationJob.totalEntities,
            createdAt: migrationJob.createdAt.toISOString(),
            updatedAt: migrationJob.updatedAt.toISOString(),
          },
          preview: {
            ...migrationJob.previewData,
            analysis,
          },
          recommendations: this.getMigrationRecommendations(input.provider, analysis),
        },
      };
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Failed to start migration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Get migration job status
   */
  async getMigrationJob(input: { jobId: string }) {
    try {
      const job = await db.query.migrationJob.findFirst({
        where: eq(schema.migrationJob.id, input.jobId),
        with: {
          migrationEntities: true,
        },
      });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Migration job ${input.jobId} not found`,
        });
      }

      // Parse preview data from config
      let previewData = null;
      try {
        const config = JSON.parse(job.config || "{}");
        previewData = config.previewData;
      } catch (e) {
        // Config parsing failed, continue without preview data
      }

      return {
        success: true,
        data: {
          migrationJob: {
            id: job.id,
            provider: job.provider,
            status: job.status as "pending" | "running" | "completed" | "failed",
            progress: job.progress || 0,
            totalEntities: job.totalEntities || 0,
            createdAt: job.createdAt.toISOString(),
            updatedAt: job.updatedAt.toISOString(),
            previewData,
          },
        },
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to get migration job: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Update data selection for migration
   */
  async updateDataSelection(input: {
    jobId: string;
    selection: {
      statusPages: { selectedIds: string[]; selectAll: boolean };
      monitors: { selectedIds: string[]; selectAll: boolean };
      components: { selectedIds: string[]; selectAll: boolean };
      incidents: { selectedIds: string[]; selectAll: boolean };
      maintenance: { selectedIds: string[]; selectAll: boolean };
      subscribers: { selectedIds: string[]; selectAll: boolean };
      notificationChannels: { selectedIds: string[]; selectAll: boolean };
    };
  }) {
    try {
      await this.migrationService.updateDataSelection(input.jobId, input.selection);
      
      return {
        success: true,
        data: {
          message: "Data selection updated successfully",
          jobId: input.jobId,
        },
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to update data selection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Execute migration
   */
  async executeMigration(input: { jobId: string }) {
    try {
      await this.migrationService.executeMigration(input.jobId);
      
      return {
        success: true,
        data: {
          message: "Migration completed successfully",
          jobId: input.jobId,
        },
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to execute migration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Get migration conflicts and recommendations
   */
  async getMigrationConflicts(input: {
    jobId: string;
  }) {
    try {
      const job = await db.query.migrationJob.findFirst({
        where: eq(schema.migrationJob.id, input.jobId),
        with: {
          migrationEntities: true,
        },
      });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Migration job ${input.jobId} not found`,
        });
      }

      // Parse preview data from config
      let previewData = null;
      try {
        const config = JSON.parse(job.config || "{}");
        previewData = config.previewData;
      } catch (e) {
        // Config parsing failed
      }

      const conflicts = this.detectConflicts(previewData);
      const resolutions = this.suggestResolutions(conflicts);

      return {
        success: true,
        data: {
          conflicts,
          resolutions,
          jobId: input.jobId,
        },
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to analyze conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Get compatibility level for a provider
   */
  private getCompatibilityLevel(providerName: string): "full" | "partial" | "limited" {
    const compatibilityMap: Record<string, "full" | "partial" | "limited"> = {
      "statuspage.io": "partial", // Updated: Missing incident updates, postmortems, and advanced subscriber features
      "better-stack": "full", 
      "instatus": "full",
      "uptime-kuma": "partial",
      "cachet": "partial",
      "checkly": "limited",
      "status.io": "limited",
      "incident.io": "limited",
    };

    return compatibilityMap[providerName] || "limited";
  }

  /**
   * Analyze migration data for insights
   */
  private analyzeMigrationData(data: any): {
    totalEntities: number;
    entityBreakdown: {
      statusPages: number;
      monitors: number;
      components: number;
      incidents: number;
      maintenance: number;
    };
    complexity: "low" | "medium" | "high";
    estimatedTime: string;
  } {
    const totalEntities = Object.values(data).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    
    return {
      totalEntities,
      entityBreakdown: {
        statusPages: data.statusPages?.length || 0,
        monitors: data.monitors?.length || 0,
        components: data.components?.length || 0,
        incidents: data.incidents?.length || 0,
        maintenance: data.maintenance?.length || 0,
      },
      complexity: this.assessMigrationComplexity(data),
      estimatedTime: this.estimateMigrationTime(data),
    };
  }

  /**
   * Assess migration complexity
   */
  private assessMigrationComplexity(data: any): "low" | "medium" | "high" {
    const totalEntities = Object.values(data).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    
    if (totalEntities < 20) return "low";
    if (totalEntities < 100) return "medium";
    return "high";
  }

  /**
   * Estimate migration time
   */
  private estimateMigrationTime(data: any): string {
    const totalEntities = Object.values(data).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
    
    // Base time: 30 seconds + 2 seconds per entity
    const baseSeconds = 30 + (totalEntities * 2);
    const minutes = Math.ceil(baseSeconds / 60);
    
    if (minutes < 1) return "< 1 minute";
    if (minutes < 5) return `${minutes} minutes`;
    return `${minutes}+ minutes`;
  }

  /**
   * Get detailed compatibility breakdown for a provider
   */
  private getCompatibilityBreakdown(providerName: string): {
    level: "full" | "partial" | "limited";
    supportedFeatures: string[];
    missingFeatures: string[];
    dataLossEstimate: string;
    migrationRecommendations: string[];
  } {
    const breakdowns: Record<string, any> = {
      "statuspage.io": {
        level: "partial",
        supportedFeatures: [
          "Basic page CRUD operations",
          "Component management",
          "Basic incident management",
          "Template management",
          "Basic subscriber management",
          "Component groups",
        ],
        missingFeatures: [
          "Incident updates and timeline management",
          "Incident postmortems",
          "Advanced subscriber operations (bulk actions, analytics)",
          "Specialized incident queries (active maintenance, upcoming, etc.)",
          "Individual subscriber deletion",
          "Subscriber analytics and reporting",
        ],
        dataLossEstimate: "~40-60% of incident history and subscriber data",
        migrationRecommendations: [
          "Plan to manually recreate incident update timelines",
          "Export postmortem content separately before migration",
          "Prepare to reconfigure subscriber notification preferences",
          "Consider manual migration of critical incident updates",
          "Review and test subscriber notification workflows post-migration",
        ],
      },
      "better-stack": {
        level: "full",
        supportedFeatures: ["All major features supported"],
        missingFeatures: [],
        dataLossEstimate: "<5% data loss expected",
        migrationRecommendations: ["Standard migration process"],
      },
      "instatus": {
        level: "full", 
        supportedFeatures: ["All major features supported"],
        missingFeatures: [],
        dataLossEstimate: "<5% data loss expected",
        migrationRecommendations: ["Standard migration process"],
      },
    };

    return breakdowns[providerName] || {
      level: "limited",
      supportedFeatures: ["Basic CRUD operations"],
      missingFeatures: ["Most advanced features"],
      dataLossEstimate: "70-90% data loss expected",
      migrationRecommendations: ["Consider manual migration or alternative solution"],
    };
  }

  /**
   * Get migration recommendations
   */
  private getMigrationRecommendations(provider: string, analysis: any): string[] {
    const recommendations: string[] = [];
    
    // Provider-specific recommendations
    if (provider === "statuspage.io") {
      recommendations.push("Consider re-authenticating Slack/Discord integrations after migration");
      recommendations.push("Review monitor intervals - OpenStatus minimum is 30s on paid plans");
    }
    
    if (provider === "uptime-kuma") {
      recommendations.push("Custom monitoring regions may need manual configuration");
      recommendations.push("Advanced assertions might need reconfiguration");
    }
    
    // Complexity-based recommendations
    if (analysis.complexity === "high") {
      recommendations.push("Consider migrating in smaller batches for better reliability");
    }
    
    return recommendations;
  }

  /**
   * Detect potential conflicts
   */
  private detectConflicts(data: any) {
    const conflicts = [];
    
    // Check for potential naming conflicts
    if (data.statusPages && data.statusPages.length > 0) {
      conflicts.push({
        type: "naming_conflict",
        entity: "status_pages",
        message: "Some status page slugs may conflict with existing pages",
        severity: "medium",
      });
    }
    
    // Check for monitor URL conflicts
    if (data.monitors && data.monitors.length > 0) {
      conflicts.push({
        type: "duplicate_monitor",
        entity: "monitors", 
        message: "Some monitor URLs may already exist in your workspace",
        severity: "high",
      });
    }
    
    return conflicts;
  }

  /**
   * Suggest conflict resolutions
   */
  private suggestResolutions(conflicts: any[]) {
    return conflicts.map(conflict => ({
      conflict,
      resolution: this.getResolutionForConflict(conflict.type),
    }));
  }

  /**
   * Get resolution strategy for conflict type
   */
  private getResolutionForConflict(conflictType: string): string {
    const resolutions: Record<string, string> = {
      "naming_conflict": "Rename imported items with '(Imported)' suffix",
      "duplicate_monitor": "Skip duplicate monitors or merge with existing ones",
      "unsupported_feature": "Continue without unsupported features",
    };
    
    return resolutions[conflictType] || "Manual review required";
  }
}
