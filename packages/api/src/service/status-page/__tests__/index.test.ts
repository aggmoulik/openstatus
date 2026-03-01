// Status Page Service Tests - Main Entry Point
// This file imports and runs all status page test modules

import "./test-utils";
import "./page-crud.test";
import "./component-management.test";
import "./component-groups.test";
import "./subscriber-management.test";
import "./status-content.test";
import "./page-access-users.test";
import "./page-access-groups.test";
import "./metrics.test";
import "./incident-management.test";
import "./template-management.test";

// The test files are organized as follows:
// - test-utils.ts: Shared utilities, helper functions, and test data setup
// - page-crud.test.ts: Tests for Create, Get, List, Update, Delete status pages
// - component-management.test.ts: Tests for Add, Remove, Update monitor and static components
// - component-groups.test.ts: Tests for Create, Update, Delete component groups
// - subscriber-management.test.ts: Tests for Subscribe, Unsubscribe, List subscribers
// - status-content.test.ts: Tests for GetStatusPageContent, GetOverallStatus
// - page-access-users.test.ts: Tests for page access user management
// - page-access-groups.test.ts: Tests for page access group management
// - metrics.test.ts: Tests for metrics data submission and retrieval
// - incident-management.test.ts: Tests for incident creation, updates, and subscriber management
// - template-management.test.ts: Tests for incident template creation and management

// This modular approach provides:
// 1. Better code organization and readability
// 2. Easier maintenance and debugging
// 3. Reusable test utilities
// 4. Clear separation of concerns
// 5. Simplified test file navigation

// Status Page System Overview:
// - Page CRUD: Create, Read, Update, Delete operations for status pages
// - Component Management: Add, remove, and update page components (monitor and static)
// - Component Groups: Create, update, and delete component groups
// - Subscriber Management: Subscribe, unsubscribe, and list page subscribers
// - Status & Content: Retrieve page content and overall status
// - Page Access Control: User and group-based access restrictions
// - Metrics: System metrics data submission and retrieval
// - Incident Management: Create, update, and manage incidents with subscribers
// - Templates: Create and manage incident templates

// Test Coverage Areas:
// 1. Authentication and authorization
// 2. Input validation and error handling
// 3. Database operations and relationships
// 4. Access control (public, private, password-protected)
// 5. Status report integration
// 6. Component and group management
// 7. Subscriber lifecycle management
// 8. Page access user and group management
// 9. Metrics data submission and validation
// 10. Incident creation, updates, and template management
// 11. Real-time notifications and subscriber management
