import { currentUser } from "@clerk/nextjs/server";

function splitEnv(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export interface AdminGateResult {
  ok: boolean;
  reason?: "signed_out" | "not_configured" | "forbidden";
  userId?: string;
  email?: string;
}

export async function requireAdmin(): Promise<AdminGateResult> {
  const user = await currentUser();
  if (!user) return { ok: false, reason: "signed_out" };

  const allowedIds = splitEnv(process.env.ADMIN_USER_IDS);
  const allowedEmails = splitEnv(process.env.ADMIN_EMAILS);
  const email = user.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)
    ?.emailAddress
    .toLowerCase();

  if (allowedIds.length === 0 && allowedEmails.length === 0) {
    return { ok: false, reason: "not_configured", userId: user.id, email };
  }

  if (allowedIds.includes(user.id.toLowerCase()) || (email && allowedEmails.includes(email))) {
    return { ok: true, userId: user.id, email };
  }

  return { ok: false, reason: "forbidden", userId: user.id, email };
}
