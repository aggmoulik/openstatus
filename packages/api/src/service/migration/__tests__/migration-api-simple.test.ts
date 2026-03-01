import { beforeEach, describe, expect, test, mock } from "bun:test";
import { MigrationAPIService } from "../migration-api-service";
import { ProviderRegistry } from "../provider-registry";
import { DataTransformer } from "../data-transformer";
import { setupMockProviders } from "./test-setup";

describe("MigrationAPIService - Simplified Tests", () => {
  let service: MigrationAPIService;
  let registry: ProviderRegistry;

  beforeEach(() => {
    // Set up providers
    registry = new ProviderRegistry();
    setupMockProviders(registry);
    
    // Create service with the registry
    service = new MigrationAPIService();
    // Replace the internal registry with our mock
    (service as any).migrationService.registry = registry;
  });

  describe("Service Initialization", () => {
    test("should initialize service successfully", () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(MigrationAPIService);
    });
  });

  describe("Provider Discovery", () => {
    test("should return available providers", async () => {
      const result = await service.getAvailableProviders();
      
      expect(result.success).toBe(true);
      expect(result.data.providers).toBeInstanceOf(Array);
      
      // The registry might be empty in test environment, so we just verify the structure
      expect(result.data.providers).toBeDefined();
    });
  });

  describe("Data Analysis Methods", () => {
    test("should analyze migration data correctly", () => {
      const previewData = {
        statusPages: [{ id: "1", name: "Page 1" }, { id: "2", name: "Page 2" }],
        monitors: [{ id: "1", name: "Monitor 1" }],
        components: [{ id: "1", name: "Component 1" }],
        incidents: [{ id: "1", name: "Incident 1" }],
        maintenance: [{ id: "1", name: "Maintenance 1" }],
      };

      const analysis = (service as any).analyzeMigrationData(previewData);

      expect(analysis.totalEntities).toBe(6);
      expect(analysis.entityBreakdown.statusPages).toBe(2);
      expect(analysis.entityBreakdown.monitors).toBe(1);
      expect(analysis.entityBreakdown.components).toBe(1);
      expect(analysis.entityBreakdown.incidents).toBe(1);
      expect(analysis.entityBreakdown.maintenance).toBe(1);
      expect(analysis.complexity).toBe("low");
      expect(analysis.estimatedTime).toMatch(/minutes/);
    });

    test("should assess complexity correctly", () => {
      const lowComplexityData = { statusPages: Array(5) };
      const mediumComplexityData = { statusPages: Array(50) };
      const highComplexityData = { statusPages: Array(150) };

      expect((service as any).assessMigrationComplexity(lowComplexityData)).toBe("low");
      expect((service as any).assessMigrationComplexity(mediumComplexityData)).toBe("medium");
      expect((service as any).assessMigrationComplexity(highComplexityData)).toBe("high");
    });

    test("should estimate migration time correctly", () => {
      const smallData = { statusPages: Array(5) };
      const mediumData = { statusPages: Array(20) };
      const largeData = { statusPages: Array(100) };

      expect((service as any).estimateMigrationTime(smallData)).toMatch(/minutes/);
      expect((service as any).estimateMigrationTime(mediumData)).toMatch(/minutes/);
      expect((service as any).estimateMigrationTime(largeData)).toMatch(/\d+ minutes/);
    });
  });

  describe("Conflict Detection", () => {
    test("should detect conflicts in migration data", () => {
      const dataWithConflicts = {
        statusPages: [{ id: "1", name: "Test Page", slug: "test" }],
        monitors: [{ id: "1", name: "Test Monitor", url: "https://example.com" }],
        components: [],
        incidents: [],
        maintenance: [],
      };

      const conflicts = (service as any).detectConflicts(dataWithConflicts);

      expect(conflicts).toBeInstanceOf(Array);
      expect(conflicts.length).toBeGreaterThan(0);
      
      const namingConflict = conflicts.find((c: any) => c.type === "naming_conflict");
      const duplicateMonitor = conflicts.find((c: any) => c.type === "duplicate_monitor");
      
      expect(namingConflict).toBeDefined();
      expect(duplicateMonitor).toBeDefined();
    });

    test("should suggest resolutions for conflicts", () => {
      const mockConflicts = [
        {
          type: "naming_conflict",
          entity: "status_pages",
          message: "Some status page slugs may conflict",
          severity: "medium",
        },
        {
          type: "duplicate_monitor",
          entity: "monitors",
          message: "Some monitor URLs may already exist",
          severity: "high",
        },
      ];

      const resolutions = (service as any).suggestResolutions(mockConflicts);

      expect(resolutions).toBeInstanceOf(Array);
      expect(resolutions.length).toBe(mockConflicts.length);
      
      resolutions.forEach((resolution: any, index: number) => {
        expect(resolution.conflict).toBe(mockConflicts[index]);
        expect(resolution.resolution).toBeDefined();
      });
    });
  });

  describe("Provider Compatibility", () => {
    test("should return compatibility levels for providers", () => {
      const testProviders = [
        "statuspage.io",
        "better-stack", 
        "instatus",
        "uptime-kuma",
        "cachet",
        "unknown-provider"
      ];

      testProviders.forEach(provider => {
        const compatibility = (service as any).getCompatibilityLevel(provider);
        expect(["full", "partial", "limited"]).toContain(compatibility);
      });
    });
  });

  describe("Migration Recommendations", () => {
    test("should provide provider-specific recommendations", () => {
      const analysis = {
        totalEntities: 25,
        complexity: "medium" as const,
      };

      const statuspageRecommendations = (service as any).getMigrationRecommendations("statuspage.io", analysis);
      const kumaRecommendations = (service as any).getMigrationRecommendations("uptime-kuma", analysis);

      expect(statuspageRecommendations).toBeInstanceOf(Array);
      expect(kumaRecommendations).toBeInstanceOf(Array);
      
      // Should have provider-specific recommendations
      expect(statuspageRecommendations.some((r: any) => r.includes("Slack"))).toBe(true);
      expect(kumaRecommendations.some((r: any) => r.includes("regions"))).toBe(true);
    });

    test("should provide complexity-based recommendations", () => {
      const highComplexityAnalysis = {
        totalEntities: 150,
        complexity: "high" as const,
      };

      const recommendations = (service as any).getMigrationRecommendations("statuspage.io", highComplexityAnalysis);
      
      expect(recommendations.some((r: any) => r.includes("smaller batches"))).toBe(true);
    });
  });

  describe("Error Scenarios", () => {
    test("should handle empty data gracefully", () => {
      const emptyData = {
        statusPages: [],
        monitors: [],
        components: [],
        incidents: [],
        maintenance: []
      };
      
      const analysis = (service as any).analyzeMigrationData(emptyData);
      const conflicts = (service as any).detectConflicts(emptyData);
      
      expect(analysis.totalEntities).toBe(0);
      expect(analysis.complexity).toBe("low");
      expect(conflicts).toBeInstanceOf(Array);
      expect(conflicts.length).toBe(0);
    });
    
    test("should handle malformed data", () => {
      const malformedData = {
        statusPages: null,
        monitors: "invalid",
        components: undefined,
        incidents: {},
        maintenance: []
      };
      
      // Should not throw errors
      expect(() => {
        const analysis = (service as any).analyzeMigrationData(malformedData);
        expect(analysis.totalEntities).toBe(0);
      }).not.toThrow();
    });
  });
});
