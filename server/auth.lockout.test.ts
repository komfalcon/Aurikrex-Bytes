import { describe, expect, it, beforeEach } from "vitest";
import {
  checkPasswordAttemptLockout,
  recordFailedPasswordAttempt,
  resetPasswordAttempts,
  clearAllAuthRateLimitStores,
  MAX_FAILED_BEFORE_LOCKOUT,
  MAX_FAILED_BEFORE_AUTO_RESET,
} from "./_core/security.js";

describe("failed password attempts and lockout policy", () => {
  beforeEach(() => {
    clearAllAuthRateLimitStores();
  });

  it("tracks remaining attempts before temporary account lockout", () => {
    const email = "user@example.com";

    const attempt1 = recordFailedPasswordAttempt(email);
    expect(attempt1.count).toBe(1);
    expect(attempt1.locked).toBe(false);
    expect(attempt1.message).toContain("4 attempts remaining");

    const attempt2 = recordFailedPasswordAttempt(email);
    expect(attempt2.count).toBe(2);
    expect(attempt2.message).toContain("3 attempts remaining");

    const attempt3 = recordFailedPasswordAttempt(email);
    expect(attempt3.message).toContain("2 attempts remaining");

    const attempt4 = recordFailedPasswordAttempt(email);
    expect(attempt4.message).toContain("1 attempt remaining");
  });

  it("locks the account for 15 minutes upon reaching 5 failed attempts", () => {
    const email = "lockout-test@example.com";

    for (let i = 0; i < MAX_FAILED_BEFORE_LOCKOUT - 1; i++) {
      recordFailedPasswordAttempt(email);
    }

    const lockoutAttempt = recordFailedPasswordAttempt(email);
    expect(lockoutAttempt.count).toBe(5);
    expect(lockoutAttempt.locked).toBe(true);
    expect(lockoutAttempt.message).toContain("temporarily locked for 15 minutes");

    const check = checkPasswordAttemptLockout(email);
    expect(check.locked).toBe(true);
    expect(check.message).toContain("temporarily locked");
  });

  it("triggers auto reset email dispatch upon reaching 8 failed attempts", () => {
    const email = "autoreset-test@example.com";

    for (let i = 0; i < MAX_FAILED_BEFORE_AUTO_RESET - 1; i++) {
      recordFailedPasswordAttempt(email);
    }

    const autoResetAttempt = recordFailedPasswordAttempt(email);
    expect(autoResetAttempt.count).toBe(8);
    expect(autoResetAttempt.locked).toBe(true);
    expect(autoResetAttempt.autoResetNeeded).toBe(true);
    expect(autoResetAttempt.message).toContain("password reset link has been automatically sent");
  });

  it("resets failed attempt counter when resetPasswordAttempts is called", () => {
    const email = "reset-clears@example.com";

    recordFailedPasswordAttempt(email);
    recordFailedPasswordAttempt(email);
    expect(checkPasswordAttemptLockout(email).locked).toBe(false);

    resetPasswordAttempts(email);

    const freshAttempt = recordFailedPasswordAttempt(email);
    expect(freshAttempt.count).toBe(1);
    expect(freshAttempt.message).toContain("4 attempts remaining");
  });
});
