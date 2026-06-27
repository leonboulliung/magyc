import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectAccessRole } from "@/lib/server/projectAccess";
import type { ProjectStage } from "@/lib/types";

export interface StudioProjectSummary {
  id: string;
  title: string;
  stage: ProjectStage | null;
  segment: string | null;
  shared: boolean;
  archivedAt: number | null;
  deletedAt: number | null;
  createdAt: number;
  lastActivityAt: number;
  stateCount: number;
  uploadCount: number;
  memberCount: number;
  accessRole: Exclude<ProjectAccessRole, "link" | "none">;
}

function timestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function stage(value: unknown): ProjectStage | null {
  return value === "brief" || value === "production" || value === "handoff" ? value : null;
}

function accessRole(value: unknown): StudioProjectSummary["accessRole"] {
  return value === "editor" || value === "client" ? value : "owner";
}

export async function fetchStudioProjectSummaries(
  admin: SupabaseClient,
  userId: string,
): Promise<StudioProjectSummary[]> {
  const { data, error } = await admin.rpc("studio_project_summaries", { p_user_id: userId });
  if (error) throw error;
  return (Array.isArray(data) ? data : []).map((row: Record<string, unknown>) => ({
    id: String(row.id || ""),
    title: typeof row.title === "string" ? row.title : "",
    stage: stage(row.stage),
    segment: typeof row.segment === "string" ? row.segment : null,
    shared: row.shared === true,
    archivedAt: timestamp(row.archived_at),
    deletedAt: timestamp(row.deleted_at),
    createdAt: timestamp(row.created_at) ?? 0,
    lastActivityAt: timestamp(row.last_activity_at) ?? timestamp(row.created_at) ?? 0,
    stateCount: Number(row.state_count || 0),
    uploadCount: Number(row.upload_count || 0),
    memberCount: Number(row.member_count || 0),
    accessRole: accessRole(row.access_role),
  })).filter((row) => row.id);
}
