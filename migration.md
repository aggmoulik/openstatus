# OpenStatus Migration Importer Strategy
## Comprehensive Guide to Building Competitor Data Migration Features

---

## Executive Summary

OpenStatus operates in a competitive market with established players. Building a seamless migration importer for competitor platforms is a critical growth lever that can accelerate customer adoption, reduce onboarding friction, and directly impact activation rates and retention. This document outlines OpenStatus's competitive landscape, identifies key data entities requiring migration, and provides a detailed product flow for implementation.

---

## Part 1: Competitive Landscape Analysis

### Primary Competitors

OpenStatus's main competitors fall into three categories:

#### **Category 1: Enterprise Status Page Solutions**
- **Statuspage.io (Atlassian)** - Market leader, high-cost option ($29-$1,499/month)
- **Better Stack** - All-in-one monitoring + incident management + status pages
- **Instatus** - Beautiful status pages, $15-$300/month

#### **Category 2: Developer-First Monitoring**
- **Checkly** - Browser, API, TCP monitoring with status pages
- **Uptime Kuma** - Free, self-hosted alternative
- **Cachet** - Open-source, self-hosted

#### **Category 3: Specialized Incident/Monitoring**
- **Incident.io** - Slack-native incident management
- **Hyperping** - Flat-rate monitoring + status pages + on-call
- **Status.io** - Multi-region status page platform
- **Cronitor** - Cron job & heartbeat monitoring

#### **Category 4: Emerging Alternatives**
- **Hydrozen.io** - Uptime + status pages
- **IsDown.app** - Status aggregator
- **Pagerly** - On-calls + incident response
- **PingPong** - Incident + certificate monitoring

### Why This Matters

With multiple established competitors, OpenStatus's acquisition strategy should emphasize migration ease as a competitive advantage. Users are most likely to switch when:
1. Existing platform pricing increases
2. Feature gaps become apparent
3. Support quality deteriorates
4. Billing/contract renewal events occur

A frictionless migration importer removes the biggest barrier to switching: data portability anxiety.

---

## Part 2: Data Entity Mapping for Migration

### Core Entities to Migrate

#### **1. Status Pages**
**Source Data:**
- Page name, slug, description
- Public/Private status
- Custom domain
- Theme/branding settings
- Logo, colors, font customization
- Custom CSS (if available)
- Language/localization settings
- Visibility settings (public/password-protected)

**Target OpenStatus Fields:**
- Workspace name
- Status page metadata
- Custom domain configuration
- Theme selection from Theme Store
- Branding configuration
- Access control settings

**Migration Considerations:**
- Custom CSS may not be directly transferable; flag for manual review
- Password-protected pages need credential re-entry
- Design themes may require theme selection from OpenStatus Theme Store

---

#### **2. Monitors/Checks**
**Source Data:**
- Monitor name, description, URL/endpoint
- Monitoring type (HTTP, API, TCP, DNS, SSL, Keyword, CRON, Ping)
- Check interval (frequency)
- Timeout settings
- Request headers, body, method
- Assertion rules (status codes, body content, regex)
- Threshold settings
- Regions/locations (if supported)
- Enabled/disabled status
- Monitor groups/tags

