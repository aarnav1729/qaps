import { ROLE_LABELS, type UserRole } from "@/types/qap";

export const ADMIN_ASSIGNABLE_ROLES: UserRole[] = [
  "level-1-reviewer",
  "production",
  "quality",
  "technical",
  "head",
  "technical-head",
  "plant-head",
  "admin",
  "sales",
];

export const DASHBOARD_ROLES: UserRole[] = [
  "requestor",
  "level-1-reviewer",
  "production",
  "quality",
  "technical",
  "head",
  "technical-head",
  "plant-head",
  "admin",
  "sales",
];

export const formatRoleLabel = (role?: string | null) =>
  role && role in ROLE_LABELS
    ? ROLE_LABELS[role as UserRole]
    : String(role || "").replace(/-/g, " ");
