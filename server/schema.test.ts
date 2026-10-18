import { describe, expect, it } from "vitest";
import { ADMIN_ROLES, POST_STATUSES, adminUsers, postViews, posts, readers, searchQueries } from "../drizzle/schema.js";

describe("Aurikrex Bytes schema", () => {
  it("defines the required publishing and auth tables", () => {
    expect(posts).toBeDefined();
    expect(adminUsers).toBeDefined();
    expect(readers).toBeDefined();
    expect(postViews).toBeDefined();
    expect(searchQueries).toBeDefined();
    expect(Object.keys(posts)).toEqual(expect.arrayContaining(["id", "imageUrl", "sourceUrl", "sourcePublisher", "sourcePublishedAt", "duplicateKey", "imageQuery", "imageProvenance", "headline", "body", "status", "scheduledTime", "publishedTime", "rejectionNote", "createdBy", "updatedAt"]));
    expect(Object.keys(adminUsers)).toEqual(expect.arrayContaining(["id", "email", "passwordHash", "role", "isActive", "rememberDeviceToken", "createdAt"]));
    expect(Object.keys(readers)).toEqual(expect.arrayContaining(["id", "email", "passwordHash", "googleId", "emailVerified", "verificationToken", "resetToken", "resetTokenExpires", "createdAt"]));
    expect(POST_STATUSES).toEqual(["draft", "pending_review", "scheduled", "published"]);
    expect(ADMIN_ROLES).toEqual(["admin", "editor"]);
  });

  it("defines the 5 canonical byte categories and normalizer", async () => {
    const { BYTE_CATEGORIES, normalizeByteCategory } = await import("../shared/const.js");
    expect(BYTE_CATEGORIES).toEqual(["Tech", "Medicine", "Sports", "Geopolitics", "Science"]);
    expect(normalizeByteCategory("Tech")).toBe("Tech");
    expect(normalizeByteCategory("medicine")).toBe("Medicine");
    expect(normalizeByteCategory("SPORTS")).toBe("Sports");
    expect(normalizeByteCategory("geopolitics")).toBe("Geopolitics");
    expect(normalizeByteCategory("science")).toBe("Science");
    // Legacy mapping to Tech
    expect(normalizeByteCategory("AI")).toBe("Tech");
    expect(normalizeByteCategory("Crypto")).toBe("Tech");
    expect(normalizeByteCategory("unknown")).toBe("Tech");
  });
});
