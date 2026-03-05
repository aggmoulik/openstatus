import type { insertPageSchema } from "@openstatus/db/src/schema";
import type { z } from "zod";

export type OpenStatusPagePayload = z.infer<typeof insertPageSchema>;

export interface MigrationEntityProgress {
  status: "pending" | "in_progress" | "done" | "failed";
  total: number;
  migrated: number;
  /** Maps source provider ID (string) → OpenStatus DB id (number). Needed for FK resolution. */
  idMap?: Record<string, number>;
  /** For single-entity steps (e.g. page) */
  openStatusId?: number;
}

export interface MigrationProgress {
  useMockData?: boolean;
  page: Omit<MigrationEntityProgress, "total" | "migrated" | "idMap"> & {
    openStatusId?: number;
  };
  componentGroups: MigrationEntityProgress;
  components: MigrationEntityProgress;
  statusReports: MigrationEntityProgress;
  maintenances: MigrationEntityProgress;
  subscribers: MigrationEntityProgress;
}

export interface MigrationPlan {
  page: any; // OpenStatusPagePayload (simplified for now to avoid complexity in this file)
  componentGroups: any[];
  components: any[];
  statusReports: any[];
  maintenances: any[];
  subscribers: any[];
}

export interface MigrationResult {
  jobId: number;
  status: string;
  progress: MigrationProgress;
  error?: string | null;
}

export type ComponentIdMap = Map<string, number>;

export interface MigrationProvider<TRaw = any> {
  id: string;
  fetch(config: {
    apiKey: string;
    pageId: string;
    useMock?: boolean;
  }): Promise<TRaw>;
  transform(raw: TRaw, idMap: ComponentIdMap): MigrationPlan;
}
