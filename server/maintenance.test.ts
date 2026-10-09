import { describe, expect, it } from "vitest";

describe("maintenance mode logic & password security", () => {
  const MAINTENANCE_PASSWORD = "KorexTonyFalconStark1025$";

  it("strictly validates the case-sensitive verification password", () => {
    function verifyMaintenancePassword(input: string): boolean {
      const expected = process.env.MAINTENANCE_PASSWORD || MAINTENANCE_PASSWORD;
      return input === expected;
    }

    // Exact match
    expect(verifyMaintenancePassword("KorexTonyFalconStark1025$")).toBe(true);

    // Case-sensitive variations must fail
    expect(verifyMaintenancePassword("korextonyfalconStark1025$")).toBe(false);
    expect(verifyMaintenancePassword("KOREXTONYFALCONSTARK1025$")).toBe(false);
    expect(verifyMaintenancePassword("KorexTonyFalconStark1025")).toBe(false);
    expect(verifyMaintenancePassword("")).toBe(false);
    expect(verifyMaintenancePassword("wrongpassword")).toBe(false);
  });

  it("accurately classifies admin immune paths vs public paths", () => {
    function isAdminPath(path: string): boolean {
      return path.startsWith("/admin") || path.startsWith("/falcon-system-auth");
    }

    // Admin paths that must NEVER be blocked
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/new")).toBe(true);
    expect(isAdminPath("/admin/team")).toBe(true);
    expect(isAdminPath("/admin/analytics")).toBe(true);
    expect(isAdminPath("/falcon-system-auth")).toBe(true);

    // Public reader paths that MUST be blocked during maintenance
    expect(isAdminPath("/")).toBe(false);
    expect(isAdminPath("/dashboard")).toBe(false);
    expect(isAdminPath("/saved")).toBe(false);
    expect(isAdminPath("/archive")).toBe(false);
    expect(isAdminPath("/post/42")).toBe(false);
    expect(isAdminPath("/how-it-works")).toBe(false);
    expect(isAdminPath("/help")).toBe(false);
    expect(isAdminPath("/contact")).toBe(false);
    expect(isAdminPath("/privacy")).toBe(false);
    expect(isAdminPath("/terms")).toBe(false);
    expect(isAdminPath("/login")).toBe(false);
    expect(isAdminPath("/signup")).toBe(false);
  });
});
