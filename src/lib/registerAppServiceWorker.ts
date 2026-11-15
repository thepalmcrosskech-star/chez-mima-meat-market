import { registerSW } from "virtual:pwa-register";

const appWorkerPath = "/sw.js";

function isLovablePreview(hostname: string) {
  const normalized = hostname.toLowerCase();
  const previewDomains = [".lovable.app", ".gpt-eng.com", ".gptengineer.run"];
  const isBrandedPreview = previewDomains.some((domain) => {
    if (!normalized.endsWith(domain)) return false;
    const firstLabel = normalized.slice(0, -domain.length);
    return /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(firstLabel);
  });

  return isBrandedPreview
    || /^project--.+-dev\.(?:lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(normalized)
    || normalized === "lovableproject.com"
    || normalized.endsWith(".lovableproject.com")
    || normalized === "lovableproject-dev.com"
    || normalized.endsWith(".lovableproject-dev.com")
    || normalized === "beta.lovable.dev"
    || normalized.endsWith(".beta.lovable.dev");
}

async function unregisterAppWorker() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(registrations.map(async (registration) => {
    const workers = [registration.active, registration.waiting, registration.installing];
    const belongsToApp = workers.some((worker) => {
      if (!worker) return false;
      const url = new URL(worker.scriptURL);
      return url.origin === window.location.origin && url.pathname === appWorkerPath;
    });
    if (belongsToApp) await registration.unregister();
  }));
}

export function registerAppServiceWorker() {
  const hostname = window.location.hostname.toLowerCase();
  const isDisallowedContext = !import.meta.env.PROD
    || window.self !== window.top
    || isLovablePreview(hostname)
    || new URL(window.location.href).searchParams.get("sw") === "off";

  if (isDisallowedContext) {
    void unregisterAppWorker();
    return;
  }

  if ("serviceWorker" in navigator) {
    void registerSW({ immediate: true })().catch(() => undefined);
  }
}