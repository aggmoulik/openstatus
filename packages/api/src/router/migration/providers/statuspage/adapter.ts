import type {
  ComponentIdMap,
  MigrationPlan,
  MigrationProvider,
} from "../../types";
import type { StatuspageRawData } from "./types";

export const statuspageProvider: MigrationProvider<StatuspageRawData> = {
  id: "statuspage",

  async fetch(config) {
    if (config.useMock) {
      const { fetchMockData } = await import("./fetch");
      return fetchMockData();
    }
    const { fetchFromStatuspage } = await import("./fetch");
    return fetchFromStatuspage(config.apiKey, config.pageId);
  },

  transform(raw, idMap) {
    const plan: MigrationPlan = {
      page: transformPage(raw.page),
      componentGroups: raw.componentGroups.map(transformComponentGroup),
      components: raw.components.map((c) => transformComponent(c, idMap)),
      statusReports: [],
      maintenances: [],
      subscribers: raw.subscribers.map(transformSubscriber),
    };

    for (const incident of raw.incidents) {
      if (incident.status === "scheduled") {
        plan.maintenances.push(transformMaintenance(incident, idMap));
      } else {
        plan.statusReports.push(transformStatusReport(incident, idMap));
      }
    }

    return plan;
  },
};

function transformPage(rawPage: any) {
  return {
    title: rawPage.name,
    description: rawPage.page_description || "",
    slug: sanitizeSlug(rawPage.subdomain),
    customDomain: rawPage.domain || "",
  };
}

function transformComponentGroup(rawGroup: any) {
  return {
    name: rawGroup.name,
    externalId: rawGroup.id,
  };
}

function transformComponent(rawComponent: any, idMap: ComponentIdMap) {
  return {
    name: rawComponent.name,
    description: rawComponent.description || "",
    type: "static" as const,
    externalId: rawComponent.id,
    externalGroupId: rawComponent.group_id,
  };
}

function transformStatusReport(rawIncident: any, idMap: ComponentIdMap) {
  const updates = rawIncident.incident_updates.map((u: any) => ({
    message: u.body,
    status: mapStatus(u.status),
    date: new Date(u.display_at),
  }));

  if (rawIncident.postmortem_body) {
    updates.push({
      message: `## Postmortem\n${rawIncident.postmortem_body}`,
      status: "resolved" as const,
      date: new Date(
        rawIncident.postmortem_body_last_updated_at ||
          rawIncident.resolved_at ||
          rawIncident.updated_at,
      ),
    });
  }

  return {
    title: rawIncident.name,
    status: mapStatus(rawIncident.status),
    createdAt: new Date(rawIncident.created_at),
    updates,
    affectedComponentIds: rawIncident.components.map((c: any) => c.id),
  };
}

function transformMaintenance(rawIncident: any, idMap: ComponentIdMap) {
  return {
    title: rawIncident.name,
    message: rawIncident.incident_updates[0]?.body || "Scheduled maintenance",
    from: new Date(rawIncident.scheduled_for!),
    to: new Date(rawIncident.scheduled_until!),
    affectedComponentIds: rawIncident.components.map((c: any) => c.id),
  };
}

function transformSubscriber(rawSubscriber: any) {
  return {
    email: rawSubscriber.email,
  };
}

function sanitizeSlug(slug: string) {
  if (!slug) return "migrated-page";
  return slug.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

function mapStatus(status: string) {
  const map: Record<string, string> = {
    investigating: "investigating",
    identified: "identified",
    monitoring: "monitoring",
    resolved: "resolved",
    scheduled: "resolved", // scheduled incidents transformed to maintenance, but status report updates use resolved for completion
    in_progress: "investigating",
    verifying: "monitoring",
    completed: "resolved",
  };
  return (map[status] || "investigating") as any;
}
