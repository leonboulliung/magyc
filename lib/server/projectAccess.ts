import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectStage } from "@/lib/types";

export type ProjectAccessRole = "owner" | "editor" | "client" | "link" | "none";
export type ProjectMembershipRole = Extract<ProjectAccessRole, "editor" | "client">;

export function resolveProjectAccessRole(input: {
  userId?: string | null;
  ownerId: string | null;
  membershipRole?: string | null;
  shared?: boolean | null;
}): ProjectAccessRole {
  if (input.userId && input.ownerId === input.userId) return "owner";
  if (input.membershipRole === "editor" || input.membershipRole === "client") {
    return input.membershipRole;
  }
  return input.shared ? "link" : "none";
}

export function projectMembershipsUnavailable(error: unknown): boolean {
  const value = error as { code?: string; message?: string } | null;
  return value?.code === "42P01"
    || value?.code === "PGRST205"
    || (value?.message || "").includes("project_members");
}

export async function getProjectAccess(
  admin: SupabaseClient,
  input: { spaceId: string; ownerId: string | null; shared?: boolean | null; userId?: string | null },
): Promise<ProjectAccessRole> {
  const directRole = resolveProjectAccessRole(input);
  if (directRole === "owner") return directRole;
  if (input.userId) {
    const { data, error } = await admin
      .from("project_members")
      .select("role")
      .eq("space_id", input.spaceId)
      .eq("user_id", input.userId)
      .maybeSingle();
    if (!error && data?.role) {
      return resolveProjectAccessRole({ ...input, membershipRole: data.role });
    }
    if (error && !projectMembershipsUnavailable(error)) throw error;
  }
  return resolveProjectAccessRole(input);
}

export function canReadProject(role: ProjectAccessRole): boolean {
  return role !== "none";
}

export function canEditProject(role: ProjectAccessRole): boolean {
  return role === "owner" || role === "editor";
}

export function canManageProject(role: ProjectAccessRole): boolean {
  return role === "owner";
}

export function canAdvanceProject(role: ProjectAccessRole): boolean {
  return role === "owner" || role === "editor";
}

const PROJECT_STAGE_ORDER: ProjectStage[] = ["brief", "production", "handoff"];

export function isForwardStageTransition(from: ProjectStage | null, to: ProjectStage): boolean {
  const currentIndex = PROJECT_STAGE_ORDER.indexOf(from ?? "brief");
  return PROJECT_STAGE_ORDER.indexOf(to) === currentIndex + 1;
}
