import { useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, Clock, RefreshCw, ShieldCheck, Wrench, Sparkles, Moon, Sun } from "lucide-react";
import { Logo } from "./ReaderPages";
import { useTheme } from "@/contexts/ThemeContext";
import Seo from "@/components/Seo";

export default function MaintenancePage() {
  const { theme, toggleTheme } = useTheme();
  const [checking, setChecking] = useState(false);

  const handleRefresh = () => {
    setChecking(true);
    window.location.reload();
  };

  return (
    <div className="maintenance-layout">
      <Seo
        title="Under Maintenance — Aurikrex Bytes"
        description="Aurikrex Bytes is temporarily undergoing scheduled maintenance and updates."
        path="/"
        robots="noindex,nofollow"
      />

      {/* Top Header */}
      <header className="maintenance-header">
        <Logo />
        <button
          className="admin-icon-button"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          title="Toggle color theme"
        >
          {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
        </button>
      </header>

      {/* Main Content */}
      <main className="maintenance-container">
        <div className="maintenance-card">
          <div className="maintenance-badge">
            <span className="maintenance-dot" />
            <span>Scheduled Maintenance</span>
          </div>

          <div className="maintenance-icon-wrap">
            <Wrench className="maintenance-main-icon" size={36} />
          </div>

          <h1 className="maintenance-title">
            Aurikrex Bytes is currently<br /><em>under maintenance</em>.
          </h1>

          <p className="maintenance-description">
            We are performing essential system updates and performance upgrades to provide a smoother,
            faster reading experience. All stories and reader data are completely safe and will be accessible again shortly.
          </p>

          <div className="maintenance-info-grid">
            <div className="maintenance-info-item">
              <Clock size={18} className="maintenance-info-icon" />
              <div>
                <strong>Status</strong>
                <span>Updates in progress</span>
              </div>
            </div>

            <div className="maintenance-info-item">
              <ShieldCheck size={18} className="maintenance-info-icon" />
              <div>
                <strong>Data Safety</strong>
                <span>100% Preserved</span>
              </div>
            </div>
          </div>

          <div className="maintenance-actions">
            <button
              className="button button-primary maintenance-btn"
              onClick={handleRefresh}
              disabled={checking}
            >
              <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
              <span>{checking ? "Checking status…" : "Check status / Refresh"}</span>
            </button>
          </div>
        </div>

        {/* Staff newsroom access shortcut */}
        <div className="maintenance-footer-hint">
          <span>Newsroom editorial team?</span>
          <Link href="/falcon-system-auth" className="maintenance-admin-link">
            Newsroom sign in <ArrowRight size={13} />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="maintenance-footer">
        <p>© {new Date().getFullYear()} Aurikrex Bytes. Curated technology briefing.</p>
      </footer>
    </div>
  );
}
