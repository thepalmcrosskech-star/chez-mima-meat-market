import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerAppServiceWorker } from "./lib/registerAppServiceWorker";

// Apply saved theme or default to the management app's light identity.
const savedTheme = localStorage.getItem("theme") || "light";
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
} else {
  document.documentElement.classList.remove("dark");
}

const appRoot = document.getElementById("root");
(window as Window & { __chezMimaStarted?: boolean }).__chezMimaStarted = true;
if (appRoot) createRoot(appRoot).render(<App />);
registerAppServiceWorker();

// iOS Safari/PWA sometimes fails to repaint after resuming from background.
// Force a repaint on resume, and reload client pages after a long absence.
const forceRepaint = () => {
  const root = document.getElementById("root");
  if (!root) return;
  root.style.transform = "translateZ(0)";
  requestAnimationFrame(() => {
    root.style.transform = "";
  });
  window.dispatchEvent(new Event("resize"));
};

let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    hiddenAt = Date.now();
    return;
  }
  const away = hiddenAt ? Date.now() - hiddenAt : 0;
  const path = window.location.pathname;
  const safeToReload = !path.startsWith("/driver") && !path.startsWith("/checkout");
  if (away > 2 * 60 * 1000 && safeToReload) {
    window.location.reload();
  } else {
    forceRepaint();
  }
});

window.addEventListener("pageshow", (e) => {
  if ((e as PageTransitionEvent).persisted) window.location.reload();
});
