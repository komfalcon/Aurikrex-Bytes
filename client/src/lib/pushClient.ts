export type OneSignalInstance = {
  init(options: {
    appId: string;
    serviceWorkerPath?: string;
    serviceWorkerParam?: { scope: string };
  }): Promise<void>;
  Notifications: {
    requestPermission(): Promise<void>;
    permission: boolean;
  };
  User: {
    PushSubscription: {
      id?: string | null;
      optedIn?: boolean;
      optIn(): Promise<void>;
      optOut(): Promise<void>;
    };
  };
  logout(): Promise<void>;
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(instance: OneSignalInstance) => void | Promise<void>>;
  }
}

let oneSignalPromise: Promise<OneSignalInstance> | null = null;

export function getOneSignal(appId: string): Promise<OneSignalInstance> {
  if (oneSignalPromise) return oneSignalPromise;
  if (!appId) return Promise.reject(new Error("OneSignal is not configured for this site."));

  oneSignalPromise = new Promise((resolve, reject) => {
    const queue = window.OneSignalDeferred || [];
    window.OneSignalDeferred = queue;
    queue.push(async (OneSignal: OneSignalInstance) => {
      try {
        await OneSignal.init({
          appId,
          serviceWorkerPath: "/sw.js",
          serviceWorkerParam: { scope: "/" },
        });
        resolve(OneSignal);
      } catch (error) {
        reject(error);
      }
    });
  });

  return oneSignalPromise;
}

export async function waitForSubscriptionId(OneSignal: OneSignalInstance): Promise<string | null> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const subscriptionId = OneSignal.User?.PushSubscription?.id;
    if (subscriptionId) return subscriptionId;
    await new Promise(resolve => window.setTimeout(resolve, 400));
  }
  return null;
}

export interface PushPromptState {
  asksCount: number;
  lastAskedAt: number;
  status: "idle" | "dismissed" | "granted";
}

const STORAGE_KEY = "aurikrex:push-prompt-state";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ASKS = 3;

export function getPushPromptState(): PushPromptState {
  if (typeof window === "undefined") {
    return { asksCount: 0, lastAskedAt: 0, status: "idle" };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return { asksCount: 0, lastAskedAt: 0, status: "idle" };
}

export function savePushPromptState(state: PushPromptState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function shouldShowPushPrompt(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;

  // If already granted or denied at the browser level, never show pre-prompt
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return false;
  }

  const state = getPushPromptState();
  if (state.status === "granted") return false;
  if (state.asksCount >= MAX_ASKS) return false;
  if (state.lastAskedAt && Date.now() - state.lastAskedAt < SEVEN_DAYS_MS) return false;

  return true;
}

export function recordPushPromptDismissed() {
  const current = getPushPromptState();
  savePushPromptState({
    asksCount: current.asksCount + 1,
    lastAskedAt: Date.now(),
    status: "dismissed",
  });
}

export function recordPushPromptGranted() {
  const current = getPushPromptState();
  savePushPromptState({
    asksCount: current.asksCount + 1,
    lastAskedAt: Date.now(),
    status: "granted",
  });
}

export function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = "standalone" in navigator && (navigator as any).standalone;
  return isIOS && !isStandalone;
}
