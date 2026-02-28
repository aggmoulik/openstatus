export interface ProviderCredentials {
  apiKey?: string;
  endpoint?: string;
  // Provider-specific credential fields
}

export interface AuthResult {
  success: boolean;
  message: string;
}

export interface ProviderConfig {
  provider: string;
  version: string;
  authentication: {
    type: string;
    keyHeader?: string;
    keyPrefix?: string;
    testEndpoint?: string;
  };
  endpoints: {
    statusPages: string;
    components?: string;
    monitors?: string;
    incidents?: string;
    maintenance?: string;
  };
  entityMappings: Record<string, EntityMapping>;
  pagination?: {
    type: string;
    pageSize: number;
    pageParam: string;
    limitParam: string;
  };
  rateLimit?: {
    requestsPerMinute: number;
    burstLimit: number;
  };
}

export interface EntityMapping {
  source: string;
  target: string;
  fields: Record<string, string>;
  transforms?: Record<string, string>;
  lookups?: Record<string, string>;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, any>;
}

export interface StatusPageData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  published?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MonitorData {
  id: string;
  name: string;
  description?: string;
  status: string;
  jobType?: string;
  workspaceId?: number;
  pageId?: number;
}

export interface ComponentData {
  id: string;
  name: string;
  description?: string;
  status: string;
  pageId: string;
  position?: number;
}

export interface IncidentData {
  id: string;
  name: string;
  status: string;
  impact: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MaintenanceData {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProviderAdapter {
  authenticate(credentials: ProviderCredentials): Promise<AuthResult>;
  fetchStatusPages(config: ProviderConfig): Promise<StatusPageData[]>;
  fetchMonitors(
    config: ProviderConfig,
    pageId?: string,
  ): Promise<MonitorData[]>;
  fetchComponents(
    config: ProviderConfig,
    pageId?: string,
  ): Promise<ComponentData[]>;
  fetchIncidents(
    config: ProviderConfig,
    pageId?: string,
  ): Promise<IncidentData[]>;
  fetchMaintenance(
    config: ProviderConfig,
    pageId?: string,
  ): Promise<MaintenanceData[]>;
}

export abstract class BaseProvider implements ProviderAdapter {
  constructor(protected config: ProviderConfig) {}

  protected async makeRequest<T>(
    _endpoint: string,
    _options?: RequestOptions,
  ): Promise<T> {
    // Common request handling with rate limiting, retries, etc.
    // This is a placeholder implementation
    throw new Error("makeRequest must be implemented by concrete provider");
  }

  protected transformData<T>(_data: any, _mapping: EntityMapping): T {
    // Apply field mappings and transforms
    // This is a placeholder implementation
    throw new Error("transformData must be implemented by concrete provider");
  }

  protected getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  abstract authenticate(credentials: ProviderCredentials): Promise<AuthResult>;
  abstract fetchStatusPages(config: ProviderConfig): Promise<StatusPageData[]>;
  abstract fetchMonitors(
    config: ProviderConfig,
    pageId?: string,
  ): Promise<MonitorData[]>;
  abstract fetchComponents(
    config: ProviderConfig,
    pageId?: string,
  ): Promise<ComponentData[]>;
  abstract fetchIncidents(
    config: ProviderConfig,
    pageId?: string,
  ): Promise<IncidentData[]>;
  abstract fetchMaintenance(
    config: ProviderConfig,
    pageId?: string,
  ): Promise<MaintenanceData[]>;
}
