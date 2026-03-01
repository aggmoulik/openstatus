import type { DataTransformer } from "./data-transformer";
import type { ProviderRegistry } from "./provider-registry";
import type {
  ComponentData,
  IncidentData,
  MaintenanceData,
  MonitorData,
  ProviderAdapter,
  ProviderConfig,
  ProviderCredentials,
  StatusPageData,
} from "./providers/base-provider";
import { db, eq, schema } from "@openstatus/db";
import { TRPCError } from "@trpc/server";
import type { NewMigrationEntityModel } from "@openstatus/db/src/schema/migration";

export interface StartMigrationInput {
  provider: string;
  credentials: ProviderCredentials;
  workspaceId: number;
}

export interface MigrationJob {
  id: string;
  provider: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  totalEntities: number;
  previewData?: ProviderData;
  workspaceId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderData {
  statusPages: StatusPageData[];
  monitors: MonitorData[];
  components: ComponentData[];
  incidents: IncidentData[];
  maintenance: MaintenanceData[];
}

export interface DataSelection {
  statusPages: { selectedIds: string[]; selectAll: boolean };
  monitors: { selectedIds: string[]; selectAll: boolean };
  components: { selectedIds: string[]; selectAll: boolean };
  incidents: { selectedIds: string[]; selectAll: boolean };
  maintenance: { selectedIds: string[]; selectAll: boolean };
}

export interface EntitySelection {
  selectedIds: string[];
  selectAll: boolean;
}

export class MigrationService {
  constructor(
    private registry: ProviderRegistry,
    private transformer: DataTransformer,
  ) {}

