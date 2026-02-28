import type {
  ProviderAdapter,
  ProviderConfig,
} from "./providers/base-provider";

export interface ProviderInfo {
  name: string;
  displayName: string;
  supportedEntities: string[];
  authType: string;
}

export class ProviderRegistry {
  private providers = new Map<string, ProviderConfig>();
  private adapters = new Map<string, ProviderAdapter>();

  async registerProvider(configPath: string): Promise<void> {
    // In a real implementation, this would load from file system
    // For now, we'll register providers programmatically
    const config = await this.loadProviderConfig(configPath);
    const adapter = await this.createAdapter(config);
    this.providers.set(config.provider, config);
    this.adapters.set(config.provider, adapter);
  }

  registerProviderInstance(
    config: ProviderConfig,
    adapter: ProviderAdapter,
  ): void {
    this.providers.set(config.provider, config);
    this.adapters.set(config.provider, adapter);
  }

  getAdapter(provider: string): ProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) throw new Error(`Provider ${provider} not registered`);
    return adapter;
  }

  getProviderConfig(provider: string): ProviderConfig {
    const config = this.providers.get(provider);
    if (!config) throw new Error(`Provider ${provider} not registered`);
    return config;
  }

  getAvailableProviders(): ProviderInfo[] {
    return Array.from(this.providers.values()).map((config) => ({
      name: config.provider,
      displayName: config.provider, // Could be enhanced with a display name field
      supportedEntities: Object.keys(config.entityMappings),
      authType: config.authentication.type,
    }));
  }

  private async loadProviderConfig(
    _configPath: string,
  ): Promise<ProviderConfig> {
    // Placeholder implementation - would load from JSON file
    throw new Error("loadProviderConfig not implemented");
  }

  private async createAdapter(
    config: ProviderConfig,
  ): Promise<ProviderAdapter> {
    // Factory method to create appropriate adapter based on provider
    switch (config.provider) {
      case "statuspage.io":
        const { StatuspageProvider } = await import(
          "./providers/statuspage-provider"
        );
        return new StatuspageProvider(config);
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }
}
