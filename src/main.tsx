import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// DEV: Block direct baseline table access
if (import.meta.env.DEV) {
  const originalFetch = window.fetch;
  window.fetch = function(...args: any[]) {
    const url = String(args[0]);
    if (/brand_scores|brand_baseline|effective_named/i.test(url)) {
      console.error('🚫 BLOCKED: Direct baseline fetch in dev:', url);
      return Promise.reject(new Error('Baseline table access blocked - use Edge API'));
    }
    return originalFetch.apply(window, args as [RequestInfo | URL, RequestInit?]);
  };
  console.log('✓ Dev baseline guard active');
}

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(() => console.log('[SW] Service worker registered'))
      .catch((err) => console.warn('[SW] Registration failed:', err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
