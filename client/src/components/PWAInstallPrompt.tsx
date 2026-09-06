import { useEffect, useState } from "react";
import { ArrowDownToLine, Share, X } from "lucide-react";

const INSTALLED_KEY = "aurikrex-pwa-installed";
const DISMISSED_KEY = "aurikrex-pwa-dismissed";

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
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(INSTALLED_KEY) === "true" || isStandalone()) {
      localStorage.setItem(INSTALLED_KEY, "true");
      return;
    }

    const deferredPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setIos(false);
    };
    const installed = () => {
      localStorage.setItem(INSTALLED_KEY, "true");
      setVisible(false);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", deferredPrompt);
    window.addEventListener("appinstalled", installed);
    setIos(isIos());
    if (localStorage.getItem(DISMISSED_KEY) !== dayKey()) setVisible(true);

    return () => {
      window.removeEventListener("beforeinstallprompt", deferredPrompt);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!visible || (!installEvent && !ios)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, dayKey());
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") localStorage.setItem(INSTALLED_KEY, "true");
    setInstallEvent(null);
    setVisible(false);
  };

  return (
    <aside className="install-prompt" aria-label="Install Aurikrex Bytes">
      <div className="install-prompt-icon"><ArrowDownToLine size={20} /></div>
      <div className="install-prompt-copy">
        <strong>Keep Bytes close</strong>
        <p>{ios ? <>Tap <Share size={14} aria-hidden="true" /> then <b>Add to Home Screen</b> for the 8 AM drop.</> : "Install the daily briefing for a faster, focused reading ritual."}</p>
      </div>
      <div className="install-prompt-actions">
        {!ios && <button className="button button-small" onClick={() => void install}>Install</button>}
        <button className="install-prompt-dismiss" onClick={dismiss} aria-label="Dismiss install prompt"><X size={18} /></button>
      </div>
    </aside>
  );
}
