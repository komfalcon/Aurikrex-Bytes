import { describe, expect, it } from "vitest";
import { appRouter } from "./routers.js";
import { hashPassword, verifyPassword } from "./auth.js";

describe("custom auth flows", () => {
  it("hashes and verifies passwords without storing plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toContain("correct horse");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("returns a generic not-found error for failed newsroom access", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { protocol: "https", headers: {} } as never,
      res: {} as never,
    });
    await expect(caller.admin.login({ email: "unknown@example.com", password: "wrong-pass", remember: false })).rejects.toMatchObject({ code: "NOT_FOUND", message: "Not found" });
  });
});
