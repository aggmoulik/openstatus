// Migration Service Tests - Main Entry Point
// This file imports and runs all migration-related test modules

import "./test-utils";
import "./data-transformation.test";
import "./data-transformer-fixed.test";
import "./migration-api-service.test";
import "./migration-api-simple.test";
import "./migration-api-basic.test";
import "./migration-e2e.test";
import "./migration-service.test";

// The test files are organized as follows:
// - test-utils.ts: Shared utilities, helper functions, and test data factories
// - data-transformation.test.ts: Tests for data transformation between provider formats
// - data-transformer-fixed.test.ts: Fixed tests for data transformer implementation
// - migration-api-service.test.ts: Comprehensive API tests
// - migration-api-simple.test.ts: Simplified API tests
// - migration-api-basic.test.ts: Basic API functionality tests
// - migration-e2e.test.ts: End-to-end workflow tests
// - migration-service.test.ts: Core migration service tests

// This modular approach provides:
// 1. Better code organization and readability
// 2. Easier maintenance and debugging
// 3. Clear separation of concerns for different migration components
// 4. Comprehensive test coverage for the migration system
// 5. Reusable test utilities and data factories

// Migration System Overview:
// - MigrationService: Orchestrates the entire migration process
// - DataTransformer: Transforms data between provider and OpenStatus formats
// - ProviderRegistry: Manages available migration providers
// - MigrationAPIService: High-level API for migration operations

// Test Coverage Areas:
// 1. Service orchestration and job management
// 2. Provider authentication and credential validation
// 3. Data transformation and field mapping
// 4. Provider registration and adapter creation
// 5. API endpoint testing
// 6. Error handling and edge cases
// 7. Integration testing across components
// 8. End-to-end workflow validation
