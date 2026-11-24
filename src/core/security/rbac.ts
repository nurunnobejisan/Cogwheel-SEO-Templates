export type UserRole =
  | "Administrator"
  | "Manager"
  | "SEO Specialist"
  | "Content Editor"
  | "Analyst"
  | "Read-only Client";

export type Permission =
  | "client:create"
  | "client:edit"
  | "client:delete"
  | "property:create"
  | "property:edit"
  | "property:delete"
  | "task:execute"
  | "task:approve"
  | "keywords:allocate"
  | "keywords:edit_mapping"
  | "content:edit_copy"
  | "content:publish"
  | "reports:generate"
  | "reports:export"
  | "settings:manage_keys"
  | "settings:manage_users";

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  Administrator: [
    "client:create",
    "client:edit",
    "client:delete",
    "property:create",
    "property:edit",
    "property:delete",
    "task:execute",
    "task:approve",
    "keywords:allocate",
    "keywords:edit_mapping",
    "content:edit_copy",
    "content:publish",
    "reports:generate",
    "reports:export",
    "settings:manage_keys",
    "settings:manage_users",
  ],
  Manager: [
    "client:create",
    "client:edit",
    "property:create",
    "property:edit",
    "task:execute",
    "task:approve",
    "keywords:allocate",
    "keywords:edit_mapping",
    "content:edit_copy",
    "content:publish",
    "reports:generate",
    "reports:export",
  ],
  "SEO Specialist": [
    "property:edit",
    "task:execute",
    "keywords:allocate",
    "keywords:edit_mapping",
    "content:edit_copy",
    "reports:generate",
    "reports:export",
  ],
  "Content Editor": [
    "content:edit_copy",
    "reports:generate",
    "reports:export",
  ],
  Analyst: [
    "reports:generate",
    "reports:export",
  ],
  "Read-only Client": [
    "reports:export",
  ],
};

export interface UserSession {
  userId: string;
  email: string;
  role: UserRole;
  clientId?: string;
  allowedPropertyIds?: string[];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] ?? [];
  return permissions.includes(permission);
}

export function assertPermission(session: UserSession, permission: Permission): void {
  if (!hasPermission(session.role, permission)) {
    throw new Error(
      `Permission denied: Role "${session.role}" lacks required permission "${permission}".`,
    );
  }
}

export function canAccessProperty(session: UserSession, propertyId: string): boolean {
  if (session.role === "Administrator") return true;
  if (!session.allowedPropertyIds || session.allowedPropertyIds.length === 0) return true;
  return session.allowedPropertyIds.includes(propertyId);
}
