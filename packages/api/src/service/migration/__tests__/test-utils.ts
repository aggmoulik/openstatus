import { mock } from "bun:test";
import type { 
  ProviderRegistry,
  DataTransformer,
  ProviderAdapter,
  ProviderConfig,
  AuthResult,
  StatusPageData,
  MonitorData,
  ComponentData,
  IncidentData,
  MaintenanceData
} from "../providers/base-provider";

export const TEST_PREFIX = "migration-test";

// Mock provider registry for testing
export const createMockProviderRegistry = (): ProviderRegistry => ({
  getAdapter: (provider: string) => createMockAdapter(provider),
  getProviderConfig: (provider: string) => createMockProviderConfig(provider),
});

// Mock data transformer for testing
export const createMockDataTransformer = (): DataTransformer => ({
  transformEntity: (entityType: string, data: any, provider: string) => 
    Promise.resolve({ id: 1, name: `Transformed ${entityType}`, provider }),
});

// Mock provider adapter
export const createMockAdapter = (provider: string): ProviderAdapter => ({
  authenticate: (credentials) => Promise.resolve<AuthResult>({ 
    success: true, 
    message: "Authenticated" 
  }),
  fetchStatusPages: () => Promise.resolve<StatusPageData[]>([
    { 
      id: "1", 
      name: `${TEST_PREFIX}-page`, 
      slug: `${TEST_PREFIX}-page`,
      description: "Test status page"
    }
  ]),
  fetchComponents: () => Promise.resolve<ComponentData[]>([
    { 
      id: "1", 
      name: `${TEST_PREFIX}-component`, 
      status: "active", 
      pageId: "1" 
    }
  ]),
  fetchMonitors: () => Promise.resolve<MonitorData[]>([
    { 
      id: "1", 
      name: `${TEST_PREFIX}-monitor`, 
      status: "active" 
    }
  ]),
  fetchIncidents: () => Promise.resolve<IncidentData[]>([
    { 
      id: "1", 
      name: `${TEST_PREFIX}-incident`, 
      status: "investigating", 
      impact: "high" 
    }
  ]),
  fetchMaintenance: () => Promise.resolve<MaintenanceData[]>([
    { 
      id: "1", 
      name: `${TEST_PREFIX}-maintenance`, 
      status: "scheduled" 
    }
  ]),
});

// Mock provider configuration
export const createMockProviderConfig = (provider: string): ProviderConfig => ({
  provider,
  version: "1.0.0",
  authentication: {
    type: "api_key",
    keyHeader: "Authorization",
    keyPrefix: "OAuth",
  },
  endpoints: {
    statusPages: "/pages",
    components: "/pages/{pageId}/components",
    monitors: "/pages/{pageId}/monitors",
    incidents: "/pages/{pageId}/incidents",
    maintenance: "/pages/{pageId}/maintenance",
  },
  entityMappings: {
    statusPages: {
      source: "page",
      target: "page",
      fields: {
        id: "id",
        name: "name",
        slug: "url",
        description: "description",
      },
      transforms: {
        slug: "extractSlugFromUrl",
        published: "mapPublishedStatus",
      },
    },
  },
});

// Test data factories
export const createTestMigrationInput = (overrides = {}) => ({
  provider: "statuspage.io",
  credentials: { apiKey: `${TEST_PREFIX}-api-key` },
  workspaceId: 123,
  ...overrides,
});

export const createTestDataSelection = (overrides = {}) => ({
  statusPages: { selectedIds: ["1", "2"], selectAll: false },
  monitors: { selectedIds: ["1"], selectAll: false },
  components: { selectedIds: [], selectAll: true },
  incidents: { selectedIds: [], selectAll: false },
  maintenance: { selectedIds: [], selectAll: false },
  ...overrides,
});

export const createTestProviderData = (overrides = {}) => ({
  statusPages: [
    { id: "1", name: "Page 1", slug: "page1" },
    { id: "2", name: "Page 2", slug: "page2" },
  ],
  monitors: [
    { id: "1", name: "Monitor 1", status: "active" },
    { id: "2", name: "Monitor 2", status: "active" },
  ],
  components: [
    { id: "1", name: "Component 1", status: "active", pageId: "1" },
    { id: "2", name: "Component 2", status: "active", pageId: "1" },
  ],
  incidents: [
    { id: "1", name: "Incident 1", status: "open", impact: "high" },
  ],
  maintenance: [
    { id: "1", name: "Maintenance 1", status: "scheduled" },
  ],
  ...overrides,
});

// Mock console for testing
export const createMockConsole = () => {
  const calls: any[] = [];
  return {
    log: (...args: any[]) => calls.push(args),
    calls,
    mock: mock(() => {}),
  };
};

// Common test assertions
export const expectValidMigrationJob = (job: any, expectedProvider: string, expectedWorkspaceId: number) => {
  expect(job).toBeDefined();
  expect(job.id).toBeDefined();
  expect(job.provider).toBe(expectedProvider);
  expect(job.status).toBe("pending");
  expect(job.progress).toBe(0);
  expect(job.workspaceId).toBe(expectedWorkspaceId);
  expect(job.createdAt).toBeInstanceOf(Date);
  expect(job.updatedAt).toBeInstanceOf(Date);
};

export const expectValidAuthResult = (result: any, expectedSuccess: boolean) => {
  expect(result).toBeDefined();
  expect(typeof result.success).toBe("boolean");
  expect(typeof result.message).toBe("string");
  expect(result.success).toBe(expectedSuccess);
};
