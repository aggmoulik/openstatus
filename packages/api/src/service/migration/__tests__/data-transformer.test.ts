import { beforeEach, expect, test } from "bun:test";
import { DataTransformer } from "../data-transformer";
import { ProviderRegistry } from "../provider-registry";
import type { ProviderConfig } from "../providers/base-provider";

// Mock data for testing
const mockProviderConfig: ProviderConfig = {
  provider: "statuspage.io",
  version: "1.0.0",
  authentication: {
    type: "api_key",
    keyHeader: "Authorization",
    keyPrefix: "OAuth",
  },
  endpoints: {
    statusPages: "/pages",
    components: "/pages/{pageId}/components",
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
    monitors: {
      source: "component",
      target: "monitor",
      fields: {
        id: "id",
        name: "name",
        description: "description",
        status: "status",
      },
      transforms: {
        status: "mapComponentStatusToMonitorStatus",
        jobType: "defaultToHttp",
      },
    },
  },
};

let transformer: DataTransformer;
let registry: ProviderRegistry;

beforeEach(() => {
  registry = new ProviderRegistry();
  transformer = new DataTransformer(registry);

  // Register mock provider
  registry.registerProviderInstance(mockProviderConfig, {} as any);
});

test("should apply field mappings correctly", async () => {
  const sourceData = {
    id: "page_123",
    name: "Test Page",
    url: "https://test.example.com",
    description: "Test description",
  };

  const result = await transformer.transformEntity(
    "statusPages",
    sourceData,
    "statuspage.io",
  );

  expect(result).toEqual({
    id: "page_123",
    name: "Test Page",
    slug: "test.example.com",
    description: "Test description",
  });
});

test("should apply transformation functions", async () => {
  const sourceData = {
    id: "comp_123",
    status: "operational",
  };

  const result = await transformer.transformEntity(
    "monitors",
    sourceData,
    "statuspage.io",
  );

  expect(result.status).toBe("active"); // operational -> active
});

test("should handle nested field mappings", async () => {
  const sourceData = {
    id: "page_123",
    nested: {
      field: {
        value: "nested_value",
      },
    },
  };

  // Mock config with nested mapping
  const configWithNested = {
    ...mockProviderConfig,
    entityMappings: {
      testEntity: {
        source: "test",
        target: "test",
        fields: {
          nestedValue: "nested.field.value",
        },
      },
    },
  };

  registry.registerProviderInstance(configWithNested, {} as any);

  const result = await transformer.transformEntity(
    "testEntity",
    sourceData,
    "statuspage.io",
  );

  expect(result.nestedValue).toBe("nested_value");
});

test("should extract slug from URL", async () => {
  const sourceData = {
    id: "page_123",
    url: "https://status.example.com/path/to/page",
  };

  const result = await transformer.transformEntity(
    "statusPages",
    sourceData,
    "statuspage.io",
  );

  expect(result.slug).toBe("page"); // Last segment of URL
});

test("should map component status correctly", async () => {
  const testCases = [
    { input: "operational", expected: "active" },
    { input: "degraded_performance", expected: "degraded" },
    { input: "major_outage", expected: "inactive" },
    { input: "unknown_status", expected: "inactive" }, // default case
  ];

  for (const testCase of testCases) {
    const sourceData = { id: "comp_123", status: testCase.input };
    const result = await transformer.transformEntity(
      "monitors",
      sourceData,
      "statuspage.io",
    );
    expect(result.status).toBe(testCase.expected);
  }
});

test("should map incident impact correctly", async () => {
  const testCases = [
    { input: "minor", expected: "low" },
    { input: "major", expected: "medium" },
    { input: "critical", expected: "high" },
    { input: "unknown_impact", expected: "medium" }, // default case
  ];

  for (const testCase of testCases) {
    const sourceData = { id: "inc_123", impact: testCase.input };
    const result = await transformer.transformEntity(
      "incidents",
      sourceData,
      "statuspage.io",
    );
    expect(result.impact).toBe(testCase.expected);
  }
});

test("should throw error for unknown entity type", async () => {
  const sourceData = { id: "test_123" };

  await expect(
    transformer.transformEntity("unknownEntity", sourceData, "statuspage.io"),
  ).rejects.toThrow("No mapping found for entity type: unknownEntity");
});

test("should throw error for unknown transform function", async () => {
  const configWithInvalidTransform = {
    ...mockProviderConfig,
    entityMappings: {
      statusPages: {
        source: "page",
        target: "page",
        fields: {
          id: "id",
          name: "name",
        },
        transforms: {
          name: "unknownTransformFunction",
        },
      },
    },
  };

  registry.registerProviderInstance(configWithInvalidTransform, {} as any);

  const sourceData = { id: "page_123", name: "Test Page" };

  await expect(
    transformer.transformEntity("statusPages", sourceData, "statuspage.io"),
  ).rejects.toThrow("Unknown transform: unknownTransformFunction");
});
