import "./lib/installPreviewGuard";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register Service Worker
if ('serviceWorker' in navigator && import.meta.env.VITE_READ_ONLY_PREVIEW !== 'true') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then(() => console.log('[SW] Service worker registered'))
      .catch((err) => console.warn('[SW] Registration failed:', err));
  });
}

createRoot(document.getElementById("root")!).render(<>
  {import.meta.env.VITE_READ_ONLY_PREVIEW === 'true' && <div role="status" className="bg-amber-100 text-amber-950 p-2 text-center text-xs">Local review · live public records only · account changes and payments disabled</div>}
  <App />
</>);