**Target OpenStatus Fields:**
- Monitor metadata
- Endpoint URL
- Check frequency
- Assertions (status, headers, body validation)
- Thresholds for slowness detection
- Regions (from OpenStatus's 28-region setup)
- Alert configuration

**Migration Considerations:**
- Map source check frequencies to OpenStatus's minimum (10-minute on free, 30s on paid)
- Region mapping: source regions → closest OpenStatus regions
- Advanced assertions may need manual reconfiguration
- YAML-based monitoring as code should be preserved

---

#### **3. Incidents/Incidents History**
**Source Data:**
- Incident title, description, status (investigating/identified/monitoring/resolved)
- Severity/impact level
- Created timestamp, start time, end time
- Component(s) affected
- Updates/timeline entries
- Affected status page
- Incident templates
- Resolution notes

**Target OpenStatus Fields:**
- Incident title, description
- Status mapping
- Timestamps (start, resolved)
- Affected components
- Incident updates timeline
- Associated status page

**Migration Considerations:**
- Historical incident data is valuable for SLA calculations
- Need to preserve incident timeline for audit trails
- Severity levels may differ between platforms (map intelligently)
- Dependent on component migration success

---

#### **4. Components/Services**
**Source Data:**
- Component name, description
- Dependency hierarchy (parent/child relationships)
- Status (operational/degraded/major outage/maintenance)
- Order/grouping
- Component metadata

**Target OpenStatus Fields:**
- Component configuration
- Display order
- Status mapping
- Relationships/grouping

**Migration Considerations:**
- Component hierarchy may not map 1:1
- Preserve display order for consistent UX
- Status should align with current operational status

---

#### **5. Alert Channels & Notifications**
**Source Data:**
- Channel type (Email, Slack, Discord, Teams, SMS, Phone, Webhook, PagerDuty, etc.)
- Channel credentials/endpoints
- Notification preferences (alert on incidents, maintenance, all updates)
- Subscriber lists
- Email notification templates

**Target OpenStatus Fields:**
- Notification channel configuration
- Integration settings (Slack workspace, Discord channel, etc.)
- Webhook endpoints
- Email/SMS gateway settings

**Migration Considerations:**
- Re-authentication required for most channels (Slack, Discord, etc.)
- Subscriber lists cannot be imported; must be re-collected (privacy/GDPR)
- Custom email templates may have limited support
- Some channel types may not be supported (map to closest alternative)

---

#### **6. Maintenance Windows/Scheduled Updates**
**Source Data:**
- Maintenance window title, description
- Scheduled start/end time
- Affected components
- Maintenance type (planned maintenance, scheduled update)
- Status (scheduled/in progress/completed)
- Update messages

**Target OpenStatus Fields:**
- Maintenance window metadata
- Scheduled dates
- Affected components
- Visibility settings

**Migration Considerations:**
- Only future maintenance windows should be migrated
- Past maintenance can be preserved for audit purposes
- Component associations must be preserved

---

#### **7. Team & Access Control**
**Source Data:**
- Team members, roles, permissions
- Invite status
- SSO/SAML configuration (if enterprise)
- Two-factor authentication settings

**Target OpenStatus Fields:**
- Team member invitations
- Role-based access control
- Workspace settings

**Migration Considerations:**
- Cannot migrate password hashes; users must reset passwords
- Re-authenticate team members in new system
- SSO may require separate enterprise setup
- Permissions may need manual role mapping

---

### Data Migration Priority Matrix

| Entity | Priority | Complexity | Customer Impact |
|--------|----------|------------|-----------------|
| Status Pages | HIGH | Low | Critical for immediate value |
| Components | HIGH | Medium | Required for monitor functionality |
| Monitors | HIGH | High | Core product value delivery |
| Incidents History | MEDIUM | Medium | Nice-to-have for audit/SLA |
| Maintenance Windows | MEDIUM | Low | Useful historical reference |
| Alert Channels | MEDIUM | High | Re-auth required; limited automation |
| Subscriber Lists | LOW | N/A | Cannot be auto-migrated (privacy) |
| Team Members | MEDIUM | Low | Manual re-invitation process |

---

## Part 3: Product Flow Design

### Migration Journey - High-Level Flow

```
User Signs Up → Sees Migration Prompt → Selects Source → Authorizes Access → 
Previews Data → Maps Entities → Reviews Conflicts → Executes Migration → 
Verifies Results → Completes Setup
```

### Detailed UX/UI Flow

#### **Phase 1: Discovery & Onboarding**

**Step 1.1: Sign-Up / Post-Sign-Up Decision Point**
- User creates OpenStatus account
- Immediately after email verification, show "Import Data from Existing Provider?" modal
- Offer options: "Yes, I'm switching providers" | "Start Fresh" | "I'll do this later"
- Make this dismissible but persistent (show in onboarding checklist)

```
┌─────────────────────────────────────────┐
│  Welcome to OpenStatus!                 │
├─────────────────────────────────────────┤
│                                         │
│  Would you like to import your data     │
│  from another status page provider?     │
│                                         │
│  [Yes, Import Data] [Start Fresh]       │
│                                         │
│  ✕ I'll do this later                  │
│                                         │
└─────────────────────────────────────────┘
```

**Benefits of Early Migration Prompt:**
- Captures user intent immediately while motivation is highest
- Removes friction from future data import
- Signals that OpenStatus values user data portability

---

#### **Phase 2: Source Provider Selection**

**Step 2.1: Provider Selection Screen**
- Display card-based UI with all supported providers
- Order by popularity (Statuspage.io, Better Stack, Instatus, Uptime Kuma)
- Show migration compatibility badges (Full, Partial, Limited)
- Include provider logos and brief descriptions
- "Can't find your provider?" → suggest custom import options

```
┌──────────────────────────────────────────────────────┐
│  Select Your Current Provider                        │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌─────────────────┐  ┌─────────────────┐           │
│  │ Statuspage.io   │  │ Better Stack    │           │
│  │ [FULL SUPPORT]  │  │ [FULL SUPPORT]  │           │
│  │ Migrate →       │  │ Migrate →       │           │
│  └─────────────────┘  └─────────────────┘           │
│                                                      │
│  ┌─────────────────┐  ┌─────────────────┐           │
│  │ Instatus        │  │ Uptime Kuma     │           │
│  │ [FULL SUPPORT]  │  │ [FULL SUPPORT]  │           │
│  │ Migrate →       │  │ Migrate →       │           │
│  └─────────────────┘  └─────────────────┘           │
│                                                      │
│  ┌─────────────────┐  ┌─────────────────┐           │
│  │ Checkly         │  │ Status.io       │           │
│  │ [PARTIAL]       │  │ [PARTIAL]       │           │
│  │ Migrate →       │  │ Migrate →       │           │
│  └─────────────────┘  └─────────────────┘           │
│                                                      │
│  ┌────────────────────────────────────┐             │
│  │ Don't see your provider?            │             │
│  │ We support 10+ platforms            │             │
│  │ [View All] [Use CSV Import]         │             │
│  └────────────────────────────────────┘             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Implementation Details:**
- Display compatibility level with icon + tooltip explaining what's included
- Sort providers by popularity + alignment with user's choice
- Consider lazy-loading provider details
- Include "Learn what data migrates" help icon for each provider

---

#### **Phase 3: Authentication & Authorization**

**Step 3.1: API Key/OAuth Entry**
Different authentication based on provider:

**Option A: OAuth (Best UX)**
- For providers with OAuth support (Slack, Discord, etc.)
- "Click to authorize with [Provider]" button
- Opens OAuth flow in modal
- Returns with user's permission
- Automatically retrieves API token

```
┌──────────────────────────────────────────────────────┐
│  Connect Your Statuspage.io Account                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  We need permission to read your status pages,       │
│  monitors, and incidents.                            │
│                                                      │
│  [🔗 Authorize with Statuspage.io]                   │
│                                                      │
│  This will only read your data. We never store       │
│  your password.                                      │
│                                                      │
│  [Learn more about security]                         │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Option B: API Key (Fallback)**
- For providers without OAuth (Uptime Kuma, self-hosted)
- User provides API key/token
- Display paste field with validation
- Show where to find their API key (link to provider docs)

```
┌──────────────────────────────────────────────────────┐
│  Enter Your Uptime Kuma API Credentials              │
├──────────────────────────────────────────────────────┤
│                                                      │
│  API Endpoint:                                       │
│  [https://uptime-kuma.example.com]                   │
│                                                      │
│  API Key:                                            │
│  [••••••••••••••••••••••••••••••••••••••]             │
│                                                      │
│  [Where to find your API key?]                       │
│                                                      │
│  [Test Connection]  [Next]                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Validation:**
- On "Test Connection" click, validate credentials immediately
- Show loading state with spinner
- Success: "✓ Connected to [Provider]"
- Error: Clear error message + recovery steps
- Rate-limit handling: "Too many attempts. Try again in 2 minutes."

---

#### **Phase 4: Data Preview & Selection**

**Step 4.1: Import Preview Screen**
After authentication, display discoverable data:

```
┌──────────────────────────────────────────────────────┐
│  Review Data to Import                               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  We found the following data in your account:        │
│                                                      │
│  📄 Status Pages                                     │
│     ☑ Main Status Page                    5 monitors│
│     ☑ Internal Dashboard                  3 monitors│
│     ☐ Archived Status Page                0 monitors│
│     [+2 more]                                        │
│                                                      │
│  📊 Monitors                                         │
│     Total: 12                                        │
│     ☑ All monitors selected for import               │
│     [Customize selection]                            │
│                                                      │
│  🔔 Notification Channels                            │
│     Email: 3                                         │
│     Slack: 1                                         │
│     Discord: 1                                       │
│     ⚠ Note: You'll need to re-authorize Slack/Discord│
│                                                      │
│  📋 Maintenance Windows                              │
│     Future: 2                                        │
│     Historical: 45                                   │
│     ☑ Import future maintenance windows              │
│     ☑ Import maintenance history                     │
│                                                      │
│  [Advanced Options]  [Next]                          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Interactive Features:**
- Collapsible sections for each entity type
- Checkboxes to select/deselect items (granular control)
- Item counts for quick reference
- Warnings for items that require special attention (re-auth, mapping, etc.)
- Preview individual items (click to expand)
- "Customize selection" for power users who want granular control

**Step 4.2: Detailed Entity Preview (Optional)**
Allow users to click entities for detailed view:

```
┌──────────────────────────────────────────────────────┐
│  Status Pages - Detailed Preview                     │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Name: Main Status Page                              │
│  URL: status.example.com                             │
│  Public: Yes                                         │
│  Components: 5                                       │
│  Monitors: 12                                        │
│  Recent Incidents: 3                                 │
│                                                      │
│  [View Monitors]  [Back]                             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

#### **Phase 5: Data Mapping & Conflict Resolution**

**Step 5.1: Advanced Mapping (Conditional)**
Only show if conflicts detected or user has multi-status-page setup:

```
┌──────────────────────────────────────────────────────┐
│  Configure Component & Monitor Mapping                │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Your account has 2 status pages. Map components     │
│  from your source system to the correct page:        │
│                                                      │
│  Status Page Mapping:                                │
│  ──────────────────────                              │
│  "Main Status Page" → [Select target page ▼]         │
│                         • Acme Corp Dashboard         │
│                         • Create new page            │
│                                                      │
│  "Internal Dashboard" → [Select target page ▼]       │
│                         • Internal Monitoring        │
│                         • Create new page            │
│                                                      │
│  Notification Channel Mapping:                       │
│  ────────────────────────────                        │
│  "Slack: #ops-alerts" → [Re-auth Slack]              │
│  "Email: alerts@..." → [Keep as Email]               │
│                                                      │
│  [Conflict Report]  [Next]                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Conflict Detection Algorithm:**
- Check for duplicate monitors (same URL + check frequency)
- Check for naming collisions (same component in same workspace)
- Check for unsupported features (custom assertions, etc.)
- Flag "risky" mappings (will override existing data)
- Provide suggestions for resolution

**Conflict Report:**
```
⚠ Potential Issues Found:

1. Duplicate Monitor Detected
   • "API Health Check" exists in both systems
   • Action: Skip existing, Merge, or Replace
   [Merge]

2. Unsupported Feature
   • Custom HTTP header validation not supported in OpenStatus
   • Action: Continue without this assertion
   [Continue]

3. Namespace Collision
   • Component "Database" already exists
   • Action: Rename to "Database (Imported)", Replace, Skip
   [Rename]
```

---

#### **Phase 6: Review & Confirmation**

**Step 6.1: Migration Summary**
Final review before execution:

```
┌──────────────────────────────────────────────────────┐
│  Review Migration Plan                               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  From: Statuspage.io (prod-monitoring)               │
│  To:   OpenStatus Workspace                          │
│                                                      │
│  📋 Migration Summary                                │
│  ─────────────────────────                           │
│  Status Pages:           2 ✓                         │
│  Monitors:              12 ✓                         │
│  Components:             8 ✓                         │
│  Incidents (historical): 24 (read-only)              │
│  Maintenance Windows:     3 ✓                        │
│  Notification Channels:   3 (2 need re-auth)         │
│                                                      │
│  ⏱ Estimated time:  2-5 minutes                      │
│                                                      │
│  📌 What to expect:                                  │
│  • Your status pages will be live immediately        │
│  • Monitors will start checking in ~30 seconds       │
│  • Historical incidents will be displayed            │
│  • You'll need to re-authorize Slack integration     │
│                                                      │
│  [Review Conflicts] [Previous] [Migrate Now]         │
│                                                      │
│  ☐ I understand this will create duplicate data     │
│      if I don't delete the source system             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

#### **Phase 7: Migration Execution**

**Step 7.1: Progress Screen**
Real-time progress with detailed status:

```
┌──────────────────────────────────────────────────────┐
│  Importing Your Data...                              │
├──────────────────────────────────────────────────────┤
│                                                      │
│  📄 Status Pages           [████████░░] 2/2 Complete │
│     • Main Status Page                        ✓      │
│     • Internal Dashboard                      ✓      │
│                                                      │
│  📊 Monitors               [██░░░░░░░░] 3/12 Running │
│     • API Health Check                        ✓      │
│     • Database Connection                     ✓      │
│     • Frontend Load Time                ⏳ In progress│
│     • [8 more queued]                                │
│                                                      │
│  🔔 Notification Channels  [████████░░] 2/3 Complete │
│     • Email alerts                            ✓      │
│     • Slack #ops-alerts                ⏳ Waiting    │
│       (requires re-auth)                             │
│     • Discord #status                         ⏳     │
│                                                      │
│  📋 Incidents              [██████░░░░] 18/24        │
│                                                      │
│  ✓ Success! Imported 2 status pages, 12 monitors    │
│                                                      │
│  ⏱ Completed in 3 minutes 45 seconds                │
│                                                      │
│  ⚠ Action Required:                                  │
│  • Re-authorize Slack/Discord for notifications     │
│  • Verify 3 monitors that failed                     │
│                                                      │
│  [Re-auth Slack] [Review Failures] [Get Started]     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Key Features:**
- Live progress updates (websocket or polling)
- Visual progress bars per entity type
- Expandable sections to see individual item status
- Immediate error surfacing with troubleshooting steps
- Ability to dismiss and proceed even with non-critical failures

---

#### **Phase 8: Post-Migration Setup**

**Step 8.1: Re-Authorization of Real-Time Channels**
Some integrations require fresh authentication:

```
┌──────────────────────────────────────────────────────┐
│  Complete Your Setup                                 │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Almost done! Finish these 2 quick steps:            │
│                                                      │
│  🔴 Required                                         │
│  ──────────                                          │
│  ☐ Authorize Slack for real-time alerts              │
│    [Connect Slack Workspace]                         │
│                                                      │
│  ☐ Authorize Discord for notifications               │
│    [Connect Discord Server]                          │
│                                                      │
│  🟡 Recommended                                      │
│  ──────────────                                      │
│  ☐ Add team members (5 currently imported)           │
│    [Invite Team]                                     │
│                                                      │
│  ☐ Test a monitor alert                              │
│    [Run Test Alert]                                  │
│                                                      │
│  [Skip] [Complete Setup]                             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Step 8.2: Success & Dashboard Handoff**
After completing post-migration, welcome user to dashboard:

```
┌──────────────────────────────────────────────────────┐
│  🎉 Migration Complete!                              │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Your data is now live on OpenStatus.                │
│                                                      │
│  ✓ 2 status pages imported                           │
│  ✓ 12 monitors active & checking                     │
│  ✓ 3 notification channels configured                │
│  ✓ 24 historical incidents loaded                    │
│                                                      │
│  📍 Next Steps:                                      │
│  1. Visit your status page: example.openstatus.app   │
│  2. Configure custom domain (if needed)              │
│  3. Review monitor thresholds                        │
│  4. Add team members                                 │
│                                                      │
│  [View Dashboard] [Go to Status Page] [Learn More]   │
│                                                      │
│  💡 Tip: Check out our Guides to customize your     │
│  monitoring setup and get the most from OpenStatus. │
│                                                      │
│  [Dismiss]                                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

### Error Handling & Recovery

**Step 8.3: Failure Handling**

When migration encounters errors, provide clear recovery paths:

```
┌──────────────────────────────────────────────────────┐
│  ⚠ Migration Issue                                   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  3 monitors failed to import:                        │
│                                                      │
│  1. Internal VPN Check                               │
│     Error: Endpoint not publicly accessible          │
│     Action: Create as private location monitor       │
│     [Setup Private Location]                         │
│                                                      │
│  2. Custom API Schema Validation                     │
│     Error: Complex JSON assertion not supported      │
│     Action: Simplify assertion rules manually        │
│     [Edit Monitor] [Skip]                            │
│                                                      │
│  3. Legacy Health Check (Deprecated)                 │
│     Error: Endpoint returned 410 Gone                │
│     Action: This endpoint is offline. Skip import?   │
│     [Skip] [Import Anyway]                           │
│                                                      │
│  Migration Status: 9/12 monitors imported            │
│                                                      │
│  [Try Again] [Contact Support] [Continue]            │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Part 4: Technical Implementation Guide

### Backend Architecture

#### **Migration Service Components**

```
┌─────────────────────────────────────────┐
│     Migration Controller                │
│  (Handles orchestration & state)         │
└────────────┬────────────────────────────┘
             │
    ┌────────┴────────┬────────────────┐
    │                 │                │
    ▼                 ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Provider    │  │ Data        │  │ Conflict    │
│ Adapters    │  │ Mappers     │  │ Detector    │
└─────────────┘  └─────────────┘  └─────────────┘
    │                 │                │
    │ (Retrieves)    │ (Transforms)   │ (Validates)
    │                 │                │
    ▼                 ▼                ▼
┌─────────────────────────────────────────┐
│     OpenStatus API Service              │
│  (Creates entities in target workspace) │
└─────────────────────────────────────────┘
```

#### **Supported Providers & Adapters**

Create provider-specific adapters following a factory pattern:

```typescript
// Example structure
interface ProviderAdapter {
  authenticate(credentials: ProviderCredentials): Promise<AuthToken>;
  fetchStatusPages(): Promise<StatusPageData[]>;
  fetchMonitors(): Promise<MonitorData[]>;
  fetchComponents(): Promise<ComponentData[]>;
  fetchIncidents(): Promise<IncidentData[]>;
  fetchNotificationChannels(): Promise<ChannelData[]>;
  fetchMaintenanceWindows(): Promise<MaintenanceData[]>;
}

class StatusPageIOAdapter implements ProviderAdapter { /* ... */ }
class BetterStackAdapter implements ProviderAdapter { /* ... */ }
class InstastusAdapter implements ProviderAdapter { /* ... */ }
class UptimeKumaAdapter implements ProviderAdapter { /* ... */ }
class ChecklyAdapter implements ProviderAdapter { /* ... */ }
```

#### **Data Validation & Conflict Detection**

```typescript
class MigrationValidator {
  validateMonitors(monitors: MonitorData[], workspace: Workspace): ValidationResult;
  detectDuplicates(monitors: MonitorData[]): Duplicate[];
  detectConflicts(sourceData: MigrationData, targetWorkspace: Workspace): Conflict[];
  generateMigrationReport(validation: ValidationResult): MigrationReport;
}
```

### Frontend Architecture

#### **State Management**
Use a multi-step form state machine:

```typescript
enum MigrationStep {
  PROVIDER_SELECTION = 'provider_selection',
  AUTHENTICATION = 'authentication',
  DATA_PREVIEW = 'data_preview',
  MAPPING = 'mapping',
  REVIEW = 'review',
  MIGRATION = 'migration',
  POST_SETUP = 'post_setup',
  COMPLETE = 'complete'
}

interface MigrationState {
  currentStep: MigrationStep;
  provider: Provider;
  credentials: ProviderCredentials;
  previewData: MigrationData;
  selectedEntities: EntitySelection;
  mappingConfig: MappingConfig;
  migrationProgress: MigrationProgress;
  errors: MigrationError[];
}
```

#### **Component Structure**
```
MigrationWizard
├── ProviderSelector
├── AuthenticationForm
├── DataPreview
│   ├── EntitySelector
│   └── DetailView
├── MappingConfiguration
│   ├── StatusPageMapper
│   ├── ComponentMapper
│   └── ChannelMapper
├── ReviewScreen
│   └── ConflictResolver
├── MigrationProgress
│   ├── ProgressBar
│   ├── DetailedLog
│   └── ErrorHandler
├── PostSetupWizard
│   ├── ChannelReAuth
│   └── TeamInvitation
└── SuccessScreen
```

### API Endpoints

```
POST   /api/migrations                      # Start new migration
GET    /api/migrations/:id                  # Get migration status
PATCH  /api/migrations/:id                  # Update migration config
DELETE /api/migrations/:id                  # Cancel migration
POST   /api/migrations/:id/execute          # Start data transfer
GET    /api/migrations/:id/progress         # Real-time progress
POST   /api/migrations/:id/validate         # Validate before migration
GET    /api/migrations/:id/report           # Get migration report
POST   /api/providers/:provider/test-auth   # Test credentials
POST   /api/providers/:provider/data-preview # Preview available data
```

### Data Mapping Templates

For each provider, define transformation rules:

```json
{
  "provider": "statuspage.io",
  "fieldMappings": {
    "statusPages": {
      "source": "page",
      "fields": {
        "name": "name",
        "slug": "slug",
        "description": "description",
        "statusIndicator": "status_indicator",
        "publicOnly": "public_only"
      }
    },
    "monitors": {
      "source": "check",
      "fields": {
        "name": "name",
        "url": "url",
        "checkType": { "source": "check_type", "transform": "mapCheckType" },
        "interval": { "source": "period", "transform": "mapInterval" },
        "timeout": "timeout",
        "regions": { "source": "regions", "transform": "mapRegions" }
      }
    }
  },
  "transformFunctions": {
    "mapCheckType": "function to convert source check type to OpenStatus type",
    "mapInterval": "function to ensure interval meets minimum requirements",
    "mapRegions": "function to map source regions to OpenStatus regions"
  }
}
```

---

## Part 5: Implementation Roadmap

### Phase 1: MVP (2-4 weeks)
- [ ] Statuspage.io adapter (most popular competitor)
- [ ] Basic data preview
- [ ] Monitor import with assertions
- [ ] Status page import
- [ ] Basic conflict detection
- [ ] Simple UI flow

### Phase 2: Expansion (Weeks 5-8)
- [ ] Better Stack adapter
- [ ] Instatus adapter
- [ ] Component/service import
- [ ] Notification channel mapping
- [ ] Advanced mapping UI
- [ ] Error recovery flows

### Phase 3: Maturity (Weeks 9-12)
- [ ] Uptime Kuma adapter
- [ ] Checkly adapter
- [ ] Status.io, Cachet adapters
- [ ] Historical incident import
- [ ] Maintenance window import
- [ ] Team member import
- [ ] Enterprise white-glove support

### Phase 4: Optimization (Weeks 13+)
- [ ] Performance optimization for large datasets
- [ ] Automated re-sync capability
- [ ] Rollback functionality
- [ ] Advanced analytics on migration success
- [ ] Customer feedback loop & iteration

---

## Part 6: Success Metrics

### Primary Metrics
- **Migration Conversion Rate**: % of new users who complete migration
- **Time to Value**: Hours from sign-up to first active monitor
- **Data Completeness**: % of entities successfully migrated
- **User Satisfaction**: NPS/CSAT for migration experience

### Secondary Metrics
- **Churn Reduction**: Improvement in retention for migrated users
- **Feature Adoption**: Usage of imported features post-migration
- **Support Tickets**: Reduction in migration-related support requests
- **Provider Market Share**: Customer distribution across competitor adoptions

### Targets
- 40-50% of eligible new users attempt migration (vs. 10-15% estimated for manual import)
- 85%+ migration success rate (completion without critical errors)
- <10 minutes median migration time for typical setup
- 90%+ data preservation rate across entity types
- NPS of 50+ for migration experience

---

## Part 7: Competitive Advantages

### Why This Migration Feature Matters

1. **Removes Switching Costs**: Eliminates the largest barrier to adoption (data portability)
2. **Fast Activation**: Reduces onboarding from days to minutes
3. **Builds Trust**: Demonstrates commitment to customer data and open standards
4. **Market Differentiation**: Most competitors lack easy migration paths
5. **Network Effect**: Easier switching → more customers try → positive reviews → growth

### Messaging Strategy

**For Sales/Marketing:**
> "Switch from [Competitor] to OpenStatus in minutes, not days. Import your entire setup—status pages, monitors, components, and history—with a single click. No data loss. No manual setup. Just seamless migration."

**For Technical Users:**
> "Fully automated data migration with conflict detection, advanced mapping options, and complete audit trails. Built for enterprises that refuse to lose data during platform transitions."

**For Product Page:**
> "Stop wasting engineering time on data migration. Our intelligent import system handles the complexity, validates your data, and gets you live faster than you can blink."

---

## Part 8: Conclusion

Building a comprehensive migration importer positions OpenStatus as a customer-first platform that values user choice and data freedom. By removing the friction of switching platforms, OpenStatus can accelerate growth, improve retention, and establish itself as the clear alternative to expensive, outdated incumbents like Statuspage.io.

The key to success is prioritizing the MVP around Statuspage.io (the market leader), then systematically expanding to other competitors. Each new adapter multiplies the addressable market and increases conversion potential.

**Next Steps:**
1. Validate demand with 5-10 prospective customers
2. Prioritize first adapter (recommend Statuspage.io)
3. Design API contracts for provider adapters
4. Build MVP UI/UX flow
5. Launch with beta group for feedback
6. Iterate rapidly based on user feedback
7. Expand to additional providers

---

## Appendix: Provider Comparison Matrix

| Provider | Market Position | Ease of Integration | User Base | Priority |
|----------|-----------------|-------------------|-----------|----------|
| Statuspage.io | Market Leader | Medium | Enterprise | 1 (MVP) |
| Better Stack | Growing Rapidly | Medium | SMB/Enterprise | 2 |
| Instatus | Emerging | Easy | Startups/SMB | 2 |
| Uptime Kuma | Open Source | Easy | Developers | 3 |
| Checkly | Niche | Hard | DevOps Teams | 3 |
| Status.io | Legacy | Medium | Enterprise | 4 |
| Cachet | Open Source | Medium | Self-Hosted | 4 |

---

**Document Version**: 1.0  
**Last Updated**: February 2026  
**Owner**: Product Team  
**Status**: Ready for Implementation Review