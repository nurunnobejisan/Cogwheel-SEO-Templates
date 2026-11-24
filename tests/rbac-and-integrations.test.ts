import { describe, expect, it } from "vitest";
import { inspectIntegrationHealth } from "@/core/integrations/integration-manager";
import {
  assertPermission,
  canAccessProperty,
  hasPermission,
  type UserSession,
} from "@/core/security/rbac";

describe("Enterprise RBAC & Integration Health Suite", () => {
  it("enforces strict role-based permission boundaries", () => {
    // Administrator has all permissions
    expect(hasPermission("Administrator", "settings:manage_keys")).toBe(true);
    expect(hasPermission("Administrator", "client:delete")).toBe(true);

    // Manager can approve tasks and allocate keywords, but cannot manage root keys
    expect(hasPermission("Manager", "task:approve")).toBe(true);
    expect(hasPermission("Manager", "settings:manage_keys")).toBe(false);

    // Content Editor can only edit copy and view reports
    expect(hasPermission("Content Editor", "content:edit_copy")).toBe(true);
    expect(hasPermission("Content Editor", "property:delete")).toBe(false);
    expect(hasPermission("Content Editor", "task:approve")).toBe(false);

    // Read-only Client can only export reports
    expect(hasPermission("Read-only Client", "reports:export")).toBe(true);
    expect(hasPermission("Read-only Client", "content:edit_copy")).toBe(false);
    expect(hasPermission("Read-only Client", "task:execute")).toBe(false);
  });

  it("asserts permission and throws on violation", () => {
    const clientSession: UserSession = {
      userId: "user-123",
      email: "owner@boutiquehotel.com",
      role: "Read-only Client",
      allowedPropertyIds: ["prop-456"],
    };

    expect(() => assertPermission(clientSession, "reports:export")).not.toThrow();
    expect(() => assertPermission(clientSession, "property:delete")).toThrow(
      /Permission denied/,
    );
  });

  it("restricts property access based on tenant property IDs", () => {
    const specialistSession: UserSession = {
      userId: "user-789",
      email: "specialist@agency.com",
      role: "SEO Specialist",
      allowedPropertyIds: ["hotel-austin", "hotel-savannah"],
    };

    expect(canAccessProperty(specialistSession, "hotel-austin")).toBe(true);
    expect(canAccessProperty(specialistSession, "hotel-orlando")).toBe(false);

    const adminSession: UserSession = {
      userId: "admin-1",
      email: "admin@cogwheel.com",
      role: "Administrator",
    };
    expect(canAccessProperty(adminSession, "any-hotel-id")).toBe(true);
  });

  it("inspects integration health across all 9 third-party systems without throwing", () => {
    const integrations = inspectIntegrationHealth();
    expect(integrations).toHaveLength(9);

    const ids = integrations.map((i) => i.id);
    expect(ids).toContain("anthropic_claude");
    expect(ids).toContain("supabase_postgres");
    expect(ids).toContain("google_search_console");
    expect(ids).toContain("google_analytics_4");
    expect(ids).toContain("google_business_profile");
    expect(ids).toContain("semrush");
    expect(ids).toContain("ahrefs");

    for (const item of integrations) {
      expect(item.name).toBeDefined();
      expect(item.configurationInstructions.length).toBeGreaterThan(10);
    }
  });
});
