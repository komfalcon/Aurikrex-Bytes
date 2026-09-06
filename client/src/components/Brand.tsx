import { Moon, Sun } from "lucide-react";
import { Link } from "wouter";
import { useTheme } from "../contexts/ThemeContext";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className={`brand-lockup${compact ? " brand-lockup--compact" : ""}`} aria-label="Aurikrex Bytes home">
      <img src="/logo.svg" alt="Aurikrex Bytes logo" className="brand-mark" />
      <span className="brand-name">Aurikrex <em>Bytes</em></span>
    </Link>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";
  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${nextTheme} mode`}>
      {theme === "light" ? <Moon size={15} strokeWidth={1.8} /> : <Sun size={15} strokeWidth={1.8} />}
      <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
    </button>
  );
}

export function SiteHeader({ action }: { action?: React.ReactNode }) {
  return (
    <header className="site-header">
      <BrandMark />
      <nav className="site-nav" aria-label="Primary navigation">
        <a href="#briefing">The briefing</a>
        <a href="#principles">Our edit</a>
        {action}
        <ThemeToggle />
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <BrandMark compact />
      <p>Signal for the considered reader.</p>
      <span>© 2026 Aurikrex Bytes</span>
    </footer>
  );
}
