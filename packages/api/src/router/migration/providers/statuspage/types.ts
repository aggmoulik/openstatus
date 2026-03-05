export interface StatuspagePage {
  id: string;
  name: string;
  subdomain: string;
  domain: string | null;
  page_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatuspageComponent {
  id: string;
  page_id: string;
  group_id: string | null;
  name: string;
  description: string | null;
  position: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface StatuspageComponentGroup {
  id: string;
  page_id: string;
  name: string;
  components: string[];
  created_at: string;
  updated_at: string;
}

export interface StatuspageIncidentUpdate {
  id: string;
  incident_id: string;
  body: string;
  status: string;
  display_at: string;
  created_at: string;
  updated_at: string;
}

export interface StatuspageIncident {
  id: string;
  page_id: string;
  name: string;
  status: string;
  impact: string;
  shortlink: string;
  postmortem_body: string | null;
  postmortem_body_last_updated_at: string | null;
  incident_updates: StatuspageIncidentUpdate[];
  components: StatuspageComponent[];
  scheduled_for: string | null;
  scheduled_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatuspageSubscriber {
  id: string;
  page_id: string;
  email: string | null;
  phone_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatuspageRawData {
  page: StatuspagePage;
  components: StatuspageComponent[];
  componentGroups: StatuspageComponentGroup[];
  incidents: StatuspageIncident[];
  subscribers: StatuspageSubscriber[];
}
