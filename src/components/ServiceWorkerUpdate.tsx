import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw } from "lucide-react";

export function ServiceWorkerUpdate() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Listen for messages from SW
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SW_UPDATE_AVAILABLE') {
        console.log('[SW] Update available');
        setShowUpdate(true);
      }
    });

    // Check for existing registration
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) {
        setRegistration(reg);
        
        // Check for waiting worker
        if (reg.waiting) {
          setShowUpdate(true);
        }

        // Listen for new workers
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setShowUpdate(true);
              }
            });
          }
        });
      }
    });

    // Listen for controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    // Reload will happen via controllerchange event
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <Alert>
        <RefreshCw className="h-4 w-4" />
        <div className="flex items-center justify-between gap-4 w-full">
          <AlertDescription>
            New version available
          </AlertDescription>
          <Button 
            onClick={handleUpdate}
            size="sm"
            variant="default"
          >
            Update
          </Button>
        </div>
      </Alert>
    </div>
  );
}
