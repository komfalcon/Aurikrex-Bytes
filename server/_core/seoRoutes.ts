import type { Express, NextFunction, Request, Response } from "express";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { getPostById, listPublishedPosts } from "../db.js";

const siteUrl = () =>
  (process.env.APP_BASE_URL || "https://aurikrex.tech").replace(/\/$/, "");
const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
const htmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
const cleanText = (value: string) => value.replace(/\s+/g, " ").trim();
const excerpt = (value: string, length = 160) => {
  const text = cleanText(value);
  return text.length > length ? `${text.slice(0, length).trim()}…` : text;
};
const absoluteUrl = (value: string) => {
  try {
    return new URL(value, siteUrl()).toString();
  } catch {
    return `${siteUrl()}/logo-512.png`;
  }
};
const safeJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

type SeoPost = {
  id: number;
  headline: string;
  body: string;
  imageUrl?: string | null;
  publishedTime?: Date | null;
  updatedAt?: Date | null;
};

type PostSeo = {
  title: string;
  description: string;
  canonicalUrl: string;
  imageUrl: string;
  headline: string;
  publishedTime?: Date | null;
};

export function createPostSeo(post: SeoPost): PostSeo {
  const canonicalUrl = `${siteUrl()}/post/${post.id}`;
  const imageUrl = `${siteUrl()}/api/share/post/${post.id}/image`;

  return {
    title: `${post.headline} — Aurikrex Bytes`,
    description: excerpt(post.body),
    canonicalUrl,
    imageUrl,
    headline: post.headline,
    publishedTime: post.publishedTime || post.updatedAt,
  };
}

function buildMetaTags(seo: PostSeo) {
  const published = seo.publishedTime
    ? new Date(seo.publishedTime).toISOString()
    : undefined;
  const tags = [
    `<title>${htmlEscape(seo.title)}</title>`,
    `<meta name="description" content="${htmlEscape(seo.description)}">`,
    `<meta name="robots" content="index,follow,max-image-preview:large">`,
    `<meta property="og:site_name" content="Aurikrex Bytes">`,
    `<meta property="og:title" content="${htmlEscape(seo.headline)}">`,
    `<meta property="og:description" content="${htmlEscape(seo.description)}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:url" content="${htmlEscape(seo.canonicalUrl)}">`,
    `<meta property="og:image" content="${htmlEscape(seo.imageUrl)}">`,
    `<meta property="og:image:alt" content="${htmlEscape(seo.headline)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${htmlEscape(seo.headline)}">`,
    `<meta name="twitter:description" content="${htmlEscape(seo.description)}">`,
    `<meta name="twitter:image" content="${htmlEscape(seo.imageUrl)}">`,
    `<link rel="canonical" href="${htmlEscape(seo.canonicalUrl)}">`,
  ];
  if (published)
    tags.push(
      `<meta property="article:published_time" content="${published}">`
    );
  tags.push(
    `<script type="application/ld+json">${safeJson({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: seo.headline,
      description: seo.description,
      image: [seo.imageUrl],
      datePublished: published,
      dateModified: published,
      author: {
        "@type": "Organization",
        name: "Aurikrex Bytes",
        url: siteUrl(),
      },
      publisher: {
        "@type": "Organization",
        name: "Aurikrex Bytes",
        url: siteUrl(),
        logo: { "@type": "ImageObject", url: `${siteUrl()}/logo-512.png` },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": seo.canonicalUrl },
    })}</script>`
  );
  return tags.join("\n    ");
}

export function injectPostSeo(template: string, seo: PostSeo) {
  const withoutDefaultSeo = template
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name=["']description["'][^>]*>/gi, "")
    .replace(/<meta\s+name=["']robots["'][^>]*>/gi, "")
    .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, "")
    .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, "")
    .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta\s+property=["']article:[^"']+["'][^>]*>/gi, "");
  return withoutDefaultSeo.replace(
    /<\/head>/i,
    `    ${buildMetaTags(seo)}\n  </head>`
  );
}

