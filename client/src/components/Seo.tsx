import { useEffect } from "react";

type SeoProps = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  publishedTime?: string | Date | null;
  article?: { headline: string; datePublished?: string | Date | null; image?: string | null };
  prev?: string | null;
  next?: string | null;
  robots?: string;
};

const SITE_NAME = "Aurikrex Bytes";
const SITE_URL = "https://aurikrex.tech";
const DEFAULT_IMAGE = `${SITE_URL}/logo-512.png`;

function absoluteUrl(value: string, base = SITE_URL) {
  try { return new URL(value, base).toString(); } catch { return `${base}/`; }
}
function setMeta(attribute: "name" | "property", key: string, content: string) {
  let node = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!node) { node = document.createElement("meta"); node.setAttribute(attribute, key); document.head.appendChild(node); }
  node.content = content;
}
function setLink(rel: string, href: string) {
  let node = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!node) { node = document.createElement("link"); node.rel = rel; document.head.appendChild(node); }
  node.href = href;
}
function clearLink(rel: string) { document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)?.remove(); }

export default function Seo({ title, description, path = "/", image = DEFAULT_IMAGE, type = "website", publishedTime, article, prev, next, robots = "index,follow,max-image-preview:large" }: SeoProps) {
  useEffect(() => {
    const url = absoluteUrl(path, window.location.origin);
    const imageUrl = absoluteUrl(image, window.location.origin);
    document.title = title;
    setMeta("name", "description", description);
    setMeta("name", "robots", robots);
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", imageUrl);
    setMeta("property", "og:image:alt", title);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", imageUrl);
    setLink("canonical", url);
    if (prev) setLink("prev", absoluteUrl(prev, window.location.origin)); else clearLink("prev");
    if (next) setLink("next", absoluteUrl(next, window.location.origin)); else clearLink("next");

    const existing = document.head.querySelector<HTMLScriptElement>('script[data-seo-jsonld="true"]');
    if (existing) existing.remove();
    if (article) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.seoJsonld = "true";
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        headline: article.headline,
        image: [absoluteUrl(article.image || image, window.location.origin)],
        datePublished: article.datePublished ? new Date(article.datePublished).toISOString() : undefined,
        dateModified: article.datePublished ? new Date(article.datePublished).toISOString() : undefined,
        author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: { "@type": "ImageObject", url: DEFAULT_IMAGE } },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        description,
      });
      document.head.appendChild(script);
    }
  }, [title, description, path, image, type, publishedTime, article, prev, next, robots]);
  return null;
}

export { DEFAULT_IMAGE, SITE_NAME, SITE_URL };
