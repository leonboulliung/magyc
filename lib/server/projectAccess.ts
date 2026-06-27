import { clerkClient } from "@clerk/nextjs/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureProfile } from "@/lib/server/profile";

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
    if (!error && !data) {
      await claimPendingProjectMemberships(admin, input.userId);
      const claimed = await admin
        .from("project_members")
        .select("role")
        .eq("space_id", input.spaceId)
        .eq("user_id", input.userId)
        .maybeSingle();
      if (!claimed.error && (claimed.data?.role === "editor" || claimed.data?.role === "client")) {
        return resolveProjectAccessRole({ ...input, membershipRole: claimed.data.role });
      }
      if (claimed.error && !projectMembershipsUnavailable(claimed.error)) throw claimed.error;
    }
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

export async function claimPendingProjectMemberships(admin: SupabaseClient, userId: string): Promise<void> {
  let emails: string[] = [];
  try {
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    emails = user.emailAddresses.map((entry) => entry.emailAddress.trim().toLowerCase()).filter(Boolean);
  } catch {
    return;
  }
  if (!emails.length) return;
  await ensureProfile(userId);
  const { data: pending, error } = await admin
    .from("project_members")
    .select("id, space_id, created_at")
    .is("user_id", null)
    .in("email", emails)
    .order("created_at", { ascending: true });
  if (error) {
    if (!projectMembershipsUnavailable(error)) {
      console.error("[project-members] pending lookup failed:", error.message);
    }
    return;
  }
  if (!pending?.length) return;

  const spaceIds = [...new Set(pending.map((row) => String(row.space_id)))];
  const { data: existing, error: existingError } = await admin
    .from("project_members")
    .select("id, space_id")
    .eq("user_id", userId)
    .in("space_id", spaceIds);
  if (existingError) {
    console.error("[project-members] existing membership lookup failed:", existingError.message);
    return;
  }

  const existingSpaces = new Set((existing ?? []).map((row) => String(row.space_id)));
  const firstPendingBySpace = new Map<string, string>();
  const redundantIds: string[] = [];
  for (const row of pending) {
    const spaceId = String(row.space_id);
    if (existingSpaces.has(spaceId) || firstPendingBySpace.has(spaceId)) {
      redundantIds.push(String(row.id));
    } else {
      firstPendingBySpace.set(spaceId, String(row.id));
    }
  }

  if (redundantIds.length) {
    const { error: deleteError } = await admin.from("project_members").delete().in("id", redundantIds);
    if (deleteError) {
      console.error("[project-members] duplicate invitation cleanup failed:", deleteError.message);
      return;
    }
  }
  const claimIds = [...firstPendingBySpace.values()];
  if (!claimIds.length) return;
  const { error: claimError } = await admin
    .from("project_members")
    .update({ user_id: userId, updated_at: new Date().toISOString() })
    .in("id", claimIds)
    .is("user_id", null);
  if (claimError) {
    console.error("[project-members] pending claim failed:", claimError.message);
  }
}
