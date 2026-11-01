import { describe, expect, it, beforeEach } from "vitest";
import { getDb, publishDuePosts } from "./db.js";
import { posts } from "../drizzle/schema.js";

describe("publishDuePosts Concurrency Safety", () => {
  beforeEach(async () => {
    const db = await getDb();
    if (db) {
      // Clear posts table for clean test state
      await db.delete(posts);
    }
  });

  it("handles 10 concurrent executions atomically without double-publishing", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable");

    const now = new Date("2026-10-26T08:00:00.000Z");
    const pastTime = new Date("2026-10-26T07:00:00.000Z");
    const futureTime = new Date("2026-10-26T12:00:00.000Z");

    // Seed 5 due scheduled posts, 2 future scheduled posts, and 1 draft
    await db.insert(posts).values([
      {
        headline: "Due Post 1",
        body: "Content 1",
        status: "scheduled",
        scheduledTime: pastTime,
        createdBy: 1,
      },
      {
        headline: "Due Post 2",
        body: "Content 2",
        status: "scheduled",
        scheduledTime: pastTime,
        createdBy: 1,
      },
      {
        headline: "Due Post 3",
        body: "Content 3",
        status: "scheduled",
        scheduledTime: pastTime,
        createdBy: 1,
      },
      {
        headline: "Due Post 4",
        body: "Content 4",
        status: "scheduled",
        scheduledTime: pastTime,
        createdBy: 1,
      },
      {
        headline: "Due Post 5",
        body: "Content 5",
        status: "scheduled",
        scheduledTime: pastTime,
        createdBy: 1,
      },
      {
        headline: "Future Post 1",
        body: "Future Content 1",
        status: "scheduled",
        scheduledTime: futureTime,
        createdBy: 1,
      },
      {
        headline: "Future Post 2",
        body: "Future Content 2",
        status: "scheduled",
        scheduledTime: futureTime,
        createdBy: 1,
      },
      {
        headline: "Draft Post",
        body: "Draft Content",
        status: "draft",
        createdBy: 1,
      },
    ]);

    // Execute 10 concurrent calls to publishDuePosts
    const concurrentRuns = Array.from({ length: 10 }, () => publishDuePosts(now));
    const results = await Promise.all(concurrentRuns);

    // Exactly 5 due posts should have been updated across all concurrent runs
    const totalPublished = results.reduce((sum, r) => sum + r, 0);
    expect(totalPublished).toBe(5);

    // Verify database state
    const allPosts = await db.select().from(posts);
    const publishedPosts = allPosts.filter(p => p.status === "published");
    const scheduledPosts = allPosts.filter(p => p.status === "scheduled");
    const draftPosts = allPosts.filter(p => p.status === "draft");

    expect(publishedPosts).toHaveLength(5);
    for (const p of publishedPosts) {
      expect(p.scheduledTime).toBeNull();
      expect(p.publishedTime).toBeInstanceOf(Date);
    }

    expect(scheduledPosts).toHaveLength(2);
    for (const p of scheduledPosts) {
      expect(p.scheduledTime?.toISOString()).toBe(futureTime.toISOString());
    }

    expect(draftPosts).toHaveLength(1);
    expect(draftPosts[0].headline).toBe("Draft Post");

    // A subsequent run immediately after should update 0 posts
    const subsequentResult = await publishDuePosts(now);
    expect(subsequentResult).toBe(0);
  });
});
