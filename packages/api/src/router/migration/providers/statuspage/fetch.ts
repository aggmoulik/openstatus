import type { StatuspageRawData } from "./types";

export async function fetchFromStatuspage(
  apiKey: string,
  pageId: string,
): Promise<StatuspageRawData> {
  const headers = {
    Authorization: `OAuth ${apiKey}`,
    "Content-Type": "application/json",
  };

  const [page, components, componentGroups, incidents, subscribers] =
    await Promise.all([
      fetch(`https://api.statuspage.io/v1/pages/${pageId}`, {
        headers,
      }).then((r) => r.json()),
      fetch(`https://api.statuspage.io/v1/pages/${pageId}/components`, {
        headers,
      }).then((r) => r.json()),
      fetch(`https://api.statuspage.io/v1/pages/${pageId}/component_groups`, {
        headers,
      }).then((r) => r.json()),
      fetch(`https://api.statuspage.io/v1/pages/${pageId}/incidents`, {
        headers,
      }).then((r) => r.json()),
      fetch(`https://api.statuspage.io/v1/pages/${pageId}/subscribers`, {
        headers,
      }).then((r) => r.json()),
    ]);

  return {
    page,
    components,
    componentGroups,
    incidents,
    subscribers,
  };
}

import { readFileSync } from "fs";
import { join } from "path";

export async function fetchMockData(): Promise<StatuspageRawData> {
  const fixtureDir = join(__dirname, "fixtures");
  const load = (name: string) =>
    JSON.parse(readFileSync(join(fixtureDir, `${name}.json`), "utf-8"));

  return {
    page: load("page"),
    components: load("components"),
    componentGroups: load("component_groups"),
    incidents: load("incidents"),
    subscribers: load("subscribers"),
  };
}
