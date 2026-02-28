import {
  type AuthResult,
  BaseProvider,
  type ComponentData,
  type IncidentData,
  type MaintenanceData,
  type MonitorData,
  type ProviderConfig,
  type ProviderCredentials,
  type StatusPageData,
} from "./base-provider";

export class StatuspageProvider extends BaseProvider {
  async authenticate(credentials: ProviderCredentials): Promise<AuthResult> {
    try {
      const _response = await this.makeRequest(
        this.config.endpoints.statusPages,
        {
          headers: {
            Authorization: `${this.config.authentication.keyPrefix} ${credentials.apiKey}`,
          },
        },
      );
      return { success: true, message: "Authentication successful" };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Authentication failed",
      };
    }
  }

  async fetchStatusPages(config: ProviderConfig): Promise<StatusPageData[]> {
    const pages = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.makeRequest<any>(
        `${config.endpoints.statusPages}?page=${page}&limit=100`,
      );
      pages.push(...response.data);
      hasMore = response.data.length === 100;
      page++;
    }

    return pages.map((page) => this.transformPage(page));
  }

  async fetchMonitors(
    config: ProviderConfig,
    pageId?: string,
  ): Promise<MonitorData[]> {
    if (!pageId) return [];
    const response = await this.makeRequest<any>(
      config.endpoints.monitors?.replace("{pageId}", pageId) || "",
    );
    return response.data.map((component: any) =>
      this.transformComponent(component),
    );
  }

  async fetchComponents(
    config: ProviderConfig,
    pageId?: string,
  ): Promise<ComponentData[]> {
    if (!pageId) return [];
    const response = await this.makeRequest<any>(
      config.endpoints.components?.replace("{pageId}", pageId) || "",
    );
    return response.data.map((component: any) =>
      this.transformRawComponent(component),
    );
  }

  async fetchIncidents(
    config: ProviderConfig,
    pageId?: string,
  ): Promise<IncidentData[]> {
    if (!pageId) return [];
    const incidents = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await this.makeRequest<any>(
        `${config.endpoints.incidents?.replace("{pageId}", pageId)}?page=${page}&limit=100`,
      );
      incidents.push(...response.data);
      hasMore = response.data.length === 100;
      page++;
    }

    return incidents.map((incident) => this.transformIncident(incident));
  }

  async fetchMaintenance(
    config: ProviderConfig,
    pageId?: string,
  ): Promise<MaintenanceData[]> {
    if (!pageId) return [];
    const response = await this.makeRequest<any>(
      config.endpoints.maintenance?.replace("{pageId}", pageId) || "",
    );
    return response.data.map((maintenance: any) =>
      this.transformMaintenance(maintenance),
    );
  }

  private transformPage(page: any): StatusPageData {
    const mapping = this.config.entityMappings.statusPages;
    let transformed = this.applyFieldMappings(page, mapping.fields);
    transformed = this.applyTransforms(transformed, mapping.transforms || {});

    return {
      id: transformed.id,
      name: transformed.name,
      slug: transformed.slug,
      description: transformed.description,
      published: transformed.published,
      createdAt: transformed.createdAt
        ? new Date(transformed.createdAt)
        : undefined,
      updatedAt: transformed.updatedAt
        ? new Date(transformed.updatedAt)
        : undefined,
    };
  }

  private transformComponent(component: any): MonitorData {
    const mapping =
      this.config.entityMappings.monitors ||
      this.config.entityMappings.components;
    let transformed = this.applyFieldMappings(component, mapping.fields);
    transformed = this.applyTransforms(transformed, mapping.transforms || {});

    return {
      id: transformed.id,
      name: transformed.name,
      description: transformed.description,
      status: transformed.status,
      jobType: transformed.jobType || "http",
      workspaceId: transformed.workspaceId,
      pageId: transformed.pageId,
    };
  }

  private transformRawComponent(component: any): ComponentData {
    return {
      id: component.id,
      name: component.name,
      description: component.description,
      status: component.status,
      pageId: component.page_id,
      position: component.position,
    };
  }

  private transformIncident(incident: any): IncidentData {
    const mapping = this.config.entityMappings.incidents;
    let transformed = this.applyFieldMappings(incident, mapping.fields);
    transformed = this.applyTransforms(transformed, mapping.transforms || {});

    return {
      id: transformed.id,
      name: transformed.name,
      status: transformed.status,
      impact: transformed.impact,
      createdAt: transformed.createdAt
        ? new Date(transformed.createdAt)
        : undefined,
      updatedAt: transformed.updatedAt
        ? new Date(transformed.updatedAt)
        : undefined,
    };
  }

  private transformMaintenance(maintenance: any): MaintenanceData {
    const mapping = this.config.entityMappings.maintenance;
    let transformed = this.applyFieldMappings(maintenance, mapping.fields);
    transformed = this.applyTransforms(transformed, mapping.transforms || {});

    return {
      id: transformed.id,
      name: transformed.name,
      description: transformed.description,
      status: transformed.status,
      createdAt: transformed.createdAt
        ? new Date(transformed.createdAt)
        : undefined,
      updatedAt: transformed.updatedAt
        ? new Date(transformed.updatedAt)
        : undefined,
    };
  }

  private applyFieldMappings(data: any, fields: Record<string, string>): any {
    const result: any = {};
    for (const [targetField, sourceField] of Object.entries(fields)) {
      result[targetField] = this.getNestedValue(data, sourceField);
    }
    return result;
  }

  private applyTransforms(data: any, transforms: Record<string, string>): any {
    const result = { ...data };
    for (const [field, transformFn] of Object.entries(transforms)) {
      result[field] = this.executeTransform(result[field], transformFn);
    }
    return result;
  }

  private executeTransform(value: any, transformFn: string): any {
    const transformRegistry = {
      extractSlugFromUrl: (url: string) => url.split("/").pop(),
      mapPublishedStatus: (status: boolean) => status !== false, // Default to true unless explicitly false
      mapComponentStatusToMonitorStatus: (status: string) => {
        const statusMap = {
          operational: "active",
          degraded_performance: "degraded",
          major_outage: "inactive",
        };
        return statusMap[status as keyof typeof statusMap] || "inactive";
      },
      defaultToHttp: () => "http",
      mapIncidentStatus: (status: string) => {
        const statusMap = {
          investigating: "investigating",
          identified: "identified",
          resolved: "resolved",
        };
        return statusMap[status as keyof typeof statusMap] || "investigating";
      },
      mapImpactLevel: (impact: string) => {
        const impactMap = {
          minor: "low",
          major: "medium",
          critical: "high",
        };
        return impactMap[impact as keyof typeof impactMap] || "medium";
      },
    };

    const transform =
      transformRegistry[transformFn as keyof typeof transformRegistry];
    if (!transform) throw new Error(`Unknown transform: ${transformFn}`);
    return transform(value);
  }
}
