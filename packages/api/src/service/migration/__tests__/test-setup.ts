import { ProviderRegistry } from "../provider-registry";
import { BaseProvider } from "../providers/base-provider";

// Mock adapter for testing
class MockProviderAdapter extends BaseProvider {
  constructor(config: any) {
    super(config);
  }

  async authenticate(): Promise<any> {
    return { success: true, message: "Mock authentication successful" };
  }

  async fetchStatusPages(): Promise<any[]> {
    return [];
  }

  async fetchMonitors(): Promise<any[]> {
    return [];
  }

  async fetchComponents(): Promise<any[]> {
    return [];
  }

  async fetchIncidents(): Promise<any[]> {
    return [];
  }

  async fetchMaintenance(): Promise<any[]> {
    return [];
  }
}

// Test helper to set up mock providers
export function setupMockProviders(registry: ProviderRegistry) {
  const mockProviders = [
    {
      provider: "statuspage.io",
      version: "1.0.0",
      authentication: { type: "apiKey", keyPrefix: "OAuth" },
      endpoints: {
        statusPages: "https://api.statuspage.io/v1/pages",
        monitors: "https://api.statuspage.io/v1/monitors",
        components: "https://api.statuspage.io/v1/components",
        incidents: "https://api.statuspage.io/v1/incidents",
        maintenance: "https://api.statuspage.io/v1/maintenance",
      },
      entityMappings: {
        statusPages: {
          source: "statuspage.io",
          target: "openstatus",
          fields: {
            title: "name",
            description: "description",
            slug: "slug",
            published: "published",
          },
          transforms: {},
        },
        monitors: {
          source: "statuspage.io",
          target: "openstatus",
          fields: {
            name: "name",
            description: "description",
            url: "url",
            jobType: "jobType",
          },
          transforms: {},
        },
        components: {
          source: "statuspage.io",
          target: "openstatus",
          fields: {
            name: "name",
            description: "description",
            status: "status",
          },
          transforms: {},
        },
        incidents: {
          source: "statuspage.io",
          target: "openstatus",
          fields: {
            title: "name",
            summary: "summary",
            status: "status",
          },
          transforms: {},
        },
        maintenance: {
          source: "statuspage.io",
          target: "openstatus",
          fields: {
            title: "name",
            message: "description",
            status: "status",
          },
          transforms: {},
        },
      } as Record<string, any>,
    },
    {
      provider: "better-stack",
      version: "1.0.0",
      authentication: { type: "apiKey", keyPrefix: "Bearer" },
      endpoints: {
        statusPages: "https://api.betterstack.com/v1/status-pages",
        monitors: "https://api.betterstack.com/v1/monitors",
        components: "https://api.betterstack.com/v1/components",
        incidents: "https://api.betterstack.com/v1/incidents",
        maintenance: "https://api.betterstack.com/v1/maintenance",
      },
      entityMappings: {
        statusPages: {
          source: "better-stack",
          target: "openstatus",
          fields: { title: "name", description: "description" },
          transforms: {},
        },
        monitors: {
          source: "better-stack",
          target: "openstatus",
          fields: { name: "name", url: "url" },
          transforms: {},
        },
        components: {
          source: "better-stack",
          target: "openstatus",
          fields: { name: "name", status: "status" },
          transforms: {},
        },
        incidents: {
          source: "better-stack",
          target: "openstatus",
          fields: { title: "name", status: "status" },
          transforms: {},
        },
        maintenance: {
          source: "better-stack",
          target: "openstatus",
          fields: { title: "name", status: "status" },
          transforms: {},
        },
      } as Record<string, any>,
    },
    {
      provider: "uptime-kuma",
      version: "1.0.0",
      authentication: { type: "apiKey", keyPrefix: "Bearer" },
      endpoints: {
        statusPages: "https://kuma.example.com/api/status-pages",
        monitors: "https://kuma.example.com/api/monitors",
        components: "https://kuma.example.com/api/components",
        incidents: "https://kuma.example.com/api/incidents",
        maintenance: "https://kuma.example.com/api/maintenance",
      },
      entityMappings: {
        statusPages: {
          source: "uptime-kuma",
          target: "openstatus",
          fields: { title: "name", description: "description" },
          transforms: {},
        },
        monitors: {
          source: "uptime-kuma",
          target: "openstatus",
          fields: { name: "name", url: "url" },
          transforms: {},
        },
        components: {
          source: "uptime-kuma",
          target: "openstatus",
          fields: { name: "name", status: "status" },
          transforms: {},
        },
        incidents: {
          source: "uptime-kuma",
          target: "openstatus",
          fields: { title: "name", status: "status" },
          transforms: {},
        },
        maintenance: {
          source: "uptime-kuma",
          target: "openstatus",
          fields: { title: "name", status: "status" },
          transforms: {},
        },
      } as Record<string, any>,
    },
  ];

  mockProviders.forEach((config) => {
    const adapter = new MockProviderAdapter(config);
    registry.registerProviderInstance(config, adapter);
  });
}
