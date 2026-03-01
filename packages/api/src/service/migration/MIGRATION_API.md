# Migration API Implementation

This document describes the complete migration API implementation for migrating status page users from other providers (like Statuspage.io) to OpenStatus.

## Overview

The migration system consists of:

1. **Migration Router** (`/src/router/migration.ts`) - tRPC API endpoints
2. **Migration API Service** (`/src/service/migration/migration-api-service.ts`) - High-level API operations
3. **Migration Service** (`/src/service/migration/migration-service.ts`) - Core migration logic
4. **Provider System** - Pluggable provider adapters for different services
5. **Data Transformer** - Maps data between provider formats and OpenStatus schema

## API Endpoints

### Provider Discovery
```typescript
// Get available migration providers
await api.migration.getProviders();
```

### Authentication & Setup
```typescript
// Test provider credentials
await api.migration.testAuth({
  provider: "statuspage.io",
  credentials: { apiKey: "your-api-key" }
});

// Start migration process
await api.migration.start({
  provider: "statuspage.io",
  credentials: { apiKey: "your-api-key" },
  workspaceId: 123
});
```

### Data Management
```typescript
// Get migration job status
await api.migration.status({ jobId: "job_123" });

// Preview data before migration
await api.migration.previewData({ jobId: "job_123" });

// Update selection of what to migrate
await api.migration.updateSelection({
  jobId: "job_123",
  selection: {
    statusPages: { selectedIds: ["1", "2"], selectAll: false },
    monitors: { selectedIds: ["3"], selectAll: false },
    components: { selectedIds: [], selectAll: false },
    incidents: { selectedIds: [], selectAll: false },
    maintenance: { selectedIds: [], selectAll: false }
  }
});
```

### Migration Execution
```typescript
// Validate migration (check for conflicts)
await api.migration.validate({ jobId: "job_123" });

// Execute the migration
await api.migration.execute({ jobId: "job_123" });

// Get real-time progress
await api.migration.progress.subscribe({ jobId: "job_123" });
```

## Database Schema

The migration system uses two main database tables:

### Migration Jobs (`migration_job`)
- Stores overall migration job information
- Tracks status, progress, and configuration
- Links to workspace and provider

### Migration Entities (`migration_entity`)
- Tracks individual items being migrated
- Records status (pending, completed, failed, skipped)
- Maps source IDs to target IDs

## Migration Flow

1. **Discovery**: User selects provider and authenticates
2. **Data Fetching**: System fetches all available data from provider
3. **Preview**: User reviews what's available for migration
4. **Selection**: User chooses which items to migrate
5. **Validation**: System checks for conflicts and issues
6. **Execution**: System migrates selected items
7. **Completion**: User receives summary of migration results

## Data Transformation

The system includes a sophisticated data transformation layer:

- **Field Mapping**: Maps provider field names to OpenStatus schema
- **Type Conversion**: Converts data types and formats
- **Status Mapping**: Maps status values between systems
- **Validation**: Ensures data meets OpenStatus requirements

## Error Handling

The system includes comprehensive error handling:

- **Authentication Errors**: Invalid credentials, provider unavailable
- **Data Errors**: Missing required fields, invalid formats
- **Migration Errors**: Database failures, constraint violations
- **Network Errors**: Provider API failures, timeouts

## Testing

The implementation includes comprehensive tests:

- Unit tests for individual components
- Integration tests for API endpoints
- Mock providers for testing scenarios
- Error condition testing

## Usage Example

```typescript
// Complete migration flow
async function migrateFromStatuspage(apiKey: string, workspaceId: number) {
  try {
    // 1. Test authentication
    const authResult = await api.migration.testAuth({
      provider: "statuspage.io",
      credentials: { apiKey }
    });
    
    if (!authResult.success) {
      throw new Error("Authentication failed");
    }

    // 2. Start migration
    const migration = await api.migration.start({
      provider: "statuspage.io",
      credentials: { apiKey },
      workspaceId
    });

    // 3. Preview data
    const preview = await api.migration.previewData({
      jobId: migration.data.migrationJob.id
    });

    // 4. Select items to migrate (example: migrate all status pages)
    await api.migration.updateSelection({
      jobId: migration.data.migrationJob.id,
      selection: {
        statusPages: { 
          selectedIds: preview.data.statusPages.map(p => p.id), 
          selectAll: false 
        },
        monitors: { selectedIds: [], selectAll: false },
        components: { selectedIds: [], selectAll: false },
        incidents: { selectedIds: [], selectAll: false },
        maintenance: { selectedIds: [], selectAll: false }
      }
    });

    // 5. Validate migration
    const validation = await api.migration.validate({
      jobId: migration.data.migrationJob.id
    });

    if (validation.data.conflicts.length > 0) {
      console.warn("Migration conflicts detected:", validation.data.conflicts);
    }

    // 6. Execute migration
    await api.migration.execute({
      jobId: migration.data.migrationJob.id
    });

    // 7. Monitor progress
    const progress = await api.migration.progress.subscribe({
      jobId: migration.data.migrationJob.id
    });

    for await (const update of progress) {
      console.log(`Migration progress: ${update.progress}%`);
      if (update.status === "completed") {
        console.log("Migration completed successfully!");
        break;
      }
    }

  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}
```

## Provider Support

Currently supports:

- **Statuspage.io** - Full migration support
- **Better Stack** - Full migration support  
- **Instatus** - Full migration support
- **Uptime Kuma** - Partial support
- **Cachet** - Partial support
- **Checkly** - Limited support
- **Status.io** - Limited support
- **Incident.io** - Limited support

## Extending Support

To add support for a new provider:

1. Create a provider adapter extending `BaseProvider`
2. Implement required methods (authenticate, fetch* methods)
3. Add provider configuration to registry
4. Add data transformation mappings
5. Write tests for the new provider

## Security Considerations

- API keys are encrypted in database storage
- Credentials are never exposed in API responses
- Migration jobs are workspace-scoped
- All operations require authentication
- Rate limiting applied to provider API calls
