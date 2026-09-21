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
const SITE_URL = "https://www.bytes.aurikrex.tech";
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
    setMeta("name", "keywords", "tech news, AI news, startup news, technology briefing, Aurikrex Bytes, daily tech digest");
    setMeta("name", "robots", robots);
    setMeta("property", "og:site_name", SITE_NAME);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", type);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", imageUrl);
    setMeta("property", "og:image:width", "1200");
    setMeta("property", "og:image:height", "630");
    setMeta("property", "og:image:alt", title);
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", imageUrl);
    setLink("canonical", url);
    if (prev) setLink("prev", absoluteUrl(prev, window.location.origin)); else clearLink("prev");
    if (next) setLink("next", absoluteUrl(next, window.location.origin)); else clearLink("next");

    document.head.querySelectorAll<HTMLScriptElement>('script[data-seo-jsonld]').forEach(s => s.remove());

    if (article) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.seoJsonld = "article";
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        name: article.headline,
        headline: article.headline,
        description,
        url,
        image: [absoluteUrl(article.image || image, window.location.origin)],
        datePublished: article.datePublished ? new Date(article.datePublished).toISOString() : undefined,
        dateModified: article.datePublished ? new Date(article.datePublished).toISOString() : undefined,
        isAccessibleForFree: true,
        articleSection: "Technology",
        inLanguage: "en",
        author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: { "@type": "ImageObject", url: DEFAULT_IMAGE, width: 512, height: 512 } },
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
      });
      document.head.appendChild(script);
    }

    if (path === "/" || path === "") {
      const websiteScript = document.createElement("script");
      websiteScript.type = "application/ld+json";
      websiteScript.dataset.seoJsonld = "website";
      websiteScript.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: SITE_NAME,
        url: SITE_URL,
        description,
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/archive?q={search_term_string}` },
          "query-input": "required name=search_term_string"
        }
      });
      document.head.appendChild(websiteScript);

      const orgScript = document.createElement("script");
      orgScript.type = "application/ld+json";
      orgScript.dataset.seoJsonld = "organization";
      orgScript.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: DEFAULT_IMAGE, width: 512, height: 512 },
        description,
        founder: {
          "@type": "Person",
          name: "Korede Omotosho"
        },
        sameAs: [
          "https://x.com/aurikrex",
          "https://instagram.com/falcon.omotosho",
          "https://www.linkedin.com/in/falcon-omotosho",
          "https://www.facebook.com/share/1SsFXC4mZP/",
          "https://www.tiktok.com/@falcon.omotosho"
        ]
      });
      document.head.appendChild(orgScript);
    }
  }, [title, description, path, image, type, publishedTime, article, prev, next, robots]);
  return null;
}

export { DEFAULT_IMAGE, SITE_NAME, SITE_URL };
