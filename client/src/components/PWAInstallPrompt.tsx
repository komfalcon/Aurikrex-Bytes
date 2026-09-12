import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Share, X } from "lucide-react";

const INSTALLED_KEY = "aurikrex-pwa-installed";
const SHOWN_KEY = "aurikrex-pwa-shown";
const TOAST_DURATION = 10_000;
const INSTALL_AVAILABLE_EVENT = "aurikrex:install-available";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let pendingInstallPrompt: BeforeInstallPromptEvent | null = null;

// Capture the one-shot browser event as soon as this module loads. React effects
// can otherwise miss it if the browser fires it before the component mounts.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    pendingInstallPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(INSTALL_AVAILABLE_EVENT));
  });
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

const dayKey = () => new Intl.DateTimeFormat("en-CA").format(new Date());

export default function PWAInstallPrompt() {
  const installEventRef = useRef<BeforeInstallPromptEvent | null>(pendingInstallPrompt);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(pendingInstallPrompt);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState("");

  useEffect(() => {
    if (localStorage.getItem(INSTALLED_KEY) === "true" || isStandalone()) {
      localStorage.setItem(INSTALLED_KEY, "true");
      pendingInstallPrompt = null;
      return;
    }

    const showToast = () => {
      if (localStorage.getItem(SHOWN_KEY) === dayKey()) return;
      setVisible(true);
      timerRef.current = setTimeout(() => {
        localStorage.setItem(SHOWN_KEY, dayKey());
        setVisible(false);
      }, TOAST_DURATION);
    };
    const adoptPrompt = () => {
      if (!pendingInstallPrompt) return;
      installEventRef.current = pendingInstallPrompt;
      setInstallEvent(pendingInstallPrompt);
      setIos(false);
      setFallbackMessage("");
      showToast();
    };
    const installed = () => {
      localStorage.setItem(INSTALLED_KEY, "true");
      if (timerRef.current) clearTimeout(timerRef.current);
      pendingInstallPrompt = null;
      installEventRef.current = null;
      setVisible(false);
      setInstalling(false);
      setInstallEvent(null);
    };

    window.addEventListener(INSTALL_AVAILABLE_EVENT, adoptPrompt);
    window.addEventListener("appinstalled", installed);
    setIos(isIos());
    adoptPrompt();
    if (isIos()) showToast();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener(INSTALL_AVAILABLE_EVENT, adoptPrompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!visible || (!installEvent && !ios)) return null;

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.setItem(SHOWN_KEY, dayKey());
    setVisible(false);
  };

  const install = async () => {
    const promptEvent = installEventRef.current;
    if (!promptEvent || installing) {
      setFallbackMessage("Installation is not available in this browser. Use your browser menu to add Bytes to your home screen.");
      return;
    }
    setInstalling(true);
    setFallbackMessage("");
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") localStorage.setItem(INSTALLED_KEY, "true");
      else setFallbackMessage("Installation was dismissed. You can try again from your browser menu.");
    } catch {
      setFallbackMessage("Installation is unavailable right now. Try your browser’s Add to Home Screen option.");
    } finally {
      if (timerRef.current) clearTimeout(timerRef.current);
      localStorage.setItem(SHOWN_KEY, dayKey());
      pendingInstallPrompt = null;
      installEventRef.current = null;
      setInstallEvent(null);
      setInstalling(false);
      setVisible(false);
    }
  };

  return (
    <aside className="install-prompt" aria-label="Install Aurikrex Bytes" role="status">
      <div className="install-prompt-icon"><ArrowDownToLine size={20} /></div>
      <div className="install-prompt-copy">
        <strong>Keep Bytes close</strong>
        <p>{fallbackMessage || (ios ? <>Tap <Share size={14} aria-hidden="true" /> then <b>Add to Home Screen</b> for the 8 AM drop.</> : "Install the daily briefing for a faster, focused reading ritual.")}</p>
      </div>
      <div className="install-prompt-actions">
        {!ios && <button type="button" className="button button-small" onClick={() => void install()} disabled={installing}>{installing ? "Opening…" : "Install"}</button>}
        <button type="button" className="install-prompt-dismiss" onClick={dismiss} aria-label="Dismiss install prompt"><X size={18} /></button>
      </div>
    </aside>
  );
}
