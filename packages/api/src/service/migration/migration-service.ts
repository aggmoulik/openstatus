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
    // Create migration job
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

    // Store complete dataset for user selection
    // TODO: Implement data storage in database

    return {
      id: jobId,
      provider: input.provider,
      status: "pending",
      progress: 0,
      totalEntities: this.calculateTotalEntities(previewData),
      previewData,
      workspaceId: input.workspaceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateDataSelection(
    jobId: string,
    selection: DataSelection,
  ): Promise<void> {
    // Update user's selection of what to migrate
    // Calculate totals and prepare for execution
    // TODO: Implement selection storage in database
    console.log(`Updated selection for job ${jobId}:`, selection);
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

  // Placeholder methods for database operations
  private async getMigrationJob(_jobId: string): Promise<MigrationJob> {
    // TODO: Implement database retrieval
    throw new Error("getMigrationJob not implemented");
  }

  private async getSelection(_jobId: string): Promise<DataSelection> {
    // TODO: Implement selection retrieval from database
    throw new Error("getSelection not implemented");
  }

  private async updateJobStatus(
    jobId: string,
    status: "pending" | "running" | "completed" | "failed",
  ): Promise<void> {
    // TODO: Implement job status update in database
    console.log(`Updated job ${jobId} status to: ${status}`);
  }

  private async createStatusPage(
    _data: any,
    _workspaceId: number,
  ): Promise<{ id: number }> {
    // TODO: Implement status page creation in database
    return { id: Math.floor(Math.random() * 1000) };
  }

  private async createMonitor(
    _data: any,
    _workspaceId: number,
  ): Promise<{ id: number }> {
    // TODO: Implement monitor creation in database
    return { id: Math.floor(Math.random() * 1000) };
  }

  private async createComponent(
    _data: any,
    _workspaceId: number,
  ): Promise<{ id: number }> {
    // TODO: Implement component creation in database
    return { id: Math.floor(Math.random() * 1000) };
  }

  private async createIncident(
    _data: any,
    _workspaceId: number,
  ): Promise<{ id: number }> {
    // TODO: Implement incident creation in database
    return { id: Math.floor(Math.random() * 1000) };
  }

  private async createMaintenance(
    _data: any,
    _workspaceId: number,
  ): Promise<{ id: number }> {
    // TODO: Implement maintenance creation in database
    return { id: Math.floor(Math.random() * 1000) };
  }
}
