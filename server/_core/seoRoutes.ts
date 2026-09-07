import type { Express, Request, Response } from "express";
import { listPublishedPosts } from "../db.js";

const siteUrl = () => (process.env.APP_BASE_URL || "https://aurikrex.tech").replace(/\/$/, "");
const xmlEscape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function registerSeoRoutes(app: Express) {
  app.get("/robots.txt", (_req: Request, res: Response) => {
    res.type("text/plain").send(["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /falcon-system-auth", "Disallow: /api", `Sitemap: ${siteUrl()}/sitemap.xml`, ""].join("\n"));
  });

  app.get("/sitemap.xml", async (_req: Request, res: Response) => {
    const staticPaths = ["/", "/archive", "/how-it-works", "/help", "/contact", "/privacy", "/terms"];
    const urls = staticPaths.map(path => `<url><loc>${xmlEscape(`${siteUrl()}${path}`)}</loc></url>`);
    try {
      const posts = await listPublishedPosts();
      for (const post of posts) {
        const lastmod = post.publishedTime || post.updatedAt;
        urls.push(`<url><loc>${xmlEscape(`${siteUrl()}/post/${post.id}`)}</loc>${lastmod ? `<lastmod>${new Date(lastmod).toISOString()}</lastmod>` : ""}</url>`);
      }
    } catch (error) {
      console.warn("[SEO] Sitemap could not load published posts:", error instanceof Error ? error.message : String(error));
    }
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
  });
}
