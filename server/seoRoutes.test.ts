import { describe, expect, it } from "vitest";
import { createPostSeo, injectPostSeo } from "./_core/seoRoutes.js";

describe("post share metadata", () => {
  const post = {
    id: 42,
    headline: "AI & the future <today>",
    body: "A considered briefing about the latest technology shift.\nWith context for the people building what comes next.",
    imageUrl: "https://images.example.com/ai-card.jpg",
    publishedTime: new Date("2026-09-08T08:00:00.000Z"),
  };

  it("builds canonical article metadata from a published post", () => {
    expect(createPostSeo(post)).toMatchObject({
      title: "AI & the future <today> — Aurikrex Bytes",
      description:
        "A considered briefing about the latest technology shift. With context for the people building what comes next.",
      canonicalUrl: "https://aurikrex.tech/post/42",
      imageUrl: "https://images.example.com/ai-card.jpg",
      headline: "AI & the future <today>",
    });
  });

  it("escapes dynamic values and replaces the SPA defaults", () => {
    const template = `<!doctype html><html><head><title>Default</title><meta name="description" content="Default description"><meta property="og:title" content="Default"><meta name="twitter:title" content="Default"><link rel="canonical" href="https://aurikrex.tech/"></head><body></body></html>`;
    const rendered = injectPostSeo(template, createPostSeo(post));

    expect(rendered).toContain(
      "<title>AI &amp; the future &lt;today&gt; — Aurikrex Bytes</title>"
    );
    expect(rendered).toContain(
      '<meta property="og:title" content="AI &amp; the future &lt;today&gt;">'
    );
    expect(rendered).toContain(
      '<meta property="og:image" content="https://images.example.com/ai-card.jpg">'
    );
    expect(rendered).not.toContain("<title>Default</title>");
    expect(rendered).not.toContain('content="Default"');
  });
});
