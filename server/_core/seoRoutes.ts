import type { Express, NextFunction, Request, Response } from "express";
import fs from "fs";
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

async function generateShareCard(post: SeoPost) {
  const title = cleanText(post.headline).slice(0, 72) || "Aurikrex Bytes";
  const body = cleanText(post.body).slice(0, 170) || "Aurikrex Bytes";
  const textColor = "#f5f7ff";
  const panelColor = "#0f172a";
  const accentColor = "#8b5cf6";

  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0b1020"/>
          <stop offset="100%" stop-color="#111827"/>
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#8b5cf6"/>
          <stop offset="100%" stop-color="#22d3ee"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)"/>
      <rect x="58" y="54" width="1084" height="522" rx="28" fill="${panelColor}" fill-opacity="0.82" stroke="rgba(255,255,255,0.1)"/>
      <rect x="92" y="90" width="180" height="40" rx="20" fill="url(#accent)"/>
      <text x="118" y="118" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="#ffffff">AURIKREX</text>
      <text x="92" y="220" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#a5b4fc">BYTES</text>
      <text x="92" y="290" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="800" fill="${textColor}">${escapeXml(title)}</text>
      <text x="92" y="380" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#dbe3ff">${escapeXml(body)}</text>
      <text x="92" y="510" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#a5b4fc">Read the full story →</text>
      <circle cx="1040" cy="220" r="118" fill="rgba(139, 92, 246, 0.2)"/>
      <circle cx="1040" cy="220" r="88" fill="rgba(34, 211, 238, 0.18)"/>
      <text x="1005" y="238" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="700" fill="#ffffff">AB</text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png().toBuffer();
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
      const png = await generateShareCard(post);
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
      return res.status(200).send(png);
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
