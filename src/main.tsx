import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(() => console.log('[SW] Service worker registered'))
      .catch((err) => console.warn('[SW] Registration failed:', err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
