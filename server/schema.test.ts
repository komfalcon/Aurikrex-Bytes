import { describe, expect, it } from "vitest";
import { ADMIN_ROLES, POST_STATUSES, adminUsers, posts, readers } from "../drizzle/schema";

describe("Aurikrex Bytes schema", () => {
  it("defines the required publishing and auth tables", () => {
    expect(posts).toBeDefined();
    expect(adminUsers).toBeDefined();
    expect(readers).toBeDefined();
    expect(Object.keys(posts)).toEqual(expect.arrayContaining(["id", "imageUrl", "headline", "body", "status", "scheduledTime", "publishedTime", "rejectionNote", "createdBy", "updatedAt"]));
    expect(Object.keys(adminUsers)).toEqual(expect.arrayContaining(["id", "email", "passwordHash", "role", "isActive", "rememberDeviceToken", "createdAt"]));
    expect(Object.keys(readers)).toEqual(expect.arrayContaining(["id", "email", "passwordHash", "googleId", "emailVerified", "verificationToken", "resetToken", "resetTokenExpires", "createdAt"]));
    expect(POST_STATUSES).toEqual(["draft", "pending_review", "scheduled", "published"]);
    expect(ADMIN_ROLES).toEqual(["admin", "editor"]);
  });
});
