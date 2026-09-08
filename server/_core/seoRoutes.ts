import type { Express, NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
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
  return {
    title: `${post.headline} — Aurikrex Bytes`,
    description: excerpt(post.body),
    canonicalUrl: `${siteUrl()}/post/${post.id}`,
    imageUrl: absoluteUrl(post.imageUrl || "/logo-512.png"),
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

async function sendPostPreview(
  req: Request,
  res: Response,
  next: NextFunction,
  mode: "shell" | "share"
) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return next();

  try {
    const post = await getPostById(id);
    if (!post || post.status !== "published")
      return res.status(404).send("Story not found");

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
}
