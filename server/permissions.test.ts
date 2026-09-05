import { describe, expect, it } from "vitest";
import { assertPermission, canTransitionPost, hasPermission } from "./permissions";

describe("role permissions", () => {
  it("allows editors to create, edit, and submit but not publish, schedule, or manage users", () => {
    expect(hasPermission("editor", "post:create")).toBe(true);
    expect(hasPermission("editor", "post:edit")).toBe(true);
    expect(hasPermission("editor", "post:submit")).toBe(true);
    expect(hasPermission("editor", "post:publish")).toBe(false);
    expect(hasPermission("editor", "post:schedule")).toBe(false);
    expect(hasPermission("editor", "users:manage")).toBe(false);
    expect(() => assertPermission("editor", "post:publish")).toThrow(/cannot perform/);
  });

  it("allows admins to review and cancel future scheduled posts", () => {
    expect(hasPermission("admin", "post:publish")).toBe(true);
    expect(hasPermission("admin", "post:schedule")).toBe(true);
    expect(hasPermission("admin", "users:manage")).toBe(true);
    expect(hasPermission("admin", "analytics:view")).toBe(true);
    expect(canTransitionPost("admin", "pending_review", "published")).toBe(true);
    expect(canTransitionPost("admin", "pending_review", "scheduled")).toBe(true);
    expect(canTransitionPost("admin", "scheduled", "draft")).toBe(true);
    expect(canTransitionPost("editor", "pending_review", "published")).toBe(false);
  });
});