  async startMigration(input: StartMigrationInput): Promise<MigrationJob> {
    // Create migration job in database
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Test provider authentication
    const adapter = this.registry.getAdapter(input.provider);
    const authResult = await adapter.authenticate(input.credentials);

    if (!authResult.success) {
      throw new Error(`Authentication failed: ${authResult.message}`);
    }

    // Fetch all data from provider
    const config = this.registry.getProviderConfig(input.provider);
    const previewData = await this.fetchAllProviderData(adapter, config);

    // Create migration job in database
    const [job] = await db
      .insert(schema.migrationJob)
      .values({
        id: jobId,
        workspaceId: input.workspaceId,
        provider: input.provider,
        status: "pending",
        progress: 0,
        totalEntities: this.calculateTotalEntities(previewData),
        config: JSON.stringify({
          credentials: input.credentials,
          previewData,
        }),
      })
      .returning();

    // Create migration entities for all items
    await this.createMigrationEntities(job.id, previewData);

    return {
      id: job.id,
      provider: job.provider,
      status: job.status as "pending" | "running" | "completed" | "failed",
      progress: job.progress,
      totalEntities: job.totalEntities,
      previewData,
      workspaceId: job.workspaceId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  async updateDataSelection(
    jobId: string,
    selection: DataSelection,
  ): Promise<void> {
    // Update migration entities based on user selection
    const entities = await db.query.migrationEntity.findMany({
      where: eq(schema.migrationEntity.migrationJobId, jobId),
    });

    for (const entity of entities) {
      const entityTypeSelection = selection[entity.entityType as keyof DataSelection];
      const isSelected = entityTypeSelection?.selectedIds.includes(entity.sourceId) || false;
      
      await db
        .update(schema.migrationEntity)
        .set({ 
          status: isSelected ? "pending" : "skipped",
        })
        .where(eq(schema.migrationEntity.id, entity.id));
    }
  }

  async executeMigration(jobId: string): Promise<void> {
    const job = await this.getMigrationJob(jobId);
    const adapter = this.registry.getAdapter(job.provider);
    const selection = await this.getSelection(jobId);
    const config = this.registry.getProviderConfig(job.provider);

    // Update job status to running
    await this.updateJobStatus(jobId, "running");

    try {
      // Execute migration only for selected entities
      await this.migrateStatusPages(
        job,
        adapter,
        config,
        selection.statusPages,
      );
      await this.migrateComponents(job, adapter, config, selection.components);
      await this.migrateMonitors(job, adapter, config, selection.monitors);
      await this.migrateIncidents(job, adapter, config, selection.incidents);
      await this.migrateMaintenance(
        job,
        adapter,
        config,
        selection.maintenance,
      );

      await this.updateJobStatus(jobId, "completed");
    } catch (error) {
      await this.updateJobStatus(jobId, "failed");
      throw error;
    }
  }

  private async fetchAllProviderData(
    adapter: ProviderAdapter,
    config: ProviderConfig,
  ): Promise<ProviderData> {
    const [statusPages, components, incidents, maintenance] = await Promise.all(
      [
        adapter.fetchStatusPages(config),
        adapter.fetchComponents(config),
        adapter.fetchIncidents(config),
        adapter.fetchMaintenance(config),
      ],
    );

    // Fetch monitors for each page
    const monitors: MonitorData[] = [];
    for (const page of statusPages) {
      const pageMonitors = await adapter.fetchMonitors(config, page.id);
      monitors.push(...pageMonitors);
    }

    return {
      statusPages,
      monitors,
      components,
      incidents,
      maintenance,
    };
  }

  private calculateTotalEntities(data: ProviderData): number {
    return (
      data.statusPages.length +
      data.monitors.length +
      data.components.length +
      data.incidents.length +
      data.maintenance.length
    );
  }

  private async migrateStatusPages(
    job: MigrationJob,
    adapter: ProviderAdapter,
    config: ProviderConfig,
    selection: EntitySelection,
  ) {
    const allStatusPages = await adapter.fetchStatusPages(config);
    const selectedPages = allStatusPages.filter((page) =>
      selection.selectedIds.includes(page.id),
    );

    for (const pageData of selectedPages) {
      try {
        const transformed = await this.transformer.transformEntity(
          "statusPages",
          pageData,
          job.provider,
        );
        // TODO: Create status page in database
        const created = await this.createStatusPage(
          transformed,
          job.workspaceId,
        );

        // TODO: Record success in migration_entity table
        console.log(`Migrated status page: ${pageData.name} -> ${created.id}`);
      } catch (error) {
        // TODO: Record failure in migration_entity table
        console.error(`Failed to migrate status page: ${pageData.name}`, error);
      }
    }

    // Record skipped items
    const skippedPages = allStatusPages.filter(
      (page) => !selection.selectedIds.includes(page.id),
    );
    for (const pageData of skippedPages) {
      // TODO: Record skip in migration_entity table
      console.log(`Skipped status page: ${pageData.name} (User deselected)`);
    }
  }

  private async migrateComponents(
    job: MigrationJob,
    adapter: ProviderAdapter,
    config: ProviderConfig,
    selection: EntitySelection,
  ) {
    const allComponents = await adapter.fetchComponents(config);
    const selectedComponents = allComponents.filter((component) =>
      selection.selectedIds.includes(component.id),
    );

    for (const componentData of selectedComponents) {
      try {
        const transformed = await this.transformer.transformEntity(
          "components",
          componentData,
          job.provider,
        );
        // TODO: Create component/monitor in database
        const created = await this.createMonitor(transformed, job.workspaceId);

        // TODO: Record success in migration_entity table
        console.log(
          `Migrated component: ${componentData.name} -> ${created.id}`,
        );
      } catch (error) {
        // TODO: Record failure in migration_entity table
        console.error(
          `Failed to migrate component: ${componentData.name}`,
          error,
        );
      }
    }

    // Record skipped items
    const skippedComponents = allComponents.filter(
      (component) => !selection.selectedIds.includes(component.id),
    );
    for (const componentData of skippedComponents) {
      // TODO: Record skip in migration_entity table
      console.log(`Skipped component: ${componentData.name} (User deselected)`);
    }
  }

  private async migrateMonitors(
    job: MigrationJob,
    adapter: ProviderAdapter,
    config: ProviderConfig,
    selection: EntitySelection,
  ) {
    const allMonitors = await adapter.fetchMonitors(config);
    const selectedMonitors = allMonitors.filter((monitor) =>
      selection.selectedIds.includes(monitor.id),
    );

    for (const monitorData of selectedMonitors) {
      try {
        const transformed = await this.transformer.transformEntity(
          "monitors",
          monitorData,
          job.provider,
        );
        // TODO: Create monitor in database
        const created = await this.createMonitor(transformed, job.workspaceId);

        // TODO: Record success in migration_entity table
        console.log(`Migrated monitor: ${monitorData.name} -> ${created.id}`);
      } catch (error) {
        // TODO: Record failure in migration_entity table
        console.error(`Failed to migrate monitor: ${monitorData.name}`, error);
      }
    }

    // Record skipped items
    const skippedMonitors = allMonitors.filter(
      (monitor) => !selection.selectedIds.includes(monitor.id),
    );
    for (const monitorData of skippedMonitors) {
      // TODO: Record skip in migration_entity table
      console.log(`Skipped monitor: ${monitorData.name} (User deselected)`);
    }
  }

  private async migrateIncidents(
    job: MigrationJob,
    adapter: ProviderAdapter,
    config: ProviderConfig,
    selection: EntitySelection,
  ) {
    const allIncidents = await adapter.fetchIncidents(config);
    const selectedIncidents = allIncidents.filter((incident) =>
      selection.selectedIds.includes(incident.id),
    );

    for (const incidentData of selectedIncidents) {
      try {
        const transformed = await this.transformer.transformEntity(
          "incidents",
          incidentData,
          job.provider,
        );
        // TODO: Create incident in database
        const created = await this.createIncident(transformed, job.workspaceId);

        // TODO: Record success in migration_entity table
        console.log(`Migrated incident: ${incidentData.name} -> ${created.id}`);
      } catch (error) {
        // TODO: Record failure in migration_entity table
        console.error(
          `Failed to migrate incident: ${incidentData.name}`,
          error,
        );
      }
    }

    // Record skipped items
    const skippedIncidents = allIncidents.filter(
      (incident) => !selection.selectedIds.includes(incident.id),
    );
    for (const incidentData of skippedIncidents) {
      // TODO: Record skip in migration_entity table
      console.log(`Skipped incident: ${incidentData.name} (User deselected)`);
    }
  }

  private async migrateMaintenance(
    job: MigrationJob,
    adapter: ProviderAdapter,
    config: ProviderConfig,
    selection: EntitySelection,
  ) {
    const allMaintenance = await adapter.fetchMaintenance(config);
    const selectedMaintenance = allMaintenance.filter((maintenance) =>
      selection.selectedIds.includes(maintenance.id),
    );

    for (const maintenanceData of selectedMaintenance) {
      try {
        const transformed = await this.transformer.transformEntity(
          "maintenance",
          maintenanceData,
          job.provider,
        );
        // TODO: Create maintenance in database
        const created = await this.createMaintenance(
          transformed,
          job.workspaceId,
        );

        // TODO: Record success in migration_entity table
        console.log(
          `Migrated maintenance: ${maintenanceData.name} -> ${created.id}`,
        );
      } catch (error) {
        // TODO: Record failure in migration_entity table
        console.error(
          `Failed to migrate maintenance: ${maintenanceData.name}`,
          error,
        );
      }
    }

    // Record skipped items
    const skippedMaintenance = allMaintenance.filter(
      (maintenance) => !selection.selectedIds.includes(maintenance.id),
    );
    for (const maintenanceData of skippedMaintenance) {
      // TODO: Record skip in migration_entity table
      console.log(
        `Skipped maintenance: ${maintenanceData.name} (User deselected)`,
      );
    }
  }

  // Database operations
  private async createMigrationEntities(jobId: string, data: ProviderData): Promise<void> {
    const entities: NewMigrationEntityModel[] = [];
    
    // Add status pages
    data.statusPages.forEach((page) => {
      entities.push({
        migrationJobId: jobId,
        entityType: "statusPages",
        sourceId: page.id,
        status: "pending",
      });
    });
    
    // Add monitors
    data.monitors.forEach((monitor) => {
      entities.push({
        migrationJobId: jobId,
        entityType: "monitors",
        sourceId: monitor.id,
        status: "pending",
      });
    });
    
    // Add components
    data.components.forEach((component) => {
      entities.push({
        migrationJobId: jobId,
        entityType: "components",
        sourceId: component.id,
        status: "pending",
      });
    });
    
    // Add incidents
    data.incidents.forEach((incident) => {
      entities.push({
        migrationJobId: jobId,
        entityType: "incidents",
        sourceId: incident.id,
        status: "pending",
      });
    });
    
    // Add maintenance
    data.maintenance.forEach((maintenance) => {
      entities.push({
        migrationJobId: jobId,
        entityType: "maintenance",
        sourceId: maintenance.id,
        status: "pending",
      });
    });
    
    if (entities.length > 0) {
      await db.insert(schema.migrationEntity).values(entities);
    }
  }
  private async getMigrationJob(jobId: string): Promise<MigrationJob> {
    const job = await db.query.migrationJob.findFirst({
      where: eq(schema.migrationJob.id, jobId),
    });
    
    if (!job) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Migration job ${jobId} not found`,
      });
    }
    
    return {
      id: job.id,
      provider: job.provider,
      status: job.status as "pending" | "running" | "completed" | "failed",
      progress: job.progress || 0,
      totalEntities: job.totalEntities || 0,
      workspaceId: job.workspaceId,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    };
  }

  private async getSelection(jobId: string): Promise<DataSelection> {
    const job = await db.query.migrationJob.findFirst({
      where: eq(schema.migrationJob.id, jobId),
      with: {
        migrationEntities: true,
      },
    });
    
    if (!job) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `Migration job ${jobId} not found`,
      });
    }
    
    // Parse selection from migration entities or return default
    const selection: DataSelection = {
      statusPages: { selectedIds: [], selectAll: false },
      monitors: { selectedIds: [], selectAll: false },
      components: { selectedIds: [], selectAll: false },
      incidents: { selectedIds: [], selectAll: false },
      maintenance: { selectedIds: [], selectAll: false },
    };
    
    // Extract selected IDs from migration entities
    job.migrationEntities.forEach((entity) => {
      if (entity.status === "pending" && selection[entity.entityType as keyof DataSelection]) {
        selection[entity.entityType as keyof DataSelection].selectedIds.push(entity.sourceId);
      }
    });
    
    return selection;
  }

  private async updateJobStatus(
    jobId: string,
    status: "pending" | "running" | "completed" | "failed",
  ): Promise<void> {
    await db
      .update(schema.migrationJob)
      .set({ 
        status,
        updatedAt: new Date(),
      })
      .where(eq(schema.migrationJob.id, jobId));
  }

  private async createStatusPage(
    data: any,
    workspaceId: number,
  ): Promise<{ id: number }> {
    const [page] = await db
      .insert(schema.page)
      .values({
        workspaceId,
        title: data.title || data.name,
        description: data.description || "",
        slug: data.slug || `page-${Date.now()}`,
        published: data.published ?? true,
        customDomain: "",
        legacyPage: false,
      })
      .returning({ id: schema.page.id });
    
    return { id: page.id };
  }

  private async createMonitor(
    data: any,
    workspaceId: number,
  ): Promise<{ id: number }> {
    const [monitor] = await db
      .insert(schema.monitor)
      .values({
        workspaceId,
        name: data.name,
        description: data.description || "",
        url: data.url || "https://example.com",
        jobType: data.jobType || "http",
        status: data.status || "active",
        periodicity: data.periodicity || "other",
        method: data.method || "GET",
        regions: data.regions || "",
        headers: data.headers || "",
        body: data.body || "",
        active: false, // Start inactive until user activates
      })
      .returning({ id: schema.monitor.id });
    
    return { id: monitor.id };
  }

  private async createComponent(
    data: any,
    workspaceId: number,
  ): Promise<{ id: number }> {
    // Components are created as page components in OpenStatus
    const [component] = await db
      .insert(schema.pageComponent)
      .values({
        workspaceId,
        pageId: data.pageId || 1, // Should be set by the caller
        type: "monitor",
        monitorId: data.monitorId,
        name: data.name,
        description: data.description,
        order: data.position || 0,
      })
      .returning({ id: schema.pageComponent.id });
    
    return { id: component.id };
  }

  private async createIncident(
    data: any,
    workspaceId: number,
  ): Promise<{ id: number }> {
    const [incident] = await db
      .insert(schema.incidentTable)
      .values({
        workspaceId,
        title: data.title || data.name,
        summary: data.summary || data.description || "",
        status: data.status || "triage",
        monitorId: data.monitorId,
        startedAt: data.createdAt || new Date(),
      })
      .returning({ id: schema.incidentTable.id });
    
    return { id: incident.id };
  }

  private async createMaintenance(
    data: any,
    workspaceId: number,
  ): Promise<{ id: number }> {
    const [maintenance] = await db
      .insert(schema.maintenance)
      .values({
        workspaceId,
        pageId: data.pageId,
        title: data.title || data.name,
        message: data.description || "",
        from: data.scheduledStart || data.from || new Date(),
        to: data.scheduledEnd || data.to || new Date(),
      })
      .returning({ id: schema.maintenance.id });
    
    return { id: maintenance.id };
  }
}
