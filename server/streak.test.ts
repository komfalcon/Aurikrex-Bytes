import { describe, expect, it } from "vitest";
import { updateDailyStreak } from "./streak.js";

describe("daily reader streaks", () => {
  it("starts a streak for a reader with no previous activity", () => {
    expect(
      updateDailyStreak(
        { currentStreak: 0, longestStreak: 0, lastActiveDate: null },
        "2026-09-07"
      )
    ).toEqual({
      currentStreak: 1,
      longestStreak: 1,
      lastActiveDate: "2026-09-07",
      increased: true,
    });
  });
  it("does not count multiple visits on the same day", () => {
    expect(
      updateDailyStreak(
        { currentStreak: 4, longestStreak: 4, lastActiveDate: "2026-09-07" },
        "2026-09-07"
      ).increased
    ).toBe(false);
  });
  it("increments on the next calendar day and records a new best", () => {
    expect(
      updateDailyStreak(
        { currentStreak: 4, longestStreak: 4, lastActiveDate: "2026-09-07" },
        "2026-09-08"
      )
    ).toMatchObject({ currentStreak: 5, longestStreak: 5, increased: true });
  });
  it("resets after a missed day while preserving the record", () => {
    expect(
      updateDailyStreak(
        { currentStreak: 8, longestStreak: 8, lastActiveDate: "2026-09-07" },
        "2026-09-09"
      )
    ).toMatchObject({ currentStreak: 1, longestStreak: 8, increased: true });
  });
});
