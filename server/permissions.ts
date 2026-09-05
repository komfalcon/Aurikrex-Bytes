import { TRPCError } from "@trpc/server";
import type { AdminUser } from "../drizzle/schema";

export type AdminRole = "admin" | "editor";
export type Permission =
  | "post:create"
  | "post:edit"
  | "post:delete"
  | "post:publish"
  | "post:schedule"
  | "post:unschedule"
  | "post:submit"
  | "post:review"
  | "users:manage"
  | "analytics:view";

const permissions: Record<AdminRole, ReadonlySet<Permission>> = {
  admin: new Set<Permission>([
    "post:create", "post:edit", "post:delete", "post:publish", "post:schedule",
    "post:unschedule", "post:submit", "post:review", "users:manage", "analytics:view",
  ]),
  editor: new Set<Permission>(["post:create", "post:edit", "post:submit"]),
};

export function hasPermission(role: AdminRole, permission: Permission) {
  return permissions[role]?.has(permission) ?? false;
}

export function assertPermission(role: AdminRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Role ${role} cannot perform ${permission}` });
  }
}

export function assertActiveAdmin(admin: Pick<AdminUser, "id" | "email" | "role" | "isActive">) {
  if (!admin.isActive) throw new TRPCError({ code: "FORBIDDEN", message: "This account is inactive" });
  return admin;
}

export function canTransitionPost(role: AdminRole, from: string, to: string) {
  if (from === "draft" && to === "pending_review") return role === "editor" || role === "admin";
  if (from === "draft" && (to === "scheduled" || to === "published")) return role === "admin";
  if (from === "pending_review" && (to === "scheduled" || to === "published")) return role === "admin";
  if (from === "scheduled" && to === "draft") return role === "admin";
  return false;
}

export function assertPostTransition(role: AdminRole, from: string, to: string) {
  if (!canTransitionPost(role, from, to)) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Role ${role} cannot transition post from ${from} to ${to}` });
  }
}

export const restrictedEditorPermissions: Permission[] = [
  "post:publish", "post:schedule", "post:unschedule", "post:review", "users:manage", "analytics:view",
];
