import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Share, X } from "lucide-react";

const INSTALLED_KEY = "aurikrex-pwa-installed";
const SHOWN_KEY = "aurikrex-pwa-shown";
const TOAST_DURATION = 10_000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () =>
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
  (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

const dayKey = () => new Intl.DateTimeFormat("en-CA").format(new Date());

export default function PWAInstallPrompt() {
  // Keep the event in a ref as well as state. Browser install events are one-shot
  // objects, and a ref ensures the click handler always sees the captured event.
  const installEventRef = useRef<BeforeInstallPromptEvent | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(INSTALLED_KEY) === "true" || isStandalone()) {
      localStorage.setItem(INSTALLED_KEY, "true");
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
    const deferredPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      installEventRef.current = promptEvent;
      setInstallEvent(promptEvent);
      setIos(false);
      showToast();
    };
    const installed = () => {
      localStorage.setItem(INSTALLED_KEY, "true");
      if (timerRef.current) clearTimeout(timerRef.current);
      setVisible(false);
      setInstalling(false);
      installEventRef.current = null;
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", deferredPrompt);
    window.addEventListener("appinstalled", installed);
    setIos(isIos());
    if (isIos()) showToast();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("beforeinstallprompt", deferredPrompt);
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
    if (!promptEvent || installing) return;
    setInstalling(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") localStorage.setItem(INSTALLED_KEY, "true");
    } finally {
      if (timerRef.current) clearTimeout(timerRef.current);
      localStorage.setItem(SHOWN_KEY, dayKey());
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
        <p>{ios ? <>Tap <Share size={14} aria-hidden="true" /> then <b>Add to Home Screen</b> for the 8 AM drop.</> : "Install the daily briefing for a faster, focused reading ritual."}</p>
      </div>
      <div className="install-prompt-actions">
        {!ios && <button className="button button-small" onClick={() => void install()} disabled={installing}>{installing ? "Opening…" : "Install"}</button>}
        <button className="install-prompt-dismiss" onClick={dismiss} aria-label="Dismiss install prompt"><X size={18} /></button>
      </div>
    </aside>
  );
}
