import { ArrowRight, Compass, Home, Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import { PublicLayout } from "@/public/ReaderPages";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <PublicLayout
      seo={{
        title: "Page not found — Aurikrex Bytes",
        description: "The Aurikrex Bytes page you requested could not be found.",
        path: "/404",
        robots: "noindex,nofollow",
      }}
    >
      <main className="container page-main">
        <div className="empty-state px-not-found-card">
          <div className="empty-icon">
            <Compass size={26} />
          </div>
          <span className="eyebrow">404 · Off the radar</span>
          <h2>Page not found</h2>
          <p>
            The briefing or page you requested does not exist, or may have been moved in the archive.
          </p>
          <div
            id="not-found-button-group"
            style={{ display: "flex", flexWrap: "wrap", gap: "12px", justifyContent: "center", marginTop: "8px" }}
          >
            <button type="button" onClick={handleGoHome} className="button">
              <Home size={15} />
              <span>Back to Discover</span>
            </button>
            <Link href="/archive" className="button button-outline">
              <Search size={15} />
              <span>Search All Bytes</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </main>
    </PublicLayout>
  );
}
