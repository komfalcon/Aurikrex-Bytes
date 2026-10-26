import { describe, expect, it } from "vitest";
import { isSafeAvatarUrl } from "./_core/security.js";
import { appRouter } from "./routers.js";

describe("isSafeAvatarUrl validation", () => {
  it("allows null or undefined (optional avatar)", () => {
    expect(isSafeAvatarUrl(null)).toBe(true);
    expect(isSafeAvatarUrl(undefined)).toBe(true);
    expect(isSafeAvatarUrl("")).toBe(true);
  });

  it("rejects dangerous and non-HTTPS protocols", () => {
    expect(isSafeAvatarUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeAvatarUrl("JAVASCRIPT:alert(document.cookie)")).toBe(false);
    expect(isSafeAvatarUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(false);
    expect(isSafeAvatarUrl("blob:https://res.cloudinary.com/blob-id")).toBe(false);
    expect(isSafeAvatarUrl("http://res.cloudinary.com/aurikrex/image/upload/sample.jpg")).toBe(false);
    expect(isSafeAvatarUrl("file:///etc/passwd")).toBe(false);
  });

  it("rejects SSRF, internal networks, and localhost targets", () => {
    expect(isSafeAvatarUrl("https://localhost/avatar.jpg")).toBe(false);
    expect(isSafeAvatarUrl("https://127.0.0.1/avatar.jpg")).toBe(false);
    expect(isSafeAvatarUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isSafeAvatarUrl("https://10.0.0.1/avatar.jpg")).toBe(false);
    expect(isSafeAvatarUrl("https://192.168.1.1/avatar.jpg")).toBe(false);
  });

  it("rejects unapproved external hosts", () => {
    expect(isSafeAvatarUrl("https://evil.com/avatar.jpg")).toBe(false);
    expect(isSafeAvatarUrl("https://attacker.org/phish.png")).toBe(false);
    expect(isSafeAvatarUrl("https://fakecloudinary.com/img.png")).toBe(false);
  });

  it("rejects oversized URL strings (>2048 chars)", () => {
    const longUrl = "https://res.cloudinary.com/" + "a".repeat(2050);
    expect(isSafeAvatarUrl(longUrl)).toBe(false);
  });

  it("accepts valid HTTPS URLs from approved storage hosts", () => {
    expect(
      isSafeAvatarUrl("https://res.cloudinary.com/aurikrex/image/upload/v1234567890/aurikrex/avatars/user.jpg")
    ).toBe(true);
    expect(
      isSafeAvatarUrl("https://lh3.googleusercontent.com/a/ACg8ocI4sXqX9")
    ).toBe(true);
    expect(
      isSafeAvatarUrl("https://secure.gravatar.com/avatar/205359a3636082700e4f8b98b0f7992c?s=200")
    ).toBe(true);
    expect(
      isSafeAvatarUrl("https://avatars.githubusercontent.com/u/1234567?v=4")
    ).toBe(true);
  });

  it("respects ALLOWED_AVATAR_HOSTS environment variable for custom storage domains", () => {
    const originalEnv = process.env.ALLOWED_AVATAR_HOSTS;
    try {
      process.env.ALLOWED_AVATAR_HOSTS = "custom-storage.aurikrex.com, s3.amazonaws.com";
      expect(isSafeAvatarUrl("https://custom-storage.aurikrex.com/avatars/user1.webp")).toBe(true);
      expect(isSafeAvatarUrl("https://sub.custom-storage.aurikrex.com/avatars/user1.webp")).toBe(true);
      expect(isSafeAvatarUrl("https://s3.amazonaws.com/mybucket/avatar.png")).toBe(true);
      expect(isSafeAvatarUrl("https://unlisted-domain.com/avatar.png")).toBe(false);
      // Non-https still rejected even if matching host
      expect(isSafeAvatarUrl("http://custom-storage.aurikrex.com/avatars/user1.webp")).toBe(false);
    } finally {
      process.env.ALLOWED_AVATAR_HOSTS = originalEnv;
    }
  });

  it("enforces schema validation on tRPC reader.updateAvatar procedure", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as never,
      res: {} as never,
    });

    // Dangerous JS URL
    await expect(
      caller.reader.updateAvatar({ avatarUrl: "javascript:alert(1)" })
    ).rejects.toThrow(/Invalid avatar URL/);

    // Raw Base64 data URL
    await expect(
      caller.reader.updateAvatar({
        avatarUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
      })
    ).rejects.toThrow(/Invalid avatar URL/);

    // Blob URL
    await expect(
      caller.reader.updateAvatar({
        avatarUrl: "blob:https://res.cloudinary.com/00000000-0000-0000-0000-000000000000",
      })
    ).rejects.toThrow(/Invalid avatar URL/);

    // Unapproved domain
    await expect(
      caller.reader.updateAvatar({
        avatarUrl: "https://unknown-domain.com/myphoto.jpg",
      })
    ).rejects.toThrow(/Invalid avatar URL/);

    // Valid hosted Cloudinary URL passes input validation and reaches auth check
    await expect(
      caller.reader.updateAvatar({
        avatarUrl: "https://res.cloudinary.com/demo/image/upload/aurikrex/avatars/user.jpg",
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("provides avatarUploadSignature query configuration endpoint", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as never,
      res: {} as never,
    });

    const sigResult = await caller.reader.avatarUploadSignature();
    expect(sigResult).toBeDefined();
    expect(typeof sigResult.configured).toBe("boolean");
    if (sigResult.configured) {
      expect(sigResult.folder).toBe("aurikrex/avatars");
      expect(sigResult.timestamp).toBeGreaterThan(0);
      expect(sigResult.apiKey).toBeDefined();
      expect(sigResult.signature).toBeDefined();
    }
  });
});
