export const ADMIN_PLANS = ["free", "trial", "pro", "studio", "internal"] as const;
export type AdminPlan = (typeof ADMIN_PLANS)[number];

export const ACCOUNT_STATUSES = ["active", "locked", "banned"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const SUPPORT_TYPES = ["problem", "question", "wish", "other"] as const;
export type SupportType = (typeof SUPPORT_TYPES)[number];

export const SUPPORT_STATUSES = ["new", "done"] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export function planLabel(plan: string | null | undefined): string {
  switch (plan) {
    case "trial":
      return "Test";
    case "pro":
      return "Pro";
    case "studio":
      return "Studio";
    case "internal":
      return "Intern";
    default:
      return "Free";
  }
}

export function statusLabel(status: string | null | undefined): string {
  switch (status) {
    case "locked":
      return "Gesperrt";
    case "banned":
      return "Gebannt";
    default:
      return "Aktiv";
  }
}

export function supportTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case "question":
      return "Frage";
    case "wish":
      return "Wunsch";
    case "other":
      return "Sonstiges";
    default:
      return "Problem";
  }
}
