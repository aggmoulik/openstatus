import type { ProviderRegistry } from "./provider-registry";

export class DataTransformer {
  constructor(private registry: ProviderRegistry) {}

  async transformEntity(
    entityType: string,
    sourceData: any,
    provider: string,
  ): Promise<any> {
    const config = this.registry.getProviderConfig(provider);
    const mapping = config.entityMappings[entityType];

    if (!mapping) {
      throw new Error(`No mapping found for entity type: ${entityType}`);
    }

    let transformed = this.applyFieldMappings(sourceData, mapping.fields);
    transformed = await this.applyTransforms(
      transformed,
      mapping.transforms || {},
    );
    transformed = await this.applyLookups(transformed, mapping.lookups || {});

    return transformed;
  }

  private applyFieldMappings(data: any, fields: Record<string, string>): any {
    const result: any = {};
    for (const [targetField, sourceField] of Object.entries(fields)) {
      result[targetField] = this.getNestedValue(data, sourceField);
    }
    return result;
  }

  private async applyTransforms(
    data: any,
    transforms: Record<string, string>,
  ): Promise<any> {
    const result = { ...data };
    for (const [field, transformFn] of Object.entries(transforms)) {
      result[field] = await this.executeTransform(result[field], transformFn);
    }
    return result;
  }

  private async applyLookups(
    data: any,
    lookups: Record<string, string>,
  ): Promise<any> {
    const result = { ...data };
    for (const [field, lookupFn] of Object.entries(lookups)) {
      result[field] = await this.executeLookup(result[field], lookupFn);
    }
    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  private async executeTransform(
    value: any,
    transformFn: string,
  ): Promise<any> {
    type TransformFunction = ((value: any) => any) | (() => any);

    const transformRegistry: Record<string, TransformFunction> = {
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

    const transform = transformRegistry[transformFn];
    if (!transform) throw new Error(`Unknown transform: ${transformFn}`);

    // Check if the transform function expects a parameter
    if (transform.length === 0) {
      return (transform as () => any)();
    }
    return (transform as (value: any) => any)(value);
  }

  private async executeLookup(value: any, lookupFn: string): Promise<any> {
    const lookupRegistry = {
      getCurrentWorkspace: () => 1, // Mock workspace ID
      mapToTargetPage: (_sourcePageId: string) => 1, // Mock target page ID
    };

    const lookup = lookupRegistry[lookupFn as keyof typeof lookupRegistry];
    if (!lookup) throw new Error(`Unknown lookup: ${lookupFn}`);
    return lookup(value);
  }
}
