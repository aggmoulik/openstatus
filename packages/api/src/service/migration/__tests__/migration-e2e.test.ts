import { describe, expect, test } from "bun:test";
import { MigrationAPIService } from "../migration-api-service";

describe("MigrationAPI - End-to-End Flow Test", () => {
  describe("Complete Migration Flow Simulation", () => {
    test("should demonstrate complete migration workflow", async () => {
      const service = new MigrationAPIService();
      
      // Step 1: Get available providers (may be empty in test environment)
      const providers = await service.getAvailableProviders();
      expect(providers.success).toBe(true);
      expect(providers.data.providers).toBeInstanceOf(Array);
      
      // Step 2: Simulate data analysis
      const sampleData = {
        statusPages: [
          { id: "1", name: "Main Status Page", slug: "main" },
          { id: "2", name: "API Status", slug: "api" }
        ],
        monitors: [
          { id: "1", name: "Website Monitor", url: "https://example.com" },
          { id: "2", name: "API Monitor", url: "https://api.example.com" }
        ],
        components: [
          { id: "1", name: "Web Server", status: "operational" },
          { id: "2", name: "Database", status: "operational" }
        ],
        incidents: [
          { id: "1", name: "Website Downtime", status: "resolved" }
        ],
        maintenance: [
          { id: "1", name: "Scheduled Maintenance", status: "completed" }
        ]
      };
      
      // Step 3: Analyze the data
      const analysis = (service as any).analyzeMigrationData(sampleData);
      expect(analysis.totalEntities).toBe(8);
      expect(analysis.complexity).toBe("low");
      
      // Step 4: Check for conflicts
      const conflicts = (service as any).detectConflicts(sampleData);
      expect(conflicts).toBeInstanceOf(Array);
      
      // Step 5: Get resolutions
      const resolutions = (service as any).suggestResolutions(conflicts);
      expect(resolutions).toBeInstanceOf(Array);
      expect(resolutions.length).toBe(conflicts.length);
      
      // Step 6: Get provider-specific recommendations
      const recommendations = (service as any).getMigrationRecommendations("statuspage.io", analysis);
      expect(recommendations).toBeInstanceOf(Array);
      
      // Verify the complete flow
      expect(analysis.entityBreakdown.statusPages).toBe(2);
      expect(analysis.entityBreakdown.monitors).toBe(2);
      expect(analysis.entityBreakdown.components).toBe(2);
      expect(analysis.entityBreakdown.incidents).toBe(1);
      expect(analysis.entityBreakdown.maintenance).toBe(1);
    });
  });

  describe("Provider Compatibility Matrix", () => {
    test("should validate all supported providers", () => {
      const service = new MigrationAPIService();
      
      const supportedProviders = [
        "statuspage.io",
        "better-stack",
        "instatus", 
        "uptime-kuma",
        "cachet",
        "checkly",
        "status.io",
        "incident.io"
      ];
      
      supportedProviders.forEach(provider => {
        const compatibility = (service as any).getCompatibilityLevel(provider);
        expect(["full", "partial", "limited"]).toContain(compatibility);
        
        // Full compatibility providers should have comprehensive support
        if (compatibility === "full") {
          expect(["statuspage.io", "better-stack", "instatus"]).toContain(provider);
        }
      });
    });
  });

  describe("Migration Time Estimates", () => {
    test("should provide accurate time estimates for different scales", () => {
      const service = new MigrationAPIService();
      
      const testCases = [
        { entities: 5, expectedComplexity: "low", expectedTimePattern: /minutes/ },
        { entities: 25, expectedComplexity: "medium", expectedTimePattern: /minutes/ },
        { entities: 150, expectedComplexity: "high", expectedTimePattern: /minutes/ }
      ];
      
      testCases.forEach(({ entities, expectedComplexity, expectedTimePattern }) => {
        const data = { statusPages: Array(entities) };
        
        const complexity = (service as any).assessMigrationComplexity(data);
        const timeEstimate = (service as any).estimateMigrationTime(data);
        
        expect(complexity).toBe(expectedComplexity);
        expect(timeEstimate).toMatch(expectedTimePattern);
      });
    });
  });

  describe("Error Scenarios", () => {
    test("should handle empty data gracefully", () => {
      const service = new MigrationAPIService();
      
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
      const service = new MigrationAPIService();
      
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
