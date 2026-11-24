import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      filename: "sw.js",
      devOptions: { enabled: false },
      includeAssets: ["favicon.ico"],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        importScripts: ['/sw-push.js'],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
            handler: "NetworkFirst",
            options: { cacheName: "html-navigation", networkTimeoutSeconds: 3 },
          },
        ],
      },
      manifest: {
        id: "/",
        name: "Chez Mima",
        short_name: "Chez Mima",
        description: "Boucherie Chez Mima : viandes, volailles, charcuterie et fromages 100 % halal, faits au Maroc. Commande en ligne, livraison ou retrait à Marrakech.",
        lang: "fr",
        dir: "ltr",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        categories: ["food", "shopping", "lifestyle"],
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/pwa-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        screenshots: [
          { src: "/screenshot-mobile-1.jpg", sizes: "780x1688", type: "image/jpeg", form_factor: "narrow", label: "Accueil de la boucherie Chez Mima" },
          { src: "/screenshot-mobile-2.jpg", sizes: "780x1688", type: "image/jpeg", form_factor: "narrow", label: "Catalogue des produits" },
          { src: "/screenshot-wide.jpg", sizes: "1280x800", type: "image/jpeg", form_factor: "wide", label: "Chez Mima sur ordinateur" },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
