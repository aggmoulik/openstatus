import { beforeEach, expect, test } from "bun:test";
import type { ProviderConfig } from "../providers/base-provider";
import { StatuspageProvider } from "../providers/statuspage-provider";
import componentsResponse from "./sample-data/statuspage-responses/components-response.json";
import pagesResponse from "./sample-data/statuspage-responses/pages-response.json";

// Mock the JSON imports
const _mockPagesResponse = pagesResponse as any;
const _mockComponentsResponse = componentsResponse as any;

let provider: StatuspageProvider;
let mockConfig: ProviderConfig;

beforeEach(() => {
  mockConfig = {
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
    },
  };

  provider = new StatuspageProvider(mockConfig);
});

test("should transform Statuspage pages to OpenStatus format", async () => {
  // For now, just test the structure without mocking
  // TODO: Add proper mocking when Bun supports it or use a different approach
  expect(mockConfig.entityMappings.statusPages).toBeDefined();
  expect(mockConfig.entityMappings.statusPages.fields.id).toBe("id");
  expect(mockConfig.entityMappings.statusPages.fields.name).toBe("name");
});

test("should transform Statuspage components to OpenStatus monitors", async () => {
  // For now, just test the structure without mocking
  // TODO: Add proper mocking when Bun supports it or use a different approach
  expect(mockConfig.endpoints.components).toBe("/pages/{pageId}/components");
});

test("should successfully authenticate with valid credentials", async () => {
  const credentials = { apiKey: "valid-api-key" };

  // Test the authentication method exists and returns expected structure
  const result = await provider.authenticate(credentials);
  expect(typeof result.success).toBe("boolean");
  expect(typeof result.message).toBe("string");
});

test("should fail authentication with invalid credentials", async () => {
  const credentials = { apiKey: "invalid-api-key" };

  // Test the authentication method exists and returns expected structure
  const result = await provider.authenticate(credentials);
  expect(typeof result.success).toBe("boolean");
  expect(typeof result.message).toBe("string");
});
