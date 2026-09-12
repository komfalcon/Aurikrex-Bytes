import { describe, expect, it } from "vitest";
import { isValidPassword } from "./auth.js";

describe("reader password policy", () => {
  it("requires length, a number, and a symbol", () => {
    expect(isValidPassword("short1!")).toBe(false);
    expect(isValidPassword("longpassword!")).toBe(false);
    expect(isValidPassword("LongPassword1")).toBe(false);
    expect(isValidPassword("LongPassword1!")).toBe(true);
  });
});