function renderShareDocument(seo: PostSeo) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${buildMetaTags(seo)}
  </head>
  <body>
    <main>
      <h1>${htmlEscape(seo.headline)}</h1>
      <p>${htmlEscape(seo.description)}</p>
      <a href="${htmlEscape(seo.canonicalUrl)}">Read the story on Aurikrex Bytes</a>
    </main>
  </body>
</html>`;
}

async function readProductionShell() {
  const shellPath = path.resolve(import.meta.dirname, "public", "index.html");
  return fs.promises.readFile(shellPath, "utf8");
}

async function fetchRemoteImageBuffer(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function buildShareSvg(post: SeoPost, coverBuffer: Buffer | null) {
  const title = cleanText(post.headline).slice(0, 72) || "Aurikrex Bytes";
  const body = cleanText(post.body).slice(0, 200) || "A daily curated technology briefing.";
  const titleLines = wrapTitle(title, 46);
  // Wrap body into lines of ~48 chars at font-size 22, max 3 lines
  const bodyLines = wrapTitle(body, 48).slice(0, 3);

  let coverMarkup = `<rect x="0" y="0" width="1200" height="630" fill="url(#bg)"/>`;
  if (coverBuffer) {
    const imageBase64 = coverBuffer.toString("base64");
    coverMarkup = `
      <defs>
        <pattern id="grain" patternUnits="userSpaceOnUse" width="40" height="40">
          <rect width="40" height="40" fill="#101826" fill-opacity="0.08"/>
          <circle cx="4" cy="4" r="1" fill="#ffffff" fill-opacity="0.06"/>
          <circle cx="24" cy="8" r="1" fill="#ffffff" fill-opacity="0.04"/>
          <circle cx="20" cy="26" r="1" fill="#ffffff" fill-opacity="0.05"/>
        </pattern>
      </defs>
      <rect x="0" y="0" width="1200" height="630" fill="url(#bg)"/>
      <image x="660" y="0" width="540" height="630" href="data:image/png;base64,${imageBase64}" preserveAspectRatio="xMidYMid slice"/>
      <rect x="660" y="0" width="540" height="630" fill="url(#grain)"/>
      <rect x="660" y="0" width="540" height="630" fill="#0b1220" opacity="0.50"/>
    `;
  } else {
    coverMarkup = `<rect x="0" y="0" width="1200" height="630" fill="url(#bg)"/><circle cx="950" cy="330" r="180" fill="#8b5cf6" opacity="0.32"/><path d="M850 90 C998 120 1050 250 1000 405 C960 525 845 530 790 440 C760 385 770 250 850 90" fill="#22d3ee" opacity="0.2"/>`;
  }

  // Position body text dynamically below the title block
  const bodyY = 185 + titleLines.length * 58 + 28;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#101726"/>
        <stop offset="1" stop-color="#17184a"/>
      </linearGradient>
      <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#8b5cf6"/>
        <stop offset="1" stop-color="#22d3ee"/>
      </linearGradient>
      <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
        <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
    </defs>
    ${coverMarkup}
    <rect x="70" y="70" width="500" height="490" rx="24" fill="#07111f" fill-opacity="0.72" stroke="#b8a2ff" stroke-opacity="0.35" filter="url(#shadow)"/>
    <text x="110" y="130" fill="#a78bfa" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" letter-spacing="2">AURIKREX BYTES</text>
    <rect x="110" y="150" width="120" height="4" fill="url(#line)"/>
    <text x="110" y="185" fill="#eef2ff" font-family="Arial, Helvetica, sans-serif" font-size="48" font-weight="700">${titleLines.map((line, i) => `<tspan x="110" dy="${i===0 ? 0 : 58}">${escapeXml(line)}</tspan>`).join("")}</text>
    <text x="110" y="${bodyY}" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="400">${bodyLines.map((line, i) => `<tspan x="110" dy="${i===0 ? 0 : 30}">${escapeXml(line)}</tspan>`).join("")}</text>
    <text x="110" y="510" fill="#8b5cf6" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700">READ THE STORY</text>
    <text x="110" y="543" fill="#7dd3fc" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="500">aurikrex.tech</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

function wrapTitle(title: string, maxCharsPerLine: number) {
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

async function generateShareCard(post: SeoPost) {
  const coverBuffer = post.imageUrl ? await fetchRemoteImageBuffer(post.imageUrl) : null;
  return await buildShareSvg(post, coverBuffer);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function sendPostPreview(
  req: Request,
  res: Response,
  next: NextFunction,
  mode: "shell" | "share" | "image"
) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return next();

  try {
    const post = await getPostById(id);
    if (!post || post.status !== "published")
      return res.status(404).send("Story not found");

    if (mode === "image") {
      // Cache to /tmp — writable in both local dev and Vercel serverless (unlike the static build dir).
      const tmpDir = path.join(os.tmpdir(), "ab-share-cards");
      const cacheFile = path.join(tmpDir, `post-${id}.png`);
      let png: Buffer;
      try {
        await fs.promises.mkdir(tmpDir, { recursive: true });
        if (fs.existsSync(cacheFile)) {
          png = await fs.promises.readFile(cacheFile);
        } else {
          png = await generateShareCard(post);
          // Best-effort write; ignore errors (e.g. read-only FS edge cases)
          await fs.promises.writeFile(cacheFile, png).catch(() => undefined);
        }
      } catch {
        // Fallback: generate fresh on every request if cache is unavailable
        png = await generateShareCard(post);
      }
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
      return res.status(200).end(png);
    }

    const seo = createPostSeo(post);
    if (mode === "share") {
      return res.status(200).type("html").send(renderShareDocument(seo));
    }

    const template = await readProductionShell();
    return res.status(200).type("html").send(injectPostSeo(template, seo));
  } catch (error) {
    console.warn(
      "[SEO] Dynamic post metadata could not be rendered:",
      error instanceof Error ? error.message : String(error)
    );
    return next(error);
  }
}

export function registerSeoRoutes(app: Express) {
  app.get("/robots.txt", (_req: Request, res: Response) => {
    res
      .type("text/plain")
      .send(
        [
          "User-agent: *",
          "Allow: /",
          "Disallow: /admin",
          "Disallow: /falcon-system-auth",
          "Disallow: /api",
          `Sitemap: ${siteUrl()}/sitemap.xml`,
          "",
        ].join("\n")
      );
  });

  app.get("/sitemap.xml", async (_req: Request, res: Response) => {
    const staticPaths = [
      "/",
      "/archive",
      "/how-it-works",
      "/help",
      "/contact",
      "/privacy",
      "/terms",
    ];
    const urls = staticPaths.map(
      pathValue =>
        `<url><loc>${xmlEscape(`${siteUrl()}${pathValue}`)}</loc></url>`
    );
    try {
      const posts = await listPublishedPosts();
      for (const post of posts) {
        const lastmod = post.publishedTime || post.updatedAt;
        urls.push(
          `<url><loc>${xmlEscape(`${siteUrl()}/post/${post.id}`)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}</url>`
        );
      }
    } catch (error) {
      console.warn(
        "[SEO] Sitemap could not load published posts:",
        error instanceof Error ? error.message : String(error)
      );
    }
    res
      .type("application/xml")
      .send(
        `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`
      );
  });

  // In a normal production server, serve the SPA shell with article-specific tags.
  // Development delegates to Vite, which owns the HTML fallback.
  app.get("/post/:id", (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === "development") return next();
    return void sendPostPreview(req, res, next, "shell");
  });

  // Vercel sends crawler requests here so social clients receive metadata without
  // changing the normal browser rewrite to the static SPA entrypoint.
  app.get(
    "/api/share/post/:id",
    (req: Request, res: Response, next: NextFunction) => {
      return void sendPostPreview(req, res, next, "share");
    }
  );

  app.get(
    "/api/share/post/:id/image",
    (req: Request, res: Response, next: NextFunction) => {
      return void sendPostPreview(req, res, next, "image");
    }
  );
}
